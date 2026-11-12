/* Prüft Anweisung 23 des PO (09.11.): Beim Start steht der gespeicherte Stand sofort da, mit „Stand von …“.
   Hat sich nichts geändert, wird nichts gerechnet. Ändert sich ein Plugin, werden nur die Szenarien neu gespielt, in denen es arbeitet.
   Aufruf: node pruefung/schneller-start.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const b = await eigeneBruecke(4396, { mitKopie: true, mitSpeicher: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 700) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
let kopien = 0;
p.on('request', r => { if (/nachspielen=1/.test(r.url())) kopien++; });

const steht = () => p.waitForFunction(() => window.Huelle?.geladen, null, { timeout: 60000, polling: 50 });
const fertig = () => p.waitForFunction(() => Huelle.verwaltung.fertig() && Huelle.verwaltung.letzterStart(), null, { timeout: 180000, polling: 100 });
const stand = () => p.evaluate(() => ({
  start: Huelle.verwaltung.letzterStart(), alle: Huelle.drehbuecher.length,
  krank: Huelle.verwaltung.betroffene(['verhalten-krankmeldung']),
  verstoesse: Huelle.waechter.amEnde('krankmeldung-ma-01')
}));
const zeile = () => p.evaluate(() => { const e = document.querySelector('#standZeile'); return e.hidden ? null : e.textContent; });

try {
  console.log('-- Erster Start, ohne gespeicherten Stand');
  await p.goto(b.adresse);
  await steht();
  await fertig();
  const erst = await stand();
  pruefe('rechnet alles', erst.start.art === 'voll' && erst.start.szenarien === erst.alle, erst.start);
  for (let i = 0; i < 50 && !existsSync(b.speicher); i++) await new Promise(r => setTimeout(r, 100));
  pruefe('der Stand ist gespeichert', existsSync(b.speicher));
  await p.waitForTimeout(500);

  console.log('-- Zweiter Start, nichts geändert');
  kopien = 0;
  const t0 = Date.now();
  await p.reload();
  await steht();
  await p.waitForFunction(() => !document.querySelector('#standZeile').hidden, null, { timeout: 5000, polling: 20 });
  const sofort = Date.now() - t0;
  const text = await zeile();
  pruefe('„Stand von“ steht gleich da', /^Stand von \d\d:\d\d/.test(text || ''), text);
  await fertig();
  const zweit = await stand();
  console.log(`     Stand sichtbar nach ${(sofort / 1000).toFixed(1)} s`);
  pruefe('es wird gar nicht gerechnet', zweit.start.art === 'unveraendert' && kopien === 0, { start: zweit.start, kopien });
  pruefe('dieselben Zahlen wie vorher', JSON.stringify(zweit.krank) === JSON.stringify(erst.krank) && JSON.stringify(zweit.verstoesse) === JSON.stringify(erst.verstoesse), { erst, zweit });

  console.log('-- Ein Plugin ändert sich');
  const ordner = path.join(b.plugindaten, 'bausteine', 'verhalten-einsatz');
  const h = JSON.parse(readFileSync(path.join(ordner, 'herkunft.json'), 'utf8'));
  const datei = path.join(ordner, `fassung-${String(h.aktuell).padStart(3, '0')}.js`);
  const quelle = readFileSync(datei, 'utf8');
  pruefe('Testfall: das Plugin hat keine eigene Anzeige', !/\b(ansicht|ergaenzt|beschreibe)\s*:/.test(quelle));
  writeFileSync(datei, quelle.replace(/function \(m, h\) \{/, 'function (m, h) { /* geändert */'));
  kopien = 0;
  await p.reload();
  await steht();
  await p.waitForFunction(() => /^Rechne nach/.test(document.querySelector('#standZeile').textContent), null, { timeout: 8000, polling: 20 });
  /* Das Nachrechnen ist schnell vorbei: den Text im selben Augenblick festhalten, in dem er passt. */
  const unterwegs = await p.waitForFunction(() => { const t = document.querySelector('#standZeile').textContent; return /^Rechne nach: .+ · \d+ von \d+$/.test(t) && t; }, null, { timeout: 8000, polling: 20 }).then(h => h.jsonValue()).catch(() => null);
  pruefe('beim Nachrechnen steht dort, was läuft und wie weit', !!unterwegs, await zeile());
  await fertig();
  const dritt = await stand();
  console.log(`     ${dritt.start.szenarien} von ${dritt.alle} Szenarien neu gespielt`);
  pruefe('nur die Szenarien, in denen es arbeitet', dritt.start.art === 'teil' && dritt.start.szenarien > 0 && dritt.start.szenarien < dritt.alle, dritt.start);
  await p.waitForFunction(() => !/Rechne nach/.test(document.querySelector('#standZeile').textContent), null, { timeout: 5000 });
  pruefe('danach steht wieder nur der Stand da', /^Stand von \d\d:\d\d$/.test(await zeile()), await zeile());
  pruefe('alle Szenarien bleiben bekannt', dritt.krank && dritt.krank.length === erst.krank.length, dritt.krank);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `${fehler} Prüfung(en) rot` : 'alles grün');
process.exit(fehler ? 1 : 0);
