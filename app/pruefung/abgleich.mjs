/* Prüft Stufe 3 aus Auftrag 006 mit festen KI-Antworten: Abgleich von Wunsch und Plugin nach dem Einspielen
   (Überschuss „Behalten“ / „Weg damit“, ein passendes Plugin ohne Meldung, enger gefasste Regel „So lassen“ /
   „Wie gesagt“), Regeln, die sich nur als Satz prüfen lassen (Einschätzung beim Wächter), „lässt sich hier
   nicht zeigen“ und Fälle ohne Szenario. Läuft auf einer Kopie. Aufruf: node pruefung/abgleich.mjs [ordner-fuer-bilder] */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
/* Die Abgleiche des PO aus seinem laufenden Play; die Prüfung darf sie nicht anfassen. */
const REPO_ABGLEICH = path.join(HIER, '..', 'entscheidungen', 'abgleich.json');
const repoAbgleich = () => existsSync(REPO_ABGLEICH) ? readFileSync(REPO_ABGLEICH, 'utf8') : null;
const REPO_ABGLEICH_VORHER = repoAbgleich();
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const antwort = felder => ({ rueckfrage: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], regel: null, erwartungen: [], ...felder });
const stilPlugin = (k, name, stil) => `Huelle.plugin({ kennung: "${k}", titel: "${name}", stil: "${stil}" });`;
const ZU_GROSS = stilPlugin('flugnummer-fett', 'Flugnummer fett', '.pl-balken span { font-weight: 700; } .pl-balken { filter: grayscale(1); }');
const MIT_RAND = stilPlugin('balken-rand', 'Balken mit Rand', '.pl-balken { outline: 1px solid #fff; } .pl-zeile { opacity: .9; }');
const GRUPPE = 'function (h) { return h.alle("mitarbeiter").filter(function (m) { return !m.gruppe; }).map(function (m) { return { pfade: ["mitarbeiter/" + m.kennung], satz: m.name + " gehört zu keiner Gruppe" }; }); }';
const NACHTSCHICHT = 'Huelle.plugin({ kennung: "nachtschicht", titel: "Nachtschicht", abonniert: { "mitarbeiter/*.nachtschicht": function (m, h) { h.setze(m.objekt + "/schichtEnde", "23:00"); } } });';

const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json');
const ATTRAPPE_ABGLEICH = path.join(KI, 'abgleich.json');
const PROTOKOLL = path.join(KI, 'protokoll.jsonl');
const leer = { mehr: [], enger: [], verstoesse: [] };
const BILDER = process.argv[2];
writeFileSync(ATTRAPPE, JSON.stringify([
  /* 1 zu groß: macht die Flugnummer fett und färbt nebenbei alle Balken grau */
  antwort({ art: 'neu', kennung: 'flugnummer-fett', name: 'Flugnummer fett', kurz: 'Die Flugnummer ist jetzt fett.', plugin: ZU_GROSS }),
  /* 2 passend */
  antwort({ art: 'neu', kennung: 'flugnummer-gross', name: 'Flugnummer groß', kurz: 'Die Flugnummer ist jetzt groß.', plugin: stilPlugin('flugnummer-gross', 'Flugnummer groß', '.pl-balken span { font-size: 13px; }') }),
  /* 3 zu groß, „Weg damit“: danach der Ändern-Lauf, der genau das entfernt */
  antwort({ art: 'neu', kennung: 'balken-rand', name: 'Balken mit Rand', kurz: 'Die Balken haben jetzt einen Rand.', plugin: MIT_RAND }),
  antwort({ art: 'aendern', kennung: 'balken-rand', name: 'Balken mit Rand', kurz: 'Die Zeilen sind nicht mehr blasser.', aenderungen: [{ alt: ' .pl-zeile { opacity: .9; }', neu: '' }] }),
  /* 4 Regel aus einem Wunsch, enger gefasst; „So lassen“ */
  antwort({ art: 'nur-regel', kennung: 'eine-gruppe', name: 'Eine Gruppe', kurz: 'Neue Regel.',
    regel: { kennung: 'eine-gruppe', satz: 'Ein Mitarbeiter der Frühschicht gehört zu einer Gruppe.', art: 'bedingung', pruefe: GRUPPE } }),
  /* 5 Regel aus einem Wunsch, enger gefasst; „Wie gesagt“: neue Fassung der Regel */
  antwort({ art: 'nur-regel', kennung: 'name-bekannt', name: 'Name bekannt', kurz: 'Neue Regel.',
    regel: { kennung: 'name-bekannt', satz: 'Ein Mitarbeiter mit Aufträgen hat einen Namen.', art: 'bedingung', pruefe: 'function (h) { return []; }' } }),
  antwort({ art: 'nur-regel', kennung: 'name-bekannt', name: 'Name bekannt', kurz: 'Regel erweitert.',
    regel: { kennung: 'name-bekannt', satz: 'Jeder Mitarbeiter hat einen Namen.', art: 'bedingung', pruefe: 'function (h) { return h.alle("mitarbeiter").filter(function (m) { return !m.name; }).map(function (m) { return { pfade: ["mitarbeiter/" + m.kennung], satz: m.kennung + " hat keinen Namen" }; }); }' } }),
  /* 6 Regel, die sich nur als Satz prüfen lässt: Abgleich prüft alle Plugins */
  antwort({ art: 'nur-regel', kennung: 'flugnummer-lesbar', name: 'Flugnummer lesbar', kurz: 'Neue Regel.',
    regel: { kennung: 'flugnummer-lesbar', satz: 'Die Flugnummer im Balken ist immer gut lesbar.', art: 'ki', pruefe: null } }),
  /* 7 lässt sich nicht zeigen */
  antwort({ art: 'nur-regel', kennung: 'antwortzeit-50', name: 'Antwortzeit', kurz: 'Vermerkt.',
    regel: { kennung: 'antwortzeit-50', satz: 'Die Seite antwortet bei 50 gleichzeitigen Benutzern in unter einer Sekunde.', art: 'nicht-zeigbar', pruefe: null } }),
  /* 8 Plugin, das auf eine Nachricht hört, die kein Szenario sendet */
  antwort({ art: 'neu', kennung: 'nachtschicht', name: 'Nachtschicht', kurz: 'Nachtschicht verlängert die Schicht.', plugin: NACHTSCHICHT }),
]));
writeFileSync(ATTRAPPE_ABGLEICH, JSON.stringify([
  /* zu 1 */ { mehr: [{ was: 'Es färbt außerdem alle Balken grau.' }], enger: [], verstoesse: [] },
  /* zu 2 */ leer,
  /* zu 3 */ { mehr: [{ was: 'Es macht außerdem die Zeilen blasser.' }], enger: [], verstoesse: [] },
  /* zum Ändern-Lauf aus „Weg damit“ */ leer,
  /* zu 4 */ { mehr: [], enger: [{ was: 'Es gilt nur für die Frühschicht, dein Wunsch nennt keine Schicht.', regel: true }], verstoesse: [] },
  /* zu 5 */ { mehr: [], enger: [{ was: 'Es gilt nur für Mitarbeiter mit Aufträgen.', regel: true }], verstoesse: [] },
  /* zur neuen Fassung aus „Wie gesagt“ */ leer,
  /* zu 6: neue Regel nur als Satz gegen alle Plugins */
  { mehr: [{ was: 'Soll wegfallen: Eine Regel tut nichts zusätzlich.' }], enger: [],
    verstoesse: [{ regel: 'flugnummer-lesbar', plugin: 'flugnummer-gross', satz: 'Die Flugnummer ist mit 13 px auf grauem Balken schwer lesbar.' },
      { regel: 'gibt-es-nicht', plugin: 'flugnummer-gross', satz: 'Unbekannte Regel, muss wegfallen.' }] },
  /* zu 8 */ leer,
]));

const { adresse, plugindaten, regeln: REGELN, abgleich: ABGLEICH } = await eigeneBruecke(4334, { mitKopie: true, ohneAbgleiche: true, attrappe: ATTRAPPE, attrappeAbgleich: ATTRAPPE_ABGLEICH, protokoll: PROTOKOLL });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const prompts = () => existsSync(PROTOKOLL) ? readFileSync(PROTOKOLL, 'utf8').trim().split('\n').map(z => JSON.parse(z)) : [];
/* Der Server schreibt diese Dateien neu, während die Prüfung sie abfragt; ein halb geschriebener Stand wird kurz danach noch einmal gelesen. */
function liesJson(datei) {
  for (let i = 0; ; i++) {
    try { return JSON.parse(readFileSync(datei, 'utf8')); }
    catch (e) { if (i >= 20 || !(e instanceof SyntaxError)) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); }
  }
}
const herkunft = k => liesJson(path.join(BAUSTEINE, k, 'herkunft.json'));
const abgleiche = () => existsSync(ABGLEICH) ? liesJson(ABGLEICH) : [];

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const meldung = async text => (await p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 90000 })).textContent();
const angebot = text => p.waitForSelector(`#meldungen .meldung.abgleich:has-text("${text}")`, { timeout: 60000 });
/* Wartet, bis der Abgleich zu diesem Wunsch durch ist (Brücke sagt fertig) */
async function abgleichFertig(id) {
  for (let i = 0; i < 120; i++) {
    if (abgleiche().some(e => e.wunsch === id && e.status !== 'laeuft')) return;
    await p.waitForTimeout(250);
  }
  throw new Error('Abgleich zu ' + id + ' nach 30 s nicht fertig');
}
async function wunsch(text) {
  const vorher = await p.evaluate(() => fetch('/abgleich').then(r => r.json()).then(l => l.length));
  await p.fill('#wunschFeld', text);
  await p.click('#wunsch button[type="submit"]');
  return vorher;
}
const letzterWunsch = () => prompts().filter(x => !x.abgleich).at(-1).id;
const bild = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png') }); };
const schliesseMeldungen = () => p.evaluate(() => document.querySelectorAll('#meldungen .meldung').forEach(m => m.remove()));

try {
  await p.goto(adresse);
  await bereit();
  pruefe('Vorher: kein Abgleich, kein Zähler', !(await p.isVisible('#nichtZeigbarKnopf')) && (await p.evaluate(() => Huelle.abgleich.stand().length)) === 0);
  const ohneVorher = await p.evaluate(() => Huelle.luecken.ohneSzenario());
  console.log('     Ohne Szenario am Stand des PO: ' + JSON.stringify(ohneVorher.map(o => o.satz)));

  /* ---------- 1 Überschuss: „Behalten“ ---------- */
  await wunsch('Die Flugnummer im Balken soll fett sein.');
  await meldung('Fertig: Die Flugnummer ist jetzt fett.');
  const lauf = await p.waitForSelector('#meldungen .meldung.abgleich-lauf', { timeout: 10000 }).then(m => m.textContent()).catch(() => '');
  await bild('0-abgleich-laeuft');
  pruefe('Abgleich zeigt seinen Fortschritt', lauf.includes('Abgleich mit deinem Wunsch läuft im Hintergrund'), lauf);
  const w1 = letzterWunsch();
  const a1 = await (await angebot('tut auch etwas')).textContent();
  await bild('1-ueberschuss');
  pruefe('Überschuss wird als ein Satz angeboten', a1.startsWith('„Flugnummer fett“ tut auch etwas, was du nicht gesagt hast: Es färbt außerdem alle Balken grau. Behalten?'), a1);
  pruefe('Fortschrittszeile ist danach weg', !(await p.isVisible('#meldungen .meldung.abgleich-lauf')));
  const p1 = prompts().filter(x => x.abgleich)[0];
  pruefe('Abgleich bekommt Wunsch im Wortlaut und das Plugin', p1?.prompt.includes('Die Flugnummer im Balken soll fett sein.') && p1.prompt.includes('# Neues Plugin `flugnummer-fett`'), p1?.prompt.slice(0, 300));
  await p.click('#meldungen .meldung.abgleich button.aktion:text("Behalten")');
  await p.waitForFunction(() => !document.querySelector('#meldungen .meldung.abgleich'));
  for (let i = 0; i < 50 && !herkunft('flugnummer-fett').fassungen.at(-1).entscheidungen; i++) await p.waitForTimeout(100);
  const h1 = herkunft('flugnummer-fett');
  const e1 = h1.fassungen.at(-1).entscheidungen?.[0];
  pruefe('Behalten: Entscheidung mit Datum in der Herkunft', e1?.wahl === 'behalten' && e1.art === 'mehr' && e1.was === 'Es färbt außerdem alle Balken grau.' && /^\d{4}-/.test(e1.datum) && e1.wie.includes('Behalten'), { h1, abgleich: abgleiche().find(e => e.wunsch === w1) });
  pruefe('Behalten: Plugin bleibt, wie es ist', h1.aktuell === 1 && readFileSync(path.join(BAUSTEINE, 'flugnummer-fett', 'fassung-001.js'), 'utf8') === ZU_GROSS);
  await schliesseMeldungen();

  /* ---------- 2 Passendes Plugin: keine Meldung ---------- */
  await wunsch('Die Flugnummer im Balken soll größer sein.');
  await meldung('Fertig: Die Flugnummer ist jetzt groß.');
  await abgleichFertig(letzterWunsch());
  await p.waitForTimeout(500);
  pruefe('Passendes Plugin: kein Angebot', (await p.evaluate(() => Huelle.abgleich.offen().length)) === 0, await p.evaluate(() => Huelle.abgleich.offen()));
  await schliesseMeldungen();

  /* ---------- 3 Überschuss: „Weg damit“ ---------- */
  await wunsch('Die Balken sollen einen weißen Rand haben.');
  await meldung('Fertig: Die Balken haben jetzt einen Rand.');
  await angebot('Es macht außerdem die Zeilen blasser.');
  await p.click('#meldungen .meldung.abgleich button.aktion:text("Weg damit")');
  const m3 = await meldung('Geändert:');
  pruefe('Weg damit: Ändern-Lauf ist eingespielt', m3.includes('Die Zeilen sind nicht mehr blasser.'), m3);
  const h3 = herkunft('balken-rand');
  pruefe('Weg damit: genau das ist entfernt', h3.aktuell === 2 && !readFileSync(path.join(BAUSTEINE, 'balken-rand', 'fassung-002.js'), 'utf8').includes('opacity') && readFileSync(path.join(BAUSTEINE, 'balken-rand', 'fassung-002.js'), 'utf8').includes('outline'));
  pruefe('Weg damit: Entscheidung steht an der abgeglichenen Fassung', h3.fassungen[0].entscheidungen?.[0]?.wahl === 'weg', h3.fassungen[0]);
  const aendern = prompts().filter(x => !x.abgleich).at(-1);
  pruefe('Weg damit: Der Ändern-Lauf nennt genau das', aendern.prompt.includes('Der Anforderer will dieses Plugin ändern') && aendern.prompt.includes('Entferne genau das, was ich nicht gesagt habe: Es macht außerdem die Zeilen blasser.'), aendern.prompt.slice(0, 400));
  await abgleichFertig(letzterWunsch());
  await schliesseMeldungen();

  /* ---------- 4 Enger gefasste Regel: „So lassen“ ---------- */
  await wunsch('Jeder Mitarbeiter gehört zu einer Gruppe.');
  await meldung('Gilt ab jetzt als Regel: Ein Mitarbeiter der Frühschicht gehört zu einer Gruppe.');
  const a4 = await (await angebot('fasst deinen Wunsch enger')).textContent();
  await bild('2-enger');
  pruefe('Enger: Satz nennt die Regel und worin sie enger ist', a4.startsWith('Die Regel „Ein Mitarbeiter der Frühschicht gehört zu einer Gruppe.“ fasst deinen Wunsch enger, als du ihn gesagt hast: Es gilt nur für die Frühschicht, dein Wunsch nennt keine Schicht. So lassen?'), a4);
  const w4 = letzterWunsch();
  await p.click('#meldungen .meldung.abgleich button.aktion:text("So lassen")');
  await p.waitForFunction(() => !document.querySelector('#meldungen .meldung.abgleich'));
  for (let i = 0; i < 50 && !abgleiche().find(e => e.wunsch === w4)?.entscheidungen?.['enger-0']; i++) await p.waitForTimeout(100);
  const e4 = abgleiche().find(e => e.wunsch === w4)?.entscheidungen?.['enger-0'];
  pruefe('So lassen: Entscheidung mit Datum gespeichert', e4?.wahl === 'behalten' && e4.wie.includes('So lassen') && /^\d{4}-/.test(e4.datum), e4);
  await schliesseMeldungen();

  /* ---------- 5 Enger gefasste Regel: „Wie gesagt“ ---------- */
  await wunsch('Jeder Mitarbeiter hat einen Namen.');
  await angebot('Es gilt nur für Mitarbeiter mit Aufträgen.');
  await p.click('#meldungen .meldung.abgleich button.aktion:text("Wie gesagt")');
  await meldung('Gilt ab jetzt als Regel: Jeder Mitarbeiter hat einen Namen.');
  const regel5 = readFileSync(path.join(REGELN, 'name-bekannt.js'), 'utf8');
  pruefe('Wie gesagt: neue Fassung der Regel, vorige in der Herkunft', regel5.includes('"Jeder Mitarbeiter hat einen Namen."') && regel5.includes('Ein Mitarbeiter mit Aufträgen hat einen Namen.'), regel5.slice(0, 600));
  const w5 = prompts().filter(x => !x.abgleich).at(-1);
  pruefe('Wie gesagt: Auftrag gilt der Regel und nennt den Wortlaut', w5.prompt.includes('Der Anforderer will die Regel `name-bekannt` ändern') && w5.prompt.includes('„Jeder Mitarbeiter hat einen Namen.“'), w5.prompt.slice(0, 400));
  await abgleichFertig(letzterWunsch());
  await schliesseMeldungen();

  /* ---------- 6 Regel nur als Satz: Einschätzung beim Wächter ---------- */
  await wunsch('Die Flugnummer im Balken muss immer gut lesbar sein.');
  await meldung('Gilt ab jetzt als Regel: Die Flugnummer im Balken ist immer gut lesbar.');
  const w6 = letzterWunsch();
  await abgleichFertig(w6);
  const p6 = prompts().filter(x => x.abgleich && x.id === w6).at(-1) || { prompt: JSON.stringify([w6, abgleiche().find(e => e.wunsch === w6)]) };
  pruefe('Neue Regel nur als Satz: Abgleich prüft alle Plugins', p6.prompt.includes('# Neue Regel `flugnummer-lesbar`') && p6.prompt.includes('### Plugin `flugnummer-gross`'), p6.prompt.slice(0, 300));
  await p.waitForFunction(() => Huelle.waechter.eintraege().some(e => e.einschaetzung));
  const v6 = await p.evaluate(() => Huelle.waechter.eintraege().filter(e => e.einschaetzung));
  pruefe('Einschätzung erscheint wie die anderen Verstöße', v6.length === 1 && v6[0].regel === 'flugnummer-lesbar' && v6[0].satz === 'Die Flugnummer ist mit 13 px auf grauem Balken schwer lesbar. – Die Flugnummer im Balken ist immer gut lesbar.', v6);
  pruefe('Bei einer Regel ohne Plugin gibt es nichts „mehr“ und keine unbekannte Regel', (await p.evaluate(() => Huelle.abgleich.offen().length)) === 0 && abgleiche().find(e => e.wunsch === w6).verstoesse.length === 1);
  await p.click('#verstossKnopf');
  await bild('3-einschaetzung');
  const k6 = p.locator('.verstoss.einschaetzung');
  pruefe('Gekennzeichnet als Einschätzung, mit Weg zum Plugin', (await k6.count()) === 1 && (await k6.textContent()).includes('Einschätzung der KI zum Plugin „Flugnummer groß“') && (await k6.locator('button.zum-plugin').count()) === 1, await k6.textContent().catch(() => ''));
  await p.click('#verstossKnopf');
  await schliesseMeldungen();

  /* ---------- 7 Lässt sich hier nicht zeigen ---------- */
  await wunsch('Die Seite soll bei 50 gleichzeitigen Benutzern in unter einer Sekunde antworten.');
  const m7 = await meldung('Lässt sich hier nicht zeigen');
  pruefe('Nicht zeigbar: Satz statt Nachstellen', m7.includes('Lässt sich hier nicht zeigen, ist vermerkt: Die Seite antwortet bei 50 gleichzeitigen Benutzern in unter einer Sekunde.') && !m7.includes('Gilt ab jetzt als Regel'), m7);
  await p.waitForSelector('#nichtZeigbarKnopf:not([hidden])');
  pruefe('Zähler steht neben dem Wunschfeld', (await p.textContent('#nichtZeigbarKnopf')) === '1 Punkt lässt sich hier nicht zeigen');
  await p.click('#nichtZeigbarKnopf');
  await bild('4-nicht-zeigbar');
  const nz = await p.textContent('#nichtZeigbar');
  pruefe('Aufgeklappt: je Punkt ein Satz mit deinem Wortlaut', nz.includes('Die Seite antwortet bei 50 gleichzeitigen Benutzern in unter einer Sekunde.') && nz.includes('„Die Seite soll bei 50 gleichzeitigen Benutzern in unter einer Sekunde antworten.“'), nz);
  pruefe('Nicht zeigbar: kein Abgleich, kein Plugin', !abgleiche().some(e => e.regel?.kennung === 'antwortzeit-50') && !existsSync(path.join(BAUSTEINE, 'antwortzeit-50')));
  await p.click('#nichtZeigbarZu');
  await schliesseMeldungen();

  /* ---------- 8 Ohne Szenario ---------- */
  await wunsch('Bei Nachtschicht soll die Schicht bis 23 Uhr gehen.');
  await meldung('Fertig: Nachtschicht verlängert die Schicht.');
  await abgleichFertig(letzterWunsch());
  await bereit();
  await p.waitForFunction(() => (Huelle.luecken.ohneSzenario() || []).some(o => o.kennung === 'nachtschicht'), null, { timeout: 60000 });
  const ohne = await p.evaluate(() => Huelle.luecken.ohneSzenario());
  pruefe('Ohne Szenario: das Plugin, auf das kein Szenario trifft', ohne.some(o => o.art === 'plugin' && o.satz === 'Für „Nachtschicht“ gibt es kein Szenario.'), ohne);
  pruefe('Ohne Szenario: die Regel, deren Feld kein Szenario ändert', ohne.some(o => o.art === 'regel' && o.kennung === 'eine-gruppe' && o.satz === 'Für die Regel „Ein Mitarbeiter der Frühschicht gehört zu einer Gruppe.“ gibt es kein Szenario.'), ohne);
  pruefe('Regeln, die ein Szenario berührt, stehen nicht da', !ohne.some(o => ['beginn-ab-on-block', 'ladegruppe-je-flug', 'qualifikation-passt'].includes(o.kennung)), ohne);
  pruefe('Die Regel eines fremden Bereichs steht nicht da', !ohne.some(o => o.kennung === 'fremd-schichtplanung-zwei-auftraege'));
  pruefe('Was eine Regel liest, ist gemessen', JSON.stringify(await p.evaluate(() => Huelle.luecken.felderVon('eine-gruppe'))) === '["mitarbeiter/*/gruppe"]'   /* den Namen liest sie nur bei einem Verstoß */, await p.evaluate(() => Huelle.luecken.felderVon('eine-gruppe')));
  await p.click('#ohneSzenarioKnopf');
  pruefe('Zähler „ohne Szenario“ nennt die Zahl', (await p.textContent('#ohneSzenarioKnopf')) === ohne.length + ' ohne Szenario');
  await bild('5-ohne-szenario');
  await p.click('#ohneSzenario button.luecke-wunsch[data-luecke="nachtschicht"]');
  await bild('6-ins-wunschfeld');
  pruefe('Ein Klick legt den Satz ins Wunschfeld', (await p.inputValue('#wunschFeld')) === 'Für „Nachtschicht“ gibt es kein Szenario. ' && await p.evaluate(() => document.activeElement.id === 'wunschFeld'));

  /* ---------- 9 Nach dem Neuladen ---------- */
  await p.reload();
  await bereit();
  await p.waitForTimeout(800);
  pruefe('Nach dem Neuladen: Entschiedenes kommt nicht wieder', (await p.evaluate(() => Huelle.abgleich.offen().length)) === 0, await p.evaluate(() => Huelle.abgleich.offen()));
  await p.click('#pluginKnopf').catch(() => {});
  await p.evaluate(() => Huelle.leiste.zeige('flugnummer-fett'));
  const l9 = await p.textContent('[data-plugin="flugnummer-fett"]');
  pruefe('Leiste zeigt „Behalten“ am Plugin', l9.includes('Behalten am ') && l9.includes('Es färbt außerdem alle Balken grau.'), { l9, h: herkunft('flugnummer-fett') });
  pruefe('Nach dem Neuladen: Einschätzung und nicht Zeigbares bleiben', (await p.evaluate(() => Huelle.waechter.eintraege().filter(e => e.einschaetzung).length)) === 1 && (await p.textContent('#nichtZeigbarKnopf')) === '1 Punkt lässt sich hier nicht zeigen');
  pruefe('Nichts im Browser außer Ansichten', await p.evaluate(() => Object.keys(localStorage).every(k => /^play\/(leiste|waechter|luecken|player)/.test(k))), await p.evaluate(() => Object.keys(localStorage)));

  /* ---------- 10 Zurücknehmen nimmt den Abgleich mit ---------- */
  pruefe('Abgleiche liegen als Datei in der Kopie, die im Repo bleibt unberührt', abgleiche().length >= 6 && repoAbgleich() === REPO_ABGLEICH_VORHER);
} catch (e) {
  /* Bei einem Abbruch steht da, wie weit Abgleich und Meldungen waren. */
  console.log('Abgleiche beim Abbruch: ' + JSON.stringify(abgleiche().map(x => ({ wunsch: x.wunsch, plugin: x.plugin, status: x.status, mehr: x.mehr?.map(m => m.was), enger: x.enger?.map(m => m.was), entscheidungen: x.entscheidungen, fehler: x.fehler }))));
  console.log('Angebote auf der Seite beim Abbruch: ' + JSON.stringify(await p.evaluate(() => ({ offen: Huelle.abgleich.offen(), stand: Huelle.abgleich.stand().map(e => [e.wunsch, e.status, (e.enger || []).length]) })).catch(e => e.message)));
  console.log('Meldungen beim Abbruch: ' + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent.slice(0, 160))).catch(() => [])));
  throw e;
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
