/* Echter Lauf über das Abo, auf einer Kopie der Plugins und Regeln (Auftrag 006, Stufe 2):
   der Pausen-Wunsch, der zugleich Verhalten und Regel ist. Zeigt, ob die innere KI die Regel
   mitliefert, ob sie gespeichert und vom Wächter geprüft wird. Kostet ein bis zwei KI-Aufträge,
   gehört nicht zu den üblichen Prüfungen. Aufruf: node pruefung/echte-ki-regel.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse, plugindaten, regeln: REGELN } = await eigeneBruecke(4333, { mitKopie: true });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const vorherPlugins = new Set(readdirSync(BAUSTEINE));
const vorherRegeln = new Set(readdirSync(REGELN));
const WUNSCH = 'Ein Mitarbeiter arbeitet höchstens vier Stunden ohne Pause.';

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('Seitenfehler:', e.message));
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const ende = () => p.waitForFunction(() => [...document.querySelectorAll('#meldungen .meldung')]
  .some(m => /^(Fertig|Gilt ab jetzt|Nicht eingespielt|Das ließ sich nicht|Rückfrage)/.test(m.textContent)), null, { timeout: 12 * 60000 });
const letzte = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent).join(' | '));

try {
  await p.goto(adresse);
  await bereit();
  const t0 = Date.now();
  await p.fill('#wunschFeld', WUNSCH);
  await p.click('#wunsch button');
  await ende();
  console.log(`Wunsch (${Math.round((Date.now() - t0) / 1000)} s): ${await letzte()}`);
  console.log('  neue Plugins:', readdirSync(BAUSTEINE).filter(k => !vorherPlugins.has(k)));
  const neu = readdirSync(REGELN).filter(k => !vorherRegeln.has(k));
  console.log('  neue Regeln:', neu);
  for (const n of neu) console.log(readFileSync(path.join(REGELN, n), 'utf8'));
  await bereit();
  const k = neu[0]?.replace(/\.js$/, '');
  if (k) {
    const r = await p.evaluate(k => ({ art: Huelle.regeln[k]?.art, aufrufe: Huelle.waechter.aufrufe()[k] || 0,
      verstoesse: Huelle.waechter.eintraege().filter(e => e.regel === k) }), k);
    console.log('  in der Seite:', JSON.stringify(r));
  }
  console.log('  Regeldatei im Repo unberührt:', !neu.some(n => existsSync(path.join(HIER, '..', 'regeln', n))));
} finally {
  await browser.close();
}
process.exit(0);
