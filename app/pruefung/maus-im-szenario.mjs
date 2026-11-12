/* Anweisung 57: Szenarien führen Mausbedienungen echt aus, im Probelauf wie beim Vorspielen.
   Prüft in der unsichtbaren Kopie (Probelauf) und auf der sichtbaren Seite:
   - Ziehen eines Balkens auf eine andere Zeile, als Schritt „bedienung“ im Szenario, wirkt wie von Hand.
   - Ein Doppelklick eines neuen Plugins wird ausgeführt; seine Bedienung zählt als geprüft.
   - Fasst die Bedienung nichts, ist der Probelauf rot, mit einem Satz für den Anforderer und einem für die KI.
   - Bringt ein Plugin eine Mausbedienung ohne Szenario, meldet der Probelauf sie als ungeprüft.
   - Anweisung 61: Liegen Greif- und Ablegestelle außerhalb des sichtbaren Ausschnitts, rollt der Probelauf hin wie ein Mensch.
   Aufruf: node pruefung/maus-im-szenario.mjs  (Testvorlage, keine KI, nichts wird gespeichert) */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const beginn = Date.now();
let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}
function schritt(text) { console.log(`… ${text} (${Math.round((Date.now() - beginn) / 1000)} s)`); }

schritt('Brücke aus der Testvorlage starten');
const { adresse: ADRESSE, kind } = await eigeneBruecke(4371, { ausVorlage: true });
const browser = await chromium.launch({ args: ['--site-per-process'] });

try {
  const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('.pl-balken'));

  const ZIEHEN = `Huelle.drehbuch({ kennung: "test-maus-ziehen", titel: "Balken mit der Maus umplanen", von: "05:00", bis: "05:02",
    ereignisse: [{ zeit: "05:01", bedienung: "ziehen", greift: "auftraege/XC810-ENTL-01", nach: "mitarbeiter/MA-02" }],
    erwartet: [{ text: "XC 810 Entladen liegt bei MA-02.", pruefe: [{ pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-02" }] }] });`;
  const DOPPEL = (fasst) => `Huelle.plugin({ kennung: "test-doppelklick", titel: "Doppelklick markiert",
    besitzt: ["auftraege/*/markiert"],
    abonniert: { "auftraege/*.markieren": function (m, h) { h.setze(m.objekt + "/markiert", true); } },
    bedienungen: [{ kennung: "markieren", titel: "Auftrag markieren", sicht: "gantt", art: "doppelklicken", fasst: "${fasst}",
      ereignis: function (g) { return { objekt: g.pfad, aktion: "markieren", parameter: {}, erzaehlung: "markiert" }; } }] });`;
  const DOPPEL_SZENARIO = `Huelle.drehbuch({ kennung: "test-maus-doppel", titel: "Auftrag per Doppelklick markieren", von: "05:00", bis: "05:02",
    ereignisse: [{ zeit: "05:01", bedienung: "doppelklicken", greift: "auftraege/XC810-ENTL-01", sicht: "gantt" }],
    erwartet: [{ text: "XC 810 Entladen ist markiert.", pruefe: [{ pfad: "auftraege/XC810-ENTL-01/markiert", gleich: true }] }] });`;

  const probe = (dateien) => p.evaluate((dateien) => new Promise(ok => {
    Huelle.nachspiel.probe(dateien, [], ok, null, []);
  }), dateien);

  schritt('Probelauf: Ziehen als Schritt im Szenario');
  let r = await probe([{ name: 'test-maus-ziehen.drehbuch.js', quelle: ZIEHEN }]);
  pruefe('Ziehen auf eine andere Zeile wirkt wie von Hand, ohne Ausfall', !r.ausfaelle.length, [r.ausfaelle, r.bedienHinweise]);

  schritt('Probelauf: Doppelklick eines neuen Plugins mit Szenario');
  r = await probe([{ name: 'test-doppelklick.js', quelle: DOPPEL('.pl-balken') }, { name: 'test-maus-doppel.drehbuch.js', quelle: DOPPEL_SZENARIO }]);
  pruefe('Doppelklick ausgeführt, Erwartung erfüllt', !r.ausfaelle.length, r.ausfaelle);
  pruefe('Bedienung zählt als geprüft', r.ungeprueft.length === 0, r.ungeprueft);

  schritt('Probelauf: Bedienung, die nichts fasst');
  r = await probe([{ name: 'test-doppelklick.js', quelle: DOPPEL('.gibt-es-nicht') }, { name: 'test-maus-doppel.drehbuch.js', quelle: DOPPEL_SZENARIO }]);
  pruefe('Probelauf ist rot mit Satz für den Anforderer', r.ausfaelle.some(a => /Doppelklick auf .* bewirkt nichts/.test(a)), r.ausfaelle);
  pruefe('die KI erfährt, was unter dem Zeiger lag', (r.bedienHinweise || []).some(a => /Unter dem Zeiger/.test(a)), r.bedienHinweise);

  schritt('Probelauf: Mausbedienung ohne Szenario');
  r = await probe([{ name: 'test-doppelklick.js', quelle: DOPPEL('.pl-balken') }]);
  pruefe('als ungeprüft gemeldet', r.ungeprueft.length === 1 && r.ungeprueft[0].schluessel === 'test-doppelklick|markieren', r.ungeprueft);

  /* Anweisung 61: Greif- und Ablegestelle liegen außerhalb des sichtbaren Ausschnitts eines kleinen rollenden Bereichs,
     waagrecht und senkrecht, mit einer stehenden Kopfzeile darüber. Der Probelauf rollt hin wie ein Mensch. */
  const ROLLEN = `Huelle.plugin({ kennung: "test-rollen", titel: "Rollfläche",
    besitzt: ["proben/*/fach"],
    beimStart: function (h) { h.setze("proben/P1/fach", "F02"); h.setze("proben/P2/fach", "liste"); },
    abonniert: { "proben/*.ablegen": function (m, h) { h.setze(m.objekt + "/fach", m.parameter.fach); } },
    ansicht: { ort: "haupt", rang: 99, zeichne: function (el, h) {
      var fach = h.lies("proben/P1/fach") || "F02", fach2 = h.lies("proben/P2/fach") || "liste", z = "";
      for (var i = 1; i <= 20; i++) {
        var k = "F" + (i < 10 ? "0" : "") + i;
        z += '<div class="fach" data-pfad="fach/' + k + '" style="position:absolute;left:0;top:' + (30 + i * 60) + 'px;width:3000px;height:40px;background:#eee">' +
          (k === fach ? '<div class="probe" data-pfad="proben/P1" aria-label="Probe P1" style="position:absolute;left:2600px;width:80px;height:40px;background:#c33">P1</div>' : "") +
          (k === fach2 ? '<div class="probe" data-pfad="proben/P2" aria-label="Probe P2" style="position:absolute;left:100px;width:80px;height:40px;background:#3c3">P2</div>' : "") + "</div>";
      }
      el.innerHTML = '<div style="display:flex;gap:20px"><div data-rollen="r" style="position:relative;width:420px;height:200px;overflow:auto">' +
        '<div style="position:sticky;top:0;height:30px;background:#333;z-index:2;width:3000px"></div>' +
        '<div style="position:relative;width:3000px;height:1300px">' + z + "</div></div>" +
        '<div style="width:200px;height:200px;background:#ddd">' + (fach2 === "liste" ? '<div class="probe" data-pfad="proben/P2" aria-label="Probe P2" style="height:40px;margin-top:150px;background:#3c3">P2</div>' : "") + "</div></div>";
    } },
    bedienungen: [{ kennung: "ablegen", titel: "Probe ablegen", art: "ziehen", fasst: ".probe", ziel: ".fach",
      ereignis: function (g) { return g.ziel ? { objekt: g.pfad, aktion: "ablegen", parameter: { fach: g.ziel.pfad.split("/")[1] }, erzaehlung: "abgelegt" } : null; } }] });`;
  const ROLLEN_SZENARIO = `Huelle.drehbuch({ kennung: "test-maus-rollen", titel: "Probe weit weg ablegen", von: "05:00", bis: "05:02",
    ereignisse: [{ zeit: "05:01", bedienung: "ziehen", greift: "proben/P1", nach: "fach/F19" }],
    erwartet: [{ text: "P1 liegt in F19.", pruefe: [{ pfad: "proben/P1/fach", gleich: "F19" }] }] });`;
  schritt('Probelauf: Greifen und Ablegen außerhalb des sichtbaren Ausschnitts');
  r = await probe([{ name: 'test-rollen.js', quelle: ROLLEN }, { name: 'test-maus-rollen.drehbuch.js', quelle: ROLLEN_SZENARIO }]);
  pruefe('rollt zum Greifen und zum Ablegen hin, Erwartung erfüllt', !r.ausfaelle.length, [r.ausfaelle, r.bedienHinweise]);
  /* Aus einer Liste neben dem Plan auf eine Zeile, die viel breiter ist als der Ausschnitt und weit unten liegt */
  const AUS_LISTE = ROLLEN_SZENARIO.replace('greift: "proben/P1", nach: "fach/F19"', 'greift: "proben/P2", nach: "fach/F17"').replace('proben/P1/fach", gleich: "F19"', 'proben/P2/fach", gleich: "F17"').replace('P1 liegt in F19', 'P2 liegt in F17').replace('test-maus-rollen', 'test-maus-rollen-3');
  r = await probe([{ name: 'test-rollen.js', quelle: ROLLEN }, { name: 'test-maus-rollen-3.drehbuch.js', quelle: AUS_LISTE }]);
  pruefe('aus der Liste daneben auf eine breite Zeile außerhalb des Ausschnitts', !r.ausfaelle.length, [r.ausfaelle, r.bedienHinweise]);
  const NICHT_DA = ROLLEN_SZENARIO.replace('nach: "fach/F19"', 'nach: "fach/F77"').replace('test-maus-rollen', 'test-maus-rollen-2');
  r = await probe([{ name: 'test-rollen.js', quelle: ROLLEN }, { name: 'test-maus-rollen-2.drehbuch.js', quelle: NICHT_DA }]);
  pruefe('fehlender Ablageort: die KI erfährt, welche Ablageorte zu sehen sind', (r.bedienHinweise || []).some(a => /Ablageorte, die zu diesem Zeitpunkt zu sehen sind: fach\//.test(a)), r.bedienHinweise);

  schritt('Vorspielen auf der sichtbaren Seite');
  await p.evaluate((q) => { Huelle.einspielen('test-maus-ziehen.drehbuch.js', q); }, ZIEHEN);
  const sichtbar = await p.evaluate(async () => {
    Huelle.neuerTag('05:00');
    await Huelle.ablauf(Huelle.drehbuecher.find(d => d.kennung === 'test-maus-ziehen'), {
      buehne: { vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} }, minute: 0,
      warte: async () => {}, stelle: t => Huelle.uhr.stelle(t)
    });
    return { mitarbeiter: Huelle.zustand.lies('auftraege/XC810-ENTL-01/mitarbeiter'), fehler: Huelle.bedienFehler };
  });
  pruefe('sichtbar gespielt: Balken liegt danach bei MA-02', sichtbar.mitarbeiter === 'MA-02' && !sichtbar.fehler.length, sichtbar);
} finally {
  await browser.close();
  kind.kill();
}
console.log(`${fehler ? 'ROT' : 'GRÜN'}: ${fehler} Fehler, ${Math.round((Date.now() - beginn) / 1000)} s`);
process.exit(fehler ? 1 : 0);
