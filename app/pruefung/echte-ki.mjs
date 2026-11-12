/* Echter Lauf über das Abo, auf einer Kopie der Plugins: eine Änderung per Satz an einem Plugin
   und ein neuer Wunsch. Zeigt, ob die innere KI die Regel einhält (neues kleines Plugin oder
   gezielte Änderung an genau einem). Kostet zwei KI-Aufträge, gehört nicht zu den üblichen Prüfungen.
   Aufruf: node pruefung/echte-ki.mjs */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse, plugindaten } = await eigeneBruecke(4331, { mitKopie: true });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const vorher = new Set(readdirSync(BAUSTEINE));

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('Seitenfehler:', e.message));
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const ende = () => p.waitForFunction(() => [...document.querySelectorAll('#meldungen .meldung')]
  .some(m => /^(Geändert|Fertig|Korrigiert|Das ließ sich nicht|Rückfrage)/.test(m.textContent)), null, { timeout: 12 * 60000 });
const letzte = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent).join(' | '));

try {
  await p.goto(adresse);
  await bereit();
  await p.click('#pluginKnopf');

  let t0 = Date.now();
  const feld = p.locator('[data-plugin="konflikt-rand"] details.plugin-ki.aendern');
  await feld.locator('summary').click();
  await feld.locator('textarea').fill('Der rote Rand soll gestrichelt sein statt durchgezogen.');
  await feld.locator('button[type="submit"]').click();
  await ende();
  console.log(`Ändern (${Math.round((Date.now() - t0) / 1000)} s): ${await letzte()}`);
  const h = JSON.parse(readFileSync(path.join(BAUSTEINE, 'konflikt-rand', 'herkunft.json'), 'utf8'));
  console.log('  Fassungen:', h.fassungen.map(f => `${f.nr} ${f.art}`).join(', '), '· gilt:', h.aktuell);
  if (h.aktuell === 2) {
    const a = readFileSync(path.join(BAUSTEINE, 'konflikt-rand', 'fassung-001.js'), 'utf8');
    const b = readFileSync(path.join(BAUSTEINE, 'konflikt-rand', 'fassung-002.js'), 'utf8');
    console.log('  geänderte Zeilen:', b.split('\n').filter(z => !a.split('\n').includes(z)).map(z => z.trim()));
  }
  await p.evaluate(() => document.querySelectorAll('#meldungen .meldung').forEach(m => m.remove()));
  await bereit();

  t0 = Date.now();
  await p.fill('#wunschFeld', 'Wenn ich mit der Maus über einen Mitarbeiternamen fahre, soll seine Zeile im Tagesplan leicht hell hinterlegt werden.');
  await p.click('#wunsch button');
  await ende();
  console.log(`Wunsch (${Math.round((Date.now() - t0) / 1000)} s): ${await letzte()}`);
  const neu = readdirSync(BAUSTEINE).filter(k => !vorher.has(k));
  console.log('  neue Plugins:', neu);
  for (const k of readdirSync(BAUSTEINE)) {
    const x = JSON.parse(readFileSync(path.join(BAUSTEINE, k, 'herkunft.json'), 'utf8'));
    if (x.fassungen.length > 1 || neu.includes(k)) console.log(`  ${k}: Fassung ${x.aktuell}, ${x.fassungen.map(f => f.art).join(', ')}`);
  }
} finally {
  await browser.close();
}
process.exit(0);
