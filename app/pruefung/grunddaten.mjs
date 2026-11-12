/* Prüft Anweisung 34: Ein Wunsch darf Grunddaten mitändern. Der Satz steht im Ergebnis, die Änderung in der Herkunft,
   „Zurücknehmen“ nimmt sie wieder weg, und die Anleitung der KI verbietet das Ablehnen.
   Die KI ist eine Attrappe; läuft auf Kopien. Aufruf: node pruefung/grunddaten.mjs */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const SATZ = 'Dafür ist der Schritt von Begonnen zurück auf Offen jetzt erlaubt.';
const PFAD = 'arten/auftraege/status/uebergaenge/begonnen';
const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json');
const PROTOKOLL = path.join(KI, 'protokoll.jsonl');
writeFileSync(ATTRAPPE, JSON.stringify([
  { rueckfrage: null, teile: null, art: 'nur-daten', kennung: '', name: 'Zurück auf Offen', kurz: 'Ein begonnener Auftrag kann wieder Offen werden.', plugin: null, aenderungen: [],
    drehbuch: null, zeigen: null, regel: null, erwartungen: [], grunddaten: [{ pfad: PFAD, neu: '["offen","fertig"]', satz: SATZ }], grundfunktionen: ['konflikt-ueberlappung'] },
]));

const b = await eigeneBruecke(4352, { mitKopie: true, attrappe: ATTRAPPE, protokoll: PROTOKOLL });
const umgebung = path.join(b.regeln, '..', path.basename(b.regeln));
const GRUNDDATEN = `${umgebung}-grunddaten.json`;
const GEAENDERT = `${umgebung}-grundstock-geaendert.json`;
const lies = d => existsSync(d) ? JSON.parse(readFileSync(d, 'utf8')) : [];

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const schritt = () => p.evaluate(() => Huelle.tag.arten.auftraege.status.uebergaenge.begonnen.join());

try {
  await p.goto(b.adresse);
  await bereit();
  pruefe('Vorher: von Begonnen nur nach Fertig', (await schritt()) === 'fertig');

  await p.fill('#wunschFeld', 'Ein begonnener Auftrag darf wieder auf Offen gehen.');
  await p.click('#wunsch button');
  const m = await (await p.waitForSelector('#meldungen .meldung:has-text("Zurück")', { timeout: 90000 }).catch(() => p.waitForSelector(`#meldungen .meldung:has-text("${SATZ}")`, { timeout: 90000 }))).textContent();
  pruefe('Das Ergebnis nennt die Änderung in einem Satz', m.includes(SATZ), m);
  const knoepfe = () => p.$$eval('#meldungen .meldung:has(button:text("Bestätigen")) button', l => l.map(b => b.textContent).join());
  pruefe('Anweisung 33: drei Knöpfe, nicht wegklickbar', (await knoepfe()) === 'Vorspielen,Bestätigen,Zurücknehmen', await knoepfe());
  await p.click('#meldungen button:text("Vorspielen")');
  await p.waitForTimeout(300);
  pruefe('Anweisung 33: Vorspielen lässt die Meldung stehen', (await knoepfe()) === 'Vorspielen,Bestätigen,Zurücknehmen', await knoepfe());
  pruefe('Die Änderung gilt sofort', (await schritt()) === 'offen,fertig');

  const e = lies(GRUNDDATEN);
  pruefe('In der Herkunft: Pfad, alt, neu, Wunsch, Wortlaut, Datum', e.length === 1 && e[0].pfad === PFAD && e[0].alt.join() === 'fertig' && e[0].neu.join() === 'offen,fertig' &&
    e[0].wunsch.startsWith('wunsch-') && e[0].wortlaut.includes('wieder auf Offen') && !!e[0].datum, e);
  pruefe('Berührte Grundfunktion ist vermerkt', lies(GEAENDERT).map(x => x.kennung).join() === 'konflikt-ueberlappung', lies(GEAENDERT));

  const auftrag = readFileSync(PROTOKOLL, 'utf8');
  pruefe('Die KI bekommt frühere Entscheidungen und Grundfunktionen', auftrag.includes('Frühere Entscheidungen des Anforderers') && auftrag.includes('## Grundfunktionen'));
  const anleitung = readFileSync(path.join(HIER, '..', 'server', 'plugin-anleitung.md'), 'utf8');
  pruefe('Die Anleitung verbietet Ablehnen und Wegschicken', anleitung.includes('Du lehnst einen Wunsch nie ab'));

  await p.reload();
  await bereit();
  pruefe('Bleibt nach dem Neuladen', (await schritt()) === 'offen,fertig');
  await p.reload();
  await bereit();

  await p.waitForSelector('#meldungen button:text("Bestätigen")', { timeout: 10000 });
  pruefe('Anweisung 33: Die Meldung steht nach dem Neuladen wieder da', (await knoepfe()) === 'Vorspielen,Bestätigen,Zurücknehmen', await knoepfe());
  await Promise.all([p.waitForEvent('load'), p.click('#meldungen button:text("Zurücknehmen")')]);
  await bereit();
  pruefe('Zurücknehmen: Änderung weg', (await schritt()) === 'fertig' && lies(GRUNDDATEN).length === 0 && lies(GEAENDERT).length === 0, { g: lies(GRUNDDATEN), v: lies(GEAENDERT) });
  const OFFEN = `${umgebung}-unbestaetigt.json`;
  pruefe('Anweisung 33: Zurückgenommen ist nicht mehr offen', lies(OFFEN).length === 0, lies(OFFEN));

  await p.fill('#wunschFeld', 'Ein begonnener Auftrag darf wieder auf Offen gehen.');
  await p.click('#wunsch button');
  await p.waitForSelector('#meldungen button:text("Bestätigen")', { timeout: 90000 });
  pruefe('Anweisung 33: Bis zum Bestätigen als „noch nicht bestätigt“ vermerkt', lies(OFFEN).length === 1 && lies(GRUNDDATEN)[0].unbestaetigt === true, lies(GRUNDDATEN));
  await p.click('#meldungen button:text("Bestätigen")');
  await p.waitForFunction(() => ![...document.querySelectorAll('#meldungen button')].some(b => b.textContent === 'Bestätigen'), null, { timeout: 5000 });
  pruefe('Anweisung 33: Bestätigen: Meldung weg, Änderung bleibt', lies(OFFEN).length === 0 && !lies(GRUNDDATEN)[0].unbestaetigt && !!lies(GRUNDDATEN)[0].bestaetigt && (await schritt()) === 'offen,fertig', lies(GRUNDDATEN));
} catch (x) {
  fehler++;
  console.log('FEHL', x.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
