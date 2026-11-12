/* Prüft „Vorspielen“ an einem Verstoß (PO, 07.11.2026):
   - Das Drehbuch läuft bis zu dem Ereignis, bei dem der Verstoß entsteht, und hält dort an;
     die beteiligten Balken leuchten, die Erzählzeile sagt in einem Satz, welche Nachricht ihn auslöste.
   - Der Knopf bleibt stehen, solange der Verstoß besteht, auch nachdem er vorgespielt wurde.
   - Entsteht der Verstoß nicht im Drehbuch (von Hand), steht ein Satz statt des Knopfs.
   - Prüfpunkt des PO: Hat D. Mahler (Tankdienst) bei XC 810 Beladen, steht „Qualifikation fehlt“
     in der Konfliktliste, und Regel 3 meldet nichts.
   Läuft auf Kopien. Aufruf: node pruefung/vorspielen-am-verstoss.mjs [bilderordner] */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const BILDER = process.argv[2] || null;

const { adresse } = await eigeneBruecke(4353, { mitKopie: true });
let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 700) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const ruhe = () => p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
const liste = () => p.evaluate(() => Huelle.waechter.eintraege());
const bild = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png') }); };
const leuchtet = () => p.evaluate(() => document.getAnimations()
  .filter(a => a.id === 'verstoss' && a.playState === 'running').map(a => a.effect.target.dataset.pfad));
const LG = e => e.regel === 'ladegruppe-je-flug';
const lgKnopf = () => p.locator('#verstossListe .verstoss[data-regel="ladegruppe-je-flug"] button.vorspielen');

try {
  await p.goto(adresse);
  await bereit();
  await p.evaluate(() => Huelle.player.melde && document.querySelectorAll('#meldungen .meldung').forEach(m => m.remove()));

  /* ---------- 1 Prüfpunkt D. Mahler / Regel 3 ---------- */
  const mahler = await p.evaluate(async () => {
    const H = Huelle, d = H.drehbuecher.find(x => x.kennung === 'wunsch-009');
    const still = { vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} };
    H.neuerTag(d.von);
    for (const e of d.ereignisse) {
      H.uhr.stelle(e.zeit);
      H.bus.sende(e, 'drehbuecher/wunsch-009');
      await H.bus.abarbeiten(still);
      if (e.zeit === '08:08') return {
        bei: H.zustand.lies('auftraege/XC810-BELA-01/mitarbeiter'),
        konflikt: H.zustand.lies('kennzahlen/konflikte/liste').some(k => k.art === 'Qualifikation fehlt' && k.auftrag === 'XC810-BELA-01'),
        regel3: H.waechter.jetzt().filter(v => v.regel === 'qualifikation-passt').length,
        regel3IstPruefbar: H.waechter.gilt(H.regeln['qualifikation-passt'], H.tag.pfad)
      };
    }
  });
  pruefe('08:08 in wunsch-009: D. Mahler hat XC 810 Beladen', mahler.bei === 'MA-20', mahler);
  pruefe('… und „Qualifikation fehlt“ steht in der Konfliktliste', mahler.konflikt, mahler);
  pruefe('… also meldet Regel 3 nichts (sie wird geprüft, verpasst nichts)', mahler.regel3 === 0 && mahler.regel3IstPruefbar, mahler);
  /* Gegenprobe: Fehlt der Konflikt (Konfliktzähler aus), meldet Regel 3 ihn genau dann */
  const gegen = await p.evaluate(async () => {
    const H = Huelle;
    H.schalteAus(['konfliktzaehler']);
    const d = H.drehbuecher.find(x => x.kennung === 'wunsch-009');
    const still = { vorher: async () => {}, schnappschuss: () => null, nachher: async () => {} };
    H.neuerTag(d.von);
    let n = -1;
    for (const e of d.ereignisse.slice(0, 3)) {
      H.uhr.stelle(e.zeit);
      H.bus.sende(e, 'drehbuecher/wunsch-009');
      await H.bus.abarbeiten(still);
    }
    n = H.waechter.jetzt().filter(v => v.regel === 'qualifikation-passt').map(v => v.satz);
    return n;
  });
  pruefe('Gegenprobe: ohne Konflikt in der Liste meldet Regel 3 D. Mahler', gegen.length === 1 && gegen[0].includes('D. Mahler'), gegen);
  await p.reload();
  await bereit();

  /* ---------- 2 Am Verstoß aus Drehbüchern steht „Vorspielen“ ---------- */
  await p.click('#verstossKnopf');
  let lg = (await liste()).find(LG);
  pruefe('Ladegruppen-Verstoß aus wunsch-009 und gespielt-001 ist da', !!lg && lg.drehbuecher.includes('wunsch-009'), await liste());
  pruefe('… mit „Vorspielen“, Halt bei Ereignis 2 (08:04)', lg?.vorspielen?.entsteht?.schritt === 2 && lg.vorspielen.entsteht.zeit === '08:04', lg?.vorspielen);
  const onblock = (await liste()).find(e => e.regel === 'beginn-ab-on-block');
  pruefe('On-Block-Verstoß hat ebenfalls „Vorspielen“', !!onblock?.vorspielen?.entsteht?.schritt, onblock);
  pruefe('Knopf steht in der Liste', await lgKnopf().count() === 1);

  /* ---------- 3 Vorspielen hält, wo der Verstoß entsteht ---------- */
  await p.click('#tempo button[data-wert="4"]');
  await lgKnopf().click();
  await p.waitForFunction(() => Huelle.player.amVerstoss(), null, { timeout: 60000 });
  await ruhe();
  const zeile = await p.textContent('#zeile');
  pruefe('Hält an: Vorspielen ist zu Ende, Player steht auf „Nochmal“', (await p.textContent('#play')) === 'Nochmal');
  pruefe('Uhr steht auf 08:04', (await p.textContent('#uhr')) === '08:04', await p.textContent('#uhr'));
  pruefe('Erzählzeile nennt die auslösende Nachricht', zeile.includes('Hier entsteht der Verstoß: Disponent zieht XC 810 Entladen auf V. Engström') &&
    zeile.includes('ab jetzt macht eine zweite Gruppe mit: Ladegruppe 2 (V. Engström)'), zeile);
  pruefe('Ein Satz sagt, dass hier angehalten wurde', (await p.textContent('#ergebnisText')).startsWith('Angehalten um 08:04, wo der Verstoß entsteht'), await p.textContent('#ergebnisText'));
  const an = await leuchtet();
  pruefe('Die vier Entladen-Balken von XC 810 leuchten, sonst keiner',
    ['XC810-ENTL-01', 'XC810-ENTL-02', 'XC810-ENTL-03', 'XC810-ENTL-04'].every(k => an.includes('auftraege/' + k)) &&
    an.every(x => /XC810-ENTL/.test(x)), an);
  const farbe = await p.evaluate(() => document.getAnimations().find(a => a.id === 'verstoss').effect.getKeyframes().map(k => k.boxShadow).join(' '));
  pruefe('Leuchten ist nicht in der Konfliktfarbe', !/koralle|255, ?111, ?97|ff6f61/i.test(farbe), farbe);
  pruefe('Beladen ist bis hier noch nicht umgeplant', (await p.evaluate(() => Huelle.zustand.lies('auftraege/XC810-BELA-01/mitarbeiter'))) === null);
  await bild('1-angehalten');
  const halt = (await liste()).filter(LG);
  pruefe('Knopf steht auch beim Anhalten', halt.some(e => e.drehbuecher.includes('wunsch-009') && e.vorspielen) && await lgKnopf().count() >= 1, halt);

  /* ---------- 4 Danach ist der Plan frei: Konfliktliste öffnen, Leuchten hört auf ---------- */
  pruefe('Nichts mehr gesperrt', !(await p.evaluate(() => Huelle.gesperrt())));
  await p.click('[data-sicht="konfliktzaehler"] .pl-zaehler');
  await ruhe();
  pruefe('Konfliktliste lässt sich aufklappen', (await p.evaluate(() => Huelle.zustand.lies('kennzahlen/konflikte/offen'))) === true &&
    await p.locator('.pl-konfliktliste').count() === 1);
  pruefe('Kein Hinweis „gesperrt“', !(await p.textContent('#meldungen')).includes('Während des Vorspielens'));
  await bild('2-liste-offen');
  await p.waitForTimeout(6500);
  pruefe('Leuchten hört nach einigen Sekunden auf', (await leuchtet()).length === 0, await leuchtet());
  lg = (await liste()).find(e => LG(e) && e.drehbuecher.includes('wunsch-009'));
  pruefe('„Vorspielen“ steht weiter da', !!lg?.vorspielen && await lgKnopf().count() >= 1, lg);
  /* „Nochmal“ spielt das Drehbuch ganz */
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal' && !Huelle.player.laeuftGerade(), null, { timeout: 90000 });
  pruefe('„Nochmal“ spielt bis zum Ende, ohne anzuhalten', (await p.textContent('#uhr')) === '08:15' && !(await p.evaluate(() => Huelle.player.amVerstoss())), await p.textContent('#uhr'));
  lg = (await liste()).find(e => LG(e) && e.jetzt);
  pruefe('Danach besteht der Verstoß im Tagesplan, Knopf steht', !!lg?.vorspielen && await lgKnopf().count() === 1, lg);

  /* ---------- 5 Von Hand entstanden: Satz statt Knopf ---------- */
  await p.selectOption('#wahl', 'krankmeldung-ma-20');
  await ruhe();
  await p.evaluate(() => Huelle.handeln({ objekt: 'auftraege/XC810-BELA-02', aktion: 'umplanen', parameter: { mitarbeiter: 'MA-05' },
    erzaehlung: 'Disponent zieht XC 810 Beladen auf V. Engström' }, 'hand/probe/umplanen'));
  await ruhe();
  const hand = (await liste()).find(e => LG(e) && e.jetzt && !e.drehbuecher.length);
  pruefe('Von Hand: Verstoß ohne Szenario, kein „Vorspielen“', !!hand && !hand.vorspielen, await liste());
  pruefe('… stattdessen ein Satz, dass er von Hand entstand', hand?.herkunft?.startsWith('Nichts vorzuspielen: Der Verstoß entstand von Hand um') &&
    hand.herkunft.includes('Disponent zieht XC 810 Beladen auf V. Engström'), hand?.herkunft);
  pruefe('… und der Satz steht in der Seite', (await p.textContent('#verstossListe')).includes('Der Verstoß entstand von Hand'));
  await bild('3-von-hand');

  /* ---------- 6 Schon im gemockten Tag: Satz statt Knopf ---------- */
  const amTag = await p.evaluate(() => {
    Huelle.regel({ kennung: 'probe-am-tag', pfad: 'bodenabfertigung', satz: 'Probe.', art: 'bedingung',
      pruefe: h => [{ pfade: ['auftraege/XA101-ENTL-01'], satz: 'Probe am Tagesbeginn' }] });
    Huelle.neuerTag(Huelle.startzeit);
    const v = Huelle.waechter.eintraege().find(e => e.regel === 'probe-am-tag');
    delete Huelle.regeln['probe-am-tag'];
    Huelle.neuerTag(Huelle.startzeit);
    return v;
  });
  pruefe('Schon am Tagesbeginn: Satz statt Knopf', !amTag?.vorspielen && amTag?.herkunft?.includes('steht schon im gemockten Tag'), amTag);

  /* ---------- 7 Der Wächter ändert keinen Wert ---------- */
  pruefe('Keine Regel ist beim Prüfen ausgefallen', (await p.evaluate(() => Huelle.waechter.fehler())).length === 0);
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
}
await browser.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
