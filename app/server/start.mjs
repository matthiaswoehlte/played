/* Lokale Brücke der Play-Seite: liefert die Seite aus und reicht Wünsche an die innere KI.
   Zugang über das Agent SDK aus CCIDE-CODE mit dem lokalen Claude-Code-Login, ohne API-Key.
   Hört nur auf 127.0.0.1. Die KI bekommt keine Werkzeuge; alles steht im Auftrag.

   Plugins sind klein. Jedes liegt in plugins/bausteine/<kennung>/ mit seiner Herkunft
   (herkunft.json: Wünsche im Wortlaut, Fassungen) und seinen Fassungen (fassung-NNN.js).
   Ein Wunsch legt genau ein neues kleines Plugin an oder ändert gezielt genau eines; ein
   bestehendes Plugin komplett neu zu liefern, nimmt die Brücke nicht an. Die Grundausstattung
   liegt in plugins/<kennung>.js; eine Änderung daran wird ebenfalls Fassung in bausteine/. */
import http from 'node:http';
import { existsSync, promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { kiUeberAbo, uebersetzeKopie } from './uebersetzer.mjs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { xlsxZuCsv } from './xlsx.mjs';
import { herkunftAufgehoben, flacheBereiche, teilApps, zugriffe as zugriffeImQuelltext } from './herkunft-leser.mjs';
import { leereBereich, merkeTeilApp, hatGrundstock, holeZurueck as holeSicherungZurueck } from './bereich-leeren.mjs';

const PORT = Number(process.env.PLAY_PORT) || 4327;   // Prüfungen laufen auf eigener Brücke
const MODELL = 'claude-opus-5-5';
const AUFWAND = 'medium';
const ZEITLIMIT_MS = 5 * 60 * 1000;
/* Eine Änderung ist gezielt, solange sie nicht den größten Teil des Plugins ersetzt. */
const GEZIELT_ANTEIL = 0.6;
const GEZIELT_MINDESTENS = 800;   // Zeichen, die auch ein kleines Plugin immer ändern darf

const SERVER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(SERVER, '..');
/* Projekte (Auftrag 009): Ein Projekt ist eine Nutzapp mit eigenem Ordner. Bodenabfertigung liegt, wo es
   immer lag (der Play-Ordner selbst, damit nichts umziehen musste); jedes weitere Projekt liegt in
   projekte/<kennung>/. Jeder Projektordner hat ein projekt.json (Kennung, Name, Bereiche) und dieselbe
   Einteilung: manifest.js, daten/, plugins/, regeln/, drehbuecher/, sollergebnisse/, entscheidungen/.
   Alle Dateiwege unten hängen am geöffneten Projekt. Die Wegwerf-Ordner der Prüfungen (PLAY_…) gelten
   nur für das Stammprojekt Bodenabfertigung, denn die Testvorlage ist eine Kopie davon. */
const STAMM = 'bodenabfertigung';
const PROJEKTE = process.env.PLAY_PROJEKTE || path.join(PLAY, 'projekte');
/* Das zuletzt geöffnete Projekt; Prüfungen geben eine Wegwerf-Datei vor. */
const ZULETZT = process.env.PLAY_ZULETZT || path.join(PROJEKTE, 'zuletzt.json');
let PROJEKT = STAMM, PROJEKT_ORDNER = PLAY;
let GRUND, PLUGINDATEN, BAUSTEINE, PAPIERKORB, VERWALTUNG, ARCHIV, GESPIELT, SOLL, REGELN, IN_KAUF, ABGLEICH, BEDIENUNGEN, FAELLE, GEARBEITET, EINMAL, STAND_SPEICHER, GRUNDFUNKTIONEN, GRUNDDATEN, GRUNDSTOCK_GEAENDERT, UNBESTAETIGT;
/* Die Wege eines Projekts; auch für den Leser des Navigators, der ein anderes als das geöffnete Projekt liest. */
function wegeVon(kennung, ordner) {
  const stamm = kennung === STAMM;
  const env = name => (stamm && process.env[name]) || null;
  /* Prüfungen geben einen Wegwerf-Ordner vor; dort liegen bausteine/, papierkorb/ und verwaltung.json. */
  const plugindaten = env('PLAY_PLUGINDATEN') || path.join(ordner, 'plugins');
  return {
    GRUND: path.join(ordner, 'plugins'),
    PLUGINDATEN: plugindaten,
    BAUSTEINE: path.join(plugindaten, 'bausteine'),
    PAPIERKORB: path.join(plugindaten, 'papierkorb'),
    VERWALTUNG: path.join(plugindaten, 'verwaltung.json'),
    ARCHIV: path.join(ordner, 'plugins', 'archiv'),
    GESPIELT: env('PLAY_GESPIELT') || path.join(ordner, 'drehbuecher', 'gespielt'),   // Prüfungen: eigene Kopie
    /* Sollergebnisse sind Dateien im Repo, eine je Drehbuch. */
    SOLL: env('PLAY_SOLLERGEBNISSE') || path.join(ordner, 'sollergebnisse'),
    /* Regeln sind eigene Objekte, je eine Datei. Auch Regeln aus Wünschen landen hier. */
    REGELN: env('PLAY_REGELN') || path.join(ordner, 'regeln'),
    /* Entscheidungen des PO, Verstöße bewusst in Kauf zu nehmen. */
    IN_KAUF: env('PLAY_IN_KAUF') || path.join(ordner, 'entscheidungen', 'in-kauf.json'),
    /* Abgleich von Wunsch und Plugin nach dem Einspielen (Überschuss, enger gefasst, KI-Regeln) mit den Entscheidungen des PO. */
    ABGLEICH: env('PLAY_ABGLEICH') || path.join(ordner, 'entscheidungen', 'abgleich.json'),
    /* Wahl des PO, welches Plugin eine Bedienung übernimmt, wenn mehrere sie wollen. */
    BEDIENUNGEN: env('PLAY_BEDIENUNGEN') || path.join(ordner, 'entscheidungen', 'bedienungen.json'),
    /* Fälle ohne Regel, die der PO mit „Braucht keine Regel“ abgehakt hat (Auftrag 005, Stufe 2) */
    FAELLE: env('PLAY_FAELLE') || path.join(ordner, 'entscheidungen', 'faelle.json'),
    /* Welche Plugins beim letzten Abspielen in welchem Szenario gearbeitet haben, mit Datum (Anweisung 20). */
    GEARBEITET: env('PLAY_GEARBEITET') || path.join(ordner, 'gearbeitet.json'),
    /* Anweisung 45 (b): Plugins, die in keinem Szenario gearbeitet haben und darum einmal im Hintergrund abgespielt wurden. */
    EINMAL: env('PLAY_GEARBEITET') ? env('PLAY_GEARBEITET').replace(/\.json$/, '-einmal.json') : path.join(ordner, 'einmal-gespielt.json'),
    /* Zuletzt ermittelter Stand für den schnellen Start (Anweisung 23); kein Stand des PO, wird nicht eingecheckt. */
    STAND_SPEICHER: env('PLAY_STAND_SPEICHER') || path.join(ordner, 'stand-speicher.json'),
    /* Grundstock, nachträglich erfasst (Anweisung 21): je Grundfunktion Satz und Quelle. */
    GRUNDFUNKTIONEN: env('PLAY_GRUNDFUNKTIONEN') || path.join(ordner, 'grundfunktionen.json'),
    /* Anweisung 34: Grunddaten, die ein Wunsch geändert hat, je Eintrag mit Wunsch, Pfad, alt und neu. Die Datei daten/*.js bleibt, wie sie ist. */
    /* Anweisung 33: Wünsche, die der PO noch nicht bestätigt oder zurückgenommen hat; so übersteht die Meldung Neuladen und Neustart. */
    UNBESTAETIGT: env('PLAY_UNBESTAETIGT') || path.join(ordner, 'entscheidungen', 'unbestaetigt.json'),
    GRUNDDATEN: env('PLAY_GRUNDDATEN') || path.join(ordner, 'entscheidungen', 'grunddaten.json'),
    /* Anweisung 34 (d): Grundfunktionen, die ein Wunsch berührt hat; sind sie bestätigt, gelten sie wieder als Vorschlag. */
    GRUNDSTOCK_GEAENDERT: env('PLAY_GRUNDSTOCK_GEAENDERT') || path.join(ordner, 'entscheidungen', 'grundstock-geaendert.json'),
  };
}
function setzeWege(kennung, ordner) {
  PROJEKT = kennung;
  PROJEKT_ORDNER = ordner;
  ({ GRUND, PLUGINDATEN, BAUSTEINE, PAPIERKORB, VERWALTUNG, ARCHIV, GESPIELT, SOLL, REGELN, IN_KAUF, ABGLEICH, BEDIENUNGEN, FAELLE, GEARBEITET, EINMAL, STAND_SPEICHER, GRUNDFUNKTIONEN, GRUNDDATEN, GRUNDSTOCK_GEAENDERT, UNBESTAETIGT } = wegeVon(kennung, ordner));
}
setzeWege(STAMM, PLAY);

/* Ordner, in denen die Nutzapp liegt: Was dort fehlt, holt Play nie aus Bodenabfertigung. */
const PROJEKTTEILE = new Set(['manifest.js', 'projekt.json', 'daten', 'plugins', 'regeln', 'drehbuecher', 'sollergebnisse', 'entscheidungen']);

function liesProjektJson(ordner) {
  try { return JSON.parse(readFileSync(path.join(ordner, 'projekt.json'), 'utf8')); } catch { return null; }
}

/* Auftrag 011, Stufe 2: Play spricht die Sprache des offenen Projekts. Die englische Ausgabe der Seite, die Stücke des Servers
   und die Anleitungen der KI liegen in sprache/en (entstehen mit node server/uebersetze-play.mjs). */
const SPRACHE_EN = path.join(PLAY, 'sprache', 'en');
function englisch(ordner = PROJEKT_ORDNER) { return liesProjektJson(ordner)?.sprache === 'Englisch'; }
let enStuecke = null;
/* Der Auftrag an die KI: Plays eigene Texte englisch, Zeilen mit Quelltext (Plugins, Daten) bleiben, wie sie sind. */
const CODE_ZEILE = /^\s*(var|let|const|function|return|if|else|for|Huelle\.|\}|\{|\/\/|\/\*|\*)|[;{]\s*$|=>/;
function enAuftrag(text) {
  const code = [];
  const geschuetzt = String(text).split('\n').map(z => CODE_ZEILE.test(z) ? `\u0000${code.push(z) - 1}\u0000` : z).join('\n');
  return enText(geschuetzt, true).replace(/\u0000(\d+)\u0000/g, (x, i) => code[Number(i)]);
}
/* Stücke liegen in Quelltext-Schreibweise vor (\n, \`, \$); im Text stehen die Zeichen selbst. */
function ausQuelltext(s) { return s.replace(/\\(n|`|\$|'|"|\\)/g, (x, c) => c === 'n' ? '\n' : c); }
/* Deutsche Stücke aus Plays Server in einem Text durch ihre englischen ersetzen, längste zuerst. */
function enText(text, lang = false) {
  if (typeof text !== 'string' || (!lang && text.length > 20000) || !text) return text;
  if (!enStuecke) {
    let je = {};
    try { je = JSON.parse(readFileSync(path.join(SPRACHE_EN, 'server.json'), 'utf8')); } catch { /* ohne Stücke bleibt der Text */ }
    je = Object.fromEntries(Object.entries(je).map(([k, v]) => [ausQuelltext(k), ausQuelltext(v)]));
    const liste = Object.keys(je).filter(k => /[A-Za-zÄÖÜäöüß]{2}/.test(k)).sort((a, b) => b.length - a.length);
    const rand = (k, vorn) => (vorn ? /^[A-Za-zÄÖÜäöüß]/ : /[A-Za-zÄÖÜäöüß]$/).test(k) ? (vorn ? '(?<![A-Za-zÄÖÜäöüß])' : '(?![A-Za-zÄÖÜäöüß])') : '';
    const muster = liste.map(k => rand(k, true) + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + rand(k, false));
    enStuecke = { je, muster: liste.length ? new RegExp(muster.join('|'), 'g') : null };
  }
  const en = enStuecke.muster ? text.replace(enStuecke.muster, m => enStuecke.je[m] ?? m) : text;
  /* Deutsche Anführungszeichen „…“ werden “…” */
  return /„/.test(en) ? en.replace(/„([^„“]*)“/g, '“$1”').replace(/„/g, '“') : en;
}
/* Alle Texte in einer Antwort, wenn das offene Projekt englisch ist. */
const QUELLTEXT = /\bHuelle\.\w+\(|\bfunction\s*\(|=>/;
const CODE_SCHLUESSEL = new Set(['quelle', 'quelltext', 'plugin', 'drehbuch', 'pruefe', 'code', 'aenderungen']);
function inSprache(wert, an = englisch()) {
  if (!an) return wert;
  /* Quelltext (Plugins, Regeln, Szenarien, Daten) bleibt, wie er ist: Play übersetzt nur seine eigenen Sätze. */
  if (typeof wert === 'string') return QUELLTEXT.test(wert) ? wert : enText(wert);
  if (Array.isArray(wert)) return wert.map(x => inSprache(x, true));
  if (wert && typeof wert === 'object') return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, CODE_SCHLUESSEL.has(k) ? v : inSprache(v, true)]));
  return wert;
}
/* Anleitung der KI in der Sprache des Projekts */
function anleitungIn(datei, deutsch) {
  if (!englisch()) return deutsch;
  try { return readFileSync(path.join(SPRACHE_EN, datei), 'utf8'); } catch { return deutsch; }
}

/* Feste Kennung aus dem Namen beim Anlegen; danach bleibt sie, auch wenn der Name sich ändert. */
function neueKennung(name, vergeben) {
  const roh = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stamm = /^[a-z]/.test(roh) ? roh : `b-${roh || 'neu'}`;
  let k = stamm;
  for (let i = 2; vergeben.includes(k); i++) k = `${stamm}-${i}`;
  return k;
}

/* Alle Projekte: Bodenabfertigung und jeder Ordner unter projekte/ mit projekt.json, dessen Kennung zum Ordner passt. */
async function projekte() {
  const out = [{ kennung: STAMM, name: liesProjektJson(PLAY)?.name || 'Bodenabfertigung', ordner: PLAY }];
  for (const n of (await fs.readdir(PROJEKTE).catch(() => [])).sort()) {
    if (!KENNUNG.test(n) || n === STAMM) continue;
    const ordner = path.join(PROJEKTE, n);
    const j = liesProjektJson(ordner);
    if (j && j.kennung === n) out.push({ kennung: n, name: j.name || n, ordner });
  }
  return out;
}

/* Auftrag 011: Was beim Kopieren nicht mitgeht. Sicherungen nicht (Entscheidung 2), der schnelle Start entsteht neu.
   Bodenabfertigung liegt im Play-Ordner selbst; dort gehören Code, Prüfungen und die übrigen Projekte zu Play, nicht zum Projekt. */
const NICHT_KOPIEREN = new Set(['sicherungen', 'stand-speicher.json']);
const NICHT_KOPIEREN_STAMM = new Set(['server', 'huelle', 'index.html', 'pruefung', 'projekte', 'sprache', 'BUS-VERTRAG.md', 'Play starten.cmd', '.gitignore', 'node_modules']);
/* Teile, die Prüfungen außerhalb des Projektordners ablegen (PLAY_…); sie gehen an ihren gewohnten Platz in der Kopie. */
const AUSSER_ORDNER = ['PLUGINDATEN', 'GESPIELT', 'SOLL', 'REGELN', 'IN_KAUF', 'ABGLEICH', 'BEDIENUNGEN', 'FAELLE', 'GEARBEITET', 'EINMAL', 'GRUNDFUNKTIONEN', 'UNBESTAETIGT', 'GRUNDDATEN', 'GRUNDSTOCK_GEAENDERT'];

/* Kopiert ein Projekt mit allem (Bereiche, Plugins in allen Fassungen, Szenarien, Sollergebnisse, Regeln, Grundstock,
   Daten, Herkunft, Mitgeschriebenes) in einen neuen Ordner; dazu den Navigator, der es liest. Gibt die neue Kennung zurück. */
async function kopiereProjekt(quelle, titel, alle) {
  const vergeben = [STAMM, ...alle.map(p => p.kennung)];
  const kennung = neueKennung(titel, vergeben);
  vergeben.push(kennung);
  const ziel = path.join(PROJEKTE, kennung);
  const stamm = quelle.kennung === STAMM;
  const datum = new Date().toLocaleDateString('sv-SE');
  await fs.mkdir(ziel, { recursive: true });
  for (const n of await fs.readdir(quelle.ordner)) {
    if (NICHT_KOPIEREN.has(n) || (stamm && NICHT_KOPIEREN_STAMM.has(n))) continue;
    await fs.cp(path.join(quelle.ordner, n), path.join(ziel, n), { recursive: true });
  }
  const von = wegeVon(quelle.kennung, quelle.ordner), nach = wegeVon(kennung, ziel);
  for (const k of AUSSER_ORDNER) {
    if (von[k].startsWith(quelle.ordner + path.sep) || !existsSync(von[k])) continue;
    /* Neben den Plugin-Daten liegt im Ordner plugins/ auch der Grundstock; der bleibt. */
    const teile = k === 'PLUGINDATEN' ? [['BAUSTEINE'], ['PAPIERKORB'], ['VERWALTUNG']] : [[k]];
    for (const [t] of teile) {
      if (!existsSync(von[t])) continue;
      await fs.rm(nach[t], { recursive: true, force: true });
      await fs.cp(von[t], nach[t], { recursive: true });
    }
  }
  const j = liesProjektJson(quelle.ordner) ?? {};
  await fs.writeFile(path.join(ziel, 'projekt.json'), `${JSON.stringify({ ...j, kennung, name: titel, sprache: j.sprache || 'Deutsch', kopie: { von: quelle.kennung, name: j.name ?? quelle.name, datum } }, null, 2)}\n`);
  /* Der Navigator des Originals liest danach die Kopie; so hat auch sie ihren Navigator. */
  for (const n of alle.filter(p => liesProjektJson(p.ordner)?.liest === quelle.kennung)) {
    const nj = liesProjektJson(n.ordner);
    const nName = `${nj.name ?? n.name} · ${titel}`;
    const nKennung = neueKennung(nName, vergeben);
    vergeben.push(nKennung);
    const nZiel = path.join(PROJEKTE, nKennung);
    await fs.mkdir(nZiel, { recursive: true });
    for (const e of await fs.readdir(n.ordner)) if (!NICHT_KOPIEREN.has(e)) await fs.cp(path.join(n.ordner, e), path.join(nZiel, e), { recursive: true });
    await fs.writeFile(path.join(nZiel, 'projekt.json'), `${JSON.stringify({ ...nj, kennung: nKennung, name: nName, liest: kennung, kopie: { von: n.kennung, name: nj.name ?? n.name, datum } }, null, 2)}\n`);
  }
  return kennung;
}

/* Auftrag 011, Stufe 2: Eine frische Kopie wird an Ort und Stelle ins Englische übersetzt, mit dem bestätigten Glossar.
   Fortschritt in Schritten (Namen, Texte, Plugins und Regeln, Einsetzen) mit geschätzter Restzeit. */
let kopieLauf = null;
const ANTEIL = { sammle: [0, 0.01], namen: [0.01, 0.06], texte: [0.07, 0.18], code: [0.25, 0.7], setze: [0.95, 0.05] };
function kopieStand() {
  if (!kopieLauf) return { laeuft: false };
  const { laeuft, text, anteil, beginn, aktuell, fehler, dauer } = kopieLauf;
  const vergangen = (Date.now() - beginn) / 1000;
  const rest = laeuft && anteil > 0.03 ? Math.max(1, Math.round(vergangen * (1 - anteil) / anteil / 60)) : null;
  return { laeuft, text, anteil, rest, aktuell, fehler, dauer };
}
async function uebersetzeNeueKopie(kennung, quelle, beginn) {
  kopieLauf = { laeuft: true, text: 'Sammle Namen und Texte', anteil: 0, beginn };
  const ordner = path.join(PROJEKTE, kennung);
  const navigatoren = (await projekte()).filter(p => liesProjektJson(p.ordner)?.liest === kennung).map(p => p.ordner);
  const titelDerKopie = liesProjektJson(ordner)?.name;
  try {
    const roh = kiUeberAbo(MODELL);
    /* Ein Aussetzer des Abos bricht nicht alles ab: einmal nach 20 Sekunden neu. */
    const ki = async (a) => { try { return await roh(a); } catch { await new Promise(ok => setTimeout(ok, 20000)); return roh(a); } };
    const r = await uebersetzeKopie({
      ordner, weitere: navigatoren, ki,
      melde: (text, fertig, gesamt) => {
        const art = /^Namen/.test(text) ? 'namen' : /^Texte/.test(text) ? 'texte' : /^Plugins/.test(text) ? 'code' : /^Setze/.test(text) ? 'setze' : 'sammle';
        const [a, b] = ANTEIL[art];
        kopieLauf.text = text;
        kopieLauf.anteil = a + b * (gesamt ? fertig / gesamt : 0);
      },
    });
    /* Entscheidung 5: einmal beim Projekt der Vermerk; Sprache Englisch für Projekt und Navigator */
    const datum = new Date(beginn);
    const vermerk = `translated from the German original of ${datum.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    /* Kennung und Name hat der PO beim Anlegen vergeben; sie bleiben, wie sie sind. */
    const j = liesProjektJson(ordner);
    await fs.writeFile(path.join(ordner, 'projekt.json'), `${JSON.stringify({ ...j, kennung, name: titelDerKopie, sprache: 'Englisch', vermerk, kopie: { ...j.kopie, von: quelle.kennung, uebersetzt: datum.toISOString() } }, null, 2)}\n`);
    /* Kennungen bleiben (Anweisung 54); der Navigator der Kopie bekommt Sprache und Vermerk. */
    for (const n of navigatoren) {
      const nj = liesProjektJson(n);
      await fs.writeFile(path.join(n, 'projekt.json'), `${JSON.stringify({ ...nj, kennung: path.basename(n), liest: kennung, sprache: 'Englisch', vermerk }, null, 2)}\n`);
    }
    console.log(`Kopie übersetzt: ${kennung} in ${Math.round((Date.now() - beginn) / 1000)} s (${r.namen} Namen, ${r.saetze} Texte, ${r.code} Dateien)`);
    await oeffneProjekt(kennung);
    kopieLauf = { ...kopieLauf, laeuft: false, text: 'Fertig. Die Kopie öffnet sich.', anteil: 1, aktuell: kennung, dauer: Date.now() - beginn };
  } catch (e) {
    console.log(`Übersetzen abgebrochen: ${e.message}`);
    kopieLauf = { ...kopieLauf, laeuft: false, fehler: ohneKi(e) ? OHNE_KI : `Das Übersetzen ist abgebrochen: ${e.message}` };
  }
}

/* Ein Wechsel mitten in einem Wunsch würde dessen Ergebnis ins falsche Projekt schreiben. */
function laeuftNochEtwas() {
  for (const a of auftraege.values()) if (a.status === 'wartet' || a.status === 'arbeitet') return true;
  return abgleichLaeuft.size > 0;
}

async function oeffneProjekt(kennung, { merken = true } = {}) {
  const p = (await projekte()).find(x => x.kennung === kennung);
  if (!p) return false;
  setzeWege(p.kennung, p.ordner);
  if (!auftraegeJe.has(p.kennung)) auftraegeJe.set(p.kennung, new Map());
  auftraege = auftraegeJe.get(p.kennung);
  if (merken) {
    await fs.mkdir(path.dirname(ZULETZT), { recursive: true });
    await fs.writeFile(ZULETZT, `${JSON.stringify({ projekt: p.kennung }, null, 2)}
`);
  }
  return true;
}
/* Nur für Prüfungen: Antworten der KI aus einer Datei statt aus dem Abo */
const ATTRAPPE = process.env.PLAY_KI_ATTRAPPE || null;
/* Nur im vollen Prüflauf gesetzt: so viele Plätze zum Nachspielen bekommt eine Seite */
const KERNE_FUER_SEITE = Number(process.env.PLAY_KERNE) || 0;
/* Nur für Prüfungen: Antworten für den Abgleich. Ohne sie findet der Abgleich unter einer Attrappe nichts. */
const ATTRAPPE_ABGLEICH = process.env.PLAY_KI_ATTRAPPE_ABGLEICH || null;
/* Antworten für die Vorauswahl (Anweisung 36). Ohne sie gehen unter einer Attrappe alle Plugins mit. */
const ATTRAPPE_AUSWAHL = process.env.PLAY_KI_ATTRAPPE_AUSWAHL || null;
/* Wünsche an Play selbst; die Prüfungen schreiben in eine Wegwerf-Datei. */
const WUENSCHE_AN_PLAY = process.env.PLAY_WUENSCHE_AN_PLAY || path.resolve(PLAY, '..', '..', 'Docs', 'dialog', 'wuensche-an-play.md');
/* Nur für Prüfungen: Was die KI bekommen hätte, Auftrag für Auftrag in eine Datei */
const KI_PROTOKOLL = process.env.PLAY_KI_PROTOKOLL || null;
/* Anhänge eines Wunsches, bis er eingespielt ist; danach liegen sie neben seiner Herkunft. */
const ANHANG_EINGANG = process.env.PLAY_ANHAENGE || path.join(os.tmpdir(), `play-anhaenge-${PORT}`);
/* Erlaubte Arten von Anhängen; dieselbe Liste steht in huelle/anhaenge.js. Eine .js ist ein Anhang wie Text. */
const ANHANG_ARTEN = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8', '.js': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const ANHANG_JE_DATEI = 10 * 1024 * 1024;
const ANHANG_JE_WUNSCH = 25 * 1024 * 1024;
const ANHANG_HOECHSTENS = 10;
/* Anweisung 68: zuerst das Agent SDK im eigenen node_modules (im Repo played nach „npm install“), sonst wie bisher neben der App. */
const SDK_EIGEN = path.resolve(PLAY, '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
const SDK = existsSync(SDK_EIGEN) ? SDK_EIGEN : path.resolve(PLAY, '..', '..', 'CCIDE-CODE', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
/* Das im SDK mitgelieferte Claude Code ist älter als das Modell; das installierte hat denselben Login. */
const CLAUDE = path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const ANLEITUNG = readFileSync(path.join(SERVER, 'plugin-anleitung.md'), 'utf8');
const PROTOTYP_ANLEITUNG = readFileSync(path.join(SERVER, 'prototyp-anleitung.md'), 'utf8');
/* Der erste Prototyp einer Teil-App braucht länger als ein Wunsch. */
/* Anweisung 62: 25 Minuten; die zweitägige Equipment Dispatch braucht für den ersten Prototyp 11 bis 13½ Minuten. */
const ZEITLIMIT_PROTOTYP_MS = 25 * 60 * 1000;
const PROTOTYP_SCHEMA = {
  type: 'object',
  properties: {
    rueckfrage: { type: ['string', 'null'] },
    anzahlPlugins: { type: 'integer' },
    fachobjekte: { type: 'array', items: { type: 'object', properties: {
      wurzel: { type: 'string' }, name: { type: 'string' }, einer: { type: 'string' },
      felder: { type: 'array', items: { type: 'object', properties: { feld: { type: 'string' }, wort: { type: 'string' } }, required: ['feld', 'wort'], additionalProperties: false } },
    }, required: ['wurzel', 'name', 'einer', 'felder'], additionalProperties: false } },
    daten: { type: 'string' },
    plugins: { type: 'array', items: { type: 'object', properties: {
      kennung: { type: 'string' }, name: { type: 'string' }, kurz: { type: 'string' }, satz: { type: ['string', 'null'] }, quelle: { type: 'string' },
    }, required: ['kennung', 'name', 'kurz', 'satz', 'quelle'], additionalProperties: false } },
    drehbuch: { type: 'string' },
  },
  required: ['rueckfrage', 'anzahlPlugins', 'fachobjekte', 'daten', 'plugins', 'drehbuch'],
  additionalProperties: false,
};
const ABGLEICH_ANLEITUNG = readFileSync(path.join(SERVER, 'abgleich-anleitung.md'), 'utf8');

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const EIGENE_ADRESSEN = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
const KENNUNG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const ANTWORT_SCHEMA = {
  type: 'object',
  properties: {
    rueckfrage: { type: ['string', 'null'] },
    /* Schlägt die Rückfrage eine Aufteilung vor: die Teile in Reihenfolge, je ein Satz; sonst null */
    teile: { anyOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }] },
    kurz: { type: 'string' },
    name: { type: 'string' },
    art: { type: 'string', enum: ['neu', 'aendern', 'nur-regel', 'nur-daten'] },
    kennung: { type: 'string' },
    plugin: { type: ['string', 'null'] },
    aenderungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: { alt: { type: 'string' }, neu: { type: 'string' } },
        required: ['alt', 'neu'],
        additionalProperties: false,
      },
    },
    drehbuch: { type: ['string', 'null'] },
    zeigen: { type: ['string', 'null'] },
    /* Ein Wunsch, der zugleich Regel ist, liefert sie hier mit. */
    regel: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            kennung: { type: 'string' },
            satz: { type: 'string' },
            art: { type: 'string', enum: ['bedingung', 'ki', 'nicht-zeigbar'] },
            pruefe: { type: ['string', 'null'] },
          },
          required: ['kennung', 'satz', 'art', 'pruefe'],
          additionalProperties: false,
        },
      ],
    },
    /* Erwartungen in vorhandenen Drehbüchern, denen die Änderung bewusst widerspricht:
       drehbuch (Kennung), nr (Stelle in erwartet, ab 0), neu (die Erwartung als JSON), satz (für den Anforderer) */
    erwartungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          drehbuch: { type: 'string' },
          nr: { type: 'integer' },
          neu: { type: 'string' },
          satz: { type: 'string' },
        },
        required: ['drehbuch', 'nr', 'neu', 'satz'],
        additionalProperties: false,
      },
    },
    /* Anweisung 34: Grunddaten, die der Wunsch mitändert: pfad, neu (der neue Wert als JSON), satz (für den Anforderer) */
    grunddaten: {
      type: 'array',
      items: {
        type: 'object',
        properties: { pfad: { type: 'string' }, neu: { type: 'string' }, satz: { type: 'string' } },
        required: ['pfad', 'neu', 'satz'],
        additionalProperties: false,
      },
    },
    /* Kennungen der Grundfunktionen, deren Satz nach diesem Wunsch nicht mehr stimmt */
    grundfunktionen: { type: 'array', items: { type: 'string' } },
    /* Anweisung 36: Der Wunsch gilt Play selbst, nicht der Nutzapp: ein Satz an den Anforderer; sonst null */
    anPlay: { type: ['string', 'null'] },
    /* Anweisung 38: Kennungen vorhandener Plugins, deren Volltext die KI braucht, weil sie sie ändern will; sonst leer */
    volltext: { type: 'array', items: { type: 'string' } },
    /* Anweisung 43 (c): true, wenn die KI alle Daten braucht statt Aufbau und Beispielen; sonst false */
    alleDaten: { type: 'boolean' },
    /* Anweisung 48 (c): true, wenn der Wunsch etwas verlangt, das man in der Anwendung sieht; Play prüft das im Probelauf */
    sichtbar: { type: 'boolean' },
    /* Anweisung 49 (d): Braucht der Wunsch etwas aus einer anderen Teil-App, ein Antrag an sie: an (Kennung), satz; sonst null */
    antrag: {
      anyOf: [
        { type: 'null' },
        { type: 'object', properties: { an: { type: 'string' }, satz: { type: 'string' } }, required: ['an', 'satz'], additionalProperties: false },
      ],
    },
  },
  required: ['volltext', 'alleDaten', 'sichtbar', 'antrag', 'anPlay', 'rueckfrage', 'teile', 'kurz', 'name', 'art', 'kennung', 'plugin', 'aenderungen', 'drehbuch', 'zeigen', 'regel', 'erwartungen', 'grunddaten', 'grundfunktionen'],
  additionalProperties: false,
};

/* Anweisungen 36 und 38: Vor dem eigentlichen Auftrag sagt die KI, welche Angaben der Wunsch berührt
   (`auftraege/start` oder ein ganzes Fachobjekt `auftraege`). Antwortet sie auch nach einer Nachfrage (47) unsicher, gehen alle
   ändernden Plugins als Zeile mit. */
const AUSWAHL_SCHEMA = {
  type: 'object',
  properties: { angaben: { type: 'array', items: { type: 'string' } }, grundfunktionen: { type: 'array', items: { type: 'string' } }, unsicher: { type: 'boolean' } },
  required: ['angaben', 'grundfunktionen', 'unsicher'],
  additionalProperties: false,
};
/* Anweisung 45 (a): einzelne Angaben, nie ein ganzes Fachobjekt; nur ein Fachobjekt ohne eigene Angaben steht für sich. */
const AUSWAHL_ANLEITUNG = 'Du bekommst einen Wunsch an eine Anwendung und die Liste ihrer Fachobjekte mit ihren Angaben. Nenne alle Angaben, die der Wunsch liest, ändert oder anzeigt, einzeln als `fachobjekt/angabe`, z. B. `auftraege/start` für den Start eines Auftrags. Nenne nie ein ganzes Fachobjekt; nur ein Fachobjekt, für das keine Angaben aufgeführt sind, nennst du als `fachobjekt`. Im Zweifel eine Angabe mehr. Gilt er dem Aussehen der ganzen Anwendung oder kannst du es nicht sagen, setze unsicher auf true.';
const ZEITLIMIT_AUSWAHL_MS = 60000;

/* Antwort des Abgleichs: was das Plugin mehr tut, wo es (oder die Regel) enger ist als gesagt,
   und welche Regel der Art "ki" es nach Einschätzung bricht. Leer ist der Normalfall. */
const ABGLEICH_SCHEMA = {
  type: 'object',
  properties: {
    mehr: { type: 'array', items: { type: 'object', properties: { was: { type: 'string' } }, required: ['was'], additionalProperties: false } },
    enger: {
      type: 'array',
      items: { type: 'object', properties: { was: { type: 'string' }, regel: { type: 'boolean' } }, required: ['was', 'regel'], additionalProperties: false },
    },
    verstoesse: {
      type: 'array',
      items: {
        type: 'object',
        properties: { regel: { type: 'string' }, plugin: { type: 'string' }, satz: { type: 'string' } },
        required: ['regel', 'plugin', 'satz'],
        additionalProperties: false,
      },
    },
  },
  required: ['mehr', 'enger', 'verstoesse'],
  additionalProperties: false,
};

/* ---------- Dateien ---------- */
async function jsDateien(ordner) {
  const namen = await fs.readdir(ordner).catch(() => []);
  return namen.filter(n => n.endsWith('.js')).sort();
}

async function lies(datei) { return fs.readFile(datei, 'utf8'); }

const istGrund = kennung => existsSync(path.join(GRUND, `${kennung}.js`));
const fassungsDatei = nr => `fassung-${String(nr).padStart(3, '0')}.js`;

/* Was abgeschaltet ist, steht in einer Datei im Repo, nicht im Browser. */
async function ausgeschaltet() {
  const text = await fs.readFile(VERWALTUNG, 'utf8').catch(() => null);
  return text ? JSON.parse(text).aus : [];
}

async function schreibeAusgeschaltet(liste) {
  await fs.writeFile(VERWALTUNG, `${JSON.stringify({ aus: [...new Set(liste)].sort() }, null, 2)}\n`);
}

async function herkunftVon(ordner) {
  const text = await fs.readFile(path.join(ordner, 'herkunft.json'), 'utf8').catch(() => null);
  return text ? JSON.parse(text) : null;
}

async function schreibeHerkunft(ordner, h) {
  await fs.mkdir(ordner, { recursive: true });
  await fs.writeFile(path.join(ordner, 'herkunft.json'), `${JSON.stringify(h, null, 2)}\n`);
}

/* Die fachlich geltende Fassung: Eine Umstellung auf den Bus-Vertrag (Auftrag 005, art „vertrag“)
   ändert kein Verhalten; Abgleich und Entscheidungen des PO gelten durch sie hindurch weiter. */
function fachlicheFassung(h) {
  let f = h?.fassungen.find(x => x.nr === h.aktuell);
  while (f && f.art === 'vertrag' && f.vorige) f = h.fassungen.find(x => x.nr === f.vorige);
  return f?.nr ?? null;
}

/* Die gültigen Fassungen: von der aktuellen über „vorige“ zurück bis zur ersten, älteste zuerst. */
function kette(h) {
  const out = [];
  let nr = h.aktuell;
  while (nr) {
    const f = h.fassungen.find(x => x.nr === nr);
    if (!f) break;
    out.unshift(f);
    nr = f.vorige;
  }
  return out;
}

/* Ein Baustein mit seinen geltenden Dateien: Quelltext der aktuellen Fassung, Drehbücher der Kette. */
async function baustein(ordner, kennung) {
  const h = await herkunftVon(ordner);
  if (!h) return null;
  const dateien = [];
  const gueltig = kette(h);
  for (const f of gueltig) {
    if (f.drehbuch) {
      const d = path.join(ordner, `${f.drehbuch}.drehbuch.js`);
      if (existsSync(d)) dateien.push({ name: `${f.drehbuch}.drehbuch.js`, quelle: await lies(d) });
    }
    /* Geänderte Erwartungen gelten, solange die Fassung gilt, die sie mitgebracht hat. */
    if (f.erwartungen?.length) {
      const e = path.join(ordner, `${f.wunsch}.erwartungen.js`);
      if (existsSync(e)) dateien.push({ name: `${f.wunsch}.erwartungen.js`, quelle: await lies(e) });
    }
  }
  const aktuell = gueltig[gueltig.length - 1];
  const quelle = aktuell && path.join(ordner, fassungsDatei(aktuell.nr));
  if (quelle && existsSync(quelle)) dateien.push({ name: `${kennung}.js`, quelle: await lies(quelle) });
  return { ...h, kennung, grund: istGrund(kennung), dateien };
}

async function bausteineIn(wurzel) {
  const namen = await fs.readdir(wurzel).catch(() => []);
  const out = [];
  for (const n of namen.filter(n => KENNUNG.test(n))) {
    const b = await baustein(path.join(wurzel, n), n);
    if (b) out.push(b);
  }
  return out.sort((a, b) => (a.reihe ?? 0) - (b.reihe ?? 0));
}

/* Die Seite lädt das, was eingeschaltet ist; die Reihenfolge der Bausteine bleibt erhalten. */
async function gespeicherteWuensche() {
  const aus = await ausgeschaltet();
  const out = [];
  for (const b of await bausteineIn(BAUSTEINE)) {
    if (!aus.includes(b.kennung)) out.push(...b.dateien);
  }
  for (const n of await jsDateien(GESPIELT)) {
    out.push({ name: n, quelle: await lies(path.join(GESPIELT, n)) });
  }
  /* Anweisung 34: geänderte Grunddaten gelten für die Seite und jede Kopie; eine reine Datenänderung bringt ihre Erwartungen selbst mit. */
  const grunddaten = await grunddatenListe();
  if (grunddaten.length) out.unshift({ name: 'grunddaten.js', quelle: grunddatenQuelle(grunddaten) });
  for (const name of new Set(grunddaten.map(e => e.erwartungen).filter(Boolean))) {
    out.push({ name, quelle: await lies(path.join(path.dirname(GRUNDDATEN), name)) });
  }
  return out;
}

async function pluginStand() {
  return { wuensche: await bausteineIn(BAUSTEINE), papierkorb: await bausteineIn(PAPIERKORB), aus: await ausgeschaltet() };
}

/* Quelltext eines Plugins, wie er gerade gilt */
async function aktuelleQuelle(kennung) {
  const b = await baustein(path.join(BAUSTEINE, kennung), kennung);
  const eigen = b?.dateien.find(d => d.name === `${kennung}.js`);
  if (eigen) return eigen.quelle;
  if (istGrund(kennung)) return lies(path.join(GRUND, `${kennung}.js`));
  return null;
}

/* Alle Kennungen, die es gibt oder gab: Sie werden nie neu vergeben. */
async function vergebeneKennungen() {
  const namen = new Set();
  for (const n of await jsDateien(GRUND)) namen.add(n.replace(/\.js$/, ''));
  for (const wurzel of [BAUSTEINE, PAPIERKORB]) {
    for (const n of await fs.readdir(wurzel).catch(() => [])) namen.add(n);
  }
  return namen;
}

/* Wünsche sind fortlaufend nummeriert; auch das Archiv und der Papierkorb zählen mit. */
async function naechsteKennung() {
  const nummern = [...auftraege.keys()];
  for (const wurzel of [BAUSTEINE, PAPIERKORB]) {
    for (const b of await bausteineIn(wurzel)) {
      for (const w of b.wuensche || []) nummern.push(w.kennung);
      for (const f of b.fassungen || []) nummern.push(f.wunsch, f.drehbuch);
    }
  }
  for (const ordner of await fs.readdir(ARCHIV).catch(() => [])) {
    nummern.push(...await fs.readdir(path.join(ARCHIV, ordner)).catch(() => []));
  }
  const n = nummern.map(k => /wunsch-(\d+)/.exec(k || '')).filter(Boolean).map(m => Number(m[1]));
  return `wunsch-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`;
}

/* Verschieben mit kurzem Wiederholen: Unter Windows hält oft der Virenscanner eine eben verschobene Datei noch
   einen Augenblick fest; dann scheitert das nächste Verschieben mit EPERM, obwohl es eine Sekunde später geht
   (z. B. „Wiederherstellen“ gleich nach „Löschen“). Höchstens etwa 3 s, dann gilt der Fehler. */
async function verschiebe(von, nach) {
  for (let versuch = 0; ; versuch++) {
    try { return await fs.rename(von, nach); }
    catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || versuch >= 15) throw e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

/* Papierkorb: der ganze Ordner, die Sollergebnisse der eigenen Drehbücher ziehen mit um. */
async function eigeneDrehbuecher(ordner) {
  return (await fs.readdir(ordner).catch(() => [])).filter(n => n.endsWith('.drehbuch.js')).map(n => n.replace(/\.drehbuch\.js$/, ''));
}

async function wirfWeg(kennung) {
  const von = path.join(BAUSTEINE, kennung), nach = path.join(PAPIERKORB, kennung);
  if (!existsSync(von) || istGrund(kennung)) return false;
  for (const d of await eigeneDrehbuecher(von)) {
    if (existsSync(sollDatei(d))) await verschiebe(sollDatei(d), path.join(von, `${d}.soll.json`));
  }
  await fs.mkdir(PAPIERKORB, { recursive: true });
  await verschiebe(von, nach);
  await schreibeAusgeschaltet((await ausgeschaltet()).filter(k => k !== kennung));
  return true;
}

async function holeZurueck(kennung) {
  const von = path.join(PAPIERKORB, kennung), nach = path.join(BAUSTEINE, kennung);
  if (!existsSync(von) || existsSync(nach)) return false;
  await verschiebe(von, nach);
  for (const d of await eigeneDrehbuecher(nach)) {
    const s = path.join(nach, `${d}.soll.json`);
    if (existsSync(s)) {
      await fs.mkdir(SOLL, { recursive: true });
      await verschiebe(s, sollDatei(d));
    }
  }
  return true;
}

/* „Zurück zur vorigen Fassung“: Die Fassung bleibt in der Liste, gilt aber nicht mehr. */
async function zurueckZurVorigen(kennung) {
  const ordner = path.join(BAUSTEINE, kennung);
  const h = await herkunftVon(ordner);
  /* Über eine Umstellung auf den Bus-Vertrag hinweg: zurück vor die fachliche Fassung */
  const f = h?.fassungen.find(x => x.nr === fachlicheFassung(h));
  if (!f?.vorige) return false;
  h.aktuell = f.vorige;
  await schreibeHerkunft(ordner, h);
  return true;
}

/* Von Hand gespielte Drehbücher: Die Seite liefert die Daten, die Datei entsteht hier. */
async function behalteGespieltes(d) {
  const nummern = (await jsDateien(GESPIELT)).map(n => /gespielt-(\d+)/.exec(n)).filter(Boolean).map(m => Number(m[1]));
  const kennung = `gespielt-${String(Math.max(0, ...nummern) + 1).padStart(3, '0')}`;
  const name = `${kennung}.js`;
  const quelle = `/* Drehbuch: von Hand gespielt und behalten. */\nHuelle.drehbuch(${JSON.stringify({ kennung, ...d }, null, 2)});\n`;
  await fs.mkdir(GESPIELT, { recursive: true });
  await fs.writeFile(path.join(GESPIELT, name), quelle);
  /* Anweisung 49 (a): Jedes Szenario gehört ausdrücklich zu einer Teil-App, der offenen. */
  await merkeTeilApp(PROJEKT_ORDNER, 'gespielt', kennung, offeneTeilApp());
  return { kennung, name, quelle };
}

/* Eine kaputte Datei bricht das Lesen ab: Die Seite speichert dann nichts, statt sie zu überschreiben. */
async function sollergebnisse() {
  const namen = await fs.readdir(SOLL).catch(() => []);
  const out = {};
  for (const n of namen.filter(n => n.endsWith('.json')).sort()) {
    const { kennung, zuletzt, je } = JSON.parse(await lies(path.join(SOLL, n)));
    out[kennung] = { zuletzt, je };
  }
  return out;
}

const sollDatei = kennung => path.join(SOLL, `${kennung}.json`);

async function schreibeSollergebnis(kennung, e) {
  await fs.mkdir(SOLL, { recursive: true });
  await fs.writeFile(sollDatei(kennung), `${JSON.stringify({ kennung, zuletzt: e.zuletzt, je: e.je }, null, 2)}\n`);
}

/* ---------- Anhänge ----------
   Bildschirmfotos und Dateien verdeutlichen einen Wunsch. Die Seite schickt sie mit (Name und Inhalt
   als Base64); hier werden sie geprüft und im Eingang des Wunsches abgelegt. Eine Excel-Datei wird je
   Blatt zu einer CSV für die KI; das Original bleibt der Anhang. Beim Einspielen ziehen sie neben die
   Herkunft des Plugins (bzw. der Regel). Rückgabe von nimmAnhaenge: Liste oder { grund }. */
const ANHANG_SATZ = 'Anhängen lassen sich Bilder (png, jpg, gif, webp), PDF, Text, Markdown, CSV und Excel (.xlsx).';

function anhangName(name, belegt) {
  const roh = path.basename(String(name || 'anhang')).replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^[ .]+/, '').slice(-100) || 'anhang';
  const ext = path.extname(roh), stamm = roh.slice(0, roh.length - ext.length) || 'anhang';
  let kandidat = `${stamm}${ext}`;
  for (let n = 2; belegt.has(kandidat.toLowerCase()); n++) kandidat = `${stamm}-${n}${ext}`;
  belegt.add(kandidat.toLowerCase());
  return kandidat;
}

const groesse = n => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(n / 1024)} KB`;

async function nimmAnhaenge(eingang, liste, zur, bisher = []) {
  if (liste === undefined || liste === null) return [];
  if (!Array.isArray(liste)) return { grund: 'Die Anhänge sind nicht lesbar angekommen.' };
  if (bisher.length + liste.length > ANHANG_HOECHSTENS) return { grund: `Höchstens ${ANHANG_HOECHSTENS} Anhänge je Wunsch.` };
  const dateien = [];
  let summe = bisher.reduce((s, x) => s + x.groesse, 0);
  for (const x of liste) {
    const ext = path.extname(String(x?.name || '')).toLowerCase();
    if (!ANHANG_ARTEN[ext]) return { grund: `„${x?.name}“ lässt sich nicht anhängen. ${ANHANG_SATZ}` };
    const inhalt = Buffer.from(String(x.daten || ''), 'base64');
    if (inhalt.length > ANHANG_JE_DATEI) return { grund: `„${x.name}“ ist zu groß (${groesse(inhalt.length)}); je Datei gehen höchstens ${groesse(ANHANG_JE_DATEI)}.` };
    summe += inhalt.length;
    if (summe > ANHANG_JE_WUNSCH) return { grund: `Zusammen sind die Anhänge zu groß; je Wunsch gehen höchstens ${groesse(ANHANG_JE_WUNSCH)}.` };
    let blaetter = null;
    if (ext === '.xlsx') {
      try { blaetter = xlsxZuCsv(inhalt); } catch (e) { return { grund: `Die Excel-Datei „${x.name}“ lässt sich nicht lesen (${e.message}).` }; }
    }
    dateien.push({ name: x.name, ext, inhalt, blaetter });
  }
  const ordner = path.join(ANHANG_EINGANG, eingang);
  /* Ein neuer Wunsch beginnt leer; ein Rest aus einer früheren Sitzung mit derselben Nummer gehört nicht dazu. */
  if (zur === 'wunsch') await fs.rm(ordner, { recursive: true, force: true });
  await fs.mkdir(path.join(ordner, 'fuer-ki'), { recursive: true });
  const belegt = new Set((await fs.readdir(ordner)).map(n => n.toLowerCase()));
  const out = [];
  for (const d of dateien) {
    const name = anhangName(d.name, belegt);
    await fs.writeFile(path.join(ordner, name), d.inhalt);
    const a = { name, typ: d.ext.slice(1), groesse: d.inhalt.length, zur, datei: path.join(ordner, name), fuerKi: [] };
    if (d.blaetter) {
      for (const b of d.blaetter) {
        const csv = `${name.replace(/\.xlsx$/i, '')}.${String(b.blatt).replace(/[^\p{L}\p{N}_ -]+/gu, '_')}.csv`;
        await fs.writeFile(path.join(ordner, 'fuer-ki', csv), b.csv);
        a.fuerKi.push({ datei: path.join(ordner, 'fuer-ki', csv), blatt: b.blatt });
      }
    } else {
      a.fuerKi.push({ datei: a.datei });
    }
    out.push(a);
  }
  return out;
}

/* Alle Anhänge eines Auftrags: zum Wunsch und zu Antworten auf Rückfragen */
const alleAnhaenge = a => [...(a.anhaenge || []), ...(a.dialog || []).flatMap(d => d.anhaenge || [])];

/* Wie Anhänge in der Herkunft stehen: Pfad relativ zum Ordner, in dem die Herkunft liegt */
const anhangHerkunft = (a, x) => ({ name: x.name, typ: x.typ, groesse: x.groesse, zur: x.zur, pfad: `anhaenge/${a.anhangVon}/${x.name}` });

function dialogHerkunft(a) {
  if (!a.dialog?.length) return undefined;
  return a.dialog.map(d => ({ rueckfrage: d.rueckfrage, teile: d.teile, antwort: d.antwort, soMachen: d.soMachen || undefined, datum: d.datum,
    anhaenge: d.anhaenge?.length ? d.anhaenge.map(x => anhangHerkunft(a, x)) : undefined }));
}

/* Legt die Anhänge neben eine Herkunft (Plugin-Ordner oder Regel-Ordner). */
async function legeAnhaengeAb(a, ordner) {
  if (!alleAnhaenge(a).length) return;
  await fs.cp(path.join(ANHANG_EINGANG, a.anhangVon), path.join(ordner, 'anhaenge', a.anhangVon), { recursive: true });
}

/* ---------- Regeln ----------
   Die Dateien rufen Huelle.regel({...}) auf. Hier werden sie nur gelesen, nicht geprüft:
   Was eine Regel sagt und wo sie gilt, für die KI; prüfen tut der Wächter in der Seite. */
async function regelDateien() {
  const out = [];
  for (const n of await jsDateien(REGELN)) out.push({ name: n, quelle: await lies(path.join(REGELN, n)) });
  return out;
}

function liesRegel(quelle) {
  const gefunden = [];
  vm.runInNewContext(quelle, { Huelle: { regel: r => gefunden.push(r) } }, { timeout: 1000 });
  return gefunden;
}

async function alleRegeln() {
  const out = [];
  for (const d of await regelDateien()) {
    try { out.push(...liesRegel(d.quelle)); } catch (e) { console.error(`Regel ${d.name}:`, e.message); }
  }
  return out;
}

/* Wie im Wächter: Die Regel gilt, wenn ihr Pfad auf dem Weg vom Played Flow nach oben liegt. */
const giltFuer = (regel, flow) => !!flow && (flow === regel.pfad || flow.startsWith(`${regel.pfad}/`));

/* Eine Regel aus einem Wunsch als Datei: Wortlaut und Herkunft legt die Brücke fest, nicht die KI. */
function regelQuelle(a, r, bisher) {
  const herkunft = {
    datum: new Date().toISOString().slice(0, 10),
    wie: bisher ? 'neue Fassung der Regel: „Regel ändern“ des PO, Wunsch im Wortlaut, gefasst von der inneren KI'
      : 'Wunsch des PO im Wortlaut, als Regel gefasst von der inneren KI',
    quelle: `Wunsch ${a.id} in der Play-Seite`,
    netz: bisher?.herkunft?.netz ?? null,
  };
  /* Die vorige Fassung bleibt in der Herkunft, ihr Quelltext liegt unter regeln/alt/. */
  if (bisher) herkunft.vorige = { satz: bisher.satz, wortlaut: bisher.wortlaut ?? null, herkunft: bisher.herkunft ?? null };
  /* Anhänge liegen unter regeln/anhaenge/<wunsch>/ */
  if (a.anhaenge?.length) herkunft.anhaenge = a.anhaenge.map(x => anhangHerkunft(a, x));
  if (a.dialog?.length) herkunft.rueckfragen = dialogHerkunft(a);
  const zeilen = [
    `kennung: ${JSON.stringify(r.kennung)}`,
    `pfad: ${JSON.stringify(bisher ? bisher.pfad : a.flow)}`,
    `satz: ${JSON.stringify(r.satz)}`,
    `wortlaut: ${JSON.stringify(a.text)}`,
    `herkunft: ${JSON.stringify(herkunft)}`,
    `art: ${JSON.stringify(r.art)}`,
  ];
  if (r.art === 'bedingung') zeilen.push(`pruefe: ${r.pruefe.trim()}`);
  return `/* Regel aus Wunsch ${a.id}. ${bisher ? 'Neue Fassung; Pfad wie bisher.' : 'Pfad ist der des Played Flows, auf dem der Wunsch gesagt wurde.'} */\nHuelle.regel({\n  ${zeilen.join(',\n  ')}\n});\n`;
}

/* ---------- Bewusst in Kauf genommen ----------
   Der Mensch entscheidet, die Maschine meldet: Ein Verstoß, den der PO bewusst in Kauf nimmt,
   bleibt sichtbar, hält aber keinen Probelauf mehr auf. Jede Entscheidung mit Datum und wie sie fiel.
   Kennung eines Verstoßes: Regel und betroffene Pfade (der Schlüssel des Wächters). */
async function inKauf() {
  const text = await fs.readFile(IN_KAUF, 'utf8').catch(() => null);
  return text ? JSON.parse(text) : [];
}

async function schreibeInKauf(liste) {
  await fs.mkdir(path.dirname(IN_KAUF), { recursive: true });
  await fs.writeFile(IN_KAUF, `${JSON.stringify(liste, null, 2)}\n`);
}

async function nimmInKauf(eintraege) {
  const liste = await inKauf();
  for (const e of eintraege) {
    if (typeof e.schluessel !== 'string' || !e.schluessel.includes('|')) continue;
    if (liste.some(x => x.schluessel === e.schluessel)) continue;
    liste.push({
      schluessel: e.schluessel, regel: String(e.regel || ''), satz: String(e.satz || ''),
      datum: new Date().toISOString(), wie: e.wie, wunsch: e.wunsch ?? null,
    });
  }
  await schreibeInKauf(liste);
}

/* Prüft eine mitgelieferte Regel mechanisch. Rückgabe: Mangel oder null; legt a.regel fest. */
async function pruefeRegel(a) {
  const r = a.antwort.regel;
  a.regel = null;
  if (a.regelZiel && r?.kennung !== a.regelZiel) return `Der Anforderer will die Regel "${a.regelZiel}" ändern; liefere sie in "regel" mit dieser Kennung als neue Fassung.`;
  if (!r) return null;
  if (a.art !== 'wunsch') return 'Eine Regel kommt nur aus einem Wunsch, nicht aus „Ändern“ oder „Stimmt nicht“. Lass "regel" null.';
  if (!a.flow) return 'Die Seite hat keinen Played Flow genannt; eine Regel lässt sich darum nicht anlegen. Lass "regel" null.';
  if (!KENNUNG.test(r.kennung || '')) return 'Die Kennung einer Regel besteht nur aus Kleinbuchstaben, Ziffern und Bindestrichen.';
  let bisher = null, alteDatei = null;
  if (a.regelZiel) {
    for (const d of await regelDateien()) {
      let gefunden = [];
      try { gefunden = liesRegel(d.quelle); } catch { /* übergehen */ }
      const x = gefunden.find(g => g.kennung === a.regelZiel);
      if (x) { bisher = x; alteDatei = d; }
    }
    if (!bisher) return `Eine Regel "${a.regelZiel}" gibt es nicht.`;
  } else {
    const vergeben = new Set([...(await jsDateien(REGELN)).map(n => n.replace(/\.js$/, '')), ...(await alleRegeln()).map(x => x.kennung)]);
    if (vergeben.has(r.kennung)) return `Eine Regel "${r.kennung}" gibt es schon. Wähle eine neue Kennung.`;
  }
  if (!String(r.satz || '').trim()) return 'Eine Regel braucht einen Satz in Fachsprache.';
  if (r.art === 'bedingung') {
    if (!r.pruefe) return 'Eine Regel der Art "bedingung" braucht "pruefe" als Quelltext einer Funktion function (h) { ... }.';
    let fn;
    try { fn = vm.runInNewContext(`(${r.pruefe})`, {}, { timeout: 1000 }); } catch (e) { return `"pruefe" lässt sich nicht lesen: ${e.message}`; }
    if (typeof fn !== 'function') return '"pruefe" ist keine Funktion.';
  } else if (r.pruefe) {
    return `Eine Regel der Art "${r.art}" hat kein "pruefe"; lass es null.`;
  }
  const quelle = regelQuelle(a, r, bisher);
  try {
    if (liesRegel(quelle).length !== 1) throw new Error('keine Regel');
  } catch (e) { return `Die Regel lässt sich nicht anlegen: ${e.message}`; }
  a.regel = { kennung: r.kennung, satz: r.satz.trim(), art: r.art, name: alteDatei ? alteDatei.name : `${r.kennung}.js`, quelle, alt: alteDatei };
  return null;
}

/* ---------- Innere KI ---------- */
/* Anweisung 38: Eine Regel geht mit, wenn sie ein Fachobjekt der Auswahl liest; eine Regel, der man das nicht ansieht
   (nur als Satz), geht immer mit. Was eine Regel bricht, meldet ohnehin der Wächter im Probelauf. */
function regelBetrifft(r, auswahl) {
  if (!auswahl?.wurzeln) return true;
  const w = [...zugriffeImQuelltext(String(r.pruefe ?? '')).keys()].filter(x => x !== 'bus');
  return !w.length || w.some(x => auswahl.wurzeln.has(x));
}

async function abschnittRegeln(flow, auswahl = null) {
  const alle = (await alleRegeln()).filter(r => giltFuer(r, flow));
  const gelten = alle.filter(r => regelBetrifft(r, auswahl));
  if (!alle.length) return `## Regeln, die gelten\n\nFür diesen Played Flow gilt noch keine Regel.`;
  if (!gelten.length) return `## Regeln, die gelten\n\nKeine der geltenden Regeln betrifft die Angaben dieses Wunsches. Der Wächter prüft im Probelauf trotzdem alle.`;
  const teile = gelten.map(r => {
    const art = { bedingung: 'Bedingung', ki: 'nur als Satz', 'nicht-zeigbar': 'lässt sich im Prototyp nicht zeigen' }[r.art] || r.art;
    const kopf = `### Regel \`${r.kennung}\` (${art})\n\n${r.satz}`;
    return r.art === 'bedingung' && r.pruefe ? `${kopf}\n\n\`\`\`js\npruefe: ${r.pruefe.toString()}\n\`\`\`` : kopf;
  });
  return `## Regeln, die gelten (Played Flow \`${flow}\` und darüber)\n\nKein Plugin darf eine davon brechen. Nach deiner Antwort prüft die Seite alle Drehbücher im Probelauf gegen diese Regeln.\n\n${teile.join('\n\n')}`;
}

/* Anweisung 38: Volltext nur für die Plugins, die der Auftrag ändert; von den übrigen, die dieselben Angaben anfassen,
   je eine Zeile mit ihren Nachrichten. Kein fremder Code. */
async function abschnittPlugins(auswahl) {
  /* Ohne Vorauswahl (Prototyp einer neuen Teil-App): jedes Plugin, das etwas ändert, als Zeile, keins im Volltext. */
  if (!auswahl) {
    const je = await angabenJePlugin();
    auswahl = { alle: true, je, volltext: new Set(), zeilen: new Set([...je].filter(([, x]) => !x.bekannt || [...x.angaben.values()].includes('aendert')).map(([k]) => k)) };
  }
  const aus = await ausgeschaltet();
  const grund = (await jsDateien(GRUND)).map(n => n.replace(/\.js$/, ''));
  const bausteine = (await bausteineIn(BAUSTEINE)).map(b => b.kennung).filter(k => !grund.includes(k));
  const voll = [], zeilen = [];
  for (const k of [...grund, ...bausteine]) {
    if (aus.includes(k)) continue;
    if (auswahl.volltext.has(k)) {
      const quelle = await aktuelleQuelle(k);
      if (quelle) voll.push(volltextVon(k, quelle, grund.includes(k)));
    } else if (auswahl.zeilen.has(k)) {
      const info = auswahl.je.get(k);
      if (info) zeilen.push(nachrichtenZeile(k, info));
    }
  }
  const teile = ['## Vorhandene Plugins'];
  if (voll.length) teile.push(`### Im Volltext: was dieser Auftrag ändert\n\n${voll.join('\n\n')}`);
  teile.push(`### Weitere Plugins, die dieselben Angaben ändern\n\nJe Plugin: worauf es hört, was es sendet, welche Angaben es ändert und was es zeichnet. Ihren Code bekommst du nicht; sie sprechen nur über diese Nachrichten. Willst du eines davon ändern, nenne seine Kennung in \`volltext\` und lass alles andere leer; dann bekommst du es im Volltext. Plugins, die diese Angaben nur lesen oder gar nicht anfassen, stehen hier nicht; ob sie mit deiner Änderung klarkommen, zeigt der Probelauf.\n\n${zeilen.join('\n') || 'Keine.'}`);
  return teile.join('\n\n');
}
function volltextVon(k, quelle, istGrundPlugin) {
  return `#### Plugin \`${k}\`${istGrundPlugin ? ' (Grundausstattung)' : ''}\n\n\`\`\`js\n${quelle}\n\`\`\``;
}

/* Anweisung 43 (a): Je Plugin nur die Szenarien, in denen es beim letzten Abspielen etwas geändert (gearbeitet.json) oder auf
   eine Bedienung geantwortet hat (gespeicherter Stand). Arbeitet es in keinem davon, etwa weil es nur zeichnet, geht ein
   einziges Szenario als Beispiel mit, in dem es gearbeitet hat. So wächst das nicht mit der Zahl der Szenarien. */
async function szenarienVon(plugins) {
  const gearbeitet = JSON.parse(await fs.readFile(GEARBEITET, 'utf8').catch(() => '{}'));
  const ist = JSON.parse(await fs.readFile(STAND_SPEICHER, 'utf8').catch(() => '{}'))?.ergebnis?.ist ?? {};
  /* Nur Szenarien, die es gibt: Die Aufzeichnung kann ein gelöschtes noch nennen. */
  const da = [...(await szenarienQuellen()).keys()].sort();
  const out = new Set();
  const quellen = await szenarienQuellen();
  for (const k of plugins) {
    const gearbeitetIn = da.filter(s => (gearbeitet[s]?.plugins || []).includes(k));
    const wirkt = gearbeitetIn.filter(s => Object.values(gearbeitet[s].zugriffe?.[k] ?? {}).includes('aendert') || (ist[s]?.bedient ?? []).includes(k));
    if (wirkt.length) jeEreignisEins(wirkt, quellen, (await aktuelleQuelle(k)) ?? '').forEach(s => out.add(s));
    /* Sonst ein Beispiel, in dem es gearbeitet hat; ist es nirgends mitgeschrieben, das erste Szenario des Projekts. */
    else if (gearbeitetIn.length || da.length) out.add(gearbeitetIn[0] ?? da[0]);
  }
  return out;
}
/* Anweisung 45 (c): Von den Szenarien, in denen ein Plugin wirkt, höchstens drei, je Ereignis, auf das es reagiert, eines.
   Das Ereignis eines Szenarios: das erste darin, auf das das Plugin hört (sein Abonnement, fester Pfad); sonst das, das seine
   Bedienung auslöst (gleiche Aktion); sonst das erste Ereignis des Szenarios. Häufigere Ereignisse zuerst. */
const SZENARIEN_JE_PLUGIN = 3;
function ereignisseIn(quelle) {
  return [...quelle.matchAll(/["']?objekt["']?\s*:\s*["']([a-z][\w-]*)\/([^"']+)["'][\s\S]{0,200}?["']?aktion["']?\s*:\s*["']([\wäöüß-]+)["']/g)]
    .map(m => ({ bereich: m[1], id: m[2], aktion: m[3] }));
}
function passt(muster, e) {
  const m = /^([a-z*][\w*-]*)\/([^.]+)\.(.+)$/.exec(muster);
  if (!m) return false;
  const glied = (x, y) => x === '*' || x === y;
  return glied(m[1], e.bereich) && glied(m[2], e.id) && glied(m[3], e.aktion);
}
function jeEreignisEins(szenarien, quellen, pluginQuelle) {
  const { hoert } = nachrichtenVon(pluginQuelle);
  const aktionen = new Set([...pluginQuelle.matchAll(/aktion\s*:\s*["'`]([\wäöüß-]+)["'`]/g)].map(m => m[1]));
  const gruppen = new Map();
  for (const s of szenarien) {
    const ereignisse = ereignisseIn(quellen.get(s)?.quelle ?? '');
    const e = ereignisse.find(x => hoert.some(h => passt(h, x))) ?? ereignisse.find(x => aktionen.has(x.aktion)) ?? ereignisse[0];
    const schluessel = e ? `${e.bereich}/*.${e.aktion}` : '–';
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(s);
  }
  return [...gruppen.values()].sort((x, y) => y.length - x.length).slice(0, SZENARIEN_JE_PLUGIN).map(g => g[0]);
}
/* Quelltext aller Szenarien je Kennung; die Kennung steht im Szenario selbst. */
async function szenarienQuellen() {
  const out = new Map();
  const nimm = (titel, quelle) => { const m = /kennung\s*:\s*["']([^"']+)["']/.exec(quelle); if (m && !out.has(m[1])) out.set(m[1], { titel, quelle }); };
  for (const n of await jsDateien(path.join(PROJEKT_ORDNER, 'drehbuecher'))) nimm(`drehbuecher/${n}`, await lies(path.join(PROJEKT_ORDNER, 'drehbuecher', n)));
  for (const b of await bausteineIn(BAUSTEINE)) for (const d of b.dateien.filter(x => x.name.endsWith('.drehbuch.js'))) nimm(`Drehbuch zu \`${b.kennung}\`: ${d.name}`, d.quelle);
  for (const n of await jsDateien(GESPIELT)) nimm(`von Hand gespielt: ${n}`, await lies(path.join(GESPIELT, n)));
  return out;
}
/* Gibt die Szenarien aus, die der Auftrag noch nicht hat, und merkt sie sich. */
async function szenarienText(a, kennungen) {
  const quellen = await szenarienQuellen(), alle = await alleDrehbuecher();
  const neu = [...kennungen].filter(k => quellen.has(k) && !a.szenarienGegeben.has(k));
  neu.forEach(k => a.szenarienGegeben.add(k));
  const teile = neu.map(k => `### ${quellen.get(k).titel}\n\n\`\`\`js\n${quellen.get(k).quelle}\n\`\`\``);
  const geaendert = neu.flatMap(k => Object.entries(alle[k]?.geaendert ?? {}).map(([nr, e]) => `- \`${k}\`, nr ${nr}: gilt jetzt ${JSON.stringify(e)}`));
  if (geaendert.length) teile.push(`### Erwartungen, die frühere Änderungen ersetzt haben (gelten statt der Stelle im Quelltext)\n\n${geaendert.join('\n')}`);
  return teile.join('\n\n');
}

/* Anweisung 38: Szenarien, die im Probelauf anders endeten und die der Auftrag noch nicht hatte (Kennungen von der Seite). */
async function abweichendeSzenarien(a, kennungen) {
  if (!a.szenarienGegeben || !Array.isArray(kennungen)) return '';
  const text = await szenarienText(a, kennungen.filter(k => typeof k === 'string' && /^[a-z0-9-]+$/.test(k)));
  return text ? `\n\nDiese Szenarien kanntest du noch nicht:\n\n${text}` : '';
}

async function abschnittDrehbuecher(a) {
  const gesamt = (await szenarienQuellen()).size;
  const text = await szenarienText(a, await szenarienVon(a.auswahl.volltext));
  const kopf = `## Vorhandene Szenarien\n\nHier stehen nur die Szenarien, in denen ein Plugin im Volltext beim letzten Abspielen etwas geändert oder auf eine Bedienung geantwortet hat, je Plugin höchstens drei, je Ereignis, auf das es reagiert, eines; für ein Plugin, das nur zeichnet, ein einziges als Beispiel (${a.szenarienGegeben.size} von ${gesamt}). Der Probelauf spielt die übrigen trotzdem; endet eins anders, bekommst du es mit dem Ergebnis.`;
  return text ? `${kopf}\n\n${text}` : kopf;
}

/* ---------- Erwartungen ----------
   Alle Drehbücher, die gerade gelten, mit ihren Erwartungen, wie sie gerade gelten: Quelltext
   plus geänderte Erwartungen aus eingeschalteten Fassungen. Nur gelesen, nie ausgeführt außer
   den Aufrufen Huelle.drehbuch und Huelle.erwartung. */
async function alleDrehbuecher() {
  const quellen = [];
  for (const n of await jsDateien(path.join(PROJEKT_ORDNER, 'drehbuecher'))) quellen.push(await lies(path.join(PROJEKT_ORDNER, 'drehbuecher', n)));
  const ersetzt = [];
  for (const w of await gespeicherteWuensche()) {
    if (w.name.endsWith('.erwartungen.js')) ersetzt.push(w.quelle);
    else if (w.name.endsWith('.drehbuch.js') || /^gespielt-\d+\.js$/.test(w.name)) quellen.push(w.quelle);
  }
  const out = {};
  const stub = {
    drehbuch: d => { out[d.kennung] = { kennung: d.kennung, titel: d.titel, erwartet: d.erwartet || [], geaendert: {} }; },
    erwartung: e => { const d = out[e.drehbuch]; if (d && e.nr < d.erwartet.length) { d.erwartet[e.nr] = e.neu; d.geaendert[e.nr] = e.neu; } },
  };
  for (const q of quellen.concat(ersetzt)) {
    try { vm.runInNewContext(q, { Huelle: stub }, { timeout: 1000 }); } catch (e) { console.error('Drehbuch lesen:', e.message); }
  }
  return out;
}

/* Prüft geänderte Erwartungen mechanisch und legt die Datei dazu fest. Rückgabe: Mangel oder null. */
async function pruefeErwartungen(a) {
  const liste = a.antwort.erwartungen || [];
  a.erwartungen = null;
  if (!liste.length) return null;
  if (a.antwort.art === 'nur-regel') return 'Eine reine Regel ändert keine Erwartungen in Drehbüchern; lass "erwartungen" leer.';
  const drehbuecher = await alleDrehbuecher();
  const gesehen = new Set();
  const out = [];
  for (const [i, e] of liste.entries()) {
    const d = drehbuecher[e.drehbuch];
    if (!d) return `Erwartung ${i + 1}: Ein Drehbuch "${e.drehbuch}" gibt es nicht.`;
    if (!Number.isInteger(e.nr) || e.nr < 0 || e.nr >= d.erwartet.length) return `Erwartung ${i + 1}: Das Drehbuch "${e.drehbuch}" hat keine Erwartung an Stelle ${e.nr} (Stellen 0 bis ${d.erwartet.length - 1}).`;
    if (gesehen.has(`${e.drehbuch}#${e.nr}`)) return `Erwartung ${i + 1}: Stelle ${e.nr} in "${e.drehbuch}" steht doppelt.`;
    gesehen.add(`${e.drehbuch}#${e.nr}`);
    let neu;
    try { neu = JSON.parse(e.neu); } catch { return `Erwartung ${i + 1}: "neu" ist kein gültiges JSON.`; }
    if (!neu || typeof neu.text !== 'string' || !Array.isArray(neu.pruefe) || !neu.pruefe.length) return `Erwartung ${i + 1}: "neu" braucht "text" und eine nicht leere Liste "pruefe".`;
    const alt = d.erwartet[e.nr];
    if (alt.bei && JSON.stringify(neu.bei || null) !== JSON.stringify(alt.bei)) return `Erwartung ${i + 1}: "bei" bleibt, wie es war.`;
    if (JSON.stringify(neu) === JSON.stringify(alt)) return `Erwartung ${i + 1}: Sie ist unverändert; lass sie weg.`;
    if (!String(e.satz || '').trim()) return `Erwartung ${i + 1}: Es fehlt der Satz für den Anforderer.`;
    out.push({ drehbuch: e.drehbuch, titel: d.titel, nr: e.nr, alt, neu, satz: e.satz.trim() });
  }
  const aufrufe = out.map(e => `Huelle.erwartung(${JSON.stringify({ drehbuch: e.drehbuch, nr: e.nr, satz: e.satz, alt: e.alt, neu: e.neu }, null, 2)});`);
  a.erwartungen = { liste: out, name: `${a.id}.erwartungen.js`, quelle: `/* Erwartungen, die ${a.id} bewusst ändert. Die alte steht unter „alt“. */\n${aufrufe.join('\n')}\n` };
  return null;
}

/* ---------- Grunddaten aus einem Wunsch (Anweisung 34) ----------
   Ein Wunsch ist die Entscheidung des PO; steht ihm etwas in den Grunddaten entgegen, ändert die KI es mit. Jede
   Änderung sitzt an einem festen Pfad, liegt mit dem Wunsch in GRUNDDATEN und geht mit „Zurücknehmen“ wieder weg. */
const GRUNDDATEN_WURZELN = new Set(['arten', 'objekte']);
async function grunddatenListe() { return JSON.parse(await fs.readFile(GRUNDDATEN, 'utf8').catch(() => '[]')); }
function grunddatenQuelle(liste) {
  return `Huelle.grunddaten(${JSON.stringify(liste.map(e => ({ pfad: e.pfad, wert: e.neu })))});\n`;
}
function setzeAm(baum, teile, wert) {
  const eltern = teile.slice(0, -1).reduce((o, t) => o?.[t], baum);
  eltern[teile[teile.length - 1]] = wert;
}
/* Die Grunddaten des offenen Projekts, wie sie gerade gelten */
async function geltendeGrunddaten() {
  let tag = null;
  const Huelle = { daten(d) { if (tag) Object.assign(tag.objekte, d.objekte); else tag = d; } };
  const ordner = path.join(PROJEKT_ORDNER, 'daten');
  for (const n of await jsDateien(ordner)) vm.runInNewContext(await lies(path.join(ordner, n)), { Huelle });
  tag ||= { objekte: {} };
  for (const e of await grunddatenListe()) setzeAm(tag, e.pfad.split('/'), e.neu);
  return tag;
}
async function pruefeGrunddaten(a) {
  const x = a.antwort;
  a.grunddaten = null;
  const liste = x.grunddaten || [];
  if (x.art === 'nur-daten' && !liste.length) return 'Zu art "nur-daten" gehört mindestens eine Änderung in "grunddaten".';
  if (!liste.length) return null;
  const tag = await geltendeGrunddaten();
  const eintraege = [];
  for (const [i, e] of liste.entries()) {
    const teile = String(e.pfad || '').split('/');
    const wo = `Grunddaten ${i + 1} ("${e.pfad}")`;
    if (!GRUNDDATEN_WURZELN.has(teile[0]) || teile.length < 2 || teile.some(t => !t || t === '__proto__' || t === 'constructor' || t === 'prototype')) return `${wo}: Der Pfad beginnt mit "arten/" oder "objekte/" und besteht aus festen Kennungen.`;
    const eltern = teile.slice(0, -1).reduce((o, t) => o?.[t], tag);
    if (!eltern || typeof eltern !== 'object') return `${wo}: Diesen Pfad gibt es in den Daten nicht.`;
    const alt = eltern[teile[teile.length - 1]];
    if (typeof alt === 'function') return `${wo}: Dort steht eine Rechenvorschrift; sie lässt sich so nicht ändern. Löse das in einem Plugin.`;
    let neu;
    try { neu = JSON.parse(e.neu); } catch { return `${wo}: "neu" ist kein gültiges JSON.`; }
    if (JSON.stringify(neu) === JSON.stringify(alt)) return `${wo}: Der Wert ist unverändert; lass ihn weg.`;
    if (!String(e.satz || '').trim()) return `${wo}: Es fehlt der Satz für den Anforderer.`;
    setzeAm(tag, teile, neu);
    eintraege.push({ pfad: e.pfad, alt: alt === undefined ? null : alt, neu, satz: e.satz.trim() });
  }
  a.grunddaten = { liste: eintraege, name: `${a.id}.grunddaten.js`, quelle: grunddatenQuelle(eintraege) };
  /* Der Satz gehört zum Ergebnis: Er steht im Fertig-Hinweis, an der Fassung und im Navigator. */
  for (const e of eintraege) if (!x.kurz.includes(e.satz)) x.kurz = `${x.kurz} ${e.satz}`.trim();
  return null;
}
async function behalteGrunddaten(a, datum) {
  if (a.grunddaten) {
    const ablage = path.dirname(GRUNDDATEN);
    await fs.mkdir(ablage, { recursive: true });
    /* Eine reine Datenänderung hat keinen Plugin-Ordner; ihre geänderten Erwartungen liegen darum bei den Entscheidungen. */
    const ohnePlugin = a.ergebnis.art === 'nur-daten' && a.erwartungen;
    if (ohnePlugin) await fs.writeFile(path.join(ablage, a.erwartungen.name), a.erwartungen.quelle);
    const dazu = a.grunddaten.liste.map(e => ({ ...e, unbestaetigt: true, wunsch: a.id, teilApp: teilAppAusserHeimat(), wortlaut: a.text, datum, erwartungen: ohnePlugin ? a.erwartungen.name : undefined,
      geaenderteErwartungen: ohnePlugin ? a.erwartungen.liste.map(w => ({ drehbuch: w.drehbuch, nr: w.nr, satz: w.satz, alt: w.alt, neu: w.neu })) : undefined }));
    await fs.writeFile(GRUNDDATEN, `${JSON.stringify([...await grunddatenListe(), ...dazu], null, 2)}\n`);
  }
  const bekannt = new Set(JSON.parse(await fs.readFile(GRUNDFUNKTIONEN, 'utf8').catch(() => '[]')).map(g => g.kennung));
  const beruehrt = [...new Set(a.antwort.grundfunktionen || [])].filter(k => bekannt.has(k));
  if (beruehrt.length) {
    await fs.mkdir(path.dirname(GRUNDSTOCK_GEAENDERT), { recursive: true });
    const bisher = JSON.parse(await fs.readFile(GRUNDSTOCK_GEAENDERT, 'utf8').catch(() => '[]'));
    await fs.writeFile(GRUNDSTOCK_GEAENDERT, `${JSON.stringify([...bisher, ...beruehrt.map(kennung => ({ kennung, wunsch: a.id, wortlaut: a.text, datum }))], null, 2)}\n`);
  }
}
async function nimmGrunddatenZurueck(a) {
  const liste = await grunddatenListe();
  const rest = liste.filter(e => e.wunsch !== a.id);
  if (rest.length !== liste.length) await fs.writeFile(GRUNDDATEN, `${JSON.stringify(rest, null, 2)}\n`);
  if (a.ergebnis.art === 'nur-daten' && a.erwartungen) await fs.rm(path.join(path.dirname(GRUNDDATEN), a.erwartungen.name), { force: true });
  const geaendert = JSON.parse(await fs.readFile(GRUNDSTOCK_GEAENDERT, 'utf8').catch(() => '[]'));
  const bleibt = geaendert.filter(e => e.wunsch !== a.id);
  if (bleibt.length !== geaendert.length) await fs.writeFile(GRUNDSTOCK_GEAENDERT, `${JSON.stringify(bleibt, null, 2)}\n`);
}

/* ---------- Ein Wunsch bleibt offen, bis der PO entscheidet (Anweisung 33) ---------- */
async function unbestaetigte() { return JSON.parse(await fs.readFile(UNBESTAETIGT, 'utf8').catch(() => '[]')); }
async function schreibeUnbestaetigte(liste) {
  await fs.mkdir(path.dirname(UNBESTAETIGT), { recursive: true });
  await fs.writeFile(UNBESTAETIGT, `${JSON.stringify(liste, null, 2)}\n`);
}
async function merkeUnbestaetigt(a) {
  const e = {
    id: a.id, art: a.art, status: 'behalten', text: a.text, teil: a.teil ?? null, datum: new Date().toISOString(),
    antwort: { art: a.antwort.art, kurz: a.antwort.kurz, zeigen: a.antwort.zeigen ?? null },
    ergebnis: { art: a.ergebnis.art, kennung: a.ergebnis.kennung }, fassung: a.fassung ?? null,
    regel: a.regel ? { kennung: a.regel.kennung, satz: a.regel.satz, art: a.regel.art, name: a.regel.name, alt: a.regel.alt ? { quelle: a.regel.alt.quelle } : undefined } : null,
    erwartungen: a.erwartungen ? { name: a.erwartungen.name, liste: a.erwartungen.liste.map(w => ({ titel: w.titel, satz: w.satz })) } : null,
    grunddaten: a.grunddaten ? { liste: a.grunddaten.liste.map(w => ({ satz: w.satz })) } : null,
    ueberstimmt: a.ueberstimmt ?? [],
    ungeprueft: a.ungeprueft || undefined,
  };
  await schreibeUnbestaetigte([...(await unbestaetigte()).filter(x => x.id !== a.id), e]);
}
/* Für die Seite: dieselbe Form wie sicht(a) */
const offeneSicht = (e) => ({ ...e, erwartungen: e.erwartungen ? e.erwartungen.liste : [], grunddaten: e.grunddaten ? e.grunddaten.liste.map(w => w.satz) : null, ueberstimmt: e.ueberstimmt.length });
async function vergissUnbestaetigt(id) {
  const liste = await unbestaetigte();
  const rest = liste.filter(x => x.id !== id);
  if (rest.length !== liste.length) await schreibeUnbestaetigte(rest);
}
/* Hat ein späterer Wunsch dasselbe Plugin weiter geändert, ginge sonst dessen Stand mit verloren. */
async function neuererStandAmPlugin(a) {
  if (a.status !== 'behalten' || !a.ergebnis?.kennung || !a.fassung) return false;
  const h = await herkunftVon(path.join(BAUSTEINE, a.ergebnis.kennung));
  return !!h && h.aktuell !== a.fassung;
}
async function bestaetigeWunsch(a) {
  const datum = new Date().toISOString();
  if (a.ergebnis?.kennung && a.fassung) {
    const ordner = path.join(BAUSTEINE, a.ergebnis.kennung);
    const h = await herkunftVon(ordner);
    const f = h?.fassungen.find(x => x.nr === a.fassung);
    if (f) { delete f.unbestaetigt; f.bestaetigt = { datum, wie: 'vom PO mit „Bestätigen“' }; await schreibeHerkunft(ordner, h); }
  }
  const grund = await grunddatenListe();
  if (grund.some(e => e.wunsch === a.id)) {
    await fs.writeFile(GRUNDDATEN, `${JSON.stringify(grund.map(e => { if (e.wunsch !== a.id) return e; const { unbestaetigt, ...rest } = e; return { ...rest, bestaetigt: datum }; }), null, 2)}\n`);
  }
  await vergissUnbestaetigt(a.id);
}

/* Anweisung 34 (c): Was der PO früher entschieden hat, im Wortlaut und mit Datum, damit die KI einen Widerspruch benennen kann. */
async function abschnittEntscheidungen(auswahl = null) {
  const tag = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'ohne Datum';
  const aus = await ausgeschaltet();
  const zeilen = [], fremdeWuensche = new Set();
  for (const b of await bausteineIn(BAUSTEINE)) {
    /* Anweisung 43 (b): frühere Wünsche nur zu den Plugins im Volltext */
    if (auswahl && !auswahl.volltext.has(b.kennung)) { for (const w of b.wuensche || []) fremdeWuensche.add(w.kennung); continue; }
    if (aus.includes(b.kennung)) continue;
    for (const w of b.wuensche || []) if (w.wortlaut) zeilen.push(`- ${tag(w.datum)}, Wunsch zu \`${b.kennung}\`: „${w.wortlaut}“`);
  }
  for (const k of await inKauf()) if (!fremdeWuensche.has(k.wunsch)) zeilen.push(`- ${tag(k.datum)}, bewusst in Kauf genommen: „${k.satz}“`);
  for (const g of await grundfunktionenFuer(auswahl)) {
    if (g.quelle?.art === 'wortlaut') zeilen.push(`- ${g.quelle.datum}, zur Grundfunktion \`${g.kennung}\`: „${g.quelle.wortlaut}“`);
  }
  return `## Frühere Entscheidungen des Anforderers\n\n${zeilen.join('\n') || 'Noch keine.'}`;
}
/* Anweisung 38: nur die Grundfunktionen, die die Vorauswahl dem Wunsch zugeordnet hat; ohne Vorauswahl alle. */
async function grundfunktionenFuer(auswahl) {
  const liste = JSON.parse(await fs.readFile(GRUNDFUNKTIONEN, 'utf8').catch(() => '[]'));
  if (!auswahl || auswahl.alle || !auswahl.grundfunktionen) return liste;
  return liste.filter(g => auswahl.grundfunktionen.has(g.kennung));
}
async function abschnittGrundfunktionen(auswahl = null) {
  const liste = await grundfunktionenFuer(auswahl);
  return liste.length ? `## Grundfunktionen\n\n${liste.map(g => `- \`${g.kennung}\`: ${g.satz}`).join('\n')}` : '';
}

/* Was die KI über genau diese Nutzapp wissen muss (anleitung.md im Projektordner); die Dispo hat keine eigene. */
function projektAnleitung() {
  /* Entscheidung 8: Die KI antwortet in der Sprache des Projekts. */
  const sprache = englisch() ? '\n\nThe language of this project is English. Everything a person reads is in English, and so are comments, names and identifiers in plugins.'
    : `\n\nDie Sprache dieses Projekts ist ${liesProjektJson(PROJEKT_ORDNER)?.sprache || 'Deutsch'}. Alles, was ein Mensch liest, steht in dieser Sprache.`;
  try { return `${sprache}\n\n${readFileSync(path.join(PROJEKT_ORDNER, 'anleitung.md'), 'utf8')}`; } catch { return sprache; }
}

/* Welche Teil-App offen ist und was zu ihr gehört. Die Seite lädt das vor der Hülle. */
const teilAppJe = new Map();
/* Anweisung 46: „Prototyp beginnen“ öffnet sofort die neue, leere Teil-App: { projekt, bereich, name }. Nur im Speicher;
   bricht der PO ab, bevor er etwas abschickt, bleibt im Projekt alles, wie es war. */
let leerOffen = null;
function heimatVon(j) { const a = teilApps(j?.bereiche); return a.find(b => b.prototyp)?.kennung ?? a[0]?.kennung ?? null; }
/* Anweisung 44: die offene Teil-App, wenn sie nicht die Heimat ist; sonst undefined (dann gehört alles zur Heimat). */
function teilAppAusserHeimat() { const o = offeneTeilApp(); return o && o !== heimatVon(liesProjektJson(PROJEKT_ORDNER)) ? o : undefined; }
/* Die leer geöffnete Teil-App, solange sie noch keinen Prototyp hat; sonst null. */
function leerJetzt() {
  if (!leerOffen || leerOffen.projekt !== PROJEKT) return null;
  const b = teilApps(liesProjektJson(PROJEKT_ORDNER)?.bereiche).find(x => x.kennung === leerOffen.bereich);
  if (!b || b.prototyp) { leerOffen = null; return null; }
  return { bereich: b.kennung, name: b.name };
}
function offeneTeilApp() {
  const leer = leerJetzt();
  if (leer) return leer.bereich;
  const j = liesProjektJson(PROJEKT_ORDNER), w = teilAppJe.get(PROJEKT);
  return teilApps(j?.bereiche).some(b => b.kennung === w && b.prototyp) ? w : heimatVon(j);
}
/* Anweisung 49 (a): Grundausstattung, Szenarien aus dem Manifest, von Hand gespielte Szenarien und Regeln je mit ihrer Teil-App. */
async function zuordnung() { return JSON.parse(await fs.readFile(path.join(PROJEKT_ORDNER, 'entscheidungen', 'teilapps.json'), 'utf8').catch(() => '{}')); }
async function teilAppStand() {
  const j = liesProjektJson(PROJEKT_ORDNER), heimat = heimatVon(j), offen = offeneTeilApp(), z = await zuordnung();
  const plugins = { ...(z.plugins || {}) }, drehbuecher = { ...(z.szenarien || {}), ...(z.gespielt || {}) };
  for (const b of await bausteineIn(BAUSTEINE)) {
    if (!b.teilApp) continue;
    plugins[b.kennung] = b.teilApp;
    for (const f of b.fassungen || []) if (f.drehbuch) drehbuecher[f.drehbuch] = b.teilApp;
  }
  const daten = (await fs.readdir(path.join(PROJEKT_ORDNER, 'daten', 'bereiche')).catch(() => [])).filter(n => n.endsWith('.js')).sort().map(n => `daten/bereiche/${n}`);
  const a = teilApps(j?.bereiche).find(b => b.kennung === offen), leer = !!leerJetzt();
  const namen = Object.fromEntries(teilApps(j?.bereiche).map(b => [b.kennung, b.name]));
  /* Anweisung 49 (b, c): wem welches Fachobjekt gehört und was eine Teil-App über eine Naht weitergibt */
  const besitz = {}, naehte = [];
  for (const x of flacheBereiche(j?.bereiche)) {
    if (!x.kinder) for (const f of x.fachobjekte || []) besitz[f] ??= x.kennung;
    for (const n of x.veroeffentlicht || []) naehte.push({ ...n, von: x.kennung });
  }
  const mitPrototyp = teilApps(j?.bereiche).filter(b => b.prototyp).map(b => b.kennung);
  return { offen, heimat, plugins, drehbuecher, daten, leer, namen, naehte, besitz, mitPrototyp, titel: offen !== heimat || leer ? a?.name ?? null : null, untertitel: offen !== heimat && a?.beispieldaten ? inSprache('Beispieldaten') : null };
}

/* Fortschritt beim ersten Prototyp, abgelesen an der entstehenden Antwort. */
function prototypSchritt(roh) {
  const n = /"anzahlPlugins"\s*:\s*(\d+)/.exec(roh)?.[1], k = zaehle(roh, '"quelle"');
  if (roh.includes('"drehbuch"')) return 'schreibt das erste Szenario';
  if (k) return `schreibt Plugin ${k}${n ? ` von ${n}` : ''}`;
  return roh.includes('"daten"') ? 'legt die Beispieldaten an' : 'überlegt, was die Teil-App braucht';
}

async function prototypText(a) {
  const j = liesProjektJson(PROJEKT_ORDNER), b = flacheBereiche(j.bereiche).find(x => x.kennung === a.bereich);
  const teile = [`# Beschreibung des Anforderers für die Teil-App „${b.name}“\n\n${a.text}`];
  if (a.dialog?.length) teile.push(`# Deine Rückfrage und die Antwort\n\n${a.dialog.map(d => `Rückfrage: ${d.rueckfrage}\n\nAntwort: ${d.antwort}`).join('\n\n---\n\n')}`);
  const anhaenge = alleAnhaenge(a);
  if (anhaenge.length) teile.push(`# Anhänge\n\nLies jede Datei mit Read:\n${anhaenge.flatMap(x => x.fuerKi.map(f => `- \`${f.datei}\``)).join('\n')}`);
  const fremd = teilApps(j.bereiche).flatMap(x => (x.fachobjekte || []).map(f => `${f.split('/')[0]} (gehört zu ${x.name})`));
  teile.push(`# Vorgaben\n\nKennung des Szenarios: ${a.id}\n${fremd.length ? `Fachobjekte anderer Bereiche, nur lesen: ${fremd.join(', ')}` : 'Fachobjekte anderer Bereiche gibt es keine.'}`);
  teile.push(await abschnittRegeln(a.flow), await abschnittPlugins(), await abschnittDaten());
  return teile.join('\n\n');
}

async function pruefePrototyp(a) {
  const x = a.antwort, vergeben = await vergebeneKennungen(), j = liesProjektJson(PROJEKT_ORDNER);
  const fremd = new Set(teilApps(j.bereiche).flatMap(b => (b.fachobjekte || []).map(f => f.split('/')[0])));
  if (!x.plugins?.length) return 'Es fehlen die Plugins.';
  let daten;
  try { daten = JSON.parse(x.daten); } catch { return '"daten" ist kein gültiges JSON.'; }
  for (const f of x.fachobjekte) {
    if (!/^[a-z][a-z-]*$/.test(f.wurzel)) return `Der Name "${f.wurzel}" besteht nur aus Kleinbuchstaben und Bindestrichen.`;
    if (fremd.has(f.wurzel)) return `"${f.wurzel}" gehört einem anderen Bereich. Lies es, lege es nicht neu an.`;
    if (!daten[f.wurzel]) return `Zu "${f.wurzel}" fehlen die Beispieldaten.`;
  }
  for (const w of Object.keys(daten)) if (!x.fachobjekte.some(f => f.wurzel === w)) return `Zu "${w}" in den Daten fehlt der Eintrag in "fachobjekte".`;
  const namen = new Set();
  for (const p of x.plugins) {
    if (!KENNUNG.test(p.kennung)) return `Die Kennung "${p.kennung}" besteht nur aus Kleinbuchstaben, Ziffern und Bindestrichen.`;
    if (vergeben.has(p.kennung) || namen.has(p.kennung)) return `Ein Plugin "${p.kennung}" gibt es schon.`;
    namen.add(p.kennung);
    if (zaehle(p.quelle, 'Huelle.plugin(') !== 1) return `"${p.kennung}": Ein Plugin ruft genau einmal Huelle.plugin auf.`;
    if (!new RegExp(`kennung:\\s*["']${p.kennung}["']`).test(p.quelle)) return `Das Plugin trägt die Kennung "${p.kennung}".`;
    try { new vm.Script(p.quelle); } catch (e) { return `"${p.kennung}" lässt sich nicht lesen: ${e.message}`; }
  }
  if (!x.plugins.some(p => /ansicht\s*:/.test(p.quelle))) return 'Mindestens ein Plugin zeichnet die Teil-App mit "ansicht".';
  if (!x.drehbuch.includes('Huelle.drehbuch(') || !x.drehbuch.includes(a.id)) return `Das Szenario ruft Huelle.drehbuch auf und trägt die Kennung "${a.id}".`;
  try { new vm.Script(x.drehbuch); } catch (e) { return `Das Szenario lässt sich nicht lesen: ${e.message}`; }
  a.ergebnis = { art: 'prototyp', kennung: x.plugins[0].kennung, quelle: null };
  a.dateien = x.plugins.map(p => ({ name: `${p.kennung}.js`, quelle: p.quelle }));
  return null;
}

/* Schreibt den ersten Prototyp: Beispieldaten, Plugins mit Herkunft, Szenario, Eintrag im Baum. */
async function behaltePrototyp(a) {
  const x = a.antwort, jetzt = new Date().toISOString();
  const ablage = path.join(PROJEKT_ORDNER, 'daten', 'bereiche');
  await fs.mkdir(ablage, { recursive: true });
  await fs.writeFile(path.join(ablage, `${a.bereich}.js`), `/* Beispieldaten der Teil-App, von der KI angelegt. */\nHuelle.daten(${JSON.stringify({ objekte: JSON.parse(x.daten) }, null, 2)});\n`);
  let reihe = Math.max(0, ...(await bausteineIn(BAUSTEINE)).map(b => b.reihe ?? 0));
  for (const [i, p] of x.plugins.entries()) {
    const ordner = path.join(BAUSTEINE, p.kennung);
    await fs.mkdir(ordner, { recursive: true });
    await fs.writeFile(path.join(ordner, fassungsDatei(1)), p.quelle);
    const wortlaut = p.satz ?? 'von der KI ergänzt, ohne Wunsch des PO';
    const drehbuch = i === 0 ? a.id : null;
    if (drehbuch) await fs.writeFile(path.join(ordner, `${drehbuch}.drehbuch.js`), x.drehbuch);
    if (i === 0) await legeAnhaengeAb(a, ordner);
    await schreibeHerkunft(ordner, {
      kennung: p.kennung, name: p.name, reihe: ++reihe, kurz: p.kurz, teilApp: a.bereich,
      wuensche: [{ kennung: a.id, name: p.name, wortlaut, datum: jetzt }], aktuell: 1,
      fassungen: [{ nr: 1, vorige: null, art: 'prototyp', wunsch: a.id, wortlaut, datum: jetzt, kurz: p.kurz, drehbuch }],
    });
  }
  const datei = path.join(PROJEKT_ORDNER, 'projekt.json'), j = liesProjektJson(PROJEKT_ORDNER);
  const b = (function finde(l) { for (const k of l || []) { if (k.kennung === a.bereich) return k; const t = finde(k.kinder); if (t) return t; } return null; })(j.bereiche);
  b.prototyp = true; b.beispieldaten = true; b.fachobjekte = x.fachobjekte.map(f => f.wurzel);
  for (const f of x.fachobjekte) {
    (j.fachobjektNamen ??= {})[f.wurzel] = f.name;
    (j.fachobjektEiner ??= {})[f.wurzel] = f.einer;
    (j.feldNamen ??= {})[f.wurzel] = Object.fromEntries(f.felder.map(z => [z.feld, z.wort]));
  }
  await fs.writeFile(datei, `${JSON.stringify(j, null, 2)}\n`);
  teilAppJe.set(PROJEKT, a.bereich);
}

/* Die Daten einer Nutzapp, die ein anderes Projekt liest; sonst null. Nur lesen. */
async function datenDesGelesenen() {
  const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest;
  if (!quelle) return null;
  const alles = await leseHerkunft(quelle);
  if (!alles) return null;
  const { punkte, teilAppJe, ...daten } = alles;
  return daten;
}

/* Anweisung 30: die offenen Punkte, gleich ob gerade die Dispo oder der Navigator offen ist. */
async function offenePunkte(umfang) {
  const alle = await projekte();
  const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest ?? PROJEKT;
  const d = await leseHerkunft(quelle);
  if (!d) return null;
  const navigator = alle.find(x => liesProjektJson(x.ordner)?.liest === quelle)?.kennung ?? null;
  const o = d.objekte, [art, ...rest] = String(umfang).split('/'), k = rest.join('/');
  const hierUnter = (b) => [b, ...Object.values(o.bereiche).filter(x => x.eltern === b).flatMap(x => hierUnter(x.kennung))];
  const ZUSTAND = { widerspruch: 'rot', offen: 'gelb', instabil: 'gelb' };
  const strang = (s) => ({ id: s.id, art: 'strang', satz: s.satz, farbe: ZUSTAND[s.zustand] ?? 'klar', szenarien: [],
    pfad: s.wer === 'plugin' ? `bausteine/${s.kennung}` : s.wer === 'naht' ? `bereiche/${s.von}` : s.wer === 'antrag' ? `bereiche/${s.nach}` : `bereiche/${o.fachregeln[s.kennung].bereich}` });
  const auswahl = () => {
    if (art === 'bereiche') { const b = hierUnter(k); return d.punkte.filter(p => b.includes(p.bereich)); }
    if (art === 'bausteine') return d.punkte.filter(p => p.plugin === k);
    if (art === 'grundfunktionen') return d.punkte.filter(p => p.gf === k);
    if (art === 'ohne') return d.punkte.filter(p => p.bereich === k && !p.plugin && !p.gf);
    if (art === 'strang') {
      const s = Object.values(o.faeden).flatMap(f => f.straenge).find(x => x.id === k);
      return s ? d.punkte.filter(p => s.punkte.includes(p.id)) : [];
    }
    if (art === 'faeden' && o.faeden[k]) {
      const RANG = { rot: 0, gelb: 1, klar: 2 };
      return o.faeden[k].straenge.map(strang).sort((a, b) => RANG[a.farbe] - RANG[b.farbe]);
    }
    return [];
  };
  return { projekt: quelle, navigator, offen: { projekt: PROJEKT, teilApp: offeneTeilApp() }, eintraege: auswahl(), teilAppJe: d.teilAppJe };
}

/* Alles, was der Leser über ein Projekt einsammelt. */
async function leseHerkunft(quelle) {
  const alle = await projekte();
  const p = alle.find(x => x.kennung === quelle);
  if (!p) return null;
  const nav = alle.find(x => liesProjektJson(x.ordner)?.liest === quelle)?.ordner ?? PROJEKT_ORDNER;
  const w = wegeVon(p.kennung, p.ordner);
  return herkunftAufgehoben({
    name: p.name, ordner: p.ordner, projekt: liesProjektJson(p.ordner), bausteine: w.BAUSTEINE, grund: w.GRUND,
    verwaltung: w.VERWALTUNG, regeln: w.REGELN, abgleich: w.ABGLEICH, inKauf: w.IN_KAUF, gespielt: w.GESPIELT, gearbeitet: w.GEARBEITET,
    grundfunktionen: w.GRUNDFUNKTIONEN, anmerkungen: path.join(nav, 'entscheidungen', 'grundstock-anmerkungen.json'),
    bestaetigungen: path.join(nav, 'entscheidungen', 'grundstock-bestaetigung.json'),
    grundstockGeaendert: w.GRUNDSTOCK_GEAENDERT, grunddaten: w.GRUNDDATEN,
    stand: w.STAND_SPEICHER, faelle: w.FAELLE, antraege: antraegeDatei(p.ordner),
  });
}

/* Anweisung 36: aus einer Datendatei nur die betroffenen Fachobjekte. Lässt sie sich nicht lesen, geht sie ganz mit. */
/* Anweisung 43 (c): je berührtes Fachobjekt sein Aufbau (welche Angaben es hat), die Anzahl und drei Beispiele, dazu sein
   Datenmodell. So wächst der Auftrag nicht mit den Daten. Alle Daten gehen nur mit, wenn die KI sie anfordert (alleDaten). */
const BEISPIELE = 3;
function datenAusschnitt(quelle, auswahl) {
  try {
    let d = null;
    vm.runInNewContext(quelle, { Huelle: { daten: x => { d = x; } } }, { timeout: 1000 });
    if (!d?.objekte) return quelle;
    const nimm = (k) => !auswahl?.wurzeln || auswahl.wurzeln.has(k);
    const objekte = Object.fromEntries(Object.entries(d.objekte).filter(([k]) => nimm(k)).map(([w, o]) => {
      const alle = Object.entries(o || {});
      const aufbau = [...new Set(alle.flatMap(([, x]) => (x && typeof x === 'object' ? Object.keys(x) : [])))];
      return [w, { aufbau, anzahl: alle.length, beispiele: Object.fromEntries(alle.slice(0, BEISPIELE)) }];
    }));
    const arten = Object.fromEntries(Object.entries(d.arten || {}).filter(([k]) => nimm(k)));
    const text = JSON.stringify({ ...d, objekte, arten }, (k, v) => (typeof v === 'function' ? String(v) : v), 1);
    return `/* Je Fachobjekt${auswahl?.wurzeln ? ', das dieser Wunsch berührt,' : ''} nur Aufbau, Anzahl und ${BEISPIELE} Beispiele; in der echten Datei stehen unter objekte.<fachobjekt> alle Einträge so wie die Beispiele. Rechenvorschriften stehen als Text. Brauchst du alle Einträge (etwa um eine Erwartung nachzurechnen), setze alleDaten auf true. */\nHuelle.daten(${text});`;
  } catch { return quelle; }
}

async function abschnittDaten(auswahl = null, alles = false) {
  const teile = [];
  for (const n of await jsDateien(path.join(PROJEKT_ORDNER, 'daten'))) {
    const quelle = await lies(path.join(PROJEKT_ORDNER, 'daten', n));
    teile.push(`### daten/${n}\n\n\`\`\`js\n${alles ? quelle : datenAusschnitt(quelle, auswahl)}\n\`\`\``);
  }
  /* Anweisung 63: Die Daten der offenen Teil-App liegen in daten/bereiche/<teil-app>.js (ihre Beispieldaten aus dem ersten
     Prototyp). Sie gehen nach denselben Regeln mit; die Daten anderer Teil-Apps nicht, die kennt der Wunsch nur über eine Naht. */
  const eigene = path.join('bereiche', `${offeneTeilApp()}.js`);
  const quelleEigene = await lies(path.join(PROJEKT_ORDNER, 'daten', eigene)).catch(() => null);
  if (quelleEigene) teile.push(`### daten/${eigene.replace(/\\/g, '/')} (Daten dieser Teil-App)\n\n\`\`\`js\n${alles ? quelleEigene : datenAusschnitt(quelleEigene, auswahl)}\n\`\`\``);
  const geaendert = await grunddatenListe();
  if (geaendert.length) teile.push(`### Schon durch Wünsche geändert (gilt anstelle des Werts oben)\n\n${geaendert.map(e => `- \`${e.pfad}\`: ${JSON.stringify(e.neu)}`).join('\n')}`);
  /* Eine Nutzapp, die ein anderes Projekt liest (Navigator): Ihre Daten entstehen beim Laden. Die KI bekommt von jeder
     Art zwei Beispiele und die Anzahl, damit der Auftrag nicht mit dem gelesenen Projekt wächst. */
  const gelesen = await datenDesGelesenen();
  if (gelesen) {
    const proben = Object.fromEntries(Object.entries(gelesen.objekte).map(([art, o]) => [art, { anzahl: Object.keys(o).length, beispiele: Object.fromEntries(Object.entries(o).slice(0, 2)) }]));
    teile.push(`### Daten beim Laden, aus dem gelesenen Projekt (nur lesen; je Art zwei Beispiele)\n\n\`\`\`json\n${JSON.stringify(proben, null, 2)}\n\`\`\``);
  }
  return `## Daten\n\n${teile.join('\n\n')}`;
}

const UEBERSCHRIFT = {
  wunsch: 'Wunsch des Anforderers',
  aendern: 'Der Anforderer will dieses Plugin ändern',
  'stimmt-nicht': 'Der Anforderer sagt, an diesem Plugin stimmt etwas nicht',
};

/* Anweisung 38: Was jedes Plugin an Angaben liest oder ändert (aus dem Mitschreiben beim Abspielen, ergänzt um die festen
   Pfade im Quelltext) und welche Nachrichten es hört und sendet. Erkannt an festen Pfaden, nie an Text eines Modells. */
function nachrichtenVon(quelle) {
  const einmal = (xs) => [...new Set(xs)];
  const hoert = einmal([...quelle.matchAll(/["'`]([a-z*][\w*/-]*\.[\wäöüß*]+)["'`]\s*:/g)].map(m => m[1]));
  const sendet = einmal([...quelle.matchAll(/aktion\s*:\s*["'`]([\wäöüß-]+)["'`]/g)].map(m => {
    const davor = quelle.slice(Math.max(0, m.index - 300), m.index + 300);
    const o = /objekt\s*:\s*["'`]([a-z][a-z-]*)(?:\/([^"'`]*))?["'`]/.exec(davor);
    return o ? `${o[1]}/${o[2] && !o[2].includes('/') ? o[2] : '…'}.${m[1]}` : `(Objekt der empfangenen Nachricht).${m[1]}`;
  }));
  const zeichnet = [];
  if (/\bansicht\s*:/.test(quelle)) zeichnet.push('eine eigene Ansicht');
  for (const b of quelle.matchAll(/ergaenzt\s*:\s*\{([\s\S]*?)\n\s{0,4}\}/g)) for (const m of b[1].matchAll(/^\s*["'`]?([a-z][a-z0-9-]*)["'`]?\s*:\s*\{/gm)) zeichnet.push(`ergänzt die Ansicht von \`${m[1]}\``);
  if (/\bstil\s*:/.test(quelle)) zeichnet.push('Aussehen über stil');
  if (/\bbedienungen\s*:/.test(quelle)) zeichnet.push('Bedienungen mit der Maus');
  const titel = /titel\s*:\s*["'`]([^"'`]+)["'`]/.exec(quelle)?.[1] ?? null;
  return { titel, hoert, sendet, zeichnet: einmal(zeichnet) };
}
async function angabenJePlugin() {
  const gearbeitet = JSON.parse(await fs.readFile(GEARBEITET, 'utf8').catch(() => '{}'));
  const einmal = JSON.parse(await fs.readFile(EINMAL, 'utf8').catch(() => '{}'));
  const aus = await ausgeschaltet();
  const grund = (await jsDateien(GRUND)).map(n => n.replace(/\.js$/, ''));
  const alle = [...new Set([...grund, ...(await bausteineIn(BAUSTEINE)).map(b => b.kennung)])].filter(k => !aus.includes(k));
  const je = new Map();
  for (const k of alle) {
    const quelle = (await aktuelleQuelle(k)) ?? '';
    const angaben = new Map();
    const nimm = (p, art) => {
      if (p === 'bus' || p.startsWith('durch/') || p.startsWith('bus/')) return;
      /* Anweisung 42: Wer Play den Status setzen lässt, ändert ihn. */
      if (p.startsWith('befehl/')) { p = p.slice('befehl/'.length); art = 'aendert'; }
      if (art === 'aendert' || !angaben.has(p)) angaben.set(p, art);
    };
    for (const [p, art] of zugriffeImQuelltext(quelle)) nimm(p, art);
    for (const b of quelle.matchAll(/besitzt\s*:\s*\[([^\]]*)\]/g)) for (const m of b[1].matchAll(/["'`]([a-z][a-z-]*)\/\*\/([\wäöüß]+)["'`]/g)) nimm(`${m[1]}/${m[2]}`, 'aendert');
    for (const e of Object.values(gearbeitet)) for (const [p, art] of Object.entries(e.zugriffe?.[k] ?? {})) nimm(p, art);
    for (const [p, art] of Object.entries(einmal[k]?.zugriffe ?? {})) nimm(p, art);
    /* Anweisung 45 (b): Play weiß, was ein Plugin anfasst, wenn es mitgeschrieben hat (auch „nichts“: gespielt, aber nichts
       angefasst) oder wenn das Plugin nach seinem Aufbau nichts ändern kann. Ändern kann es nur über Abonnements, beim Start
       oder beim Zeichnen der eigenen Ansicht; Bedienungen, Prüfungen und Ergänzungen fremder Ansichten bekommen von Play nur
       Lesezugriff. */
    const kannAendern = /\b(abonniert|beimStart|ansicht)\s*:/.test(quelle);
    const bekannt = angaben.size > 0 || !!einmal[k] || !kannAendern || Object.values(gearbeitet).some(e => (e.plugins || []).includes(k));
    je.set(k, { angaben, bekannt, ...nachrichtenVon(quelle) });
  }
  return je;
}
function nachrichtenZeile(k, x) {
  const aendert = [...x.angaben].filter(([p, art]) => art === 'aendert' && (p.includes('/') || ![...x.angaben.keys()].some(q => q.startsWith(`${p}/`)))).map(([p]) => p);
  const teile = [
    x.hoert.length ? `hört auf ${x.hoert.map(h => `\`${h}\``).join(', ')}` : null,
    x.sendet.length ? `sendet ${x.sendet.map(h => `\`${h}\``).join(', ')}` : null,
    aendert.length ? `ändert ${aendert.map(h => `\`${h}\``).join(', ')}` : 'ändert keine Angaben',
    x.zeichnet.length ? `zeichnet: ${x.zeichnet.join(', ')}` : null,
  ].filter(Boolean);
  return `- \`${k}\`${x.titel ? ` („${x.titel}“)` : ''}: ${teile.join('; ')}`;
}
/* Fasst ein Plugin eine der gewählten Angaben an? Ein ganzes Fachobjekt trifft jede seiner Angaben; kennt man vom Plugin
   nur das Fachobjekt, trifft es jede Angabe darin. */
function trifft(angaben, gewaehlt) {
  const felder = new Set([...angaben.keys()].filter(p => p.includes('/')).map(p => p.split('/')[0]));
  for (const p of angaben.keys()) {
    if (gewaehlt.has(p)) return true;
    for (const s of gewaehlt) {
      if (!s.includes('/') && p.split('/')[0] === s) return true;
      if (!p.includes('/') && !felder.has(p) && s.startsWith(`${p}/`)) return true;
    }
  }
  return false;
}

/* Was mit dem Auftrag mitgeht (Anweisung 38). Bleibt für denselben Auftrag stehen.
   volltext: was der Auftrag ändert (bei „Ändern“ und „Stimmt nicht“ das Plugin; weitere fordert die KI selbst an);
   zeilen: Plugins, die dieselben Angaben anfassen, je eine Zeile; alle: die Vorauswahl war unsicher, alle als Zeile. */
async function vorauswahl(a) {
  if (a.auswahl !== undefined) return a.auswahl;
  const je = await angabenJePlugin();
  const volltext = new Set(a.ziel && je.has(a.ziel) ? [a.ziel] : []);
  a.szenarienGegeben = new Set();
  /* Anweisung 43 (b): Als Zeile gehen nur Plugins mit, die eine berührte Angabe ändern; ist alles berührt, jedes, das
     überhaupt etwas ändert. Von einem Plugin, über das Play nichts weiß, geht die Zeile immer mit. */
  const schreibt = (x) => !x.bekannt || [...x.angaben.values()].includes('aendert');
  /* Bei einem aufgeteilten Wunsch gehören die Plugins der früheren Teile immer als Zeile dazu, auch wenn sie nur lesen oder zeichnen. */
  const fruehere = new Set(a.teil?.nr > 1 ? (await bausteineIn(BAUSTEINE)).filter(b => je.has(b.kennung) && !volltext.has(b.kennung) &&
    (b.wuensche || []).some(w => w.teil?.wunsch === a.teil.wunsch && w.teil.nr < a.teil.nr)).map(b => b.kennung) : []);
  const alles = () => ({ alle: true, je, volltext, zeilen: new Set([...fruehere, ...[...je].filter(([k, x]) => !volltext.has(k) && schreibt(x)).map(([k]) => k)]), wurzeln: null, grundfunktionen: null });
  a.auswahl = alles();
  a.mitgegeben = [...volltext];
  const namen = liesProjektJson(PROJEKT_ORDNER)?.fachobjektNamen ?? {};
  const bekannt = new Map();
  for (const x of je.values()) for (const p of x.angaben.keys()) {
    const [w, f] = p.split('/');
    if (!bekannt.has(w)) bekannt.set(w, new Set());
    if (f) bekannt.get(w).add(f);
  }
  if (bekannt.size < 2) return a.auswahl;
  const gf = JSON.parse(await fs.readFile(GRUNDFUNKTIONEN, 'utf8').catch(() => '[]'));
  a.schritt = 'sucht heraus, was der Wunsch berührt';
  const wortlaut = [a.text, a.teil?.text, ...(a.dialog ?? []).map(d => d.antwort)].filter(Boolean).join('\n\n');
  const anhaenge = alleAnhaenge(a).flatMap(x => x.fuerKi.map(f => f.datei));
  const liste = [...bekannt].sort(([x], [y]) => x.localeCompare(y)).map(([w, f]) => `- \`${w}\`${namen[w] ? ` (${namen[w]})` : ''}${f.size ? `: ${[...f].sort().join(', ')}` : ''}`);
  const frage = `# Wunsch\n\n${wortlaut}\n\n${anhaenge.length ? `# Anhänge (lies sie mit Read)\n\n${anhaenge.join('\n')}\n\n` : ''}# Fachobjekte und ihre Angaben\n\n${liste.join('\n')}` +
    (gf.length ? `\n\n# Grundfunktionen\n\nNenne in \`grundfunktionen\` die Kennungen derer, die der Wunsch berührt.\n\n${gf.map(g => `- \`${g.kennung}\`: ${g.name || g.satz}`).join('\n')}` : '');
  let ant;
  try { ant = await fragKi(a, frage, { auswahl: true }); } catch (e) { console.error(`${a.id} Vorauswahl:`, e); return a.auswahl; }
  const gueltig = (s) => { const [w, f] = String(s).split('/'); return bekannt.has(w) && (!f || bekannt.get(w).has(f)); };
  const gueltigeVon = (x) => (x?.angaben ?? x?.fachobjekte ?? []).filter(gueltig);
  /* Anweisung 47: Ist die KI unsicher oder nennt sie nichts, fragt Play sie einmal nach. Erst wenn sie dann weiter unsicher
     ist, gehen alle ändernden Plugins als Zeile mit. */
  if (ant && (ant.unsicher || !gueltigeVon(ant).length)) {
    a.schritt = 'fragt nach, welche Angaben der Wunsch berührt';
    a.auswahlUnsicherNachgefragt = true;
    const nachfrage = `${frage}\n\n# Nachfrage\n\nDu warst unsicher. Lies den Wunsch noch einmal und nenne die Angaben, die er am ehesten liest, ändert oder anzeigt, einzeln als \`fachobjekt/angabe\`. Betrifft er nur das Aussehen, nenne die Angaben, die an der betroffenen Stelle zu sehen sind. Setze unsicher nur dann auf true, wenn er wirklich die ganze Anwendung betrifft. Gib die vollständige Antwort noch einmal aus.`;
    try {
      const zweite = await fragKi(a, nachfrage, { auswahl: true });
      if (zweite) ant = zweite;
    } catch (e) { console.error(`${a.id} Vorauswahl, Nachfrage bei Unsicherheit:`, e); }
  }
  /* Anweisung 45 (a): Nennt die KI ein ganzes Fachobjekt, das einzelne Angaben hat, fragt Play sie einmal nach den Angaben. */
  const ganze = (x) => (x?.angaben ?? []).filter(s => gueltig(s) && !String(s).includes('/') && bekannt.get(s).size);
  if (ant && !ant.unsicher && ganze(ant).length) {
    const welche = ganze(ant);
    a.schritt = 'fragt nach den einzelnen Angaben';
    a.auswahlNachgefragt = welche;
    const nachfrage = `${frage}\n\n# Nachfrage\n\nDu hast ${welche.map(w => `\`${w}\``).join(', ')} als Ganzes genannt. Nenne stattdessen die einzelnen Angaben daran, die der Wunsch liest, ändert oder anzeigt, als \`fachobjekt/angabe\`. Gib die vollständige Antwort noch einmal aus.`;
    try {
      const zweite = await fragKi(a, nachfrage, { auswahl: true });
      if (zweite) ant = zweite;
    } catch (e) { console.error(`${a.id} Vorauswahl, Nachfrage:`, e); }
  }
  const gewaehlt = new Set(gueltigeVon(ant));
  if (!ant || ant.unsicher || !gewaehlt.size) return a.auswahl;
  /* Was das zu ändernde Plugin selbst anfasst, gehört immer dazu. */
  for (const k of volltext) for (const p of je.get(k)?.angaben.keys() ?? []) gewaehlt.add(p);
  const geaendert = (x) => new Map([...x.angaben].filter(([, art]) => art === 'aendert'));
  const zeilen = new Set([...fruehere, ...[...je].filter(([k, x]) => !volltext.has(k) && (!x.bekannt || trifft(geaendert(x), gewaehlt))).map(([k]) => k)]);
  const wurzeln = new Set([...gewaehlt].map(p => p.split('/')[0]));
  const grundfunktionen = Array.isArray(ant.grundfunktionen) ? new Set(ant.grundfunktionen) : null;
  a.auswahl = { alle: false, je, volltext, zeilen, wurzeln, angaben: gewaehlt, grundfunktionen };
  return a.auswahl;
}

/* Anweisung 38: Volltext, den die KI für eine Änderung angefordert hat (oder ein Plugin, das sie ändern will, ohne es
   gesehen zu haben), dazu die Szenarien, in denen es arbeitet. Gibt den Text für die nächste Runde oder null. */
async function volltextNachreichen(a) {
  const x = a.antwort;
  if (!a.auswahl || a.art === 'prototyp' || (a.volltextRunden ?? 0) >= 2) return null;
  const gewollt = [...(x.volltext ?? []), ...(x.art === 'aendern' && x.kennung ? [x.kennung] : [])];
  /* Anweisung 49 (d): Ein Plugin einer anderen Teil-App bekommt die KI nicht im Volltext; sie darf es nicht ändern und stellt einen Antrag. */
  const offen = offeneTeilApp(), fremd = new Set();
  for (const k of new Set(gewollt)) if (KENNUNG.test(k) && await teilAppVonPlugin(k) !== offen) fremd.add(k);
  const neu = [...new Set(gewollt)].filter(k => KENNUNG.test(k) && !fremd.has(k) && a.auswahl.je.has(k) && !a.auswahl.volltext.has(k));
  /* Anweisung 43 (c): alle Daten nur auf ausdrückliche Anforderung, einmal je Auftrag */
  const daten = x.alleDaten === true && !a.alleDatenGegeben;
  if (!neu.length && !daten) return null;
  a.volltextRunden = (a.volltextRunden ?? 0) + 1;
  const grund = (await jsDateien(GRUND)).map(n => n.replace(/\.js$/, ''));
  const quellen = [];
  for (const k of neu) {
    a.auswahl.volltext.add(k);
    const q = await aktuelleQuelle(k);
    if (q) quellen.push(volltextVon(k, q, grund.includes(k)));
  }
  if (!a.nachgereicht) a.mitgegeben = [...a.auswahl.volltext];
  const was = [neu.length ? (neu.length === 1 ? `„${a.auswahl.je.get(neu[0])?.titel ?? neu[0]}“` : `${neu.length} Plugins`) : null, daten ? 'alle Daten' : null].filter(Boolean);
  /* Anweisung 57: als ganzer Satz je Sprache; aus Stücken zusammengesetzt blieb „holt … dazu“ deutsch. */
  if (englisch()) {
    const en = [neu.length ? (neu.length === 1 ? `“${a.auswahl.je.get(neu[0])?.titel ?? neu[0]}”` : `${neu.length} plugins`) : null, daten ? 'all data' : null].filter(Boolean);
    a.schritt = `is reading ${en.join(' and ')}${neu.length ? ' in full' : ''}`;
  } else a.schritt = `holt ${was.join(' und ')}${neu.length ? ' im Volltext' : ''} dazu`;
  const teile = [];
  if (neu.length) {
    teile.push(`Hier der Volltext, den du brauchst:\n\n${quellen.join('\n\n')}`);
    /* Anweisung 43 (b): Frühere Wünsche gehen mit dem Plugin mit, das jetzt im Volltext dazukommt. */
    const tag = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'ohne Datum';
    const wuensche = (await bausteineIn(BAUSTEINE)).filter(b => neu.includes(b.kennung)).flatMap(b => (b.wuensche || []).filter(w => w.wortlaut).map(w => `- ${tag(w.datum)}, Wunsch zu \`${b.kennung}\`: „${w.wortlaut}“`));
    if (wuensche.length) teile.push(`Frühere Wünsche des Anforderers zu ${neu.length === 1 ? 'diesem Plugin' : 'diesen Plugins'}:\n\n${wuensche.join('\n')}`);
    const szenarien = await szenarienText(a, await szenarienVon(new Set(neu)));
    /* Ganze Sätze je Fall statt einzelner Wörter, damit die englische Fassung sie als Ganzes ersetzt (Anweisung 56 des PO). */
    const einleitung = neu.length === 1
      ? 'Dazu die Szenarien, in denen es beim letzten Abspielen etwas geändert oder auf eine Bedienung geantwortet hat, je Ereignis eines, höchstens drei je Plugin (sonst eins als Beispiel):'
      : 'Dazu die Szenarien, in denen sie beim letzten Abspielen etwas geändert oder auf eine Bedienung geantwortet haben, je Ereignis eines, höchstens drei je Plugin (sonst eins als Beispiel):';
    if (szenarien) teile.push(`${einleitung}\n\n${szenarien}`);
  }
  if (daten) {
    a.alleDatenGegeben = true;
    teile.push(`Hier alle Daten:\n\n${await abschnittDaten(null, true)}`);
  }
  return `${teile.join('\n\n')}\n\nGib jetzt die vollständige Antwort aus; \`volltext\` ist dann leer und \`alleDaten\` false.`;
}

/* Anweisung 36: Ein Wunsch an Play selbst wird nicht gebaut, aber mit Wortlaut, Datum und Projekt festgehalten. */
async function legeAnPlayAb(a) {
  const kopf = '# Wünsche an Play\n\nWünsche, die Play selbst betreffen. Sie werden nicht aus der App heraus gebaut.\n';
  const projekt = liesProjektJson(PROJEKT_ORDNER)?.name ?? PROJEKT;
  const wortlaut = a.text.split(/\r?\n/).map(z => `> ${z}`).join('\n');
  const eintrag = `\n## ${new Date().toLocaleDateString('sv-SE')} · ${projekt}\n\n${wortlaut}\n`;
  const da = await fs.readFile(WUENSCHE_AN_PLAY, 'utf8').catch(() => null);
  await fs.writeFile(WUENSCHE_AN_PLAY, `${da ?? kopf}${eintrag}`);
}

/* ---------- Anweisung 49 (d): Ein Wunsch ändert nur die offene Teil-App; was er anderswo braucht, wird ein Antrag an der Naht ---------- */
const antraegeDatei = (ordner = PROJEKT_ORDNER) => path.join(ordner, 'entscheidungen', 'antraege.json');
async function antraegeVon(ordner = PROJEKT_ORDNER) { return JSON.parse(await fs.readFile(antraegeDatei(ordner), 'utf8').catch(() => '[]')); }
function teilAppName(k) { return flacheBereiche(liesProjektJson(PROJEKT_ORDNER)?.bereiche).find(b => b.kennung === k)?.name ?? k; }
const antragSatz = (e) => `„${teilAppName(e.von)}“ bittet „${teilAppName(e.an)}“: ${e.satz}`;
async function legeAntragAn(a, an, satz) {
  const liste = await antraegeVon();
  const nr = Math.max(0, ...liste.map(x => Number(/(\d+)$/.exec(x.id)?.[1] ?? 0))) + 1;
  const e = { id: `antrag-${String(nr).padStart(3, '0')}`, von: offeneTeilApp(), an, satz: String(satz).trim(), wunsch: a.id, wortlaut: a.text,
    ziel: a.ziel ?? undefined, datum: new Date().toISOString(), status: 'offen' };
  await fs.mkdir(path.dirname(antraegeDatei()), { recursive: true });
  await fs.writeFile(antraegeDatei(), `${JSON.stringify([...liste, e], null, 2)}
`);
  a.antragSatz = antragSatz(e);
  return e;
}
async function teilAppVonPlugin(k) {
  const h = await herkunftVon(path.join(BAUSTEINE, k));
  return h?.teilApp ?? (await zuordnung()).plugins?.[k] ?? heimatVon(liesProjektJson(PROJEKT_ORDNER));
}
/* Ändert die Antwort etwas, das einer anderen Teil-App gehört? Dann ein Satz für die KI, sonst null. */
async function fremdeTeilApp(a) {
  const x = a.antwort, offen = offeneTeilApp(), stand = await teilAppStand(), heimat = stand.heimat;
  const nein = (was, t) => `${was} gehört zur Teil-App „${teilAppName(t)}“. Ein Wunsch ändert nur „${teilAppName(offen)}“. ` +
    `Ändere es nicht; braucht der Wunsch dort etwas, stelle in "antrag" einen Antrag an "${t}".`;
  const an = x.antrag?.an;
  if (x.antrag) {
    if (!teilApps(liesProjektJson(PROJEKT_ORDNER)?.bereiche).some(b => b.kennung === an) || an === offen) return `"antrag.an" ist die Kennung einer anderen Teil-App dieses Projekts, nicht "${an}".`;
    if (!String(x.antrag.satz || '').trim()) return 'Ein Antrag braucht einen Satz, was die andere Teil-App tun soll.';
  }
  for (const k of x.volltext || []) {
    const t = KENNUNG.test(k) ? await teilAppVonPlugin(k) : offen;
    if (t !== offen) return nein(`Das Plugin "${k}"`, t);
  }
  if (x.art === 'aendern' && x.kennung && (x.aenderungen?.length || x.plugin)) {
    const t = await teilAppVonPlugin(x.kennung);
    if (t !== offen) return nein(`Das Plugin "${x.kennung}"`, t);
  }
  for (const e of x.erwartungen || []) {
    const t = stand.drehbuecher[e.drehbuch] ?? heimat;
    if (t !== offen) return nein(`Das Drehbuch "${e.drehbuch}"`, t);
  }
  if (a.regelZiel) {
    for (const d of await regelDateien()) {
      if (!d.quelle.includes(`"${a.regelZiel}"`)) continue;
      const t = (await zuordnung()).regeln?.[d.name] ?? heimat;
      if (t !== offen) return nein(`Die Regel "${a.regelZiel}"`, t);
    }
  }
  for (const g of x.grunddaten || []) {
    const t = stand.besitz[String(g.pfad || '').split('/')[1]];
    if (t && t !== offen) return nein(`"${g.pfad}"`, t);
  }
  return null;
}
/* Was die KI über die Teil-Apps wissen muss: welche es gibt, was an die offene weitergegeben wird, wie ein Antrag geht. Wächst nur mit der Zahl der Teil-Apps. */
function teilAppVorgaben() {
  const j = liesProjektJson(PROJEKT_ORDNER), apps = teilApps(j?.bereiche), offen = offeneTeilApp();
  if (apps.length < 2) return null;
  const naehte = flacheBereiche(j.bereiche).flatMap(b => (b.veroeffentlicht || []).filter(n => !n.fuer || n.fuer.includes(offen)).map(n => `${b.name} gibt ${n.was} weiter`));
  return `Teil-Apps dieses Projekts: ${apps.map(b => `\`${b.kennung}\` (${b.name})`).join(', ')}. ` +
    (naehte.length ? `An „${teilAppName(offen)}“ wird weitergegeben, nur zum Lesen: ${naehte.join('; ')}. ` : '') +
    `Plugins, Drehbücher, Regeln und Grunddaten anderer Teil-Apps änderst du nie. Braucht der Wunsch dort etwas, stellst du in "antrag" einen Antrag: ` +
    `"an" ist die Kennung der anderen Teil-App, "satz" sagt in den Worten des Anforderers, was sie tun soll, z. B. „mehr Flüge zwischen 05:00 und 11:00“. ` +
    `Was in „${teilAppName(offen)}“ selbst geht, setzt du trotzdem um; geht dort nichts, bleiben "plugin" und "regel" null und "aenderungen", "grunddaten" und "erwartungen" leer.`;
}

/* Anweisung 48 (a): Satz über die offene Teil-App für die Vorgaben, wenn das Projekt mehrere hat; sonst null. */
async function offeneTeilAppText() {
  const j = liesProjektJson(PROJEKT_ORDNER), mit = teilApps(j?.bereiche).filter(b => b.prototyp);
  if (mit.length < 2) return null;
  const offen = offeneTeilApp(), heimat = heimatVon(j), name = mit.find(b => b.kennung === offen)?.name ?? offen;
  /* Nur die eigenen Ansichten: Eine Liste der fremden wüchse mit dem Projekt. */
  const aus = await ausgeschaltet(), eigen = [];
  const bausteine = await bausteineIn(BAUSTEINE);
  const kandidaten = offen === heimat
    ? [...(await jsDateien(GRUND)).map(n => n.replace(/\.js$/, '')), ...bausteine.filter(b => !b.teilApp || b.teilApp === heimat).map(b => b.kennung)]
    : bausteine.filter(b => b.teilApp === offen).map(b => b.kennung);
  for (const k of kandidaten) {
    if (aus.includes(k)) continue;
    const q = await aktuelleQuelle(k);
    if (q && /\bansicht\s*:/.test(q)) eigen.push(`\`${k}\``);
  }
  return `Offen ist die Teil-App „${name}“ (\`${offen}\`). Der Wunsch ändert nur sie. Ihre Ansichten: ${eigen.join(', ') || 'noch keine'}. ` +
    `Ansichten anderer Teil-Apps fasst du nicht an. Regeln in \`stil\`, die über deine eigenen \`pl-\`-Klassen hinausgehen, ` +
    `beschränkst du auf \`#nutzbereich[data-teilapp="${offen}"]\`; so gestaltest du auch ihren Rahmen (siehe „Der Rahmen gehört zur Teil-App“).`;
}

async function auftragstext(a) {
  if (a.art === 'prototyp') return prototypText(a);
  const vorgaben = [
    `Kennung für ein neues Drehbuch: ${a.id}`,
    `Aktive Varianten je Platz: ${JSON.stringify(a.stand)}`,
    `Gerade gewähltes Drehbuch: ${a.drehbuch || 'keins'}`,
  ];
  /* Anweisung 48 (a): Ein Wunsch ändert nur die offene Teil-App. Die KI erfährt, welche das ist und welche Ansichten ihr gehören. */
  const offen = await offeneTeilAppText();
  if (offen) vorgaben.unshift(offen);
  const naht = teilAppVorgaben();
  if (naht) vorgaben.unshift(naht);
  if (a.ziel) vorgaben.unshift(`Zu ändern ist genau das Plugin \`${a.ziel}\`. Antworte mit art "aendern" und kennung "${a.ziel}".`);
  if (a.regelZiel) vorgaben.unshift(`Der Anforderer will die Regel \`${a.regelZiel}\` ändern („Regel ändern“). Liefere ihre neue Fassung in "regel" mit kennung "${a.regelZiel}"; ändert sich am Verhalten nichts, antworte mit art "nur-regel".`);
  const teile = [`# ${UEBERSCHRIFT[a.art]}\n\n${a.text}`];
  if (a.dialog?.length) {
    teile.push(`# Deine Rückfrage und die Antwort des Anforderers\n\n${a.dialog.map(d => [
      `Deine Rückfrage: ${d.rueckfrage}`,
      d.teile?.length ? `Deine vorgeschlagenen Teile:\n${d.teile.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : null,
      d.soMachen ? 'Der Anforderer hat „So machen“ gewählt: Er ist mit dieser Aufteilung einverstanden.' : null,
      d.antwort ? `Antwort des Anforderers (im Wortlaut): ${d.antwort}` : null,
    ].filter(Boolean).join('\n\n')).join('\n\n---\n\n')}`);
  }
  if (a.teil) {
    teile.push(`# Dieser Auftrag ist Teil ${a.teil.nr} von ${a.teil.von}\n\nSetze jetzt nur diesen Teil um, als ein kleines Plugin (neu oder gezielte Änderung): ${a.teil.text}\n\n` +
      `${a.teil.nr > 1 ? 'Die früheren Teile sind schon eingespielt und stehen unten bei den Plugins; brauchst du einen im Volltext, fordere ihn mit `volltext` an. ' : ''}Die übrigen Teile kommen danach je als eigener Auftrag; nimm sie nicht vorweg.`);
  }
  const anhaenge = alleAnhaenge(a);
  if (anhaenge.length) {
    const zeilen = anhaenge.flatMap(x => x.fuerKi.map(f => `- \`${f.datei}\`: ${f.blatt !== undefined ? `Blatt „${f.blatt}“ der Excel-Datei „${x.name}“, als CSV` : `„${x.name}“`}${x.zur === 'antwort' ? ' (zur Antwort auf deine Rückfrage)' : ''}`));
    teile.push(`# Anhänge\n\nDer Anforderer hat Dateien angehängt, die seinen Wunsch verdeutlichen. Lies jede mit dem Werkzeug Read, bevor du antwortest (Bilder und PDF siehst du dann). Maßgeblich bleibt der Wortlaut; widerspricht ein Anhang dem Text, stelle eine \`rueckfrage\`.\n\n${zeilen.join('\n')}`);
  }
  teile.push(`# Vorgaben\n\n${vorgaben.join('\n')}`);
  if (a.beobachtet) teile.push(`# Was der Anforderer zuletzt gesehen hat\n\n${a.beobachtet}`);
  const auswahl = await vorauswahl(a);
  teile.push(await abschnittRegeln(a.flow, auswahl), await abschnittEntscheidungen(auswahl), await abschnittGrundfunktionen(auswahl), await abschnittPlugins(auswahl), await abschnittDrehbuecher(a), await abschnittDaten(auswahl));
  return teile.join('\n\n');
}

function zaehle(text, teil) { return teil ? text.split(teil).length - 1 : 0; }

/* Prüft die Antwort mechanisch und legt fest, was eingespielt würde. Rückgabe: Mangel oder null. */
async function pruefeAntwort(a) {
  if (a.art === 'prototyp') return pruefePrototyp(a);
  const x = a.antwort;
  const vergeben = await vergebeneKennungen();
  let quelle;
  const fremd = await fremdeTeilApp(a);
  if (fremd) return fremd;
  /* Nur ein Antrag: In der offenen Teil-App ändert sich nichts. */
  if (x.antrag && !x.plugin && !x.aenderungen?.length && !x.regel && !x.grunddaten?.length && !x.erwartungen?.length) {
    a.nurAntrag = true;
    a.ergebnis = { art: 'antrag', kennung: null, quelle: null };
    a.dateien = [];
    return null;
  }
  if (a.ziel && (x.art !== 'aendern' || x.kennung !== a.ziel)) {
    return `Zu ändern war genau das Plugin "${a.ziel}"; die Antwort muss art "aendern" und kennung "${a.ziel}" haben.`;
  }
  const regelMangel = await pruefeRegel(a);
  if (regelMangel) return regelMangel;
  const erwartungsMangel = await pruefeErwartungen(a);
  if (erwartungsMangel) return erwartungsMangel;
  const grunddatenMangel = await pruefeGrunddaten(a);
  if (grunddatenMangel) return grunddatenMangel;
  if (x.art === 'nur-daten') {
    if (x.plugin || x.aenderungen?.length || x.drehbuch || a.regel) return 'Bei art "nur-daten" bleiben "plugin", "drehbuch" und "regel" null und "aenderungen" leer.';
    a.ergebnis = { art: x.art, kennung: null, quelle: null };
    a.dateien = [{ name: a.grunddaten.name, quelle: a.grunddaten.quelle }];
    if (a.erwartungen) a.dateien.push({ name: a.erwartungen.name, quelle: a.erwartungen.quelle });
    return null;
  }
  if (x.art === 'nur-regel') {
    if (!a.regel) return 'Zu art "nur-regel" gehört eine Regel in "regel".';
    if (x.plugin || x.aenderungen?.length || x.drehbuch) return 'Bei art "nur-regel" bleiben "plugin" und "drehbuch" null und "aenderungen" leer.';
    a.ergebnis = { art: x.art, kennung: null, quelle: null };
    a.dateien = a.grunddaten ? [{ name: a.grunddaten.name, quelle: a.grunddaten.quelle }] : [];
    return null;
  }
  if (x.art === 'neu') {
    if (!KENNUNG.test(x.kennung || '')) return 'Die Kennung eines neuen Plugins besteht nur aus Kleinbuchstaben, Ziffern und Bindestrichen.';
    if (vergeben.has(x.kennung)) {
      return `Ein Plugin "${x.kennung}" gibt oder gab es schon. Ein vorhandenes Plugin wird nie neu geliefert: Ändere es mit art "aendern" gezielt oder wähle für ein neues kleines Plugin eine neue Kennung.`;
    }
    if (x.aenderungen?.length) return 'Ein neues Plugin bringt seinen Quelltext in "plugin" mit, nicht in "aenderungen".';
    quelle = x.plugin || '';
  } else {
    const bisher = await aktuelleQuelle(x.kennung);
    if (bisher === null) return `Ein Plugin "${x.kennung}" gibt es nicht. Ändern lässt sich nur ein vorhandenes.`;
    if (x.plugin) return 'Ein vorhandenes Plugin wird nie komplett neu geliefert. Gib nur die Stellen in "aenderungen" an und lass "plugin" leer.';
    if (!x.aenderungen?.length) return 'Zu "aendern" gehört mindestens eine Änderung in "aenderungen".';
    quelle = bisher;
    let ersetzt = 0;
    for (const [i, e] of x.aenderungen.entries()) {
      const n = zaehle(quelle, e.alt);
      if (n === 0) return `Änderung ${i + 1}: Der Text in "alt" kommt im Plugin nicht vor; er muss genau einmal vorkommen und wörtlich übereinstimmen.`;
      if (n !== 1) return `Änderung ${i + 1}: Der Text in "alt" kommt im Plugin ${n}-mal vor; er muss genau einmal vorkommen und wörtlich übereinstimmen.`;
      ersetzt += e.alt.length;
      quelle = quelle.replace(e.alt, () => e.neu);
    }
    if (ersetzt > Math.max(GEZIELT_MINDESTENS, bisher.length * GEZIELT_ANTEIL)) {
      return 'Die Änderung ersetzt fast das ganze Plugin. Ändere nur die Stellen, die der Wunsch betrifft, oder lege für Neues ein eigenes kleines Plugin an.';
    }
  }
  if (zaehle(quelle, 'Huelle.plugin(') !== 1) return 'Ein Plugin ruft genau einmal Huelle.plugin auf.';
  if (!new RegExp(`kennung:\\s*["']${x.kennung}["']`).test(quelle)) return `Das Plugin trägt die Kennung "${x.kennung}".`;
  if (x.drehbuch && !x.drehbuch.includes(a.id)) return `Ein neues Drehbuch trägt die Kennung "${a.id}".`;
  a.ergebnis = { art: x.art, kennung: x.kennung, quelle };
  a.dateien = [{ name: `${x.kennung}.js`, quelle }];
  if (x.drehbuch) a.dateien.unshift({ name: `${a.id}.drehbuch.js`, quelle: x.drehbuch });
  if (a.erwartungen) a.dateien.push({ name: a.erwartungen.name, quelle: a.erwartungen.quelle });
  if (a.grunddaten) a.dateien.unshift({ name: a.grunddaten.name, quelle: a.grunddaten.quelle });
  return null;
}

let attrappeNr = 0;
let attrappeAbgleichNr = 0;
async function attrappe(abgleich, a = null) {
  if (abgleich && !ATTRAPPE_ABGLEICH) return { mehr: [], enger: [], verstoesse: [] };
  /* {{auftrag}} steht in Prüfungen für die Kennung des Auftrags, die erst beim Anlegen feststeht. */
  const liste = JSON.parse((await lies(abgleich ? ATTRAPPE_ABGLEICH : ATTRAPPE)).replaceAll('{{auftrag}}', a?.id ?? ''));
  const antwort = abgleich ? liste[Math.min(attrappeAbgleichNr++, liste.length - 1)] : liste[Math.min(attrappeNr++, liste.length - 1)];
  /* Der Abgleich dauert etwas länger, damit die Prüfung seinen Fortschritt sieht. */
  await new Promise(ok => setTimeout(ok, abgleich ? 2500 : 300));
  if (antwort === 'fehler') throw new Error('Attrappe: Fehler');
  return antwort;
}

let attrappeAuswahlNr = 0;
async function fragKi(a, prompt, wie = {}) {
  if (wie.auswahl && ATTRAPPE) {
    if (!ATTRAPPE_AUSWAHL) return null;
    if (KI_PROTOKOLL) await fs.appendFile(KI_PROTOKOLL, `${JSON.stringify({ id: a.id, auswahl: true, prompt })}\n`);
    const liste = JSON.parse(await lies(ATTRAPPE_AUSWAHL));
    return liste[Math.min(attrappeAuswahlNr++, liste.length - 1)];
  }
  /* Unter einer Attrappe ohne Antworten für den Abgleich findet er nichts und fragt niemanden. */
  if (wie.abgleich && ATTRAPPE && !ATTRAPPE_ABGLEICH) return { mehr: [], enger: [], verstoesse: [] };
  if (!wie.auswahl) a.prompts = (a.prompts || 0) + 1;
  /* Anhänge liest die KI selbst, mit Read und nur genau diese Dateien. */
  const lesbar = wie.abgleich ? [] : alleAnhaenge(a).flatMap(x => x.fuerKi.map(f => path.resolve(f.datei)));
  if (KI_PROTOKOLL) await fs.appendFile(KI_PROTOKOLL, `${JSON.stringify({ id: a.id, abgleich: !!wie.abgleich, prompt, anhaenge: lesbar })}\n`);
  if (ATTRAPPE || (wie.abgleich && ATTRAPPE_ABGLEICH)) return attrappe(!!wie.abgleich, a);
  const { query } = await import(pathToFileURL(SDK).href);
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), wie.prototyp ? ZEITLIMIT_PROTOTYP_MS : wie.auswahl ? ZEITLIMIT_AUSWAHL_MS : ZEITLIMIT_MS);
  const umgebung = { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' };
  delete umgebung.ANTHROPIC_API_KEY;   // Zugang nur über das Abo
  let ergebnis;
  let zeichen = 0, roh = '';
  try {
    const strom = query({
      prompt: englisch() ? enAuftrag(prompt) : prompt,
      options: {
        cwd: PLAY,
        pathToClaudeCodeExecutable: existsSync(CLAUDE) ? CLAUDE : undefined,
        model: MODELL,
        effort: wie.auswahl ? 'low' : AUFWAND,
        resume: wie.auswahl ? undefined : a.sitzung ?? undefined,
        /* Auftrag 011: In einem englischen Projekt bekommt die KI ihre Anleitung und den Auftrag auf Englisch. */
        systemPrompt: wie.auswahl ? (englisch() ? enText(AUSWAHL_ANLEITUNG) : AUSWAHL_ANLEITUNG) : wie.abgleich ? anleitungIn('abgleich-anleitung.md', ABGLEICH_ANLEITUNG)
          : anleitungIn('plugin-anleitung.md', ANLEITUNG) + projektAnleitung() + (wie.prototyp ? anleitungIn('prototyp-anleitung.md', PROTOTYP_ANLEITUNG) : ''),
        tools: lesbar.length ? ['Read'] : [],
        permissionMode: 'default',
        canUseTool: async (name, eingabe) => {
          if (name === 'StructuredOutput') return { behavior: 'allow', updatedInput: eingabe };
          if (name === 'Read' && lesbar.includes(path.resolve(String(eingabe?.file_path || '')))) {
            a.schritt = `sieht sich den Anhang „${path.basename(eingabe.file_path)}“ an`;
            return { behavior: 'allow', updatedInput: eingabe };
          }
          return { behavior: 'deny', message: lesbar.length ? 'Lesen darfst du nur die genannten Anhänge.' : 'Keine Werkzeuge in diesem Auftrag.' };
        },
        settingSources: [],
        env: umgebung,
        outputFormat: { type: 'json_schema', schema: wie.auswahl ? AUSWAHL_SCHEMA : wie.abgleich ? ABGLEICH_SCHEMA : wie.prototyp ? PROTOTYP_SCHEMA : ANTWORT_SCHEMA },
        includePartialMessages: true,
        maxTurns: 6 + 2 * lesbar.length,
        abortController: abbruch,
      },
    });
    for await (const m of strom) {
      if (typeof m.session_id === 'string' && !wie.auswahl) a.sitzung = m.session_id;
      if (m.type === 'stream_event') {
        if (wie.auswahl) continue;
        const delta = m.event?.delta;
        if (delta?.type === 'thinking_delta') a.schritt = 'überlegt, wie sich das umsetzen lässt';
        if (delta?.type === 'input_json_delta' && delta.partial_json) {
          zeichen += delta.partial_json.length;
          if (wie.prototyp) { roh += delta.partial_json; a.schritt = prototypSchritt(roh); }
          else a.schritt = englisch() ? `is writing (${zeichen.toLocaleString('en-GB')} characters)` : `schreibt (${zeichen.toLocaleString('de-DE')} Zeichen)`;
        }
      } else if (m.type === 'result') {
        if (m.subtype !== 'success' || m.is_error) throw new Error(String(m.result ?? m.subtype).slice(0, 300));
        ergebnis = m.structured_output ?? JSON.parse(m.result);
      }
    }
  } finally {
    clearTimeout(wecker);
  }
  if (!ergebnis) throw new Error('Die KI hat keine Antwort geliefert.');
  return ergebnis;
}

/* Aufträge laufen nacheinander: Der nächste baut auf dem vorigen auf. Eine Antwort, die gegen
   die Regeln verstößt, geht einmal mit dem Grund zurück; danach gilt der Auftrag als gescheitert. */
/* Je Projekt eigene Aufträge; beim Wechsel wird die Liste des Projekts genommen. */
const auftraegeJe = new Map([[STAMM, new Map()]]);
let auftraege = auftraegeJe.get(STAMM);
let warteschlange = Promise.resolve();

function einreihen(a, baue) {
  a.status = 'wartet';
  a.schritt = 'wartet auf den vorigen Auftrag';
  a.ergebnis = null;
  a.dateien = null;
  warteschlange = warteschlange.then(async () => {
    a.status = 'arbeitet';
    a.schritt = 'liest, was es schon gibt';
    try {
      /* Anweisung 49 (d): „Ändern“ oder „Stimmt nicht“ an einem Plugin einer anderen Teil-App wird gleich ein Antrag an sie. */
      if (a.ziel && a.art !== 'prototyp' && (a.art === 'aendern' || a.art === 'stimmt-nicht')) {
        const t = await teilAppVonPlugin(a.ziel);
        if (t !== offeneTeilApp()) { a.antrag = await legeAntragAn(a, t, a.text); a.status = 'antrag'; return; }
      }
      let prompt = await baue();
      for (let versuch = 0; ; versuch++) {
        a.antwort = await fragKi(a, prompt, { prototyp: a.art === 'prototyp' });
        /* Anweisung 38: Will die KI ein Plugin ändern, das sie nur als Zeile kennt, bekommt sie seinen Volltext; das zählt nicht als Nachbessern. */
        const nachgereicht = await volltextNachreichen(a);
        if (nachgereicht) { prompt = nachgereicht; versuch--; continue; }
        if (a.antwort.anPlay) { await legeAnPlayAb(a); a.status = 'an-play'; return; }
        /* Anweisung 58: Eine reine Aufteilung (teile ohne Frage) beginnt die Seite von selbst; sie läuft über denselben Weg. */
        if (a.antwort.rueckfrage || (!a.teil && a.antwort.teile?.length > 1)) { a.status = 'rueckfrage'; return; }
        const mangel = await pruefeAntwort(a);
        if (!mangel && a.nurAntrag) { a.antrag = await legeAntragAn(a, a.antwort.antrag.an, a.antwort.antrag.satz); a.status = 'antrag'; return; }
        if (!mangel && a.art === 'prototyp') { a.schritt = 'richtet die Teil-App ein'; await behaltePrototyp(a); a.status = 'behalten'; return; }
        if (!mangel) { a.status = 'fertig'; return; }
        console.error(`${a.id}: Antwort abgelehnt: ${mangel}`);
        /* Anweisung 58: zwei Anläufe; nach der Bitte um ein Szenario ließ die KI einmal ihr Plugin weg und brauchte zwei. */
        if (versuch >= 2) {
          a.status = 'fehlgeschlagen';
          a.grund = 'Das Ergebnis ließ sich nicht sauber als kleines Plugin einbauen.';
          return;
        }
        a.schritt = 'bessert die Antwort nach';
        prompt = `Diese Antwort nimmt die Seite nicht an: ${mangel}\n\nGib die vollständige Antwort neu aus.`;
      }
    } catch (e) {
      a.status = 'fehlgeschlagen';
      a.grund = abbruchText(e);
      console.error(`${a.id}:`, e);
    }
  });
}

/* Auftrag 013: Fehlt der Zugang zur KI (das Agent SDK liegt nicht neben Play), steht ein klarer Satz statt eines Dateipfads. */
const OHNE_KI = 'Dafür braucht Play die KI, und hier gibt es keinen Zugang zu ihr.';
function ohneKi(e) { return e?.code === 'ERR_MODULE_NOT_FOUND' && /claude-agent-sdk/.test(e?.message ?? ''); }
function abbruchText(e) {
  if (ohneKi(e)) return OHNE_KI;
  /* Anweisung 61: Das SDK meldet die eigene Zeitgrenze als Fehler „Operation aborted“, nicht als AbortError. */
  return e?.name === 'AbortError' || /aborted/i.test(e?.message ?? '') ? 'Es hat zu lange gedauert.' : 'Die KI war nicht erreichbar oder hat abgebrochen.';
}

function neuerAuftrag(id, felder) {
  const a = { id, sitzung: null, stand: {}, drehbuch: null, ziel: null, beobachtet: null, anhaenge: [], anhangVon: id, dialog: [], teil: null, ...felder };
  auftraege.set(a.id, a);
  einreihen(a, () => auftragstext(a));
  return a;
}

/* Nächster Teil eines aufgeteilten Wunsches als eigener Auftrag; null, wenn alle durch sind.
   Wortlaut, Anhänge und Gespräch sind die des ursprünglichen Wunsches. */
async function naechsterTeil(p) {
  if (p.teilNr >= p.teile.length) return null;
  const nr = ++p.teilNr;
  return neuerAuftrag(await naechsteKennung(), {
    text: p.text, stand: p.stand, drehbuch: p.drehbuch, flow: p.flow, art: p.art, ziel: p.ziel,
    anhaenge: p.anhaenge, anhangVon: p.anhangVon, dialog: p.dialog,
    teil: { nr, von: p.teile.length, text: p.teile[nr - 1], wunsch: p.id },
  });
}

/* Übernimmt ein fertiges Ergebnis: neues Plugin oder neue Fassung, jeweils mit dem Satz im Wortlaut. */
async function behalte(a) {
  if (a.antwort?.antrag && !a.antrag) a.antrag = await legeAntragAn(a, a.antwort.antrag.an, a.antwort.antrag.satz);
  await behalteGrunddaten(a, new Date().toISOString());
  if (a.regel) {
    await fs.mkdir(REGELN, { recursive: true });
    if (a.regel.alt) {
      /* Regel ändern: die vorige Fassung aufheben, dann die neue an ihre Stelle */
      const ablage = path.join(REGELN, 'alt');
      await fs.mkdir(ablage, { recursive: true });
      a.regel.ablage = path.join(ablage, `${a.regel.kennung}.vor-${a.id}.js`);
      await fs.writeFile(a.regel.ablage, a.regel.alt.quelle);
      await fs.writeFile(path.join(REGELN, a.regel.name), a.regel.quelle);
    } else {
      await fs.writeFile(path.join(REGELN, a.regel.name), a.regel.quelle, { flag: 'wx' });
    }
    await legeAnhaengeAb(a, REGELN);
    if (!a.regel.alt) await merkeTeilApp(PROJEKT_ORDNER, 'regeln', a.regel.name, offeneTeilApp());
  }
  if (a.ergebnis.art === 'nur-regel' || a.ergebnis.art === 'nur-daten') return;
  const { art, kennung, quelle } = a.ergebnis;
  const ordner = path.join(BAUSTEINE, kennung);
  const jetzt = new Date().toISOString();
  const drehbuch = a.antwort.drehbuch ? a.id : null;
  let h = await herkunftVon(ordner);
  if (art === 'neu') {
    const reihen = (await bausteineIn(BAUSTEINE)).map(b => b.reihe ?? 0);
    h = {
      kennung, name: a.antwort.name, reihe: Math.max(0, ...reihen) + 1, kurz: a.antwort.kurz,
      /* Ein Wunsch gehört immer zur offenen Teil-App. */
      teilApp: offeneTeilApp(),
      wuensche: [{ kennung: a.id, name: a.antwort.name, wortlaut: a.text, datum: jetzt, teilApp: offeneTeilApp() }],
      aktuell: 0, fassungen: [],
    };
  } else if (!h) {
    /* Erste Änderung an einem Plugin der Grundausstattung: Fassung 1 ist die Datei in plugins/. */
    const reihen = (await bausteineIn(BAUSTEINE)).map(b => b.reihe ?? 0);
    h = {
      kennung, name: a.antwort.name, reihe: Math.max(0, ...reihen) + 1, kurz: null, teilApp: (await zuordnung()).plugins?.[kennung] ?? heimatVon(liesProjektJson(PROJEKT_ORDNER)), wuensche: [], aktuell: 1,
      fassungen: [{ nr: 1, vorige: null, art: 'grund', wortlaut: null, datum: null, kurz: 'Grundausstattung', drehbuch: null }],
    };
  }
  const nr = Math.max(0, ...h.fassungen.map(f => f.nr)) + 1;
  await fs.mkdir(ordner, { recursive: true });
  await legeAnhaengeAb(a, ordner);
  /* Anhänge, Rückfragen und Teil stehen wie der Wortlaut in der Herkunft, am Wunsch und an der Fassung. */
  const zuWunsch = {
    anhaenge: a.anhaenge.length ? a.anhaenge.map(x => anhangHerkunft(a, x)) : undefined,
    rueckfragen: dialogHerkunft(a),
    teil: a.teil ? { nr: a.teil.nr, von: a.teil.von, text: a.teil.text, wunsch: a.teil.wunsch } : undefined,
  };
  if (art === 'neu') Object.assign(h.wuensche[0], zuWunsch);
  await fs.writeFile(path.join(ordner, fassungsDatei(nr)), quelle);
  if (drehbuch) await fs.writeFile(path.join(ordner, `${drehbuch}.drehbuch.js`), a.antwort.drehbuch);
  if (a.erwartungen) await fs.writeFile(path.join(ordner, a.erwartungen.name), a.erwartungen.quelle);
  /* Die alte Erwartung bleibt in der Herkunft: an der Fassung, die sie geändert hat. */
  const erwartungen = a.erwartungen ? a.erwartungen.liste.map(e => ({ drehbuch: e.drehbuch, nr: e.nr, satz: e.satz, alt: e.alt, neu: e.neu })) : undefined;
  /* Anweisung 45 (d): Aus welcher Teil-App die Fassung kommt, wenn nicht aus der des Plugins; „Bereich leeren“ nimmt sie dann mit zurück. */
  const vonTeilApp = teilAppAusserHeimat() ?? heimatVon(liesProjektJson(PROJEKT_ORDNER));
  const fremd = vonTeilApp !== (h.teilApp ?? heimatVon(liesProjektJson(PROJEKT_ORDNER))) ? vonTeilApp : undefined;
  h.fassungen.push({ nr, vorige: h.aktuell || null, art: a.art, wunsch: a.id, teilApp: fremd, wortlaut: a.text, ...zuWunsch, datum: jetzt, kurz: a.antwort.kurz, drehbuch, erwartungen,
    grunddaten: a.grunddaten ? a.grunddaten.liste : undefined, unbestaetigt: true, ungeprueft: a.ungeprueft || undefined,
    ueberstimmt: a.ueberstimmt?.length ? { datum: jetzt, wie: 'vom PO mit „Trotzdem einspielen“', verstoesse: a.ueberstimmt.map(v => ({ regel: v.regel, satz: v.satz })) } : undefined });
  h.aktuell = nr;
  a.fassung = nr;
  if (art !== 'neu' && a.art === 'wunsch') h.wuensche.push({ kennung: a.id, name: a.antwort.name, wortlaut: a.text, ...zuWunsch, datum: jetzt, teilApp: vonTeilApp });
  await schreibeHerkunft(ordner, h);
}

/* „Zurücknehmen“ am Fertig-Hinweis */
async function nimmZurueck(a) {
  /* Nur was behalten wurde, wird zurückgenommen; „Verwerfen“ vor dem Einspielen ändert nichts. */
  if (!a?.ergebnis || a.status !== 'behalten') return;
  await nimmGrunddatenZurueck(a);
  /* Die Regel aus diesem Wunsch geht mit zurück; eine geänderte Regel bekommt ihre vorige Fassung wieder. */
  if (a.regel?.alt) await fs.writeFile(path.join(REGELN, a.regel.name), a.regel.alt.quelle);
  else if (a.regel) await fs.rm(path.join(REGELN, a.regel.name), { force: true });
  if (a.ueberstimmt?.length) await schreibeInKauf((await inKauf()).filter(e => e.wunsch !== a.id));
  await aendereAbgleiche(liste => { liste.splice(0, liste.length, ...liste.filter(e => e.wunsch !== a.id)); });
  if (a.ergebnis.art === 'nur-regel' || a.ergebnis.art === 'nur-daten') return;
  if (a.ergebnis.art === 'neu') await wirfWeg(a.ergebnis.kennung);
  else await zurueckZurVorigen(a.ergebnis.kennung);
}

/* ---------- Abgleich nach dem Einspielen (Auftrag 006, Stufe 3) ----------
   Nach jedem eingespielten Plugin vergleicht eine zweite KI im Hintergrund den Wunsch im Wortlaut mit dem,
   was eingespielt wurde: tut das Plugin mehr („mehr“), fasst es oder die Regel den Wunsch enger („enger“),
   bricht es eine Regel, die sich nur als Satz prüfen lässt („verstoesse“)? Im Zweifel nichts.
   Der PO entscheidet: Behalten (steht mit Datum in der Herkunft des Plugins) oder Weg damit (ein
   Ändern-Lauf entfernt genau das). Ergebnisse und Entscheidungen liegen in ABGLEICH, nie im Browser. */
const abgleichLaeuft = new Map();   // wunsch → { schritt, beginn }
let abgleichSchreiben = Promise.resolve();

async function abgleiche() {
  const text = await fs.readFile(ABGLEICH, 'utf8').catch(() => null);
  return text ? JSON.parse(text) : [];
}

/* Schreibt nacheinander: Zwei Abgleiche oder Entscheidungen dürfen sich nicht überschreiben. */
function aendereAbgleiche(tue) {
  abgleichSchreiben = abgleichSchreiben.then(async () => {
    const liste = await abgleiche();
    const ergebnis = await tue(liste);
    await fs.mkdir(path.dirname(ABGLEICH), { recursive: true });
    await fs.writeFile(ABGLEICH, `${JSON.stringify(liste, null, 2)}\n`);
    return ergebnis;
  });
  return abgleichSchreiben;
}

/* Gilt das Ergebnis noch? Nur solange das Plugin in genau der abgeglichenen Fassung eingeschaltet ist
   (bzw. die Regel noch da ist). Eine spätere Fassung bekommt ihren eigenen Abgleich. */
async function giltAbgleich(e) {
  if (e.plugin) {
    const h = await herkunftVon(path.join(BAUSTEINE, e.plugin));
    return !!h && fachlicheFassung(h) === e.fassung && !(await ausgeschaltet()).includes(e.plugin);
  }
  if (e.regel) return (await alleRegeln()).some(r => r.kennung === e.regel.kennung);
  return false;
}

async function regelnNurAlsSatz(flow) {
  return (await alleRegeln()).filter(r => r.art === 'ki' && giltFuer(r, flow));
}

async function abgleichText(a, vorher) {
  const k = a.ergebnis.kennung;
  const teile = [`# ${UEBERSCHRIFT[a.art]} (im Wortlaut)\n\n${a.text}`];
  for (const d of a.dialog || []) {
    teile.push(`# Rückfrage der anderen KI und Antwort des Anforderers\n\nRückfrage: ${d.rueckfrage}${d.teile?.length ? `\n\nVorgeschlagene Teile:\n${d.teile.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : ''}${d.soMachen ? '\n\nDer Anforderer hat der Aufteilung zugestimmt („So machen“).' : ''}${d.antwort ? `\n\nAntwort (im Wortlaut): ${d.antwort}` : ''}`);
  }
  if (a.teil) teile.push(`# Eingespielt ist nur Teil ${a.teil.nr} von ${a.teil.von}\n\n${a.teil.text}\n\nMiss das Plugin an diesem Teil; was zu den anderen Teilen gehört, fehlt hier mit Absicht.`);
  if (a.antwort.kurz) teile.push(`# Was die andere KI dazu gesagt hat\n\n${a.antwort.kurz}`);
  if (k) {
    teile.push(vorher === null
      ? `# Neues Plugin \`${k}\`\n\n\`\`\`js\n${a.ergebnis.quelle}\n\`\`\``
      : `# Geändertes Plugin \`${k}\`: vorher\n\n\`\`\`js\n${vorher}\n\`\`\`\n\n# Geändertes Plugin \`${k}\`: jetzt\n\n\`\`\`js\n${a.ergebnis.quelle}\n\`\`\``);
  }
  if (a.antwort.drehbuch) teile.push(`# Neues Szenario dazu\n\n\`\`\`js\n${a.antwort.drehbuch}\n\`\`\``);
  if (a.regel) {
    const r = a.regel;
    const wie = r.art === 'bedingung' ? `Bedingung:\n\n\`\`\`js\n${a.antwort.regel.pruefe}\n\`\`\`` : r.art === 'ki' ? 'Lässt sich nur als Satz prüfen.' : 'Lässt sich im Prototyp nicht zeigen.';
    teile.push(`# ${!k && r.art === 'ki' ? 'Neue Regel' : 'Regel aus diesem Wunsch'} \`${r.kennung}\`\n\n${r.satz}\n\n${wie}`);
  }
  const saetze = (await regelnNurAlsSatz(a.flow)).filter(r => !(a.regel && r.kennung === a.regel.kennung));
  teile.push(saetze.length
    ? `# Regeln, die nur als Satz gelten\n\n${saetze.map(r => `- \`${r.kennung}\`: ${r.satz}`).join('\n')}`
    : '# Regeln, die nur als Satz gelten\n\nKeine.');
  if (!k && a.regel?.art === 'ki') teile.push(await abschnittPlugins());
  return teile.join('\n\n');
}

/* Startet den Abgleich zu einem behaltenen Auftrag im Hintergrund: für jedes Plugin und jede Regel aus einem
   Wunsch (ist sie enger als gesagt?), nicht für eine Regel, die sich im Prototyp nicht zeigen lässt. */
async function starteAbgleich(a, vorher) {
  const k = a.ergebnis.kennung;
  if (!k && (!a.regel || a.regel.art === 'nicht-zeigbar')) return;
  const job = { id: a.id, schritt: 'beginnt', beginn: Date.now() };
  abgleichLaeuft.set(a.id, job);
  const eintrag = {
    wunsch: a.id, art: a.art, wortlaut: a.text, plugin: k, name: a.antwort.name || null, fassung: a.fassung ?? null,
    regel: a.regel ? { kennung: a.regel.kennung, satz: a.regel.satz, art: a.regel.art } : null,
    datum: new Date().toISOString(), status: 'laeuft', mehr: [], enger: [], verstoesse: [], entscheidungen: {},
  };
  await aendereAbgleiche(liste => { liste.push(eintrag); });
  try {
    const antwort = await fragKi(job, await abgleichText(a, vorher), { abgleich: true });
    const gelten = new Map((await regelnNurAlsSatz(a.flow)).map(r => [r.kennung, r]));
    const bekannt = new Set([...(await jsDateien(GRUND)).map(n => n.replace(/\.js$/, '')), ...(await bausteineIn(BAUSTEINE)).map(b => b.kennung)]);
    const satz = x => typeof x === 'string' && x.trim() ? x.trim() : null;
    eintrag.mehr = (k ? antwort.mehr || [] : []).map(m => satz(m.was)).filter(Boolean).slice(0, 2).map((was, nr) => ({ nr, was }));
    eintrag.enger = (antwort.enger || []).filter(e => satz(e.was) && (e.regel ? !!a.regel : !!k)).slice(0, 2)
      .map((e, nr) => ({ nr, was: satz(e.was), regel: !!e.regel }));
    /* Nur Regeln, die als Satz gelten, und nur Plugins, die es gibt; ohne neue Regel nur das eingespielte Plugin */
    eintrag.verstoesse = (antwort.verstoesse || []).filter(v => gelten.has(v.regel) && satz(v.satz) && bekannt.has(v.plugin) && (k ? v.plugin === k : true))
      .slice(0, 5).map(v => ({ regel: v.regel, plugin: v.plugin, satz: satz(v.satz) }));
    /* Für eine neue Regel gegen alle Plugins: die Fassung, die jeweils geprüft wurde */
    for (const v of eintrag.verstoesse) v.fassung = fachlicheFassung(await herkunftVon(path.join(BAUSTEINE, v.plugin)));
    eintrag.status = 'fertig';
  } catch (e) {
    console.error(`${a.id} Abgleich:`, e);
    eintrag.status = 'fehlgeschlagen';
    eintrag.grund = abbruchText(e);
  }
  /* Erst das Ergebnis speichern, dann austragen: Fragt die Seite dazwischen nach, sähe sie sonst
     „läuft“ ohne laufenden Abgleich und hielte ihn für abgebrochen. */
  try {
    await aendereAbgleiche(liste => {
      const i = liste.findIndex(x => x.wunsch === a.id && x.datum === eintrag.datum);
      if (i >= 0) liste[i] = { ...eintrag, entscheidungen: liste[i].entscheidungen };
    });
  } finally {
    abgleichLaeuft.delete(a.id);
  }
}

/* Für die Seite: alle Abgleiche, mit „gilt“ und dem Schritt der laufenden */
async function abgleichStand() {
  const out = [];
  for (const e of await abgleiche()) {
    const job = abgleichLaeuft.get(e.wunsch);
    /* Ein Abgleich, der beim Neustart der Brücke noch lief, kommt nicht mehr zurück. */
    const status = e.status === 'laeuft' && !job ? 'abgebrochen' : e.status;
    out.push({ ...e, status, gilt: await giltAbgleich(e), schritt: job?.schritt ?? null, sekunden: job ? Math.round((Date.now() - job.beginn) / 1000) : null });
  }
  return out;
}

/* Entscheidung des PO zu einem Punkt: behalten (bzw. so lassen) oder weg (bzw. wie gesagt) */
const WAHL = { behalten: 'Behalten', weg: 'Weg damit' };
async function entscheideAbgleich(wunsch, { art, nr, wahl }) {
  if (!['mehr', 'enger'].includes(art) || !WAHL[wahl] || !Number.isInteger(nr)) return null;
  const datum = new Date().toISOString();
  const e = await aendereAbgleiche(liste => {
    const x = liste.filter(y => y.wunsch === wunsch).at(-1);
    const punkt = x?.[art]?.find(p => p.nr === nr);
    if (!punkt) return null;
    x.entscheidungen[`${art}-${nr}`] = { wahl, datum, wie: `vom PO per Klick „${art === 'enger' && wahl === 'behalten' ? 'So lassen' : art === 'enger' ? 'Wie gesagt' : WAHL[wahl]}“` };
    return { ...x, punkt };
  });
  if (!e) return null;
  /* In der Herkunft des Plugins: an der Fassung, die abgeglichen wurde */
  if (e.plugin) {
    const ordner = path.join(BAUSTEINE, e.plugin);
    const h = await herkunftVon(ordner);
    const f = h?.fassungen.find(x => x.nr === e.fassung);
    if (f) {
      (f.entscheidungen ||= []).push({ datum, art, wahl, was: e.punkt.was, regel: e.punkt.regel || undefined, wie: e.entscheidungen[`${art}-${nr}`].wie, wunsch });
      await schreibeHerkunft(ordner, h);
    }
  }
  return e;
}

/* ---------- Wer eine Bedienung übernimmt ----------
   Wollen mehrere Plugins dieselbe Bedienung übernehmen, wählt der PO eins. Bis dahin gilt die feste
   Reihenfolge. Die Wahl steht mit Datum hier und in der Herkunft beider Plugins (an der geltenden Fassung).
   Schlüssel: Ansicht, Art der Bedienung und die beteiligten Plugins (von der Seite gebildet). */
async function bedienungsWahl() {
  const text = await fs.readFile(BEDIENUNGEN, 'utf8').catch(() => null);
  return text ? JSON.parse(text) : [];
}

async function waehleBedienung({ schluessel, plugins, gewaehlt, satz, name }) {
  if (typeof schluessel !== 'string' || !Array.isArray(plugins) || !plugins.includes(gewaehlt)) return null;
  if (!plugins.every(k => typeof k === 'string' && KENNUNG.test(k))) return null;
  const datum = new Date().toISOString();
  const wie = `vom PO per Klick „${String(name || gewaehlt)} übernimmt“`;
  const liste = (await bedienungsWahl()).filter(e => e.schluessel !== schluessel);
  liste.push({ schluessel, plugins, gewaehlt, satz: String(satz || ''), datum, wie });
  await fs.mkdir(path.dirname(BEDIENUNGEN), { recursive: true });
  await fs.writeFile(BEDIENUNGEN, `${JSON.stringify(liste, null, 2)}
`);
  for (const k of plugins) {
    const ordner = path.join(BAUSTEINE, k);
    const h = await herkunftVon(ordner).catch(() => null);
    const f = h?.fassungen?.find(x => x.nr === h.aktuell);
    if (!f) continue;
    (f.entscheidungen ||= []).push({ datum, art: 'bedienung', wahl: gewaehlt, was: String(satz || ''), wie, schluessel });
    await schreibeHerkunft(ordner, h);
  }
  return liste;
}

async function faelleOhneRegel() {
  const text = await fs.readFile(FAELLE, 'utf8').catch(() => null);
  return text ? JSON.parse(text) : [];
}

/* { schluessel, satz, keine }: keine = true hakt den Fall ab, false nimmt das zurück. */
async function hakeFallAb({ schluessel, satz, keine }) {
  if (typeof schluessel !== 'string' || !schluessel || schluessel.length > 300) return null;
  const liste = (await faelleOhneRegel()).filter(e => e.schluessel !== schluessel);
  if (keine) liste.push({ schluessel, satz: String(satz || ''), datum: new Date().toISOString(), wie: 'vom PO per Klick „Braucht keine Regel“' });
  await fs.mkdir(path.dirname(FAELLE), { recursive: true });
  await fs.writeFile(FAELLE, `${JSON.stringify(liste, null, 2)}
`);
  return liste;
}

/* ---------- HTTP ---------- */
function antworte(res, code, wert, roh = false) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(roh ? wert : inSprache(wert)));
}

/* Ein Wunsch mit Anhängen: 25 MB als Base64 und etwas Luft */
const MIT_ANHAENGEN = Math.ceil(ANHANG_JE_WUNSCH * 4 / 3) + 1000000;

async function lieseJson(req, grenze = 200000) {
  /* Erst alles sammeln, dann lesen: Ein Umlaut darf nicht zwischen zwei Stücken zerfallen. */
  const stuecke = [];
  let laenge = 0;
  for await (const teil of req) {
    laenge += teil.length;
    if (laenge > grenze) throw new Error('zu groß');
    stuecke.push(teil);
  }
  return JSON.parse(Buffer.concat(stuecke).toString('utf8') || '{}');
}

/* Anweisung 20: je Szenario die Plugins, die darin gearbeitet haben, und der Tag des letzten Abspielens.
   Geschrieben wird nur, wenn sich etwas geändert hat, damit das bloße Öffnen von Play keinen neuen Stand erzeugt. */
async function merkeGearbeitet(szenarien, gueltig, zugriffe) {
  const heute = new Date().toLocaleDateString('sv-SE');
  /* Beim schnellen Start kommen nur die neu gespielten Szenarien; die übrigen behalten ihr Datum. */
  const alt = Array.isArray(gueltig) ? JSON.parse(await fs.readFile(GEARBEITET, 'utf8').catch(() => '{}')) : {};
  const stand = {};
  for (const k of Object.keys(alt)) if (gueltig.includes(k)) stand[k] = alt[k];
  for (const k of Object.keys(szenarien || {})) stand[k] = { plugins: szenarien[k], zugriffe: zugriffe?.[k] ?? {}, datum: heute };
  const neu = {};
  for (const k of Object.keys(stand).sort()) neu[k] = stand[k];
  const text = `${JSON.stringify(neu, null, 2)}\n`;
  if (await fs.readFile(GEARBEITET, 'utf8').catch(() => null) !== text) await fs.writeFile(GEARBEITET, text);
}

/* Nur die eigene Seite darf Wünsche schicken, keine fremde Website im selben Browser. */
function erlaubt(req) {
  if (!EIGENE_ADRESSEN.includes(req.headers.host)) return false;
  if (req.method === 'GET') return true;
  const herkunft = req.headers.origin;
  return EIGENE_ADRESSEN.some(a => herkunft === `http://${a}`);
}

async function liefereDatei(req, res, pfadname) {
  const relativ = decodeURIComponent(pfadname === '/' ? '/index.html' : pfadname).replace(/^\/+/, '');
  if (!TYPEN[path.extname(relativ)]) { res.writeHead(404); res.end(); return; }
  /* Netz-Navigator: Seine Daten entstehen beim Laden aus der Herkunft des gelesenen Projekts (nur lesen). */
  if (relativ === 'teilapps.js') {
    res.writeHead(200, { 'Content-Type': TYPEN['.js'], 'Cache-Control': 'no-store' });
    /* Anweisung 54: Im Maschinenraum stehen Pfade und Angaben über das Glossar auf Englisch; die Daten bleiben, wie sie sind. */
    const anzeigeNamen = englisch() ? JSON.parse(await fs.readFile(path.join(PROJEKT_ORDNER, 'entscheidungen', 'anzeige-namen.json'), 'utf8').catch(() => '{}')) : {};
    res.end(`window.PLAY_TEILAPP = ${JSON.stringify({ ...(await teilAppStand()), sprache: liesProjektJson(PROJEKT_ORDNER)?.sprache || 'Deutsch', anzeigeNamen })};\n`);
    return;
  }
  if (relativ === 'daten/herkunft.js') {
    const daten = await datenDesGelesenen();
    if (!daten) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPEN['.js'], 'Cache-Control': 'no-store' });
    res.end(`Huelle.daten(${JSON.stringify(inSprache(daten))});
`);
    return;
  }
  /* Die Nutzapp kommt aus dem Ordner des geöffneten Projekts, die Hostapp (index.html, huelle/) aus Play. */
  const projektteil = PROJEKTTEILE.has(relativ.split('/')[0]);
  const basis = projektteil ? PROJEKT_ORDNER : PLAY;
  let ziel = path.resolve(basis, relativ);
  /* Englisches Projekt: Seite und Hülle aus der englischen Ausgabe von Play, wenn es sie gibt */
  if (!projektteil && (relativ === 'index.html' || /^huelle\/[\w-]+\.js$/.test(relativ)) && englisch() && existsSync(path.join(SPRACHE_EN, relativ))) ziel = path.join(SPRACHE_EN, relativ);
  /* Aus Play heraus nie in die Ordner anderer Projekte greifen */
  const innerhalb = ziel.startsWith(basis + path.sep) && !ziel.startsWith(SERVER + path.sep) && (projektteil || !ziel.startsWith(PROJEKTE + path.sep));
  if (!innerhalb) { res.writeHead(404); res.end(); return; }
  try {
    let inhalt = await fs.readFile(ziel);
    /* Voller Prüflauf: Mehrere Prüfungen teilen sich die Kerne, jede Seite spielt dann auf weniger Plätzen. */
    if (relativ === 'index.html' && KERNE_FUER_SEITE) inhalt = inhalt.toString('utf8').replace('</head>', `<script>window.PLAY_KERNE = ${KERNE_FUER_SEITE};</script>
</head>`);
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(ziel)], 'Cache-Control': 'no-store' });
    res.end(inhalt);
  } catch {
    res.writeHead(404); res.end();
  }
}

function sicht(a) {
  const { id, art, ziel, status, schritt, grund, antwort, dateien, ergebnis, regel, erwartungen, teil } = a;
  return {
    id, art, ziel, status, schritt, grund, mitgegeben: a.mitgegeben ?? null,
    antragSatz: a.antragSatz ?? (a.antwort?.antrag ? antragSatz({ von: offeneTeilApp(), an: a.antwort.antrag.an, satz: a.antwort.antrag.satz }) : null), teil: teil ?? null, antwort: antwort ?? null, dateien: dateien ?? null, kennung: ergebnis?.kennung ?? null,
    regel: regel ? { kennung: regel.kennung, satz: regel.satz, art: regel.art, name: regel.name, quelle: regel.quelle } : null,
    grunddaten: a.grunddaten ? a.grunddaten.liste.map(e => e.satz) : null,
    erwartungen: erwartungen ? erwartungen.liste.map(e => ({ drehbuch: e.drehbuch, titel: e.titel, nr: e.nr, satz: e.satz })) : [],
  };
}

function auftragsfelder(d) {
  const flow = typeof d.flow === 'string' && /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(d.flow) ? d.flow : null;
  return {
    text: String(d.text).trim(), stand: d.stand ?? {}, drehbuch: d.drehbuch ?? null, flow,
    beobachtet: d.beobachtet ? String(d.beobachtet).slice(0, 20000) : null,
    /* „Regel ändern“: dieser Wunsch gilt der Regel mit dieser Kennung */
    regelZiel: typeof d.regel === 'string' && KENNUNG.test(d.regel) ? d.regel : null,
  };
}

/* Unsichtbare Kopien laufen unter eigenen Adressen (kopie-3.localhost), damit der Browser jeder einen
   eigenen Prozess gibt und mehrere Drehbücher wirklich gleichzeitig rechnen. Sie dürfen nur Dateien lesen. */
const KOPIE_ADRESSE = new RegExp(`^kopie-\\d{1,3}\\.localhost:${PORT}$`);

async function bearbeite(req, res) {
  if (req.method === 'GET' && KOPIE_ADRESSE.test(req.headers.host ?? '')) {
    return liefereDatei(req, res, new URL(req.url, 'http://kopie.localhost').pathname);
  }
  if (!erlaubt(req)) { res.writeHead(403); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const teile = url.pathname.split('/').filter(Boolean);

  /* Projekte: Liste und Wechsel. Nach dem Wechsel lädt die Seite neu und bekommt die Nutzapp des Projekts. */
  if (req.method === 'GET' && url.pathname === '/projekte') {
    const offen = offeneTeilApp(), leer = leerJetzt();
    return antworte(res, 200, { aktuell: PROJEKT, wert: leer || (offen && offen !== heimatVon(liesProjektJson(PROJEKT_ORDNER))) ? `${PROJEKT}/${offen}` : PROJEKT, vorgemerkt: leer, liste: (await projekte()).map(({ kennung, name, ordner }) => {
      const j = liesProjektJson(ordner);
      return { kennung, name, vermerk: j?.vermerk ?? null, sprache: j?.sprache || 'Deutsch', liest: !!j?.liest, teilApps: teilApps(j?.bereiche).map(b => ({ kennung: b.kennung, name: b.name, prototyp: !!b.prototyp, leer: !b.prototyp && !(b.fachobjekte || []).length })), ordner: flacheBereiche(j?.bereiche).filter(b => b.kinder).map(b => ({ kennung: b.kennung, name: b.name })) };
    }) });
  }
  if (req.method === 'POST' && url.pathname === '/bereich') {
    const datei = path.join(PROJEKT_ORDNER, 'projekt.json');
    const j = liesProjektJson(PROJEKT_ORDNER);
    if (!j || j.liest) return antworte(res, 400, { grund: 'In diesem Projekt lassen sich keine Bereiche anlegen.' });
    const { name, unter, verantwortlich, ordner } = await lieseJson(req);
    const titel = String(name ?? '').trim();
    if (!titel) return antworte(res, 400, { grund: 'Der Bereich braucht einen Namen.' });
    const alle = flacheBereiche(j.bereiche);
    const knoten = { kennung: neueKennung(titel, alle.map(b => b.kennung)), name: titel, ...(ordner ? { kinder: [] } : { prototyp: false, fachobjekte: [] }) };
    if (unter) {
      const eltern = (function finde(l) { for (const b of l || []) { if (b.kennung === unter) return b; const x = finde(b.kinder); if (x) return x; } return null; })(j.bereiche);
      if (!eltern?.kinder) return antworte(res, 400, { grund: 'Unter diesem Bereich lässt sich nichts anlegen.' });
      eltern.kinder.push(knoten);
    } else {
      knoten.verantwortlich = String(verantwortlich ?? '').trim() || null;
      (j.bereiche = j.bereiche || []).push(knoten);
    }
    await fs.writeFile(datei, `${JSON.stringify(j, null, 2)}\n`);
    return antworte(res, 200, { kennung: knoten.kennung });
  }
  if (req.method === 'POST' && url.pathname === '/projekt-neu') {
    if (laeuftNochEtwas()) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Lege das Projekt an, wenn er fertig ist.' });
    const titel = String((await lieseJson(req)).name ?? '').trim();
    if (!titel) return antworte(res, 400, { grund: 'Das Projekt braucht einen Namen.' });
    const kennung = neueKennung(titel, [STAMM, ...(await projekte()).map(p => p.kennung)]);
    const ordner = path.join(PROJEKTE, kennung);
    await fs.mkdir(ordner, { recursive: true });
    await fs.writeFile(path.join(ordner, 'projekt.json'), `${JSON.stringify({ kennung, name: titel, bereiche: [] }, null, 2)}\n`);
    await fs.mkdir(path.join(ordner, 'daten'), { recursive: true });
    await fs.writeFile(path.join(ordner, 'daten', 'start.js'), `Huelle.daten(${JSON.stringify({ titel, untertitel: 'Noch leer', pfad: `${kennung}/start`, objekte: {} }, null, 2)});\n`);
    await fs.writeFile(path.join(ordner, 'manifest.js'), 'Huelle.lade({ stil: [], daten: ["daten/start.js"], plugins: [], regeln: [], bereit: [], drehbuecher: ["drehbuecher/start.js"] });\n');
    await fs.mkdir(path.join(ordner, 'drehbuecher'), { recursive: true });
    await fs.writeFile(path.join(ordner, 'drehbuecher', 'start.js'), 'Huelle.drehbuch({ kennung: "start", titel: "Noch kein Szenario", von: "08:00", bis: "08:15", ereignisse: [], erwartet: [] });\n');
    await oeffneProjekt(kennung);
    return antworte(res, 200, { aktuell: kennung });
  }
  /* Auftrag 011: „Kopie anlegen …“ macht aus dem offenen Projekt ein neues; das Original bleibt unangetastet. */
  if (req.method === 'POST' && url.pathname === '/projekt-kopie') {
    if (laeuftNochEtwas()) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Lege die Kopie an, wenn er fertig ist.' });
    const { name, sprache } = await lieseJson(req);
    const titel = String(name ?? '').trim();
    if (!titel) return antworte(res, 400, { grund: 'Die Kopie braucht einen Namen.' });
    if (sprache && sprache !== 'wie-original' && sprache !== 'englisch') return antworte(res, 400, { grund: 'Diese Sprache gibt es noch nicht.' });
    if (kopieLauf?.laeuft) return antworte(res, 409, { grund: 'Play legt gerade schon eine Kopie an.' });
    const alle = await projekte();
    if (alle.some(p => p.name.toLowerCase() === titel.toLowerCase())) return antworte(res, 400, { grund: 'Ein Projekt mit diesem Namen gibt es schon.' });
    const quelle = alle.find(p => p.kennung === PROJEKT);
    if (!quelle || liesProjektJson(quelle.ordner)?.liest) return antworte(res, 400, { grund: 'Dieses Projekt lässt sich nicht kopieren.' });
    const beginn = Date.now();
    const kopie = await kopiereProjekt(quelle, titel, alle);
    console.log(`Kopie angelegt: ${quelle.kennung} → ${kopie} in ${Date.now() - beginn} ms`);
    if (sprache === 'englisch') {
      /* Übersetzen dauert; die Seite fragt den Fortschritt mit GET /projekt-kopie ab. */
      uebersetzeNeueKopie(kopie, quelle, beginn);
      return antworte(res, 202, { laeuft: true });
    }
    await oeffneProjekt(kopie);
    return antworte(res, 200, { aktuell: kopie, dauer: Date.now() - beginn });
  }
  if (req.method === 'GET' && url.pathname === '/projekt-kopie') return antworte(res, 200, kopieStand());
  if (req.method === 'POST' && url.pathname === '/projekt') {
    const eingabe = await lieseJson(req);
    const [kennung, teilApp] = String(eingabe.kennung ?? '').split('/');
    /* Anweisung 46: Wer woandershin wechselt, bricht den leeren Anfang ab; der Bereich bleibt leer und gestrichelt. */
    leerOffen = null;
    if (kennung === PROJEKT) { teilAppJe.set(PROJEKT, teilApp ?? null); return antworte(res, 200, { aktuell: PROJEKT }); }
    if (laeuftNochEtwas()) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Wechsle, wenn er fertig ist.' });
    if (!(kennung && await oeffneProjekt(kennung))) return antworte(res, 404, {});
    teilAppJe.set(kennung, teilApp ?? null);
    console.log(`Projekt geöffnet: ${PROJEKT}`);
    return antworte(res, 200, { aktuell: PROJEKT });
  }
  /* Anweisung 49 (d): Anträge an den Nähten. Der PO der anderen Teil-App nimmt an (dann wird es dort ein normaler Wunsch) oder lehnt ab. */
  if (req.method === 'POST' && url.pathname.startsWith('/antraege/')) {
    const id = url.pathname.slice('/antraege/'.length), { entscheidung } = await lieseJson(req);
    /* Aus dem Navigator: die Anträge des gelesenen Projekts */
    const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest ?? PROJEKT;
    const p = (await projekte()).find(x => x.kennung === quelle);
    if (!p || !['annehmen', 'ablehnen'].includes(entscheidung)) return antworte(res, 400, {});
    const liste = await antraegeVon(p.ordner), e = liste.find(x => x.id === id);
    if (!e) return antworte(res, 404, {});
    if (e.status !== 'offen') return antworte(res, 409, { grund: 'Über diesen Antrag ist schon entschieden.' });
    e.status = entscheidung === 'annehmen' ? 'angenommen' : 'abgelehnt';
    e.entschieden = { datum: new Date().toISOString(), wie: entscheidung === 'annehmen' ? 'vom PO mit „Annehmen“' : 'vom PO mit „Ablehnen“' };
    await fs.writeFile(antraegeDatei(p.ordner), `${JSON.stringify(liste, null, 2)}
`);
    const b = teilApps(liesProjektJson(p.ordner)?.bereiche).find(x => x.kennung === e.an);
    return antworte(res, 200, { projekt: p.kennung, an: e.an, prototyp: !!b?.prototyp, text: e.satz, status: e.status });
  }
  if (req.method === 'GET' && url.pathname === '/wuensche') return antworte(res, 200, await gespeicherteWuensche());
  if (req.method === 'GET' && url.pathname === '/plugins') return antworte(res, 200, await pluginStand());
  if (req.method === 'GET' && url.pathname === '/regeln') return antworte(res, 200, await regelDateien());
  if (req.method === 'GET' && url.pathname === '/in-kauf') return antworte(res, 200, await inKauf());
  if (req.method === 'GET' && url.pathname === '/offene-punkte') {
    const d = await offenePunkte(url.searchParams.get('umfang') ?? '');
    return d ? antworte(res, 200, d) : antworte(res, 404, {});
  }
  if (req.method === 'GET' && url.pathname === '/bedienungen') return antworte(res, 200, await bedienungsWahl());
  if (req.method === 'POST' && url.pathname === '/bedienungen') {
    const liste = await waehleBedienung(await lieseJson(req));
    return liste ? antworte(res, 200, liste) : antworte(res, 400, {});
  }
  /* Die Seite hat geladen und gemessen: Der volle Prüflauf startet erst dann die nächste Prüfung. */
  if (req.method === 'POST' && url.pathname === '/grundstock-anmerkung') {
    /* Liegt beim Navigator, nie beim gelesenen Projekt. */
    if (!liesProjektJson(PROJEKT_ORDNER)?.liest) return antworte(res, 400, {});
    const { kennung, text } = await lieseJson(req);
    const datei = path.join(PROJEKT_ORDNER, 'entscheidungen', 'grundstock-anmerkungen.json');
    const alle = JSON.parse(await fs.readFile(datei, 'utf8').catch(() => '{}'));
    /* Anweisung 33 (c): „Stimmt nicht“ zurücknehmen. Der Kasten gilt wieder als bestätigt, wenn sein Bereich bestätigt ist. */
    if (text === null) {
      delete alle[kennung];
      await fs.writeFile(datei, `${JSON.stringify(alle, null, 2)}\n`);
      const quelle = liesProjektJson(PROJEKT_ORDNER).liest;
      const p = (await projekte()).find(x => x.kennung === quelle);
      const grund = p ? JSON.parse(await fs.readFile(wegeVon(p.kennung, p.ordner).GRUNDFUNKTIONEN, 'utf8').catch(() => '[]')) : [];
      const bestDatei = path.join(PROJEKT_ORDNER, 'entscheidungen', 'grundstock-bestaetigung.json');
      const best = JSON.parse(await fs.readFile(bestDatei, 'utf8').catch(() => '{}'));
      const bereich = grund.find(g => g.kennung === kennung)?.bereich;
      if (!best[kennung] && grund.some(g => g.bereich === bereich && best[g.kennung])) {
        best[kennung] = { datum: new Date().toLocaleDateString('sv'), zeit: new Date().toISOString() };
        await fs.writeFile(bestDatei, `${JSON.stringify(best, null, 2)}\n`);
      }
      return antworte(res, 200, { bestaetigt: best[kennung] ? best[kennung].datum.split('-').reverse().join('.') : null });
    }
    alle[kennung] = { text, datum: new Date().toISOString() };
    await fs.mkdir(path.dirname(datei), { recursive: true });
    await fs.writeFile(datei, `${JSON.stringify(alle, null, 2)}\n`);
    return antworte(res, 200, {});
  }
  if (req.method === 'POST' && url.pathname === '/grundstock-bestaetigung') {
    /* Liegt beim Navigator, nie beim gelesenen Projekt. Gilt für alles, was noch nicht bestätigt und nicht als „Stimmt nicht“ markiert ist. */
    const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest;
    const p = quelle ? (await projekte()).find(x => x.kennung === quelle) : null;
    if (!p) return antworte(res, 400, {});
    const { bereich } = await lieseJson(req);
    const liesObjekt = async (d, sonst) => JSON.parse(await fs.readFile(d, 'utf8').catch(() => sonst));
    const ablage = path.join(PROJEKT_ORDNER, 'entscheidungen');
    const anmerkungen = await liesObjekt(path.join(ablage, 'grundstock-anmerkungen.json'), '{}');
    const datei = path.join(ablage, 'grundstock-bestaetigung.json');
    const alle = await liesObjekt(datei, '{}');
    const grund = await liesObjekt(wegeVon(p.kennung, p.ordner).GRUNDFUNKTIONEN, '[]');
    /* Anweisung 34 (d): Was ein Wunsch nach der Bestätigung berührt hat, ist wieder offen. */
    const geaendert = await liesObjekt(wegeVon(p.kennung, p.ordner).GRUNDSTOCK_GEAENDERT, '[]');
    const vorschlag = (k) => geaendert.some(e => e.kennung === k && (!alle[k]?.zeit || e.datum > alle[k].zeit));
    const kennungen = grund.filter(g => g.bereich === bereich && !anmerkungen[g.kennung] && (!alle[g.kennung] || vorschlag(g.kennung))).map(g => g.kennung);
    const tag = new Date().toLocaleDateString('sv');   // heutiger Tag in Ortszeit, JJJJ-MM-TT
    const zeit = new Date().toISOString();
    for (const k of kennungen) alle[k] = { datum: tag, zeit };
    await fs.mkdir(ablage, { recursive: true });
    await fs.writeFile(datei, `${JSON.stringify(alle, null, 2)}\n`);
    return antworte(res, 200, { datum: tag.split('-').reverse().join('.'), kennungen });
  }
  if (url.pathname === '/stand-speicher' && (req.method === 'GET' || req.method === 'POST')) {
    /* Die Prüfungen arbeiten ohne Speicher, es sei denn, sie prüfen genau ihn. */
    if (process.env.PLAY_OHNE_SPEICHER) return antworte(res, 200, { speicher: null, huelle: null });
    if (req.method === 'POST') {
      await fs.writeFile(STAND_SPEICHER, JSON.stringify(await lieseJson(req, 50 * 1024 * 1024)));
      return antworte(res, 200, {});
    }
    /* Ändert sich Play selbst, gilt kein gespeicherter Stand mehr. */
    const h = createHash('sha256');
    const ordner = path.join(PLAY, 'huelle');
    for (const n of (await fs.readdir(ordner)).sort()) h.update(n).update(await fs.readFile(path.join(ordner, n)));
    const text = await fs.readFile(STAND_SPEICHER, 'utf8').catch(() => null);
    let speicher = null;
    try { speicher = text ? JSON.parse(text) : null; } catch { /* unlesbar: neu rechnen */ }
    return antworte(res, 200, { speicher, huelle: h.digest('hex') });
  }
  if (req.method === 'POST' && url.pathname === '/gearbeitet') {
    const { szenarien, gueltig, zugriffe } = await lieseJson(req);
    await merkeGearbeitet(szenarien, gueltig, zugriffe);
    return antworte(res, 200, {});
  }
  /* Anweisung 45 (b): Plugins, die Play einmal im Hintergrund abgespielt hat, je mit Abdruck, Szenario und was sie anfassten. */
  if (req.method === 'GET' && url.pathname === '/einmal') {
    return antworte(res, 200, JSON.parse(await fs.readFile(EINMAL, 'utf8').catch(() => '{}')), true);
  }
  if (req.method === 'POST' && url.pathname === '/einmal') {
    const { kennung, abdruck, szenario, ereignis, zugriffe } = await lieseJson(req);
    if (!KENNUNG.test(kennung ?? '')) return antworte(res, 400, {});
    const alt = JSON.parse(await fs.readFile(EINMAL, 'utf8').catch(() => '{}'));
    alt[kennung] = { abdruck: abdruck ?? null, szenario: szenario ?? null, ereignis: ereignis ?? null, zugriffe: zugriffe ?? {}, datum: new Date().toLocaleDateString('sv-SE') };
    const neu = Object.fromEntries(Object.keys(alt).sort().map(k => [k, alt[k]]));
    await fs.writeFile(EINMAL, `${JSON.stringify(neu, null, 2)}\n`);
    return antworte(res, 200, {});
  }
  if (req.method === 'POST' && url.pathname === '/bereit') {
    console.log('Seite bereit');
    return antworte(res, 200, {});
  }
  if (req.method === 'GET' && url.pathname === '/faelle') return antworte(res, 200, await faelleOhneRegel());
  if (req.method === 'POST' && url.pathname === '/faelle') {
    const liste = await hakeFallAb(await lieseJson(req));
    return liste ? antworte(res, 200, liste) : antworte(res, 400, {});
  }
  if (req.method === 'GET' && url.pathname === '/abgleich') return antworte(res, 200, await abgleichStand());
  if (req.method === 'POST' && teile[0] === 'abgleich' && /^wunsch-\d+$/.test(teile[1] ?? '') && teile[2] === 'entscheide') {
    const e = await entscheideAbgleich(teile[1], await lieseJson(req));
    return e ? antworte(res, 200, {}) : antworte(res, 404, {});
  }
  if (req.method === 'POST' && url.pathname === '/in-kauf') {
    const v = await lieseJson(req);
    if (typeof v.schluessel !== 'string') return antworte(res, 400, {});
    await nimmInKauf([{ ...v, wie: 'vom PO per Klick „Bewusst in Kauf nehmen“', wunsch: null }]);
    return antworte(res, 200, await inKauf());
  }
  if (req.method === 'POST' && url.pathname === '/in-kauf/zurueck') {
    const { schluessel } = await lieseJson(req);
    await schreibeInKauf((await inKauf()).filter(e => e.schluessel !== schluessel));
    return antworte(res, 200, await inKauf());
  }

  if (req.method === 'POST' && teile[0] === 'plugin' && KENNUNG.test(teile[1] ?? '')) {
    const k = teile[1];
    const aus = await ausgeschaltet();
    if (teile[2] === 'aus') { await schreibeAusgeschaltet([...aus, k]); return antworte(res, 200, {}); }
    if (teile[2] === 'an') { await schreibeAusgeschaltet(aus.filter(x => x !== k)); return antworte(res, 200, {}); }
    if (teile[2] === 'loeschen') return antworte(res, await wirfWeg(k) ? 200 : 404, {});
    if (teile[2] === 'wiederherstellen') return antworte(res, await holeZurueck(k) ? 200 : 404, {});
    if (teile[2] === 'zurueck') return antworte(res, await zurueckZurVorigen(k) ? 200 : 404, {});
    if (teile[2] === 'aendern' || teile[2] === 'stimmt-nicht') {
      const d = await lieseJson(req, MIT_ANHAENGEN);
      if (!d.text || !String(d.text).trim()) return antworte(res, 400, {});
      if ((await aktuelleQuelle(k)) === null) return antworte(res, 404, {});
      const id = await naechsteKennung();
      const anhaenge = await nimmAnhaenge(id, d.anhaenge, 'wunsch');
      if (anhaenge.grund) return antworte(res, 400, anhaenge);
      const a = neuerAuftrag(id, { ...auftragsfelder(d), art: teile[2], ziel: k, anhaenge });
      return antworte(res, 200, sicht(a));
    }
    return antworte(res, 404, {});
  }

  /* Anweisung 44: Bereich leeren. Der Navigator bittet, Play tut es am gelesenen Projekt. Mit nurFragen sagt Play nur,
     wie oft es fragt (zweimal, wenn am Bereich der Grundstock hängt). */
  if (req.method === 'POST' && url.pathname === '/bereich-leeren') {
    const { bereich, nurFragen } = await lieseJson(req);
    const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest;
    const p = quelle ? (await projekte()).find(x => x.kennung === quelle) : null;
    const b = p && teilApps(liesProjektJson(p.ordner)?.bereiche).find(x => x.kennung === bereich);
    if (!b || !b.prototyp) return antworte(res, 400, { grund: 'In diesem Bereich gibt es nichts zu leeren.' });
    const w = wegeVon(p.kennung, p.ordner);
    if (nurFragen) return antworte(res, 200, { name: b.name, grundstock: await hatGrundstock(p.ordner, w, bereich) });
    if (laeuftNochEtwas() || (auftraegeJe.get(p.kennung) && [...auftraegeJe.get(p.kennung).values()].some(a => a.status === 'wartet' || a.status === 'arbeitet'))) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Leere den Bereich, wenn er fertig ist.' });
    const ergebnis = await leereBereich(p, w, bereich, PROJEKT_ORDNER);
    if (ergebnis.grund) return antworte(res, 400, ergebnis);
    if (teilAppJe.get(p.kennung) === bereich) teilAppJe.delete(p.kennung);
    console.log(`Bereich „${b.name}“ in ${p.name} geleert: ${ergebnis.plugins} Plugins, ${ergebnis.szenarien} Szenarien, ${ergebnis.regeln} Regeln; Sicherung in ${ergebnis.sicherung}`);
    return antworte(res, 200, ergebnis);
  }

  /* Anweisung 45 (e): Sicherung zurückholen, am gelesenen Projekt. Play sichert vorher den jetzigen Stand. */
  if (req.method === 'POST' && url.pathname === '/sicherung-zurueckholen') {
    const { sicherung } = await lieseJson(req);
    const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest;
    const p = quelle ? (await projekte()).find(x => x.kennung === quelle) : null;
    if (!p) return antworte(res, 400, { grund: 'Hier gibt es keine Sicherungen.' });
    if (laeuftNochEtwas() || (auftraegeJe.get(p.kennung) && [...auftraegeJe.get(p.kennung).values()].some(a => a.status === 'wartet' || a.status === 'arbeitet'))) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Hol die Sicherung zurück, wenn er fertig ist.' });
    const ergebnis = await holeSicherungZurueck(p, wegeVon(p.kennung, p.ordner), String(sicherung ?? ''));
    if (ergebnis.grund) return antworte(res, 400, ergebnis);
    teilAppJe.delete(p.kennung);
    console.log(`Sicherung ${sicherung} in ${p.name} zurückgeholt; der Stand davor liegt in ${ergebnis.sicherung}`);
    return antworte(res, 200, ergebnis);
  }

  /* Entscheidung 7: Der Navigator bittet um einen Prototyp. Play öffnet das gelesene Projekt und nimmt die Beschreibung an. */
  if (req.method === 'POST' && url.pathname === '/prototyp-vormerken') {
    const { bereich } = await lieseJson(req);
    /* Aus dem Navigator: das gelesene Projekt; aus dem Wähler von Play: das offene. */
    const quelle = liesProjektJson(PROJEKT_ORDNER)?.liest ?? PROJEKT;
    const p = (await projekte()).find(x => x.kennung === quelle);
    const b = p && teilApps(liesProjektJson(p.ordner)?.bereiche).find(x => x.kennung === bereich);
    if (!b || b.prototyp) return antworte(res, 400, { grund: 'Dieser Bereich ist nicht leer.' });
    if (laeuftNochEtwas()) return antworte(res, 409, { grund: 'Ein Wunsch wird gerade bearbeitet. Beginne, wenn er fertig ist.' });
    if (p.kennung !== PROJEKT) await oeffneProjekt(p.kennung);
    /* Anweisung 46: sofort die neue, leere Teil-App öffnen */
    leerOffen = { projekt: p.kennung, bereich: b.kennung, name: b.name };
    return antworte(res, 200, {});
  }
  /* Anweisung 46: Abbrechen, bevor etwas abgeschickt ist. Im Projekt hat sich nichts geändert. */
  if (req.method === 'POST' && url.pathname === '/prototyp-abbrechen') {
    leerOffen = null;
    return antworte(res, 200, {});
  }
  if (req.method === 'POST' && teile[0] === 'prototyp' && KENNUNG.test(teile[1] ?? '')) {
    const d = await lieseJson(req, MIT_ANHAENGEN);
    if (!d.text || !String(d.text).trim()) return antworte(res, 400, {});
    const b = teilApps(liesProjektJson(PROJEKT_ORDNER)?.bereiche).find(x => x.kennung === teile[1]);
    if (!b || b.prototyp) return antworte(res, 400, { grund: 'Dieser Bereich ist nicht leer.' });
    const id = await naechsteKennung();
    const anhaenge = await nimmAnhaenge(id, d.anhaenge, 'wunsch');
    if (anhaenge.grund) return antworte(res, 400, anhaenge);
    const a = neuerAuftrag(id, { ...auftragsfelder(d), art: 'prototyp', bereich: b.kennung, anhaenge });
    return antworte(res, 200, sicht(a));
  }
  if (req.method === 'POST' && url.pathname === '/wunsch') {
    const d = await lieseJson(req, MIT_ANHAENGEN);
    if (!d.text || !String(d.text).trim()) return antworte(res, 400, {});
    const id = await naechsteKennung();
    const anhaenge = await nimmAnhaenge(id, d.anhaenge, 'wunsch');
    if (anhaenge.grund) return antworte(res, 400, anhaenge);
    const a = neuerAuftrag(id, { ...auftragsfelder(d), art: 'wunsch', anhaenge });
    return antworte(res, 200, sicht(a));
  }

  /* Anhang aus der Herkunft eines Plugins öffnen: /anhang/<plugin>/anhaenge/<wunsch>/<datei> */
  if (req.method === 'GET' && teile[0] === 'anhang' && KENNUNG.test(teile[1] ?? '') && teile[2] === 'anhaenge') {
    const wurzel = path.join(BAUSTEINE, teile[1], 'anhaenge');
    const ziel = path.resolve(wurzel, ...teile.slice(3).map(decodeURIComponent));
    const art = ANHANG_ARTEN[path.extname(ziel).toLowerCase()];
    if (!ziel.startsWith(wurzel + path.sep) || !art || !existsSync(ziel)) { res.writeHead(404); res.end(); return; }
    const kopf = { 'Content-Type': art, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (art.startsWith('application/vnd')) kopf['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(ziel))}`;
    res.writeHead(200, kopf);
    res.end(await fs.readFile(ziel));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/gespielt') {
    const { drehbuch } = await lieseJson(req);
    if (!Array.isArray(drehbuch?.ereignisse) || !drehbuch.ereignisse.length) return antworte(res, 400, {});
    return antworte(res, 200, await behalteGespieltes(drehbuch));
  }

  if (req.method === 'DELETE' && teile[0] === 'gespielt' && /^gespielt-\d+$/.test(teile[1] ?? '')) {
    await fs.rm(path.join(GESPIELT, `${teile[1]}.js`), { force: true });
    await fs.rm(sollDatei(teile[1]), { force: true });
    return antworte(res, 200, {});
  }

  if (req.method === 'GET' && url.pathname === '/unbestaetigt') return antworte(res, 200, (await unbestaetigte()).map(offeneSicht));
  if (req.method === 'GET' && url.pathname === '/sollergebnisse') return antworte(res, 200, await sollergebnisse(), true);

  if (teile[0] === 'sollergebnis' && /^[a-z0-9][a-z0-9-]*$/i.test(teile[1] ?? '')) {
    if (req.method === 'PUT') {
      const e = await lieseJson(req, 5000000);
      if (typeof e.zuletzt !== 'string' || !e.je || typeof e.je !== 'object') return antworte(res, 400, {});
      await schreibeSollergebnis(teile[1], e);
      return antworte(res, 200, {});
    }
    if (req.method === 'DELETE') {
      await fs.rm(sollDatei(teile[1]), { force: true });
      return antworte(res, 200, {});
    }
  }

  if (teile[0] === 'wunsch' && /^wunsch-\d+$/.test(teile[1] ?? '')) {
    /* Nach einem Neustart kennt Play nur noch die offenen Wünsche, die in der Datei stehen. */
    const a = auftraege.get(teile[1]) ?? (await unbestaetigte()).find(x => x.id === teile[1]);
    if (!a) return antworte(res, 404, {});

    if (req.method === 'POST' && teile[2] === 'bestaetigen') {
      if (a.status !== 'behalten') return antworte(res, 409, {});
      await bestaetigeWunsch(a);
      auftraege.delete(a.id);
      return antworte(res, 200, {});
    }
    if (req.method === 'DELETE') {
      if (await neuererStandAmPlugin(a)) return antworte(res, 409, { grund: 'Ein späterer Wunsch hat dasselbe Plugin weiter geändert. Nimm zuerst den späteren zurück.' });
      await nimmZurueck(a);
      await vergissUnbestaetigt(a.id);
      auftraege.delete(a.id);
      return antworte(res, 200, {});
    }
    if (req.method === 'GET' && !teile[2]) return antworte(res, 200, sicht(a));

    /* Antwort auf eine Rückfrage: Wunsch, Rückfrage und Antwort gehen zusammen an die KI zurück
       und stehen im Wortlaut in der Herkunft. „So machen“: Die vorgeschlagenen Teile kommen
       nacheinander als eigene kleine Aufträge, der nächste erst, wenn die Seite „weiter“ sagt. */
    if (req.method === 'POST' && teile[2] === 'antwort') {
      if (a.status !== 'rueckfrage') return antworte(res, 409, {});
      const d = await lieseJson(req, MIT_ANHAENGEN);
      const text = String(d.text || '').trim();
      /* Ein Teil wird nicht noch einmal aufgeteilt; seine Rückfrage beantwortet der PO mit Text. */
      const vorschlag = (!a.teil && Array.isArray(a.antwort?.teile) ? a.antwort.teile : []).map(t => String(t || '').trim()).filter(Boolean);
      const soMachen = !!d.soMachen && vorschlag.length > 0;
      if (!text && !soMachen) return antworte(res, 400, {});
      const anhaenge = await nimmAnhaenge(a.anhangVon, d.anhaenge, 'antwort', alleAnhaenge(a));
      if (anhaenge.grund) return antworte(res, 400, anhaenge);
      a.dialog.push({ rueckfrage: a.antwort.rueckfrage, teile: vorschlag.length ? vorschlag : undefined, antwort: text || null, soMachen, datum: new Date().toISOString(), anhaenge });
      if (d.stand) a.stand = d.stand;
      if (d.drehbuch !== undefined) a.drehbuch = d.drehbuch;
      if (soMachen) {
        a.status = 'aufgeteilt';
        a.teile = vorschlag;
        a.teilNr = 0;
        return antworte(res, 200, sicht(await naechsterTeil(a)));
      }
      a.sitzung = null;   // frisch, mit dem ganzen Stand und dem Gespräch im Auftrag
      a.antwort = null;
      a.auswahl = undefined;   // Die Antwort kann weitere Fachobjekte ins Spiel bringen
      a.volltextRunden = 0;
      a.nachgereicht = false;
      einreihen(a, () => auftragstext(a));
      return antworte(res, 200, sicht(a));
    }
    if (req.method === 'POST' && teile[2] === 'weiter') {
      if (a.status !== 'aufgeteilt') return antworte(res, 409, {});
      const d = await lieseJson(req);
      if (d.stand) a.stand = d.stand;
      if (d.drehbuch !== undefined) a.drehbuch = d.drehbuch;
      const t = await naechsterTeil(a);
      return antworte(res, 200, t ? sicht(t) : { fertig: true });
    }

    if (req.method === 'POST' && teile[2] === 'nachbessern') {
      const { fehler, szenarien } = await lieseJson(req);
      a.antwort = null;
      einreihen(a, async () => `Der Probelauf auf der Seite ist nicht sauber durchgelaufen:\n\n${fehler}${await abweichendeSzenarien(a, szenarien)}\n\nFinde die Ursache und gib die vollständige Antwort neu aus. Sind die Erwartungen im neuen Drehbuch falsch gerechnet, korrigiere sie. Widerspricht deine Änderung bewusst einer Erwartung in einem vorhandenen Drehbuch, liefere genau diese in \"erwartungen\" geändert mit; alle anderen bleiben fest.`);
      return antworte(res, 200, sicht(a));
    }
    /* Anweisung 36: Im Probelauf hat ein Plugin mitgewirkt, das die KI nicht kannte: einmal mit diesem Plugin neu. */
    if (req.method === 'POST' && teile[2] === 'nachreichen') {
      const { plugins, fehler, szenarien } = await lieseJson(req);
      const fremd = (Array.isArray(plugins) ? plugins : []).filter(k => typeof k === 'string' && KENNUNG.test(k) && a.mitgegeben && !a.mitgegeben.includes(k));
      const quellen = [];
      for (const k of fremd) { const q = await aktuelleQuelle(k); if (q) quellen.push(`### Plugin \`${k}\`\n\n\`\`\`js\n${q}\n\`\`\``); }
      if (!quellen.length) return antworte(res, 409, {});
      a.mitgegeben = null;   // nur einmal je Auftrag
      a.nachgereicht = true;
      for (const k of fremd) a.auswahl?.volltext?.add(k);
      a.antwort = null;
      einreihen(a, async () => `Im Probelauf auf der Seite hat ein Plugin mitgewirkt, das du noch nicht kanntest. Das hat sich ergeben:\n\n${String(fehler || 'Ein Szenario endet anders.')}${await abweichendeSzenarien(a, szenarien)}\n\nDas Plugin:\n\n${quellen.join('\n\n')}\n\nPrüfe damit dein Ergebnis, finde die Ursache und gib die vollständige Antwort neu aus. Sind die Erwartungen im neuen Drehbuch falsch gerechnet, korrigiere sie. Widerspricht deine Änderung bewusst einer Erwartung in einem vorhandenen Drehbuch, liefere genau diese in \"erwartungen\" geändert mit; alle anderen bleiben fest. Passt es so, wie es ist, gib dieselbe Antwort noch einmal.`);
      return antworte(res, 200, sicht(a));
    }
    if (req.method === 'POST' && teile[2] === 'behalten') {
      if (a.status !== 'fertig' || !a.ergebnis) return antworte(res, 409, {});
      /* „Trotzdem einspielen“: Der PO überstimmt die Regel. Nie still: Entscheidung mit Datum
         an der Fassung, die Verstöße gelten als bewusst in Kauf genommen und bleiben sichtbar. */
      const { ueberstimmt, ungeprueft } = await lieseJson(req);
      a.ueberstimmt = Array.isArray(ueberstimmt) ? ueberstimmt.filter(v => v && typeof v.schluessel === 'string') : [];
      /* Anweisung 57 (c): Kein Szenario hat geprüft, was der Wunsch tut; das steht am Hinweis und an der Fassung. */
      a.ungeprueft = ungeprueft === true;
      const vorher = a.ergebnis.kennung && a.ergebnis.art !== 'neu' ? await aktuelleQuelle(a.ergebnis.kennung) : null;
      await behalte(a);
      /* Im Hintergrund: Der PO spielt weiter, das Ergebnis kommt als Satz. */
      starteAbgleich(a, vorher).catch(e => console.error(`${a.id} Abgleich:`, e));
      if (a.ueberstimmt.length) {
        await nimmInKauf(a.ueberstimmt.map(v => ({ ...v, wie: `vom PO mit „Trotzdem einspielen“ bei Wunsch ${a.id}`, wunsch: a.id })));
      }
      a.status = 'behalten';
      await merkeUnbestaetigt(a);
      return antworte(res, 200, {});
    }
  }

  if (req.method === 'GET') return liefereDatei(req, res, url.pathname);
  res.writeHead(404); res.end();
}

function oeffneBrowser() {
  if (process.argv.includes('--ohne-browser')) return;
  spawn('cmd', ['/c', 'start', '', `http://127.0.0.1:${PORT}/`], { detached: true, stdio: 'ignore' }).unref();
}

const server = http.createServer((req, res) => {
  bearbeite(req, res).catch(e => {
    console.error(e);
    if (!res.headersSent) antworte(res, 500, {});
    else res.end();
  });
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { oeffneBrowser(); process.exit(0); }   // läuft schon
  throw e;
});
/* Das zuletzt geöffnete Projekt kommt nach dem Neustart wieder. */
try {
  const { projekt } = JSON.parse(readFileSync(ZULETZT, 'utf8'));
  if (projekt && projekt !== STAMM) await oeffneProjekt(projekt, { merken: false });
} catch { /* keins gemerkt: Bodenabfertigung */ }
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Play läuft auf http://127.0.0.1:${PORT}/  (Fenster offen lassen, Strg+C beendet)`);
  oeffneBrowser();
});
