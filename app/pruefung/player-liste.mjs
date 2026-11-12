/* Prüft die Anweisungen des PO vom 07.11.2026 (15:35) vor Stufe 3 von 006:
   6 Vorspielen nur für ein Plugin: nur die Drehbücher, in denen es etwas tut.
   7 Player-Liste: je Plugin „Vorspielen“, „Alle Szenen“, „Beenden“, „Aufnehmen“.
   8 Abweichungssätze sagen, was der Disponent sieht, nicht wie es gebaut ist.
   9 Ein Drehbuch, das zu einem Wunsch gespielt wurde, gehört zu dessen Plugin.
   Läuft auf einer Kopie der echten Wünsche und Sollergebnisse; zwei Sollergebnisse werden in der
   Kopie absichtlich verändert, damit es etwas abzuweichen gibt.
   Aufruf: node pruefung/player-liste.mjs */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, ordner: SOLL } = await eigeneBruecke(4329, { mitKopie: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

/* In der Kopie: Sollergebnis eines Drehbuchs ändern (alle Stände) */
function aendereSoll(kennung, tue) {
  const datei = path.join(SOLL, kennung + '.json');
  const s = JSON.parse(readFileSync(datei, 'utf8'));
  Object.values(s.je).forEach(tue);
  writeFileSync(datei, JSON.stringify(s, null, 2));
}
/* 9: Im Sollergebnis zum Wunsch „Balken zurück in die Liste“ lag XC 810 Reinigen bei jemand anderem. */
aendereSoll('wunsch-017', e => { e.zustand.auftraege['XC810-CLEAN-01'].mitarbeiter = 'MA-21'; });
/* 8: Im Sollergebnis von „Krankmeldung MA-20“ gab es noch keine Ablagefläche, in „Krankmeldung MA-01“ kein Suchfeld. */
aendereSoll('krankmeldung-ma-20', e => {
  e.sichten['nicht-zugewiesen'] = e.sichten['nicht-zugewiesen'].filter(p => p !== 'listen/nicht-zugewiesen');
});
aendereSoll('krankmeldung-ma-01', e => {
  e.sichten.gantt = e.sichten.gantt.filter(p => p !== 'kennzahlen/suche');
});

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const gruppen = () => p.evaluate(() => Huelle.verwaltung.gruppen().map(g => ({
  ebene: g.ebene, art: g.ursache.art, kennung: g.ursache.kennung,
  drehbuecher: g.drehbuecher.map(d => ({ kennung: d.kennung, saetze: d.saetze })),
})));
const folge = () => p.evaluate(() => { const f = document.querySelector('#folge'); return f.hidden ? null : f.textContent; });
const knopf = () => p.textContent('#play');

try {
  await p.goto(ADRESSE);
  /* Fortschritt ist immer sichtbar (AGENTS.md, 07.11.): während der Messung steht, wie weit sie ist */
  const satz = await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fortschrittSatz(), null, { timeout: 90000 }).then(h => h.jsonValue());
  pruefe('Messung zeigt ihren Fortschritt', /^Ursachen werden ermittelt: \d+ von \d+ Läufen/.test(satz), satz);
  await p.click('#pluginKnopf');
  const zeile = await p.waitForFunction(() => document.querySelector('.plugin-dreh')?.textContent.startsWith('Ursachen werden ermittelt') && document.querySelector('.plugin-dreh').textContent, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null);
  pruefe('… auch in der Leiste am Plugin', !!zeile, zeile);
  await p.click('#leisteZu');
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
  pruefe('Nach der Messung kein Fortschrittssatz mehr', await p.evaluate(() => Huelle.verwaltung.fortschrittSatz() === null));

  /* ---------- 9 Drehbuch gehört zum Plugin seines Wunsches ---------- */
  const g = await gruppen();
  const g17 = g.find(x => x.drehbuecher.some(d => d.kennung === 'wunsch-017'));
  pruefe('9: „Balken zurück in die Liste“ (Szenario) hat sein Plugin als Ursache', g17 && g17.ebene === 'plan' && g17.art === 'wunsch' && g17.kennung === 'balken-zuruecklegen', g);
  await p.click('#abweichKnopf');
  const text = await p.textContent('#abweichungen');
  pruefe('9: Kein „ohne dass ein Plugin das erklärt“', !text.includes('ohne dass ein Plugin'), text);
  pruefe('9: Satz nennt den Wunsch', text.includes('Seit deinem Wunsch „IOch will einen Balken'), text);

  /* ---------- 8 Sätze sagen, was der Disponent sieht ---------- */
  const g20 = g.find(x => x.ebene === 'anzeige' && x.drehbuecher.some(d => d.kennung === 'krankmeldung-ma-20'));
  const saetze = g.filter(x => x.ebene === 'anzeige').flatMap(x => x.drehbuecher.filter(d => d.kennung.startsWith('krankmeldung-ma-')).flatMap(d => d.saetze));
  pruefe('8: Ablagefläche in Worten des Bildschirms', saetze.includes('Unter „Nicht zugewiesene Aufträge“ ist jetzt die Ablagefläche für „Balken in ‚Nicht zugewiesene Aufträge‘ ziehen“'), saetze);
  pruefe('8: Suchfeld in Worten des Bildschirms', saetze.includes('Im Tagesplan ist jetzt das Suchfeld „Mitarbeiter oder Flug suchen“'), saetze);
  pruefe('8: Kein „Bedienelement ohne fachliche Bedeutung“', !text.includes('Bedienelement') && !saetze.some(s => s.includes('ohne Beschriftung')), saetze);
  pruefe('8: Nur Anzeige, Ursache ist das Plugin, das die Fläche zeichnet', g20 && g20.art === 'wunsch' && g20.kennung === 'balken-zuruecklegen', g20);

  /* ---------- 7 Player-Liste ---------- */
  const liste = await p.evaluate(() => [...document.querySelectorAll('#wahl optgroup')].map(o => ({
    label: o.label, eintraege: [...o.children].map(x => ({ wert: x.value, text: x.textContent })),
  })));
  const je = liste.find(x => x.label === 'Vorspielen je Plugin');
  const befehle = liste.find(x => x.label === 'Player');
  pruefe('7: Szenarien stehen zuerst', liste[0]?.label === 'Szenarien' && liste[0].eintraege.length === await p.evaluate(() => Huelle.drehbuecher.length), liste[0]);
  pruefe('7: Je Plugin ein Eintrag „Vorspielen“', je && je.eintraege.every(x => x.text.startsWith('Vorspielen: ')) && je.eintraege.some(x => x.wert === '@plugin:verhalten-krankmeldung'), je);
  pruefe('7: Was nur anzeigt, hat keinen Eintrag', je && !je.eintraege.some(x => ['@plugin:gantt', '@plugin:konflikt-rand', '@plugin:vergangenheit-grau'].includes(x.wert)), je);
  /* Seit 005, Stufe 2 (der PO lässt die Uhr laufen) steht dort auch „Uhr laufen lassen“. */
  pruefe('7: Alle Szenen, Beenden, Uhr laufen lassen, Aufnehmen', JSON.stringify(befehle?.eintraege.map(x => x.wert)) === '["@alle","@beenden","@uhr","@aufnehmen"]', befehle);

  /* ---------- 6 Vorspielen nur für ein Plugin ---------- */
  const krank = await p.evaluate(() => Huelle.verwaltung.drehbuecherVon('verhalten-krankmeldung').map(d => d.kennung));
  pruefe('6: Krankmeldung tut etwas in den Krankmeldungs-Szenarien', ['krankmeldung-ma-01', 'krankmeldung-ma-20', 'wunsch-009'].every(k => krank.includes(k)), krank);
  pruefe('6: Krankmeldung tut nichts beim Suchen, Verschieben, Status', !['wunsch-023', 'wunsch-008', 'wunsch-022', 'wunsch-004'].some(k => krank.includes(k)), krank);
  const suche = await p.evaluate(() => Huelle.verwaltung.drehbuecherVon('plan-suche').map(d => d.kennung));
  pruefe('6: Suche: nur ihr eigenes Szenario', JSON.stringify(suche) === '["wunsch-023"]', suche);
  const einsatz = await p.evaluate(() => Huelle.verwaltung.drehbuecherVon('verhalten-einsatz').map(d => d.kennung));
  pruefe('6: Einsatz ändern: wo umgeplant wird, nicht beim Suchen', einsatz.includes('wunsch-005') && !einsatz.includes('wunsch-023'), einsatz);

  await p.click('#tempo button[data-wert="4"]');
  await p.selectOption('#wahl', '@plugin:verhalten-krankmeldung');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Pause');
  pruefe('6: Aus der Liste: es läuft das erste Szenario der Krankmeldung', await p.inputValue('#wahl') === krank[0], await p.inputValue('#wahl'));
  pruefe('6: Folge sagt, wofür sie läuft', await folge() === `Krankmeldung ab Zeitpunkt: Szenario 1 von ${krank.length}`, await folge());

  /* Beenden mitten im Abspielen */
  await p.waitForFunction(() => Huelle.bus.protokoll.some(m => m.aktion === 'krankmeldung'), null, { timeout: 30000 });
  await p.selectOption('#wahl', '@beenden');
  await p.waitForFunction(() => !document.querySelector('#ergebnis').hidden);
  const uhr = await p.textContent('#uhr');
  pruefe('7: Beenden: Player steht', await knopf() === 'Nochmal' && await folge() === null, await knopf());
  pruefe('7: Beenden: Satz mit Uhrzeit', (await p.textContent('#ergebnisText')).startsWith('Beendet um ' + uhr), await p.textContent('#ergebnisText'));
  pruefe('7: Beenden: Auswahl zeigt wieder das Szenario', await p.inputValue('#wahl') === krank[0]);
  pruefe('7: Beenden: Plan nicht zurückgesetzt, Krankmeldung bleibt', await p.evaluate(() => Huelle.bus.protokoll.some(m => m.aktion === 'krankmeldung')));
  await p.waitForTimeout(2500);
  pruefe('7: Beenden: es geht nicht weiter', await p.textContent('#uhr') === uhr && await knopf() === 'Nochmal');
  pruefe('7: Beenden: Dispo lässt sich bedienen', await p.evaluate(() => !Huelle.gesperrt() && !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length));
  const vorher = await p.evaluate(() => Huelle.zustand.lies('auftraege/XA745-TANK-01/mitarbeiter'));
  await p.evaluate(() => Huelle.handeln({ objekt: 'auftraege/XA745-TANK-01', aktion: 'umplanen', parameter: { mitarbeiter: 'MA-21' }, erzaehlung: 'Disponent zieht XA 745 Betanken auf E. Novak' }, 'hand/pruefung'));
  await p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
  pruefe('7: Beenden: von Hand umgeplant', vorher !== 'MA-21' && await p.evaluate(() => Huelle.zustand.lies('auftraege/XA745-TANK-01/mitarbeiter')) === 'MA-21');

  /* Alle Szenen */
  await p.selectOption('#wahl', '@alle');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Pause');
  const n = await p.evaluate(() => Huelle.drehbuecher.length);
  pruefe('7: Alle Szenen: vom ersten Szenario an', await folge() === `Alle Szenen: Szenario 1 von ${n}` && await p.inputValue('#wahl') === await p.evaluate(() => Huelle.drehbuecher[0].kennung), await folge());
  await p.selectOption('#wahl', '@beenden');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal');
  pruefe('7: Alle Szenen lässt sich beenden', await folge() === null);

  /* Aufnehmen */
  await p.selectOption('#wahl', 'wunsch-005');
  await p.selectOption('#wahl', '@aufnehmen');
  await p.waitForFunction(() => document.querySelector('#ergebnisText').textContent.startsWith('Aufnahme'));
  pruefe('7: Aufnehmen: frischer Tag', await p.evaluate(() => Huelle.bus.protokoll.length === 0 && Huelle.zustand.lies('auftraege/XA745-TANK-01/mitarbeiter') !== 'MA-21'));
  pruefe('7: Aufnehmen: Satz sagt, was passiert', (await p.textContent('#ergebnisText')).includes('wird aufgezeichnet') && (await p.textContent('#ergebnisText')).includes('Als Szenario behalten'));
  await p.evaluate(() => Huelle.handeln({ objekt: 'auftraege/XA745-TANK-01', aktion: 'umplanen', parameter: { mitarbeiter: 'MA-21' }, erzaehlung: 'Disponent zieht XA 745 Betanken auf E. Novak' }, 'hand/pruefung'));
  await p.waitForFunction(() => !document.querySelector('#behalten').hidden);
  pruefe('7: Aufnehmen: nach der ersten Handlung „Als Szenario behalten (1)“', await p.textContent('#behalten') === 'Als Szenario behalten (1)');

  /* Leiste: Vorspielen am Plugin spielt dieselbe Folge */
  await p.click('#pluginKnopf');
  await p.click('[data-plugin="plan-suche"] button.vorspielen');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Pause');
  pruefe('6: Vorspielen an „Suche im Tagesplan“ spielt nur die Suche', await p.inputValue('#wahl') === 'wunsch-023' && await folge() === 'Suche im Tagesplan: Szenario 1 von 1', await folge());
  await p.selectOption('#wahl', '@beenden');
  pruefe('6: Was nur anzeigt, sagt es statt Vorspielen', (await p.textContent('[data-plugin="gantt"]')).includes('Kein Szenario zeigt das, bitte selbst ausprobieren.') && !(await p.locator('[data-plugin="gantt"] button.vorspielen').count()));
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
}
await browser.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
