/* Prüft Anweisung 44 auf einer Wegwerf-Kopie von Play aus der Testvorlage (Anweisung 51 b): Prototyp beginnen, Bereich leeren, Prototyp
   beginnen. Danach ist alles wie vor dem ersten Prototyp, bis auf eine Zeile in der Herkunft und die Sicherung. Am Ende
   die Personaldisposition: Dort fragt Play zweimal; „Abbrechen“ beim zweiten Mal lässt alles, wie es ist.
   Die KI ist eine Attrappe. Aufruf: node pruefung/bereich-leeren.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vorlageKopie } from './vorlage-kopie.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(HIER, '..');
const require = createRequire(path.resolve(PLAY, '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const PORT = 4371;

let fehler = 0;
const pruefe = (name, ok, zusatz) => { if (!ok) fehler++; console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 500) : ''}`); };
const schritt = (t) => console.log(`-- ${t}`);

/* Wegwerf-Kopie aus Code und Testvorlage (Anweisung 51 b), nie aus der Dispo des PO; geöffnet ist der Navigator.
   In der Vorlage hat die Gerätedisposition noch keinen Prototyp. */
schritt('Kopie anlegen');
const { wurzel, play: KOPIE } = vorlageKopie('play-leeren-');
writeFileSync(path.join(KOPIE, 'projekte', 'zuletzt.json'), JSON.stringify({ projekt: 'netz-navigator' }));
const ATTRAPPE = path.join(wurzel, 'antworten.json');
const prototyp = {
  rueckfrage: null, anzahlPlugins: 1,
  fachobjekte: [{ wurzel: 'geraete', name: 'Geräte', einer: 'eines Geräts', felder: [{ feld: 'name', wort: 'den Namen' }] }],
  daten: JSON.stringify({ geraete: { 'G-1': { kennung: 'G-1', name: 'Schlepper 1' } } }),
  plugins: [{ kennung: 'geraete-liste', name: 'Geräteliste', kurz: 'Zeigt die Geräte.', satz: null,
    quelle: 'Huelle.plugin({ kennung: "geraete-liste", titel: "Geräteliste", ansicht: { ort: "haupt", zeichne: function (el, h) { el.textContent = h.alle("geraete").map(function (g) { return g.name; }).join(", "); } } });' }],
  drehbuch: 'Huelle.drehbuch({ kennung: "{{auftrag}}", titel: "Geräte ansehen", ereignisse: [] });',
};
writeFileSync(ATTRAPPE, JSON.stringify([prototyp]));

/* Fingerabdruck der Dispo; was „Bereich leeren“ bewusst hinterlässt oder was Play nur nachrechnet, zählt nicht. */
const TEILE = ['manifest.js', 'projekt.json', 'daten', 'plugins', 'regeln', 'drehbuecher', 'sollergebnisse', 'entscheidungen', 'gearbeitet.json', 'grundfunktionen.json'];
const OHNE = new Set(['entscheidungen/geleert.json', 'entscheidungen/teilapps.json']);
function abdruck() {
  const h = createHash('sha256'), liste = [];
  const geh = (rel) => {
    const voll = path.join(KOPIE, rel);
    if (!existsSync(voll)) return;
    if (statSync(voll).isDirectory()) { readdirSync(voll).sort().forEach(n => geh(`${rel}/${n}`)); return; }
    if (OHNE.has(rel)) return;
    liste.push(rel); h.update(rel).update(readFileSync(voll));
  };
  TEILE.forEach(geh);
  return { summe: h.digest('hex'), liste };
}
const unterschied = (a, b) => [...a.liste.filter(x => !b.liste.includes(x)).map(x => `weg: ${x}`), ...b.liste.filter(x => !a.liste.includes(x)).map(x => `neu: ${x}`)];

schritt('Play auf der Kopie starten');
const kind = spawn(process.execPath, [path.join(KOPIE, 'server', 'start.mjs'), '--ohne-browser'], {
  env: { ...process.env, PLAY_PORT: String(PORT), PLAY_KI_ATTRAPPE: ATTRAPPE, PLAY_WUENSCHE_AN_PLAY: path.join(wurzel, 'an-play.md') }, stdio: ['ignore', 'pipe', 'pipe'],
});
let ausgabe = '';
kind.stdout.on('data', d => { ausgabe += d; });
kind.stderr.on('data', d => { ausgabe += d; });
const ADRESSE = `http://127.0.0.1:${PORT}`;
for (let t = Date.now(); ; ) {
  try { await fetch(`${ADRESSE}/projekte`); break; } catch { if (Date.now() - t > 30000) throw new Error('Play startet nicht'); await new Promise(r => setTimeout(r, 300)); }
}
const post = async (weg, inhalt) => { const r = await fetch(ADRESSE + weg, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ADRESSE }, body: JSON.stringify(inhalt) }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };

async function prototypBeginnen(nr) {
  schritt(`Prototyp beginnen (${nr}. Mal)`);
  pruefe('Der Navigator bittet, Play öffnet die Dispo', (await post('/prototyp-vormerken', { bereich: 'geraete' })).ok);
  const a = await post('/prototyp/geraete', { text: 'Eine Liste der Geräte.' });
  let s = a.d;
  for (let t = Date.now(); !['behalten', 'fehlgeschlagen', 'rueckfrage'].includes(s.status) && Date.now() - t < 60000; await new Promise(r => setTimeout(r, 300))) s = await (await fetch(`${ADRESSE}/wunsch/${a.d.id}`)).json();
  pruefe('Der Prototyp ist angelegt', s.status === 'behalten' && existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'geraete-liste')) && existsSync(path.join(KOPIE, 'daten', 'bereiche', 'geraete.js')), { status: s.status, grund: s.grund });
  await post('/projekt', { kennung: 'netz-navigator' });
}

const browser = await chromium.launch();
try {
  const vorher = abdruck();
  await prototypBeginnen(1);
  /* Anweisung 45 (d): Ein Wunsch aus der Gerätedisposition hat ein Plugin der Personaldisposition geändert. Nachgestellt wie
     von Play beim Einspielen geschrieben: neue Fassung mit `teilApp` an der Fassung. */
  const fremdOrdner = path.join(KOPIE, 'plugins', 'bausteine', 'vergangenheit-grau');
  const fremdH = JSON.parse(readFileSync(path.join(fremdOrdner, 'herkunft.json'), 'utf8'));
  const fremdNr = Math.max(...fremdH.fassungen.map(f => f.nr)) + 1, fremdDatei = `fassung-${String(fremdNr).padStart(3, '0')}.js`;
  writeFileSync(path.join(fremdOrdner, fremdDatei), readFileSync(path.join(fremdOrdner, `fassung-${String(fremdH.aktuell).padStart(3, '0')}.js`), 'utf8').replace('Huelle.plugin(', '/* aus der Gerätedisposition */\nHuelle.plugin('));
  fremdH.fassungen.push({ nr: fremdNr, vorige: fremdH.aktuell, art: 'aendern', wunsch: 'wunsch-901', teilApp: 'geraete', wortlaut: 'Vergangenheit heller.', datum: new Date().toISOString(), kurz: 'heller', drehbuch: null });
  fremdH.wuensche.push({ kennung: 'wunsch-901', name: 'heller', wortlaut: 'Vergangenheit heller.', datum: new Date().toISOString() });
  fremdH.aktuell = fremdNr;
  writeFileSync(path.join(fremdOrdner, 'herkunft.json'), `${JSON.stringify(fremdH, null, 2)}\n`);
  const mitPrototyp = abdruck();
  pruefe('Der Prototyp hat Dateien angelegt', mitPrototyp.summe !== vorher.summe);

  schritt('Bereich leeren: Gerätedisposition');
  const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  const fragen = [];
  let antworten = [];
  p.on('dialog', d => { fragen.push(d.message()); (antworten.shift() ?? true) ? d.accept() : d.dismiss(); });
  const navigator = async () => {
    await p.goto(ADRESSE);
    await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#titel')?.textContent === 'Netz-Navigator', null, { timeout: 90000 });
    await p.click('[data-pfad="bereiche/disposition-ordner"]');
    await p.waitForSelector('[data-pfad="bereiche/geraete"]', { timeout: 10000 });
  };
  await navigator();
  pruefe('An der Teil-App mit Prototyp steht „Bereich leeren“', await p.isVisible('[data-leeren="geraete"]'));
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('[data-leeren="geraete"]')]);
  pruefe('Play fragt einmal, in einem Satz', fragen.length === 1 && fragen[0] === 'Alles in „Gerätedisposition“ wird gelöscht, die anderen Bereiche bleiben, wie sie sind.', fragen);
  const geleert = abdruck();
  pruefe('Danach ist alles wie vor dem ersten „Prototyp beginnen“', geleert.summe === vorher.summe, unterschied(vorher, geleert));
  const zeilen = JSON.parse(readFileSync(path.join(KOPIE, 'entscheidungen', 'geleert.json'), 'utf8'));
  const sicherung = path.join(KOPIE, zeilen.at(-1)?.sicherung ?? 'fehlt');
  pruefe('Eine Sicherung mit dem Stand davor liegt bereit', existsSync(path.join(sicherung, 'plugins', 'bausteine', 'geraete-liste')) && existsSync(path.join(sicherung, 'daten', 'bereiche', 'geraete.js')), sicherung);
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#titel')?.textContent === 'Netz-Navigator', null, { timeout: 90000 });
  await p.click('[data-pfad="bereiche/disposition-ordner"]');
  await p.waitForSelector('[data-pfad="bereiche/geraete"]', { timeout: 10000 });
  pruefe('Der Kasten ist wieder leer mit „Prototyp beginnen“', await p.isVisible('[data-prototyp="geraete"]') && !(await p.isVisible('[data-leeren="geraete"]')));
  await p.click('[data-pfad="bereiche/geraete"]');
  await p.waitForSelector('.nv-geleert', { timeout: 10000 }).catch(() => null);
  const zeile = await p.textContent('.nv-geleert').catch(() => '');
  pruefe('In der Herkunft bleibt eine Zeile mit Datum', /^Bereich „Gerätedisposition“ geleert am \d{2}\.\d{2}\.\d{4}$/.test(zeile ?? ''), zeile);
  pruefe('Die Fassung aus der Gerätedisposition am fremden Plugin ist mit zurückgenommen (45 d)', !existsSync(path.join(fremdOrdner, fremdDatei)) && JSON.parse(readFileSync(path.join(fremdOrdner, 'herkunft.json'), 'utf8')).aktuell === fremdNr - 1);

  schritt('Sicherung zurückholen (45 e)');
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#titel')?.textContent === 'Netz-Navigator', null, { timeout: 90000 });
  await p.click('.nv-sicherungen summary');
  const eintraege = await p.$$eval('.nv-sicherungen li', l => l.map(x => x.textContent.trim()));
  pruefe('Im Navigator steht die Sicherung mit Datum, Uhrzeit und Satz', eintraege.length === 1 && /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} vor dem Leeren von „Gerätedisposition“ Zurückholen$/.test(eintraege[0]), eintraege);
  fragen.length = 0;
  antworten = [false];
  await p.click('[data-zurueckholen]');
  await p.waitForTimeout(1000);
  pruefe('Play fragt vorher; „Abbrechen“ lässt alles, wie es ist', fragen.length === 1 && /^Den Stand vom .+ zurückholen\? Der jetzige Stand wird vorher gesichert\.$/.test(fragen[0]) && abdruck().summe === geleert.summe, fragen);
  fragen.length = 0;
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('[data-zurueckholen]')]);
  const zurueck = abdruck();
  pruefe('„Zurückholen“ stellt den gesicherten Stand wieder her', zurueck.summe === mitPrototyp.summe, unterschied(mitPrototyp, zurueck));
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#titel')?.textContent === 'Netz-Navigator', null, { timeout: 90000 });
  await p.click('.nv-sicherungen summary');
  const danach = await p.$$eval('.nv-sicherungen li', l => l.map(x => x.textContent.trim()));
  pruefe('Auch das Zurückholen ist gesichert und lässt sich zurückholen', danach.length === 2 && /vor dem Zurückholen der Sicherung vom \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/.test(danach[0]), danach);

  schritt('Wieder leeren, damit es weitergeht');
  await p.click('[data-pfad="bereiche/disposition-ordner"]');
  await p.waitForSelector('[data-leeren="geraete"]', { timeout: 10000 });
  antworten = [true];
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('[data-leeren="geraete"]')]);
  pruefe('Nach erneutem Leeren wieder wie vor dem ersten Prototyp', abdruck().summe === vorher.summe, unterschied(vorher, abdruck()));
  await p.waitForFunction(() => window.Huelle?.geladen && document.querySelector('#titel')?.textContent === 'Netz-Navigator', null, { timeout: 90000 });

  /* Die Prüfung schaltet das Projekt gleich direkt um; eine offene Seite würde dabei halb das eine, halb das andere laden. */
  await p.goto('about:blank');
  await prototypBeginnen(2);

  schritt('Personaldisposition: zweite Rückfrage');
  await navigator();
  const vorDispo = abdruck();
  antworten = [true, false];
  fragen.length = 0;
  await p.click('[data-leeren="disposition"]');
  await p.waitForTimeout(1500);
  pruefe('Play fragt zweimal und nennt den Grundstock', fragen.length === 2 && fragen[1].includes('Grundstock'), fragen);
  pruefe('„Abbrechen“ beim zweiten Mal lässt alles, wie es ist', abdruck().summe === vorDispo.summe);
  antworten = [true, true];
  fragen.length = 0;
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('[data-leeren="disposition"]')]);
  const manifest = readFileSync(path.join(KOPIE, 'manifest.js'), 'utf8');
  const tag = readFileSync(path.join(KOPIE, 'daten', 'tag.js'), 'utf8');
  pruefe('Grundstock und Wünsche der Personaldisposition sind weg', !/plugins\/[a-z-]+\.js/.test(manifest) && !existsSync(path.join(KOPIE, 'plugins', 'gantt.js')) && !existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'vergangenheit-grau')) && JSON.parse(readFileSync(path.join(KOPIE, 'grundfunktionen.json'), 'utf8')).length === 0);
  pruefe('Ihre Aufträge sind weg, Mitarbeiter und Flüge der anderen Bereiche bleiben', !/\bauftraege\s*:/.test(tag) && /\bmitarbeiter\s*:/.test(tag) && /\bfluege\s*:/.test(tag));
  pruefe('Die Gerätedisposition bleibt, wie sie ist', existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'geraete-liste')) && existsSync(path.join(KOPIE, 'daten', 'bereiche', 'geraete.js')));
  pruefe('Die Regel der Schichtplanung bleibt', existsSync(path.join(KOPIE, 'regeln', 'fremd-schichtplanung-zwei-auftraege.js')));
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
  console.log(ausgabe.slice(-1500));
} finally {
  await browser.close();
  kind.kill();
  rmSync(wurzel, { recursive: true, force: true });
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
