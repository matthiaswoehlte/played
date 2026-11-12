/* Hält den Endstand jedes Drehbuchs fest, je Variante. Damit lässt sich zeigen, dass ein Umbau
   am Verhalten nichts ändert: vorher festhalten, nachher festhalten, beide Dateien vergleichen.
   Aufruf: node pruefung/endstand-festhalten.mjs <zieldatei> */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse } = await eigeneBruecke(4329, { mitKopie: true });

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
p.on('pageerror', e => console.log('Seitenfehler:', e.message));
await p.goto(adresse);
await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const out = {};
const varianten = await p.evaluate(() => Huelle.plaetze().flatMap(pl => pl.varianten.map(v => v.kennung)));
for (const variante of varianten.length ? varianten : ['ohne-varianten']) {
  if (variante !== 'ohne-varianten') await p.evaluate(k => Huelle.wechsle(k), variante);
  const teil = await p.evaluate(() => new Promise(fertig => {
    Huelle.nachspiel.lauf(null, r => fertig(r), { mitEndstand: false, roh: true });
  }));
  out[variante] = teil.drehbuecher.map(d => ({ kennung: d.kennung, endstand: d.roh, erwartung: d.erwartung })).sort((a, b) => a.kennung < b.kennung ? -1 : 1);
  if (teil.ausfaelle?.length) out[variante + ':ausfaelle'] = teil.ausfaelle;
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(Object.keys(out), out[Object.keys(out)[0]].length, 'Szenarien');
await browser.close();
process.exit(0);
