/* Auftrag 011, Stufe 2: „Kopie anlegen“ mit Sprache Englisch.
   Damit die englische Kopie nach jedem Umbau von Play auf Knopfdruck neu entsteht, übersetzt dieser Teil eine frisch
   angelegte Kopie an Ort und Stelle, mit dem bestätigten Glossar (server/glossar-englisch.md).

   Gleiches Ergebnis wie im Original hängt daran, dass jeder Name überall gleich übersetzt wird. Darum in vier Schritten:
   1. Namen: Jedes Wort aus Pfaden, Kennungen, Angaben, Aktionen und kurzen Werten wird einmal gesammelt und von der KI
      als Liste übersetzt (Wörterbuch). Eingesetzt wird es maschinell, überall gleich.
   2. Texte: Sätze aus Daten, Herkunft, Szenarien und Sollergebnissen, je einmal (gleicher Satz, gleiche Übersetzung).
   3. Code: Plugins, Regeln und die Anleitung gehen Datei für Datei an die KI, mit dem Ausschnitt des Wörterbuchs, den
      die Datei braucht. Danach setzt Play Namen, die die KI übersehen hat, maschinell nach.
   4. Einsetzen: JSON-Dateien, Daten und Szenarien setzt Play selbst um (Wörterbuch und Texte), Dateien mit Kennungen
      im Namen werden umbenannt.

   Plays eigene Wörter bleiben (Entscheidung des PO vom 10.11.2026): die Schlüssel, mit denen ein Plugin mit Play spricht
   (kennung, lies, setze, abonniert …), die Feldnamen in Plays Verwaltungsdateien (fassungen, wortlaut …), Plays Ordner und
   die Kennungen, die Play selbst vergibt (wunsch-NNN, gespielt-NNN). Sie erscheinen nie auf dem Bildschirm. */
import { existsSync, promises as fs, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SERVER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(SERVER, '..');
export const GLOSSAR = readFileSync(path.join(SERVER, 'glossar-englisch.md'), 'utf8');

/* ---------- Zerlegen von Quelltext: Kommentare, Zeichenketten, Vorlagen, Bezeichner ---------- */
const JS_WOERTER = new Set(('break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof undefined var void while with yield async await of '
  + 'Object Array String Number Boolean Math JSON Date RegExp Error Map Set Promise Symbol window document console parseInt parseFloat isNaN Infinity NaN arguments prototype length push pop shift unshift slice splice concat join split map filter forEach reduce some every indexOf lastIndexOf includes find findIndex sort keys values entries assign create freeze stringify parse floor ceil round max min abs replace trim toLowerCase toUpperCase test exec match charAt substring substr padStart padEnd toFixed hasOwnProperty call apply bind querySelector querySelectorAll createElement appendChild removeChild insertBefore textContent innerHTML className classList add remove toggle contains setAttribute getAttribute dataset style addEventListener closest parentNode children firstChild nextSibling hidden title getBoundingClientRect offsetWidth offsetHeight scrollTop scrollLeft left top width height right bottom px').split(' '));

export function zerlege(q) {
  const out = [], stapel = [];
  let i = 0, tiefe = 0, letzte = null;
  const n = q.length;
  while (i < n) {
    const c = q[i], d = q[i + 1];
    if (c === '/' && d === '/') { const e = q.indexOf('\n', i); const ende = e < 0 ? n : e; out.push({ art: 'kommentar', s: i + 2, e: ende }); i = ende; continue; }
    if (c === '/' && d === '*') { const e = q.indexOf('*/', i + 2); const ende = e < 0 ? n : e; out.push({ art: 'kommentar', s: i + 2, e: ende }); i = ende + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && q[j] !== c && q[j] !== '\n') { if (q[j] === '\\') j++; j++; }
      out.push({ art: 'string', s: i + 1, e: j }); i = j + 1; letzte = 'wert'; continue;
    }
    if (c === '`' || (c === '}' && stapel.length && stapel[stapel.length - 1] === tiefe)) {
      if (c === '}') stapel.pop();
      let j = i + 1;
      while (j < n && q[j] !== '`' && !(q[j] === '$' && q[j + 1] === '{')) { if (q[j] === '\\') j++; j++; }
      out.push({ art: 'vorlage', s: i + 1, e: j });
      if (q[j] === '`') { i = j + 1; letzte = 'wert'; } else { stapel.push(tiefe); i = j + 2; letzte = '('; }
      continue;
    }
    if (c === '{') { tiefe++; i++; letzte = '{'; continue; }
    if (c === '}') { tiefe--; i++; letzte = '}'; continue; }
    if (c === '/') {
      if (letzte === null || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(letzte) || letzte === 'return' || letzte === 'typeof') {
        let j = i + 1, klasse = false;
        while (j < n && q[j] !== '\n') {
          const x = q[j];
          if (x === '\\') { j += 2; continue; }
          if (x === '[') klasse = true; else if (x === ']') klasse = false; else if (x === '/' && !klasse) break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/i.test(q[j])) j++;
        out.push({ art: 'regex', s: i, e: j }); i = j; letzte = 'wert'; continue;
      }
      i++; letzte = '/'; continue;
    }
    if (/[A-Za-z_$ÄÖÜäöüß]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$ÄÖÜäöüß]/.test(q[j])) j++;
      const wort = q.slice(i, j);
      out.push({ art: 'bezeichner', s: i, e: j, nachPunkt: q[i - 1] === '.' });
      letzte = wort; i = j; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c)) { let j = i + 1; while (j < n && /[\w.]/.test(q[j])) j++; i = j; letzte = 'wert'; continue; }
    letzte = c; i++;
  }
  return out;
}

/* Ersetzt Stücke (s, e, neu) in einem Text, von hinten nach vorn. */
function ersetze(q, stuecke) {
  let out = q;
  for (const x of [...stuecke].sort((a, b) => b.s - a.s)) out = out.slice(0, x.s) + x.neu + out.slice(x.e);
  return out;
}

/* ---------- Was Play selbst spricht ---------- */
/* Alle Bezeichner und ganzen Zeichenketten aus Plays Code (huelle, server). Was davon in einer Datei des Projekts an Plays
   Stelle steht, bleibt. */
function playsWoerter() {
  const bezeichner = new Set(), ketten = new Set();
  for (const ordner of ['huelle', 'server']) {
    for (const n of readdirSync(path.join(PLAY, ordner))) {
      if (!/\.(m?js)$/.test(n) || /^uebersetze/.test(n)) continue;
      const q = readFileSync(path.join(PLAY, ordner, n), 'utf8');
      for (const t of zerlege(q)) {
        if (t.art === 'bezeichner') bezeichner.add(q.slice(t.s, t.e));
        else if (t.art === 'string') { const s = q.slice(t.s, t.e); if (/^[\w\-./*]+$/.test(s)) ketten.add(s); }
      }
    }
  }
  return { bezeichner, ketten };
}
const PLAY_WORT = playsWoerter();
/* Wörter, die Play in Pfaden, Ordnern und Kennungen selbst vergibt; sie bleiben auch als Teil eines längeren Namens. */
const PLAY_TEILE = new Set(['uhr', 'tag', 'bus', 'takt', 'ruhe', 'tick', 'minute', 'geaendert', 'wunsch', 'gespielt', 'fassung', 'herkunft',
  'drehbuch', 'erwartungen', 'soll', 'plugins', 'bausteine', 'papierkorb', 'archiv', 'wuensche', 'bis', 'daten', 'bereiche', 'regeln',
  'drehbuecher', 'sollergebnisse', 'entscheidungen', 'anhaenge', 'manifest', 'objekte', 'arten', 'js', 'json',
  'css', 'md', 'png', 'huelle', 'hand', 'start', 'stil']);
/* Wörter aus CSS, HTML und dem Englischen des Codes; sie bleiben immer. */
const NIE = new Set(('not hover before after first last child nth of type focus active checked disabled root data aria px em rem vh vw rgba rgb calc var '
  + 'transparent none auto solid dashed dotted inherit flex grid block inline absolute relative fixed sticky left right top bottom center middle '
  + 'beforebegin afterbegin beforeend afterend aside h1 h2 h3 h4 div span button input label select option table tr td th ul li section header '
  + 'footer nav main scope resize ew ns pointer default move grab grabbing hidden visible scroll nowrap bold normal italic important id class '
  + 'style title type value name width height color background border margin padding opacity transform transition display position content '
  + 'gantt overlay pl on off is in to at by up dx dy').split(' '));
/* Plays feste Werte (Platz einer Ansicht, Art einer Bedienung oder Regel); als ganze Zeichenkette bleiben sie. */
const PLAY_WERTE = new Set(['haupt', 'seite', 'ziehen', 'klicken', 'eingeben', 'bedingung', 'ki', 'nicht-zeigbar']);
/* Fachwörter, die zufällig auch in Plays Code vorkommen: In Daten, Pfaden und Szenarien sind sie immer Fach und werden übersetzt. */
const IMMER_FACH = new Set(['mitarbeiter', 'auftraege', 'auftrag', 'fluege', 'flug', 'geraete', 'geraet', 'geraeteauftraege', 'kennzahlen',
  'konflikte', 'konflikt', 'arbeit', 'muster', 'grund', 'gruppe', 'qualifikationen', 'abwesend', 'abwesendAb', 'krankmeldung', 'taetigkeit']);

/* Schlüssel in Plays Dateien, unter denen Fachliches steht: Schlüssel und Werte darunter sind ganz Fach. */
const FACH_DARUNTER = new Set(['zustand', 'objekte', 'parameter', 'bei', 'sichten', 'namen', 'fachobjektNamen', 'fachobjektEiner',
  'feldNamen', 'angabeNamen', 'alt', 'neu', 'gleich']);
/* Schlüssel in Plays Dateien, deren Wert ein Text für Menschen ist. */
const TEXT_SCHLUESSEL = new Set(['name', 'kurz', 'wortlaut', 'satz', 'text', 'titel', 'untertitel', 'erzaehlung', 'hinweis', 'grund',
  'frage', 'antwort', 'rueckfrage', 'anmerkung', 'notiz', 'fall', 'einen', 'beschreibung', 'zeigt', 'meldung', 'erklaerung']);

const ZEIT_ODER_ZAHL = /^(\d{1,2}:\d{2}(:\d{2})?|[-+]?\d+([.,]\d+)?|\d{4}-\d{2}-\d{2}([T ][\d:.]+Z?)?)$/;
const FLUG = /^[A-Z]{2}\d{2,4}$/;
const WORT = /[A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß]*/g;

/* Sieht die Zeichenkette aus wie ein Name aus dem Code (Pfad, Kennung, Muster, CSS-Auswahl) statt wie ein Text? */
export function istName(s) {
  if (!/[A-Za-zÄÖÜäöüß]/.test(s)) return false;
  /* Ein großgeschriebenes Fachwort (Entladen, Gerät, Innenraum-Cleaning) ist ein Text, kein Name aus dem Code. */
  if (/^[A-ZÄÖÜ][a-zäöüß]+(-[A-ZÄÖÜa-zäöüß][a-zäöüß]+)*$/.test(s)) return false;
  if (!/\s/.test(s)) return /^[\w\-./*#:[\]=>,~+$"'()ÄÖÜäöüß]+$/.test(s);
  return /^[\s\w\-./*#:[\]=>,~+"'()]+$/.test(s) && /(^|[\s,>+~])[.#[]/.test(s);
}

/* ---------- Wörterbuch und Texte ---------- */
export class Uebersetzung {
  constructor() { this.worte = new Map(); this.texte = new Map(); this.sammeln = true; this.offeneWorte = new Set(); this.offeneTexte = new Set(); this.namenBleiben = true; }
  /* Ein Name: jedes Wort darin einzeln, außer Plays Wörtern. play: an Plays Stelle (ganze Zeichenketten aus Plays Code bleiben). */
  name(s, play) {
    if (ZEIT_ODER_ZAHL.test(s)) return s;
    if (play && PLAY_WORT.ketten.has(s) && !IMMER_FACH.has(s)) return s;
    if (play && PLAY_WERTE.has(s)) return s;
    return s.replace(WORT, w => {
      if (FLUG.test(w) || PLAY_TEILE.has(w) || NIE.has(w) || w.length < 2) return w;
      if (this.sammeln) { this.offeneWorte.add(w); return w; }
      /* Anweisung 54: Pfade, Angaben, Kennungen und Schlüssel bleiben; das Wörterbuch dient nur der Anzeige im Maschinenraum. */
      if (this.namenBleiben) return w;
      return this.worte.get(w) ?? w;
    });
  }
  text(s) {
    if (!s.trim() || ZEIT_ODER_ZAHL.test(s.trim()) || !/[A-Za-zÄÖÜäöüß]{2}/.test(s)) return s;
    if (this.sammeln) { this.offeneTexte.add(s); return s; }
    return this.texte.get(s) ?? s;
  }
  wert(s, play) { return istName(s) ? this.name(s, play) : this.text(s); }
}

/* JSON-artige Werte: an Plays Stelle bleiben Plays Schlüssel, darunter Fachliches wird ganz übersetzt. */
export function uebersetzeWert(u, v, fach, schluessel) {
  if (typeof v === 'string') {
    if (v.startsWith('{"') && v.endsWith('}')) { try { return JSON.stringify(uebersetzeWert(u, JSON.parse(v), true)); } catch { /* weiter als Text */ } }
    if (fach) return u.wert(v, false);
    if (TEXT_SCHLUESSEL.has(schluessel)) return u.text(v);
    return u.wert(v, true);
  }
  if (Array.isArray(v)) return v.map(x => uebersetzeWert(u, x, fach, schluessel));
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (fach) { out[k.startsWith('{"') ? uebersetzeWert(u, k, true) : u.name(k, false)] = uebersetzeWert(u, x, true, k); continue; }
    if (FACH_DARUNTER.has(k)) { out[k] = uebersetzeWert(u, x, true, k); continue; }
    if (PLAY_WORT.bezeichner.has(k) && !IMMER_FACH.has(k)) {
      out[k] = uebersetzeWert(u, x, false, k);
      /* Entscheidung 5: Der deutsche Wortlaut jedes Wunsches bleibt in den Dateien der Kopie erhalten. */
      if (k === 'wortlaut' && typeof x === 'string' && !u.sammeln) out.wortlautDeutsch = x;
      continue;
    }
    out[k.startsWith('{"') ? uebersetzeWert(u, k, true) : u.name(k, false)] = uebersetzeWert(u, x, false, k);
  }
  return out;
}

/* Quelltext maschinell: Kommentare und Texte nach dem Text-Wörterbuch, Namen nach dem Wörterbuch.
   fach: alles ist Fach (z. B. der Block „objekte“ der Daten); sonst bleiben Plays Bezeichner. */
export function uebersetzeQuelltext(u, q, fach) {
  const stuecke = [];
  for (const t of zerlege(q)) {
    const s = q.slice(t.s, t.e);
    /* Anweisung 54: Kommentare sieht niemand; sie bleiben. */
    if (t.art === 'kommentar') continue;
    else if (t.art === 'string' || t.art === 'vorlage') { const neu = u.wert(s, !fach); if (neu !== s) stuecke.push({ ...t, neu }); }
    else if (t.art === 'bezeichner') {
      if (JS_WOERTER.has(s) || (!fach && PLAY_WORT.bezeichner.has(s) && !IMMER_FACH.has(s))) continue;
      const neu = u.name(s, false);
      if (neu !== s) stuecke.push({ ...t, neu });
    }
  }
  return ersetze(q, stuecke);
}
/* Ein Kommentar ohne seine Zeichen am Rand, damit er als Text übersetzt wird. */
function kommentar(u, s) {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m[2] ? m[1] + u.text(m[2]) + m[3] : s;
}

/* Daten und Szenarien (Huelle.daten, Huelle.drehbuch): der Block „objekte“ ganz als Fach, der Rest an Plays Stelle. */
/* Blöcke, die ganz Fach sind: objekte (Daten), parameter (Angaben einer Nachricht), bei (Wahl der Variante) */
const FACH_BLOCK = new Set(['objekte', 'parameter', 'bei']);
/* In den Tagesdaten: Status, Übergänge und Ereignisse je Objektart tragen Kennungen des Fachs */
const ARTEN_BLOCK = new Set(['werte', 'uebergaenge', 'durch', 'ereignisse']);
export function uebersetzeDatenQuelltext(u, q, FACH_BLOCK_HIER = FACH_BLOCK, aussenLassen = false) {
  const FACH_BLOCK = FACH_BLOCK_HIER;
  const teile = zerlege(q);
  const verdeckt = new Set();
  for (const x of teile) if (x.art !== 'bezeichner') for (let k = x.s - 1; k <= x.e; k++) verdeckt.add(k);
  const bloecke = [];
  for (const x of teile) {
    if (x.art !== 'bezeichner' || !FACH_BLOCK.has(q.slice(x.s, x.e)) || !/^\s*:\s*\{/.test(q.slice(x.e))) continue;
    if (bloecke.length && x.s < bloecke[bloecke.length - 1][1]) continue;
    const auf = q.indexOf('{', x.e);
    let tiefe = 0, zu = auf;
    for (; zu < q.length; zu++) {
      if (verdeckt.has(zu)) continue;
      if (q[zu] === '{') tiefe++;
      else if (q[zu] === '}' && --tiefe === 0) break;
    }
    bloecke.push([auf, zu + 1]);
  }
  let out = '', i = 0;
  const aussen = (s) => aussenLassen ? s : uebersetzeQuelltext(u, s, false);
  for (const [a, b] of bloecke) { out += aussen(q.slice(i, a)) + uebersetzeQuelltext(u, q.slice(a, b), true); i = b; }
  return out + aussen(q.slice(i));
}

/* ---------- Dateien eines Projekts ---------- */
const NICHT = new Set(['sicherungen', 'stand-speicher.json', 'node_modules']);
async function alleDateien(ordner, unter = '') {
  const out = [];
  for (const e of await fs.readdir(path.join(ordner, unter), { withFileTypes: true }).catch(() => [])) {
    if (NICHT.has(e.name)) continue;
    const rel = unter ? `${unter}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!(unter === '' && e.name === 'projekte')) out.push(...await alleDateien(ordner, rel)); }
    else out.push(rel);
  }
  return out;
}
/* Wie eine Datei übersetzt wird. */
function artVon(rel, q) {
  if (rel.endsWith('.json')) return 'json';
  if (rel.endsWith('.md')) return 'anleitung';
  if (rel.endsWith('.css')) return 'code';
  if (!rel.endsWith('.js')) return 'datei';
  const kern = q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  if (/^Huelle\.(daten|drehbuch)\(/.test(kern) && !/\bfunction\b|=>/.test(kern)) return 'daten';
  if (rel === 'manifest.js') return 'daten';
  return 'code';
}

/* ---------- Die KI ---------- */
const WORTE_SCHEMA = { type: 'object', properties: { liste: { type: 'array', items: { type: 'object', properties: { de: { type: 'string' }, en: { type: 'string' } }, required: ['de', 'en'], additionalProperties: false } } }, required: ['liste'], additionalProperties: false };
const CODE_SCHEMA = { type: 'object', properties: { quelltext: { type: 'string' } }, required: ['quelltext'], additionalProperties: false };

const WORTE_ANLEITUNG = `Du übersetzt Namen aus Code und Daten einer Anwendung für die Bodenabfertigung an Flughäfen vom Deutschen ins Englische.
Jeder Name ist ein Wort aus einem Pfad, einer Kennung, einem Feldnamen, einer Aktion, einer CSS-Klasse oder ein kurzer Wert.

- Halte dich an das Glossar unten. Britisches Englisch.
- Gleiche Schreibweise wie das Original: klein bleibt klein (geraete → equipment), camelCase bleibt camelCase (schichtStart → shiftStart),
  GROSS bleibt GROSS, ein großgeschriebenes Wort bleibt großgeschrieben (Gerät → Unit). Keine Leerzeichen und keine Bindestriche, außer
  bei einem großgeschriebenen Wort, das im Glossar mehrere Wörter hat (Ladegruppe → Ramp team).
- Abkürzungen in Kennungen nach dem Glossar (MA → AG, GSL → BTR, HUB → CL, BAND → BLT, TRP → STR, FAE → LAV, TANK → FUEL). Andere deutsche
  Abkürzungen ersetzt du durch kurze englische in GROSS (ENTL → UNL, BEL → LOAD, FW → PW).
- Einzahl und Mehrzahl bleiben unterscheidbar (auftrag → task, auftraege → tasks; geraet → unit, geraete → units).
- Englische, neutrale oder unklare Namen (gantt, onBlock, offBlock, pl, XA) und Personennamen (Engström, Matthias) bleiben, wie sie sind.
- Zwei verschiedene deutsche Namen bekommen nie denselben englischen.
Antworte mit der Liste {de, en}, ein Eintrag je Name, in derselben Reihenfolge.`;

const TEXTE_ANLEITUNG = `Du übersetzt Texte einer Anwendung für die Bodenabfertigung an Flughäfen und ihres Werkzeugs „Play“ vom Deutschen ins Englische.
Die Texte sind Sätze, Beschriftungen, Satzteile und Kommentare aus Code, Daten und der Herkunft (Wünsche des Anforderers im Wortlaut).

- Halte dich an das Glossar unten. Britisches Englisch, einfache kurze Sätze in den Worten des Fachs, so wie ein Disponent spricht.
- Personennamen, Flugnummern, Flugzeugmuster, Gates und Uhrzeiten bleiben. Kennungen (MA-01, XC810-ENTL-01), Pfade, Dateinamen
  und Namen aus dem Code bleiben genau unverändert.
- Leerzeichen am Anfang und Ende, Zeilenumbrüche, Einrückung, Platzhalter und Zeichen wie \`, *, →, · bleiben genau erhalten.
  Deutsche Anführungszeichen „…“ werden “…”.
- Ist ein Text schon englisch oder neutral, gib ihn unverändert zurück.
Antworte mit der Liste {de, en}, ein Eintrag je Text, in derselben Reihenfolge, de genau wie bekommen.`;

const CODE_ANLEITUNG = `Du übersetzt eine Datei aus einem Projekt der Werkzeug-App „Play“ (Plugins, Regeln, Daten, Stil oder Anleitung einer Anwendung für die
Bodenabfertigung an Flughäfen) vom Deutschen ins Englische. Danach darf in der Datei kein deutsches Wort mehr stehen, außer Plays Wörtern.

- Übersetze alle Kommentare, alle Texte, die ein Mensch liest (Beschriftungen, Sätze, Tooltips, Meldungen), die Namen lokaler Variablen
  und Funktionen und alle Namen aus der Liste „Namen“: in Pfaden, Kennungen, Aktionen, CSS-Klassen, Angaben von Fachobjekten
  (auch als Eigenschaft, z. B. a.taetigkeit → a.activity). Die Liste gilt wörtlich, Wort für Wort.
- Texte, die genau so in der Liste „Texte“ stehen, übersetzt du genau so.
- Plays Wörter bleiben unverändert, auch wenn sie deutsch sind: die Aufrufe Huelle.plugin, Huelle.daten, Huelle.drehbuch, Huelle.regel,
  Huelle.lade, die Schlüssel der Objekte, die Play bekommt (z. B. kennung, titel, platz, variante, abonniert, besitzt, beimStart, ansicht,
  ort, rang, neuBei, zeichne, ergaenzt, prueft, bedienungen, stil, beschreibe, beschreibeObjekt, erzaehle, anzeige, sicht, art, fasst,
  ereignis, ziel, rollt, leer, zeiger, vorschau, satz, pfad, pfade, pruefe, wortlaut, herkunft, datum, wie), die Methoden von h
  (lies, alle, setze, sende, uhr, minuten, zeit, esc), die Schlüssel von Nachrichten und Bedienungen (objekt, aktion, parameter,
  erzaehlung, hinweis, zeit, feld, alt, neu, felder, pfad, daten, dx, dy, ziel, wert, grund), Plays Werte (art: "ziehen", "klicken",
  "eingeben"; ort: "haupt", "seite"; Kennungen wie wunsch-012 und gespielt-001), Plays Pfade und Aktionen (uhr/tag.tick,
  uhr/tag.minute, bus/takt.ruhe, .geaendert) und Plays Farben (var(--akzent) usw.). In Regeln auch herkunft mit datum, wie, quelle,
  netz; in Daten titel, untertitel, pfad, netz, objekte, arten, name, einen, bei, nennung, status, werte, uebergaenge, durch,
  zuBeginn, fristen, feld, fall, ereignisse, meldungen.
- Das Verhalten bleibt genau gleich: gleiche Logik, gleicher Aufbau, gleiche Reihenfolge, kein Umbau, keine neue Formatierung, nichts
  weglassen, nichts hinzufügen. Satzbau in Texten darfst du dem Englischen anpassen, auch wenn ein Satz aus Teilen zusammengesetzt wird.
- Personennamen, Flugnummern, Flugzeugmuster, Gates und Uhrzeiten bleiben.
Antworte mit der ganzen übersetzten Datei in quelltext.`;

function namenListe(paare) { return paare.map(([de, en]) => `${de} → ${en}`).join('\n'); }

async function jeweils(liste, gleichzeitig, tu) {
  let naechster = 0;
  const arbeiter = Array.from({ length: Math.min(gleichzeitig, liste.length) }, async () => {
    while (naechster < liste.length) { const i = naechster++; await tu(liste[i], i); }
  });
  await Promise.all(arbeiter);
}

/* Die KI über das Abo, ohne Werkzeuge, mit fester Antwortform. Dasselbe Modell wie für Wünsche. */
const SDK = path.resolve(PLAY, '..', '..', 'CCIDE-CODE', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
const CLAUDE = path.join(process.env.USERPROFILE || process.env.HOME || '', '.local', 'bin', 'claude.exe');
export function kiUeberAbo(modell, zeitlimitMs = 15 * 60 * 1000) {
  return async function ({ system, prompt, schema, aufwand = 'low' }) {
    const { query } = await import(pathToFileURL(SDK).href);
    const abbruch = new AbortController();
    const wecker = setTimeout(() => abbruch.abort(), zeitlimitMs);
    const umgebung = { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' };
    delete umgebung.ANTHROPIC_API_KEY;   // Zugang nur über das Abo
    let ergebnis;
    try {
      for await (const m of query({ prompt, options: {
        cwd: PLAY, pathToClaudeCodeExecutable: existsSync(CLAUDE) ? CLAUDE : undefined, model: modell, effort: aufwand,
        systemPrompt: system, tools: [], permissionMode: 'default', settingSources: [], env: umgebung,
        canUseTool: async (name, eingabe) => name === 'StructuredOutput' ? { behavior: 'allow', updatedInput: eingabe } : { behavior: 'deny', message: 'Keine Werkzeuge.' },
        outputFormat: { type: 'json_schema', schema }, maxTurns: 4, abortController: abbruch,
      } })) {
        if (m.type === 'result') {
          if (m.subtype !== 'success' || m.is_error) throw new Error(String(m.result ?? m.subtype).slice(0, 300));
          ergebnis = m.structured_output ?? JSON.parse(m.result);
        }
      }
    } finally { clearTimeout(wecker); }
    if (!ergebnis) throw new Error('Die KI hat keine Antwort geliefert.');
    return ergebnis;
  };
}

/* ---------- Der Ablauf ---------- */
/* ordner: Projektordner der Kopie (wird an Ort und Stelle übersetzt); weitere: weitere Ordner derselben Kopie (der Navigator).
   ki({ system, prompt, schema, aufwand }) → strukturierte Antwort. melde(text, fertig, gesamt). */
export async function uebersetzeKopie({ ordner, weitere = [], ki, melde = () => {}, gleichzeitig = 5, vorrat = { worte: {}, texte: {}, code: {} } }) {
  const u = new Uebersetzung();
  const ordnerAlle = [ordner, ...weitere];
  const dateien = [];
  for (const o of ordnerAlle) for (const rel of await alleDateien(o)) {
    const voll = path.join(o, rel);
    const bin = !/\.(json|js|md|css)$/.test(rel);
    const q = bin ? null : await fs.readFile(voll, 'utf8');
    dateien.push({ ordner: o, rel, voll, q, art: bin ? 'datei' : artVon(rel, q) });
  }

  /* 1. Sammeln */
  melde('Sammle Namen und Texte', 0, 1);
  for (const d of dateien) {
    if (d.art === 'json') uebersetzeWert(u, JSON.parse(d.q), false);
    else if (d.art === 'daten') uebersetzeDatenQuelltext(u, d.q);
    else if (d.art === 'code' && d.rel.endsWith('.js')) {
      for (const t of zerlege(d.q)) if (t.art === 'string' || t.art === 'vorlage') { const s = d.q.slice(t.s, t.e); if (istName(s)) u.name(s, true); }
    }
    for (const teil of d.rel.split('/')) if (!/Bildschirmfoto/.test(teil)) u.name(teil.replace(/\.[a-z]+$/, ''), true);
  }
  u.sammeln = false;

  /* 2. Namen (was der Vorrat schon kennt, geht nicht noch einmal an die KI) */
  for (const [de, en] of Object.entries(vorrat.worte || {})) if (u.offeneWorte.has(de)) u.worte.set(de, en);
  const worte = [...u.offeneWorte].filter(w => !u.worte.has(w)).sort();
  const glossar = `## Glossar (vom PO bestätigt)\n\n${GLOSSAR}`;
  const STUECK_WORTE = 250;
  const stuecke = [];
  for (let i = 0; i < worte.length; i += STUECK_WORTE) stuecke.push(worte.slice(i, i + STUECK_WORTE));
  let fertig = 0;
  melde(`Namen 0 von ${worte.length}`, 0, worte.length);
  await jeweils(stuecke, gleichzeitig, async (teil) => {
    const r = await ki({ system: WORTE_ANLEITUNG, prompt: `${glossar}\n\n## Namen\n\n${teil.join('\n')}`, schema: WORTE_SCHEMA, aufwand: 'low' });
    const nach = new Map((r.liste || []).map(x => [x.de, x.en]));
    for (const w of teil) u.worte.set(w, String(nach.get(w) ?? w).trim() || w);
    fertig += teil.length;
    melde(`Namen ${fertig} von ${worte.length}`, fertig, worte.length);
  });
  /* Zwei deutsche Namen mit demselben englischen: einmal nachfragen, sonst eindeutig machen. */
  const doppelt = () => { const je = new Map(); for (const [de, en] of u.worte) { if (de === en && !je.has(en)) { je.set(en, [de]); continue; } (je.get(en) ?? je.set(en, []).get(en)).push(de); } return [...je.entries()].filter(([, l]) => l.length > 1); };
  for (const [en, deutsche] of doppelt()) {
    const r = await ki({ system: WORTE_ANLEITUNG, prompt: `${glossar}\n\n## Namen\n\nDiese Namen hatten alle „${en}“ bekommen. Gib jedem einen eigenen englischen Namen, verschieden voneinander und von allen anderen.\n\n${deutsche.join('\n')}`, schema: WORTE_SCHEMA, aufwand: 'low' });
    for (const x of r.liste || []) if (deutsche.includes(x.de) && x.en) u.worte.set(x.de, x.en.trim());
  }
  for (const [en, deutsche] of doppelt()) deutsche.slice(1).forEach((de, i) => u.worte.set(de, `${en}${i + 2}`));

  /* 3. Texte */
  for (const [de, en] of Object.entries(vorrat.texte || {})) if (u.offeneTexte.has(de)) u.texte.set(de, en);
  const texte = [...u.offeneTexte].filter(t => !u.texte.has(t)).sort();
  const STUECK_TEXTE = 80;
  const textStuecke = [];
  for (let i = 0; i < texte.length; i += STUECK_TEXTE) textStuecke.push(texte.slice(i, i + STUECK_TEXTE));
  fertig = 0;
  melde(`Texte 0 von ${texte.length}`, 0, texte.length);
  await jeweils(textStuecke, gleichzeitig, async (teil) => {
    const r = await ki({ system: TEXTE_ANLEITUNG, prompt: `${glossar}\n\n## Texte\n\n${JSON.stringify(teil, null, 1)}`, schema: WORTE_SCHEMA, aufwand: 'low' });
    const liste = r.liste || [];
    teil.forEach((t, i) => { const x = liste.find(y => y.de === t) ?? (liste.length === teil.length ? liste[i] : null); if (x?.en) u.texte.set(t, x.en); });
    fertig += teil.length;
    melde(`Texte ${fertig} von ${texte.length}`, fertig, texte.length);
  });

  /* 4. Code und Regeln (Anweisung 54): Nur die Textstücke, die ein Mensch liest, gehen mit ihrer Codezeile an die KI; der Code
     bleibt Zeichen für Zeichen gleich. Gleiche Stücke wie in den Daten bekommen dieselbe Übersetzung. Die Anleitung der KI ganz. */
  vorrat.stuecke ??= {};
  vorrat.anleitungen ??= {};
  const codeDateien = dateien.filter(d => (d.art === 'code' && d.rel.endsWith('.js')) || d.art === 'anleitung');
  const einzeln = [], anleitungen = [], schonDa = new Set();
  for (const d of codeDateien) {
    if (d.art === 'anleitung') { if (!(d.q in vorrat.anleitungen)) anleitungen.push({ anleitung: d }); continue; }
    d.stuecke = stueckeImCode(d.q);
    for (const x of d.stuecke) {
      const k = `${x.zeile}\u0001${x.text}`;
      if (u.texte.has(x.text)) vorrat.stuecke[k] = u.texte.get(x.text);
      else if (!/[A-Za-zÄÖÜäöüß]{2}/.test(x.text)) vorrat.stuecke[k] = englischeZeichen(x.text);
      else if (!(k in vorrat.stuecke) && !schonDa.has(k)) { schonDa.add(k); einzeln.push({ k, zeile: x.zeile, text: x.text, datei: d.rel }); }
    }
  }
  const pakete = [];
  for (let i = 0; i < einzeln.length; i += 60) pakete.push(einzeln.slice(i, i + 60));
  pakete.push(...anleitungen);
  fertig = 0;
  melde(`Plugins und Regeln 0 von ${pakete.length}`, 0, pakete.length);
  await jeweils(pakete, gleichzeitig, async (paket) => {
    if (paket.anleitung) {
      const r = await ki({ system: ANLEITUNG_MD, prompt: `${glossar}\n\n## Anleitung\n\n${paket.anleitung.q}`, schema: CODE_SCHEMA, aufwand: 'low' });
      vorrat.anleitungen[paket.anleitung.q] = String(r.quelltext || paket.anleitung.q);
    } else {
      const liste = paket.map((x, nr) => ({ nr, datei: x.datei, zeile: x.zeile, text: x.text }));
      const r = await ki({ system: STUECKE_ANLEITUNG, prompt: `${glossar}\n\n## Stücke\n\n${JSON.stringify(liste, null, 1)}`, schema: STUECKE_SCHEMA, aufwand: 'low' });
      for (const y of r.liste || []) if (paket[y.nr]) vorrat.stuecke[paket[y.nr].k] = englischeZeichen(String(y.en));
    }
    fertig++;
    melde(`Plugins und Regeln ${fertig} von ${pakete.length}`, fertig, pakete.length);
  });

  /* 5. Einsetzen (nichts wird umbenannt) */
  melde('Setze ein', 0, 1);
  const rot = [];
  for (const d of dateien) {
    let neu = null;
    if (d.art === 'json') neu = `${JSON.stringify(uebersetzeWert(u, JSON.parse(d.q), false), null, 2)}\n`;
    else if (d.art === 'daten') neu = uebersetzeDatenQuelltext(u, d.q);
    else if (d.art === 'anleitung') neu = vorrat.anleitungen[d.q] ?? null;
    else if (d.stuecke) {
      neu = setzeStueckeEin(d.q, d.stuecke, vorrat.stuecke);
      /* Außer den Textstücken muss alles gleich sein; sonst bleibt die Datei, wie sie war */
      if (!gleichBisAufTexte(d.q, neu)) { rot.push(d.rel); neu = null; }
    }
    if (neu !== null && neu !== d.q) await fs.writeFile(d.voll, neu);
  }
  vorrat.worte = Object.fromEntries(u.worte); vorrat.texte = Object.fromEntries(u.texte);
  /* Für die Anzeige im Maschinenraum: Wörter aus Pfaden und Kennungen auf Englisch (die Daten bleiben, wie sie sind) */
  for (const o of ordnerAlle) {
    await fs.mkdir(path.join(o, 'entscheidungen'), { recursive: true });
    await fs.writeFile(path.join(o, 'entscheidungen', 'anzeige-namen.json'), `${JSON.stringify(Object.fromEntries([...u.worte].filter(([x, y]) => x !== y)), null, 1)}\n`);
  }
  return { vorrat, worte: u.worte, texte: u.texte, dateien: dateien.length, namen: worte.length, saetze: texte.length, code: pakete.length, rot };
}

/* Kleine deutsche Wörter, die ein Satz zwischen Werten braucht („ trifft “, „ am “, „durch “, „nach“ als Zweig einer Bedingung).
   Sie sehen aus wie Namen aus dem Code und fielen darum bisher durch (Anweisung 56 des PO, 10.11.: „Reassign trifft a task …“). */
const BINDEWOERTER = new Set(('und oder ist sind war trifft treffen der die das den dem des ein eine einen einem einer nicht noch mit für von vom zu zur zum auf '
  + 'im am bei beim nach aus wird werden kein keine jetzt schon auch als bis ab vor statt seit ohne gegen durch über unter zwischen nur anders '
  + 'gilt enden endet entfernen kopie hat haben gibt weil wenn dann machen macht').split(' '));
export function istBaustein(q, s, e) {
  const t = q.slice(s, e);
  /* nur Wörter aus Kleinbuchstaben, ohne Bindestrich (Klassennamen wie „ ist-aus“) */
  if (!/^[\s(]*[a-zäöüß]+([\s,.:;()]+[a-zäöüß]+)*[\s,.:;)]*$/i.test(t)) return false;
  if (!t.toLowerCase().match(/[a-zäöüß]+/g).some(w => BINDEWOERTER.has(w))) return false;
  /* Leerzeichen am Rand: steht zwischen Werten im Satz */
  if (/^\s|\s$/.test(t)) return true;
  /* einzelnes Wort als Zweig einer Bedingung in einem zusammengesetzten Satz: (offen ? "auf" : "zu") */
  const anfang = q.lastIndexOf('\n', s) + 1, ende = q.indexOf('\n', e);
  const davor = q.slice(anfang, s - 1), zeile = q.slice(anfang, ende < 0 ? q.length : ende);
  return /[?:]\s*$/.test(davor) && davor.includes('?') && /\+|\$\{/.test(zeile);
}

/* ---------- Textstücke im Code (Anweisung 54) ---------- */
const FUELLWORT = /(^|[\s(„“"'])(und|oder|ist|sind|der|die|das|den|dem|des|ein|eine|einen|einem|nicht|noch|mit|für|von|zu|zur|zum|auf|im|bei|nach|aus|wird|werden|kein|keine|jetzt|schon|alle|auch|sich|dass|wie|was|wo|als|bis|um|ab|vor|soll|hat|haben|gibt|statt|weitere|weiteren|mehr|weniger)(?=$|[\s.,:;!?)„“"'])/i;
function istText(s) {
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(s)) return /[„“]/.test(s);
  if (/[äöüÄÖÜß„“]/.test(s)) return true;
  /* Ein großgeschriebenes Wort mit Doppelpunkt oder Leerzeichen am Ende ist der Anfang eines Satzes („Vorspielen: “). */
  if (/^\s*[A-ZÄÖÜ][a-zäöüß]+[:.]?\s+$/.test(s)) return true;
  if (FUELLWORT.test(s) && (/\s/.test(s) || /^[A-ZÄÖÜ]/.test(s))) return true;
  return !istName(s.trim()) && /[a-zäöüß]/.test(s) && !/^(https?:|\/|\.\/|#|\.|\[)/.test(s.trim()) && !/^[\w-]+\.(js|css|json|md|html|png)$/.test(s.trim());
}
export function englischeZeichen(s) {
  return s.replace(/„([^„“]*)“/g, '\u0002$1\u0003').replace(/„/g, '\u0002').replace(/“/g, '\u0003').replace(/\u0002/g, '“').replace(/\u0003/g, '”');
}
function stueckeImCode(q) {
  const out = [];
  for (const t of zerlege(q)) {
    if (t.art !== 'string' && t.art !== 'vorlage') continue;
    const s = q.slice(t.s, t.e);
    if (!istText(s) && !istBaustein(q, t.s, t.e)) continue;
    const anfang = q.lastIndexOf('\n', t.s) + 1, ende = q.indexOf('\n', t.e);
    out.push({ s: t.s, e: t.e, vor: q[t.s - 1], text: s, zeile: q.slice(anfang, ende < 0 ? q.length : ende).trim().slice(0, 400) });
  }
  return out;
}
/* Ein englisches Stück darf die Zeichenkette nicht brechen. */
function geschuetzt(vor, en) {
  if (vor === '"' || vor === "'") return en.replace(new RegExp(`(^|[^\\\\])${vor}`, 'g'), `$1\\${vor}`).replace(/\n/g, '\\n');
  if (vor === '`' || vor === '}') return en.replace(/(^|[^\\])`/g, '$1\\`').replace(/\$\{/g, '\\${');
  return en;
}
function setzeStueckeEin(q, stuecke, je) {
  let out = q;
  for (const x of [...stuecke].sort((a, b) => b.s - a.s)) {
    const en = je[`${x.zeile}\u0001${x.text}`];
    if (en !== undefined && en !== x.text) out = out.slice(0, x.s) + geschuetzt(x.vor, en) + out.slice(x.e);
  }
  return out;
}
function gleichBisAufTexte(a, b) {
  const ohne = (q) => { let o = '', i = 0; for (const t of zerlege(q)) if (t.art === 'string' || t.art === 'vorlage') { o += q.slice(i, t.s) + '\u0000'; i = t.e; } return o + q.slice(i); };
  if (ohne(a) !== ohne(b)) return false;
  try { new vm.Script(b); return true; } catch { return false; }
}
const STUECKE_SCHEMA = { type: 'object', properties: { liste: { type: 'array', items: { type: 'object', properties: { nr: { type: 'integer' }, en: { type: 'string' } }, required: ['nr', 'en'], additionalProperties: false } } }, required: ['liste'], additionalProperties: false };
const STUECKE_ANLEITUNG = `Du übersetzt Textstücke aus Plugins einer Anwendung für die Bodenabfertigung an Flughäfen vom Deutschen ins Englische.
Du bekommst je Stück die Datei und die Codezeile, in der es steht.

- Übersetze nur, was ein Mensch auf dem Bildschirm liest. Ein Stück, das kein Text für Menschen ist (Schlüssel, Vergleichswert ohne
  Anzeige, CSS, Pfad, Kennung, Code), gibst du genau unverändert zurück.
- Text für Menschen ist auch: Wörter in HTML-Attributen wie title, placeholder, aria-label (z. B. ' title="Von ' → ' title="From '),
  und Werte, die als Konfliktart, Status, Grund oder Beschriftung angezeigt werden (z. B. art: "außerhalb der Anwesenheit").
- Wird ein Satz aus mehreren Stücken und Werten zusammengesetzt, übersetze jedes Stück so, dass der ganze Satz auf Englisch richtig liest.
  Die Werte dazwischen bleiben an ihrem Platz; ein Stück darf dafür leer werden oder Wörter aus einem Nachbarstück aufnehmen.
- Kennungen (MA-01, XC810-ENTL-01), Pfade und Namen aus dem Code bleiben genau unverändert. Personennamen, Flugnummern,
  Flugzeugmuster, Gates und Uhrzeiten bleiben.
- Leerzeichen am Anfang und Ende, Satzzeichen, Zeilenumbrüche, HTML-Tags und Platzhalter bleiben. „…“ wird “…”.
- Halte dich an das Glossar unten. Britisches Englisch, einfache kurze Sätze in den Worten des Fachs.
Antworte mit der Liste {nr, en}, ein Eintrag je Stück.`;
const ANLEITUNG_MD = `Übersetze diese Anleitung für eine KI vom Deutschen ins Englische, vollständig und genau, mit dem Glossar unten. Aufbau,
Überschriften, Listen und alles in Backticks (Schlüssel, Werte, Pfade, Code) bleiben genau gleich; nur der Text dazwischen wird englisch.
Antworte mit der ganzen Anleitung in quelltext.`;

/* Die Namen aus dem Wörterbuch, die in einem Text vorkommen (als Wort), und deren Übersetzung sich unterscheidet. */
function namenAus(u, text) {
  const da = new Set(text.match(WORT) || []);
  return [...u.worte].filter(([de, en]) => de !== en && da.has(de));
}

async function uebersetzeCode(u, q, rel, ki, glossar) {
  const namen = namenAus(u, q);
  const texte = [];
  for (const t of zerlege(q)) if (t.art === 'string' || t.art === 'vorlage') { const s = q.slice(t.s, t.e); if (u.texte.has(s)) texte.push([s, u.texte.get(s)]); }
  const prompt = `${glossar}\n\n## Namen\n\n${namenListe(namen) || '(keine)'}\n\n## Texte\n\n${texte.length ? texte.map(([a, b]) => `${JSON.stringify(a)} → ${JSON.stringify(b)}`).join('\n') : '(keine)'}\n\n## Datei ${rel}\n\n${q}`;
  let r = await ki({ system: CODE_ANLEITUNG, prompt, schema: CODE_SCHEMA, aufwand: 'low' });
  let neu = nachsetzen(u, String(r.quelltext || ''), rel, q);
  const fehler = pruefeCode(u, neu, rel);
  if (fehler) {
    r = await ki({ system: CODE_ANLEITUNG, prompt: `${prompt}\n\n## Beim ersten Versuch\n\n${fehler}\nÜbersetze die Datei noch einmal ganz.`, schema: CODE_SCHEMA, aufwand: 'medium' });
    const zweiter = nachsetzen(u, String(r.quelltext || ''), rel, q);
    if (!pruefeCode(u, zweiter, rel) || !/^Die Datei lässt sich nicht/.test(pruefeCode(u, zweiter, rel))) neu = zweiter;
  }
  if (rel.endsWith('.js')) try { new vm.Script(neu); } catch { return uebersetzeQuelltext(u, q, false); }
  return neu;
}

/* Schlüssel, die Play in Plugins, Regeln, Daten und Szenarien liest. Übersetzt die KI einen davon, setzt Play ihn zurück. */
/* Nur Schlüssel, die kaum als eigene Schlüssel eines Plugins vorkommen; Wörter wie von, bis, name, text bleiben der KI überlassen. */
const PLAY_SCHLUESSEL = ['platz', 'variante', 'abonniert', 'besitzt', 'beimStart', 'ansicht', 'rang', 'neuBei', 'zeichne', 'ergaenzt',
  'prueft', 'bedienungen', 'stil', 'beschreibe', 'beschreibeObjekt', 'erzaehle', 'anzeige', 'fasst', 'ereignis', 'rollt', 'zeiger',
  'vorschau', 'pfade', 'pruefe', 'wortlaut', 'herkunft', 'quelle', 'netz', 'objekt', 'aktion', 'parameter', 'erzaehlung', 'hinweis',
  'untertitel', 'nennung', 'uebergaenge', 'zuBeginn', 'fristen', 'meldungen', 'erwartet', 'enthaelt',
  'enthaeltNicht', 'nachricht', 'drehbuecher', 'bereit'];
function playSchluesselZurueck(u, original, q) {
  const schluessel = (text) => {
    const n = new Map();
    for (const m of text.matchAll(/(^|[{,\s])([A-Za-z_$][\w$]*)\s*:(?!:)/g)) n.set(m[2], (n.get(m[2]) || 0) + 1);
    return n;
  };
  const vorher = schluessel(original), nachher = schluessel(q);
  let out = q;
  /* Plays Merkmale an der Seite (data-pfad …) und Plays feste Werte (ort: "seite", art: "ziehen" …) bleiben. */
  const MERKMALE = { pfad: ['path'], sicht: ['view'], ort: ['place', 'location'], teilapp: ['subapp', 'subApp'], spur: ['lane', 'track'], von: ['from'], bis: ['to', 'until'], plugin: [] };
  for (const [de, liste] of Object.entries(MERKMALE)) {
    if (!new RegExp(`dataset\\.${de}\\b|data-${de}\\b`).test(original)) continue;
    for (const en of new Set([u.worte.get(de), ...liste].filter(x => x && x !== de))) {
      if (new RegExp(`dataset\\.${en}\\b|data-${en}\\b`).test(original)) continue;
      out = out.replace(new RegExp(`dataset\\.${en}\\b`, 'g'), `dataset.${de}`).replace(new RegExp(`data-${en}\\b`, 'g'), `data-${de}`);
    }
  }
  const WERTE = { ort: { page: 'seite', side: 'seite', main: 'haupt' }, art: { drag: 'ziehen', click: 'klicken', enter: 'eingeben', input: 'eingeben', type: 'eingeben', condition: 'bedingung', ai: 'ki', 'not-showable': 'nicht-zeigbar' } };
  for (const [k, je] of Object.entries(WERTE)) {
    out = out.replace(new RegExp(`(\\b${k}\\s*:\\s*)(["'])([\\w-]+)\\2`, 'g'), (ganz, a, z, w) => je[w] && original.includes(`${z}${je[w]}${z}`) ? `${a}${z}${je[w]}${z}` : ganz);
  }
  for (const k of PLAY_SCHLUESSEL) {
    const en = u.worte.get(k);
    if (!en || en === k || !vorher.has(k) || (nachher.get(k) || 0) >= vorher.get(k) || vorher.has(en)) continue;
    out = out.replace(new RegExp(`(^|[{,\\s])${en}(\\s*):(?!:)`, 'g'), `$1${k}$2:`);
  }
  return out;
}

/* Was die KI an Namen und Texten übersehen hat, setzt Play maschinell nach (nur in Zeichenketten). */
function nachsetzen(u, q, rel, original) {
  if (!rel.endsWith('.js')) return q;
  const stuecke = [];
  for (const t of zerlege(q)) {
    if (t.art !== 'string' && t.art !== 'vorlage') continue;
    const s = q.slice(t.s, t.e);
    const neu = u.texte.has(s) ? u.texte.get(s) : istName(s) ? u.name(s, true) : s;
    if (neu !== s) stuecke.push({ ...t, neu });
  }
  /* Plays Schlüssel, Merkmale und Werte zuletzt, damit das Nachsetzen sie nicht wieder übersetzt */
  let out = ersetze(q, stuecke);
  if (original) out = playSchluesselZurueck(u, original, out);
  /* Tagesdaten: Plays Schlüssel der Objektarten zurück, dann deren Status, Übergänge und Ereignisse wie in allen Daten */
  if (original && /^daten\//.test(rel)) {
    for (const k of ['bei', 'durch', 'ereignisse', 'werte', 'einen', 'uebergaenge', 'feld', 'fall']) {
      const en = u.worte.get(k);
      if (!en || en === k || !new RegExp(`(^|[{,\\s])${k}\\s*:`).test(original) || new RegExp(`(^|[{,\\s])${en}\\s*:`).test(original)) continue;
      out = out.replace(new RegExp(`(^|[{,\\s])${en}(\\s*):(?!:)`, 'g'), `$1${k}$2:`);
    }
    out = uebersetzeDatenQuelltext(u, out, ARTEN_BLOCK, true);
  }
  return out;
}

function pruefeCode(u, q, rel) {
  if (!q.trim()) return 'Die Antwort war leer.';
  if (rel.endsWith('.js')) { try { new vm.Script(q); } catch (e) { return `Die Datei lässt sich nicht lesen: ${e.message}`; } }
  const uebrig = new Set();
  if (rel.endsWith('.js')) {
    for (const t of zerlege(q)) {
      if (t.art !== 'bezeichner') continue;
      const s = q.slice(t.s, t.e);
      if (u.worte.has(s) && u.worte.get(s) !== s && !(PLAY_WORT.bezeichner.has(s) && !IMMER_FACH.has(s)) && !JS_WOERTER.has(s)) uebrig.add(s);
    }
  }
  const umlaute = (q.match(/[^\n]*[äöüÄÖÜß][^\n]*/g) || []).slice(0, 5);
  if (!uebrig.size && !umlaute.length) return null;
  return [uebrig.size ? `Noch deutsch: ${[...uebrig].join(', ')}.` : '', umlaute.length ? `Noch deutsche Zeilen, z. B.:\n${umlaute.join('\n')}` : ''].filter(Boolean).join('\n');
}

/* Dateien und Ordner, die nach einer Kennung heißen, bekommen den englischen Namen. Plays eigene Dateien und Ordner
   (projekt.json, gearbeitet.json, daten/tag.js, plugins/verwaltung.json …) bleiben, wie sie sind. */
function nachKennung(rel, ordner) {
  const t = rel.split('/');
  if (t.includes('anhaenge')) return false;
  if (t[0] === 'plugins' && (t[1] === 'bausteine' || t[1] === 'papierkorb')) return t.length >= 3;
  if (t[0] === 'plugins' && t[1] === 'archiv') return t.length === 4;
  if (t[0] === 'plugins') return t.length === 2 && !ordner && /.(js|css)$/.test(t[1]);
  if (t[0] === 'drehbuecher') return !ordner && (t.length === 2 || (t.length === 3 && t[1] === 'gespielt'));
  if (t[0] === 'sollergebnisse' || t[0] === 'regeln') return t.length === 2 && !ordner;
  if (t[0] === 'daten' && t[1] === 'bereiche') return t.length === 3 && !ordner;
  return false;
}
async function benenneUm(u, ordner, unter = '') {
  for (const e of await fs.readdir(path.join(ordner, unter), { withFileTypes: true }).catch(() => [])) {
    if (NICHT.has(e.name) || (unter === '' && e.name === 'projekte')) continue;
    const rel = unter ? `${unter}/${e.name}` : e.name;
    if (e.isDirectory()) await benenneUm(u, ordner, rel);
    const m = e.name.match(/^([^.]+)(..*)?$/);
    const neu = /Bildschirmfoto/.test(e.name) ? e.name.replace(/Bildschirmfoto/g, 'Screenshot')
      : nachKennung(rel, e.isDirectory()) ? u.name(m[1], true) + (m[2] ?? '') : e.name;
    if (neu !== e.name && !existsSync(path.join(ordner, unter, neu))) await fs.rename(path.join(ordner, unter, e.name), path.join(ordner, unter, neu));
  }
}

/* Für die Durchsicht: Plays eigene Wörter (bleiben nach der Entscheidung des PO vom 10.11.2026) */
export function playWoerter() { return { bezeichner: PLAY_WORT.bezeichner, ketten: PLAY_WORT.ketten, teile: PLAY_TEILE }; }
