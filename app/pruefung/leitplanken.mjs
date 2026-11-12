/* Prüft Stufe 1 aus Auftrag 006: Regeln mit Geltungsbereich und Wächter.
   Seit den Entscheidungen des PO vom 07.11. (N-111, N-132) liegt die Variante „Automatisch
   umverteilen“ im Papierkorb; den Ladegruppen-Fall zeigt ein absichtlich gebautes Test-Plugin.
   Läuft auf einer eigenen Brücke mit einer Kopie der Plugins und Sollergebnisse; die Dateien
   im Repo und der laufende Play-Server des PO bleiben unberührt.
   Aufruf: node pruefung/leitplanken.mjs [ordner-fuer-bilder] */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, plugindaten: PLUGINDATEN } = await eigeneBruecke(4331, { mitKopie: true });
const BILDER = process.argv[2];

const LADEGRUPPE = 'XC 810: Entladen machen Ladegruppe 1 und Ladegruppe 2 (V. Engström) – Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.';
const FREMD = 'fremd-schichtplanung-zwei-auftraege';

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });

const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const ruhe = () => p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
const jetzt = () => p.evaluate(() => Huelle.waechter.jetzt());
const amEnde = k => p.evaluate(k => Huelle.waechter.amEnde(k), k);
const liste = () => p.evaluate(() => Huelle.waechter.eintraege());
const zaehler = async () => (await p.isHidden('#verstossKnopf')) ? 0 : Number((await p.textContent('#verstossKnopf')).split(' ')[0]);
const bild = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png') }); };
const leuchtet = () => p.evaluate(() => document.getAnimations()
  .filter(a => a.id === 'verstoss' && a.playState === 'running').map(a => a.effect.target.dataset.pfad));
/* Neue Messung abwarten: erst wenn sie beginnt, dann bis sie fertig ist */
async function neuGemessen(tue) {
  await tue();
  await p.waitForFunction(() => !Huelle.verwaltung.fertig(), null, { timeout: 10000 }).catch(() => {});
  await bereit();
}
async function vorspielen(kennung) {
  await p.selectOption('#wahl', kennung);
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
}
const balken = id => p.evaluate(id => {
  const e = document.querySelector(`.pl-balken[data-pfad="auftraege/${id}"]`);
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width };
}, id);
const zeileY = ma => p.evaluate(ma => {
  const z = document.querySelector(`.pl-zeile[data-pfad="mitarbeiter/${ma}"]`);
  const r = z.getBoundingClientRect(), f = document.querySelector('.pl-rahmen').getBoundingClientRect();
  return { y: r.y + r.height / 2, sichtbar: r.y >= f.y + 20 && r.bottom <= f.bottom, darunter: r.bottom > f.bottom, oben: f.y, unten: f.bottom };
}, ma);
/* Zieht einen Balken mit der Maus auf eine Mitarbeiterzeile, am Rand wird gerollt. */
async function zieheAufZeile(id, ma) {
  const b = await balken(id), x = b.x + b.w / 2;
  await p.mouse.move(x, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(x, b.y + 16, { steps: 3 });
  for (let i = 0; i < 200; i++) {
    const z = await zeileY(ma);
    if (z.sichtbar) {
      await p.mouse.move(x, z.y);
      const unten = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pl-zeile')?.dataset.pfad, [x, z.y]);
      if (unten === 'mitarbeiter/' + ma) break;
      continue;
    }
    await p.mouse.move(x + (i % 2), z.darunter ? z.unten - 10 : z.oben + 10);
  }
  await p.mouse.up();
  await ruhe();
}
/* Zieht die Anfangskante eines Balkens auf eine Uhrzeit. */
async function zieheStart(id, zeit) {
  const b = await balken(id);
  const a = await p.evaluate(id => Huelle.zustand.lies('auftraege/' + id), id);
  const min = t => t.split(':').reduce((h, m) => Number(h) * 60 + Number(m));
  const proMinute = b.w / (min(a.ende) - min(a.start));
  await p.mouse.move(b.x + 2, b.y + 9);
  await p.mouse.down();
  await p.mouse.move(b.x + 2 + (min(zeit) - min(a.start)) * proMinute, b.y + 9, { steps: 6 });
  await p.mouse.up();
  await ruhe();
}

try {
  await p.goto(ADRESSE);
  await bereit();

  /* ---------- 1 Gemockter Tag, Geltungsbereich ---------- */
  pruefe('Played Flow hat seinen Pfad', (await p.evaluate(() => Huelle.tag.pfad)) === 'bodenabfertigung/tagesdisposition');
  pruefe('Sechs Regeln geladen, als eigene Objekte', (await p.evaluate(() => Object.keys(Huelle.regeln).length)) === 6);
  pruefe('Variante „Automatisch umverteilen“ liegt im Papierkorb, kein Umschalter',
    (await p.evaluate(() => Huelle.verwaltung.papierkorb().some(w => w.kennung === 'verhalten-umverteilen'))) &&
    (await p.locator('#plaetze button[data-variante]').count()) === 0);
  pruefe('Unveränderter gemockter Tag: kein Verstoß', (await jetzt()).length === 0, await jetzt());
  /* Echte Befunde über den Bestand (PO 07.11.: als Meldung erwarten, Regeln und Plugins bleiben):
     Von Hand gespielte Drehbücher enden schon heute mit einem Verstoß. */
  const vorher = await liste();
  const BEFUNDE = [
    { drehbuecher: ['wunsch-008', 'wunsch-010'], satz: 'XA 745 Fäkalien entleeren beginnt um 08:05, On-Block ist erst um 08:15 – Eine Arbeit an einem Flug beginnt frühestens bei On-Block.' },
    { drehbuecher: ['gespielt-001', 'wunsch-009'], satz: 'XC 810: Entladen und Beladen machen Ladegruppe 1 und Ladegruppe 2 (V. Engström, W. Fiedler) – Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.' },
  ];
  const gefunden = vorher.map(e => ({ drehbuecher: e.drehbuecher.slice().sort(), satz: e.satz }))
    .sort((a, b) => a.satz < b.satz ? -1 : 1);
  pruefe('Befunde im Bestand werden gemeldet: On-Block (wunsch-008, wunsch-010), Ladegruppe (wunsch-009, gespielt-001)',
    JSON.stringify(gefunden) === JSON.stringify(BEFUNDE), gefunden);
  pruefe('Zähler zählt genau diese; nichts davon jetzt im Tagesplan', (await zaehler()) === 2 && vorher.every(e => !e.jetzt), vorher);
  pruefe('Keine Liste aller Regeln in der Seite', !(await p.textContent('body')).includes('Ein Mitarbeiter hat höchstens zwei Aufträge'));
  const gilt = await p.evaluate(() => {
    const g = (pfad) => Huelle.waechter.gilt({ pfad }, 'bodenabfertigung/tagesdisposition');
    return {
      projekt: g('bodenabfertigung'), flow: g('bodenabfertigung/tagesdisposition'),
      nachbar: g('bodenabfertigung/schichtplanung'), aehnlich: g('bodenabfertigung/tages'),
      darunter: g('bodenabfertigung/tagesdisposition/nacht'), fremd: g('flughafen'),
    };
  });
  pruefe('Geltung: Projekt und eigener Played Flow ja; Nachbar, Namensähnliches, Darunterliegendes, Fremdes nein',
    gilt.projekt && gilt.flow && !gilt.nachbar && !gilt.aehnlich && !gilt.darunter && !gilt.fremd, gilt);

  /* ---------- 2 Aufträge lösen (N-111): keine Meldung ---------- */
  pruefe('„Aufträge lösen“ ist das Verhalten bei Krankmeldung', (await p.evaluate(() => Huelle.stand().krankmeldung)) === 'verhalten-krankmeldung');
  pruefe('Nachgespielt: Krankmeldung MA-01 endet ohne Verstoß', (await amEnde('krankmeldung-ma-01')).length === 0, await amEnde('krankmeldung-ma-01'));
  await vorspielen('krankmeldung-ma-01');
  pruefe('Vorgespielt: keine Meldung', (await jetzt()).length === 0 && (await zaehler()) === vorher.length, await jetzt());

  /* ---------- 3 Test-Plugin gibt XC 810 Entladen an V. Engström: gemischte Ladegruppe ---------- */
  const PROBE = 'probe-ladegruppe';
  const PROBE_ORDNER = path.join(PLUGINDATEN, 'bausteine', PROBE);
  mkdirSync(PROBE_ORDNER, { recursive: true });
  writeFileSync(path.join(PROBE_ORDNER, 'fassung-001.js'), `/* Absichtlich gebautes Test-Plugin: bricht die Ladegruppen-Regel wie früher die Variante. */
Huelle.plugin({
  kennung: "${PROBE}", titel: "Probe: XC 810 Entladen an V. Engström",
  abonniert: {
    /* Hängt am Lösen, nicht an der Krankmeldung: So kommt es nach dem Lösen, gleich in welcher Reihenfolge die Plugins hängen. */
    "auftraege/XC810-ENTL-01.loesen": function (m, h) {
      h.sende({ objekt: "auftraege/XC810-ENTL-01", aktion: "zuweisen", parameter: { mitarbeiter: "MA-05" }, erzaehlung: "XC 810 Entladen übernimmt V. Engström" });
    },
    "auftraege/*.zuweisen": function (m, h) { h.sende({ objekt: m.objekt, aktion: "umplanen", parameter: { mitarbeiter: m.parameter.mitarbeiter } }); }
  }
});
`);
  writeFileSync(path.join(PROBE_ORDNER, 'herkunft.json'), JSON.stringify({
    kennung: PROBE, name: 'Probe: XC 810 Entladen an V. Engström', reihe: 99, kurz: null,
    wuensche: [{ kennung: 'wunsch-099', name: 'Probe', wortlaut: 'Probe für den Wächter', datum: '2026-11-07T12:00:00Z' }],
    aktuell: 1, fassungen: [{ nr: 1, vorige: null, art: 'wunsch', wortlaut: 'Probe für den Wächter', datum: '2026-11-07T12:00:00Z', drehbuch: null }],
  }));
  await neuGemessen(() => p.reload());
  const ende = await amEnde('krankmeldung-ma-01');
  pruefe('Nachgespielt mit Test-Plugin: Verstoß steht am Szenario', ende.length === 1 && ende[0].satz === LADEGRUPPE, ende);
  const lgEintrag = async () => (await liste()).filter(e => e.satz === LADEGRUPPE);
  pruefe('Steht schon vor dem Vorspielen da', (await lgEintrag()).length === 1 && (await lgEintrag())[0].drehbuecher.includes('krankmeldung-ma-01'), await liste());
  await vorspielen('krankmeldung-ma-01');
  const v = await jetzt();
  pruefe('Wächter meldet die gemischte Ladegruppe bei XC 810', v.length === 1 && v[0].satz === LADEGRUPPE, v);
  const lg = await lgEintrag();
  pruefe('Nur einmal, nicht doppelt: jetzt und am Ende des Szenarios ein Eintrag', lg.length === 1 && lg[0].jetzt && (await zaehler()) === (await liste()).length, await liste());
  pruefe('Ende des Durchlaufs nennt den Verstoß', (await p.textContent('#ergebnisText')).includes('Endet mit 1 Regelverstoß'), await p.textContent('#ergebnisText'));
  pruefe('Betroffen: die vier Balken Entladen XC 810, zuerst der von V. Engström',
    v[0]?.pfade[0] === 'auftraege/XC810-ENTL-01' && v[0].pfade.length === 4 && v[0].pfade.every(x => x.startsWith('auftraege/XC810-ENTL-')), v[0]?.pfade);
  pruefe('Mechanisch ermittelt: Wert kam aus dem Test-Plugin', v[0]?.verursacher === PROBE, v[0]?.verursacher);
  pruefe('Regel des fremden Bereichs nie geprüft', !(await p.evaluate(f => Huelle.waechter.aufrufe()[f], FREMD)));

  await p.click('#verstossKnopf');
  pruefe('Aufgeklappt: Liste in der Spalte, Tagesplan bleibt sichtbar', await p.isVisible('#verstoesse') && (await p.locator('[data-sicht="gantt"]').boundingBox()).width > 500);
  const kasten = p.locator('#verstossListe .verstoss', { has: p.locator('.verstoss-satz', { hasText: LADEGRUPPE }) });
  pruefe('Ein Satz in Fachsprache, einmal in der Liste', (await kasten.count()) === 1);
  const wo = await kasten.locator('.verstoss-wo').textContent();
  pruefe('Wo: jetzt im Tagesplan und am Ende des Szenarios', wo.startsWith('Jetzt im Tagesplan · Am Ende von ') && wo.includes('„Krankmeldung MA-01 ab 08:00“'), wo);
  const glimmt = await leuchtet();
  pruefe('Beim Aufklappen leuchten die betroffenen Balken', ['auftraege/XC810-ENTL-01', 'auftraege/XC810-ENTL-02'].every(x => glimmt.includes(x)), glimmt);
  await bild('1-ladegruppe-aufgeklappt');
  pruefe('„Warum?“ ist zu, solange niemand fragt', (await p.locator('.verstoss-warum').count()) === 0);
  await kasten.locator('button.warum').click();
  const warum = await kasten.locator('.verstoss-warum').textContent();
  pruefe('„Warum?“ zeigt die Regel mit Wortlaut und Datum',
    warum.includes('Regel: Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.') &&
    warum.includes('Das ist fest, keine offene Entscheidung.') && warum.includes('28.09.2026'), warum);
  await bild('2-warum');
  pruefe('Kein „So ist es jetzt richtig“ am Verstoß', (await p.locator('#verstoesse button.richtig').count()) === 0);
  await kasten.locator('button.zum-plugin').click();
  pruefe('„Zum Plugin“ öffnet die Leiste am Test-Plugin', await p.locator(`[data-plugin="${PROBE}"]`).isVisible());
  await p.click('#leisteZu');

  /* Nach einer neuen Messung bleibt der Verstoß am Drehbuch gemeldet. */
  await neuGemessen(() => p.evaluate(() => Huelle.verwaltung.pruefe()));
  pruefe('Neu gemessen: Verstoß bleibt am Szenario', (await amEnde('krankmeldung-ma-01')).some(x => x.satz === LADEGRUPPE));

  /* ---------- 4 Test-Plugin wieder weg ---------- */
  rmSync(PROBE_ORDNER, { recursive: true, force: true });
  await neuGemessen(() => p.reload());
  pruefe('Ohne Test-Plugin wieder keine Meldung', (await amEnde('krankmeldung-ma-01')).length === 0 && (await jetzt()).length === 0);

  /* N-111: Ein Test-Plugin lässt einen Auftrag beim Kranken; der Wächter meldet es. */
  await p.evaluate(() => Huelle.einspielen('probe-bleibt.js', `Huelle.plugin({
    kennung: "probe-bleibt", titel: "Probe: Auftrag bleibt beim Kranken",
    besitzt: ["mitarbeiter/MA-01/abwesend", "mitarbeiter/MA-01/abwesendAb"],
    abonniert: { "probe/ausloeser.krank": function (m, h) { h.setze("mitarbeiter/MA-01/abwesend", true); h.setze("mitarbeiter/MA-01/abwesendAb", "08:00"); } }
  });`));
  await p.evaluate(() => Huelle.handeln({ objekt: 'probe/ausloeser', aktion: 'krank' }, 'drehbuecher/probe'));
  await ruhe();
  const n111 = (await jetzt()).filter(x => x.regel === 'abwesend-auftraege-geloest');
  pruefe('N-111: Aufträge eines Abwesenden nach dem Zeitpunkt werden gemeldet', n111.length === 2 &&
    n111.some(x => x.satz === 'XC 810 Entladen liegt noch bei R. Aldinger, abwesend ab 08:00 – Ist ein Mitarbeiter ab einem Zeitpunkt abwesend, werden alle seine Aufträge, die nach dem Zeitpunkt noch laufen, gelöst und bleiben unzugewiesen.'), n111);
  pruefe('N-111: Zum Plugin ist das Test-Plugin', n111.every(x => x.verursacher === 'probe-bleibt'), n111);
  await p.click('#vonVorn');
  await ruhe();

  /* ---------- 5 Von Hand ---------- */
  await p.selectOption('#wahl', 'krankmeldung-ma-01');
  await ruhe();
  await zieheStart('XC810-ENTL-02', '08:40');
  let h = await jetzt();
  pruefe('Von Hand vor On-Block gezogen: gemeldet', h.length === 1 && h[0].regel === 'beginn-ab-on-block' &&
    h[0].satz === 'XC 810 Entladen beginnt um 08:40, On-Block ist erst um 08:50 – Eine Arbeit an einem Flug beginnt frühestens bei On-Block.', h);
  pruefe('Von Hand: kein „Zum Plugin“, die Hand war es', h[0] && h[0].verursacher === null, h[0]);

  await zieheAufZeile('XC810-BELA-01', 'MA-05');
  h = await jetzt();
  const vonHand = h.filter(x => x.regel === 'ladegruppe-je-flug');
  pruefe('Von Hand XC 810 Beladen zu V. Engström: gemeldet', vonHand.length === 1 && vonHand[0].satz.startsWith('XC 810: Beladen machen Ladegruppe 1 und Ladegruppe 2 (V. Engström)'), h);
  pruefe('Jetzt im Tagesplan: beide, ohne Doppelte', (await liste()).filter(e => e.jetzt).length === 2 && (await zaehler()) === (await liste()).length, await liste());

  await zieheAufZeile('XC810-BELA-02', 'MA-40');
  /* Seit dem Wunsch des PO an „Einsatz ändern“ (wunsch-014, 07.11.2026, N-132): zugewiesen, mit Konflikt, keine Meldung */
  const ohneQ = await p.evaluate(() => ({
    bei: Huelle.zustand.lies('auftraege/XC810-BELA-02/mitarbeiter'),
    konflikt: Huelle.zustand.lies('kennzahlen/konflikte/liste').some(k => k.art === 'Qualifikation fehlt' && k.auftrag === 'XC810-BELA-02')
  }));
  pruefe('Ohne Qualifikation: zugewiesen, Konflikt „Qualifikation fehlt“, Regel 3 meldet nichts',
    ohneQ.bei === 'MA-40' && ohneQ.konflikt && !(await jetzt()).some(x => x.regel === 'qualifikation-passt'), ohneQ);
  await bild('3-von-hand');

  /* Absichtlich gebautes Plugin, das am Prüfen vorbei setzt: Der Wächter meldet es. */
  await p.evaluate(() => Huelle.einspielen('probe-verstoss.js', `Huelle.plugin({
    kennung: "probe-verstoss", titel: "Probe: setzt ohne Qualifikation",
    abonniert: { "probe/ausloeser.los": function (m, h) { h.sende({ objekt: "auftraege/XC810-BELA-03", aktion: "umplanen", parameter: { mitarbeiter: "MA-40" } }); } }
  });`));
  /* N-132: Mit Konfliktzähler entsteht der Konflikt „Qualifikation fehlt“, das ist erlaubt, keine Meldung. */
  await p.evaluate(() => Huelle.handeln({ objekt: 'probe/ausloeser', aktion: 'los', erzaehlung: 'Probe' }, 'drehbuecher/probe'));
  await ruhe();
  pruefe('N-132: Zuweisung ohne Qualifikation mit Konflikt „Qualifikation fehlt“ wird nicht gemeldet',
    !(await jetzt()).some(x => x.regel === 'qualifikation-passt') &&
    (await p.evaluate(() => Huelle.zustand.lies('kennzahlen/konflikte/liste').some(k => k.art === 'Qualifikation fehlt' && k.auftrag === 'XC810-BELA-03'))), await jetzt());
  /* Ohne Konfliktzähler fehlt der Konflikt: Das meldet der Wächter. */
  await p.click('#vonVorn');
  await ruhe();
  await p.evaluate(() => Huelle.schalteAus(['konfliktzaehler']));
  await p.evaluate(() => Huelle.handeln({ objekt: 'probe/ausloeser', aktion: 'los', erzaehlung: 'Probe' }, 'drehbuecher/probe'));
  await ruhe();
  h = await jetzt();
  const q = h.filter(x => x.regel === 'qualifikation-passt');
  pruefe('Konflikt fehlt: gemeldet', q.length === 1 &&
    q[0].satz === 'XC 810 Beladen: I. Reindl hat keine Qualifikation für Beladen, und in der Konfliktliste fehlt „Qualifikation fehlt“ – Ein Auftrag bei einem Mitarbeiter ohne die nötige Qualifikation bleibt zugewiesen und ist der Konflikt „Qualifikation fehlt“.', h);
  pruefe('Zum Plugin: das Test-Plugin', q[0] && q[0].verursacher === 'probe-verstoss', q[0]);
  pruefe('Der Wächter hat nichts geändert: Wert steht, wie das Plugin ihn setzte',
    (await p.evaluate(() => Huelle.zustand.lies('auftraege/XC810-BELA-03/mitarbeiter'))) === 'MA-40');

  /* Mindestdauer: „Einsatz ändern“ verweigert; das Test-Plugin kommt durch und wird gemeldet. */
  await p.evaluate(() => Huelle.einspielen('probe-kurz.js', `Huelle.plugin({
    kennung: "probe-kurz", titel: "Probe: macht zu kurz", besitzt: ["auftraege/XB933-TANK-01/ende"],
    abonniert: { "probe/ausloeser.kurz": function (m, h) { var p = "auftraege/XB933-TANK-01"; h.setze(p + "/ende", h.zeit(h.minuten(h.lies(p + "/start")) + 2)); } }
  });`));
  await p.evaluate(() => Huelle.handeln({ objekt: 'probe/ausloeser', aktion: 'kurz' }, 'drehbuecher/probe'));
  await ruhe();
  pruefe('Mindestdauer gebrochen: gemeldet', (await jetzt()).some(x => x.regel === 'mindestdauer' && x.satz.startsWith('XB 933 Betanken dauert nur 2 Minuten')));

  pruefe('Regel des fremden Bereichs wurde in keinem Lauf geprüft', !(await p.evaluate(f => Huelle.waechter.aufrufe()[f], FREMD)));
  pruefe('Keine Regel ist beim Prüfen ausgefallen', (await p.evaluate(() => Huelle.waechter.fehler())).length === 0);

  /* Tagesbeginn: Von vorn räumt den Handzustand ab; der Wächter prüft neu. */
  await p.click('#vonVorn');
  await ruhe();
  pruefe('Von vorn: Tagesbeginn ohne Verstoß', (await jetzt()).length === 0);
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
