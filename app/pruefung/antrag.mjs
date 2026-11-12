/* Prüft Anweisung 49 (d) des PO (10.11.): Ein Wunsch ändert nur die offene Teil-App. Braucht er etwas aus einer anderen, legt Play
   einen Antrag an der Naht an; der Navigator zeigt ihn dort, und der PO der anderen Teil-App nimmt ihn an oder lehnt ihn ab.
   Wegwerf-Kopie von Play mit der Testvorlage; die Gerätedisposition und die Antworten der KI kommen aus einer Attrappe.
   Aufruf: node pruefung/antrag.mjs */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(HIER, '..');
const VORLAGE = path.join(HIER, 'vorlage');
const PORT = 4393;

let fehler = 0;
const pruefe = (name, ok, zusatz) => { if (!ok) fehler++; console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`); };
const schritt = (t) => console.log(`-- ${t}`);

schritt('Kopie anlegen: Play mit der Testvorlage, Gerätedisposition noch leer');
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'play-antrag-'));
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

const antwort = felder => ({ anPlay: null, rueckfrage: null, teile: null, art: 'neu', kennung: 'x', name: 'x', kurz: 'x', plugin: null, aenderungen: [], drehbuch: null, zeigen: null, regel: null, erwartungen: [], grunddaten: [], grundfunktionen: [], volltext: [], alleDaten: false, sichtbar: false, antrag: null, ...felder });
const quelle = readFileSync(path.join(VORLAGE, 'plugins', 'bausteine', 'konflikt-leuchten', 'fassung-001.js'), 'utf8');
const stelle = /DAUER = \d+/.exec(quelle)?.[0];
const ATTRAPPE = path.join(wurzel, 'antworten.json'), PROTOKOLL = path.join(wurzel, 'protokoll.jsonl');
writeFileSync(ATTRAPPE, JSON.stringify([
  {
    rueckfrage: null, anzahlPlugins: 1,
    fachobjekte: [{ wurzel: 'geraete', name: 'Geräte', einer: 'eines Geräts', felder: [{ feld: 'name', wort: 'den Namen' }] }],
    daten: JSON.stringify({ geraete: { 'G-1': { kennung: 'G-1', name: 'Schlepper 1' } } }),
    plugins: [{ kennung: 'geraete-liste', name: 'Geräteliste', kurz: 'Zeigt die Geräte.', satz: null,
      quelle: 'Huelle.plugin({ kennung: "geraete-liste", titel: "Geräteliste", ansicht: { ort: "haupt", zeichne: function (el, h) { el.textContent = h.alle("geraete").map(function (g) { return g.name; }).join(", "); } } });' }],
    drehbuch: 'Huelle.drehbuch({ kennung: "{{auftrag}}", titel: "Geräte ansehen", ereignisse: [] });',
  },
  /* Wunsch 1: erst ändert die KI ein Plugin der Personaldisposition, nach der Nachbesserung stellt sie nur einen Antrag. */
  antwort({ art: 'aendern', kennung: 'konflikt-leuchten', aenderungen: [{ alt: stelle, neu: 'DAUER = 1000' }] }),
  antwort({ antrag: { an: 'flugplan', satz: 'mehr Flüge zwischen 05:00 und 11:00' } }),
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
const post = async (weg, inhalt) => { const r = await fetch(ADRESSE + weg, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ADRESSE }, body: JSON.stringify(inhalt) }); return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) }; };
const protokoll = () => existsSync(PROTOKOLL) ? readFileSync(PROTOKOLL, 'utf8').trim().split('\n').filter(Boolean).map(z => JSON.parse(z)).filter(e => !e.auswahl && !e.abgleich) : [];
const warte = async (id) => {
  let s = { status: 'wartet' };
  for (let t = Date.now(); !['behalten', 'fertig', 'fehlgeschlagen', 'rueckfrage', 'antrag', 'an-play'].includes(s.status) && Date.now() - t < 60000; await new Promise(r => setTimeout(r, 300))) s = await (await fetch(`${ADRESSE}/wunsch/${id}`)).json();
  return s;
};
const antraege = () => JSON.parse(readFileSync(path.join(KOPIE, 'entscheidungen', 'antraege.json'), 'utf8'));
const punkte = async (umfang) => (await (await fetch(`${ADRESSE}/offene-punkte?umfang=${encodeURIComponent(umfang)}`)).json()).eintraege;

try {
  schritt('Prototyp der Gerätedisposition über die Attrappe');
  await post('/prototyp-vormerken', { bereich: 'geraete' });
  const p = await post('/prototyp/geraete', { text: 'Eine Liste der Geräte.' });
  pruefe('Die Gerätedisposition steht', (await warte(p.d.id)).status === 'behalten');
  await post('/projekt', { kennung: 'bodenabfertigung/geraete' });

  schritt('Wunsch in der Gerätedisposition, der etwas vom Flugplan braucht');
  const w = await post('/wunsch', { text: 'Ich will mehr Flüge zwischen 05:00 und 11:00 sehen.', stand: {}, drehbuch: null, flow: 'bodenabfertigung/tagesdisposition' });
  const s = await warte(w.d.id);
  const auftraege = protokoll().map(e => e.prompt);
  pruefe('Der Auftrag nennt die Teil-Apps, die Nähte und wie ein Antrag geht', /Teil-Apps dieses Projekts: .*`flugplan` \(Flugplan\)/.test(auftraege[1] || '') && /An „Gerätedisposition“ wird weitergegeben, nur zum Lesen: Flugplan gibt die Flüge/.test(auftraege[1] || '') && /stellst du in "antrag" einen Antrag/.test(auftraege[1] || ''), (auftraege[1] || '').match(/Teil-Apps dieses Projekts[^\n]*/)?.[0]);
  /* Anweisung 63: Die Daten der eigenen Teil-App gehen mit, nicht nur der Personal-Tag. */
  pruefe('Der Auftrag enthält die Geräte der Gerätedisposition', /### daten\/bereiche\/geraete\.js \(Daten dieser Teil-App\)/.test(auftraege[1] || '') && /Schlepper 1/.test(auftraege[1] || ''), (auftraege[1] || '').match(/### daten[^\n]*/g));
  pruefe('Ändert die KI ein Plugin der Personaldisposition, bekommt sie eine Nachbesserung', auftraege.length === 3 && /„Personaldisposition“\. Ein Wunsch ändert nur „Gerätedisposition“/.test(auftraege[2]) && /Antrag an "disposition"/.test(auftraege[2]), auftraege.slice(2).map(x => x.slice(0, 400)));
  pruefe('Ergebnis: ein Antrag, eingespielt wird nichts', s.status === 'antrag' && s.antragSatz === '„Gerätedisposition“ bittet „Flugplan“: mehr Flüge zwischen 05:00 und 11:00', { status: s.status, satz: s.antragSatz, grund: s.grund });
  pruefe('Das Plugin der Personaldisposition ist unverändert', !existsSync(path.join(KOPIE, 'plugins', 'bausteine', 'konflikt-leuchten', 'fassung-002.js')));
  const a1 = antraege()[0];
  pruefe('Der Antrag steht mit Wortlaut, Datum und offen in der Herkunft', a1?.von === 'geraete' && a1?.an === 'flugplan' && a1?.status === 'offen' && a1?.wortlaut === 'Ich will mehr Flüge zwischen 05:00 und 11:00 sehen.' && !!a1?.datum, a1);

  schritt('Navigator: der Antrag steht an der Naht');
  const amFlugplan = await punkte('bereiche/flugplan');
  pruefe('Er zählt am Flugplan als gelber Punkt', amFlugplan.some(e => e.art === 'antrag' && e.farbe === 'gelb' && e.bereich === 'flugplan' && /bittet „Flugplan“/.test(e.satz)), amFlugplan);
  const faeden = await punkte('faeden/disposition-ordner--flugplan');
  pruefe('Am Bündel zum Flugplan: die Naht und der Antrag, gelb', faeden.some(e => /^Flugplan gibt die Flüge .* an „Gerätedisposition“ weiter\.$/.test(e.satz) && e.farbe === 'klar') && faeden.some(e => /^Antrag: „Gerätedisposition“ bittet „Flugplan“/.test(e.satz) && e.farbe === 'gelb'), faeden.map(e => [e.satz, e.farbe]));

  schritt('„Stimmt nicht“ an einem Plugin der Personaldisposition, während die Gerätedisposition offen ist');
  const vorher = protokoll().length;
  const sn = await post('/plugin/konflikt-leuchten/stimmt-nicht', { text: 'Es soll kürzer leuchten.', stand: {}, drehbuch: null });
  const s2 = await warte(sn.d.id);
  pruefe('Wird gleich ein Antrag an die Personaldisposition, ohne die KI zu fragen', s2.status === 'antrag' && /„Gerätedisposition“ bittet „Personaldisposition“: Es soll kürzer leuchten\./.test(s2.antragSatz) && protokoll().length === vorher, { status: s2.status, satz: s2.antragSatz });

  schritt('Entscheiden');
  const [x1, x2] = antraege();
  const ab = await post(`/antraege/${x2.id}`, { entscheidung: 'ablehnen' });
  pruefe('Ablehnen: abgelehnt mit Datum', ab.ok && antraege()[1].status === 'abgelehnt' && !!antraege()[1].entschieden?.datum, antraege()[1]);
  pruefe('Ein zweites Mal geht nicht', (await post(`/antraege/${x2.id}`, { entscheidung: 'annehmen' })).code === 409);
  const an = await post(`/antraege/${x1.id}`, { entscheidung: 'annehmen' });
  pruefe('Annehmen: Play bekommt den Text für einen Wunsch im Flugplan, der noch leer ist', an.ok && an.d.an === 'flugplan' && an.d.prototyp === false && an.d.text === 'mehr Flüge zwischen 05:00 und 11:00' && antraege()[0].status === 'angenommen', an.d);
  pruefe('Entschiedene Anträge zählen nicht mehr', !(await punkte('bereiche/flugplan')).some(e => e.art === 'antrag'));
} catch (e) {
  fehler++;
  console.log('FEHL', e.message);
  if (ausgabe) console.log(ausgabe.slice(-1500));
}
console.log(fehler ? `\n${fehler} Prüfpunkt(e) gescheitert` : '\nAlle Prüfpunkte bestanden');
process.exit(fehler ? 1 : 0);
