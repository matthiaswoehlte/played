/* Prüft Auftrag 008: Wunsch mit Bildschirmfotos und Dateien, Antwort auf eine Rückfrage, „So machen“.
   Einfügen (Strg+V), Ziehen aufs Feld, Knopf „Anhängen…“, Entfernen, Ablehnen einer unerlaubten Art,
   Ablage neben der Herkunft, .js aufs Feld als Anhang und daneben als Einspielen, Excel mit zwei Blättern
   als zwei CSV für die KI, Anhänge beim Wunsch in der Leiste, Ändern mit Anhang.
   Die KI ist eine Attrappe mit festen Antworten; was sie bekommen hätte, steht im Protokoll.
   Läuft auf einer Kopie der Plugins. Aufruf: node pruefung/anhaenge.mjs */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { eigeneBruecke } from './eigene-bruecke.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HIER, '..', '..', '..', 'CCIDE-CODE', 'package.json'));
const { chromium } = require('playwright');

/* ---------- Testdateien ---------- */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/* Kleinste Excel-Datei mit zwei Blättern, ungepackt im ZIP */
function zip(dateien) {
  const lokal = [], zentral = [];
  let pos = 0;
  for (const [name, text] of Object.entries(dateien)) {
    const n = Buffer.from(name), d = Buffer.from(text), crc = zlib.crc32(d);
    const k = Buffer.alloc(30);
    k.writeUInt32LE(0x04034b50, 0); k.writeUInt16LE(20, 4); k.writeUInt32LE(crc, 14);
    k.writeUInt32LE(d.length, 18); k.writeUInt32LE(d.length, 22); k.writeUInt16LE(n.length, 26);
    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt32LE(crc, 16);
    z.writeUInt32LE(d.length, 20); z.writeUInt32LE(d.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(pos, 42);
    lokal.push(k, n, d);
    zentral.push(z, n);
    pos += 30 + n.length + d.length;
  }
  const zgr = zentral.reduce((s, b) => s + b.length, 0);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(dateien).length, 8); e.writeUInt16LE(Object.keys(dateien).length, 10);
  e.writeUInt32LE(zgr, 12); e.writeUInt32LE(pos, 16);
  return Buffer.concat([...lokal, ...zentral, e]);
}
const XLSX = zip({
  'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Schichten" sheetId="1" r:id="rId1"/><sheet name="Gruppen &amp; Leiter" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Name</t></si><si><t>Beginn</t></si><si><t>Reindl, I.</t></si><si><r><t>Lade</t></r><r><t>gruppe 1</t></r></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>0.25</v></c></row></sheetData></worksheet>',
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c><c r="C1" t="inlineStr"><is><t>V. Engström</t></is></c></row></sheetData></worksheet>',
});

const ordnerTmp = mkdtempSync(path.join(os.tmpdir(), 'play-anhang-test-'));
const XLSX_DATEI = path.join(ordnerTmp, 'Dienstplan.xlsx');
writeFileSync(XLSX_DATEI, XLSX);

/* ---------- KI-Attrappe ---------- */
const antwort = felder => ({ rueckfrage: null, teile: null, drehbuch: null, zeigen: null, plugin: null, aenderungen: [], regel: null, erwartungen: [], ...felder });
const neu = (kennung, kurz) => antwort({ art: 'neu', kennung, name: kurz, kurz, plugin: `Huelle.plugin({ kennung: "${kennung}", titel: "${kurz}", stil: ".pl-${kennung} { color: red; }" });` });
const ATTRAPPE = path.join(ordnerTmp, 'antworten.json');
writeFileSync(ATTRAPPE, JSON.stringify([
  /* 1 Wunsch mit vier Anhängen */
  neu('anhang-a', 'Uhrzeiten am Balken.'),
  /* 2 Wunsch mit Rückfrage ohne Aufteilung, 3 nach der Antwort */
  antwort({ art: 'neu', kennung: '', name: '', kurz: '', rueckfrage: 'Welcher Balken ist gemeint, der von XC 810 oder der von XC 812?' }),
  neu('anhang-b', 'Der Balken von XC 812 zeigt seine Uhrzeiten.'),
  /* 4 Wunsch mit Rückfrage und Aufteilung, 5 und 6 die beiden Teile */
  antwort({ art: 'neu', kennung: '', name: '', kurz: '', rueckfrage: 'Ihr Wunsch besteht aus zwei Teilen. Passt diese Reihenfolge?',
    teile: ['Uhrzeiten am Balken beim Darüberfahren', 'Dauer in Minuten unter der Flugnummer'] }),
  neu('teil-eins', 'Uhrzeiten beim Darüberfahren.'),
  neu('teil-zwei', 'Dauer unter der Flugnummer.'),
  /* 7 Ändern mit Anhang */
  antwort({ art: 'aendern', kennung: 'anhang-a', name: 'Uhrzeiten am Balken', kurz: 'Jetzt blau.', aenderungen: [{ alt: 'color: red;', neu: 'color: blue;' }] }),
]));
const PROTOKOLL = path.join(ordnerTmp, 'ki.jsonl');
writeFileSync(PROTOKOLL, '');
const protokoll = () => readFileSync(PROTOKOLL, 'utf8').trim().split('\n').filter(Boolean).map(z => JSON.parse(z)).filter(x => !x.abgleich);

const { adresse, plugindaten } = await eigeneBruecke(4364, { mitKopie: true, attrappe: ATTRAPPE, protokoll: PROTOKOLL });
const BAUSTEINE = path.join(plugindaten, 'bausteine');
const herkunft = k => JSON.parse(readFileSync(path.join(BAUSTEINE, k, 'herkunft.json'), 'utf8'));

let fehler = 0;
function pruefe(name, ok, zusatz) {
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && zusatz !== undefined ? '  → ' + JSON.stringify(zusatz) : ''}`);
}

const browser = await chromium.launch({ args: ['--site-per-process'] });
const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on('pageerror', e => { fehler++; console.log('FEHL Seitenfehler:', e.message); });
const bereit = () => p.waitForFunction(() => window.Huelle?.geladen && Huelle.verwaltung.fertig(), null, { timeout: 90000 });
const meldung = text => p.waitForSelector(`#meldungen .meldung:has-text("${text}")`, { timeout: 90000 });
const chips = (wo = '#wunsch') => p.$$eval(`${wo} .anhang-vorschau .anhang-name`, l => l.map(x => x.textContent));

/* Datei als Ereignis an ein Element: paste (Zwischenablage) oder dragover+drop (Ziehen) */
async function ereignis(auswahl, art, dateien, text) {
  await p.evaluate(({ auswahl, art, dateien, text }) => {
    const dt = new DataTransfer();
    for (const d of dateien) {
      const roh = Uint8Array.from(atob(d.b64), c => c.charCodeAt(0));
      dt.items.add(new File([roh], d.name, { type: d.typ || '' }));
    }
    if (text) dt.setData('text/plain', text);
    const ziel = document.querySelector(auswahl);
    if (art === 'paste') ziel.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    else {
      ziel.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      ziel.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, { auswahl, art, dateien, text });
}
const b64 = text => Buffer.from(text).toString('base64');

try {
  await p.goto(adresse);
  await bereit();

  /* ---------- Feld ---------- */
  pruefe('Wunschfeld ist mehrzeilig', await p.evaluate(() => document.querySelector('#wunschFeld').tagName === 'TEXTAREA'));
  await p.fill('#wunschFeld', 'Zeile eins');
  await p.focus('#wunschFeld');
  await p.keyboard.press('End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Zeile zwei');
  pruefe('Enter macht eine neue Zeile und schickt nicht ab', (await p.inputValue('#wunschFeld')) === 'Zeile eins\nZeile zwei' && !(await p.$('#meldungen .meldung.arbeit')));
  await p.fill('#wunschFeld', '');

  /* ---------- Einfügen, Ziehen, Knopf, Entfernen, Ablehnen ---------- */
  await ereignis('#wunschFeld', 'paste', [{ name: 'image.png', typ: 'image/png', b64: PNG }]);
  let c = await chips();
  pruefe('Strg+V: Bildschirmfoto wird Anhang mit Vorschaubild', c.length === 1 && /^Bildschirmfoto .*\.png$/.test(c[0]) && !!(await p.$('#wunsch .anhang img')), c);
  await ereignis('#wunschFeld', 'paste', [{ name: 'image.png', typ: 'image/png', b64: PNG }], 'Reindl\t08:00\nEngström\t09:00');
  pruefe('Strg+V mit Text (aus Excel kopierte Zellen): bleibt Text, kein Anhang', (await chips()).length === 1);
  await ereignis('#wunschFeld', 'drop', [{ name: 'Beschreibung.md', typ: 'text/markdown', b64: b64('# Uhrzeiten\nBeim Darüberfahren Beginn und Ende zeigen.') }]);
  await ereignis('#wunschFeld', 'drop', [{ name: 'eigenes-plugin.js', typ: 'text/javascript', b64: b64('Huelle.plugin({ kennung: "aufs-feld", titel: "Aufs Feld" });') }]);
  c = await chips();
  pruefe('Ziehen aufs Feld: Datei wird Anhang', c.includes('Beschreibung.md'), c);
  pruefe('.js aufs Feld: Anhang, nicht eingespielt', c.includes('eigenes-plugin.js') && !(await p.evaluate(() => Huelle.verwaltung.eintraege().some(e => e.art === 'datei' && e.name === 'eigenes-plugin.js'))));
  await p.setInputFiles('#wunsch .anhaenge input[type=file]', [XLSX_DATEI]);
  c = await chips();
  pruefe('Knopf „Anhängen…“: Datei wird Anhang', c.includes('Dienstplan.xlsx'), c);
  await ereignis('#wunschFeld', 'drop', [{ name: 'programm.exe', b64: b64('MZ') }]);
  const hinweis = await p.textContent('#wunsch .anhang-hinweis');
  pruefe('Unerlaubte Art: abgelehnt mit einem Satz, welche Arten gehen', (await chips()).length === 4 && hinweis.includes('„programm.exe“ lässt sich nicht anhängen') && hinweis.includes('Excel (.xlsx)'), hinweis);
  await ereignis('#wunschFeld', 'drop', [{ name: 'weg.txt', typ: 'text/plain', b64: b64('weg') }]);
  await p.click('#wunsch .anhang:has-text("weg.txt") .anhang-weg');
  pruefe('Entfernen: ein Klick', !(await chips()).includes('weg.txt') && (await chips()).length === 4);

  /* ---------- Abschicken: Ablage, KI bekommt Pfade, Excel als zwei CSV ---------- */
  await p.fill('#wunschFeld', 'Dieser Balken soll beim Darüberfahren seine Uhrzeiten zeigen.');
  await p.keyboard.press('Control+Enter');
  pruefe('Strg+Enter schickt ab, Feld und Anhänge leer', (await p.inputValue('#wunschFeld')) === '' && (await chips()).length === 0);
  await meldung('Fertig: Uhrzeiten am Balken.');
  const h = herkunft('anhang-a');
  const w = h.wuensche[0];
  const ablage = path.join(BAUSTEINE, 'anhang-a', 'anhaenge', w.kennung);
  pruefe('Herkunft: Anhänge am Wunsch und an der Fassung', w.anhaenge?.length === 4 && h.fassungen[0].anhaenge?.length === 4, w.anhaenge);
  pruefe('Ablage neben herkunft.json', w.anhaenge.every(x => existsSync(path.join(BAUSTEINE, 'anhang-a', x.pfad))) && existsSync(path.join(ablage, 'Dienstplan.xlsx')), w.anhaenge?.map(x => x.pfad));
  const bild = w.anhaenge.find(x => x.typ === 'png');
  pruefe('Bildschirmfoto unverändert abgelegt', !!bild && readFileSync(path.join(BAUSTEINE, 'anhang-a', bild.pfad)).equals(Buffer.from(PNG, 'base64')));
  const k1 = protokoll()[0];
  pruefe('KI bekommt die Pfade und den Auftrag, sie zu lesen', k1.prompt.includes('# Anhänge') && k1.prompt.includes('Lies jede mit dem Werkzeug Read') && k1.anhaenge.length === 5, k1.anhaenge);
  const csv = k1.anhaenge.filter(a => a.endsWith('.csv'));
  pruefe('Excel mit zwei Blättern: zwei CSV, Blattname im Dateinamen', csv.length === 2 && /Dienstplan\.Schichten\.csv$/.test(csv[0]) && /Dienstplan\.Gruppen _ Leiter\.csv$/.test(csv[1]), csv);
  pruefe('CSV-Inhalt je Blatt', readFileSync(csv[0], 'utf8') === 'Name,Beginn\n"Reindl, I.",0.25\n' && readFileSync(csv[1], 'utf8') === 'Ladegruppe 1,,V. Engström\n', [readFileSync(csv[0], 'utf8'), readFileSync(csv[1], 'utf8')]);
  pruefe('KI bekommt die Excel-Datei selbst nicht, nur die CSV', !k1.anhaenge.some(a => a.endsWith('.xlsx')) && k1.prompt.includes('Blatt „Schichten“ der Excel-Datei „Dienstplan.xlsx“'));

  /* ---------- Leiste: Anhänge beim Wunsch, zum Öffnen ---------- */
  await p.locator('[data-plugin="anhang-a"]').waitFor({ timeout: 30000 }).catch(() => {});
  await bereit();
  await p.evaluate(() => Huelle.leiste.zeige('anhang-a'));
  const links = await p.$$eval('[data-plugin="anhang-a"] .herkunft-anhaenge a', l => l.map(a => ({ href: a.href, text: a.textContent })));
  pruefe('Leiste: Anhänge stehen beim Wunsch', links.length === 4, links);
  const auf = await p.evaluate(async href => { const r = await fetch(href); return { ok: r.ok, typ: r.headers.get('content-type') }; }, links.find(l => l.text.endsWith('.png'))?.href);
  pruefe('Leiste: Bildschirmfoto lässt sich öffnen', auf.ok && auf.typ === 'image/png', auf);
  const js = await p.evaluate(async href => { const r = await fetch(href); return r.headers.get('content-type'); }, links.find(l => l.text.endsWith('.js'))?.href);
  pruefe('Leiste: .js-Anhang öffnet als Text, läuft nicht', js?.startsWith('text/plain'), js);

  /* ---------- .js daneben: Einspielen wie bisher ---------- */
  await ereignis('.nutzbereich', 'drop', [{ name: 'daneben.js', typ: 'text/javascript', b64: b64('Huelle.plugin({ kennung: "daneben", titel: "Daneben", stil: ".pl-daneben{}" });') }]);
  /* Per Datei eingespielt steht ein Plugin unter seinem Dateinamen in der Liste. */
  await p.waitForFunction(() => Huelle.verwaltung.eintraege().some(e => e.art === 'datei' && e.name === 'daneben.js'), null, { timeout: 30000 }).then(() => true, () => false)
    .then(ok => pruefe('.js daneben gezogen: wird eingespielt', ok));

  /* ---------- Rückfrage beantworten, mit Anhang ---------- */
  await bereit();
  await p.fill('#wunschFeld', 'Der Balken soll seine Uhrzeiten zeigen.');
  await p.click('#wunsch button');
  const rf = await meldung('Rückfrage: Welcher Balken');
  pruefe('Rückfrage hat ein Antwortfeld, ohne „So machen“', !!(await rf.$('textarea')) && !(await rf.$('button.so-machen')));
  await ereignis('#meldungen .meldung.rueckfrage textarea', 'paste', [{ name: 'image.png', typ: 'image/png', b64: PNG }]);
  await rf.$eval('textarea', t => { t.value = 'Der von XC 812, siehe Bild.'; });
  await (await rf.$('button[type=submit]')).click();
  await meldung('Fertig: Der Balken von XC 812 zeigt seine Uhrzeiten.');
  const k3 = protokoll()[2];
  pruefe('Antwort geht mit Wunsch und Rückfrage an die KI', k3.prompt.includes('Der Balken soll seine Uhrzeiten zeigen.') && k3.prompt.includes('Deine Rückfrage: Welcher Balken') &&
    k3.prompt.includes('Antwort des Anforderers (im Wortlaut): Der von XC 812, siehe Bild.') && k3.anhaenge.length === 1 && k3.prompt.includes('(zur Antwort auf deine Rückfrage)'), k3.prompt.slice(0, 600));
  const hb = herkunft('anhang-b').wuensche[0];
  pruefe('Herkunft: Wunsch, Rückfrage und Antwort im Wortlaut, Anhang zur Antwort', hb.wortlaut === 'Der Balken soll seine Uhrzeiten zeigen.' && hb.rueckfragen?.[0]?.rueckfrage.startsWith('Welcher Balken') &&
    hb.rueckfragen[0].antwort === 'Der von XC 812, siehe Bild.' && hb.rueckfragen[0].anhaenge?.length === 1 && existsSync(path.join(BAUSTEINE, 'anhang-b', hb.rueckfragen[0].anhaenge[0].pfad)), hb);

  /* ---------- Aufteilung: „So machen“ ---------- */
  await bereit();
  await p.fill('#wunschFeld', 'Uhrzeiten und Dauer am Balken.');
  await p.click('#wunsch button');
  /* Anweisung 34 (b), 58: Eine reine Aufteilung ist keine Frage an den PO; die Teile beginnen von selbst. */
  const t1 = await meldung('Teil 1 von 2: Fertig: Uhrzeiten beim Darüberfahren.');
  pruefe('Aufteilung ohne Rückfrage: kein „So machen“ zu klicken', !(await p.$('#meldungen button.so-machen')));
  pruefe('Teil 1 einzeln mit Vorspielen und Zurücknehmen', !!(await t1.$('button:text("Zurücknehmen")')));
  const t2 = await meldung('Teil 2 von 2: Fertig: Dauer unter der Flugnummer.');
  pruefe('Teil 2 einzeln mit Zurücknehmen', !!(await t2.$('button:text("Zurücknehmen")')));
  const k5 = protokoll()[4], k6 = protokoll()[5];
  pruefe('KI bekommt je Teil genau diesen Teil', k5.prompt.includes('Teil 1 von 2') && k5.prompt.includes('Uhrzeiten am Balken beim Darüberfahren') && k6.prompt.includes('Teil 2 von 2') && k6.prompt.includes('„So machen“'));
  pruefe('Teil 2 baut auf Teil 1 auf (Teil 1 steht bei den Plugins, als Zeile)', k6.prompt.includes('- `teil-eins`') && !k6.prompt.includes('Plugin `teil-eins`\n\n```js'), k6.prompt.slice(k6.prompt.indexOf('## Vorhandene Plugins'), k6.prompt.indexOf('## Vorhandene Plugins') + 400));
  const te = herkunft('teil-eins').wuensche[0], tz = herkunft('teil-zwei').wuensche[0];
  pruefe('Herkunft je Teil: Wortlaut, Teil, „So machen“', te.wortlaut === 'Uhrzeiten und Dauer am Balken.' && te.teil?.nr === 1 && tz.teil?.nr === 2 && te.rueckfragen?.[0]?.soMachen === true, { te, tz });

  /* ---------- Ändern mit Anhang ---------- */
  await bereit();
  await p.evaluate(() => Huelle.leiste.zeige('anhang-a'));
  const feld = p.locator('[data-plugin="anhang-a"] details.plugin-ki.aendern');
  await feld.locator('summary').click();
  await feld.locator('textarea').fill('Blau statt rot, wie auf dem Bild.');
  await ereignis('[data-plugin="anhang-a"] details.plugin-ki.aendern textarea', 'drop', [{ name: 'farbe.png', typ: 'image/png', b64: PNG }]);
  pruefe('Ändern: Anhang unter dem Feld', (await chips('[data-plugin="anhang-a"] details.plugin-ki.aendern')).includes('farbe.png'));
  await feld.locator('button[type="submit"]').click();
  await meldung('Geändert: Jetzt blau.');
  const fa = herkunft('anhang-a').fassungen.at(-1);
  pruefe('Ändern: Anhang an der Fassung', fa.art === 'aendern' && fa.anhaenge?.[0]?.name === 'farbe.png' && existsSync(path.join(BAUSTEINE, 'anhang-a', fa.anhaenge[0].pfad)), fa);
} finally {
  await browser.close();
}
console.log(fehler ? `${fehler} Fehler` : 'alles grün');
process.exit(fehler ? 1 : 0);
