/* Prüft Auftrag 009, Stufe 2: Projekt „Netz-Navigator“ mit festen Daten (Testvorlage, eingefrorene Kopie des Navigators).
   - Die Karte zeigt die Bereiche, gestrichelt ohne Prototyp, und die berechneten Fäden mit Zahl.
   - Klick bis zur Herkunftskette von „Einsatz ändern“: Fassung 2 mit Wunsch 014 und den geänderten Erwartungen in wunsch-005.
   - Klick auf einen Faden zeigt seine Beziehungen.
   - Übersicht und Ariadnefaden führen zurück.
   - Das gelesene Projekt ist danach unverändert.
   Aufruf: node pruefung/navigator.mjs */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { angabenVon } from '../server/herkunft-leser.mjs';
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

/* Fingerabdruck aller Dateien unter den gegebenen Wegen */
function abdruck(wege) {
  const h = createHash('sha256');
  const geh = (w) => {
    let st;
    try { st = statSync(w); } catch { return; }
    if (st.isDirectory()) readdirSync(w).sort().forEach(n => geh(path.join(w, n)));
    else h.update(w).update(readFileSync(w));
  };
  wege.forEach(geh);
  return h.digest('hex');
}

const b = await eigeneBruecke(4346, { projekte: true, mitNavigator: true });
const gelesen = [b.plugindaten, b.regeln, b.abgleich, b.inKauf, b.bedienungen, b.ordner, path.resolve(HIER, '..', 'projekt.json')];
const vorher = abdruck(gelesen);

const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
p.on('console', m => { if (m.type() === 'error' && /Plugin /.test(m.text())) { fehler++; console.log('FEHL Konsole:', m.text()); } });

const geladen = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig() && !document.querySelector('#projektWahl').hidden, null, { timeout: 120000 });
const klick = async (auswahl, ziel) => {
  await p.click(auswahl);
  await p.waitForFunction(z => document.querySelector('.nv-station.nv-hier')?.dataset.pfad === z, ziel, { timeout: 5000 });
};
const haupt = '[data-ort="haupt"]';

try {
  console.log('-- Karte');
  await p.goto(b.adresse);
  await geladen();
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.selectOption('#projektWahl', 'netz-navigator')]);
  await geladen();
  pruefe('Navigator ist geöffnet', (await p.textContent('#titel')) === 'Netz-Navigator');
  pruefe('Keine Meldung über gescheiterte Plugins', (await p.$$('#meldungen .fehler')).length === 0, await p.textContent('#meldungen'));

  console.log('-- Angaben (Anweisung 42)');
  const angaben = await p.evaluate(() => Huelle.zustand.lies('angaben') ?? null);
  const ab = angaben?.['mitarbeiter--abwesend'];
  pruefe('Jede Angabe hat einen Namen aus dem Projekt', !!angaben && Object.values(angaben).length > 10 && Object.values(angaben).every(a => a.name), angaben && Object.values(angaben).filter(a => !a.name).map(a => a.kennung));
  pruefe('Abwesenheit: Krankmeldung ändert sie, Plan und Konfliktzähler lesen sie', !!ab && ab.name === 'Abwesenheit' && ab.aendern.includes('verhalten-krankmeldung') && ab.lesen.includes('gantt') && ab.lesen.includes('konfliktzaehler'), ab);
  pruefe('Abwesenheit: eine Regel bewacht sie, sie stammt aus dem Grundstock', !!ab && ab.regeln.includes('abwesend-auftraege-geloest') && ab.herkunft?.art === 'grundstock', ab);
  const st = angaben?.['auftraege--start'];
  pruefe('Auch innerhalb eines Bereichs: Einsatz ändert den Start eines Auftrags, der Plan liest ihn', !!st && st.aendern.includes('verhalten-einsatz') && st.lesen.includes('gantt'), st);
  /* Die Vorlage hat keinen Wunsch, der eine neue Angabe bringt; darum ein kleines eigenes Beispiel: Wunsch 007 bringt „Überfällig“ am Flug. */
  {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'angaben-'));
    mkdirSync(path.join(tmp, 'daten'));
    writeFileSync(path.join(tmp, 'daten', 'tag.js'), 'Huelle.daten({ objekte: { fluege: { X1: { flug: "X 1" } } }, arten: { fluege: { name: "Flug" } } });');
    mkdirSync(path.join(tmp, 'bausteine', 'nachruecken'), { recursive: true });
    writeFileSync(path.join(tmp, 'bausteine', 'nachruecken', 'herkunft.json'), JSON.stringify({ aktuell: 1, fassungen: [{ nr: 1, wunsch: 'wunsch-007', datum: '2026-11-08T10:00:00Z' }] }));
    writeFileSync(path.join(tmp, 'bausteine', 'nachruecken', 'fassung-001.js'), 'h.setze("fluege/X1/ueberfaellig", true);');
    const a = await angabenVon({ ordner: tmp, bausteine: path.join(tmp, 'bausteine'), projekt: { angabeNamen: { fluege: { flug: 'Flugnummer', ueberfaellig: 'Überfällig' } } } }, {
      gearbeitet: { s: { zugriffe: { nachruecken: { 'fluege/ueberfaellig': 'aendert', 'fluege/flug': 'liest' } } } },
      bausteine: { nachruecken: {} }, besitzer: new Map([['fluege', 'flugplan']]), namen: {}, regelCode: new Map(),
    });
    rmSync(tmp, { recursive: true, force: true });
    const ue = a['fluege--ueberfaellig'];
    pruefe('Eine Angabe aus einem Wunsch nennt Wunsch und Datum', ue?.herkunft?.art === 'wunsch' && ue.herkunft.wunsch === '007' && ue.herkunft.datum === '08.11.2026' && ue.name === 'Überfällig', ue);
    pruefe('Eine Angabe aus dem Grundstock heißt so', a['fluege--flug']?.herkunft?.art === 'grundstock' && a['fluege--flug'].lesen.includes('nachruecken'), a['fluege--flug']);
  }
  pruefe('Keine Feldnamen als Namen', !!angaben && Object.values(angaben).every(a => a.name !== a.angabe));

  const kaesten = await p.$$eval('.nv-kasten', k => k.map(e => ({ pfad: e.dataset.pfad, text: e.innerText, gepunktet: e.classList.contains('nv-b-daten') })));
  pruefe('Drei Bereiche als Kästen', JSON.stringify(kaesten.map(k => k.pfad).sort()) === JSON.stringify(['bereiche/disposition-ordner', 'bereiche/flugplan', 'bereiche/personal-ordner']), kaesten);
  pruefe('Disposition zeigt Matthias', kaesten.find(k => k.pfad === 'bereiche/disposition-ordner').text.includes('Matthias'));
  pruefe('Nur Bereiche ohne Prototyp gepunktet', kaesten.filter(k => k.gepunktet).map(k => k.pfad).sort().join() === 'bereiche/flugplan,bereiche/personal-ordner');

  const zahlen = await p.$$eval('.nv-zahl', z => z.map(e => ({ pfad: e.dataset.pfad, n: Number(e.textContent) })));
  const naht = 'faeden/disposition-ordner--personal-ordner';
  pruefe('Fäden von Disposition zu Personal und zu Flugplan, mit Zahl', zahlen.some(z => z.pfad === naht && z.n > 0) && zahlen.some(z => z.pfad === 'faeden/disposition-ordner--flugplan' && z.n > 0), zahlen);

  console.log('-- Faden');
  /* Anweisung 30a: Die Zahl öffnet die Liste dessen, was sie zählt; das Bündel selbst öffnet die Linie. */
  await p.click(`.nv-zahl[data-pfad="${naht}"]`);
  await p.waitForSelector('#punkteFenster:not([hidden]) .punkt, #punkteFenster:not([hidden]) .punkte-klar');
  const inListe = await p.$$eval('#punkteFenster .punkt', l => l.length);
  pruefe('Die Zahl am Bündel öffnet die Liste seiner Stränge', inListe === zahlen.find(z => z.pfad === naht).n, inListe);
  await p.click('#punkteFenster [aria-label="Schließen"]');
  await p.evaluate(z => Huelle.handeln({ objekt: 'navi/jetzt', aktion: 'gehen', parameter: { ziel: z } }, 'hand'), naht);
  await p.waitForFunction(z => document.querySelector('.nv-station.nv-hier')?.dataset.pfad === z, naht, { timeout: 5000 });
  const beziehungen = await p.$$eval(`${haupt} .nv-liste li`, l => l.map(e => e.innerText));
  pruefe('Faden zeigt so viele Beziehungen, wie die Zahl sagt', beziehungen.length === zahlen.find(z => z.pfad === naht).n, beziehungen);
  pruefe('Krankmeldung ändert die Abwesenheit eines Mitarbeiters gehört dazu', beziehungen.some(t => /Krankmeldung.*ändert die Abwesenheit eines Mitarbeiters/.test(t)), beziehungen);
  pruefe('Die Regel über die Grenze gehört dazu', beziehungen.some(t => t.includes('höchstens zwei Aufträge') && t.includes('prüft Aufträge')), beziehungen);

  console.log('-- Hineinzoomen bis zur Herkunft');
  await klick('.nv-minibox[class] button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  pruefe('Bereich zeigt seine Plugins', (await p.$$(`${haupt} .nv-kachel`)).length > 5);
  await klick(`${haupt} .nv-kachel[data-pfad="bausteine/verhalten-einsatz"]`, 'bausteine/verhalten-einsatz');
  const kette = await p.$eval(`${haupt} .nv-kette`, e => e.innerText);
  const glieder = await p.$$eval(`${haupt} .nv-glied h3`, h => h.map(e => e.textContent));
  pruefe('Kette in der Reihenfolge Wunsch, Fassungen, Szenarien', glieder.slice(0, 3).join() === 'Wunsch,Fassungen,Berührte Szenarien', glieder);
  pruefe('Fassung 2 aus Wunsch 014 mit Datum', /Fassung 2 · Wunsch 014\s*07\.11\.2026/.test(kette), kette.slice(0, 600));
  pruefe('Wunsch steht im Wortlaut da', kette.includes('Ein Auftrag soll auch einem Mitarbeiter ohne passende Qualifikation zugewiesen werden können'));
  pruefe('Geänderte Erwartung mit alt und neu', kette.includes('XC 810 Betanken auf I. Reindl ist jetzt ein Konflikt statt verweigert.')
    && kette.includes('Vorher: XC 810 Betanken bleibt bei D. Mahler') && kette.includes('Jetzt: XC 810 Betanken liegt jetzt bei I. Reindl'));

  console.log('-- Zurückfinden');
  const stationen = () => p.$$eval('.nv-station', s => s.map(e => ({ pfad: e.dataset.pfad, hier: e.classList.contains('nv-hier') })));
  const weg = await stationen();
  pruefe('Ariadnefaden zeigt den ganzen Weg', weg.map(s => s.pfad).join() === `karte,${naht},bereiche/disposition,bausteine/verhalten-einsatz`, weg);
  pruefe('Übersicht markiert die Stelle', (await p.$$('.nv-punkt.nv-hier[data-pfad="bausteine/verhalten-einsatz"]')).length === 1);
  await klick('.nv-station[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  const zurueck = await stationen();
  pruefe('Faden bringt zurück, der Weg bleibt stehen', zurueck.length === 4 && zurueck[2].hier, zurueck);
  await klick('.nv-gesamt', 'karte');
  pruefe('Übersicht springt zur Karte', (await p.$$('.nv-kasten')).length === 3);

  console.log('-- Szenarien, in denen ein Plugin arbeitet');
  await klick('.nv-kasten[data-pfad="bereiche/disposition-ordner"]', 'bereiche/disposition-ordner');
  await klick('.nv-kasten[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  await klick(`${haupt} .nv-kachel[data-pfad="bausteine/verhalten-krankmeldung"]`, 'bausteine/verhalten-krankmeldung');
  const arbeitet = await p.$$eval(`${haupt} .nv-glied`, g => g.filter(e => e.querySelector('h3').textContent === 'Arbeitet in diesen Szenarien').map(e => e.innerText).join());
  pruefe('Krankmeldung nennt ihre Szenarien mit dem letzten Abspielen', /zuletzt abgespielt am \d{2}\.\d{2}\.\d{4}/.test(arbeitet) && !arbeitet.includes('ohne Titel'), arbeitet);

  await klick('.nv-minibox button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  await klick(`${haupt} .nv-kachel[data-pfad="bausteine/balken-kante"]`, 'bausteine/balken-kante');
  const maus = await p.$$eval(`${haupt} .nv-glied`, g => g.filter(e => e.querySelector('h3').textContent === 'Arbeitet in diesen Szenarien').map(e => e.innerText).join());
  pruefe('Ein Plugin, das nur auf die Maus antwortet, nennt sein Szenario', maus.includes('mit der Maus verlängern und verkürzen'), maus);

  console.log('-- Grundstock');
  const grund = `${haupt} .nv-kachel.nv-grund`;
  await klick('.nv-minibox button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  pruefe('Der Grundstock steht im Bereich, deutlich getrennt und mit Vermerk', (await p.$$(grund)).length === 3 && (await p.textContent(`${haupt} .nv-tief`)).includes('Nachträglich erfasst, vom PO noch nicht durchgesehen.'));
  await klick(`${grund}[data-pfad="grundfunktionen/konflikt-ueberlappung"]`, 'grundfunktionen/konflikt-ueberlappung');
  const mitQuelle = await p.$eval(`${haupt} .nv-kette`, e => e.innerText);
  pruefe('Grundfunktion mit Wortlaut des PO und Datum', mitQuelle.includes('Es muss eine Konfliktliste geben') && mitQuelle.includes('27.09.2026') && /Wortlaut des PO/i.test(mitQuelle), mitQuelle);
  await klick('.nv-minibox button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  await klick(`${grund}[data-pfad="grundfunktionen/balkenfarbe"]`, 'grundfunktionen/balkenfarbe');
  pruefe('Ohne Quelle steht genau das da', (await p.$eval(`${haupt} .nv-kette`, e => e.innerText)).includes('Von Claude Code gebaut, ohne Wunsch des PO.'));
  await p.fill('.nv-anmerkung', 'Die Farben sind anders gemeint.');
  await p.click('.nv-stimmtnicht');
  await p.waitForFunction(() => document.querySelector('[data-ort="haupt"] .nv-kette').innerText.includes('Die Farben sind anders gemeint.'), null, { timeout: 5000 });
  const anmerkungen = path.join(b.projekte, 'netz-navigator', 'entscheidungen', 'grundstock-anmerkungen.json');
  for (let i = 0; i < 30 && !existsSync(anmerkungen); i++) await new Promise(r => setTimeout(r, 100));
  await p.reload();
  await geladen();
  await klick('.nv-gesamt', 'karte').catch(() => {});
  await klick('.nv-kasten[data-pfad="bereiche/disposition-ordner"]', 'bereiche/disposition-ordner');
  await klick('.nv-kasten[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  await klick(`${grund}[data-pfad="grundfunktionen/balkenfarbe"]`, 'grundfunktionen/balkenfarbe');
  pruefe('„Stimmt nicht“ ist nach dem Neuladen noch da', (await p.$eval(`${haupt} .nv-kette`, e => e.innerText)).includes('Die Farben sind anders gemeint.'));

  console.log('-- Grundstock bestätigen');
  await klick('.nv-minibox button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  await p.click('[data-bestaetigen]');
  await p.waitForFunction(() => /vom PO bestätigt am \d\d\.\d\d\.\d{4}/.test(document.querySelector('[data-ort="haupt"] .nv-tief').innerText), null, { timeout: 5000 });
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nachBestaetigung = async () => ({
    text: await p.textContent(`${haupt} .nv-tief`),
    gestrichelt: await p.$$eval(grund, l => l.map(e => e.dataset.pfad)),
    knopf: await p.$('[data-bestaetigen]'),
  });
  const pruefeBestaetigt = (s, wann) => pruefe(`Bestätigt am echten Tag, nur die Markierte bleibt gestrichelt (${wann})`,
    s.text.includes(`vom PO bestätigt am ${heute}`) && s.gestrichelt.join() === 'grundfunktionen/balkenfarbe' && !s.knopf, s);
  pruefeBestaetigt(await nachBestaetigung(), 'sofort');
  await p.reload();
  await geladen();
  await klick('.nv-gesamt', 'karte').catch(() => {});
  await klick('.nv-kasten[data-pfad="bereiche/disposition-ordner"]', 'bereiche/disposition-ordner');
  await klick('.nv-kasten[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  pruefeBestaetigt(await nachBestaetigung(), 'nach dem Neuladen');

  console.log('-- „Stimmt nicht“ zurücknehmen (Anweisung 33 c)');
  await klick(`${grund}[data-pfad="grundfunktionen/balkenfarbe"]`, 'grundfunktionen/balkenfarbe');
  await p.click('[data-zuruecknehmen]');
  await p.waitForFunction(() => !document.querySelector('[data-zuruecknehmen]'), null, { timeout: 5000 });
  await klick('.nv-minibox button[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  pruefe('Der Kasten gilt wieder als bestätigt', !(await p.$(`${grund}[data-pfad="grundfunktionen/balkenfarbe"]`)));

  console.log('-- Ein Wunsch berührt Bestätigtes (Anweisung 34 d)');
  writeFileSync(`${b.regeln}-grundstock-geaendert.json`, JSON.stringify([{ kennung: 'konflikt-ueberlappung', wunsch: 'wunsch-099', wortlaut: 'Test', datum: new Date(Date.now() + 1000).toISOString() }]));
  await p.reload();
  await geladen();
  await klick('.nv-gesamt', 'karte').catch(() => {});
  await klick('.nv-kasten[data-pfad="bereiche/disposition-ordner"]', 'bereiche/disposition-ordner');
  await klick('.nv-kasten[data-pfad="bereiche/disposition"]', 'bereiche/disposition');
  const kachel = `${grund}[data-pfad="grundfunktionen/konflikt-ueberlappung"]`;
  pruefe('Am Kasten steht wieder „Vorschlag“', (await p.textContent(kachel).catch(() => '')).includes('Vorschlag'));
  await new Promise(r => setTimeout(r, 1100));
  await p.click('[data-bestaetigen]');
  await p.waitForFunction(k => !document.querySelector(k), kachel, { timeout: 5000 });
  pruefe('Nach dem Bestätigen ist „Vorschlag“ weg', !(await p.$(kachel)));

  console.log('-- Nur lesen');
  pruefe('Das gelesene Projekt ist unverändert', abdruck(gelesen) === vorher);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
} finally {
  await browser.close();
}

console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
