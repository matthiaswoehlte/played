/* Prüft Auftrag 009, Stufe 3, echter Lauf über das Abo auf einer Kopie des Navigators: Ein Szenario wird von Hand
   aufgenommen und vorgespielt, dann baut die KI aus dem Wunsch ein Plugin. Kostet einen KI-Auftrag, gehört nicht zu den
   üblichen Prüfungen. Das gelesene Projekt bleibt unverändert.
   Aufruf: node pruefung/echte-ki-navigator.mjs */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const WUNSCH = 'Fahre ich über einen Faden, steht dort, welche Regeln und Plugins ihn bilden.';
let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 900) : ''}`);
}
function abdruck(wege) {
  const h = createHash('sha256');
  const geh = (w) => {
    let st;
    try { st = statSync(w); } catch { return; }
    if (st.isDirectory()) readdirSync(w).sort().forEach(n => geh(path.join(w, n)));
    else h.update(w).update(readFileSync(w));
  };
  wege.forEach(geh);
  return h.digest('hex');
}

const b = await eigeneBruecke(4347, { projekte: true, mitNavigator: true });
const gelesen = [b.plugindaten, b.regeln, b.abgleich, b.inKauf];
const vorher = abdruck(gelesen);
const BAUSTEINE = path.join(b.projekte, 'netz-navigator', 'plugins', 'bausteine');

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const geladen = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig() && !document.querySelector('#projektWahl').hidden, null, { timeout: 180000 });
const meldungen = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent).join(' | '));

try {
  console.log('-- Navigator öffnen');
  await p.goto(b.adresse);
  await geladen();
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.selectOption('#projektWahl', 'netz-navigator')]);
  await geladen();

  console.log('-- Szenario von Hand aufnehmen und vorspielen');
  const anzahl = await p.evaluate(() => Huelle.drehbuecher.length);
  await p.click('.nv-kasten[data-pfad="bereiche/disposition"]');
  await p.waitForFunction(() => !Huelle.bus.arbeitet && !document.querySelector('#behalten').hidden, null, { timeout: 10000 });
  await p.click('#behalten');
  await p.waitForFunction(n => Huelle.drehbuecher.length === n + 1, anzahl, { timeout: 30000 });
  const neu = await p.evaluate(() => Huelle.drehbuecher.at(-1).kennung);
  pruefe('Szenario ist im Navigator-Projekt aufgenommen', readdirSync(path.join(b.projekte, 'netz-navigator', 'drehbuecher', 'gespielt')).some(d => d.startsWith(neu)), neu);
  await geladen();
  await p.selectOption('#wahl', neu);
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
  pruefe('Es lässt sich vorspielen', (await p.$eval('.nv-station.nv-hier', e => e.dataset.pfad)) === 'bereiche/disposition');
  await geladen();

  console.log('-- Wunsch an die KI (etwa 3 bis 6 Minuten)');
  await p.reload();
  await geladen();
  const t0 = Date.now();
  const uhr = setInterval(async () => {
    const schritt = await p.evaluate(() => document.querySelector('#meldungen')?.innerText.slice(-120)).catch(() => '');
    console.log(`     ${Math.round((Date.now() - t0) / 1000)} s: ${String(schritt).replace(/\s+/g, ' ')}`);
  }, 30000);
  await p.fill('#wunschFeld', WUNSCH);
  await p.click('#wunsch button');
  await p.waitForFunction(() => [...document.querySelectorAll('#meldungen .meldung')]
    .some(m => /^(Geändert|Fertig|Korrigiert|Das ließ sich nicht|Rückfrage)/.test(m.textContent)), null, { timeout: 12 * 60000 });
  clearInterval(uhr);
  console.log(`     fertig nach ${Math.round((Date.now() - t0) / 1000)} s: ${await meldungen()}`);

  const plugins = existsSync(BAUSTEINE) ? readdirSync(BAUSTEINE) : [];
  pruefe('Die KI hat genau ein Plugin im Navigator-Projekt gebaut', plugins.length === 1, plugins);
  const h = plugins[0] ? JSON.parse(readFileSync(path.join(BAUSTEINE, plugins[0], 'herkunft.json'), 'utf8')) : null;
  pruefe('Die Herkunft steht dort, mit dem Wunsch im Wortlaut', h?.fassungen?.[0]?.wortlaut === WUNSCH, h);
  pruefe('Der Probelauf ist sauber', !/nicht|Abweich|verworfen/i.test(await meldungen()), await meldungen());

  console.log('-- Der Wunsch wirkt');
  await geladen();
  await p.hover('.nv-zahl[data-pfad="faeden/disposition--personal"]');
  await p.waitForTimeout(400);
  const text = await p.evaluate(() => document.body.innerText);
  pruefe('Beim Überfahren steht dort, welche Plugins und Regeln den Faden bilden', /Krankmeldung/.test(text) && /Regel/.test(text), text.slice(0, 500));
  pruefe('Das gelesene Projekt ist unverändert', abdruck(gelesen) === vorher);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message, await meldungen().catch(() => ''));
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
