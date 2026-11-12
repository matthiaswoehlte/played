/* Liest eine Excel-Datei (.xlsx) ohne fremde Bibliothek und gibt je Blatt eine CSV zurück.
   Eine .xlsx ist ein ZIP mit XML darin: Arbeitsmappe (Blattnamen), gemeinsame Texte, je Blatt die Zellen.
   Werte werden so übernommen, wie Excel sie speichert (Datumswerte bleiben die Excel-Zahl, Formeln ihr
   letztes Ergebnis). Für die KI reicht das: Sie bekommt die Zahlen, der Anhang selbst bleibt das Original. */
import { inflateRawSync } from 'node:zlib';

/* ---------- ZIP ---------- */
function eintraege(buf) {
  let ende = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new Error('keine Excel-Datei (kein ZIP)');
  const anzahl = buf.readUInt16LE(ende + 10);
  let pos = buf.readUInt32LE(ende + 16);
  const out = new Map();
  for (let n = 0; n < anzahl; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt');
    const methode = buf.readUInt16LE(pos + 10);
    const gepackt = buf.readUInt32LE(pos + 20);
    const nameLaenge = buf.readUInt16LE(pos + 28), extra = buf.readUInt16LE(pos + 30), kommentar = buf.readUInt16LE(pos + 32);
    const lokal = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLaenge);
    out.set(name, { methode, gepackt, lokal });
    pos += 46 + nameLaenge + extra + kommentar;
  }
  return out;
}

function lies(buf, liste, name) {
  const e = liste.get(name);
  if (!e) return null;
  const start = e.lokal + 30 + buf.readUInt16LE(e.lokal + 26) + buf.readUInt16LE(e.lokal + 28);
  const daten = buf.subarray(start, start + e.gepackt);
  if (e.methode === 0) return daten.toString('utf8');
  if (e.methode === 8) return inflateRawSync(daten).toString('utf8');
  throw new Error(`unbekannte Packart ${e.methode}`);
}

/* ---------- XML, nur so viel wie nötig ---------- */
const ENTITAETEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function text(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => e[0] === '#'
    ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : ENTITAETEN[e.toLowerCase()]);
}
const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? text(m[1]) : null; };
/* Alle <t>-Texte eines Stücks hintereinander (auch bei Formatwechseln im Text) */
const texte = s => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => text(m[1])).join('');

function spalte(ref) {
  const buchstaben = /^[A-Z]+/.exec(ref)[0];
  let n = 0;
  for (const c of buchstaben) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function csvFeld(w) {
  return /[",\n\r]/.test(w) ? `"${w.replace(/"/g, '""')}"` : w;
}

/* Rückgabe: [{ blatt, csv }] in der Reihenfolge der Mappe */
export function xlsxZuCsv(buf) {
  const liste = eintraege(buf);
  const mappe = lies(buf, liste, 'xl/workbook.xml');
  if (!mappe) throw new Error('keine Excel-Datei (Arbeitsmappe fehlt)');
  const bezuege = lies(buf, liste, 'xl/_rels/workbook.xml.rels') || '';
  const ziele = new Map([...bezuege.matchAll(/<Relationship\b[^>]*>/g)].map(m => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const gemeinsam = [...(lies(buf, liste, 'xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texte(m[1]));
  const out = [];
  for (const m of mappe.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const blatt = attr(m[0], 'name');
    let ziel = ziele.get(attr(m[0], 'r:id')) || '';
    ziel = ziel.startsWith('/') ? ziel.slice(1) : `xl/${ziel}`;
    const xml = lies(buf, liste, ziel) || '';
    const zeilen = [];
    for (const z of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const nr = Number(attr(z[1], 'r')) || zeilen.length + 1;
      const werte = [];
      for (const c of z[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], 'r'), typ = attr(c[1], 't'), inhalt = c[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(inhalt);
        let wert = '';
        if (typ === 's') wert = gemeinsam[Number(v?.[1])] ?? '';
        else if (typ === 'inlineStr') wert = texte(inhalt);
        else if (typ === 'b') wert = v?.[1] === '1' ? 'WAHR' : 'FALSCH';
        else if (v) wert = text(v[1]);
        werte[ref ? spalte(ref) : werte.length] = wert;
      }
      zeilen[nr - 1] = werte;
    }
    const breite = Math.max(0, ...zeilen.filter(Boolean).map(w => w.length));
    const csv = Array.from(zeilen, w => Array.from({ length: breite }, (_, i) => csvFeld(w?.[i] ?? '')).join(',')).join('\n');
    out.push({ blatt, csv: csv ? `${csv}\n` : '' });
  }
  return out;
}
