/* Prüft den Nachtrag des PO zu 005 (07.11.2026, vorgezogen in 006): Drehbücher laufen in getrennten
   unsichtbaren Kopien gleichzeitig. Die Ergebnisse dürfen nicht davon abhängen: je Drehbuch derselbe
   Endstand, dieselben Meldungen, dieselbe Reihenfolge wie nacheinander. Dazu Fortschritt und Dauer.
   Läuft auf einer eigenen Brücke mit einer Kopie deines Stands.
   Aufruf: node pruefung/gleichzeitig.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse } = await eigeneBruecke(4363, { mitKopie: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}

/* Wie Chrome und Edge auf dem Desktop: jede Adresse in ihrem eigenen Prozess */
const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const beginn = Date.now();
await p.goto(adresse);
await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });
console.log(`     Start bis „Ursachen ermittelt“: ${((Date.now() - beginn) / 1000).toFixed(1)} s`);

const kerne = await p.evaluate(() => Huelle.nachspiel.kerne);
pruefe(`so viele Kopien gleichzeitig wie Kerne (${kerne})`, kerne === await p.evaluate(() => window.PLAY_KERNE || navigator.hardwareConcurrency));   // im vollen Lauf: Anteil dieser Prüfung

/* Ein Lauf über alle Drehbücher, auf `teile` Kopien verteilt; Dauer und Fortschritt mitgeschrieben */
const lauf = teile => p.evaluate(teile => new Promise(ok => {
  const t = performance.now(), schritte = [];
  Huelle.nachspiel.lauf(null, r => ok({ r, ms: performance.now() - t, schritte }),
    { teile, mitEndstand: true, roh: true, fortschritt: (f, g) => schritte.push([f, g]) });
}), teile);

/* Was ein Lauf je Drehbuch liefert, ohne die Dinge, die nur die Kopie selbst betreffen */
const kern = r => ({
  abweichungen: r.abweichungen, ausfaelle: r.ausfaelle, widersprueche: r.widersprueche,
  drehbuecher: r.drehbuecher.map(d => ({ ...d }))
});

const nacheinander = await lauf(1);
const gleichzeitig = await lauf(kerne);
const n = await p.evaluate(() => Huelle.drehbuecher.length);
pruefe(`nacheinander alle ${n} Szenarien gespielt`, nacheinander.r.drehbuecher.length === n);
pruefe('gleichzeitig dieselben Szenarien in derselben Reihenfolge',
  JSON.stringify(gleichzeitig.r.drehbuecher.map(d => d.kennung)) === JSON.stringify(nacheinander.r.drehbuecher.map(d => d.kennung)),
  gleichzeitig.r.drehbuecher.map(d => d.kennung));
const a = kern(nacheinander.r), b = kern(gleichzeitig.r);
a.drehbuecher.forEach((d, i) => {
  const e = b.drehbuecher[i] || {};
  const gleich = k => JSON.stringify(d[k]) === JSON.stringify(e[k]);
  const anders = Object.keys(d).filter(k => !gleich(k));
  pruefe(`${d.titel}: gleicher Endstand, gleiche Meldungen`, !anders.length, anders);
});
for (const k of ['abweichungen', 'ausfaelle', 'widersprueche']) {
  pruefe(`gleiche ${k} in gleicher Reihenfolge`, JSON.stringify(a[k]) === JSON.stringify(b[k]), [a[k], b[k]]);
}
pruefe('Fortschritt zählt bis zur Zahl der Szenarien',
  gleichzeitig.schritte.length >= n && gleichzeitig.schritte.at(-1)[0] === n && gleichzeitig.schritte.at(-1)[1] === n, gleichzeitig.schritte);
console.log(`     ein Lauf über ${n} Szenarien: nacheinander ${(nacheinander.ms / 1000).toFixed(1)} s, gleichzeitig ${(gleichzeitig.ms / 1000).toFixed(1)} s`);
pruefe('gleichzeitig schneller als nacheinander', gleichzeitig.ms < nacheinander.ms, [nacheinander.ms, gleichzeitig.ms]);

/* Ein zweiter gleichzeitiger Lauf liefert wieder dasselbe (kein Zufall in der Reihenfolge des Fertigwerdens) */
const nochmal = await lauf(kerne);
pruefe('zweiter gleichzeitiger Lauf: dasselbe Ergebnis', JSON.stringify(kern(nochmal.r)) === JSON.stringify(b));

/* Probelauf wie nach einem Wunsch (ohne Neues): Fortschritt in Drehbüchern, beide Läufe zusammen */
const probe = await p.evaluate(() => new Promise(ok => {
  const t = performance.now(), schritte = [];
  Huelle.nachspiel.probe([], [], r => ok({ r, ms: performance.now() - t, schritte }), (f, g) => schritte.push([f, g]));
}));
pruefe('Probelauf ohne Neues: nichts ausgefallen, kein neuer Verstoß', !probe.r.ausfaelle.length && !probe.r.verstoesse.length, probe.r);
pruefe('Probelauf meldet Fortschritt bis zum Ende', probe.schritte.length > 1 && probe.schritte.at(-1)[0] === probe.schritte.at(-1)[1], probe.schritte.slice(-3));
console.log(`     Probelauf (vorher und nachher, je ${n} Szenarien): ${(probe.ms / 1000).toFixed(1)} s`);

/* Was der PO beim Probelauf liest */
const satz = await p.evaluate(() => Huelle.wunsch.probeSatz && Huelle.wunsch.probeSatz(7, 28, Date.now() - 3000));
pruefe('Satz beim Probelauf: „Probelauf: 3 von 14 Szenarien“ mit Restzeit', /^Probelauf: 3 von 14 Szenarien, noch etwa \d+ s$/.test(satz || ''), satz);

await browser.close();
console.log(fehler ? `${fehler} FEHL` : 'alles grün');
process.exit(fehler ? 1 : 0);
