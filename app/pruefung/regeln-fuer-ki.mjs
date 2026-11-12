/* Prüft Stufe 2 aus Auftrag 006: Regeln für die innere KI, Probelauf mit Wächter, Regeln aus Wünschen.
   Die KI ist eine Attrappe mit festen Antworten; was sie bekommen hätte, steht im Protokoll.
   Läuft auf einer Kopie der Plugins, Sollergebnisse und Regeln. Aufruf: node pruefung/regeln-fuer-ki.mjs */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

const antwort = felder => ({ rueckfrage: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], regel: null, ...felder });
/* Bricht die Ladegruppen-Regel: XC 810 Entladen geht nach dem Lösen an V. Engström (Ladegruppe 2). */
const bricht = k => antwort({ art: 'neu', kennung: k, name: 'Entladen an V. Engström', kurz: 'V. Engström übernimmt.',
  plugin: `Huelle.plugin({ kennung: "${k}", titel: "Entladen an V. Engström", abonniert: {
    "auftraege/XC810-ENTL-01.loesen": function (m, h) { h.sende({ objekt: "auftraege/XC810-ENTL-01", aktion: "zuweisen", parameter: { mitarbeiter: "MA-05" } }); },
    "auftraege/XC810-ENTL-01.zuweisen": function (m, h) { h.sende({ objekt: m.objekt, aktion: "umplanen", parameter: { mitarbeiter: m.parameter.mitarbeiter } }); } } });` });
const kurz = k => antwort({ art: "neu", kennung: k, name: "Betanken kürzen", kurz: "Gekürzt.",
  plugin: `Huelle.plugin({ kennung: "${k}", titel: "Betanken kürzen", besitzt: ["auftraege/XB933-TANK-01/ende"], abonniert: {
    "mitarbeiter/MA-01.krankmeldung": function (m, h) { h.sende({ objekt: "auftraege/XB933-TANK-01", aktion: "kuerzen" }); },
    "auftraege/XB933-TANK-01.kuerzen": function (m, h) { h.setze(m.objekt + "/ende", h.zeit(h.minuten(h.lies(m.objekt + "/start")) + 2)); } } });` });
const harmlos = (k, kurz) => antwort({ art: 'neu', kennung: k, name: 'Flugnummer fett', kurz,
  plugin: `Huelle.plugin({ kennung: "${k}", titel: "Flugnummer fett", stil: ".pl-balken span { font-weight: 700; }" });` });

const KI = mkdtempSync(path.join(os.tmpdir(), 'play-ki-'));
const ATTRAPPE = path.join(KI, 'antworten.json');
const PROTOKOLL = path.join(KI, 'protokoll.jsonl');
writeFileSync(ATTRAPPE, JSON.stringify([
  /* 1 bricht die Regel, Nachbesserung gelingt */
  bricht('entladen-umverteilen'),
  harmlos('flugnummer-fett', 'Die Flugnummer im Balken ist jetzt fett.'),
  /* 2 bricht die Regel, auch nach der Nachbesserung */
  kurz('betanken-kuerzen'),
  kurz('betanken-kuerzen'),
  /* 3 nur Regel, als Bedingung */
  antwort({ art: 'nur-regel', kennung: 'hoechstens-zwei-stunden', name: 'Höchstens zwei Stunden', kurz: 'Neue Regel.',
    regel: { kennung: 'hoechstens-zwei-stunden', satz: 'Ein Auftrag dauert höchstens zwei Stunden.', art: 'bedingung',
      pruefe: 'function (h) { return h.alle("auftraege").filter(function (a) { return h.minuten(a.ende) - h.minuten(a.start) > 120; }).map(function (a) { return { pfade: ["auftraege/" + a.kennung], satz: a.flug + " " + a.arbeit + " dauert " + (h.minuten(a.ende) - h.minuten(a.start)) + " Minuten" }; }); }' } }),
  /* 4 Plugin und Regel, die sich nicht als Bedingung fassen lässt */
  antwort({ ...harmlos('flugnummer-gross', 'Die Flugnummer ist jetzt groß.'), name: 'Flugnummer groß',
    plugin: 'Huelle.plugin({ kennung: "flugnummer-gross", titel: "Flugnummer groß", stil: ".pl-balken span { font-size: 13px; }" });',
    regel: { kennung: 'flugnummer-lesbar', satz: 'Die Flugnummer im Balken ist immer gut lesbar.', art: 'ki', pruefe: null } }),
]));

const { adresse, plugindaten, regeln: REGELN } = await eigeneBruecke(4332, { mitKopie: true, attrappe: ATTRAPPE, protokoll: PROTOKOLL });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const LADEGRUPPE = 'XC 810: Entladen machen Ladegruppe 1 und Ladegruppe 2 (V. Engström) – Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.';
const prompts = () => existsSync(PROTOKOLL) ? readFileSync(PROTOKOLL, 'utf8').trim().split('\n').map(z => JSON.parse(z)) : [];

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 600) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] })   /* wie Chrome und Edge auf dem Desktop: Kopien rechnen gleichzeitig */;
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const meldung = async text => (await p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 90000 })).textContent();
async function wunsch(text) {
  await p.fill('#wunschFeld', text);
  await p.click('#wunsch button');
}

try {
  await p.goto(adresse);
  await bereit();
  pruefe('Regeln kommen über die Brücke', (await p.evaluate(() => Huelle.regelQuellen.length)) === 6);

  /* ---------- 1 Plugin bricht Regel, Nachbesserung gelingt ---------- */
  await wunsch('Bei der Krankmeldung von MA-01 soll V. Engström XC 810 Entladen übernehmen.');
  const m1 = await meldung('Fertig:');
  pruefe('Nach Nachbesserung eingespielt', m1.includes('Die Flugnummer im Balken ist jetzt fett.'), m1);
  const p1 = prompts();
  pruefe('Erster Auftrag: Regeln entlang des Pfads mitgegeben, mit Bedingung',
    p1[0].prompt.includes('## Regeln, die gelten (Played Flow `bodenabfertigung/tagesdisposition` und darüber)') &&
    p1[0].prompt.includes('Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.') &&
    p1[0].prompt.includes('pruefe: function (h)') && p1[0].prompt.includes('Kein Plugin darf eine davon brechen'));
  pruefe('Regel des fremden Bereichs nicht mitgegeben', !p1[0].prompt.includes('höchstens zwei Aufträge am Tag'));
  pruefe('Nachbesserung nennt den Regelbruch', p1.length === 2 && p1[1].prompt.includes('Das Plugin bricht eine geltende Regel: ' + LADEGRUPPE), p1[1]?.prompt.slice(0, 800));
  pruefe('Das regelbrechende Plugin wurde nicht angelegt', !existsSync(path.join(BAUSTEINE, 'entladen-umverteilen')) && existsSync(path.join(BAUSTEINE, 'flugnummer-fett')));
  await bereit();

  /* ---------- 2 Plugin bricht Regel, Nachbesserung gelingt nicht: der PO entscheidet ---------- */
  await wunsch('Bei Krankmeldung von MA-01 soll XB 933 Betanken auf 2 Minuten gekürzt werden.');
  const m2 = await meldung('Das bräche eine Regel');
  pruefe('Nicht still verworfen: Satz nennt die Regel, der PO entscheidet',
    m2.includes('Das bräche eine Regel: XB 933 Betanken dauert nur 2 Minuten – Ein Auftrag ist mindestens 5 Minuten lang.') && m2.includes('Du entscheidest.') &&
    ['Trotzdem einspielen', 'Regel ändern', 'Verwerfen'].every(t => m2.includes(t)), m2);
  pruefe('Solange er nicht entscheidet, ist nichts eingespielt', !existsSync(path.join(BAUSTEINE, 'betanken-kuerzen')));
  await p.click('#meldungen .meldung:has-text("Das bräche eine Regel") button:text("Verwerfen")');
  await p.waitForTimeout(500);
  pruefe('Verwerfen: kein Plugin angelegt, nichts hängt', !existsSync(path.join(BAUSTEINE, 'betanken-kuerzen')) &&
    !(await p.evaluate(() => Huelle.eingespielt.some(e => e.name.startsWith('betanken-kuerzen') || e.name.startsWith('entladen-umverteilen')))));
  pruefe('Wächter meldet im Tagesplan nichts Neues', (await p.evaluate(() => Huelle.waechter.jetzt().length)) === 0);

  /* ---------- 3 Wunsch ist eine Regel ---------- */
  const W3 = 'Ein Auftrag dauert höchstens zwei Stunden.';
  await wunsch(W3);
  const m3 = await meldung('Gilt ab jetzt als Regel');
  pruefe('Der PO sieht nur „Gilt ab jetzt als Regel: …“', m3.includes('Gilt ab jetzt als Regel: Ein Auftrag dauert höchstens zwei Stunden.') && !m3.includes('Fertig:'), m3);
  const datei = path.join(REGELN, 'hoechstens-zwei-stunden.js');
  const text = existsSync(datei) ? readFileSync(datei, 'utf8') : '';
  pruefe('Regel als Datei mit Wortlaut, Herkunft und Pfad des Played Flows',
    text.includes(`wortlaut: ${JSON.stringify(W3)}`) && text.includes('pfad: "bodenabfertigung/tagesdisposition"') && text.includes('Wunsch wunsch-'), text);
  const r3 = await p.evaluate(() => { const r = Huelle.regeln['hoechstens-zwei-stunden']; return r && { art: r.art, wortlaut: r.wortlaut }; });
  pruefe('Regel hängt in der Seite', r3 && r3.art === 'bedingung' && r3.wortlaut === W3, r3);
  pruefe('Der Wächter prüft sie', (await p.evaluate(() => Huelle.waechter.aufrufe()['hoechstens-zwei-stunden'] || 0)) > 0);
  await p.evaluate(() => Huelle.einspielen('probe-lang.js', `Huelle.plugin({ kennung: "probe-lang", titel: "Probe: zu lang",
    abonniert: { "probe/ausloeser.lang": function (m, h) { h.sende({ objekt: "auftraege/XB933-TANK-01", aktion: "zeitaendern", parameter: { kante: "ende", zeit: "13:00" } }); } } });`));
  await p.evaluate(() => Huelle.handeln({ objekt: 'probe/ausloeser', aktion: 'lang' }, 'drehbuecher/probe'));
  await p.waitForFunction(() => !Huelle.bus.arbeitet && !Huelle.bus.warteschlange.length);
  const v3 = (await p.evaluate(() => Huelle.waechter.jetzt())).filter(v => v.regel === 'hoechstens-zwei-stunden');
  pruefe('Neue Regel gebrochen: gemeldet', v3.length === 1 && v3[0].satz.endsWith('– Ein Auftrag dauert höchstens zwei Stunden.'), v3);
  await p.click('#vonVorn');
  await bereit();

  /* ---------- 4 Plugin mit Regel der Art „ki“ ---------- */
  await wunsch('Die Flugnummer soll groß und immer gut lesbar sein.');
  const m4 = await meldung('Flugnummer ist jetzt groß');
  pruefe('Plugin eingespielt und Regel genannt', m4.includes('Gilt ab jetzt als Regel: Die Flugnummer im Balken ist immer gut lesbar.'), m4);
  const p4 = prompts().at(-1).prompt;
  pruefe('Folgeauftrag: die Regel aus Wunsch 3 wird mitgegeben', p4.includes('Ein Auftrag dauert höchstens zwei Stunden.'));
  pruefe('Regel „ki“ gespeichert, vom Wächter nicht geprüft', existsSync(path.join(REGELN, 'flugnummer-lesbar.js')) &&
    !(await p.evaluate(() => Huelle.waechter.aufrufe()['flugnummer-lesbar'])));

  /* ---------- 5 Zurücknehmen nimmt die Regel mit ---------- */
  await Promise.all([p.waitForEvent('load'), p.click('#meldungen .meldung:has-text("Flugnummer ist jetzt groß") button:text("Zurücknehmen")')]);
  await bereit();
  pruefe('Zurückgenommen: Regel und Plugin sind weg', !existsSync(path.join(REGELN, 'flugnummer-lesbar.js')) &&
    !(await p.evaluate(() => !!Huelle.regeln['flugnummer-lesbar'])) && existsSync(datei));
} catch (e) {
  fehler++;
  console.log('FEHL Abbruch:', e.message);
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
