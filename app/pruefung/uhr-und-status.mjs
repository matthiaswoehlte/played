/* Prüft Auftrag 005, Stufe 2 (Uhr als Ereignisquelle, Status je Objekt, Fälle ohne Regel):
   - Status zu Tagesbeginn aus dem Datenmodell (Aufträge nach deinem Wunsch vom 07.11., Flüge nach Onblock);
   - der Status geht nur über erlaubte Übergänge, sonst verweigert Play mit einem Satz; ein Plugin, das
     den Status selbst setzen will, ändert nichts und wird gemeldet; das Status-Menü zeigt Unerlaubtes grau;
   - die Uhr: Meldungen vom Vorfeld (Onblock) setzen den Flugstatus, still vorgeführt, in den Ketten mit Worten;
     „Es ist hh:mm“ kommt nur als Ereignis, wenn ein Plugin darauf hört, und darauf darf es setzen;
   - „Uhr laufen lassen“: Um 09:25 ist XB 933 noch nicht am Block; das steht in der Erzählzeile und unter
     „Fälle ohne Regel“, die Dispo bleibt bedienbar, „Uhr anhalten“ hält an;
   - „Fälle ohne Regel“ nach Objektart, mit „Krankmeldung trifft einen Auftrag, der schon Begonnen ist“;
     ein Klick legt den Fall ins Wunschfeld; „Braucht keine Regel“ bleibt nach dem Neuladen;
   - eine Regel für den Fall (wie sie aus einem Wunsch käme) nimmt ihn aus der Liste und wirkt im Szenario.
   Läuft auf einer eigenen Brücke mit einer Kopie deines Stands.
   Aufruf: node pruefung/uhr-und-status.mjs */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const bruecke = await eigeneBruecke(4393, { mitKopie: true });
const { adresse } = bruecke;

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 900) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
async function seite() {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(adresse);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });
  await p.evaluate(() => {
    window.__still = { vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} };
    window.__spiele = async function (d) {
      Huelle.neuerTag(d.von);
      await Huelle.ablauf(d, { buehne: window.__still, minute: 0, warte: async () => {}, stelle: t => Huelle.uhr.stelle(t) });
    };
  });
  return p;
}
const a = await seite();

/* ---------- 1. Status zu Tagesbeginn ---------- */
const beginn = await a.evaluate(() => {
  Huelle.neuerTag('08:40');
  const l = p => Huelle.zustand.lies(p);
  return {
    auftraege: [l('auftraege/XA745-ENTL-01/status'), l('auftraege/XA745-TANK-01/status'), l('auftraege/XC810-TANK-01/status')],
    fluege: [l('fluege/XA101/status'), l('fluege/XA745/status'), l('fluege/XC810/status')],
    fehler: Huelle.fehler.length, vertrag: Huelle.vertrag.map(f => f.satz)
  };
});
pruefe('Aufträge um 08:40: vorbei Fertig, läuft Begonnen, noch nicht begonnen Offen (dein Wunsch vom 07.11.)',
  JSON.stringify(beginn.auftraege) === JSON.stringify(['fertig', 'begonnen', 'offen']), beginn.auftraege);
pruefe('Flüge um 08:40: XA 101 abgefertigt, XA 745 am Block, XC 810 erwartet',
  JSON.stringify(beginn.fluege) === JSON.stringify(['abgefertigt', 'amBlock', 'erwartet']), beginn.fluege);
pruefe('Tagesbeginn ohne Ausfall und ohne Meldung zum Vertrag', !beginn.fehler && !beginn.vertrag.length, beginn.vertrag);

/* ---------- 2. Erlaubte Übergänge ---------- */
const uebergang = await a.evaluate(async () => {
  Huelle.neuerTag('08:40');
  async function befehl(objekt, status) {
    Huelle.bus.sendeNeu({ objekt, aktion: 'status', parameter: { status } }, 'drehbuecher/test');
    await Huelle.bus.abarbeiten(window.__still);
    return Huelle.zustand.lies(objekt + '/status');
  }
  const vor = await befehl('auftraege/XC810-ENTL-01', 'begonnen');
  const zurueck = await befehl('auftraege/XA745-ENTL-01', 'offen');
  const nein = Huelle.bus.protokoll.filter(m => m.aktion === 'verweigert').map(m => m.parameter.grund);
  return { vor, zurueck, nein, erlaubt: Huelle.lesend.erlaubt('auftraege/XC810-ENTL-01') };
});
pruefe('Offen → Begonnen geht', uebergang.vor === 'begonnen', uebergang);
pruefe('Fertig → Offen verweigert Play mit einem Satz: „XA 745 Entladen ist Fertig; von Fertig geht es nicht auf Offen“',
  uebergang.zurueck === 'fertig' && uebergang.nein.includes('XA 745 Entladen ist Fertig; von Fertig geht es nicht auf Offen'), uebergang);
pruefe('von Begonnen geht es nur noch auf Fertig', JSON.stringify(uebergang.erlaubt) === '["fertig"]', uebergang.erlaubt);

/* Ein Plugin, das den Status selbst setzt, ändert nichts und wird gemeldet */
const selbst = await a.evaluate(async () => {
  Huelle.einspielen('test-status-selbst.js', `Huelle.plugin({ kennung: "test-status-selbst", titel: "Status selbst",
    abonniert: { "test/status.los": function (m, h) { h.setze("auftraege/XC810-TANK-01/status", "fertig"); } } });`);
  Huelle.neuerTag('08:40');
  Huelle.bus.sendeNeu({ objekt: 'test/status', aktion: 'los' }, 'drehbuecher/test');
  await Huelle.bus.abarbeiten(window.__still);
  const r = { status: Huelle.zustand.lies('auftraege/XC810-TANK-01/status'), vertrag: Huelle.vertrag.map(f => f.satz) };
  Huelle.schalteAus(['test-status-selbst']); delete Huelle.aus['test-status-selbst'];
  return r;
});
pruefe('ein Plugin, das den Status selbst setzt, ändert nichts, und Play sagt es in einem Satz',
  selbst.status === 'offen' && selbst.vertrag.some(s => /„Status selbst“ setzt den Status von XC 810 Betanken selbst/.test(s)), selbst);

/* Das Status-Menü zeigt, was von hier aus nicht geht, grau; nach der Wahl ist es zu */
await a.evaluate(async () => {
  Huelle.player.beende();
  Huelle.neuerTag('08:40');
  Huelle.handeln({ objekt: 'kennzahlen/statusmenue', aktion: 'anzeigen', parameter: { auftrag: 'XA745-TANK-01' } }, 'hand');
  for (let i = 0; i < 100 && (Huelle.bus.arbeitet || Huelle.bus.warteschlange.length); i++) await new Promise(r => setTimeout(r, 20));
});
const menue = await a.evaluate(() => [...document.querySelectorAll('.pl-statusmenue .pl-statuswahl')].map(e => [e.dataset.status, e.classList.contains('pl-statuswahl-nein')]));
pruefe('Status-Menü an XA 745 Betanken (Begonnen): Offen grau, Begonnen und Fertig wählbar',
  JSON.stringify(menue) === JSON.stringify([['offen', true], ['begonnen', false], ['fertig', false]]), menue);
await a.click('.pl-statusmenue .pl-statuswahl[data-status="fertig"]');
await a.waitForFunction(() => Huelle.zustand.lies('auftraege/XA745-TANK-01/status') === 'fertig' && !Huelle.zustand.lies('kennzahlen/statusmenue/auftrag'), null, { timeout: 5000 }).catch(() => {});
const gewaehlt = await a.evaluate(() => [Huelle.zustand.lies('auftraege/XA745-TANK-01/status'), Huelle.zustand.lies('kennzahlen/statusmenue/auftrag')]);
pruefe('Klick auf „Fertig“: XA 745 Betanken ist Fertig, das Menü ist zu', gewaehlt[0] === 'fertig' && gewaehlt[1] === null, gewaehlt);

/* ---------- 3. Die Uhr ---------- */
const takt = await a.evaluate(async () => {
  const d = Huelle.drehbuecher.find(x => x.kennung === 'wunsch-008');   // 08:10–08:30, XA 745 kommt um 08:15 an Block
  await window.__spiele(d);
  const onblock = Huelle.bus.protokoll.filter(m => m.objekt === 'fluege/XA745' && m.aktion === 'onblock');
  const minuten = Huelle.bus.protokoll.filter(m => m.objekt === 'uhr/tag').length;
  const ketten = Huelle.kette.kurzformen().map(k => k.kurz);
  return {
    onblock: onblock.map(m => [m.zeit, m.stumm, m.absender]), status: Huelle.zustand.lies('fluege/XA745/status'),
    minuten, ketten: ketten.filter(k => /XA 745 ist/.test(k)), fehler: Huelle.fehler.map(f => f.text)
  };
});
pruefe('Onblock von XA 745 kommt um 08:15 von der Uhr, still vorgeführt, und setzt den Flug auf Am Block',
  JSON.stringify(takt.onblock) === JSON.stringify([['08:15', true, 'huelle/uhr']]) && takt.status === 'amBlock', takt);
await a.click('#ketteKnopf');
const baum = await a.evaluate(() => {
  const d = [...document.querySelectorAll('#ketteListe details.kette')].find(x => /XA 745 ist am Block/.test(x.querySelector('summary').textContent));
  if (!d) return null;
  d.open = true;
  return d.querySelector('.kette-baum').textContent;
});
await a.click('#ketteKnopf');
pruefe('in den Ketten mit Worten: „XA 745 ist am Block“, aufgeklappt „XA 745 ist jetzt Am Block statt Erwartet“',
  takt.ketten.some(k => /^XA 745 ist am Block/.test(k)) && /XA 745 ist jetzt Am Block statt Erwartet/.test(baum || ''), [takt.ketten, baum]);
pruefe('ohne Plugin, das auf die Minute hört, kein Minuten-Ereignis', takt.minuten === 0 && !takt.fehler.length, takt);

const minute = await a.evaluate(async () => {
  Huelle.einspielen('test-minute.js', `Huelle.plugin({ kennung: "test-minute", titel: "Minutenzähler", besitzt: ["kennzahlen/test/minuten"],
    beimStart: function (h) { h.setze("kennzahlen/test/minuten", 0); },
    abonniert: { "uhr/tag.minute": function (m, h) { h.setze("kennzahlen/test/minuten", h.lies("kennzahlen/test/minuten") + 1); } } });`);
  const d = Huelle.drehbuecher.find(x => x.kennung === 'wunsch-008');
  await window.__spiele(d);
  const r = { zahl: Huelle.zustand.lies('kennzahlen/test/minuten'), vertrag: Huelle.vertrag.map(f => f.satz) };
  Huelle.schalteAus(['test-minute']); delete Huelle.aus['test-minute'];
  return r;
});
pruefe('ein Plugin, das auf „Es ist hh:mm“ hört, bekommt 08:11 bis 08:30 (20 Minuten) und darf darauf setzen',
  minute.zahl === 20 && !minute.vertrag.length, minute);

/* Bus-Vertrag 1 auch für die Uhr: Hört ein Plugin auf „Es ist hh:mm“ und sendet darauf etwas, sind dessen Folgen
   abgearbeitet, bevor die Meldung derselben Minute (08:15 Onblock XA 745) beginnt. Fehler, aufgefallen am 09.11. */
const ketten = await a.evaluate(async () => {
  Huelle.einspielen('test-minute-folge.js', `Huelle.plugin({ kennung: "test-minute-folge", titel: "Minute mit Folge", besitzt: ["kennzahlen/test/folgen"],
    beimStart: function (h) { h.setze("kennzahlen/test/folgen", 0); },
    abonniert: {
      "uhr/tag.minute": function (m, h) { h.sende({ objekt: "kennzahlen/test", aktion: "zaehle" }); },
      "kennzahlen/test.zaehle": function (m, h) { h.setze("kennzahlen/test/folgen", h.lies("kennzahlen/test/folgen") + 1); }
    } });`);
  const d = Huelle.drehbuecher.find(x => x.kennung === 'wunsch-008');
  await window.__spiele(d);
  const folge = Huelle.bus.protokoll.map(m => m.ursprung);
  const fertig = new Set(); let vorige = null, zurueck = null;
  folge.forEach((u, i) => { if (u !== vorige) { if (fertig.has(u)) zurueck = zurueck || i + 1; if (vorige !== null) fertig.add(vorige); vorige = u; } });
  Huelle.schalteAus(['test-minute-folge']); delete Huelle.aus['test-minute-folge'];
  return { zurueck, folgen: Huelle.zustand.lies('kennzahlen/test/folgen') };
});
pruefe('jedes Ereignis der Uhr ist ganz abgearbeitet, bevor das nächste beginnt (auch Onblock in derselben Minute)',
  ketten.zurueck === null && ketten.folgen === 20, ketten);

/* ---------- 4. Uhr laufen lassen: XB 933 ist um 09:25 noch nicht am Block ---------- */
await a.evaluate(() => { Huelle.player.beende(); });
await a.selectOption('#wahl', 'krankmeldung-ma-20');
await a.evaluate(() => { Huelle.neuerTag('09:15'); document.getElementById('uhr').textContent = '09:15'; });
await a.click('.tempo button[data-wert="4"]');
const t0 = Date.now();
await a.selectOption('#wahl', '@uhr');
await a.waitForFunction(() => Huelle.uhr.zeit >= '09:26', null, { timeout: 60000 }).catch(() => {});
const frist = await a.evaluate(() => ({
  zeit: Huelle.uhr.zeit,
  zeile: [...document.querySelectorAll('#spur div, #zeile')].map(e => e.textContent),
  protokoll: Huelle.bus.protokoll.filter(m => m.aktion === 'ohneOnblock').map(m => [m.objekt, m.zeit, m.erzaehlung]),
  liste: Huelle.luecken.faelle(),
  knopf: document.getElementById('faelleKnopf').textContent,
  liste2: [...document.querySelectorAll('#wahl option')].map(o => o.textContent).filter(t => /^Uhr /.test(t))
}));
console.log(`     Uhr von 09:15 bis ${frist.zeit} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
pruefe('um 09:25 sendet die Uhr „XB 933 ist um 09:25 noch nicht am Block“',
  JSON.stringify(frist.protokoll) === JSON.stringify([['fluege/XB933', '09:25', 'XB 933 ist um 09:25 noch nicht am Block']]), frist.protokoll);
pruefe('das steht in der Erzählzeile', frist.zeile.some(z => /09:25\s+XB 933 ist um 09:25 noch nicht am Block/.test(z)), frist.zeile);
const flug = frist.liste.find(g => g.name === 'Flug');
pruefe('unter „Fälle ohne Regel“, Gruppe Flug: „Ein Flug ist zur geplanten Onblock-Zeit noch nicht am Block: keine Regel.“ mit dem eben Geschehenen',
  !!flug && flug.faelle.some(f => f.satz === 'Ein Flug ist zur geplanten Onblock-Zeit noch nicht am Block: keine Regel.' && /XB 933 ist um 09:25/.test(f.zuletzt || '')), frist.liste);
pruefe('in der Player-Liste steht während des Laufs „Uhr anhalten“', JSON.stringify(frist.liste2) === '["Uhr anhalten"]', frist.liste2);

/* Während die Uhr läuft, lässt sich die Dispo bedienen */
const handDabei = await a.evaluate(async () => {
  Huelle.handeln({ objekt: 'auftraege/XB933-ENTL-01', aktion: 'status', parameter: { status: 'begonnen' } }, 'hand');
  for (let i = 0; i < 100 && Huelle.zustand.lies('auftraege/XB933-ENTL-01/status') !== 'begonnen'; i++) await new Promise(r => setTimeout(r, 20));
  return Huelle.zustand.lies('auftraege/XB933-ENTL-01/status');
});
pruefe('während die Uhr läuft, wirkt eine Bedienung von Hand', handDabei === 'begonnen', handDabei);
await a.waitForFunction(() => Huelle.uhr.zeit >= '09:46', null, { timeout: 60000 }).catch(() => {});
const spaeter = await a.evaluate(() => Huelle.zustand.lies('fluege/XB933/status'));
pruefe('um 09:45 kommt XB 933 an Block (20 Minuten später als geplant)', spaeter === 'amBlock', spaeter);
await a.selectOption('#wahl', '@uhr');
const stand = await a.evaluate(async () => { const z = Huelle.uhr.zeit; await new Promise(r => setTimeout(r, 800)); return [z, Huelle.uhr.zeit]; });
pruefe('„Uhr anhalten“ hält die Uhr an', stand[0] === stand[1], stand);

/* ---------- 5. Fälle ohne Regel ---------- */
await a.evaluate(() => Huelle.verwaltung.pruefe());
await a.waitForFunction(() => Huelle.verwaltung.fertig(), null, { timeout: 180000 });
const faelle = await a.evaluate(() => Huelle.luecken.faelle());
const auftrag = faelle.find(g => g.name === 'Auftrag');
console.log('     Fälle ohne Regel:\n' + faelle.map(g => '       ' + g.name + ': ' + g.faelle.map(f => f.satz).join(' | ')).join('\n'));
pruefe('Gruppe Auftrag: „Krankmeldung trifft einen Auftrag, der schon Begonnen ist: keine Regel.“ (und „… Fertig ist“)',
  !!auftrag && ['Begonnen', 'Fertig'].every(s => auftrag.faelle.some(f => f.satz === `Krankmeldung trifft einen Auftrag, der schon ${s} ist: keine Regel.`)), faelle);
pruefe('kein Fall nennt den gewöhnlichen Status Offen', !faelle.some(g => g.faelle.some(f => /schon Offen/.test(f.satz))), faelle);
pruefe('kein Satz aus dem Maschinenraum (Pfade, Kennungen)', !faelle.some(g => g.faelle.some(f => /[a-z]+\/|MA-\d|XA\d|ohneOnblock|auftraege/.test(f.satz))), faelle);

await a.click('#faelleKnopf');
const satzKrank = 'Krankmeldung trifft einen Auftrag, der schon Begonnen ist: keine Regel.';
await a.locator('#faelleListe .luecke-wunsch', { hasText: satzKrank }).click();
const feld = await a.inputValue('#wunschFeld');
pruefe('ein Klick legt den Fall als Anfang eines Wunsches ins Wunschfeld', feld === 'Krankmeldung trifft einen Auftrag, der schon Begonnen ist: ', feld);
await a.fill('#wunschFeld', '');

const schluessel = auftrag.faelle.find(f => f.satz === satzKrank.replace('Begonnen', 'Fertig')).schluessel;
await a.locator(`#faelleListe [data-fall="${schluessel}"] .fall-keine`).click();
await a.waitForFunction(k => Huelle.luecken.faelle().some(g => g.faelle.some(f => f.schluessel === k && f.abgehakt)), schluessel, { timeout: 5000 }).catch(() => {});
const datei = bruecke.faelle;
const liesDatei = () => (datei && existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : null);
for (let i = 0; i < 50 && !(liesDatei() || []).some(e => e.schluessel === schluessel); i++) await new Promise(r => setTimeout(r, 100));
const gespeichert = liesDatei();
pruefe('„Braucht keine Regel“ wird mit Datum gespeichert', !!gespeichert && gespeichert.some(e => e.schluessel === schluessel && e.datum && /Braucht keine Regel/.test(e.wie)), { datei, gespeichert });
const knopfText = await a.textContent('#faelleKnopf');
const zahlVorher = faelle.reduce((n, g) => n + g.faelle.length, 0);
pruefe('der Zähler zählt den abgehakten Fall nicht mehr', knopfText === `${zahlVorher - 1} Fälle ohne Regel`, [knopfText, zahlVorher]);

const b = await seite();
await b.click('#faelleKnopf');
const nachLaden = await b.evaluate(k => ({
  abgehakt: Huelle.luecken.faelle().some(g => g.faelle.some(f => f.schluessel === k && f.abgehakt)),
  unten: !!document.querySelector(`#faelleListe [data-fall-erledigt="${k}"]`)
}), schluessel);
pruefe('nach dem Neuladen bleibt er abgehakt und steht unter „brauchen keine Regel“', nachLaden.abgehakt && nachLaden.unten, nachLaden);
await b.click('#faelleListe .faelle-erledigt summary');
await b.locator(`#faelleListe [data-fall-erledigt="${schluessel}"] .fall-keine`).click();
await b.waitForFunction(k => !Huelle.luecken.faelle().some(g => g.faelle.some(f => f.schluessel === k && f.abgehakt)), schluessel, { timeout: 5000 }).catch(() => {});
for (let i = 0; i < 50 && (liesDatei() || []).some(e => e.schluessel === schluessel); i++) await new Promise(r => setTimeout(r, 100));
const zurueck = liesDatei();
pruefe('„Doch eine Regel nötig“ nimmt das zurück', !(zurueck || []).some(e => e.schluessel === schluessel), zurueck);
await b.close();

/* ---------- 6. Eine Regel für den Fall nimmt ihn aus der Liste und wirkt ---------- */
const regel = await a.evaluate(async () => {
  Huelle.einspielen('test-onblock-regel.js', `Huelle.plugin({ kennung: "test-onblock-regel", titel: "Ohne Onblock verschieben",
    abonniert: { "fluege/*.ohneOnblock": function (m, h) {
      var flug = h.lies(m.objekt + "/flug");
      h.alle("auftraege").filter(function (a) { return a.flug === flug && a.status === "offen"; }).forEach(function (a) {
        h.sende({ objekt: "auftraege/" + a.kennung, aktion: "verschieben", parameter: { minuten: 10 }, erzaehlung: flug + " " + a.arbeit + " rückt 10 Minuten nach hinten" });
      });
    } } });`);
  Huelle.drehbuch({ kennung: 'test-ohne-onblock', titel: 'XB 933 kommt nicht pünktlich', von: '09:20', bis: '09:30', ereignisse: [], erwartet: [] });
  const d = Huelle.drehbuecher.find(x => x.kennung === 'test-ohne-onblock');
  await window.__spiele(d);
  const r = {
    start: Huelle.zustand.lies('auftraege/XB933-ENTL-01/start'),
    flugFall: Huelle.faelleOhneRegel([]).some(g => g.faelle.some(f => /Onblock-Zeit/.test(f.satz))),
    fehler: Huelle.fehler.map(f => f.text)
  };
  Huelle.schalteAus(['test-onblock-regel']); delete Huelle.aus['test-onblock-regel'];
  Huelle.drehbuecher = Huelle.drehbuecher.filter(x => x.kennung !== 'test-ohne-onblock');
  return r;
});
pruefe('mit einer Regel für den Fall rückt XB 933 Entladen um 09:25 von 09:30 auf 09:40', regel.start === '09:40' && !regel.fehler.length, regel);
pruefe('und der Fall steht nicht mehr unter „Fälle ohne Regel“', !regel.flugFall, regel);

await browser.close();

console.log(fehler ? `${fehler} Prüfung(en) rot` : 'alles grün');
process.exit(fehler ? 1 : 0);
