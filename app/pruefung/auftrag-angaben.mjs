/* Prüft Anweisung 45 (a bis c) und 47: Die KI nennt einzelne Angaben, sonst fragt Play einmal nach; ein Plugin, von dem Play noch
   nicht weiß, was es anfasst, wird einmal im Hintergrund abgespielt; zu einem Plugin im Volltext gehen höchstens drei Szenarien
   mit, je Ereignis eines. Die KI ist eine Attrappe; läuft auf Kopien. Aufruf: node pruefung/auftrag-angaben.mjs */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}
const schritt = (t) => console.log(`-- ${t}`);

const antwort = felder => ({ anPlay: null, rueckfrage: null, teile: null, art: 'neu', kennung: 'x', name: 'x', kurz: 'x', plugin: null, aenderungen: [], drehbuch: null, zeigen: null, regel: null, erwartungen: [], grunddaten: [], grundfunktionen: [], volltext: [], alleDaten: false, ...felder });
const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json'), AUSWAHL = path.join(KI, 'auswahl.json'), PROTOKOLL = path.join(KI, 'protokoll.jsonl');
writeFileSync(ATTRAPPE, JSON.stringify([
  antwort({ volltext: ['verhalten-krankmeldung'], kennung: '', name: '', kurz: '' }),
  antwort({ kennung: 'angaben-test', name: 'Test', kurz: 'Fett.', plugin: 'Huelle.plugin({ kennung: "angaben-test", titel: "Test", stil: ".pl-balken span { font-weight: 700; }" });' }),
  antwort({ kennung: 'angaben-test-2', name: 'Test 2', kurz: 'Kursiv.', plugin: 'Huelle.plugin({ kennung: "angaben-test-2", titel: "Test 2", stil: ".pl-balken span { font-style: italic; }" });' }),
  antwort({ kennung: 'angaben-test-3', name: 'Test 3', kurz: 'Unterstrichen.', plugin: 'Huelle.plugin({ kennung: "angaben-test-3", titel: "Test 3", stil: ".pl-balken span { text-decoration: underline; }" });' }),
]));
writeFileSync(AUSWAHL, JSON.stringify([
  { angaben: ['mitarbeiter'], grundfunktionen: [], unsicher: false },
  { angaben: ['mitarbeiter/urlaub'], grundfunktionen: [], unsicher: false },
  { angaben: [], grundfunktionen: [], unsicher: true },
  { angaben: ['mitarbeiter/urlaub'], grundfunktionen: [], unsicher: false },
  { angaben: [], grundfunktionen: [], unsicher: true },
  { angaben: [], grundfunktionen: [], unsicher: true },
]));

schritt('Play mit einem Plugin starten, das in keinem Szenario arbeitet');
const b = await eigeneBruecke(4381, { mitKopie: true, attrappe: ATTRAPPE, attrappeAuswahl: AUSWAHL, protokoll: PROTOKOLL });
const NEU = 'nur-urlaub', heute = new Date().toISOString();
mkdirSync(path.join(b.plugindaten, 'bausteine', NEU), { recursive: true });
writeFileSync(path.join(b.plugindaten, 'bausteine', NEU, 'fassung-001.js'),
  'Huelle.plugin({ kennung: "nur-urlaub", titel: "Urlaub eintragen", abonniert: { "mitarbeiter/*.urlaub": function (m, h) { h.setze(m.objekt + "/urlaub", true); } } });\n');
writeFileSync(path.join(b.plugindaten, 'bausteine', NEU, 'herkunft.json'), JSON.stringify({
  kennung: NEU, name: 'Urlaub eintragen', reihe: 99, kurz: 'Trägt Urlaub ein.',
  wuensche: [{ kennung: 'wunsch-950', name: 'Urlaub eintragen', wortlaut: 'Urlaub eintragen.', datum: heute }], aktuell: 1,
  fassungen: [{ nr: 1, vorige: null, art: 'wunsch', wunsch: 'wunsch-950', wortlaut: 'Urlaub eintragen.', datum: heute, kurz: 'Trägt Urlaub ein.', drehbuch: null }],
}, null, 2));

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const protokoll = () => readFileSync(PROTOKOLL, 'utf8').trim().split('\n').filter(Boolean).map(z => JSON.parse(z));

try {
  await p.goto(b.adresse);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
  const gesehen = await p.waitForFunction(() => { const t = document.querySelector('#standZeile')?.textContent || ''; return /^Spiele neues Plugin einmal ab: Urlaub eintragen · \d+ von \d+$/.test(t) && t; }, null, { timeout: 30000, polling: 20 }).then(h => h.jsonValue()).catch(() => null);
  pruefe('Die Steuerleiste zeigt, welches Plugin gerade einmal abgespielt wird (45 b)', !!gesehen, gesehen);
  let einmal = {};
  for (let t = Date.now(); !einmal[NEU] && Date.now() - t < 60000; await p.waitForTimeout(300)) einmal = await (await fetch(`${b.adresse}einmal`)).json();
  pruefe('Danach weiß Play, was es anfasst (45 b)', einmal[NEU]?.zugriffe?.['mitarbeiter/urlaub'] === 'aendert' && einmal[NEU]?.ereignis === 'mitarbeiter/*.urlaub', einmal[NEU]);

  schritt('Wunsch: die KI nennt erst ein ganzes Fachobjekt');
  await p.fill('#wunschFeld', 'Urlaub soll im Plan auffallen.');
  await p.click('#wunsch button');
  await p.waitForSelector('#meldungen button:text("Bestätigen")', { timeout: 120000 });
  const auswahl = protokoll().filter(e => e.auswahl).map(e => e.prompt);
  pruefe('Nennt die KI ein ganzes Fachobjekt, fragt Play einmal nach den Angaben (45 a)', auswahl.length === 2 && auswahl[1].includes('# Nachfrage') && auswahl[1].includes('`mitarbeiter` als Ganzes'), auswahl.map(x => x.slice(-300)));
  const [erst, voll] = protokoll().filter(e => !e.auswahl && !e.abgleich).map(e => e.prompt);
  const zeilen = (erst.match(/### Weitere Plugins[\s\S]*?(?=\n## |$)/)?.[0] ?? '').split('\n').filter(z => z.startsWith('- `')).map(z => /^- `([^`]+)`/.exec(z)[1]);
  pruefe('Als Zeile geht nur mit, was die genannte Angabe ändert (45 a, b)', zeilen.length === 1 && zeilen[0] === NEU, zeilen);
  pruefe('Plugins, die nur bedienen oder zeichnen, gelten als bekannt und gehen nicht mit (45 b)', !zeilen.includes('balken-zuweisen') && !zeilen.includes('balken-versatz'), zeilen);
  const szenarien = (voll?.split('Dazu die Szenarien')[1] ?? '').split(/\n(?=Gib jetzt)/)[0];
  const titel = szenarien.match(/\n### [^\n]+/g) || [];
  pruefe('Im Volltext höchstens drei Szenarien, je Ereignis eines; hier hört das Plugin nur auf die Krankmeldung (45 c)', titel.length === 1 && /krankmeldung/.test(titel[0]), titel);

  /* Anweisung 47: unsicher → einmal nachfragen; erst bei weiterer Unsicherheit alle ändernden Plugins */
  const wunsch = async (text) => {
    const vorher = protokoll().length;
    /* „Zurücknehmen“ lädt die Seite neu; erst danach den nächsten Wunsch eintragen. */
    await Promise.all([p.waitForEvent('load', { timeout: 60000 }), p.click('#meldungen button:text("Zurücknehmen")')]);
    await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
    await p.fill('#wunschFeld', text);
    await p.click('#wunsch button');
    await p.waitForSelector('#meldungen button:text("Bestätigen")', { timeout: 120000 });
    const neu = protokoll().slice(vorher);
    const haupt = neu.filter(e => !e.auswahl && !e.abgleich)[0]?.prompt ?? '';
    return {
      auswahl: neu.filter(e => e.auswahl).map(e => e.prompt),
      zeilen: (haupt.match(/### Weitere Plugins[\s\S]*?(?=\n## |$)/)?.[0] ?? '').split('\n').filter(z => z.startsWith('- `')).map(z => /^- `([^`]+)`/.exec(z)[1]),
    };
  };
  schritt('Wunsch: die KI ist erst unsicher und nennt nach der Nachfrage eine Angabe (47)');
  const w2 = await wunsch('Urlaub soll auffallen, irgendwie.');
  pruefe('Ist die KI unsicher, fragt Play einmal nach (47)', w2.auswahl.length === 2 && w2.auswahl[1].includes('# Nachfrage') && w2.auswahl[1].includes('Du warst unsicher'), w2.auswahl.map(x => x.slice(-300)));
  pruefe('Nach der Nachfrage geht nur mit, was die genannte Angabe ändert (47)', w2.zeilen.length === 1 && w2.zeilen[0] === NEU, w2.zeilen);
  schritt('Wunsch: die KI bleibt unsicher (47)');
  const w3 = await wunsch('Alles soll schöner aussehen.');
  pruefe('Bleibt sie unsicher, fragt Play nicht ein drittes Mal (47)', w3.auswahl.length === 2, w3.auswahl.length);
  pruefe('Bleibt sie unsicher, gehen alle ändernden Plugins als Zeile mit (47)', w3.zeilen.length > 1 && w3.zeilen.includes(NEU) && !w3.zeilen.includes('balken-versatz'), w3.zeilen);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
