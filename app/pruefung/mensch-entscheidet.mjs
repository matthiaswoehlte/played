/* Prüft Stufe 2 aus Auftrag 006 nach dem Grundsatz des PO „Der Mensch entscheidet, die Maschine meldet“
   (Docs/design-log/2026-11-07-grundsatz-mensch-entscheidet.md) und die geänderten Erwartungen:
   - Bricht ein Wunsch eine Regel: „Trotzdem einspielen“ (Entscheidung mit Datum, Verstoß bleibt als
     bewusst in Kauf genommen sichtbar) und „Regel ändern“ (neue Fassung, vorige in der Herkunft).
   - „Bewusst in Kauf nehmen“ am Verstoß: bleibt sichtbar, hält keinen Probelauf auf.
   - Eine bewusste Änderung ändert die Erwartungen mit, denen sie widerspricht; andere bleiben fest.
   KI als Attrappe mit festen Antworten. Läuft auf Kopien. Aufruf: node pruefung/mensch-entscheidet.mjs */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const antwort = felder => ({ rueckfrage: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], regel: null, erwartungen: [], ...felder });
/* Bricht nur die Mindestdauer: XB 933 Betanken wird bei der Krankmeldung MA-01 2 Minuten kurz.
   Keine Drehbuch-Erwartung hängt daran, so bleibt es ein reiner Regelbruch. */
const kurz = k => antwort({ art: "neu", kennung: k, name: "Betanken kürzen", kurz: "XB 933 Betanken wird bei Krankmeldung gekürzt.",
  plugin: `Huelle.plugin({ kennung: "${k}", titel: "Betanken kürzen", besitzt: ["auftraege/XB933-TANK-01/ende"], abonniert: {
    "mitarbeiter/MA-01.krankmeldung": function (m, h) { h.sende({ objekt: "auftraege/XB933-TANK-01", aktion: "kuerzen" }); },
    "auftraege/XB933-TANK-01.kuerzen": function (m, h) { h.setze(m.objekt + "/ende", h.zeit(h.minuten(h.lies(m.objekt + "/start")) + 2)); } } });` });
const MINDEST = "XB 933 Betanken dauert nur 2 Minuten – Ein Auftrag ist mindestens 5 Minuten lang.";
const bricht = k => antwort({ art: 'neu', kennung: k, name: 'Entladen an V. Engström', kurz: 'V. Engström übernimmt XC 810 Entladen.',
  plugin: `Huelle.plugin({ kennung: "${k}", titel: "Entladen an V. Engström", abonniert: {
    "auftraege/XC810-ENTL-01.loesen": function (m, h) { h.sende({ objekt: "auftraege/XC810-ENTL-01", aktion: "zuweisen", parameter: { mitarbeiter: "MA-05" } }); },
    "auftraege/XC810-ENTL-01.zuweisen": function (m, h) { h.sende({ objekt: m.objekt, aktion: "umplanen", parameter: { mitarbeiter: m.parameter.mitarbeiter } }); } } });` });

/* Die Änderung des PO an „Einsatz ändern“: ohne Qualifikation zuweisen, Konflikt statt Verbot (N-132) */
const EINSATZ = { alt: 'if (neu.qualifikationen.indexOf(a.arbeit) !== -1) return null;', neu: 'return null;   // N-132: zuweisen, der Konflikt zeigt es' };
const einsatz = erwartungen => antwort({ art: 'aendern', kennung: 'verhalten-einsatz', name: 'Einsatz ändern',
  kurz: 'Ohne Qualifikation wird jetzt zugewiesen; es entsteht der Konflikt „Qualifikation fehlt“.', aenderungen: [EINSATZ], erwartungen });
const E = (drehbuch, nr, neu, satz) => ({ drehbuch, nr, neu: JSON.stringify(neu), satz });
const RICHTIG = [
  E('wunsch-005', 2, { text: 'XC 810 Betanken liegt jetzt bei I. Reindl, mit Konflikt „Qualifikation fehlt“.', pruefe: [{ pfad: 'auftraege/XC810-TANK-01/mitarbeiter', gleich: 'MA-40' }] },
    'XC 810 Betanken auf I. Reindl ist jetzt ein Konflikt statt verweigert.'),
  E('wunsch-005', 3, { text: 'XC 810 Innenraum-Cleaning liegt jetzt bei D. Mahler, mit Konflikt „Qualifikation fehlt“.', pruefe: [{ pfad: 'auftraege/XC810-CLEAN-01/mitarbeiter', gleich: 'MA-20' }] },
    'XC 810 Innenraum-Cleaning auf D. Mahler ist jetzt ein Konflikt statt verweigert.'),
  E('wunsch-005', 6, { text: 'Der Konfliktzähler steht auf 7: zwei Konflikte „Qualifikation fehlt“ kommen dazu.', pruefe: [{ pfad: 'kennzahlen/konflikte/wert', gleich: 7 }] },
    'Der Konfliktzähler steht danach auf 7 statt 5.'),
  E('wunsch-009', 4, { text: 'D. Mahler bekommt XC 810 Beladen erst als Konflikt, dann geht es an W. Fiedler.', pruefe: [{ nachricht: 'auftraege/XC810-BELA-01.umplanen' }] },
    'XC 810 Beladen auf D. Mahler ist jetzt ein Konflikt statt verweigert.'),
];
/* Ändert zusätzlich eine Erwartung, der die Änderung gar nicht widerspricht */
const ZU_VIEL = RICHTIG.concat(E('wunsch-005', 0, { text: 'XA 745 Betanken liegt bei E. Novak.', pruefe: [{ pfad: 'auftraege/XA745-TANK-01/mitarbeiter', gleich: 'MA-21' }] }, 'Nur anders gesagt.'));

const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json');
writeFileSync(ATTRAPPE, JSON.stringify([
  /* A Trotzdem einspielen */
  kurz('betanken-trotzdem'), kurz('betanken-trotzdem'),
  /* B Regel ändern: erst der Wunsch, dann die neue Fassung der Regel */
  kurz('betanken-regel'), kurz('betanken-regel'),
  antwort({ art: 'nur-regel', kennung: 'mindestdauer', name: 'Mindestdauer', kurz: 'Regel geändert.',
    regel: { kennung: 'mindestdauer', satz: 'Ein Auftrag ist mindestens 5 Minuten lang, außer nach einer Krankmeldung.', art: 'bedingung',
      pruefe: 'function (h) { return []; }' } }),
  /* C Erwartungen: ohne, dann zu viele (scheitert); danach richtig */
  einsatz([]), einsatz(ZU_VIEL), einsatz(ZU_VIEL),   // Anweisung 58 (c): bei einem Ausfall zwei Nachbesserungen
  einsatz(RICHTIG),
]));

const { adresse, plugindaten, regeln: REGELN, inKauf: IN_KAUF } = await eigeneBruecke(4334, { mitKopie: true, attrappe: ATTRAPPE });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const LADEGRUPPE = 'XC 810: Entladen machen Ladegruppe 1 und Ladegruppe 2 (V. Engström) – Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.';
const ONBLOCK = 'XA 745 Fäkalien entleeren beginnt um 08:05, On-Block ist erst um 08:15 – Eine Arbeit an einem Flug beginnt frühestens bei On-Block.';
const json = f => JSON.parse(readFileSync(f, 'utf8'));
const herkunft = k => json(path.join(BAUSTEINE, k, 'herkunft.json'));

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 700) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const meldung = async text => (await p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 90000 })).textContent();
const knopf = (text, k) => p.click(`#meldungen .meldung:has-text("${text}") button:text("${k}")`);
const eintraege = () => p.evaluate(() => Huelle.waechter.eintraege());
async function wunsch(text) {
  await p.fill('#wunschFeld', text);
  await p.click('#wunsch button');
}

try {
  await p.goto(adresse);
  await bereit();

  /* ---------- 1 Bewusst in Kauf nehmen am Verstoß ---------- */
  const befund = (await eintraege()).find(e => e.satz === ONBLOCK);
  pruefe('Befund im Bestand steht da, noch nicht in Kauf genommen', befund && !befund.inKauf, await eintraege());
  if (!(await p.isVisible('#verstoesse'))) await p.click('#verstossKnopf');
  const kasten = p.locator('#verstossListe .verstoss', { has: p.locator('.verstoss-satz', { hasText: ONBLOCK }) });
  await kasten.locator('button.in-kauf-nehmen').click();
  await p.waitForSelector('#verstossListe .verstoss.in-kauf');
  const kauf = json(IN_KAUF);
  pruefe('In Kauf genommen: Entscheidung als Datei mit Datum und wie', kauf.length === 1 && kauf[0].schluessel === befund.schluessel &&
    /^\d{4}-\d\d-\d\dT/.test(kauf[0].datum) && kauf[0].wie.includes('Bewusst in Kauf nehmen'), kauf);
  pruefe('Bleibt sichtbar, so gekennzeichnet', (await kasten.count()) === 1 && (await kasten.locator('.verstoss-in-kauf').textContent()).startsWith('Bewusst in Kauf genommen am '));
  await p.reload();
  await bereit();
  pruefe('Nach dem Neuladen weiter in Kauf genommen', (await eintraege()).find(e => e.satz === ONBLOCK)?.inKauf === true);

  /* Hält keinen Probelauf auf: Ein Kandidat, der genau diesen Verstoß neu erzeugt, … */
  const kandidat = [{ name: 'probe-frueh.js', quelle: `Huelle.plugin({ kennung: "probe-frueh", titel: "Probe", abonniert: {
    "uhr/tag.tick": function (m, h) { var s = h.lies("auftraege/XA745-FAEK-01/start"); if (s !== "08:05") h.sende({ objekt: "auftraege/XA745-FAEK-01", aktion: "zeitaendern", parameter: { kante: "start", zeit: "08:05" } }); } } });` }];
  const probe = () => p.evaluate(k => new Promise(f => Huelle.nachspiel.probe(k, [], r => f(r.verstoesse.map(v => v.satz)))), kandidat);
  const mit = await probe();
  pruefe('In Kauf genommener Verstoß hält den Probelauf nicht auf', !mit.includes(ONBLOCK), mit);
  await p.evaluate(s => fetch('/in-kauf/zurueck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schluessel: s }) }), befund.schluessel);
  await p.evaluate(() => Huelle.waechter.ladeInKauf());
  const ohne = await probe();
  pruefe('Nicht mehr in Kauf genommen: derselbe Verstoß hält ihn wieder auf', ohne.includes(ONBLOCK), ohne);

  /* ---------- 2 Trotzdem einspielen ---------- */
  await wunsch('Bei Krankmeldung von MA-01 soll XB 933 Betanken auf 2 Minuten gekürzt werden.');
  const m2 = await meldung('Das bräche eine Regel');
  pruefe('Der PO liest die Regel im Weg und entscheidet', m2.includes(MINDEST) && m2.includes('Trotzdem einspielen'), m2);
  await knopf('Das bräche eine Regel', 'Trotzdem einspielen');
  const m2b = await meldung('Trotz Regel eingespielt');
  pruefe('Eingespielt mit Hinweis, dass der Verstoß sichtbar bleibt', m2b.includes('XB 933 Betanken wird bei Krankmeldung gekürzt.') && m2b.includes('bewusst in Kauf genommen'), m2b);
  const f = herkunft('betanken-trotzdem').fassungen.at(-1);
  pruefe('Überstimmen nie still: Entscheidung mit Datum an der Fassung', f.ueberstimmt && f.ueberstimmt.wie.includes('Trotzdem einspielen') &&
    /^\d{4}-/.test(f.ueberstimmt.datum) && f.ueberstimmt.verstoesse[0].satz === MINDEST, f);
  const k2 = json(IN_KAUF).find(e => e.satz === MINDEST);
  pruefe('Der Verstoß gilt als bewusst in Kauf genommen, mit dem Wunsch', k2 && k2.wunsch && k2.wie.includes('Trotzdem einspielen'), json(IN_KAUF));
  await p.waitForFunction(m => Huelle.waechter.eintraege().some(e => e.satz === m && e.drehbuecher.length), MINDEST, { timeout: 90000 }).catch(() => {});
  const lg = (await eintraege()).find(e => e.satz === MINDEST);
  pruefe('Er bleibt sichtbar, gekennzeichnet', lg && lg.inKauf && lg.drehbuecher.includes('krankmeldung-ma-01'), await eintraege());
  await Promise.all([p.waitForEvent('load'), knopf('Trotz Regel eingespielt', 'Zurücknehmen')]);
  await bereit();
  pruefe('Zurücknehmen nimmt auch das In-Kauf-Nehmen zurück', !existsSync(path.join(BAUSTEINE, 'betanken-trotzdem')) && !json(IN_KAUF).some(e => e.satz === MINDEST), json(IN_KAUF));

  /* ---------- 3 Regel ändern ---------- */
  await wunsch('Bei Krankmeldung soll XB 933 Betanken kurz werden.');
  await meldung('Das bräche eine Regel');
  await knopf('Das bräche eine Regel', 'Regel ändern');
  const feld = await p.inputValue('#wunschFeld');
  pruefe('Regel ändern: Anfang steht im Wunschfeld', feld === 'Die Regel „Ein Auftrag ist mindestens 5 Minuten lang.“ soll so lauten: ', feld);
  pruefe('Regel ändern: der Wunsch ist nicht eingespielt', !existsSync(path.join(BAUSTEINE, 'betanken-regel')));
  await p.fill('#wunschFeld', feld + 'außer nach einer Krankmeldung.');
  await p.click('#wunsch button');
  const m3 = await meldung('Gilt ab jetzt als Regel');
  pruefe('Neue Fassung der Regel gilt', m3.includes('außer nach einer Krankmeldung.'), m3);
  const neu = readFileSync(path.join(REGELN, 'mindestdauer.js'), 'utf8');
  pruefe('Gleiche Kennung und Datei, Pfad wie bisher, vorige Fassung in der Herkunft', neu.includes('kennung: "mindestdauer"') &&
    neu.includes('pfad: "bodenabfertigung/tagesdisposition"') && neu.includes('"vorige":{"satz":"Ein Auftrag ist mindestens 5 Minuten lang."') &&
    neu.includes('"netz":"N-125"'), neu.slice(0, 900));
  pruefe('Vorige Fassung liegt unter regeln/alt/', readdirSync(path.join(REGELN, 'alt')).some(n => n.startsWith('mindestdauer.vor-')));
  pruefe('In der Seite gilt die neue Fassung', (await p.evaluate(() => Huelle.regeln['mindestdauer'].satz)).endsWith('außer nach einer Krankmeldung.'));
  await Promise.all([p.waitForEvent('load'), knopf('Gilt ab jetzt als Regel', 'Zurücknehmen')]);
  await bereit();
  pruefe('Zurücknehmen: vorige Fassung der Regel gilt wieder', (await p.evaluate(() => Huelle.regeln['mindestdauer'].satz)) === 'Ein Auftrag ist mindestens 5 Minuten lang.');

  /* ---------- 4 Erwartungen mitändern ---------- */
  /* Der PO hat genau diese Änderung am 07.11. mit Wunsch 014 wirklich gemacht (N-132). Damit der Weg
     weiter geprüft wird, beginnt die Kopie hier beim Stand davor: „Einsatz ändern“ als Grundausstattung. */
  rmSync(path.join(BAUSTEINE, 'verhalten-einsatz'), { recursive: true, force: true });
  await p.reload();
  await bereit();
  await p.evaluate(() => Huelle.wunsch.aendere('verhalten-einsatz', 'Ohne Qualifikation soll trotzdem zugewiesen werden; es entsteht ein Konflikt statt einer Verweigerung.'));
  const m4 = await meldung('Das ließ sich nicht umsetzen');
  pruefe('Ändert sie eine Erwartung, die sie nicht berührt: nicht angenommen, mit Grund (Anweisung 58 b)', m4.includes('obwohl er ihr nicht widerspricht'), m4);
  pruefe('Nichts eingespielt', !existsSync(path.join(BAUSTEINE, 'verhalten-einsatz')));

  await p.evaluate(() => Huelle.wunsch.aendere('verhalten-einsatz', 'Ohne Qualifikation soll trotzdem zugewiesen werden; es entsteht ein Konflikt statt einer Verweigerung.'));
  const m5 = await meldung('Geändert:');
  pruefe('Mit den widersprochenen Erwartungen eingespielt, je Szenario ein Satz',
    m5.includes('Szenario „Einsatzbalken auf andere Mitarbeiter ziehen“: XC 810 Betanken auf I. Reindl ist jetzt ein Konflikt statt verweigert.') &&
    m5.includes('XC 810 Beladen auf D. Mahler ist jetzt ein Konflikt statt verweigert.'), m5);
  const f5 = herkunft('verhalten-einsatz').fassungen.at(-1);
  pruefe('Die alte Erwartung bleibt in der Herkunft', f5.erwartungen?.length === 4 &&
    f5.erwartungen[0].alt.text === 'XC 810 Betanken bleibt bei D. Mahler, weil I. Reindl nicht betanken darf.', f5.erwartungen);
  pruefe('Das Szenario selbst ist unverändert', readFileSync(path.join(BAUSTEINE, 'balken-zuweisen', 'wunsch-005.drehbuch.js'), 'utf8').includes('XC 810 Betanken bleibt bei D. Mahler'));
  await bereit();
  const offen = await p.evaluate(() => Huelle.verwaltung.gruppen().flatMap(g => g.drehbuecher).filter(d => d.erwartung).map(d => d.kennung));
  pruefe('Nach der Änderung erfüllen wunsch-005 und wunsch-009 ihre Erwartungen', !offen.includes('wunsch-005') && !offen.includes('wunsch-009'), offen);
  pruefe('Ohne Qualifikation zugewiesen: kein Regelverstoß (Konflikt steht in der Liste)',
    !(await eintraege()).some(e => e.regel === 'qualifikation-passt'), await eintraege());
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
