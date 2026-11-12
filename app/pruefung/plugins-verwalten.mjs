/* Prüft Stufe 1 aus Auftrag 004: Plugin-Leiste und zusammengefasste Abweichungen, seit dem
   Zuschnitt mit kleinen Plugins (je eins für Anzeige, Ziehen, Kante, Konfliktrand usw.).
   Läuft auf einer Kopie der echten Wünsche und Sollergebnisse, also an der echten Meldungswand.
   Aufruf: node pruefung/plugins-verwalten.mjs [ordner-fuer-bilder] */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, ordner: SOLL, plugindaten: DATEN } = await eigeneBruecke(4328, { mitKopie: true });
const BILDER = process.argv[2];
const BAUSTEINE = path.join(DATEN, 'bausteine');
const KLEINE = ['flugverspaetung', 'balken-kante', 'balken-zuweisen', 'balken-verschieben', 'offen-zuweisen', 'konflikt-rand', 'konflikt-liste', 'balken-versatz', 'konflikt-leuchten'];
const KORB = path.join(DATEN, 'papierkorb');
/* Bis 07.11. abends wich am Bestand des PO genau eine Ursache ab: das kleine Plugin für den roten Rand. Seit der
   PO diese Endstände mit „So ist es jetzt richtig“ übernommen hat, weicht nichts mehr ab. Damit die Leiste etwas
   zu zeigen hat, fehlt in der Kopie im Sollergebnis von „Krankmeldung MA-01“ das Suchfeld (Wunsch 023, der
   zuletzt eingespielte Wunsch): Ursache ist dann genau „Suche im Tagesplan“. */
const URSACHE = 'plan-suche';
{
  const datei = path.join(SOLL, 'krankmeldung-ma-01.json');
  const s = JSON.parse(readFileSync(datei, 'utf8'));
  Object.values(s.je).forEach(e => { e.sichten.gantt = e.sichten.gantt.filter(x => x !== 'kennzahlen/suche'); });
  writeFileSync(datei, JSON.stringify(s, null, 2));
}

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}
const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const kontext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await kontext.newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });

const bereit = async (s = p) => {
  const t0 = Date.now();
  await s.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 60000 })
    .catch(async e => { console.log('     Messung nach 60 s nicht fertig: ' + await s.evaluate(() => Huelle.verwaltung.fortschrittSatz()).catch(() => '?')); throw e; });
  console.log(`     Messung fertig nach ${Date.now() - t0} ms`);
};
/* Nach jedem Neuladen ermittelt Play die Ursachen neu (etwa 9 s). Wo die folgenden Punkte nur die Leiste,
   Dateien oder den Papierkorb ansehen, wartet die Prüfung nur, bis Play geladen und die Leiste gefüllt ist
   (PO 08.11., Punkt 13: kürzen, ohne weniger zu prüfen). Wo ein Punkt Abweichungen oder Ursachen braucht,
   wartet sie weiter auf die fertige Messung. */
const geladen = async () => {
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#pluginListe [data-plugin]'), null, { timeout: 60000 });
};
const neuGeladen = async (tue, ohneMessung) => {
  await Promise.all([p.waitForEvent('load'), tue()]);
  await (ohneMessung ? geladen() : bereit());
};
const OHNE_MESSUNG = true;
const eintrag = k => p.locator(`[data-plugin="${k}"]`);
const knopfVon = (k, klasse) => eintrag(k).locator(`button.${klasse}`);
const bild = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png') }); };
const zaehler = () => p.textContent('#abweichKnopf');
const gruppen = () => p.evaluate(() => Huelle.verwaltung.gruppen().map(g => ({
  art: g.ursache.art, kennung: g.ursache.kennung, n: g.drehbuecher.length,
  saetze: g.drehbuecher.flatMap(d => d.saetze),
})));

try {
  const t0 = Date.now();
  await p.goto(ADRESSE);
  await bereit();
  console.log(`     Ermitteln nach dem Laden: ${Date.now() - t0} ms`);

  /* ---------- 1 Die heutige Meldungswand ---------- */
  pruefe('Über dem Tagesplan steht keine Meldung', (await p.locator('#meldungen .meldung').count()) === 0);
  pruefe('Leiste und Abweichungen sind eingeklappt', !(await p.isVisible('#verwaltung')));
  /* Wie viele abweichen, hängt an den Abnahmen des PO (Sollergebnisse im Repo); 07.11. früh ist es eins. */
  const ANFANG = await zaehler();
  const ANZAHL = Number((/^(\d+) Szenari/.exec(ANFANG) || [])[1]);
  /* Seit den Abweichungen mit Plan/Anzeige (PO 07.11. abends) steht „(nur Anzeige)“ dabei, wenn der Plan gleich ist. */
  pruefe('Zähler nennt die abweichenden Szenarien', ANZAHL >= 1 && ANFANG === (ANZAHL === 1 ? '1 Szenario endet anders' : ANZAHL + ' Szenarien enden anders') + ' (nur Anzeige)', ANFANG);
  const g = await gruppen();
  pruefe('Eine einzige Ursache: die Suche im Tagesplan', g.length === 1 && g[0].kennung === URSACHE && g[0].n === ANZAHL, g);
  pruefe('Kein Satz ohne Inhalt', g[0].saetze.every(s => s && !s.includes('weicht ab')), g[0].saetze);
  await bild('1-eingeklappt');

  await p.click('#abweichKnopf');
  const satz = await p.textContent('.abweichung-satz');
  const WORTLAUT = await p.evaluate(k => Huelle.verwaltung.eintraege().find(e => e.kennung === k).wortlaut, URSACHE);
  pruefe('Satz nennt den Wunsch im Wortlaut', satz.startsWith('Seit deinem Wunsch „' + WORTLAUT.slice(0, 30)) && satz.endsWith(ANZAHL === 1 ? 'endet 1 Szenario anders.' : 'enden ' + ANZAHL + ' Szenarien anders.'), satz);
  /* Seit dem Umbau der Abweichungen (PO 07.11., Punkt 4: gut sichtbar) ist die Liste je Ursache schon aufgeklappt. */
  if (!(await p.locator('.abweichung-liste').count())) await p.click('.abweichung-satz');
  pruefe('Aufgeklappt: je Szenario ein Eintrag mit seinen Sätzen', (await p.locator('.abweichung-liste > li').count()) === ANZAHL && (await p.locator('.abweichung-liste > li .abweichung-saetze li').count()) >= ANZAHL);
  pruefe('Der Satz sagt, was anders ist', (await p.textContent('.abweichung-liste')).includes('Im Tagesplan ist jetzt das Suchfeld'), await p.textContent('.abweichung-liste'));
  pruefe('Tagesplan bleibt sichtbar', (await p.locator('.pl-balken').first().isVisible()) && (await p.locator('[data-sicht="gantt"]').boundingBox()).width > 500);
  await bild('2-abweichungen');

  /* ---------- 2 Zum Plugin, Leiste, Aufklappen bleibt ---------- */
  await p.click('.abweichung .knopfzeile button:text("Zum Plugin")');
  pruefe('Zum Plugin öffnet die Leiste am Plugin', await eintrag(URSACHE).isVisible());
  pruefe('Plugin trägt den Wunsch im Wortlaut mit Datum', (await eintrag(URSACHE).textContent()).includes('Wunsch vom 07.11.2026') && (await eintrag(URSACHE).locator(':scope > blockquote').first().textContent()) === WORTLAUT);
  pruefe('Es weicht ab', (await eintrag(URSACHE).locator('.abzeichen').textContent()) === 'weicht ab');
  pruefe('Unbeteiligtes stimmt', (await eintrag('balken-versatz').locator('.abzeichen').textContent()) === 'stimmt');
  pruefe('Grundausstattung ist erkennbar', (await eintrag('verhalten-einsatz').textContent()).includes('Grundausstattung'));
  pruefe('Tagesplan heißt in der Leiste Tagesplan', (await eintrag('gantt').locator('h3').textContent()) === 'Tagesplan');
  pruefe('Umbau 007 steht ohne Wortlaut dabei', (await eintrag('balken-kante').textContent()).includes('Umbau ohne eigenen Wunsch') && (await eintrag('balken-kante').locator('blockquote').count()) === 1);
  pruefe('Kein Plugin steckt mehr in einem anderen', !(await p.textContent('#pluginListe')).includes('Steckt auch in'));
  pruefe('Zwei Wünsche, ein Plugin: beide Wortlaute', (await eintrag('balken-zuweisen').locator('blockquote').count()) === 2);
  pruefe('Grundausstattung mit Wunsch zeigt den Wortlaut', (await eintrag('konfliktzaehler').locator('blockquote').count()) === 1);
  /* 15 bis 07.11. früh; mit den Wünschen 015 bis 023 des PO sind es mehr. Die Zahl steht in der Verwaltung. */
  const ZAHL = await p.evaluate(() => Huelle.verwaltung.eintraege().length);
  pruefe('Knopf nennt die Anzahl', ZAHL >= 15 && (await p.textContent('#pluginKnopf')).trim() === 'Plugins ' + ZAHL, await p.textContent('#pluginKnopf'));
  const berWunsch12 = await p.evaluate(() => Huelle.verwaltung.beruehrt('konflikt-leuchten').map(d => d.kennung));
  pruefe('Leuchten berührt sein Szenario', berWunsch12.includes('wunsch-012'), berWunsch12);
  const berEinsatz = await p.evaluate(() => Huelle.verwaltung.beruehrt('verhalten-einsatz').map(d => d.kennung));
  pruefe('Regeln berühren die Szenarien mit Ziehen', berEinsatz.includes('wunsch-005'), berEinsatz);
  await bild('3-leiste');

  await p.reload();
  await geladen();
  pruefe('Nach dem Neuladen bleibt die Leiste offen', await p.isVisible('#leiste'));
  await p.click('#leisteZu');
  pruefe('Einklappen geht', !(await p.isVisible('#leiste')));
  await p.reload();
  await bereit();   /* „Filter weicht ab“ unten braucht die fertige Messung */
  pruefe('Nach dem Neuladen bleibt sie zu', !(await p.isVisible('#leiste')));
  await p.click('#pluginKnopf');

  /* ---------- 3 Suchen und Filtern ---------- */
  const namen = () => p.locator('#pluginListe [data-plugin]').evaluateAll(l => l.map(e => e.dataset.plugin));
  await p.fill('#pluginSuche', 'Qualifikation');
  pruefe('Suche findet im Wortlaut', (await namen()).includes('balken-zuweisen') && (await namen()).length < 5, await namen());
  await p.fill('#pluginSuche', '');
  await p.click('[data-filter="grund"]');
  /* Die festen Zahlen 6 und 9 galten bis 07.11. früh; seitdem kamen Wünsche dazu. Geprüft wird gegen die Verwaltung. */
  const arten = await p.evaluate(() => Object.fromEntries(Huelle.verwaltung.eintraege().map(e => [e.kennung, e.art])));
  const grund = Object.keys(arten).filter(k => arten[k] === 'grund'), ausWunsch = Object.keys(arten).filter(k => arten[k] === 'wunsch' || arten[k] === 'umbau');
  pruefe('Filter Grundausstattung', (await namen()).every(k => !KLEINE.includes(k)) && JSON.stringify((await namen()).sort()) === JSON.stringify(grund.sort()) && grund.length >= 6, await namen());
  await p.click('[data-filter="wunsch"]');
  pruefe('Filter aus Wunsch', KLEINE.every(k => ausWunsch.includes(k)) && JSON.stringify((await namen()).sort()) === JSON.stringify(ausWunsch.sort()), await namen());
  await p.click('[data-filter="abweichend"]');
  pruefe('Filter weicht ab', (await namen()).includes(URSACHE), await namen());
  await p.click('[data-filter="alle"]');

  /* ---------- 4 Aus und wieder an ---------- */
  const anzahlDrehbuecher = await p.evaluate(() => Huelle.drehbuecher.length);
  await p.selectOption('#wahl', 'krankmeldung-ma-20');
  await neuGeladen(() => knopfVon('konflikt-leuchten', 'schalter').click(), OHNE_MESSUNG);
  pruefe('Aus: steht in der Datei, nicht im Browser', JSON.parse(readFileSync(path.join(DATEN, 'verwaltung.json'), 'utf8')).aus.includes('konflikt-leuchten'));
  pruefe('Aus: Eintrag sagt aus', (await eintrag('konflikt-leuchten').locator('.abzeichen').textContent()) === 'aus');
  pruefe('Aus: eigenes Szenario fällt weg', (await p.evaluate(() => Huelle.drehbuecher.length)) === anzahlDrehbuecher - 1);
  pruefe('Aus: die Wahl bleibt', (await p.inputValue('#wahl')) === 'krankmeldung-ma-20');
  pruefe('Aus: Hervorheben ist weg, der Rest bleibt', await p.evaluate(() => !Huelle.bedienungen('konfliktzaehler').liste.some(b => b.kennung === 'konflikt-hervorheben')));
  pruefe('Aus: Der Prototyp läuft weiter', (await p.locator('.pl-balken').count()) > 10);
  pruefe('Aus: Die Brücke liefert den Wunsch nicht mehr aus', await p.evaluate(() => fetch('/wuensche').then(r => r.json()).then(l => !l.some(w => w.name.startsWith('konflikt-leuchten')))));
  await bild('4-aus');

  await neuGeladen(() => knopfVon('konflikt-leuchten', 'schalter').click(), OHNE_MESSUNG);
  pruefe('An: Plugin ist wieder da', await p.evaluate(() => Huelle.bedienungen('konfliktzaehler').liste.some(b => b.kennung === 'konflikt-hervorheben')));
  pruefe('An: Szenario ist wieder da', (await p.evaluate(() => Huelle.drehbuecher.length)) === anzahlDrehbuecher);

  /* Aus mit Folgen: Die Ursache ist dann das Abschalten */
  await neuGeladen(() => knopfVon('verhalten-einsatz', 'schalter').click());
  const ausGrund = await gruppen();
  pruefe('Grundausstattung aus: Ursache ist das Abschalten', ausGrund.some(x => x.art === 'aus' && x.kennung === 'verhalten-einsatz'), ausGrund);
  pruefe('Satz nennt das Abschalten', (await p.textContent('#abweichungen')).includes('Seit „Einsatz ändern“ abgeschaltet ist'), await p.textContent('#abweichungen'));
  await neuGeladen(() => knopfVon('verhalten-einsatz', 'schalter').click());
  pruefe('Wieder an: Stand wie vorher', (await zaehler()) === ANFANG, await zaehler());

  /* ---------- 5 Löschen und Wiederherstellen ---------- */
  const soll012 = path.join(SOLL, 'wunsch-012.json');
  pruefe('Vorher liegt das Sollergebnis da', existsSync(soll012));
  await neuGeladen(() => knopfVon('konflikt-leuchten', 'loeschen').click(), OHNE_MESSUNG);
  pruefe('Löschen: Dateien liegen im Papierkorb', ['fassung-001.js', 'wunsch-012.drehbuch.js', 'herkunft.json', 'wunsch-012.soll.json'].every(n => existsSync(path.join(KORB, 'konflikt-leuchten', n))));
  pruefe('Löschen: weg aus dem Ordner', !existsSync(path.join(BAUSTEINE, 'konflikt-leuchten')) && !existsSync(soll012));
  pruefe('Löschen: nicht mehr in der Liste', (await eintrag('konflikt-leuchten').count()) === 0);
  pruefe('Löschen: Papierkorb zeigt es', (await p.textContent('#papierkorb summary')) === 'Papierkorb (2)' && await p.locator('[data-korb="konflikt-leuchten"]').count() === 1);
  await p.click('#papierkorb summary');
  await bild('5-papierkorb');
  await neuGeladen(() => p.click('[data-korb="konflikt-leuchten"] button.wiederherstellen'), OHNE_MESSUNG);
  pruefe('Wiederherstellen: Dateien sind zurück', existsSync(path.join(BAUSTEINE, 'konflikt-leuchten', 'fassung-001.js')) && existsSync(soll012) && !existsSync(path.join(KORB, 'konflikt-leuchten')));
  pruefe('Wiederherstellen: wieder in der Liste', await eintrag('konflikt-leuchten').isVisible());
  pruefe('Wiederherstellen: im Papierkorb liegt nur noch „Automatisch umverteilen“', (await p.textContent('#papierkorb summary')) === 'Papierkorb (1)' && await p.locator('[data-korb="konflikt-leuchten"]').count() === 0);

  /* Eine Kennung aus dem Papierkorb wird nicht neu vergeben */
  await neuGeladen(() => knopfVon('konflikt-leuchten', 'loeschen').click(), OHNE_MESSUNG);
  const neu = await p.evaluate(() => fetch('/wunsch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: ' ' }) }).then(r => r.status));
  pruefe('Leerer Wunsch wird abgewiesen', neu === 400);
  await neuGeladen(() => p.click('[data-korb="konflikt-leuchten"] button.wiederherstellen'), OHNE_MESSUNG);

  /* ---------- 6 Widerspruch ---------- */
  const widerspruch = (k, wert) => `Huelle.plugin({ kennung: "${k}", titel: "${k}", abonniert: { "mitarbeiter/*.krankmeldung": function (m, h) { h.setze("auftraege/XC810-BELA-01/vermerk", "${wert}"); } } });\n`;
  for (const [k, name, wert, wortlaut, reihe] of [['probe-a', 'Probe A', 'MA-02', 'Erster', 90], ['probe-b', 'Probe B', 'MA-03', 'Zweiter', 91]]) {
    mkdirSync(path.join(BAUSTEINE, k), { recursive: true });
    writeFileSync(path.join(BAUSTEINE, k, 'fassung-001.js'), widerspruch(k, wert));
    writeFileSync(path.join(BAUSTEINE, k, 'herkunft.json'), JSON.stringify({
      kennung: k, name, reihe, wuensche: [{ kennung: 'wunsch-' + reihe, wortlaut, datum: '2026-11-06T12:00:00Z' }],
      aktuell: 1, fassungen: [{ nr: 1, vorige: null, art: 'wunsch', wortlaut, datum: '2026-11-06T12:00:00Z' }],
    }));
  }
  await p.reload();
  await bereit();
  const wa = await eintrag('probe-a').locator('.plugin-widerspruch').first().textContent().catch(() => '');
  const wb = await eintrag('probe-b').locator('.plugin-widerspruch').first().textContent().catch(() => '');
  pruefe('Widerspruch steht an beiden als derselbe Satz', wa && wa === wb && wa.includes('„Probe A“ und „Probe B“') && wa.includes('es gilt „Probe A“'), { wa, wb });
  console.log('     ' + wa);
  await bild('6-widerspruch');
  pruefe('Ohne Widerspruch steht nichts da', (await eintrag(URSACHE).locator('.plugin-widerspruch').count()) === 0);
  await neuGeladen(() => knopfVon('probe-a', 'loeschen').click(), OHNE_MESSUNG);
  await neuGeladen(() => knopfVon('probe-b', 'loeschen').click());

  /* Gelöscht mit Folgen: Ursache ist der Papierkorb. Danach Papierkorb wieder leer. */
  const geloescht = await gruppen();
  pruefe('Nach dem Löschen der Proben: alte Ursache gilt weiter', geloescht.length === 1 && geloescht[0].kennung === URSACHE, geloescht);

  /* ---------- 7 So ist es jetzt richtig ---------- */
  await p.waitForSelector('.abweichung-satz');
  const vorher = await p.evaluate(() => Huelle.verwaltung.gruppen().flatMap(g => g.drehbuecher.map(d => d.kennung)));
  if (!(await p.locator('.abweichung-liste').count())) await p.click('.abweichung-satz');
  const einer = vorher[0];
  const dateiVorher = readFileSync(path.join(SOLL, einer + '.json'), 'utf8');
  await p.click(`.abweichung-liste li[data-drehbuch="${einer}"] button.richtig`);
  await p.waitForFunction(k => Huelle.verwaltung.fertig() && !Huelle.verwaltung.gruppen().some(g => g.drehbuecher.some(d => d.kennung === k)), einer, { timeout: 60000 });
  pruefe('Ein Szenario: Abweichung ist weg, Rest bleibt', (await p.evaluate(() => Huelle.verwaltung.gruppen().flatMap(g => g.drehbuecher).length)) === vorher.length - 1);
  pruefe('Ein Szenario: Sollergebnis-Datei ist neu', readFileSync(path.join(SOLL, einer + '.json'), 'utf8') !== dateiVorher);
  if (vorher.length > 1) await p.click('.abweichung .knopfzeile button.richtig');
  await p.waitForFunction(() => Huelle.verwaltung.fertig() && !Huelle.verwaltung.gruppen().length, null, { timeout: 60000 });
  pruefe('Alle aus dieser Ursache: Zähler ist weg', !(await p.isVisible('#abweichKnopf')));
  pruefe('Alle aus dieser Ursache: Spalte zeigt keine leere Liste', !(await p.isVisible('#abweichungen')));
  await bild('7-abgearbeitet');
  await p.reload();
  await bereit();
  pruefe('Nach dem Neuladen bleibt es abgearbeitet', !(await p.isVisible('#abweichKnopf')));

  /* Das gespielte Drehbuch trägt eine alte Kopie seines Endstands; es gilt das Sollergebnis. */
  await p.selectOption('#wahl', 'gespielt-001');
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 120000 });
  /* Seit 006: gespielt-001 endet mit dem echten Befund zur Ladegruppe bei XC 810 (PO 07.11.: als Meldung erwarten). */
  pruefe('Gespieltes Szenario ist nach der Übernahme nicht rot, nennt aber den Regelverstoß',
    !(await p.getAttribute('#ergebnis', 'class')).includes('rot') && (await p.textContent('#ergebnis')).includes('Endet mit 1 Regelverstoß'), await p.textContent('#ergebnis'));
  await bereit();

  /* ---------- 8 Vorspielen: die Drehbücher, in denen das Plugin etwas tut, nacheinander ----------
     Bis 07.11. spielte „Vorspielen“ alle berührten Drehbücher (auch solche, in denen das Plugin nur mitzeichnet).
     Seit der Anweisung des PO vom 07.11. (15:35, Punkt 6) nur die, in denen es etwas tut. */
  if (!(await p.isVisible('#leiste'))) await p.click('#pluginKnopf');
  const folge = await p.evaluate(() => Huelle.verwaltung.eintraege().filter(e => e.an)
    .map(e => ({ k: e.kennung, name: e.name, n: (Huelle.verwaltung.drehbuecherVon(e.kennung) || []).map(d => d.kennung) }))
    .filter(e => e.n.length >= 2).sort((a, b) => a.n.length - b.n.length)[0]);
  await p.click('#tempo button[data-wert="4"]');
  const gesehen = p.evaluate(n => new Promise(fertig => {
    const zahlen = new Set(), drehbuecher = new Set();
    const uhr = setInterval(() => {
      const t = document.querySelector('#folge');
      if (!t.hidden) { zahlen.add(t.textContent); drehbuecher.add(document.querySelector('#wahl').value); }
      if (zahlen.size === n && t.hidden) { clearInterval(uhr); fertig({ zahlen: [...zahlen], drehbuecher: [...drehbuecher] }); }
    }, 100);
  }), folge.n.length);
  await knopfVon(folge.k, 'vorspielen').click();
  const lauf = await gesehen;
  pruefe('Vorspielen spielt die Szenarien, in denen das Plugin etwas tut', lauf.drehbuecher.length === folge.n.length && folge.n.every(k => lauf.drehbuecher.includes(k)), { folge, lauf });
  pruefe('Vorspielen zeigt, wo es steht', lauf.zahlen[0] === `${folge.name}: Szenario 1 von ${folge.n.length}`, lauf.zahlen);
  await bereit();

  /* Echte Abweichung: geänderte Datei → Ursache unbekannt, Satz fachlich */
  const k = 'krankmeldung-ma-01';
  const inhalt = JSON.parse(readFileSync(path.join(SOLL, k + '.json'), 'utf8'));
  inhalt.je[inhalt.zuletzt].zustand.auftraege['XC810-BELA-01'].mitarbeiter = 'MA-01';
  writeFileSync(path.join(SOLL, k + '.json'), JSON.stringify(inhalt));
  await p.reload();
  await bereit();
  const echt = await gruppen();
  pruefe('Fachliche Abweichung bekommt einen fachlichen Satz', echt.length === 1 && /liegt jetzt/.test(echt[0].saetze[0]), echt);
  console.log('     ' + echt[0]?.saetze[0]);

  /* ---------- 9 Doppelklick ---------- */
  const f = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  f.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  await f.goto('file:///' + path.resolve(HIER, '..', 'index.html').replace(/\\/g, '/'));
  await f.waitForFunction(() => window.Huelle?.geladen);
  await f.click('#pluginKnopf');
  pruefe('Doppelklick: Leiste nennt den Weg', (await f.textContent('#leisteHinweis')).includes('Play starten'));
  pruefe('Doppelklick: keine Schalter', (await f.locator('button.schalter').count()) === 0);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
