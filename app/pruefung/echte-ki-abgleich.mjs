/* Echte Läufe über das Abo für Auftrag 006, Stufe 3, auf einer Kopie der Plugins und Regeln:
   1. ein gewöhnlicher Wunsch, der keinen Überschuss melden soll;
   2. der Pausen-Wunsch: Fasst die KI die Regel enger, soll der Abgleich das melden (PO 07.11., Punkt 5);
   3. „Die Seite soll bei 50 gleichzeitigen Benutzern in unter einer Sekunde antworten“ landet als nicht zeigbar.
   Kostet sechs bis acht KI-Aufträge, gehört nicht zu den üblichen Prüfungen. Meldet sich unterwegs.
   Aufruf: node pruefung/echte-ki-abgleich.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const { adresse, plugindaten, regeln: REGELN, abgleich: ABGLEICH } = await eigeneBruecke(4335, { mitKopie: true });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const abgleiche = () => existsSync(ABGLEICH) ? JSON.parse(readFileSync(ABGLEICH, 'utf8')) : [];
const WUENSCHE = [
  ['gewöhnlich', 'Die Flugnummer im Balken soll fett geschrieben sein.'],
  ['Pause', 'Ein Mitarbeiter arbeitet höchstens vier Stunden ohne Pause.'],
  ['nicht zeigbar', 'Die Seite soll bei 50 gleichzeitigen Benutzern in unter einer Sekunde antworten.'],
];

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz).slice(0, 800) : ''}`);
}
const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('Seitenfehler:', e.message));
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 120000 });
const texte = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent.replace(/×$/, '')));
const sek = t0 => Math.round((Date.now() - t0) / 1000);

async function warteAufEnde(t0) {
  for (;;) {
    const m = await texte();
    const ende = m.find(t => /^(Fertig|Gilt ab jetzt|Lässt sich hier nicht zeigen|Das bräche|Das ließ sich nicht|Rückfrage)/.test(t));
    if (ende) return ende;
    if (sek(t0) > 12 * 60) throw new Error('nach 12 Minuten kein Ergebnis');
    const lauf = m.find(t => /^(Dein Wunsch|Probelauf|Wird)/.test(t));
    process.stdout.write(`\r     ${sek(t0)} s: ${(lauf || '').slice(0, 110).padEnd(110)}`);
    await p.waitForTimeout(3000);
  }
}
async function warteAufAbgleich(id, t0) {
  for (;;) {
    const e = abgleiche().filter(x => x.wunsch === id).at(-1);
    if (!e || e.status !== 'laeuft') { process.stdout.write('\n'); return e; }
    process.stdout.write(`\r     Abgleich läuft, ${sek(t0)} s`.padEnd(60));
    await p.waitForTimeout(2000);
  }
}

try {
  await p.goto(adresse);
  await bereit();
  for (const [i, [name, text]] of WUENSCHE.entries()) {
    console.log(`[${i + 1}/${WUENSCHE.length}] ${name}: „${text}“`);
    const t0 = Date.now();
    const vorher = new Set(abgleiche().map(e => e.wunsch));
    await p.evaluate(() => document.querySelectorAll('#meldungen .meldung').forEach(m => m.remove()));
    await p.fill('#wunschFeld', text);
    await p.click('#wunsch button[type="submit"]');
    const ende = await warteAufEnde(t0);
    console.log(`\n     Ergebnis nach ${sek(t0)} s: ${ende}`);
    const id = await p.evaluate(() => fetch('/abgleich').then(r => r.json())).then(() => null);
    await p.waitForTimeout(1500);
    const neu = abgleiche().filter(e => !vorher.has(e.wunsch));
    const e = neu.length ? await warteAufAbgleich(neu.at(-1).wunsch, t0) : null;
    if (e) console.log(`     Abgleich nach ${sek(t0)} s: ${e.status} · mehr ${JSON.stringify(e.mehr.map(x => x.was))} · enger ${JSON.stringify(e.enger.map(x => x.was))} · Einschätzungen ${JSON.stringify(e.verstoesse.map(x => x.satz))}`);
    await p.waitForTimeout(1500);
    const angebote = await p.evaluate(() => Huelle.abgleich.offen().map(o => o.satz));
    if (angebote.length) console.log('     Angeboten: ' + angebote.join(' | '));
    if (name === 'gewöhnlich') {
      pruefe('Gewöhnlicher Wunsch: eingespielt', ende.startsWith('Fertig'), ende);
      pruefe('Gewöhnlicher Wunsch: kein Überschuss gemeldet', e?.status === 'fertig' && !e.mehr.length && !angebote.length, e);
    }
    if (name === 'Pause') {
      pruefe('Pause: eingespielt, mit Regel', /Gilt ab jetzt als Regel/.test(ende), ende);
      const regel = readdirSync(REGELN).filter(n => /pause/i.test(n)).map(n => readFileSync(path.join(REGELN, n), 'utf8'))[0];
      if (regel) console.log('     Regel: ' + (/satz: (".*")/.exec(regel) || [])[1]);
      console.log(`     Pause: ${e?.enger.length ? 'enger gemeldet' : 'nichts enger gemeldet'}${e?.mehr.length ? ', Überschuss gemeldet' : ''}`);
    }
    if (name === 'nicht zeigbar') {
      pruefe('Nicht zeigbar: als Satz vermerkt, nicht nachgestellt', ende.startsWith('Lässt sich hier nicht zeigen, ist vermerkt'), ende);
      pruefe('Nicht zeigbar: Zähler steht da', /lässt sich hier nicht zeigen|lassen sich hier nicht zeigen/.test(await p.textContent('#nichtZeigbarKnopf')));
      pruefe('Nicht zeigbar: kein Abgleich', !e);
    }
    void id;
  }
  console.log('     Neue Plugins in der Kopie: ' + JSON.stringify(readdirSync(BAUSTEINE).filter(k => !existsSync(path.join(HIER, '..', 'plugins', 'bausteine', k)))));
} finally {
  await browser.close();
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
