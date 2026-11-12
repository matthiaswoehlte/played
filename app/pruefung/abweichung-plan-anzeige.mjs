/* Prüft die Abweichungssätze nach dem PO (07.11.2026 abends):
   (1) je Drehbuch, was sich geändert hat, mit Flug, Arbeit und Person, nicht als Zähler;
   (2) gut sichtbar, ob der Plan betroffen ist oder nur die Anzeige;
   (3) der Weg: Folge des Wunsches → „So ist es jetzt richtig“, sonst „Stimmt nicht“ am Plugin, vorbefüllt;
   und: Ein Wunsch, der nur die Anzeige ändert, erscheint nicht als Abweichung, sondern als ein Satz.
   KI als Attrappe mit festen Antworten, auf Kopien. Aufruf: node pruefung/abweichung-plan-anzeige.mjs [bilder] */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const BILDER = process.argv[2] || null;

const antwort = felder => ({ rueckfrage: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], regel: null, erwartungen: [], ...felder });
/* Nur Anzeige: markiert XC 810 Entladen im Tagesplan zusätzlich (zeichnet nur, setzt nichts) */
const MARKE = antwort({ art: 'neu', kennung: 'probe-marke', name: 'Probe: Marke an XC 810 Entladen', kurz: 'XC 810 Entladen bekommt eine Marke.',
  plugin: `Huelle.plugin({ kennung: "probe-marke", titel: "Probe: Marke an XC 810 Entladen", ergaenzt: { gantt: { zeichne: function (el, h) {
    el.querySelectorAll('.pl-bahn .pl-balken[data-pfad^="auftraege/XC810-ENTL-"]').forEach(function (b) {
      b.insertAdjacentHTML("beforeend", '<i class="probe-marke" data-pfad="' + b.getAttribute("data-pfad") + '"></i>'); }); } } } });` });
/* Plan: bei der Krankmeldung MA-01 endet XB 933 Betanken 10 Minuten später */
const SPAETER = antwort({ art: 'neu', kennung: 'probe-spaeter', name: 'Probe: Betanken länger', kurz: 'XB 933 Betanken dauert bei Krankmeldung länger.',
  plugin: `Huelle.plugin({ kennung: "probe-spaeter", titel: "Probe: Betanken länger", abonniert: {
    "mitarbeiter/MA-01.krankmeldung": function (m, h) { h.sende({ objekt: "auftraege/XB933-TANK-01", aktion: "zeitaendern", parameter: { kante: "ende", zeit: h.zeit(h.minuten(h.lies("auftraege/XB933-TANK-01/ende")) + 10) } }); } } });` });

const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json');
writeFileSync(ATTRAPPE, JSON.stringify([MARKE, SPAETER]));
const { adresse } = await eigeneBruecke(4362, { mitKopie: true, attrappe: ATTRAPPE });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 900) : ''}`);
}
const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });
const meldung = async text => (await p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 120000 })).textContent();
/* Unter Last (voller Lauf, mehrere Prüfungen gleichzeitig) beginnt das Nachmessen später; darum länger auf den Beginn warten. */
async function neuGemessen() {
  await p.waitForFunction(() => !Huelle.verwaltung.fertig(), null, { timeout: 60000 }).catch(() => {});
  await bereit();
}
/* Auf eine NEUE Meldung „Fertig:“ warten; die vom vorigen Wunsch steht sonst noch da und täuscht ein Ende vor. */
const fertigMeldungen = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].filter(m => m.textContent.includes('Fertig:')).length);
async function wunsch(text) {
  const vorher = await fertigMeldungen();
  await p.fill('#wunschFeld', text);
  await p.click('#wunsch button');
  await p.waitForFunction(n => [...document.querySelectorAll('#meldungen .meldung')].filter(m => m.textContent.includes('Fertig:')).length > n, vorher, { timeout: 120000 });
  await neuGemessen();
}
const gruppen = () => p.evaluate(() => Huelle.verwaltung.gruppen().map(g => ({ ebene: g.ebene, u: g.ursache, d: g.drehbuecher.map(d => ({ k: d.kennung, saetze: d.saetze })) })));
const bild = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png') }); };
const ZAEHLER = /\d+ (Einträge|Konflikte markiert)/;

try {
  await p.goto(adresse);
  await bereit();
  const vorher = await gruppen();
  pruefe('Kein Satz am Bestand ist ein Zähler', vorher.every(g => g.d.every(d => d.saetze.every(s => !ZAEHLER.test(s)))), vorher);
  pruefe('Am Bestand des PO betrifft keine Abweichung den Plan', vorher.every(g => g.ebene === 'anzeige'), vorher);
  const nurVorher = await p.evaluate(() => Huelle.verwaltung.nurAnzeige().map(w => w.kennung));
  /* Bis 07.11. abends wichen Drehbücher wegen Overlay und rotem Rand in der Anzeige ab, und beide galten als
     „ändert nur die Anzeige“. Seit der PO diese Endstände mit „So ist es jetzt richtig“ übernommen hat, weicht
     nichts mehr ab; geprüft wird nur noch, dass beide nicht als Abweichung erscheinen. Den Fall „nur Anzeige“
     prüft Teil 1 mit einem eigenen Wunsch. */
  pruefe('Overlay und roter Rand: keine Abweichung', !vorher.some(g => ['balken-overlay', 'konflikt-rand'].includes(g.u.kennung)), { nurVorher, vorher });
  pruefe('„Balken zurück in die Liste“ kann den Plan ändern, gilt nicht als nur Anzeige', !nurVorher.includes('balken-zuruecklegen'), nurVorher);

  /* ---------- 1 Wunsch nur für die Anzeige ---------- */
  await wunsch('XC 810 Entladen soll im Tagesplan eine Marke bekommen.');
  const g1 = await gruppen();
  const nur1 = await p.evaluate(() => Huelle.verwaltung.nurAnzeige().map(w => w.kennung));
  pruefe('Anzeige-Wunsch: erscheint als „ändert nur die Anzeige“', nur1.includes('probe-marke'), nur1);
  pruefe('… und nicht als Abweichung', !g1.some(g => g.u.kennung === 'probe-marke'), g1);
  await p.click('#pluginKnopf').catch(() => {});
  const karte = await p.textContent('[data-plugin="probe-marke"]');
  pruefe('Am Plugin steht „Dein Wunsch ändert nur die Anzeige.“ und das Abzeichen', karte.includes('Dein Wunsch ändert nur die Anzeige.') && karte.includes('nur Anzeige'), karte);

  /* ---------- 2 Wunsch, der den Plan ändert ---------- */
  await wunsch('Bei Krankmeldung von MA-01 soll XB 933 Betanken 10 Minuten länger dauern.');
  const g2 = await gruppen();
  const plan = g2.find(g => g.ebene === 'plan' && g.u.kennung === 'probe-spaeter');
  pruefe('Plan-Abweichung mit dem Wunsch als Ursache', !!plan, g2);
  const km = plan?.d.find(d => d.k === 'krankmeldung-ma-01');
  pruefe('Satz nennt Flug, Arbeit, Person und Zeit', km?.saetze.some(s => /^XB 933 Betanken \(.+\) endet jetzt um \d\d:\d\d statt um \d\d:\d\d$/.test(s)), km);
  pruefe('Kein Zähler in den Sätzen', g2.every(g => g.d.every(d => d.saetze.every(s => !ZAEHLER.test(s)))), g2);
  pruefe('Plan steht vor Anzeige', g2.findIndex(g => g.ebene === 'plan') < Math.max(0, g2.findIndex(g => g.ebene === 'anzeige')) || !g2.some(g => g.ebene === 'anzeige'), g2.map(g => g.ebene));

  await p.click('#abweichKnopf');
  const kasten = p.locator('.abweichung[data-ursache="probe-spaeter"][data-ebene="plan"]');
  pruefe('Kasten trägt sichtbar „Plan“', (await kasten.locator('.abweichung-ebene').textContent()) === 'Plan');
  const kastenText = await kasten.textContent();
  pruefe('Weg in einem Satz: „So ist es jetzt richtig“, sonst „Stimmt nicht“', kastenText.includes('Ist das die Folge deines Wunsches') && kastenText.includes('„Stimmt nicht“'), kastenText);
  const zeile = kasten.locator('li[data-drehbuch="krankmeldung-ma-01"]');
  pruefe('Je Szenario: „So ist es jetzt richtig“ und „Stimmt nicht“', await zeile.locator('button.richtig').count() === 1 && await zeile.locator('button.stimmt-nicht').count() === 1);
  await bild('1-abweichungen');

  /* „Stimmt nicht“ öffnet das Plugin mit dem Satz */
  await zeile.locator('button.stimmt-nicht').click();
  const feld = p.locator('[data-plugin="probe-spaeter"] .plugin-ki.stimmt-nicht textarea');
  const vor = await feld.inputValue();
  pruefe('„Stimmt nicht“ am Plugin, vorbefüllt mit dem Satz', vor.startsWith('Im Szenario „Krankmeldung MA-01 ab 08:00“: XB 933 Betanken') && vor.endsWith('Das soll nicht so sein: ') &&
    (await p.evaluate(() => document.activeElement?.tagName)) === 'TEXTAREA', vor);
  await bild('2-stimmt-nicht');

  /* „So ist es jetzt richtig“ übernimmt; danach weicht dort nichts mehr im Plan ab */
  await p.click('#abweichKnopf').catch(() => {});
  if (!(await p.isVisible('.abweichung[data-ursache="probe-spaeter"]'))) await p.click('#abweichKnopf');
  await p.locator('.abweichung[data-ursache="probe-spaeter"] li[data-drehbuch="krankmeldung-ma-01"] button.richtig').click();
  await neuGemessen();
  const g3 = await gruppen();
  pruefe('Nach „So ist es jetzt richtig“: dort keine Plan-Abweichung mehr', !g3.some(g => g.ebene === 'plan' && g.d.some(d => d.k === 'krankmeldung-ma-01')), g3);

  /* ---------- 3 Ende eines Durchlaufs ---------- */
  await p.selectOption('#wahl', 'wunsch-001');
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#play');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
  const ende = await p.textContent('#ergebnisText');
  pruefe('Ende des Durchlaufs: kein Zähler, Anzeige-Wunsch als ein Satz', !ZAEHLER.test(ende) && !ende.startsWith('Anders als zuletzt gesehen'), ende);
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
}
await browser.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
