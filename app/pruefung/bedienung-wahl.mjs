/* Prüft Anweisung 15 des PO (08.11.2026): Wollen zwei Plugins dieselbe Bedienung übernehmen,
   entscheidet nicht das Alphabet, sondern der PO. Play zeigt es an beiden Plugins in der Leiste
   als einen Satz, der PO wählt, die Wahl steht mit Datum in der Herkunft. Bis er wählt, gilt die
   feste Reihenfolge. Fall: XC 810 Betanken auf I. Reindl (keine Qualifikation fürs Betanken).
   Läuft auf einer Kopie der echten Plugins; die Wahl landet in einer Wegwerf-Datei.
   Aufruf: node pruefung/bedienung-wahl.mjs */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, plugindaten, bedienungen: WAHL } = await eigeneBruecke(4372, { mitKopie: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });

const wert = pfad => p.evaluate(x => Huelle.zustand.lies(x), pfad);
const ruhe = () => p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
const balken = id => p.evaluate(id => {
  const e = document.querySelector(`.pl-balken[data-pfad="auftraege/${id}"]`);
  e.scrollIntoView({ block: 'nearest' });
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, id);
const zeileY = ma => p.evaluate(ma => {
  const r = document.querySelector(`.pl-zeile[data-pfad="mitarbeiter/${ma}"]`).getBoundingClientRect();
  const f = document.querySelector('.pl-rahmen').getBoundingClientRect();
  return { y: r.y + r.height / 2, sichtbar: r.y >= f.y + 20 && r.bottom <= f.bottom, darunter: r.bottom > f.bottom, oben: f.y, unten: f.bottom };
}, ma);
const anzeige = () => p.evaluate(() => ({
  tipp: document.querySelector('.huelle-tipp')?.textContent ?? null,
  rot: document.querySelector('.pl-ohnequali')?.textContent ?? null,
}));

/* Greift den Balken und fährt auf die Zeile, ohne loszulassen; am Rand rollt der Plan mit. */
async function fahreAufZeile(id, ma) {
  const b = await balken(id);
  const x = b.x + b.w / 2;
  await p.mouse.move(x, b.y + b.h / 2);
  await p.mouse.down();
  await p.mouse.move(x, b.y + b.h / 2 + 8, { steps: 3 });
  for (let i = 0; i < 200; i++) {
    const z = await zeileY(ma);
    if (z.sichtbar) {
      await p.mouse.move(x, z.y);
      const unten = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pl-zeile')?.dataset.pfad, [x, z.y]);
      if (unten === 'mitarbeiter/' + ma) return;
      continue;
    }
    await p.mouse.move(x + (i % 2), z.darunter ? z.unten - 10 : z.oben + 10);
  }
  throw new Error('Zeile nicht erreicht: ' + ma);
}

const streit = () => p.evaluate(() => Huelle.bedienung.streit().map(x => ({ sicht: x.sicht, art: x.art, plugins: x.plugins, wahl: x.wahl && x.wahl.gewaehlt })));
const saetzeAn = kennung => p.evaluate(k => [...document.querySelectorAll(`article.plugin[data-plugin="${k}"] .plugin-bedienung`)].map(e => e.firstChild.textContent), kennung);

try {
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen, null, { timeout: 60000 });

  /* ---------- Erkennen ---------- */
  /* Die Liste „Nicht zugewiesene Aufträge“ ist zu Tagesbeginn leer; erst mit einem Auftrag darin
     lässt sich von dort ziehen. Ein Auftrag kommt hinein wie beim Zurücklegen von Hand. */
  await p.evaluate(() => Huelle.handeln({ objekt: 'auftraege/XB214-TANK-01', aktion: 'zuruecklegen', parameter: { mitarbeiter: 'MA-21' }, erzaehlung: 'Disponent legt XB 214 Betanken zurück' }, 'hand/pruefung'));
  await ruhe();
  const s = await streit();
  const gantt = s.find(x => x.sicht === 'gantt' && x.plugins.includes('balken-zuweisen') && x.plugins.includes('verhalten-einsatz'));
  const liste = s.find(x => x.sicht === 'nicht-zugewiesen' && x.plugins.includes('offen-zuweisen') && x.plugins.includes('verhalten-einsatz'));
  pruefe('Erkannt: Balken auf Mitarbeiter ziehen wollen zwei Plugins übernehmen', !!gantt, s);
  pruefe('Erkannt: Auftrag aus der Liste auf Mitarbeiter ziehen ebenso', !!liste, s);
  pruefe('Sonst kein Streit (Verschieben in der Zeile, Zurücklegen, Klicks teilen sich nichts)', s.length === 2, s);
  pruefe('Bis zur Wahl: feste Reihenfolge, „Balken auf andere Mitarbeiter ziehen“ zuerst', gantt && gantt.plugins[0] === 'balken-zuweisen' && !gantt.wahl, gantt);

  /* ---------- In der Leiste an beiden Plugins derselbe Satz ---------- */
  await p.click('#pluginKnopf');
  await p.waitForSelector('article.plugin[data-plugin="balken-zuweisen"] .plugin-bedienung');
  const a = await saetzeAn('balken-zuweisen'), b = await saetzeAn('verhalten-einsatz');
  const satz = a.find(x => x.startsWith('Ziehst du einen Balken im Tagesplan auf einen Mitarbeiter'));
  pruefe('Satz an „Balken auf andere Mitarbeiter ziehen“', !!satz, a);
  pruefe('Derselbe Satz an „Einsatz ändern“', satz && b.includes(satz), b);
  pruefe('Satz nennt beide Plugins und wer bis zur Wahl übernimmt',
    satz && /wollen „Balken auf andere Mitarbeiter ziehen“ und „Einsatz ändern“ das übernehmen\. Bis du wählst, übernimmt es „Balken auf andere Mitarbeiter ziehen“\.$/.test(satz), satz);
  pruefe('Satz ohne Maschinenraum (keine Kennungen, Pfade)', satz && !/[a-z]+-[a-z]+|\/|MA-\d/.test(satz), satz);
  console.log('     Satz: ' + satz);
  const liSatz = (await saetzeAn('offen-zuweisen'))[0];
  console.log('     Satz an der Liste: ' + liSatz);
  pruefe('Satz an „Auftrag aus der Liste ziehen“ in Fachsprache', liSatz && liSatz.startsWith('Ziehst du einen Auftrag aus „Nicht zugewiesene Aufträge“ auf einen Mitarbeiter'), liSatz);
  await p.click('#leisteZu');

  /* ---------- Vor der Wahl: wie bisher, kein roter Hinweis ---------- */
  await fahreAufZeile('XC810-TANK-01', 'MA-40');
  let z = await anzeige();
  pruefe('Vor der Wahl: Zug auf I. Reindl ohne roten Hinweis (übernimmt „Balken auf andere Mitarbeiter ziehen“)', !z.rot && z.tipp && z.tipp.includes('I. Reindl kann Betanken übernehmen'), z);
  await p.keyboard.press('Escape');
  await p.mouse.up();
  await ruhe();

  /* ---------- Der PO wählt „Einsatz ändern“ ---------- */
  await p.click('#pluginKnopf');
  const knopf = 'article.plugin[data-plugin="balken-zuweisen"] .plugin-bedienung button[data-waehlt="verhalten-einsatz"]';
  await p.waitForSelector(knopf);
  pruefe('Knopf heißt „„Einsatz ändern“ übernimmt“', (await p.textContent(knopf)) === '„Einsatz ändern“ übernimmt', await p.textContent(knopf));
  const block = k => `article.plugin[data-plugin="${k}"] .plugin-bedienung:has(button[data-waehlt="balken-zuweisen"]):has(button[data-waehlt="verhalten-einsatz"])`;
  const aussehen = k => p.$eval(block(k), e => { const s = getComputedStyle(e); return { gelb: e.classList.contains('wartet-auf-wahl'), rahmen: parseFloat(s.borderTopWidth), schrift: parseFloat(s.fontSize), gewaehlt: [...e.querySelectorAll('button.ist-gewaehlt')].map(b => b.dataset.waehlt), hintergrund: e.querySelector('button.ist-gewaehlt') && getComputedStyle(e.querySelector('button.ist-gewaehlt')).backgroundColor, text: e.firstChild.textContent }; });
  const wahlIst = k => p.waitForFunction(k => Huelle.bedienung.streit().some(x => x.sicht === 'gantt' && x.wahl && x.wahl.gewaehlt === k), k);
  const vorWahl = await aussehen('balken-zuweisen');
  pruefe('Anweisung 37: Vor der Wahl gelb mit Rahmen, kein Knopf als gewählt markiert', vorWahl.gelb && vorWahl.rahmen === 1 && !vorWahl.gewaehlt.length, vorWahl);
  await p.click(knopf);
  await wahlIst('verhalten-einsatz');
  await p.waitForSelector(`${block('balken-zuweisen')}.ist-entschieden`);
  const nach = (await saetzeAn('verhalten-einsatz')).find(x => x.startsWith('Ziehst du einen Balken'));
  pruefe('Nach der Wahl: Satz sagt, was gewählt ist und wann', nach && /Du hast am \d\d\.\d\d\.(\d{4})? gewählt: Es übernimmt „Einsatz ändern“\.$/.test(nach), nach);
  const datei = JSON.parse(readFileSync(WAHL, 'utf8'));
  pruefe('Wahl gespeichert mit Datum', datei.length === 1 && datei[0].gewaehlt === 'verhalten-einsatz' && /^\d{4}-\d\d-\d\dT/.test(datei[0].datum), datei);
  for (const k of ['balken-zuweisen', 'verhalten-einsatz']) {
    const h = JSON.parse(readFileSync(path.join(plugindaten, 'bausteine', k, 'herkunft.json'), 'utf8'));
    const f = h.fassungen.find(x => x.nr === h.aktuell);
    const e = (f.entscheidungen || []).find(x => x.art === 'bedienung');
    pruefe(`Herkunft von ${k}: Wahl mit Datum und Satz`, e && e.wahl === 'verhalten-einsatz' && e.datum && e.was === satz.replace(/ Bis du wählst.*$/, '') && e.wie === 'vom PO per Klick „Einsatz ändern übernimmt“', e);
  }

  /* ---------- Anweisung 37: entschieden ohne Alarm, umentscheiden wirkt sichtbar ---------- */
  const entschieden = await aussehen('balken-zuweisen');
  pruefe('Anweisung 37: Nach der Wahl ohne Rahmen, klein, nicht gelb', !entschieden.gelb && entschieden.rahmen === 0 && entschieden.schrift < vorWahl.schrift, entschieden);
  pruefe('Anweisung 37: Der gewählte Knopf ist markiert', entschieden.gewaehlt.join() === 'verhalten-einsatz' && entschieden.hintergrund !== 'rgba(0, 0, 0, 0)', entschieden);
  await p.click(`${block('verhalten-einsatz')} button[data-waehlt="balken-zuweisen"]`);
  await wahlIst('balken-zuweisen');
  await p.waitForSelector(`${block('verhalten-einsatz')} button.ist-gewaehlt[data-waehlt="balken-zuweisen"]`);
  for (const k of ['balken-zuweisen', 'verhalten-einsatz']) {
    const u = await aussehen(k);
    pruefe(`Anweisung 37: Umentscheiden ändert sofort Satz und Knopf an ${k}`, /Es übernimmt „Balken auf andere Mitarbeiter ziehen“\.$/.test(u.text) && u.gewaehlt.join() === 'balken-zuweisen', u);
    const h = JSON.parse(readFileSync(path.join(plugindaten, 'bausteine', k, 'herkunft.json'), 'utf8'));
    const l = (h.fassungen.find(x => x.nr === h.aktuell).entscheidungen || []).filter(x => x.art === 'bedienung');
    pruefe(`Anweisung 37: Umentscheiden steht mit Datum in der Herkunft von ${k}`, l.length === 2 && l[1].wahl === 'balken-zuweisen' && !!l[1].datum, l);
  }
  await p.click(`${block('balken-zuweisen')} button[data-waehlt="verhalten-einsatz"]`);
  await wahlIst('verhalten-einsatz');
  await p.click('#leisteZu');

  /* ---------- Nach der Wahl: roter Hinweis, Zuweisung mit Konflikt ---------- */
  await fahreAufZeile('XC810-TANK-01', 'MA-40');
  z = await anzeige();
  pruefe('Nach der Wahl: roter Hinweis aus deinem Wunsch an „Einsatz ändern“', z.rot === 'I. Reindl hat keine Qualifikation für Betanken: Konflikt', z);
  pruefe('… und der Tipp sagt „Konflikt“', z.tipp && z.tipp.includes('ohne passende Qualifikation: Konflikt'), z);
  await p.mouse.up();
  await ruhe();
  pruefe('Losgelassen: XC 810 Betanken liegt bei I. Reindl', (await wert('auftraege/XC810-TANK-01/mitarbeiter')) === 'MA-40');
  const k = await wert('kennzahlen/konflikte/liste');
  pruefe('… mit Konflikt „Qualifikation fehlt“', (k || []).some(x => x.auftrag === 'XC810-TANK-01' && /Qualifikation/.test(x.art)), k);

  /* Ein Zug auf jemanden mit Qualifikation bleibt bei „Balken auf andere Mitarbeiter ziehen“ */
  await fahreAufZeile('XA101-TANK-01', 'MA-21');
  z = await anzeige();
  pruefe('Zug mit passender Qualifikation: kein Streit, kein roter Hinweis', !z.rot && z.tipp && z.tipp.includes('E. Novak kann Betanken übernehmen'), z);
  await p.keyboard.press('Escape');
  await p.mouse.up();

  /* ---------- Bleibt nach dem Neuladen ---------- */
  await p.reload();
  await p.waitForFunction(() => window.Huelle?.geladen, null, { timeout: 60000 });
  await p.waitForFunction(() => Huelle.bedienung.streit().some(x => x.sicht === 'gantt' && x.wahl && x.wahl.gewaehlt === 'verhalten-einsatz'), null, { timeout: 10000 })
    .then(() => pruefe('Wahl gilt nach dem Neuladen', true), () => pruefe('Wahl gilt nach dem Neuladen', false));
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `${fehler} Fehler` : 'Alles grün');
process.exit(fehler ? 1 : 0);
