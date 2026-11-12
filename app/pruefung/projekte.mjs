/* Prüft Auftrag 009, Stufe 1: Projekte in Play.
   - Der Wähler zeigt die Projekte (Bodenabfertigung und das Probeprojekt aus der Testvorlage).
   - Wechsel ins Probeprojekt: dessen Nutzapp steht da, nichts aus der Dispo.
   - Rückwechsel: Die Dispo ist unverändert (gleicher Zustand, gleiche Szenarien, gleiche Plugins).
   - Nach einem Neustart von Play kommt das zuletzt geöffnete Projekt wieder.
   Läuft auf einer Wegwerf-Kopie aus Code und Testvorlage, auch mit deren Projektdatei, nie auf der Dispo des PO (Anweisung 51 b).
   Aufruf: node pruefung/projekte.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const erste = await eigeneBruecke(4344, { projekte: true, ausVorlage: true });

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await kontext.newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });

async function geladen(adresse) {
  if (adresse) await p.goto(adresse);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig() && !document.querySelector('#projektWahl').hidden, null, { timeout: 120000 });
}
/* Was die Dispo ausmacht: Zustand nach dem Start, Szenarien, Plugins, Titel */
const fingerabdruck = () => p.evaluate(() => JSON.stringify({
  titel: document.querySelector('#titel').textContent,
  szenarien: [...document.querySelectorAll('#wahl option')].map(o => o.value),
  plugins: Huelle.verwaltung.eintraege().map(e => e.kennung).sort(),
  stand: Huelle.stand(),
  nutzbereich: document.querySelector('#nutzbereich').innerText,
  sichten: [...document.querySelectorAll('#nutzbereich .sicht')].map(s => s.dataset.sicht).sort(),
}));
const projekteImWaehler = () => p.$$eval('#projektWahl option', os => os.map(o => ({ kennung: o.value, name: o.textContent })));
async function wechsle(kennung) {
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.selectOption('#projektWahl', kennung)]);
  await geladen();
}

let kind = erste.kind;
try {
  console.log('-- Wähler');
  await geladen(erste.adresse);
  const liste = await projekteImWaehler();
  pruefe('Wähler zeigt Bodenabfertigung und das Probeprojekt',
    liste.some(o => o.kennung === 'bodenabfertigung' && o.name === 'Bodenabfertigung › Personaldisposition') && liste.some(o => o.kennung === 'probe' && o.name === 'Probeprojekt'), liste);
  pruefe('Bodenabfertigung ist geöffnet', await p.inputValue('#projektWahl') === 'bodenabfertigung');
  const vorher = await fingerabdruck();
  pruefe('Dispo steht da', JSON.parse(vorher).titel === 'Tagesdisposition', JSON.parse(vorher).titel);

  console.log('-- Wechsel ins Probeprojekt');
  await wechsle('probe');
  pruefe('Probeprojekt ist geöffnet', await p.inputValue('#projektWahl') === 'probe');
  pruefe('Nutzapp des Probeprojekts steht da', (await p.textContent('#titel')) === 'Probeliste' && (await p.$$('#nutzbereich [data-pfad="eintraege/E-1"]')).length === 1);
  pruefe('Nichts aus der Dispo', (await p.$$('#nutzbereich [data-pfad^="auftraege/"]')).length === 0
    && !(await p.evaluate(() => Huelle.verwaltung.eintraege().some(e => e.kennung === 'gantt'))));
  pruefe('Szenario des Probeprojekts zur Wahl', JSON.stringify(await p.$$eval('#wahl option', os => os.map(o => o.value)))
    .includes('eintrag-erledigt'));

  console.log('-- Rückwechsel');
  await wechsle('bodenabfertigung');
  const nachher = await fingerabdruck();
  pruefe('Dispo nach dem Rückwechsel unverändert', nachher === vorher, { vorher: JSON.parse(vorher), nachher: JSON.parse(nachher) });

  /* Anweisung 46: „Prototyp beginnen“ öffnet sofort die leere Teil-App. Die KI wird nicht gefragt: Abschicken und
     Fortschritt beantwortet die Prüfung selbst, damit nur die Seite geprüft wird. */
  console.log('-- Prototyp beginnen: leere Fläche (46)');
  await wechsle('?beginne:geraete');
  pruefe('Der Wähler zeigt „Bodenabfertigung › Gerätedisposition“', await p.inputValue('#projektWahl') === 'bodenabfertigung/geraete'
    && await p.$eval('#projektWahl', s => s.selectedOptions[0]?.textContent) === 'Bodenabfertigung › Gerätedisposition');
  pruefe('Der Nutzbereich ist leer bis auf eine ruhige Fläche mit dem Namen', await p.textContent('.leere-flaeche strong') === 'Gerätedisposition'
    && await p.$$eval('#nutzbereich .sicht', l => l.filter(s => s.offsetParent).length) === 0);
  pruefe('Das Wunschfeld fragt, was dort entstehen soll', (await p.getAttribute('#wunschFeld', 'placeholder')).includes('was in „Gerätedisposition“ entstehen soll'));
  pruefe('Zähler und Listen gelten der leeren Teil-App', await p.evaluate(() => Huelle.verwaltung.eintraege().length === 0 && Huelle.drehbuecherOffen().length === 0)
    && await p.textContent('#pluginAnzahl') === '0', await p.textContent('#pluginAnzahl'));
  let status = 'arbeitet';
  await p.route('**/prototyp/geraete', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'wunsch-999', art: 'prototyp', status: 'arbeitet' }) }));
  await p.route('**/wunsch/wunsch-999', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'wunsch-999', art: 'prototyp', status, schritt: 'schreibt Plugin 2 von 3', grund: 'Probe' }) }));
  await p.fill('#wunschFeld', 'Eine Liste der Geräte.');
  await p.click('#wunsch button');
  const fortschritt = await p.waitForFunction(() => /Schreibt Plugin 2 von 3/.test(document.querySelector('.leere-flaeche-satz')?.textContent || '') && document.querySelector('.leere-flaeche-satz').textContent, null, { timeout: 15000 }).then(h => h.jsonValue()).catch(() => null);
  pruefe('Während die KI baut, steht der Fortschritt auf der leeren Fläche', !!fortschritt, fortschritt);
  status = 'fehlgeschlagen';
  await p.waitForFunction(() => !document.querySelector('.leere-flaeche button').hidden, null, { timeout: 15000 });
  await p.unrouteAll();
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.click('.leere-flaeche button')]);
  await geladen();
  pruefe('Abbrechen: zurück in der Dispo, der Bereich bleibt leer', (await fingerabdruck()) === vorher
    && (await projekteImWaehler()).some(o => o.kennung === '?beginne:geraete'));

  console.log('-- Neustart: das zuletzt geöffnete Projekt kommt wieder');
  await wechsle('probe');
  kind.kill();
  await new Promise(r => kind.once('exit', r));
  const zweite = await eigeneBruecke(4345, { projekte: erste.projekte, ausVorlage: erste.play });
  kind = zweite.kind;
  await geladen(zweite.adresse);
  pruefe('Nach dem Neustart ist das Probeprojekt offen', await p.inputValue('#projektWahl') === 'probe' && (await p.textContent('#titel')) === 'Probeliste');
  await wechsle('bodenabfertigung');
  pruefe('Und zurück in die Dispo', (await fingerabdruck()) === vorher);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
} finally {
  await browser.close();
}

console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
