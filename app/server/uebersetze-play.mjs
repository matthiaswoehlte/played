/* Auftrag 011, Stufe 2: Play spricht Englisch, solange ein englisches Projekt offen ist.
   Damit nach jedem Umbau von Play die englische Ausgabe auf Knopfdruck neu entsteht: node server/uebersetze-play.mjs
   Das Skript holt aus Plays Code nur die Textstücke, die ein Mensch liest, und lässt sie mit ihrer Codezeile als Zusammenhang
   von der KI übersetzen, mit dem Glossar (server/glossar-englisch.md). Eingesetzt wird maschinell:
   - Seite (index.html, huelle/*.js): eine englische Ausgabe in sprache/en/. Außer den Textstücken ist sie Zeichen für Zeichen
     gleich; das prüft das Skript, bevor es schreibt.
   - Server (server/*.mjs): sprache/en/server.json, Stück → englisches Stück; Play setzt es zur Laufzeit in Antworten,
     Daten des Navigators und Aufträge an die KI ein.
   - Anleitungen der KI (server/*-anleitung.md): englische Fassungen in sprache/en/.
   Fortschritt im Terminal: vor jedem Teil der Name, danach Ergebnis und Dauer. Nur neue oder geänderte Stücke gehen an die KI;
   was schon übersetzt ist, steht in sprache/en/stuecke.json und wird wiederverwendet. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOSSAR, istBaustein, istName, kiUeberAbo, zerlege } from './uebersetzer.mjs';

const SERVER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(SERVER, '..');
const ZIEL = path.join(PLAY, 'sprache', 'en');
const SPEICHER = path.join(ZIEL, 'stuecke.json');
const MODELL = 'claude-opus-5-5';
const GLEICHZEITIG = 5;

const ANLEITUNG = `Du übersetzt die Oberfläche der Werkzeug-App „Play“ vom Deutschen ins Englische. Play ist die Hostapp, in der ein Anforderer
(Product Owner) eine Anwendung für die Bodenabfertigung an Flughäfen per Wunsch wachsen lässt.
Du bekommst Textstücke aus Plays Code, je mit der Codezeile, in der es steht.

- Übersetze nur, was ein Mensch auf dem Bildschirm oder im Auftrag an die KI liest. Ein Stück, das kein Text für Menschen ist
  (Schlüssel, Vergleichswert, CSS, Adresse, Dateiname, Kennung, Pfad, Code), gibst du genau unverändert zurück.
- Wird ein Satz aus mehreren Stücken und Werten zusammengesetzt, übersetze jedes Stück so, dass der ganze Satz auf Englisch richtig
  liest. Die Werte dazwischen bleiben an ihrem Platz; ein Stück darf dafür leer werden oder Wörter aus einem Nachbarstück aufnehmen.
- Leerzeichen am Anfang und Ende, Satzzeichen, Zeilenumbrüche, Platzhalter und Zeichen wie ·, →, …, ✓ bleiben. Deutsche
  Anführungszeichen „…“ werden “…”. Englische Zahlwörter und Mehrzahl passend zum Satz.
- Halte dich an das Glossar unten. Britisches Englisch. Einfache, kurze Sätze, nichts aus dem Maschinenraum.
- Ist ein Stück schon englisch oder neutral, gib es unverändert zurück.
Antworte mit der Liste {nr, en}, ein Eintrag je Stück.`;

const ANLEITUNG_MD = `Übersetze diese Anleitung für eine KI vom Deutschen ins Englische, vollständig und genau, mit dem Glossar unten. Aufbau, Überschriften,
Listen und alles in \`Backticks\` (Schlüssel, Werte, Pfade, Code) bleiben genau gleich; nur Text dazwischen wird englisch. Wo die Anleitung
sagt, in welcher Sprache die KI schreibt, gilt jetzt Englisch. Antworte mit der ganzen Anleitung in quelltext.`;

const LISTE_SCHEMA = { type: 'object', properties: { liste: { type: 'array', items: { type: 'object', properties: { nr: { type: 'integer' }, en: { type: 'string' } }, required: ['nr', 'en'], additionalProperties: false } } }, required: ['liste'], additionalProperties: false };
const TEXT_SCHEMA = { type: 'object', properties: { quelltext: { type: 'string' } }, required: ['quelltext'], additionalProperties: false };

/* Ein Stück ist Text für Menschen, wenn es Buchstaben hat und nicht wie ein Name aus dem Code aussieht. */
const FUELLWORT = /(^|[\s(„“"'])(und|oder|ist|sind|der|die|das|den|dem|des|ein|eine|einen|einem|nicht|noch|mit|für|von|zu|zur|zum|auf|im|bei|nach|aus|wird|werden|kein|keine|jetzt|schon|alle|auch|sich|dass|wie|was|wo|als|bis|um|ab|vor|soll|hat|haben|gibt|Uhr|weitere|weiteren|mehr|weniger)(?=$|[\s.,:;!?)„“"'])/i;
function istText(s) {
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(s)) return false;
  if (/[äöüÄÖÜß„“]/.test(s)) return true;
  /* Ein großgeschriebenes Wort mit Doppelpunkt oder Leerzeichen am Ende ist der Anfang eines Satzes („Vorspielen: “). */
  if (/^\s*[A-ZÄÖÜ][a-zäöüß]+[:.]?\s+$/.test(s)) return true;
  /* Satzteile mit deutschem Füllwort („ und “, „. Das soll nicht so sein: “) sind Text, auch wenn sie wie Code aussehen. */
  if (FUELLWORT.test(s) && (/\s/.test(s) || /^[A-ZÄÖÜ]/.test(s))) return true;
  /* Überschriften im Auftrag an die KI („## Frühere Entscheidungen“) sind Text. */
  if (/^\s*#{1,4} [A-ZÄÖÜ]/.test(s)) return true;
  return !istName(s.trim()) && /[a-zäöüß]/.test(s) && !/^(https?:|\/|\.\/|#|\.|\[)/.test(s.trim()) && !/^[\w-]+\.(js|css|json|md|html|png)$/.test(s.trim());
}

/* Deutsche Anführungszeichen ohne Text darin („, “) werden maschinell englisch. */
export function englischeZeichen(s) {
  return s.replace(/„([^„“]*)“/g, '\u0002$1\u0003').replace(/„/g, '\u0002').replace(/“/g, '\u0003').replace(/\u0002/g, '“').replace(/\u0003/g, '”');
}

/* Stücke aus JS: Zeichenketten und Vorlagenteile, je mit Zeile. */
/* Der dritte Wert von knoten(tag, klasse, text) ist immer sichtbarer Text, auch ein einzelnes kleines Wort wie „stimmt“. */
const KNOTEN_TEXT = /knoten\(\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*$/;
/* baustein: kleine Satzbausteine mitnehmen (Seite). Im Server nicht: dort ersetzt Play Stücke zur Laufzeit überall im Text,
   ein einzelnes Wort wie „hat“ würde jedes gleiche Wort treffen; Server-Sätze stehen darum als ganze Sätze im Code. */
function stueckeAusJs(q, baustein = true) {
  const out = [];
  for (const t of zerlege(q)) {
    if (t.art !== 'string' && t.art !== 'vorlage') continue;
    const s = q.slice(t.s, t.e);
    // Stücke mit dem Kommentar „bleibt“ davor stehen schon in der richtigen Sprache (z. B. „Deutsch“ im Wähler einer englischen Seite).
    if (q.slice(Math.max(0, t.s - 12), t.s - 1).endsWith('/*bleibt*/')) continue;
    const sichtbar = KNOTEN_TEXT.test(q.slice(Math.max(0, t.s - 160), t.s - 1)) && /[a-zäöüß]/.test(s);
    if (!istText(s) && !sichtbar && !/[„“]/.test(s) && !(baustein && istBaustein(q, t.s, t.e))) continue;
    const anfang = q.lastIndexOf('\n', t.s) + 1, ende = q.indexOf('\n', t.e);
    out.push({ s: t.s, e: t.e, text: s, sichtbar, zeile: q.slice(anfang, ende < 0 ? q.length : ende).trim().slice(0, 400) });
  }
  return out;
}
/* Stücke aus HTML: Text zwischen Tags und lesbare Attribute; Skripte darin wie JS. */
function stueckeAusHtml(q) {
  const out = [];
  const verdeckt = [];
  for (const m of q.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const innen = m.index + m[0].indexOf('>') + 1;
    verdeckt.push([innen, innen + m[2].length]);
    if (m[1] === 'script') for (const x of stueckeAusJs(m[2])) out.push({ ...x, s: x.s + innen, e: x.e + innen });
  }
  const frei = (i) => !verdeckt.some(([a, b]) => i >= a && i < b);
  for (const m of q.matchAll(/>([^<>]+)</g)) {
    const s = m.index + 1, text = m[1];
    if (!frei(s) || !istText(text.trim())) continue;
    const a = s + text.indexOf(text.trim());
    out.push({ s: a, e: a + text.trim().length, text: text.trim(), zeile: q.slice(q.lastIndexOf('\n', s) + 1, q.indexOf('\n', s)).trim().slice(0, 400) });
  }
  for (const m of q.matchAll(/\b(title|placeholder|aria-label|alt|data-leer|data-titel)="([^"]*)"/g)) {
    const s = m.index + m[0].indexOf('"') + 1;
    if (!frei(s) || !istText(m[2])) continue;
    out.push({ s, e: s + m[2].length, text: m[2], zeile: q.slice(q.lastIndexOf('\n', s) + 1, q.indexOf('\n', s)).trim().slice(0, 400) });
  }
  return out;
}

/* Alles außer den Stücken, damit sich prüfen lässt, dass nur Texte anders sind. */
function ohneStuecke(q, stuecke) {
  let out = '', i = 0;
  for (const x of [...stuecke].sort((a, b) => a.s - b.s)) { out += q.slice(i, x.s) + '\u0000'; i = x.e; }
  return out + q.slice(i);
}
function setzeEin(q, stuecke, je) {
  let out = q;
  for (const x of [...stuecke].sort((a, b) => b.s - a.s)) {
    const en = je.get(x.s);
    if (en !== undefined) out = out.slice(0, x.s) + en + out.slice(x.e);
  }
  return out;
}
/* Ein englisches Stück darf in JS die Zeichenkette nicht brechen: Anführungszeichen der Zeichenkette werden geschützt. */
function geschuetzt(q, x, en) {
  const vor = q[x.s - 1];
  if (vor === '"' || vor === "'") return en.replace(new RegExp(`(^|[^\\\\])${vor}`, 'g'), `$1\\${vor}`);
  if (vor === '`' || vor === '}') return en.replace(/(^|[^\\])`/g, '$1\\`').replace(/\$\{/g, '\\${');
  return en;
}

async function jeweils(liste, n, tu) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, async () => { while (i < liste.length) { const k = i++; await tu(liste[k], k); } }));
}

const roh = kiUeberAbo(MODELL);
async function ki(a) {
  try { return await roh(a); } catch (e) { console.log(`
  KI-Fehler, neuer Versuch in 20 s: ${e.message}`); await new Promise(ok => setTimeout(ok, 20000)); return roh(a); }
}
const glossar = `## Glossar (vom PO bestätigt)\n\n${GLOSSAR}`;
const gespeichert = existsSync(SPEICHER) ? JSON.parse(readFileSync(SPEICHER, 'utf8')) : {};
/* Schlüssel: Datei + Zeile + Stück, damit dasselbe Wort in anderem Zusammenhang anders übersetzt werden kann. */
const schluessel = (datei, x) => `${datei}\u0001${x.zeile}\u0001${x.text}${x.sichtbar ? '\u0001sichtbar' : ''}`;

async function uebersetzeStuecke(datei, stuecke) {
  /* Nur Zeichen ohne Wörter (etwa „ oder “) setzt Play selbst um. */
  for (const x of stuecke) if (!/[A-Za-zÄÖÜäöüß]{2}/.test(x.text)) gespeichert[schluessel(datei, x)] = englischeZeichen(x.text);
  const neu = stuecke.filter(x => !(schluessel(datei, x) in gespeichert));
  const STUECK = 60;
  const teile = [];
  for (let i = 0; i < neu.length; i += STUECK) teile.push(neu.slice(i, i + STUECK));
  await jeweils(teile, GLEICHZEITIG, async (teil) => {
    const liste = teil.map((x, nr) => ({ nr, zeile: x.zeile, text: x.text, ...(x.sichtbar ? { hinweis: 'sichtbarer Text auf dem Bildschirm, bitte übersetzen' } : {}) }));
    const r = await ki({ system: ANLEITUNG, prompt: `${glossar}\n\n## Datei ${datei}\n\n## Stücke\n\n${JSON.stringify(liste, null, 1)}`, schema: LISTE_SCHEMA, aufwand: 'low' });
    for (const y of r.liste || []) if (teil[y.nr]) gespeichert[schluessel(datei, teil[y.nr])] = englischeZeichen(y.en);
  });
  return neu.length;
}

function zeit(ms) { return `${(ms / 1000).toFixed(0)} s`; }
mkdirSync(path.join(ZIEL, 'huelle'), { recursive: true });
const beginn = Date.now();
let fehler = 0;

/* 1. Seite */
const seite = ['index.html', ...readdirSync(path.join(PLAY, 'huelle')).filter(n => n.endsWith('.js')).map(n => `huelle/${n}`)];
for (const [nr, datei] of seite.entries()) {
  const t0 = Date.now();
  process.stdout.write(`Seite ${nr + 1} von ${seite.length}: ${datei} … `);
  const q = readFileSync(path.join(PLAY, datei), 'utf8');
  const stuecke = datei.endsWith('.html') ? stueckeAusHtml(q) : stueckeAusJs(q);
  const neu = await uebersetzeStuecke(datei, stuecke);
  const je = new Map();
  for (const x of stuecke) {
    const en = gespeichert[schluessel(datei, x)];
    if (en === undefined || en === x.text) continue;
    je.set(x.s, datei.endsWith('.js') ? geschuetzt(q, x, en) : en);
  }
  const en = setzeEin(q, stuecke.filter(x => je.has(x.s)), je);
  const gleich = ohneStuecke(q, stuecke) === ohneStuecke(en, stueckeNeu(en, datei, stuecke, je, q));
  if (!gleich) { fehler++; console.log(`rot: Code nicht mehr gleich, nicht geschrieben (${zeit(Date.now() - t0)})`); continue; }
  writeFileSync(path.join(ZIEL, datei), en);
  console.log(`grün, ${stuecke.length} Stücke, ${neu} neu übersetzt (${zeit(Date.now() - t0)})`);
  writeFileSync(SPEICHER, JSON.stringify(gespeichert, null, 1));
}
/* Die Stellen der Stücke in der englischen Fassung (für den Vergleich), aus den alten Stellen und den Längen gerechnet. */
function stueckeNeu(en, datei, stuecke, je, q) {
  let versatz = 0;
  return [...stuecke].sort((a, b) => a.s - b.s).map(x => {
    const ersatz = je.has(x.s) ? je.get(x.s) : x.text;
    const s = x.s + versatz, e = s + ersatz.length;
    versatz += ersatz.length - (x.e - x.s);
    return { s, e };
  });
}

/* 2. Server: Stücke für die Laufzeit */
const serverDateien = readdirSync(SERVER).filter(n => n.endsWith('.mjs') && !/^uebersetze/.test(n));
const serverStuecke = {};
for (const [nr, n] of serverDateien.entries()) {
  const t0 = Date.now();
  process.stdout.write(`Server ${nr + 1} von ${serverDateien.length}: ${n} … `);
  const q = readFileSync(path.join(SERVER, n), 'utf8');
  const stuecke = stueckeAusJs(q, false);
  const neu = await uebersetzeStuecke(`server/${n}`, stuecke);
  for (const x of stuecke) {
    const en = gespeichert[schluessel(`server/${n}`, x)];
    if (en !== undefined && en !== x.text && x.text.trim().length >= 3) serverStuecke[x.text] ??= en;
  }
  console.log(`grün, ${stuecke.length} Stücke, ${neu} neu übersetzt (${zeit(Date.now() - t0)})`);
  writeFileSync(SPEICHER, JSON.stringify(gespeichert, null, 1));
}
writeFileSync(path.join(ZIEL, 'server.json'), JSON.stringify(serverStuecke, null, 1));

/* 3. Anleitungen der KI */
const anleitungen = readdirSync(SERVER).filter(n => /-anleitung\.md$/.test(n));
for (const [nr, n] of anleitungen.entries()) {
  const t0 = Date.now();
  process.stdout.write(`Anleitung ${nr + 1} von ${anleitungen.length}: ${n} … `);
  const q = readFileSync(path.join(SERVER, n), 'utf8');
  const k = `anleitung\u0001${n}\u0001${q}`;
  if (!(k in gespeichert)) gespeichert[k] = (await ki({ system: ANLEITUNG_MD, prompt: `${glossar}\n\n## Anleitung\n\n${q}`, schema: TEXT_SCHEMA, aufwand: 'low' })).quelltext;
  writeFileSync(path.join(ZIEL, n), gespeichert[k]);
  console.log(`grün (${zeit(Date.now() - t0)})`);
  writeFileSync(SPEICHER, JSON.stringify(gespeichert, null, 1));
}
console.log(`Fertig in ${zeit(Date.now() - beginn)}${fehler ? `, ${fehler} Dateien rot` : ''}.`);
process.exit(fehler ? 1 : 0);
