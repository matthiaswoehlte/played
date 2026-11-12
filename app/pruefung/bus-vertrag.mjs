/* Prüft Auftrag 005, Stufe 1 (Bus-Vertrag):
   - jedes Szenario 20-mal hintereinander: Endstand und Ereignisfolge jedes Mal gleich, auch in einer
     zweiten, frisch geladenen Seite;
   - alle Szenarien enden wie deine Sollergebnisse, ohne Ausfall und ohne Meldung zum Vertrag;
   - je ein absichtlich gebautes Test-Plugin für Schleife, Doppel-Schreiber und Absturz (dazu Warten
     und eigene Uhr) zeigt seine Meldung und richtet keinen Schaden an;
   - die Kette eines Ereignisses lässt sich aufklappen („Krankmeldung → … → Liste, Zähler“);
   - feste Reihenfolge nach Pfad, gleich in welcher Reihenfolge eingespielt wurde.
   Läuft auf einer eigenen Brücke mit einer Kopie deines Stands.
   Aufruf: node pruefung/bus-vertrag.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse } = await eigeneBruecke(4371, { mitKopie: true });
const MAL = 20;

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 700) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
async function seite() {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await p.goto(adresse);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });
  /* Ein stiller Ablauf in der Seite: derselbe Rechenweg, ohne Vorführung */
  await p.evaluate(() => {
    window.__spiele = async function (kennung) {
      const d = Huelle.drehbuecher.find(x => x.kennung === kennung);
      Huelle.neuerTag(d.von);
      await Huelle.ablauf(d, {
        buehne: { vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} },
        minute: 0, warte: async () => {}, stelle: t => Huelle.uhr.stelle(t)
      });
      const folge = Huelle.bus.protokoll.map(m => [m.nr, m.objekt, m.aktion, m.parameter, m.absender, m.ausloeser, m.ursprung, m.tiefe, m.zeit, m.durch || null]);
      return { endstand: JSON.stringify(Huelle.soll.endstand()), folge: JSON.stringify(folge), fehler: Huelle.fehler.map(f => f.wer + ': ' + f.text) };
    };
  });
  return p;
}

/* ---------- 1. Jedes Szenario 20-mal gleich ---------- */
const a = await seite();
const kennungen = await a.evaluate(() => Huelle.drehbuecher.map(d => d.kennung));
const t0 = Date.now();
const erste = {};
for (const k of kennungen) {
  const runden = await a.evaluate(async ([k, mal]) => {
    const out = [];
    for (let i = 0; i < mal; i++) out.push(await window.__spiele(k));
    return out;
  }, [k, MAL]);
  erste[k] = runden[0];
  const endGleich = runden.every(r => r.endstand === runden[0].endstand);
  const folgeGleich = runden.every(r => r.folge === runden[0].folge);
  const ohneFehler = runden.every(r => !r.fehler.length);
  pruefe(`${k}: ${MAL}-mal gleicher Endstand und gleiche Ereignisfolge, ohne Ausfall`, endGleich && folgeGleich && ohneFehler,
    { endGleich, folgeGleich, fehler: runden.find(r => r.fehler.length)?.fehler });
}
console.log(`     ${kennungen.length} Szenarien je ${MAL}-mal: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/* Jede Nachricht trägt Nummer, Auslöser, Ursprung, Tiefe, Zeit und Objektpfad */
const kennzeichen = await a.evaluate(() => Huelle.bus.protokoll.every(m =>
  typeof m.nr === 'number' && 'ausloeser' in m && typeof m.ursprung === 'number' && typeof m.tiefe === 'number' && m.zeit && m.objekt));
pruefe('jede Nachricht trägt Nummer, Auslöser, Ursprung, Tiefe, Zeit und Objektpfad', kennzeichen);

/* Dieselben Ergebnisse in einer zweiten, frisch geladenen Seite */
const b = await seite();
const anders = [];
for (const k of kennungen) {
  const r = await b.evaluate(k => window.__spiele(k), k);
  if (r.endstand !== erste[k].endstand || r.folge !== erste[k].folge) anders.push(k);
}
pruefe('zweite Seite: je Szenario derselbe Endstand und dieselbe Ereignisfolge', !anders.length, anders);
await b.close();

/* ---------- 2. Alle Szenarien enden wie deine Sollergebnisse ---------- */
const lauf = await a.evaluate(() => new Promise(ok => Huelle.nachspiel.lauf(null, ok, { teile: Huelle.nachspiel.kerne })));
pruefe('alle Szenarien enden wie die Sollergebnisse (keine Abweichung)', !lauf.abweichungen.length, lauf.abweichungen);
pruefe('kein Ausfall und keine Meldung zum Vertrag', !lauf.ausfaelle.length, lauf.ausfaelle);
const offen = lauf.drehbuecher.filter(d => d.erwartung).map(d => [d.kennung, d.erwartung]);
pruefe('alle Szenarien grün (jede Erwartung erfüllt oder als Sollergebnis abgenommen)', lauf.drehbuecher.length === kennungen.length && !offen.length, offen);

/* ---------- 3. Feste Reihenfolge nach Pfad ---------- */
const reihe = await a.evaluate(() => {
  const gerufen = [];
  const quelle = n => `Huelle.plugin({ kennung: "${n}", titel: "Reihe ${n}", abonniert: { "test/reihe.los": function (m, h) { window.__reihe.push("${n}"); } } });`;
  window.__reihe = gerufen;
  Huelle.einspielen('test-reihe-z.js', quelle('zz-reihe'));
  Huelle.einspielen('test-reihe-a.js', quelle('aa-reihe'));
  Huelle.einspielen('test-reihe-m.js', quelle('mm-reihe'));
  Huelle.bus.melde('test/reihe', 'los', {});
  return gerufen.slice();
});
pruefe('Plugins zu einer Nachricht nach Pfad gerufen, nicht nach Einspielen', JSON.stringify(reihe) === JSON.stringify(['aa-reihe', 'mm-reihe', 'zz-reihe']), reihe);

/* ---------- 4. Test-Plugins: Schleife, Doppel-Schreiber, Absturz, Warten, eigene Uhr ---------- */
async function probe(name, quelle, ereignis) {
  return a.evaluate(async ([name, quelle, ereignis]) => {
    Huelle.neuerTag('09:00');
    const vorher = JSON.stringify(Huelle.zustand.wurzel);
    let eingespielt = null;
    try { Huelle.einspielen(name, quelle); eingespielt = true; } catch (e) { eingespielt = e.message; }
    Huelle.neuerTag('09:00');
    const start = JSON.stringify(Huelle.zustand.wurzel);
    if (ereignis) {
      Huelle.bus.sendeNeu(ereignis, 'drehbuecher/test');
      await Huelle.bus.abarbeiten({ vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} });
    }
    const nachher = JSON.stringify(Huelle.zustand.wurzel);
    const meldungen = Huelle.vertrag.map(f => f.satz);
    const ketten = Huelle.kette.kurzformen();
    return { eingespielt, unveraendert: nachher === start, gleichWieVorher: start === vorher, meldungen, ketten, rest: Huelle.bus.warteschlange.length };
  }, [name, quelle, ereignis]);
}
async function weg(kennung) {
  await a.evaluate(k => { Huelle.schalteAus([k]); delete Huelle.aus[k]; }, kennung);
}

const schleife = await probe('test-schleife.js', `Huelle.plugin({
  kennung: "test-schleife-a", titel: "Pingpong A", besitzt: ["kennzahlen/pingpong/a"],
  abonniert: {
    "kennzahlen/pingpong.ping": function (m, h) { h.setze("kennzahlen/pingpong/a", m.parameter.n); h.sende({ objekt: "kennzahlen/pingpong", aktion: "pong", parameter: { n: m.parameter.n + 1 } }); }
  }
});
Huelle.plugin({
  kennung: "test-schleife-b", titel: "Pingpong B",
  abonniert: {
    "kennzahlen/pingpong.pong": function (m, h) { h.sende({ objekt: "kennzahlen/pingpong", aktion: "ping", parameter: { n: m.parameter.n + 1 } }); }
  }
});`, { objekt: 'kennzahlen/pingpong', aktion: 'ping', parameter: { n: 1 }, erzaehlung: 'Pingpong beginnt' });
pruefe('Schleife: ein Satz „… löst eine Endlosschleife aus zwischen „Pingpong A“ und „Pingpong B“', schleife.meldungen.some(s => /Pingpong beginnt.*Endlosschleife aus zwischen „Pingpong A“ und „Pingpong B“/.test(s)), schleife.meldungen);
pruefe('Schleife: der Stand davor gilt wieder, nichts wartet mehr', schleife.unveraendert && schleife.rest === 0, schleife);
pruefe('Schleife: in den Ketten als zurückgenommen', schleife.ketten.some(k => k.zurueck), schleife.ketten);
await weg('test-schleife-a'); await weg('test-schleife-b');

const doppel = await probe('test-doppel.js', `Huelle.plugin({
  kennung: "test-doppel", titel: "Zweiter Schreiber",
  abonniert: {
    "mitarbeiter/*.krankmeldung": function (m, h) { h.setze(m.objekt + "/abwesend", false); h.setze("auftraege/XC810-ENTL-01/mitarbeiter", "MA-20"); }
  }
});`, null);
const doppelLauf = await a.evaluate(async () => {
  const d = Huelle.drehbuecher.find(x => x.kennung === 'krankmeldung-ma-01');
  const r = await window.__spiele(d.kennung);
  return { r, abwesend: Huelle.zustand.lies('mitarbeiter/MA-01/abwesend'), meldungen: Huelle.vertrag.map(f => f.satz) };
});
pruefe('Doppel-Schreiber: Meldung „… will … ändern; das darf nur „Krankmeldung ab Zeitpunkt““',
  doppelLauf.meldungen.some(s => /„Zweiter Schreiber“ will „abwesend“ an mitarbeiter\/MA-01 ändern; das darf nur „Krankmeldung ab Zeitpunkt“/.test(s)), doppelLauf.meldungen);
pruefe('Doppel-Schreiber: kein stiller Gewinner, MA-01 bleibt krank gemeldet', doppelLauf.abwesend === true, doppelLauf.abwesend);
pruefe('Doppel-Schreiber: ändert keinen fremden Mitarbeiter eines Auftrags', doppelLauf.r.endstand === erste['krankmeldung-ma-01'].endstand);
await weg('test-doppel');

/* Ohne Anmeldung (ältere Fassung von vor dem Vertrag): Der erste, der einen freien Wert ändert, besitzt ihn */
const frei = await probe('test-frei.js', `Huelle.plugin({
  kennung: "test-frei-a", titel: "Alt A",
  abonniert: { "kennzahlen/frei.los": function (m, h) { h.setze("kennzahlen/frei/wert", 1); } }
});
Huelle.plugin({
  kennung: "test-frei-b", titel: "Alt B",
  abonniert: { "kennzahlen/frei.los": function (m, h) { h.setze("kennzahlen/frei/wert", 2); } }
});`, { objekt: 'kennzahlen/frei', aktion: 'los', parameter: {}, erzaehlung: 'Frei' });
const freiWert = await a.evaluate(() => Huelle.zustand.lies('kennzahlen/frei/wert'));
pruefe('ohne Anmeldung: das erste nach Pfad ändert den Wert, das zweite wird gemeldet',
  freiWert === 1 && frei.meldungen.some(s => /„Alt B“ will „wert“ an kennzahlen\/frei ändern; das darf nur „Alt A“/.test(s)), { freiWert, m: frei.meldungen });
await weg('test-frei-a'); await weg('test-frei-b');

const absturz = await probe('test-absturz.js', `Huelle.plugin({
  kennung: "test-absturz", titel: "Stürzt ab",
  abonniert: {
    "auftraege/*.loesen": function (m, h) { if (m.objekt === "auftraege/XC810-BELA-01") throw new Error("absichtlich"); }
  }
});`, null);
const absturzLauf = await a.evaluate(async () => {
  Huelle.neuerTag('09:00');
  const vorher = JSON.stringify(Huelle.zustand.wurzel);
  Huelle.bus.sendeNeu({ objekt: 'mitarbeiter/MA-01', aktion: 'krankmeldung', parameter: { ab: '09:00' }, erzaehlung: 'Krankmeldung MA-01 ab 09:00' }, 'drehbuecher/test');
  await Huelle.bus.abarbeiten({ vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} });
  return { gleich: JSON.stringify(Huelle.zustand.wurzel) === vorher, meldungen: Huelle.vertrag.map(f => f.satz), ketten: Huelle.kette.kurzformen() };
});
pruefe('Absturz: Meldung „… „Stürzt ab“ ist dabei ausgefallen … Der Stand davor gilt wieder.“',
  absturzLauf.meldungen.some(s => /Krankmeldung MA-01 ab 09:00.*„Stürzt ab“ ist dabei ausgefallen \(absichtlich\)\. Der Stand davor gilt wieder\./.test(s)), absturzLauf.meldungen);
pruefe('Absturz: alles oder nichts – auch die Krankmeldung selbst ist zurückgenommen', absturzLauf.gleich);
await weg('test-absturz');

const warten = await probe('test-warten.js', `Huelle.plugin({
  kennung: "test-warten", titel: "Wartet",
  abonniert: { "mitarbeiter/*.krankmeldung": async function (m, h) { await null; } }
});`, null);
pruefe('Warten: wird nicht eingehängt, Meldung „… wartet auf dem Bus …“', typeof warten.eingespielt === 'string' && /„Wartet“ wartet auf dem Bus; es ist nicht eingehängt/.test(warten.eingespielt), warten.eingespielt);
const uhr = await probe('test-uhr.js', `Huelle.plugin({
  kennung: "test-uhr", titel: "Eigene Uhr",
  abonniert: { "mitarbeiter/*.krankmeldung": function (m, h) { var t = Date.now(); var z = Math.random(); } }
});`, null);
pruefe('Eigene Uhr und Zufall: wird nicht eingehängt, Meldung nennt beides', typeof uhr.eingespielt === 'string' && /eigene Uhr/.test(uhr.eingespielt) && /eigenen Zufall/.test(uhr.eingespielt), uhr.eingespielt);

/* ---------- 5. Kette aufklappen ---------- */
await a.reload();
await a.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });
await a.evaluate(() => Huelle.player.spieleDrehbuch('krankmeldung-ma-01'));
await a.evaluate(() => document.querySelector('#tempo [data-wert="4"]').click());
await a.waitForFunction(() => Huelle.bus.protokoll.some(m => m.aktion === 'krankmeldung') && !Huelle.gesperrt(), null, { timeout: 120000 });
await a.click('#ketteKnopf');
const kette = await a.evaluate(() => {
  const k = [...document.querySelectorAll('#ketteListe details.kette')].find(d => /meldet sich ab 08:00 krank/.test(d.querySelector('summary').textContent));
  if (!k) return null;
  k.open = true;
  return { kurz: k.querySelector('summary').textContent, glieder: [...k.querySelectorAll('.kette-glied > .kette-satz')].map(x => x.textContent), wer: [...k.querySelectorAll('.kette-wer')].map(x => x.textContent) };
});
pruefe('Ketten: die Krankmeldung erscheint als eigene Kette', !!kette, kette);
/* Anweisung 16 des PO (08.11.): Ketten in Fachsprache, Namen statt Kennungen, ein Satz je Objekt */
pruefe('Kette in Kurzform: Krankmeldung → Aufträge in der Liste, Konflikte → Nicht zugewiesene Aufträge, Konflikte',
  !!kette && /^08:00R\. Aldinger meldet sich ab 08:00 krank → XC 810 Entladen liegt jetzt in der Liste „Nicht zugewiesene Aufträge“ statt bei R\. Aldinger · .*Konflikte steigen von 6 auf 7: Kapazitätslücke bei XC 810 Beladen ist neu → .*(Nicht zugewiesene Aufträge.*Konflikte|Konflikte.*Nicht zugewiesene Aufträge)/.test(kette.kurz), kette && kette.kurz);
pruefe('16: drei Änderungen am Mitarbeiter sind ein Satz', !!kette && kette.glieder.includes('R. Aldinger ist ab 08:00 krank gemeldet'), kette && kette.glieder);
pruefe('16: Konflikte als ein Satz mit dem, was neu ist', !!kette && kette.glieder.includes('Konflikte steigen von 6 auf 7: Kapazitätslücke bei XC 810 Beladen ist neu'), kette && kette.glieder);
const maschinenraum = t => /[a-z]+\/[A-Za-z]|MA-\d|XC\d{3}-|\btrue\b|\bfalse\b|veraendert|geaendert| · anzeigen|wert \d/.test(t);
pruefe('16: nichts aus dem Maschinenraum (Pfade, Feldnamen, Kennungen, true/false)', !!kette && !maschinenraum(kette.kurz) && !kette.glieder.some(maschinenraum), kette);
pruefe('16: weniger Glieder (vorher 10 Folgen, jetzt 4)', !!kette && /4 Folgen$/.test(kette.kurz), kette && kette.kurz);
pruefe('aufgeklappt: jedes Glied mit dem Plugin, das es getan hat', !!kette && kette.wer.some(w => /Einsatz ändern/.test(w)) && kette.wer.some(w => /Krankmeldung ab Zeitpunkt/.test(w)), kette && kette.wer);
const viaZeile = await a.evaluate(() => {
  document.getElementById('kettenZu').click();
  document.getElementById('zeile').click();
  return !document.getElementById('ketten').hidden && [...document.querySelectorAll('#ketteListe details.kette')].some(d => d.open);
});
pruefe('Klick auf die Erzählzeile klappt die Ketten auf', viaZeile);

/* 16 (b): Bedienungen ohne Folgen stehen als eine graue Zeile, aufklappbar. Szenario zu „Beteiligte aufleuchten lassen“:
   zwei Konflikte wählen und die Liste aufklappen tun nichts am Plan. */
await a.evaluate(() => Huelle.player.spieleDrehbuch('wunsch-012'));
await a.evaluate(() => document.querySelector('#tempo [data-wert="4"]').click());
await a.waitForFunction(() => Huelle.bus.protokoll.some(m => m.aktion === 'krankmeldung') && !Huelle.gesperrt(), null, { timeout: 120000 });
await a.evaluate(() => Huelle.kette.zeige());
const ohne = await a.evaluate(() => {
  const d = document.querySelector('#ketteListe details.kette-ohne');
  const einzeln = [...document.querySelectorAll('#ketteListe details.kette:not(.kette-ohne) summary')].map(s => s.textContent);
  return d ? { kopf: d.querySelector('summary').textContent, saetze: [...d.querySelectorAll('.kette-satz')].map(x => x.textContent), einzeln } : { einzeln };
});
pruefe('16: Bedienungen ohne Folgen als eine Zeile „3 Bedienungen ohne Folgen“', ohne.kopf === '3 Bedienungen ohne Folgen', ohne);
pruefe('16: aufgeklappt stehen sie einzeln darin', (ohne.saetze || []).some(t => t.startsWith('Disponent wählt Konflikt')), ohne);
pruefe('16: keine Kette mehr mit „0 Folgen“', !ohne.einzeln.some(t => /0 Folgen/.test(t)) && !ohne.einzeln.some(t => /Disponent wählt Konflikt/.test(t)), ohne.einzeln);

await browser.close();
console.log(fehler ? `${fehler} FEHL` : 'alles grün');
process.exit(fehler ? 1 : 0);
