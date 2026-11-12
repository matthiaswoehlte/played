/* Prüft mit echten Mausgesten: Von Hand gespielt, behalten, per Play genauso abgelaufen.
   Aufruf: node pruefung/von-hand-zum-drehbuch.mjs
   Legt Drehbücher an und nimmt sie am Ende wieder zurück. */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, gespielt: ORDNER } = await eigeneBruecke();   // Ordner der Szenarien von Hand (Kopie der Brücke)
const vorher = existsSync(ORDNER) ? readdirSync(ORDNER) : [];

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
async function seite(kontext) {
  const p = await kontext.newPage();
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('.pl-balken'));
  return p;
}
const neuerKontext = () => browser.newContext({ viewport: { width: 1500, height: 1400 } });
const wert = (p, pfad) => p.evaluate(x => Huelle.zustand.lies(x), pfad);
const ruhe = p => p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
const ort = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
async function ziehe(p, id, ma) {
  const b = await ort(p, `.pl-balken[data-pfad="auftraege/${id}"]`);
  const x = b.x + b.w / 2;
  await p.mouse.move(x, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(x, b.y + 16, { steps: 3 });
  const z = await ort(p, `.pl-zeile[data-pfad="mitarbeiter/${ma}"]`);
  await p.mouse.move(x, z.y + z.h / 2, { steps: 5 });
  await p.mouse.up();
  await ruhe(p);
}
async function kante(p, id, dx) {
  const b = await ort(p, `.pl-balken[data-pfad="auftraege/${id}"]`);
  await p.mouse.move(b.x + b.w - 2, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(b.x + b.w - 2 + dx, b.y + 9, { steps: 5 });
  await p.mouse.up();
  await ruhe(p);
}
const folge = p => p.evaluate(() => Huelle.bus.protokoll.filter(m => m.absender !== 'huelle/zustand')
  .map(m => [m.zeit, m.objekt, m.aktion, m.parameter, m.erzaehlung]));
const stand = p => p.evaluate(() => Huelle.zustand.wurzel);
async function behalte(p) {
  const anzahl = await p.evaluate(() => Huelle.drehbuecher.length);
  await p.click('#behalten');
  await p.waitForFunction(n => Huelle.drehbuecher.length === n + 1, anzahl);
  return p.evaluate(() => Huelle.drehbuecher.at(-1));
}
async function spiele(p, kennung) {
  await p.selectOption('#wahl', kennung);
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
}
const nachspielen = p => p.evaluate(() => new Promise(fertig => Huelle.nachspiel.lauf(null, fertig)));
const entfernen = [];

try {
  /* ---------- 1 Kleine Folge ab Tagesbeginn ---------- */
  const k1 = await neuerKontext();
  const p = await seite(k1);
  await p.selectOption('#wahl', 'wunsch-005');
  pruefe('Ohne Handlung kein Knopf', !(await p.isVisible('#behalten')));
  await ziehe(p, 'XA745-TANK-01', 'MA-21');
  pruefe('Nach der ersten Handlung steht der Knopf da', (await p.textContent('#behalten')) === 'Als Szenario behalten (1)');
  await ziehe(p, 'XC810-TANK-01', 'MA-40');    // seit N-132 und Wunsch 014 erlaubt, mit Konflikt
  await kante(p, 'XC810-CLEAN-01', 40);
  pruefe('Knopf zählt jede Handlung mit', (await p.textContent('#behalten')) === 'Als Szenario behalten (3)');
  const hand = { folge: await folge(p), stand: await stand(p) };

  const d = await behalte(p);
  entfernen.push(d.kennung);
  pruefe('Datei liegt im Ordner der Szenarien von Hand', existsSync(path.join(ORDNER, d.kennung + '.js')));
  pruefe('Szenario steht in der Auswahl', await p.evaluate(k => [...document.querySelectorAll('#wahl option')].some(o => o.value === k), d.kennung));
  pruefe('Drei Ereignisse, Titel in Fachsprache', d.ereignisse.length === 3 && d.titel.includes('XA 745 Betanken') && d.titel.includes('2 weitere'), d.titel);
  const nachBehalten = { wert: await wert(p, 'auftraege/XA745-TANK-01/mitarbeiter'), protokoll: await p.evaluate(() => Huelle.bus.protokoll.length), uhr: await p.textContent('#uhr'), wahl: await p.inputValue('#wahl') };
  pruefe('Plan bleibt beim Behalten stehen', nachBehalten.wert === 'MA-21', nachBehalten);
  pruefe('Danach kein Knopf mehr, bis wieder gespielt wird', !(await p.isVisible('#behalten')));
  pruefe('Meldung bietet Vorspielen und Zurücknehmen', (await p.textContent('#meldungen')).includes('Behalten:'));

  await p.click('.meldung button.aktion:text("Vorspielen")');
  await p.click('#tempo button[data-wert="4"]');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 60000 });
  pruefe('Per Play: gleiche Ereignisse', JSON.stringify(await folge(p)) === JSON.stringify(hand.folge), { hand: hand.folge, play: await folge(p) });
  pruefe('Per Play: gleicher Endstand', JSON.stringify(await stand(p)) === JSON.stringify(hand.stand));
  pruefe('Per Play: grün', (await p.getAttribute('#ergebnis', 'class')).includes('gruen'), await p.textContent('#ergebnis'));

  /* Neuer Browser: Nur die Datei trägt, kein Speicher von vorhin */
  const k2 = await neuerKontext();
  const q = await seite(k2);
  await spiele(q, d.kennung);
  pruefe('Anderer Browser: läuft aus der Datei genauso', JSON.stringify(await stand(q)) === JSON.stringify(hand.stand));
  pruefe('Anderer Browser: Sollergebnis erfüllt', (await q.getAttribute('#ergebnis', 'class')).includes('gruen'), await q.textContent('#ergebnis'));
  const n = await nachspielen(q);
  pruefe('Läuft beim Nachspielen mit, ohne Befund', n.ausfaelle.length === 0 && n.abweichungen.every(a => !a.startsWith(d.titel)), n);

  /* ---------- 2 Von Hand nach einem Drehbuch ---------- */
  const r = await seite(await neuerKontext());
  await spiele(r, 'krankmeldung-ma-01');
  await ziehe(r, 'XA745-TANK-01', 'MA-21');
  const d2hand = await stand(r);
  const d2 = await behalte(r);
  entfernen.push(d2.kennung);
  pruefe('Nach einem Szenario: dessen Ereignisse stecken mit drin', d2.ereignisse[0].aktion === 'krankmeldung' && d2.ereignisse.at(-1).aktion === 'umplanen', d2.ereignisse.map(e => e.aktion));
  await spiele(r, d2.kennung);
  pruefe('Nach einem Szenario: gleicher Endstand per Play', JSON.stringify(await stand(r)) === JSON.stringify(d2hand));

  await Promise.all([r.waitForEvent('load'), r.click('.meldung button.aktion:text("Zurücknehmen")')]);
  await r.waitForFunction(() => window.Huelle?.geladen && document.querySelector('.pl-balken'));
  pruefe('Zurücknehmen: Szenario und Datei sind weg', !existsSync(path.join(ORDNER, d2.kennung + '.js')) && await r.evaluate(k => !Huelle.drehbuecher.some(d => d.kennung === k), d2.kennung));

  /* ---------- 3 Sollergebnis wacht ---------- */
  const s = await seite(await neuerKontext());
  const befund = await s.evaluate(() => new Promise(fertig => Huelle.nachspiel.probe([{ name: 'probe.js', quelle:
    'Huelle.plugin({ kennung: "verhalten-einsatz", titel: "x", prueft: {}, abonniert: { "auftraege/*.umplanen": function (m, h) { h.setze(m.objekt + "/mitarbeiter", m.parameter.mitarbeiter); }, "auftraege/*.zeitaendern": function (m, h) { h.setze(m.objekt + "/" + m.parameter.kante, m.parameter.zeit); } } });' }], [], r => fertig(r.ausfaelle))));
  /* Bis 07.11. fiel hier „Einsatzbalken auf andere Mitarbeiter ziehen“ aus (es erwartete das Verweigern ohne
     Qualifikation). Seit deinem Wunsch 014 an „Einsatz ändern“ (N-132) gibt es dort nichts mehr zu verweigern;
     ohne die Regeln fällt jetzt das Drehbuch zum Verschieben aus, dessen Erwartung an die Regeln zu Zeiten hängt. */
  pruefe('Regel weggefallen: das eigene Wunsch-Szenario fällt aus', befund.some(a => a.startsWith('Einsatzbalken nach links und rechts verschieben')), befund);
  pruefe('Regel weggefallen: das gespielte Szenario sperrt keinen Wunsch', !befund.some(a => a.startsWith('Von Hand')), befund);
  const abw = await s.evaluate(() => new Promise(fertig => {
    Huelle.nachspiel.lauf([{ name: 'probe.js', quelle: 'Huelle.plugin({ kennung: "verhalten-einsatz", titel: "x", prueft: {}, abonniert: { "auftraege/*.umplanen": function (m, h) { h.setze(m.objekt + "/mitarbeiter", m.parameter.mitarbeiter); }, "auftraege/*.zeitaendern": function (m, h) { h.setze(m.objekt + "/" + m.parameter.kante, m.parameter.zeit); } } });' }], fertig);
  }));
  pruefe('Regel weggefallen: gemeldet als Abweichung am gespielten Szenario', abw.abweichungen.some(a => a.startsWith('Von Hand')), abw);
} finally {
  const p = await browser.newPage();
  await p.goto(ADRESSE);
  for (const k of entfernen) await p.evaluate(k => fetch('/gespielt/' + k, { method: 'DELETE' }), k);
  await browser.close();
}
const nachher = existsSync(ORDNER) ? readdirSync(ORDNER) : [];
pruefe('Prüfdateien wieder weg', JSON.stringify(nachher) === JSON.stringify(vorher), nachher);
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
