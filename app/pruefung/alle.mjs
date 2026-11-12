/* Lässt die Prüfungen gleichzeitig laufen (Anweisung 17 des PO, 08.11.2026) und meldet sich unterwegs im Terminal (AGENTS.md: Fortschritt ist immer sichtbar):
   beim Start einer Prüfung ihr Name, beim Ende „grün“ oder „ROT“ mit Dauer und „7 von 17“.
   Am Schluss die Ergebnisse nach Prüfung sortiert. Die längsten Prüfungen starten zuerst
   (Dauern vom letzten Lauf), damit der Lauf nicht auf eine späte lange Prüfung wartet.
   Ohne die Prüfungen gegen das echte Abo (echte-ki*) und ohne das Werkzeug endstand-festhalten.
   Wie viele gleichzeitig (Vorgabe des PO, 08.11.2026): Play spielt Szenarien in unsichtbaren Kopien.
   Im ganzen Lauf sind zusammen höchstens so viele Kopien offen, wie der Rechner Kerne hat, minus 2
   (der PO arbeitet nebenher). Innerhalb einer Prüfung laufen die Szenarien darum nacheinander (eine
   Kopie je Prüfung); nur `gleichzeitig` bekommt zwei, weil sie das gleichzeitige Abspielen selbst prüft.
   Vorher spielte jede Prüfung zusätzlich auf allen Kernen; doppelt gleichzeitig überlastete den Rechner.
   Start gestaffelt (Vorgabe des PO, 09.11.2026): Höchstens 3 Prüfungen laufen gleichzeitig, und die nächste
   startet erst, wenn die zuletzt gestartete ihre Seite geladen hat (sie sagt „Seite geladen“) oder fertig ist.
   Vorher starteten 10 auf einmal; dann kam keine bis zur ersten Prüfung, alle liefen beim Laden in die Zeit.
   Aufruf: node pruefung/alle.mjs [--nacheinander] [name …]   (ohne Namen: alle) */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const OHNE = ['eigene-bruecke', 'endstand-festhalten', 'echte-ki', 'echte-ki-regel', 'echte-ki-abgleich', 'echte-ki-anhang', 'alle'];
const argumente = process.argv.slice(2);
const nacheinander = argumente.includes('--nacheinander');
const gewuenscht = argumente.filter(a => !a.startsWith('--'));
const namen = readdirSync(HIER).filter(d => d.endsWith('.mjs')).map(d => d.slice(0, -4))
  .filter(n => gewuenscht.length ? gewuenscht.includes(n) : !OHNE.includes(n));

/* Dauern vom letzten Lauf: für die Reihenfolge und die Schätzung „noch etwa“ */
const DAUERN = path.join(os.tmpdir(), 'play-pruefdauern.json');
let frueher = {};
try { frueher = JSON.parse(readFileSync(DAUERN, 'utf8')); } catch { /* erster Lauf */ }
const schaetzung = n => frueher[n] ?? 60000;
const reihe = [...namen].sort((a, b) => schaetzung(b) - schaetzung(a));

const KERNE = os.availableParallelism?.() ?? os.cpus().length;
/* Kopien für den ganzen Lauf und je Prüfung */
const KOPIEN_GESAMT = nacheinander ? 1 : Math.max(1, KERNE - 2);
const BEDARF = { gleichzeitig: 2 };
const HOECHSTENS = nacheinander ? 1 : 3;   // Prüfungen gleichzeitig
const SEITE_FRIST = 180000;                 // so lange wartet der Start der nächsten höchstens auf „Seite geladen“
const bedarf = n => Math.min(KOPIEN_GESAMT, BEDARF[n] ?? 1);
let frei = KOPIEN_GESAMT;
const sek = ms => Math.round(ms / 1000);
const beginn = Date.now();
const ergebnisse = {};
const laufend = new Map();   // name → Startzeit
let fertig = 0;
let naechste = 0;            // Index in reihe: die nächste Prüfung, die startet

/* Grobe Restzeit: was die laufenden noch brauchen und was noch wartet, verteilt auf die Plätze */
function rest() {
  const jetzt = Date.now();
  const offen = [...laufend].reduce((s, [n, t]) => s + Math.max(0, schaetzung(n) - (jetzt - t)), 0)
    + reihe.slice(naechste).reduce((s, n) => s + schaetzung(n), 0);
  return sek(offen / Math.min(HOECHSTENS, KOPIEN_GESAMT, namen.length));
}

console.log(`${namen.length} Prüfungen, höchstens ${HOECHSTENS} gleichzeitig, gestaffelt nach dem Laden der Seite, zusammen höchstens ${KOPIEN_GESAMT} Kopien zum Abspielen (Rechner mit ${KERNE} Kernen, 2 bleiben frei)${Object.keys(frueher).length ? `, etwa ${rest()} s` : ''}`);

/* Startet die nächste Prüfung, sobald weniger als HOECHSTENS laufen, genug Kopien frei sind und die zuletzt
   gestartete ihre Seite geladen hat; der Reihe nach, die längsten zuerst. */
let laedt = null;            // die zuletzt gestartete Prüfung, solange ihre Seite noch lädt
let alleFertig;
const ende = new Promise(ok => { alleFertig = ok; });
function geladen(name) {
  if (laedt !== name) return;
  laedt = null;
  starteNaechste();
}
function starteNaechste() {
  while (naechste < reihe.length && !laedt && laufend.size < HOECHSTENS && bedarf(reihe[naechste]) <= frei) {
    const name = reihe[naechste];
    frei -= bedarf(name);
    pruefung(name).then(() => {
      frei += bedarf(name);
      geladen(name);
      if (fertig === namen.length) alleFertig(); else starteNaechste();
    });
  }
}

async function pruefung(name) {
  {
    const start = Date.now();
    laedt = name;
    setTimeout(() => geladen(name), SEITE_FRIST);
    naechste++;
    laufend.set(name, start);
    console.log(`  ${name} läuft … (${laufend.size} laufen, ${fertig} von ${namen.length} fertig)`);
    const { code, ausgabe } = await new Promise(ende => {
      const kind = spawn(process.execPath, [path.join(HIER, name + '.mjs')], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PLAY_KERNE: String(bedarf(name)) } });
      let ausgabe = '';
      kind.stdout.on('data', d => {
        ausgabe += d;
        if (/Seite geladen/.test(String(d))) { console.log(`  ${name}: Seite geladen nach ${sek(Date.now() - start)} s`); geladen(name); }
      });
      kind.stderr.on('data', d => { ausgabe += d; });
      kind.on('exit', code => ende({ code, ausgabe }));
    });
    laufend.delete(name);
    fertig++;
    const ok = (ausgabe.match(/^ok /gm) || []).length, fehl = (ausgabe.match(/^FEHL/gm) || []).length;
    const gruen = code === 0 && fehl === 0, dauer = Date.now() - start;
    ergebnisse[name] = { gruen, dauer, ok, fehl, ausgabe };
    frueher[name] = dauer;
    const noch = fertig < namen.length ? ` · noch etwa ${rest()} s` : '';
    console.log(`${fertig} von ${namen.length}: ${name} ${gruen ? 'grün' : 'ROT'} nach ${sek(dauer)} s · ok ${ok} · FEHL ${fehl}${noch}`);
    if (!gruen) {
      /* Ganze Ausgabe sichern; im Terminal die FEHL-Zeilen und die letzten Zeilen vor dem Abbruch */
      const datei = path.join(os.tmpdir(), `play-pruefung-${name}.txt`);
      try { writeFileSync(datei, ausgabe); } catch { /* nur zur Ursachensuche */ }
      const zeilen = ausgabe.split('\n').filter(z => z.trim());
      const fehlzeilen = zeilen.filter(z => /^FEHL/.test(z)).slice(0, 15);
      console.log([...fehlzeilen, '… zuletzt:', ...zeilen.slice(-8)].map(z => '    ' + z).join('\n') + `\n    ganze Ausgabe: ${datei}`);
    }
  }
}
starteNaechste();
await ende;

try { writeFileSync(DAUERN, JSON.stringify(frueher, null, 1)); } catch { /* nur für die Schätzung */ }

const rote = namen.filter(n => !ergebnisse[n].gruen).sort();
console.log('\nErgebnisse nach Prüfung:');
for (const n of [...namen].sort()) {
  const e = ergebnisse[n];
  console.log(`  ${e.gruen ? 'grün' : 'ROT '}  ${n.padEnd(26)} ${String(sek(e.dauer)).padStart(4)} s · ok ${e.ok} · FEHL ${e.fehl}`);
}
const summe = namen.reduce((s, n) => s + ergebnisse[n].dauer, 0);
console.log(`Alle ${namen.length} Prüfungen in ${sek(Date.now() - beginn)} s (nacheinander wären es ${sek(summe)} s): ${rote.length ? 'ROT: ' + rote.join(', ') : 'alle grün'}`);
process.exit(rote.length ? 1 : 0);
