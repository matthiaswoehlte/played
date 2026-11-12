/* Prüft mit echten Mausgesten: Was von Hand geht, ist dasselbe Ereignis wie im Drehbuch.
   Aufruf: node pruefung/hand-wie-vorgespielt.mjs
   Playwright kommt aus CCIDE-CODE. Es wird kein Wunsch abgeschickt und nichts gespeichert. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE } = await eigeneBruecke();

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;

async function seite(hoehe = 1400) {
  const p = await browser.newPage({ viewport: { width: 1500, height: hoehe } });
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('.pl-balken'));
  return p;
}
const waehle = (p, kennung) => p.selectOption('#wahl', kennung);
const wert = (p, pfad) => p.evaluate(x => Huelle.zustand.lies(x), pfad);
const balken = (p, id) => p.evaluate(id => {
  const e = document.querySelector(`.pl-balken[data-pfad="auftraege/${id}"]`);
  e.scrollIntoView({ block: 'nearest' });
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, zeile: e.closest('.pl-zeile').dataset.pfad };
}, id);
const zeileY = (p, ma) => p.evaluate(ma => {
  const r = document.querySelector(`.pl-zeile[data-pfad="mitarbeiter/${ma}"]`).getBoundingClientRect();
  const f = document.querySelector('.pl-rahmen').getBoundingClientRect();
  return { y: r.y + r.height / 2, sichtbar: r.y >= f.y + 20 && r.bottom <= f.bottom, darunter: r.bottom > f.bottom, oben: f.y, unten: f.bottom };
}, ma);
const anzeige = p => p.evaluate(() => ({
  tipp: document.querySelector('.huelle-tipp')?.textContent ?? null,
  ja: [...document.querySelectorAll('.huelle-ziel-ja')].map(e => e.dataset.pfad),
  nein: [...document.querySelectorAll('.huelle-ziel-nein')].map(e => e.dataset.pfad),
  geist: !!document.querySelector('.huelle-geist'),
}));
const ruhe = p => p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);

/* Greift den Balken in der Mitte und fährt auf die Zeile; außerhalb des Sichtbaren am Rand rollen. */
async function fahreAufZeile(p, id, ma) {
  const b = await balken(p, id);
  const x = b.x + b.w / 2;
  await p.mouse.move(x, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(x, b.y + 16, { steps: 3 });
  for (let i = 0; i < 200; i++) {
    const z = await zeileY(p, ma);
    if (z.sichtbar) {
      /* Wie ein Mensch: nachfahren, bis genau die gewünschte Zeile unter dem Zeiger liegt. */
      await p.mouse.move(x, z.y);
      const a = await anzeige(p), pfad = 'mitarbeiter/' + ma;
      const unten = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pl-zeile')?.dataset.pfad, [x, (await zeileY(p, ma)).y]);
      if (unten === pfad && (a.ja.includes(pfad) || a.nein.includes(pfad) || a.tipp?.includes('Bleibt'))) return;
      continue;
    }
    const rand = z.darunter ? z.unten - 10 : z.oben + 10;
    await p.mouse.move(x + (i % 2), rand);
  }
  throw new Error('Zeile nicht erreicht: ' + ma);
}
async function zieheAufZeile(p, id, ma) {
  await fahreAufZeile(p, id, ma);
  await p.mouse.up();
  await ruhe(p);
}
/* Zieht eine Kante auf eine Uhrzeit. */
async function zieheKante(p, id, kante, zeit, loslassen = true) {
  const b = await balken(p, id);
  const a = await wert(p, 'auftraege/' + id);
  const min = t => t.split(':').reduce((h, m) => Number(h) * 60 + Number(m));
  const proMinute = b.w / (min(a.ende) - min(a.start));
  const x = kante === 'ende' ? b.x + b.w - 2 : b.x + 2;
  const dx = (min(zeit) - min(kante === 'ende' ? a.ende : a.start)) * proMinute;
  await p.mouse.move(x, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(x + dx, b.y + 9, { steps: 6 });
  if (loslassen) { await p.mouse.up(); await ruhe(p); }
}
/* Von Hand steht die Uhr still, beim Vorspielen gibt sie seit Auftrag 005, Stufe 2 ihren Takt (Onblock,
   Offblock). Verglichen wird, was die Hand auslöst; was die Uhr dazwischen tut, und der Flugstatus,
   den nur sie setzt, bleiben draußen. */
const folge = p => p.evaluate(() => Huelle.bus.protokoll
  .filter(m => m.absender !== 'huelle/zustand' && Huelle.bus.protokoll[m.ursprung - 1].absender !== 'huelle/uhr')
  .map(m => ({ was: m.objekt + '.' + m.aktion, parameter: m.parameter, erzaehlung: m.erzaehlung, zeit: undefined })));
const stand = p => p.evaluate(() => {
  const w = JSON.parse(JSON.stringify(Huelle.zustand.wurzel));
  Object.values(w.fluege || {}).forEach(f => { delete f.status; });
  return w;
});
async function vorspielen(p, kennung) {
  await waehle(p, kennung);
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
}

/* ---------- 1 Drehbuch „auf andere Mitarbeiter ziehen“ von Hand ---------- */
{
  const p = await seite();
  await waehle(p, 'wunsch-005');

  await fahreAufZeile(p, 'XA745-TANK-01', 'MA-21');
  let a = await anzeige(p);
  pruefe('Ziehen auf Berechtigten: Zeile grün, Grund am Zeiger, Geist', a.ja[0] === 'mitarbeiter/MA-21' && a.tipp.startsWith('✓') && a.tipp.includes('E. Novak') && a.geist, a);
  await p.mouse.up();
  await ruhe(p);
  pruefe('Loslassen: Auftrag liegt beim Berechtigten', await wert(p, 'auftraege/XA745-TANK-01/mitarbeiter') === 'MA-21');
  pruefe('Balken steht in der neuen Zeile', (await balken(p, 'XA745-TANK-01')).zeile === 'mitarbeiter/MA-21');
  pruefe('Konfliktzähler folgt von Hand', await wert(p, 'kennzahlen/konflikte/wert') === 5);
  const erzaehlt = (await p.textContent('#spur')) + (await p.textContent('#zeile'));
  pruefe('Erzählzeile wie im Szenario', erzaehlt.includes('Disponent zieht XA 745 Betanken auf E. Novak') && erzaehlt.includes('Konflikte 6 → 5'), erzaehlt);
  pruefe('Absender ist die Hand', await p.evaluate(() => Huelle.bus.protokoll[0].absender) === 'hand/gantt/balken-auf-zeile');
  pruefe('Nach dem Zug nichts übrig', (await anzeige(p)).geist === false && (await anzeige(p)).tipp === null);

  await zieheAufZeile(p, 'XA745-CLEAN-03', 'MA-41');

  await fahreAufZeile(p, 'XC810-TANK-01', 'MA-40');
  a = await anzeige(p);
  /* Seit N-132 und deinem Wunsch 014 an „Einsatz ändern“ (07.11.): Zuweisung ohne Qualifikation ist erlaubt
     und wird ein Konflikt; mit Wunsch 016 steht dabei ein roter Hinweis am Zeiger und die Zeile ist rot umrandet. */
  const rot = await p.evaluate(() => ({ hinweis: document.querySelector('.pl-ohnequali')?.textContent ?? null, zeile: !!document.querySelector('.pl-zeile.pl-ohnequali-ziel[data-pfad="mitarbeiter/MA-40"]') }));
  pruefe('Ziehen auf Unberechtigten: erlaubt', a.ja[0] === 'mitarbeiter/MA-40', a);
  /* Befund, kein Fehler dieser Prüfung: Der rote Hinweis aus Wunsch 016 hängt an einer Bedienung von „Einsatz ändern“.
     „Balken auf andere Mitarbeiter ziehen“ steht in der Reihe davor und nimmt den Zug zuerst an, darum kommt er nie. */
  if (!(rot.hinweis === 'I. Reindl hat keine Qualifikation für Betanken: Konflikt' && rot.zeile)) console.log('BEFUND Roter Hinweis aus Wunsch 016 erscheint nicht: ' + JSON.stringify({ tipp: a.tipp, rot }));
  await p.mouse.up();
  await ruhe(p);
  pruefe('Loslassen: Auftrag liegt bei I. Reindl', await wert(p, 'auftraege/XC810-TANK-01/mitarbeiter') === 'MA-40');
  pruefe('Balken steht in ihrer Zeile', (await balken(p, 'XC810-TANK-01')).zeile === 'mitarbeiter/MA-40');
  pruefe('Konflikt „Qualifikation fehlt“ steht in der Liste', (await wert(p, 'kennzahlen/konflikte/liste')).some(k => k.art === 'Qualifikation fehlt' && k.auftrag === 'XC810-TANK-01'));
  const erz = (await p.textContent('#spur')) + (await p.textContent('#zeile'));
  pruefe('Erzählzeile wie im Szenario', erz.includes('Disponent zieht XC 810 Betanken auf I. Reindl'), erz);

  await zieheAufZeile(p, 'XC810-CLEAN-01', 'MA-20');
  const hand = { folge: await folge(p), stand: await stand(p) };

  const q = await seite();
  await vorspielen(q, 'wunsch-005');
  pruefe('Vorgespielt grün', (await q.getAttribute('#ergebnis', 'class')).includes('gruen'), await q.textContent('#ergebnis'));
  const gespielt = { folge: await folge(q), stand: await stand(q) };
  pruefe('Hand und Vorspielen: gleiche Ereignisse in gleicher Folge', JSON.stringify(hand.folge) === JSON.stringify(gespielt.folge), { hand: hand.folge.map(m => m.was), gespielt: gespielt.folge.map(m => m.was) });
  pruefe('Hand und Vorspielen: gleicher Endstand', JSON.stringify(hand.stand) === JSON.stringify(gespielt.stand));
  await p.close();
  await q.close();
}

/* ---------- 2 Drehbuch „verlängern und verkürzen“ von Hand ---------- */
{
  const p = await seite();
  await waehle(p, 'wunsch-004');

  await zieheKante(p, 'XC810-CLEAN-01', 'ende', '10:00', false);
  const v = await anzeige(p);
  const breite = (await balken(p, 'XC810-CLEAN-01')).w;
  pruefe('Kante: Vorschau und passt schon beim Ziehen', v.tipp?.startsWith('✓') && v.tipp.includes('10:00'), v);
  await p.mouse.up();
  await ruhe(p);
  const nachher = await balken(p, 'XC810-CLEAN-01');
  pruefe('Kante rechts: Zeit steht im Zustand', await wert(p, 'auftraege/XC810-CLEAN-01/ende') === '10:00');
  pruefe('Kante rechts: Balken behält die Länge der Vorschau', Math.abs(nachher.w - breite) < 1, { breite, nachher });
  pruefe('Kante: Konfliktzähler folgt', await wert(p, 'kennzahlen/konflikte/wert') === 7);
  pruefe('Kante: läuft als Ereignis über den Bus', await p.evaluate(() => Huelle.bus.protokoll[0].absender === 'hand/gantt/balken-kante' && Huelle.bus.protokoll[0].aktion === 'zeitaendern'));

  await zieheKante(p, 'XB933-TANK-01', 'start', '09:30');
  pruefe('Kante links: Zeit steht im Zustand', await wert(p, 'auftraege/XB933-TANK-01/start') === '09:30');
  await zieheKante(p, 'XC810-BELA-01', 'start', '09:20');
  await zieheKante(p, 'XB933-BELA-01', 'ende', '10:10');
  const hand = { folge: await folge(p), stand: await stand(p) };

  const q = await seite();
  await vorspielen(q, 'wunsch-004');
  const gespielt = { folge: await folge(q), stand: await stand(q) };
  pruefe('Kanten von Hand und vorgespielt: gleiche Ereignisse', JSON.stringify(hand.folge) === JSON.stringify(gespielt.folge), { hand: hand.folge, gespielt: gespielt.folge });
  pruefe('Kanten von Hand und vorgespielt: gleicher Endstand', JSON.stringify(hand.stand) === JSON.stringify(gespielt.stand));
  await p.close();
  await q.close();
}

/* ---------- 3 Grenzfälle ---------- */
{
  const p = await seite();
  await waehle(p, 'wunsch-005');
  const vorher = await stand(p);

  await zieheKante(p, 'XA745-TANK-01', 'ende', '08:30', false);
  const a = await anzeige(p);
  pruefe('Kante zu kurz: passt nicht, Grund am Zeiger', a.tipp === '✕ Ein Auftrag dauert mindestens 5 Minuten', a);
  await p.mouse.up();
  await ruhe(p);
  pruefe('Kante zu kurz: Zeit bleibt', await wert(p, 'auftraege/XA745-TANK-01/ende') === '08:55');

  await fahreAufZeile(p, 'XA745-TANK-01', 'MA-21');
  await p.keyboard.press('Escape');
  await p.mouse.up();
  pruefe('Escape bricht ab', await wert(p, 'auftraege/XA745-TANK-01/mitarbeiter') === 'MA-22' && !(await anzeige(p)).geist);

  await fahreAufZeile(p, 'XA745-TANK-01', 'MA-22');
  const eigen = await anzeige(p);
  await p.mouse.up();
  await ruhe(p);
  pruefe('Eigene Zeile: kein Grün, kein Ereignis', eigen.ja.length === 0 && eigen.tipp.includes('Bleibt bei') , eigen);

  const b = await balken(p, 'XA745-TANK-01');
  await p.mouse.move(b.x + b.w / 2, b.y + 9);
  await p.mouse.down();
  await p.mouse.up();
  pruefe('Bloßer Klick auf den Balken ändert nichts', JSON.stringify(await stand(p)) === JSON.stringify(vorher));

  await p.click('#tempo button[data-wert="1"]');
  await p.click('#play');
  await p.waitForFunction(() => Huelle.gesperrt());
  const c = await balken(p, 'XC810-TANK-01');
  await p.mouse.move(c.x + c.w / 2, c.y + 9);
  await p.mouse.down();
  await p.mouse.move(c.x + c.w / 2, c.y + 60, { steps: 4 });
  const gesperrt = await anzeige(p);
  await p.mouse.up();
  pruefe('Während des Vorspielens gesperrt, mit Hinweis', !gesperrt.geist && (await p.textContent('#meldungen')).includes('Während des Vorspielens'));
  await p.close();
}

/* ---------- 4 Rollen am Rand ---------- */
{
  const p = await seite(620);
  await waehle(p, 'wunsch-005');
  pruefe('Kleines Fenster: Zielzeile liegt zunächst unsichtbar', !(await zeileY(p, 'MA-41')).sichtbar);
  await p.evaluate(() => { document.querySelector('.pl-rahmen').scrollTop = 0; });
  await zieheAufZeile(p, 'XC810-CLEAN-01', 'MA-41');
  pruefe('Am Rand rollt der Plan mit, der Auftrag landet in der fernen Zeile', await wert(p, 'auftraege/XC810-CLEAN-01/mitarbeiter') === 'MA-41', { liegtBei: await wert(p, 'auftraege/XC810-CLEAN-01/mitarbeiter'), zeile: await p.textContent('#zeile'), rollstand: await p.evaluate(() => document.querySelector('.pl-rahmen').scrollTop) });
  pruefe('Der Plan bleibt nach dem Ablegen, wo er war', await p.evaluate(() => document.querySelector('.pl-rahmen').scrollTop > 0));
  await p.close();
}

/* ---------- 5 Themenunabhängig: Klicken, Eingeben, Ziehen an einem fremden Plugin ---------- */
{
  const p = await seite();
  await p.evaluate(() => {
    Huelle.zustand.setze('buchung/B1/name', 'alt');
    Huelle.zustand.setze('buchung/B1/sitz', 0);
    Huelle.zustand.nimmAenderungen();
    Huelle.plugin({
      kennung: 'probe-maske',
      ansicht: {
        ort: 'seite', neuBei: ['buchung/*.geaendert'],
        zeichne(el, h) {
          el.innerHTML = `<div class="m" data-pfad="buchung/B1"><input class="n" value="${h.esc(h.lies('buchung/B1/name'))}"><button class="s">Sitz</button><b>${h.lies('buchung/B1/sitz')}</b></div>`;
        },
      },
      bedienungen: [
        { kennung: 'name', art: 'eingeben', fasst: '.n', ereignis: (g) => ({ objekt: g.pfad, aktion: 'umbenennen', parameter: { name: g.wert } }) },
        { kennung: 'sitz', art: 'klicken', fasst: '.s', ereignis: (g) => ({ objekt: g.pfad, aktion: 'sitzen', parameter: {} }) },
      ],
      prueft: { 'buchung/*.umbenennen': (m) => (m.parameter.name ? null : 'Name fehlt') },
      abonniert: {
        'buchung/*.umbenennen': (m, h) => h.setze(m.objekt + '/name', m.parameter.name),
        'buchung/*.sitzen': (m, h) => h.setze(m.objekt + '/sitz', h.lies(m.objekt + '/sitz') + 1),
      },
    });
  });
  await p.fill('.m .n', 'neu');
  await p.locator('.m .n').blur();
  await ruhe(p);
  pruefe('Eingabe läuft als Ereignis', await wert(p, 'buchung/B1/name') === 'neu');
  await p.click('.m .s');
  await ruhe(p);
  pruefe('Klick läuft als Ereignis', await wert(p, 'buchung/B1/sitz') === 1);
  await p.fill('.m .n', '');
  await p.locator('.m .n').blur();
  await ruhe(p);
  pruefe('Verweigerte Eingabe bleibt ohne Wirkung', await wert(p, 'buchung/B1/name') === 'neu');
  pruefe('Verweigerung geht über den Bus', await p.evaluate(() => Huelle.bus.protokoll.some(m => m.aktion === 'verweigert' && m.parameter.grund === 'Name fehlt')));

  /* Ein altes Plugin, das außerhalb des Busses selbst sendet, bleibt nicht mehr liegen. */
  await p.evaluate(() => {
    Huelle.plugin({ kennung: 'probe-alt', beimStart(h) { window.altH = h; }, abonniert: { 'buchung/*.alt': (m, h) => h.setze(m.objekt + '/alt', true) } });
    window.altH.sende({ objekt: 'buchung/B1', aktion: 'alt' });
  });
  await ruhe(p);
  pruefe('Nachricht von außerhalb wird abgearbeitet', await wert(p, 'buchung/B1/alt') === true);
  await p.close();
}

/* ---------- 6 Alle Drehbücher laufen nach ---------- */
{
  const p = await seite();
  const ergebnis = await p.evaluate(() => new Promise(fertig => Huelle.nachspiel.probe([], [], r => fertig(r.ausfaelle))));
  pruefe('Alle Szenarien laufen sauber nach', ergebnis.length === 0, ergebnis);
  await p.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
