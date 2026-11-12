/* Prüft Stufe 2 aus Auftrag 004: Ändern und „Stimmt nicht“ an einem Plugin, Fassungen,
   „Zurück zur vorigen Fassung“, und dass die Brücke ein vorhandenes Plugin nie komplett neu annimmt.
   Die KI ist hier eine Attrappe mit festen Antworten; der echte Weg über das Abo ist derselbe.
   Läuft auf einer Kopie der Plugins und Sollergebnisse. Aufruf: node pruefung/aendern-und-korrigieren.mjs */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const quelle = k => readFileSync(path.join(HIER, 'vorlage', 'plugins', 'bausteine', k, 'fassung-001.js'), 'utf8');
const antwort = felder => ({ rueckfrage: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], ...felder });

const ATTRAPPE = path.join(mkdtempSync(path.join(os.tmpdir(), 'play-ki-')), 'antworten.json');
writeFileSync(ATTRAPPE, JSON.stringify([
  /* 1 Ändern am Konfliktrand: Rand golden statt rot */
  antwort({ art: 'aendern', kennung: 'konflikt-rand', name: 'Goldener Rand bei Überlappung', kurz: 'Der Rand ist jetzt golden.',
    aenderungen: [{ alt: 'border: 2px solid var(--koralle); border-radius: 4px;', neu: 'border: 2px solid var(--gold); border-radius: 4px;' }] }),
  /* 2 „Stimmt nicht“ am Versatz: erst verbotene Komplettlieferung, dann gezielt */
  antwort({ art: 'aendern', kennung: 'balken-versatz', name: 'Versatz', kurz: 'Neu geschrieben.', plugin: quelle('balken-versatz') }),
  antwort({ art: 'aendern', kennung: 'balken-versatz', name: 'Versatz', kurz: 'Die Balken decken sich jetzt um die Hälfte.',
    aenderungen: [{ alt: 'var VERSATZ = 12;', neu: 'var VERSATZ = 9;' }] }),
  /* 3 Wunsch, der ein vorhandenes Plugin als neues liefert: zweimal, danach gescheitert */
  antwort({ art: 'neu', kennung: 'gantt', name: 'Tagesplan', kurz: 'Neu.', plugin: 'Huelle.plugin({ kennung: "gantt" });' }),
  antwort({ art: 'neu', kennung: 'gantt', name: 'Tagesplan', kurz: 'Neu.', plugin: 'Huelle.plugin({ kennung: "gantt" });' }),
  /* 4 Wunsch als neues kleines Plugin */
  antwort({ art: 'neu', kennung: 'balken-fett', name: 'Flugnummer fett', kurz: 'Die Flugnummer im Balken ist jetzt fett.',
    plugin: 'Huelle.plugin({ kennung: "balken-fett", titel: "Flugnummer fett", stil: ".pl-balken span { font-weight: 700; }" });' }),
  /* 5 Ändern an der Grundausstattung */
  antwort({ art: 'aendern', kennung: 'nicht-zugewiesen', name: 'Offene Aufträge', kurz: 'Die Liste heißt jetzt „Offene Aufträge“.',
    aenderungen: [{ alt: '"<h2>Nicht zugewiesene Aufträge <span', neu: '"<h2>Offene Aufträge <span' }] }),
]));

const { adresse, plugindaten } = await eigeneBruecke(4330, { mitKopie: true, attrappe: ATTRAPPE });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const herkunft = k => JSON.parse(readFileSync(path.join(BAUSTEINE, k, 'herkunft.json'), 'utf8'));

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const eintrag = k => p.locator(`[data-plugin="${k}"]`);
const meldung = text => p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 60000 });
const randFarbe = () => p.evaluate(() => getComputedStyle(document.querySelector('.pl-konfliktrand')).borderTopColor);
const farbe = name => p.evaluate(n => { const e = document.createElement('i'); e.style.color = `var(${n})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }, name);

async function sage(kennung, art, text) {
  const feld = eintrag(kennung).locator(`details.plugin-ki.${art}`);
  await feld.locator('summary').click();
  await feld.locator('textarea').fill(text);
  await feld.locator('button[type="submit"]').click();
}

try {
  await p.goto(adresse);
  await bereit();
  await p.click('#pluginKnopf');
  const rot = await randFarbe();

  /* ---------- Ändern ---------- */
  await sage('konflikt-rand', 'aendern', 'Der Rand soll golden sein, nicht rot.');
  await meldung('Geändert: Der Rand ist jetzt golden.');
  pruefe('Ändern: dasselbe Plugin, neue Fassung', herkunft('konflikt-rand').aktuell === 2 && existsSync(path.join(BAUSTEINE, 'konflikt-rand', 'fassung-002.js')));
  pruefe('Ändern: kein neues Plugin daneben', !existsSync(path.join(BAUSTEINE, 'goldener-rand-bei-ueberlappung')));
  pruefe('Ändern: Satz im Wortlaut an der Fassung', herkunft('konflikt-rand').fassungen[1].wortlaut === 'Der Rand soll golden sein, nicht rot.');
  pruefe('Ändern: wirkt sofort in der offenen Seite', (await randFarbe()) === await farbe('--gold'), await randFarbe());
  await bereit();
  pruefe('Ändern: Leiste zeigt die Fassung', (await eintrag('konflikt-rand').locator('.plugin-fassungen summary').textContent()) === 'Fassung 2 von 2');
  await p.click('#meldungen .meldung:has-text("Geändert") button:text("Vorspielen")');
  pruefe('Ändern: Vorspielen läuft', (await p.textContent('#play')) === 'Pause');
  await p.click('#tempo button[data-wert="4"]');
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 120000 });

  /* ---------- Stimmt nicht, direkt nach dem Durchlauf ---------- */
  let gesendet = null;
  p.on('request', r => { if (r.url().endsWith('/plugin/balken-versatz/stimmt-nicht')) gesendet = r.postDataJSON(); });
  await bereit();
  await sage('balken-versatz', 'stimmt-nicht', 'Die Balken decken sich zu wenig.');
  await meldung('Korrigiert: Die Balken decken sich jetzt um die Hälfte.');
  pruefe('Stimmt nicht: der gesehene Ablauf geht mit', !!gesendet?.beobachtet && gesendet.beobachtet.includes('Szenario:') && /\d\d:\d\d /.test(gesendet.beobachtet), gesendet);
  const versatz = herkunft('balken-versatz');
  pruefe('Stimmt nicht: Komplettlieferung abgelehnt, gezielte Änderung übernommen',
    versatz.aktuell === 2 && readFileSync(path.join(BAUSTEINE, 'balken-versatz', 'fassung-002.js'), 'utf8').includes('var VERSATZ = 9;'));
  pruefe('Stimmt nicht: Fassung trägt die Art', versatz.fassungen[1].art === 'stimmt-nicht' && versatz.fassungen[1].wortlaut === 'Die Balken decken sich zu wenig.');

  /* ---------- Zurück zur vorigen Fassung ---------- */
  await bereit();
  await Promise.all([p.waitForEvent('load'), eintrag('konflikt-rand').locator('button.zurueck').click()]);
  await bereit();
  pruefe('Zurück: ein Klick, alte Fassung gilt', herkunft('konflikt-rand').aktuell === 1 && (await randFarbe()) === rot, await randFarbe());
  pruefe('Zurück: die Fassung bleibt in der Liste', herkunft('konflikt-rand').fassungen.length === 2);
  await eintrag('konflikt-rand').locator('.plugin-fassungen summary').click();
  pruefe('Zurück: Leiste zeigt die verworfene Fassung', (await eintrag('konflikt-rand').locator('li.verworfen').count()) === 1);

  /* ---------- Wunsch: vorhandenes Plugin als neues → abgelehnt ---------- */
  /* Seit deinem Wunsch 020 (Zeitlinie, 07.11.) hat der Tagesplan eine eigene Fassung im Ordner; geprüft wird,
     dass keine weitere dazukommt (vorher: dass es den Ordner gar nicht gibt). */
  const ganttVorher = existsSync(path.join(BAUSTEINE, 'gantt')) ? readdirSync(path.join(BAUSTEINE, 'gantt')).sort().join() : null;
  await p.fill('#wunschFeld', 'Den Tagesplan bitte ganz neu.');
  await p.click('#wunsch button');
  await meldung('Das ließ sich nicht umsetzen');
  const ganttNachher = existsSync(path.join(BAUSTEINE, 'gantt')) ? readdirSync(path.join(BAUSTEINE, 'gantt')).sort().join() : null;
  pruefe('Wunsch: Plugin „gantt“ blieb unverändert', ganttNachher === ganttVorher && (await p.locator('.pl-balken').count()) > 10, { ganttVorher, ganttNachher });

  /* ---------- Wunsch: neues kleines Plugin ---------- */
  await p.fill('#wunschFeld', 'Die Flugnummer im Balken bitte fett.');
  await p.click('#wunsch button');
  await meldung('Fertig: Die Flugnummer im Balken ist jetzt fett.');
  const neu = herkunft('balken-fett');
  pruefe('Wunsch: eigenes kleines Plugin mit Wortlaut', neu.wuensche[0].wortlaut === 'Die Flugnummer im Balken bitte fett.' && neu.aktuell === 1);
  pruefe('Wunsch: wirkt', (await p.evaluate(() => getComputedStyle(document.querySelector('.pl-balken span')).fontWeight)) === '700');
  /* Die Leiste kennt das neue Plugin erst, wenn die neue Messung den Stand geladen hat. Seit die Drehbücher
     gleichzeitig laufen, ist die vorige Messung oft schon fertig, bevor der Wunsch kommt: bereit() allein
     wartet dann nicht mehr. */
  await eintrag('balken-fett').waitFor({ timeout: 30000 }).catch(() => {});
  await bereit();
  pruefe('Wunsch: steht in der Leiste', await eintrag('balken-fett').isVisible());

  /* ---------- Ändern an der Grundausstattung, dann zurück ---------- */
  await sage('nicht-zugewiesen', 'aendern', 'Die Liste soll „Offene Aufträge“ heißen.');
  await meldung('Geändert: Die Liste heißt jetzt');
  pruefe('Grundausstattung: neue Fassung neben der Datei', herkunft('nicht-zugewiesen').aktuell === 2 && (await p.textContent('[data-sicht="nicht-zugewiesen"] h2')).startsWith('Offene Aufträge'));
  await bereit();
  await Promise.all([p.waitForEvent('load'), eintrag('nicht-zugewiesen').locator('button.zurueck').click()]);
  await bereit();
  pruefe('Grundausstattung: zurück auf die Datei', (await p.textContent('[data-sicht="nicht-zugewiesen"] h2')).startsWith('Nicht zugewiesene Aufträge'));
  const uebrig = await p.evaluate(() => Huelle.verwaltung.gruppen().map(g => g.ursache.kennung));
  pruefe('Nach allem: nur die alte Ursache Konfliktrand, nichts Neues', uebrig.every(k => k === 'konflikt-rand'), uebrig);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
