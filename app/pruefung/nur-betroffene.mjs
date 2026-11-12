/* Prüft Anweisung 18 (b) des PO (09.11.): Der Probelauf eines Wunsches spielt nur die Szenarien, in deren
   Ketten das geänderte Plugin beim letzten Abspielen gearbeitet hat; bei einem neuen Plugin oder einem, das
   nur zeichnet, alle. Dazu die Testvorlage (a): Die Prüfungen sehen nie die Dispo des PO.
   Aufruf: node pruefung/nur-betroffene.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke, VORLAGE } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse, plugindaten, gearbeitet } = await eigeneBruecke(4395, { mitKopie: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 700) : ''}`);
}

pruefe('die Prüf-Brücke nimmt ihre Plugins aus der Testvorlage',
  JSON.stringify(readdirSync(path.join(plugindaten, 'bausteine')).sort()) === JSON.stringify(readdirSync(path.join(VORLAGE, 'plugins', 'bausteine')).sort()));

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
await p.goto(adresse);
await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 180000 });

/* Anweisung 20: Nach dem Abspielen steht im Projektordner, wer in welchem Szenario gearbeitet hat */
for (let i = 0; i < 50 && !existsSync(gearbeitet); i++) await new Promise(r => setTimeout(r, 100));
const gemerkt = existsSync(gearbeitet) ? JSON.parse(readFileSync(gearbeitet, 'utf8')) : {};
pruefe('gemerkt: Krankmeldung hat im Szenario mit der Krankmeldung gearbeitet, mit Datum',
  gemerkt['krankmeldung-ma-01']?.plugins.includes('verhalten-krankmeldung') && /^\d{4}-\d{2}-\d{2}$/.test(gemerkt['krankmeldung-ma-01'].datum), gemerkt);
pruefe('gemerkt: im Szenario ohne Krankmeldung nicht', gemerkt['wunsch-004'] && !gemerkt['wunsch-004'].plugins.includes('verhalten-krankmeldung'), gemerkt['wunsch-004']);

const wahl = await p.evaluate(() => ({
  alle: Huelle.drehbuecher.length,
  krank: Huelle.verwaltung.betroffene(['verhalten-krankmeldung']),
  zeichnet: Huelle.verwaltung.betroffene(['gantt']),
  neu: Huelle.verwaltung.betroffene(['gibt-es-noch-nicht'])
}));
pruefe('ein Wunsch an „Krankmeldung ab Zeitpunkt“ betrifft nur die Szenarien mit einer Krankmeldung, nicht alle',
  !!wahl.krank && ['krankmeldung-ma-01', 'krankmeldung-ma-20'].every(k => wahl.krank.includes(k)) && wahl.krank.length < wahl.alle &&
  !wahl.krank.includes('wunsch-004'), wahl);
pruefe('der Tagesplan zeichnet in jedem Szenario, ein Wunsch an ihm betrifft also alle',
  wahl.zeichnet === null || wahl.zeichnet.length === wahl.alle, wahl);
pruefe('ein neues Plugin betrifft alle Szenarien', wahl.neu === null, wahl);

/* Probelauf mit einer geänderten Fassung von „Krankmeldung ab Zeitpunkt“: nur die betroffenen Szenarien */
const t0 = Date.now();
const probe = await p.evaluate(() => new Promise(ok => {
  const datei = { name: 'test-krankmeldung.js', quelle: `/* geändert */ Huelle.plugin({ kennung: "verhalten-krankmeldung", titel: "Krankmeldung ab Zeitpunkt",
    platz: { kennung: "krankmeldung", titel: "Bei Krankmeldung", variante: "Aufträge lösen" },
    besitzt: ["mitarbeiter/*/abwesend", "mitarbeiter/*/grund", "mitarbeiter/*/abwesendAb"],
    abonniert: { "mitarbeiter/*.krankmeldung": function (m, h) {
      var id = m.objekt.split("/")[1], ab = m.parameter.ab, wer = h.lies(m.objekt + "/name") || id;
      h.setze(m.objekt + "/abwesend", true); h.setze(m.objekt + "/grund", "krank"); h.setze(m.objekt + "/abwesendAb", ab);
      h.alle("auftraege").filter(function (a) { return a.mitarbeiter === id && h.minuten(a.ende) > h.minuten(ab); }).forEach(function (a) {
        h.sende({ objekt: "auftraege/" + a.kennung, aktion: "loesen", parameter: { grund: "krank", mitarbeiter: id },
          erzaehlung: "Krankmeldung " + wer + " → " + a.flug + " " + a.arbeit + " jetzt ohne Mitarbeiter" });
      });
    } } });` };
  const auswahl = Huelle.verwaltung.betroffene(['verhalten-krankmeldung']);
  let gesamt = 0;
  Huelle.nachspiel.probe([datei], [], r => ok({ r, gesamt, auswahl }), (f, g) => { gesamt = Math.max(gesamt, g); }, auswahl);
}));
console.log(`     Probelauf mit ${probe.auswahl.length} von ${wahl.alle} Szenarien: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
pruefe('der Probelauf spielt nur die betroffenen Szenarien (je ohne und mit dem Neuen)', probe.gesamt === 2 * probe.auswahl.length && probe.auswahl.length < wahl.alle, probe);
pruefe('und geht ohne Ausfall und ohne Regelverstoß durch', !probe.r.ausfaelle.length && !probe.r.verstoesse.length, probe.r);

await browser.close();
console.log(fehler ? `${fehler} Prüfung(en) rot` : 'alles grün');
process.exit(fehler ? 1 : 0);
