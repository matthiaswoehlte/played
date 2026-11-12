/* Prüft Auftrag 007: Steuerbereich und Nutzbereich getrennt.
   - Im Nutzbereich steht nur, was Plugins zeichnen (dazu Titel und Untertitel des Tages); jedes
     Plugin zeichnet nur dort, auch während des Vorspielens.
   - Eingeklappt: Spielzeit, Play, Von vorn, Erzählzeile, Zähler; ein Szenario läuft damit durch.
   - Aufgeklappt: Plugins, Abweichungen, Regelverstöße in der Spalte des Steuerbereichs.
   - „Nur Anwendung“ schaltet den Steuerbereich weg, ein Griff holt ihn zurück; der Zustand bleibt nach dem Neuladen.
   Läuft auf einer Kopie; ein Sollergebnis wird in der Kopie verändert, damit es eine Abweichung gibt.
   Aufruf: node pruefung/steuerbereich.mjs */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse: ADRESSE, ordner: SOLL } = await eigeneBruecke(4336, { mitKopie: true });

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

/* Damit es eine Abweichung gibt: In der Kopie fehlt im Sollergebnis von „Krankmeldung MA-01“ das Suchfeld. */
{
  const datei = path.join(SOLL, 'krankmeldung-ma-01.json');
  const s = JSON.parse(readFileSync(datei, 'utf8'));
  Object.values(s.je).forEach(e => { e.sichten.gantt = e.sichten.gantt.filter(p => p !== 'kennzahlen/suche'); });
  writeFileSync(datei, JSON.stringify(s, null, 2));
}

/* Was im Nutzbereich steht, das nicht von einem Plugin stammt (leer = sauber). */
const fremdImNutzbereich = p => p.evaluate(() => {
  const n = document.querySelector('#nutzbereich');
  const erlaubt = new Set([...n.querySelectorAll(':scope > .kopf, :scope > .kopf > #titel, :scope > .kopf > #untertitel, :scope > .orte, :scope > .orte > .ort')]);
  const plugins = new Set(Huelle.verwaltung.eintraege().map(e => e.kennung));
  const fremd = [];
  n.querySelectorAll('*').forEach(e => {
    if (erlaubt.has(e)) return;
    const sicht = e.closest('.sicht');
    if (!sicht || !n.contains(sicht) || !plugins.has(sicht.dataset.sicht) || sicht.parentElement.dataset.ort === undefined)
      fremd.push(e.tagName + (e.id ? '#' + e.id : '') + '.' + e.className);
  });
  return fremd.slice(0, 10);
});
const sichtenAusserhalb = p => p.evaluate(() => [...document.querySelectorAll('.sicht')].filter(s => !document.querySelector('#nutzbereich').contains(s)).map(s => s.dataset.sicht));
const sichtbar = (p, sel) => p.isVisible(sel);
const rechteck = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, unten: r.bottom }; }, sel);

const browser = await chromium.launch({ args: ['--site-per-process'] });
const kontext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await kontext.newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });

try {
  await p.goto(ADRESSE);
  await p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 120000 });

  /* ---------- Nutzbereich: nur Plugins ---------- */
  pruefe('Anfangs aufgeklappt', await p.evaluate(() => Huelle.steuer.zustand()) === 'auf' && await sichtbar(p, '#wunschFeld'));
  pruefe('Nutzbereich enthält nur Ansichten von Plugins', (await fremdImNutzbereich(p)).length === 0, await fremdImNutzbereich(p));
  pruefe('Jedes Plugin zeichnet in den Nutzbereich', (await sichtenAusserhalb(p)).length === 0, await sichtenAusserhalb(p));
  pruefe('Kein Teil des Werkzeugs im Nutzbereich', await p.evaluate(() => ['steuerbereich', 'verwaltung', 'wunsch', 'meldungen', 'ergebnis', 'zeile', 'play', 'steuerGriff']
    .every(id => !document.querySelector('#nutzbereich').contains(document.getElementById(id)))));
  pruefe('Titel des Tages steht im Nutzbereich', (await p.textContent('#nutzbereich #titel')).length > 0);

  /* ---------- Eingeklappt vorspielen ---------- */
  await p.selectOption('#wahl', 'krankmeldung-ma-20');
  await p.click('#tempo button[data-wert="4"]');
  await p.click('#steuerAuf');
  pruefe('Eingeklappt: Spielzeit, Play, Von vorn, Erzählzeile sichtbar',
    (await sichtbar(p, '#uhr')) && (await sichtbar(p, '#play')) && (await sichtbar(p, '#vonVorn')) && (await sichtbar(p, '.erzaehlung')));
  pruefe('Eingeklappt: Wunschfeld, Szenarienwahl, Plugins und Spalte weg',
    !(await sichtbar(p, '#wunschFeld')) && !(await sichtbar(p, '#wahl')) && !(await sichtbar(p, '#pluginKnopf')) && !(await sichtbar(p, '#verwaltung')));
  pruefe('Eingeklappt: Zähler der Abweichungen steht im Band', await sichtbar(p, '#abweichKnopf'), await p.textContent('#abweichKnopf'));
  const band = await rechteck(p, '#steuerbereich');
  await p.click('#play');
  let fremdUnterwegs = [], hoeheGleich = true, abstand = 0;
  for (let i = 0; i < 400; i++) {
    if (await p.textContent('#play') === 'Nochmal') break;
    fremdUnterwegs = fremdUnterwegs.concat(await fremdImNutzbereich(p));
    if ((await rechteck(p, '#steuerbereich')).h !== band.h) hoeheGleich = false;
    await p.waitForTimeout(100);
  }
  await p.waitForFunction(() => document.querySelector('#play').textContent === 'Nochmal', null, { timeout: 90000 });
  pruefe('Beim Vorspielen zeichnet die Hülle nichts Eigenes in den Nutzbereich', fremdUnterwegs.length === 0, fremdUnterwegs.slice(0, 10));
  pruefe('Das Band ändert beim Vorspielen seine Höhe nicht (der Tagesplan rutscht nicht)', hoeheGleich);
  pruefe('Szenario endet wie festgehalten', (await p.getAttribute('#ergebnis', 'class')).includes('gruen'), await p.textContent('#ergebnis'));
  const zeile = await rechteck(p, '#zeile'), plan = await rechteck(p, '[data-sicht="gantt"]');
  abstand = plan.y - zeile.unten;
  pruefe('Erzählzeile steht direkt über dem Tagesplan', abstand >= 0 && abstand < 120, { abstand });
  pruefe('Tagesplan bekommt den größten Teil der Breite', plan.w > 1600 * 0.7 - 310, plan);
  pruefe('Erzählzeile zeigt das Szenario', (await p.textContent('#zeile')).length > 5);

  /* ---------- Aufklappen: Plugins, Abweichungen, Regelverstöße ---------- */
  await p.click('#abweichKnopf');
  pruefe('Klick auf den Zähler klappt auf und zeigt die Abweichungen', await p.evaluate(() => Huelle.steuer.zustand()) === 'auf' && await sichtbar(p, '#abweichungen'));
  await p.click('#pluginKnopf');
  pruefe('Plugins stehen in der Spalte des Steuerbereichs', await sichtbar(p, '#leiste') && await p.evaluate(() => !document.querySelector('#nutzbereich').contains(document.querySelector('#leiste'))));
  pruefe('Regelverstöße gehören zur Spalte des Steuerbereichs', await p.evaluate(() => document.querySelector('#verwaltung').contains(document.querySelector('#verstoesse'))));
  pruefe('Tagesplan bleibt sichtbar', (await rechteck(p, '[data-sicht="gantt"]')).w > 500);
  pruefe('Wunschfeld und Ergebnis wieder da', await sichtbar(p, '#wunschFeld') && await sichtbar(p, '#ergebnis'));
  /* Anweisung 41: Einträge wechseln mit zwei dezenten Grautönen; Ampelfarben bleiben darüber. */
  const wechsel = await p.evaluate(() => {
    const hg = e => getComputedStyle(e).backgroundColor;
    const pl = [...document.querySelectorAll('#pluginListe > .plugin')].slice(0, 4).map(hg);
    const grau = c => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m && m[1] === m[2] && m[2] === m[3] && +(m[4] ?? 1) <= 0.2; };
    const rand = getComputedStyle(document.querySelector('#verstoesse')).borderTopColor;
    return { pl, ok: pl.length >= 4 && pl[0] !== pl[1] && pl[0] === pl[2] && pl[1] === pl[3] && pl.every(grau), rand };
  });
  pruefe('Plugins wechseln hell und dunkel in neutralem Grau', wechsel.ok, wechsel);
  pruefe('Der rote Rahmen der Regelverstöße bleibt rot', /rgb\(255, 111, 97\)/.test(wechsel.rand), wechsel.rand);

  /* ---------- Nur Anwendung ---------- */
  await p.click('#steuerWeg');
  pruefe('Nur Anwendung: Steuerbereich und Spalte weg', !(await sichtbar(p, '#steuerbereich')) && !(await sichtbar(p, '#verwaltung')));
  pruefe('Nur Anwendung: der Nutzbereich beginnt oben', (await rechteck(p, '#nutzbereich')).y < 30);
  pruefe('Nur Anwendung: ein Griff holt ihn zurück', await sichtbar(p, '#steuerGriff'));
  await p.reload();
  await p.waitForFunction(() => window.Huelle?.geladen);
  pruefe('Nach dem Neuladen bleibt nur die Anwendung', !(await sichtbar(p, '#steuerbereich')) && await sichtbar(p, '#steuerGriff'));
  await p.click('#steuerGriff');
  pruefe('Griff bringt das eingeklappte Band zurück', await sichtbar(p, '#play') && !(await sichtbar(p, '#wunschFeld')) && !(await sichtbar(p, '#steuerGriff')));
  await p.reload();
  await p.waitForFunction(() => window.Huelle?.geladen);
  pruefe('Nach dem Neuladen bleibt es eingeklappt', await sichtbar(p, '#play') && !(await sichtbar(p, '#wunschFeld')));
  /* ---------- Meldungen eingeklappt: ein Zähler ---------- */
  await p.evaluate(() => Huelle.player.melde('Prüfmeldung', 'hinweis'));
  pruefe('Eingeklappt: Zähler zeigt die Meldung', await sichtbar(p, '#meldungZaehler') && (await p.textContent('#meldungZaehler')) === '1 Meldung');
  await p.click('#meldungZaehler');
  pruefe('Klick auf den Zähler zeigt die Meldung', await sichtbar(p, '#meldungen .meldung') && !(await sichtbar(p, '#meldungZaehler')));
  /* Anweisung 35: höchstens 40 %, Meldungen rollen, die Leiste bleibt sichtbar */
  await p.evaluate(() => { for (let i = 0; i < 40; i++) Huelle.player.melde('Prüfmeldung ' + i, 'hinweis'); });
  const maß = await p.evaluate(() => { const m = document.querySelector('#meldungen'); const b = document.querySelector('#steuerbereich').getBoundingClientRect(); const n = document.querySelector('#nutzbereich').getBoundingClientRect(); const l = document.querySelector('.steuer-immer').getBoundingClientRect(); return { b: b.height, n: n.height, h: innerHeight, rollt: m.scrollHeight > m.clientHeight, leiste: l.top >= 0 && l.bottom <= b.bottom }; });
  pruefe('Steuerbereich höchstens 40 %, Nutzbereich mindestens 60 %, Meldungen rollen, Leiste sichtbar', maß.b <= maß.h * 0.4 + 1 && maß.n >= maß.h * 0.6 - 30 && maß.rollt && maß.leiste, maß);
  pruefe('Mehr/Weniger steht aufgeklappt auf „Weniger“', (await p.textContent('#steuerAuf')) === 'Weniger');
  pruefe('Im Browser nur Ansichten', await p.evaluate(() => Object.keys(localStorage).every(k => /^play\/(leiste|waechter|luecken|player|steuer)/.test(k))), await p.evaluate(() => Object.keys(localStorage)));
} finally {
  await browser.close();
}
console.log(fehler ? `${fehler} FEHL` : 'Alles grün');
process.exit(fehler ? 1 : 0);
