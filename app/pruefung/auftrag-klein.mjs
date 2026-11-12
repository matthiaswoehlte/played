/* Prüft Anweisungen 36, 38 und 43: Fremde Plugins gehen nur als Zeile mit ihren Nachrichten mit, nie als Code, und nur, wenn sie
   dieselben Angaben anfassen; Volltext gibt es auf Anforderung der KI; wirkt im Probelauf ein nicht im Volltext
   mitgegebenes Plugin mit, geht der Wunsch mit ihm noch einmal an die KI; im Zweifel gehen alle als Zeile mit; ein Wunsch an Play
   selbst wird nicht gebaut, sondern festgehalten. Die KI ist eine Attrappe; läuft auf Kopien. Aufruf: node pruefung/auftrag-klein.mjs */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const SATZ = 'Das betrifft Play selbst und könnte dein Sicherheitsnetz beschädigen; ich habe den Wunsch notiert.';
const WORTLAUT = 'Der Knopf Vorspielen soll grün sein.';
const antwort = felder => ({ anPlay: null, rueckfrage: null, teile: null, art: 'neu', kennung: 'x', name: 'x', kurz: 'x', plugin: null, aenderungen: [], drehbuch: null, zeigen: null, regel: null, erwartungen: [], grunddaten: [], grundfunktionen: [], volltext: [], alleDaten: false, ...felder });
const stil = (k, kurz) => antwort({ kennung: k, name: k, kurz, plugin: `Huelle.plugin({ kennung: "${k}", titel: "${k}", stil: ".pl-balken span { font-weight: 700; }" });` });
/* Fällt beim Krankmelden aus: Dort arbeitet ein Plugin mit, das bei „Uhr“ nicht mitgegeben wurde. */
const faelltAus = k => antwort({ kennung: k, name: k, kurz: 'x', plugin: `Huelle.plugin({ kennung: "${k}", titel: "${k}", abonniert: { "mitarbeiter/MA-01.krankmeldung": function () { throw new Error("kaputt"); } } });` });

const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json'), AUSWAHL = path.join(KI, 'auswahl.json'), PROTOKOLL = path.join(KI, 'protokoll.jsonl');
const AN_PLAY = path.join(KI, 'wuensche-an-play.md');
writeFileSync(ATTRAPPE, JSON.stringify([antwort({ anPlay: SATZ, kurz: '', name: '', kennung: '' }), antwort({ volltext: ['vergangenheit-grau'], kennung: '', name: '', kurz: '' }), faelltAus('faellt-aus'), stil('faellt-nicht-aus', 'Nachgebessert.'), antwort({ alleDaten: true, kennung: '', name: '', kurz: '' }), stil('alles-mit', 'Mit allen.')]));
writeFileSync(AUSWAHL, JSON.stringify([{ angaben: ['uhr'], grundfunktionen: [], unsicher: false }, { angaben: ['uhr'], grundfunktionen: [], unsicher: false }, { angaben: [], grundfunktionen: [], unsicher: true }]));

const b = await eigeneBruecke(4356, { mitKopie: true, attrappe: ATTRAPPE, attrappeAuswahl: AUSWAHL, wuenscheAnPlay: AN_PLAY, protokoll: PROTOKOLL });
let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}
const auftraege = () => readFileSync(PROTOKOLL, 'utf8').trim().split('\n').map(z => JSON.parse(z)).filter(e => !e.auswahl && !e.abgleich).map(e => e.prompt);
const CODE = k => `Plugin \`${k}\`\n\n\`\`\`js`, ZEILE = k => `- \`${k}\``;
const FREMD = 'verhalten-krankmeldung', EIGEN = 'vergangenheit-grau';

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const wuensche = async t => { await p.fill('#wunschFeld', t); await p.click('#wunsch button'); };

try {
  await p.goto(b.adresse);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });

  await wuensche(WORTLAUT);
  await p.waitForSelector(`#meldungen .meldung:has-text("${SATZ}")`, { timeout: 30000 });
  const datei = existsSync(AN_PLAY) ? readFileSync(AN_PLAY, 'utf8') : '';
  pruefe('Wunsch an Play: ein Satz, Wortlaut und Datum in der Datei', datei.includes(`> ${WORTLAUT}`) && datei.includes(new Date().toLocaleDateString('sv-SE')), datei);
  pruefe('Wunsch an Play: nichts wird gebaut', (await p.locator('#meldungen button:text("Bestätigen")').count()) === 0);

  await wuensche('Die vergangene Zeit soll dunkler sein.');
  await p.waitForSelector('#meldungen button:text("Bestätigen")', { timeout: 120000 });
  const [, erst, voll, zweit] = auftraege();
  pruefe('Was die Angabe nur liest, geht nicht als Zeile mit (43 b)', !erst.includes(ZEILE(EIGEN)) && !erst.includes(CODE(EIGEN)), erst.slice(0, 300));
  pruefe('Frühere Wünsche nur zu Plugins im Volltext (43 b)', !/Wunsch zu `/.test(erst), erst.match(/[^\n]*Wunsch zu `[^\n]*/)?.[0]);
  pruefe('Nicht mit geht, was die Angabe nicht anfasst', !erst.includes(ZEILE(FREMD)) && !erst.includes(CODE(FREMD)));
  pruefe('Kein fremder Code im Auftrag', !/Plugin `[a-z-]+`(?: \(Grundausstattung\))?\n\n```js/.test(erst));
  pruefe('Volltext auf Anforderung der KI', !!voll && voll.includes(CODE(EIGEN)) && !voll.includes(CODE(FREMD)), voll?.slice(0, 300));
  const beispiel = voll?.split('Dazu die Szenarien')[1] ?? '';
  pruefe('Ein Plugin, das nur zeichnet, bringt genau ein Szenario als Beispiel mit (43 a)', (beispiel.match(/\n### /g) || []).length === 1, beispiel.slice(0, 300));
  pruefe('Probelauf: das nicht mitgegebene Plugin wird nachgereicht', !!zweit && zweit.includes('noch nicht kanntest') && zweit.includes(CODE(FREMD)), zweit?.slice(0, 300));
  pruefe('Danach wird eingespielt', await p.evaluate(() => !!Huelle.plugins?.['faellt-nicht-aus'] || Huelle.eingespielt.some(e => e.name === 'faellt-nicht-aus.js')));
  await p.click('#meldungen button:text("Bestätigen")');

  const bisher = auftraege().length;
  await wuensche('Alles etwas ruhiger.');
  for (let t = Date.now(); auftraege().length <= bisher && Date.now() - t < 120000;) await p.waitForTimeout(200);
  for (let t = Date.now(); !(await p.locator('#meldungen button:text("Bestätigen")').count()) && Date.now() - t < 120000;) await p.waitForTimeout(200);
  const [zweifel, alleDaten] = auftraege().slice(bisher);
  pruefe('Im Zweifel gehen alle, die etwas ändern, als Zeile mit, ohne Code (43 b)', zweifel.includes(ZEILE(FREMD)) && !zweifel.includes(CODE(FREMD)) && !zweifel.includes(ZEILE(EIGEN)), zweifel.slice(0, 300));
  const daten = zweifel.slice(zweifel.indexOf('## Daten'));
  pruefe('Daten: je Fachobjekt Aufbau, Anzahl und Beispiele, nicht alle Einträge (43 c)', daten.includes('"aufbau"') && daten.includes('"beispiele"') && !daten.includes('MA-20'), daten.slice(0, 400));
  pruefe('Alle Daten auf Anforderung der KI (43 c)', !!alleDaten && alleDaten.includes('Hier alle Daten') && alleDaten.includes('MA-20'), alleDaten?.slice(0, 300));

  const anleitung = readFileSync(path.join(HIER, '..', 'server', 'plugin-anleitung.md'), 'utf8');
  pruefe('Die Anleitung erlaubt alles in der Anwendung', anleitung.includes('In der Anwendung ist alles wünschbar') && !anleitung.includes('das Werkzeug betrifft und nicht die Anwendung'));
  pruefe('Wünsche an den Navigator als eigenes Projekt werden gebaut (Anweisung 39)', anleitung.includes('Ist der Netz-Navigator selbst als Projekt offen, ist er die Anwendung'));
} catch (x) {
  fehler++;
  console.log('FEHL', x.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
