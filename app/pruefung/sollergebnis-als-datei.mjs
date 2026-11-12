/* Prüft: Sollergebnisse und behaltene Drehbücher sind Dateien, nichts bleibt im Browser.
   Aufruf: node pruefung/sollergebnis-als-datei.mjs */
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, ordner: SOLL, gespielt: GESPIELT } = await eigeneBruecke();
const SCHLUESSEL = 'play/sollergebnisse/1';
const vorher = readdirSync(GESPIELT);

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}
const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const bereit = p => p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('.pl-balken'));
async function seite(kontext) {
  const p = await kontext.newPage();
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(ADRESSE);
  await bereit(p);
  return p;
}
/* Immer nur ein Play-Fenster offen (wie beim PO): Ein neues schließt das vorige. Sonst messen bis zu
   sieben Fenster mit je bis zu 12 Kopien gleichzeitig, und die Prüfung dauert doppelt so lange. */
let offen = null;
async function neuerKontext() {
  if (offen) await offen.close();
  offen = await browser.newContext({ viewport: { width: 1500, height: 1400 } });
  return offen;
}
async function spiele(p, kennung) {
  await p.selectOption('#wahl', kennung);
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
}
const datei = k => path.join(SOLL, k + '.json');
async function bis(bedingung) {
  for (let i = 0; i < 100 && !bedingung(); i++) await new Promise(r => setTimeout(r, 50));
  return bedingung();
}
const nachspielen = p => p.evaluate(() => new Promise(f => Huelle.nachspiel.lauf(null, f)));
const K = 'krankmeldung-ma-20';
const entfernen = [];

try {
  /* ---------- 1 Gesehen wird Datei ---------- */
  const p = await seite(await neuerKontext());
  await spiele(p, K);
  /* Erst lesen, wenn die Brücke fertig geschrieben hat (unter Last sieht man die Datei sonst halb) */
  const lesbar = () => { try { return JSON.parse(readFileSync(datei(K), 'utf8')); } catch { return null; } };
  pruefe('Gesehener Endstand liegt als Datei vor', await bis(() => existsSync(datei(K)) && !!lesbar()));
  const inhalt = lesbar();
  pruefe('Datei nennt die Kennung und den Endstand', inhalt.kennung === K && Object.keys(inhalt.je).length === 1 && !!inhalt.je[inhalt.zuletzt].zustand, Object.keys(inhalt));
  pruefe('Nichts im Browser', await p.evaluate(() => localStorage.length === 0));

  /* ---------- 2 Andere Sitzung liest die Datei ---------- */
  const q = await seite(await neuerKontext());
  pruefe('Frischer Browser kennt das Sollergebnis', await q.evaluate(k => !!Huelle.soll.grundlage(k)?.gleicherStand, K));
  const n = await nachspielen(q);
  pruefe('Nachspielen ohne Ausfall', !n.ausfaelle.length, n);
  const verfaelscht = JSON.parse(readFileSync(datei(K), 'utf8'));
  const auftraege = verfaelscht.je[verfaelscht.zuletzt].zustand.auftraege;
  auftraege[Object.keys(auftraege)[0]].mitarbeiter = 'MA-99';
  writeFileSync(datei(K), JSON.stringify(verfaelscht));
  const r = await seite(await neuerKontext());
  const n2 = await nachspielen(r);
  pruefe('Geänderte Datei wird als Abweichung gemeldet', n2.abweichungen.length === n.abweichungen.length + 1, { n, n2 });
  writeFileSync(datei(K), JSON.stringify(inhalt));

  /* ---------- 3 Stimmt so nicht ---------- */
  const k = 'krankmeldung-ma-01';
  const s = await seite(await neuerKontext());
  await spiele(s, k);
  await bis(() => existsSync(datei(k)));
  await s.click('#widerspruch');
  pruefe('Stimmt so nicht nimmt die Datei zurück', await bis(() => !existsSync(datei(k))));

  /* ---------- 4 Behalten und Zurücknehmen ---------- */
  const t = await seite(await neuerKontext());
  await t.evaluate(() => document.querySelector('.pl-balken[data-pfad="auftraege/XA745-TANK-01"]').scrollIntoView({ block: 'nearest' }));
  const z = await t.evaluate(() => { const r = document.querySelector('.pl-zeile[data-pfad="mitarbeiter/MA-21"]'); r.scrollIntoView({ block: 'nearest' }); const q = r.getBoundingClientRect(); return { y: q.y + q.height / 2 }; });
  const b2 = await t.evaluate(() => { const q = document.querySelector('.pl-balken[data-pfad="auftraege/XA745-TANK-01"]').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + 9 }; });
  await t.mouse.move(b2.x, b2.y);
  await t.mouse.down();
  await t.mouse.move(b2.x, b2.y + 7, { steps: 3 });
  await t.mouse.move(b2.x, z.y, { steps: 5 });
  await t.mouse.up();
  await t.waitForSelector('#behalten:not([hidden])');
  const anzahl = await t.evaluate(() => Huelle.drehbuecher.length);
  await t.click('#behalten');
  await t.waitForFunction(a => Huelle.drehbuecher.length === a + 1, anzahl);
  const g = await t.evaluate(() => Huelle.drehbuecher.at(-1).kennung);
  entfernen.push(g);
  pruefe('Behalten: Szenario und Sollergebnis sind Dateien', existsSync(path.join(GESPIELT, g + '.js')) && await bis(() => existsSync(datei(g))));
  await Promise.all([t.waitForEvent('load'), t.click('.meldung button.aktion:text("Zurücknehmen")')]);
  await bereit(t);
  pruefe('Zurücknehmen: beide Dateien weg', !existsSync(path.join(GESPIELT, g + '.js')) && !existsSync(datei(g)));

  /* ---------- 5 Altes aus dem Browser wird einmalig Datei ---------- */
  const u = await seite(await neuerKontext());
  const alt = JSON.stringify({ 'krankmeldung-ma-01': inhalt, 'gibt-es-nicht': inhalt });
  await u.evaluate(([s, a]) => localStorage.setItem(s, a), [SCHLUESSEL, alt]);
  await u.reload();
  await bereit(u);
  pruefe('Altes Sollergebnis ist jetzt Datei', await bis(() => existsSync(datei('krankmeldung-ma-01'))));
  pruefe('Zu einem unbekannten Szenario entsteht keine Datei', !existsSync(datei('gibt-es-nicht')));
  pruefe('Browser ist danach leer', await u.evaluate(s => localStorage.getItem(s) === null, SCHLUESSEL));

  /* ---------- 6 Brücke antwortet nicht: nichts überschreiben, sichtbar sagen ---------- */
  const v = await (await neuerKontext()).newPage();
  let geschrieben = 0;
  await v.route('**/sollergebnisse', r => r.fulfill({ status: 404, body: '' }));
  await v.route('**/sollergebnis/**', r => { geschrieben++; r.continue(); });
  await v.goto(ADRESSE);
  await bereit(v);
  pruefe('Nicht lesbar: Meldung steht da', (await v.textContent('#meldungen')).includes('nicht lesen'));
  await spiele(v, K);
  pruefe('Nicht lesbar: keine Datei überschrieben', geschrieben === 0, geschrieben);

  const w = await (await neuerKontext()).newPage();
  await w.route('**/sollergebnis/**', r => r.fulfill({ status: 500, body: '{}' }));
  await w.goto(ADRESSE);
  await bereit(w);
  await spiele(w, K);
  await w.waitForFunction(() => document.querySelector('#meldungen').textContent.includes('nicht als Datei speichern'));
  pruefe('Speichern scheitert: Meldung steht da', true);

  /* ---------- 7 Doppelklick ---------- */
  const f = await (await neuerKontext()).newPage();
  f.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await f.goto('file:///' + path.resolve(HIER, '..', 'index.html').replace(/\\/g, '/'));
  await f.waitForFunction(() => window.Huelle?.geladen);
  await f.click('#tempo button[data-wert="4"]');
  await f.click('#play');
  await f.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
  pruefe('Doppelklick: sagt, dass nichts gespeichert wird', (await f.textContent('#meldungen')).includes('Per Doppelklick'));
  pruefe('Doppelklick: nichts im Browser', await f.evaluate(() => localStorage.length === 0));
} finally {
  const p = await browser.newPage();
  await p.goto(ADRESSE);
  for (const k of entfernen) await p.evaluate(k => fetch('/gespielt/' + k, { method: 'DELETE' }), k);
  await browser.close();
}
pruefe('Prüfdateien wieder weg', JSON.stringify(readdirSync(GESPIELT)) === JSON.stringify(vorher), readdirSync(GESPIELT));
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
