/* Prüft Anweisung 48: Ein Wunsch ändert nur die offene Teil-App, ihr Rahmen ist wünschbar, und der Probelauf vergleicht, was
   zu sehen ist. Wegwerf-Kopie von Play; Plugins, Szenarien und Regeln kommen aus der Testvorlage, die Gerätedisposition entsteht
   über eine KI-Attrappe. So bleibt die Prüfzeit gleich, wie viel der PO auch baut. Aufruf: node pruefung/sichtbar.mjs */
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(HIER, '..');
const VORLAGE = path.join(HIER, 'vorlage');
const require = createRequire(path.resolve(PLAY, '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const PORT = 4391;

let fehler = 0;
const pruefe = (name, ok, zusatz) => { if (!ok) fehler++; console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`); };
const schritt = (t) => console.log(`-- ${t}`);

schritt('Kopie anlegen: Play mit der Testvorlage, Gerätedisposition noch leer');
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'play-sichtbar-'));
const KOPIE = path.join(wurzel, 'prototype-ideas', 'play');
const VOM_PO = /^(sicherungen|pruefung|plugins[\\/](bausteine|papierkorb|archiv|wuensche|verwaltung\.json)|drehbuecher[\\/]gespielt|sollergebnisse|regeln|entscheidungen|projekte|daten[\\/]bereiche)([\\/]|$)|^(gearbeitet|stand-speicher|grundfunktionen)\.json$/;
cpSync(PLAY, KOPIE, { recursive: true, filter: q => !VOM_PO.test(path.relative(PLAY, q)) });
for (const t of ['plugins', 'drehbuecher', 'sollergebnisse', 'regeln', 'entscheidungen', 'grundfunktionen.json']) {
  if (existsSync(path.join(VORLAGE, t))) cpSync(path.join(VORLAGE, t), path.join(KOPIE, t), { recursive: true });
}
const projekt = JSON.parse(readFileSync(path.join(KOPIE, 'projekt.json'), 'utf8'));
const geh = (l) => (l || []).forEach(b => { if (b.kennung === 'geraete') { b.prototyp = false; b.fachobjekte = []; delete b.beispieldaten; } geh(b.kinder); });
geh(projekt.bereiche);
writeFileSync(path.join(KOPIE, 'projekt.json'), JSON.stringify(projekt, null, 2));

const antwort = felder => ({ anPlay: null, rueckfrage: null, teile: null, art: 'neu', kennung: 'x', name: 'x', kurz: 'x', plugin: null, aenderungen: [], drehbuch: null, zeigen: null, regel: null, erwartungen: [], grunddaten: [], grundfunktionen: [], volltext: [], alleDaten: false, sichtbar: true, ...felder });
const plugin = (kennung, stil) => antwort({ kennung, name: 'Rand', kurz: 'Reicht bis an den Rand.', plugin: `Huelle.plugin({ kennung: "${kennung}", titel: "Rand", stil: ${JSON.stringify(stil)} });` });
const ATTRAPPE = path.join(wurzel, 'antworten.json'), PROTOKOLL = path.join(wurzel, 'protokoll.jsonl');
writeFileSync(ATTRAPPE, JSON.stringify([
  {
    rueckfrage: null, anzahlPlugins: 1,
    fachobjekte: [{ wurzel: 'geraete', name: 'Geräte', einer: 'eines Geräts', felder: [{ feld: 'name', wort: 'den Namen' }] }],
    daten: JSON.stringify({ geraete: { 'G-1': { kennung: 'G-1', name: 'Schlepper 1' } } }),
    plugins: [{ kennung: 'geraete-liste', name: 'Geräteliste', kurz: 'Zeigt die Geräte.', satz: null,
      quelle: 'Huelle.plugin({ kennung: "geraete-liste", titel: "Geräteliste", ansicht: { ort: "haupt", zeichne: function (el, h) { el.innerHTML = "<h2>Geräte</h2>" + h.alle("geraete").map(function (g) { return "<div class=\\"pl-geraet\\">" + h.esc(g.name) + "</div>"; }).join(""); } } });' }],
    drehbuch: 'Huelle.drehbuch({ kennung: "{{auftrag}}", titel: "Geräte ansehen", ereignisse: [] });',
  },
  /* Wunsch 1: Die Regel greift nirgends, auch nicht nach den Nachbesserungen (Anweisung 58 c: zwei). */
  plugin('rand-eins', '.pl-gibt-es-nicht { width: 100%; }'),
  plugin('rand-eins', '.pl-gibt-es-auch-nicht { width: 100%; }'),
  plugin('rand-eins', '.pl-gibt-es-ebenso-nicht { width: 100%; }'),
  /* Wunsch 2: erst seitenweit (trifft die Personaldisposition), nach der Nachbesserung nur in der Gerätedisposition */
  plugin('rand-zwei', '[data-sicht] { letter-spacing: 1px; }'),
  plugin('rand-zwei', '#nutzbereich[data-teilapp="geraete"] [data-sicht] { letter-spacing: 1px; }'),
]));

schritt('Play auf der Kopie starten');
const kind = spawn(process.execPath, [path.join(KOPIE, 'server', 'start.mjs'), '--ohne-browser'], {
  env: { ...process.env, PLAY_PORT: String(PORT), PLAY_KI_ATTRAPPE: ATTRAPPE, PLAY_KI_PROTOKOLL: PROTOKOLL, PLAY_OHNE_SPEICHER: '1', PLAY_WUENSCHE_AN_PLAY: path.join(wurzel, 'an-play.md') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let ausgabe = '';
kind.stdout.on('data', d => { ausgabe += d; });
kind.stderr.on('data', d => { ausgabe += d; });
process.on('exit', () => { kind.kill(); try { rmSync(wurzel, { recursive: true, force: true }); } catch { /* Windows hält Dateien manchmal noch */ } });
const ADRESSE = `http://127.0.0.1:${PORT}`;
for (let t = Date.now(); ; ) {
  try { await fetch(`${ADRESSE}/projekte`); break; } catch { if (Date.now() - t > 30000) throw new Error('Play startet nicht'); await new Promise(r => setTimeout(r, 300)); }
}
const post = async (weg, inhalt) => { const r = await fetch(ADRESSE + weg, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ADRESSE }, body: JSON.stringify(inhalt) }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };
const protokoll = () => existsSync(PROTOKOLL) ? readFileSync(PROTOKOLL, 'utf8').trim().split('\n').filter(Boolean).map(z => JSON.parse(z)) : [];

const browser = await chromium.launch({ args: ['--site-per-process'] });
try {
  schritt('Prototyp der Gerätedisposition über die Attrappe');
  await post('/prototyp-vormerken', { bereich: 'geraete' });
  const a = await post('/prototyp/geraete', { text: 'Eine Liste der Geräte.' });
  let s = a.d;
  for (let t = Date.now(); !['behalten', 'fehlgeschlagen', 'rueckfrage'].includes(s.status) && Date.now() - t < 60000; await new Promise(r => setTimeout(r, 300))) s = await (await fetch(`${ADRESSE}/wunsch/${a.d.id}`)).json();
  pruefe('Die Gerätedisposition steht', s.status === 'behalten', { status: s.status, grund: s.grund });
  await post('/projekt', { kennung: 'bodenabfertigung/geraete' });

  const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
  const konsole = [];
  p.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
  const laden = async () => {
    await p.goto(ADRESSE);
    await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 120000 }).catch(async (e) => {
      console.log('     Konsole:', konsole.slice(-5).join(' | '), '· geladen:', await p.evaluate(() => !!window.Huelle?.geladen).catch(() => '?'));
      if (process.env.SCHIRM) await p.screenshot({ path: process.env.SCHIRM });
      throw e;
    });
  };
  const breiten = () => p.evaluate(() => {
    const m = (s) => { const e = document.querySelector(s); return e && e.getClientRects().length ? Math.round(e.getBoundingClientRect().width) : 0; };
    return { orte: m('#nutzbereich .orte'), haupt: m('[data-ort="haupt"]'), seite: m('[data-ort="seite"]'), teilapp: document.querySelector('#nutzbereich').dataset.teilapp };
  });

  schritt('Rahmen: ohne Inhalt in der rechten Spalte keine rechte Spalte (48 b)');
  await laden();
  const g = await breiten();
  pruefe('Gerätedisposition: keine rechte Spalte, die Fläche reicht bis an den Rand', g.teilapp === 'geraete' && g.seite === 0 && g.haupt === g.orte && g.orte > 1000, g);
  await post('/projekt', { kennung: 'bodenabfertigung/disposition' });
  await laden();
  const d = await breiten();
  pruefe('Personaldisposition: die rechte Spalte bleibt, weil dort Ansichten stehen', d.teilapp === 'disposition' && d.seite > 200 && d.haupt < d.orte, d);
  await post('/projekt', { kennung: 'bodenabfertigung/geraete' });
  await laden();

  const wunsch = async (text, ende) => {
    const vorher = protokoll().length;
    await p.fill('#wunschFeld', text);
    await p.click('#wunsch button');
    const zeile = await p.waitForFunction((e) => { const t = document.querySelector('#meldungen')?.innerText || ''; return new RegExp(e).test(t) && t; }, ende, { timeout: 240000, polling: 200 })
      .then(h => h.jsonValue()).catch(async () => `(keine Meldung: ${await p.locator('#meldungen').innerText().catch(() => '')})`);
    return { zeile, auftraege: protokoll().slice(vorher).filter(e => !e.auswahl && !e.abgleich).map(e => e.prompt) };
  };

  schritt('Wunsch 1: verlangt etwas Sichtbares, nichts ändert sich (48 c)');
  const w1 = await wunsch('Die Liste reicht bis an den rechten Rand.', 'ließ sich nicht umsetzen|Bestätigen');
  pruefe('Der Auftrag nennt die offene Teil-App und ihre Ansichten (48 a)', /Offen ist die Teil-App „Gerätedisposition“ \(`geraete`\)\. Der Wunsch ändert nur sie\. Ihre Ansichten: `geraete-liste`/.test(w1.auftraege[0] || ''), (w1.auftraege[0] || '').match(/Offen ist[^\n]*/)?.[0]);
  pruefe('Die KI bekommt zwei Nachbesserungen: sieht aus wie vorher (48 c, 58 c)', w1.auftraege.length === 3 && /genauso aus wie ohne sie/.test(w1.auftraege[1]) && /genauso aus wie ohne sie/.test(w1.auftraege[2]) && /#nutzbereich\[data-teilapp="geraete"\] \.orte/.test(w1.auftraege[1]), w1.auftraege.map(x => x.slice(0, 300)));
  pruefe('Play meldet es in einem Satz statt „fertig“ (48 c)', /Das ließ sich nicht umsetzen: In „Gerätedisposition“ sieht nach dem Wunsch alles aus wie vorher\. Am Stand der Seite hat sich nichts geändert\./.test(w1.zeile) && !/Bestätigen/.test(w1.zeile), w1.zeile);
  pruefe('Nichts eingespielt', !existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'rand-eins')));

  schritt('Wunsch 2: erst seitenweit, dann nur in der Gerätedisposition (48 a)');
  await laden();
  const w2 = await wunsch('Die Schrift in der Gerätedisposition etwas weiter.', 'Bestätigen|ließ sich nicht umsetzen');
  pruefe('Ändert der Wunsch das Aussehen der Personaldisposition, bekommt die KI eine Nachbesserung (48 a)', w2.auftraege.length === 2 && /auch, wie „Personaldisposition“ aussieht/.test(w2.auftraege[1]) && /Ein Wunsch ändert nur die offene Teil-App „Gerätedisposition“/.test(w2.auftraege[1]), w2.auftraege.map(x => x.slice(0, 400)));
  pruefe('Nach der Nachbesserung ist er eingespielt', /Bestätigen/.test(w2.zeile) && existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'rand-zwei')), w2.zeile);
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
  if (ausgabe) console.log(ausgabe.slice(-1500));
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
