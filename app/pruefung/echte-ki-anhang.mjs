/* Echter Lauf über das Abo, auf einer Kopie der Plugins (Auftrag 008): ein Bildschirmfoto des Tagesplans,
   auf dem ein Balken rot umrandet ist, per Strg+V am Wunsch „Dieser Balken soll beim Darüberfahren seine
   Uhrzeiten zeigen“. Die KI muss den markierten Balken aus dem Bild erkennen: Im Ergebnis (Plugin, Satz,
   Szenario oder Rückfrage) steht sein Flug. Kostet einen KI-Auftrag, gehört nicht zu den üblichen Prüfungen.
   Aufruf: node pruefung/echte-ki-anhang.mjs [Nummer des Balkens, Vorgabe 7] */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');
const NR = Number(process.argv[2]) || 7;
const WUNSCH = 'Dieser Balken soll beim Darüberfahren seine Uhrzeiten zeigen.';
const tmp = mkdtempSync(path.join(os.tmpdir(), 'play-echt-anhang-'));
const PROTOKOLL = path.join(tmp, 'ki.jsonl');
writeFileSync(PROTOKOLL, '');
const { adresse, plugindaten } = await eigeneBruecke(4365, { mitKopie: true, protokoll: PROTOKOLL });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const vorher = new Set(readdirSync(BAUSTEINE));

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('Seitenfehler:', e.message));
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const meldungen = () => p.evaluate(() => [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent));
const sek = t => Math.round((Date.now() - t) / 1000);

let ergebnis = 1;
try {
  await p.goto(adresse);
  await bereit();

  /* Balken wählen, rot umranden, Tagesplan fotografieren, Rahmen wieder weg */
  const balken = p.locator('.pl-balken').nth(NR);
  const pfad = await balken.getAttribute('data-pfad');
  const flug = (await balken.locator('span').first().textContent()).trim();
  await balken.scrollIntoViewIfNeeded();
  await p.evaluate(sel => {
    const b = document.querySelectorAll('.pl-balken')[sel].getBoundingClientRect();
    const r = document.createElement('div');
    r.id = 'markierung';
    Object.assign(r.style, { position: 'fixed', left: `${b.left - 6}px`, top: `${b.top - 6}px`, width: `${b.width + 12}px`, height: `${b.height + 12}px`, border: '3px solid #ff2020', borderRadius: '6px', zIndex: 9999, pointerEvents: 'none' });
    document.body.appendChild(r);
  }, NR);
  const plan = p.locator('.pl-rahmen').first();
  const bild = await (await plan.count() ? plan : p.locator('[data-ort="haupt"]')).screenshot();
  await p.evaluate(() => document.getElementById('markierung').remove());
  writeFileSync(path.join(tmp, 'markiert.png'), bild);
  console.log(`Markiert: Balken ${NR}, ${pfad}, Flug ${flug} · Bild ${Math.round(bild.length / 1024)} KB: ${path.join(tmp, 'markiert.png')}`);

  /* Strg+V ins Wunschfeld, wie ein Bildschirmfoto aus der Zwischenablage */
  await p.evaluate(b64 => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'image.png', { type: 'image/png' }));
    document.querySelector('#wunschFeld').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, bild.toString('base64'));
  await p.fill('#wunschFeld', WUNSCH);
  const t0 = Date.now();
  await p.click('#wunsch button');

  /* Fortschritt: was die KI gerade tut, alle 10 s */
  const gesehen = new Set();
  let fertig = null;
  while (!fertig && Date.now() - t0 < 12 * 60000) {
    const m = await meldungen();
    m.forEach(x => { if (/KI |Probelauf/.test(x) && !gesehen.has(x.replace(/\d+/g, '#'))) { gesehen.add(x.replace(/\d+/g, '#')); console.log(`  ${sek(t0)} s: ${x.replace(/×$/, '')}`); } });
    fertig = m.find(x => /^(Fertig|Das ließ sich nicht|Rückfrage|Das bräche)/.test(x));
    if (!fertig) await p.waitForTimeout(2000);
  }
  console.log(`Ergebnis nach ${sek(t0)} s: ${fertig || 'keins (Zeit abgelaufen)'}`);

  const k = JSON.parse(readFileSync(PROTOKOLL, 'utf8').trim().split('\n')[0]);
  console.log('Der KI genannte Anhänge:', k.anhaenge);
  const neu = readdirSync(BAUSTEINE).filter(x => !vorher.has(x));
  let text = fertig || '';
  for (const n of neu) {
    const h = JSON.parse(readFileSync(path.join(BAUSTEINE, n, 'herkunft.json'), 'utf8'));
    const ordner = path.join(BAUSTEINE, n);
    const dateien = readdirSync(ordner).filter(d => d.endsWith('.js'));
    for (const d of dateien) text += '\n' + readFileSync(path.join(ordner, d), 'utf8');
    console.log(`Neues Plugin ${n}: „${h.name}“ · ${h.kurz}`);
    console.log('  Anhänge in der Herkunft:', JSON.stringify(h.wuensche[0].anhaenge));
  }
  const kennung = pfad.split('/').pop();
  const flugOhne = flug.replace(/\s+/g, '');
  const erkannt = text.includes(kennung) || text.replace(/\s+/g, '').includes(flugOhne);
  console.log(erkannt ? `ok   Die KI hat den markierten Balken erkannt (${flug}, ${kennung} kommt im Ergebnis vor).`
    : `FEHL Im Ergebnis kommt der markierte Balken (${flug}, ${kennung}) nicht vor.`);
  ergebnis = erkannt ? 0 : 1;
} finally {
  await browser.close();
}
process.exit(ergebnis);
