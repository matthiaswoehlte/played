/* Anweisung 44: Bereich leeren. Nimmt alles weg, was für eine Teil-App entstanden ist, damit der PO den Prototyp auf
   leerer Fläche beliebig oft üben kann. Vorher legt Play den Stand des Projekts als Sicherung ab.

   Was zu einer Teil-App gehört, steht an festen Kennungen, nie an Text:
   - Plugins: `teilApp` in ihrer Herkunft; ohne Vermerk gehören sie zur Heimat (der Teil-App des Grundstocks).
     Zur Heimat gehören auch die Plugins des Grundstocks (im Manifest).
   - Szenarien: die der entfernten Plugins; von Hand gespielte nach `entscheidungen/teilapps.json`, sonst Heimat;
     für die Heimat dazu die Szenarien im Manifest.
   - Regeln: nach `entscheidungen/teilapps.json`, sonst nach ihrem Pfad (`pfade` des Bereichs), sonst Heimat.
   - Grunddaten aus Wünschen: `teilApp` am Eintrag, sonst Heimat; dazu jede Änderung an einem Fachobjekt der Teil-App.
   - Daten: `daten/bereiche/<teil-app>.js`; für die Heimat ihre Fachobjekte in den übrigen Datendateien.
   In der Herkunft bleibt nur eine Zeile: `entscheidungen/geleert.json`. */
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { teilApps } from './herkunft-leser.mjs';

const liesJson = async (datei, sonst) => { try { return JSON.parse(await fs.readFile(datei, 'utf8')); } catch { return sonst; } };
const schreibeJson = async (datei, wert) => { await fs.mkdir(path.dirname(datei), { recursive: true }); await fs.writeFile(datei, `${JSON.stringify(wert, null, 2)}\n`); };
const dateien = async (o) => (await fs.readdir(o, { withFileTypes: true }).catch(() => [])).filter(e => e.isFile()).map(e => e.name).sort();
const ordner = async (o) => (await fs.readdir(o, { withFileTypes: true }).catch(() => [])).filter(e => e.isDirectory()).map(e => e.name).sort();
const weg = (p) => fs.rm(p, { recursive: true, force: true });

/* Teile eines Projekts, die in die Sicherung gehören */
const TEILE = ['manifest.js', 'projekt.json', 'daten', 'plugins', 'regeln', 'drehbuecher', 'sollergebnisse', 'entscheidungen', 'gearbeitet.json', 'einmal-gespielt.json', 'grundfunktionen.json'];
/* Prüfungen legen Teile außerhalb des Projektordners ab; die gehören ebenso in die Sicherung. */
const AUSSERHALB = [['plugins-ausserhalb', 'PLUGINDATEN'], ['regeln-ausserhalb', 'REGELN'], ['gespielt-ausserhalb', 'GESPIELT'], ['soll-ausserhalb', 'SOLL']];

/* Anweisung 45 (e): legt den ganzen Stand als Sicherung ab, mit einem Vermerk, wann und wovor. Gibt den Ordner zurück. */
async function sichere(p, w, vermerk, jetzt = new Date()) {
  const stempel = jetzt.toISOString().replace(/[:.]/g, '-');
  const sicherung = path.join(p.ordner, 'sicherungen', `${stempel}-${vermerk.bereich ?? vermerk.art}`);
  await fs.mkdir(sicherung, { recursive: true });
  for (const t of TEILE) if (existsSync(path.join(p.ordner, t))) await fs.cp(path.join(p.ordner, t), path.join(sicherung, t), { recursive: true });
  for (const [name, weg] of AUSSERHALB) {
    const quelle = w[weg];
    if (quelle && !quelle.startsWith(p.ordner + path.sep) && existsSync(quelle)) await fs.cp(quelle, path.join(sicherung, name), { recursive: true });
  }
  await schreibeJson(path.join(sicherung, 'sicherung.json'), { datum: jetzt.toISOString(), ...vermerk });
  return sicherung;
}

/* Anweisung 45 (e): die Sicherungen eines Projekts, neueste zuerst: { kennung, datum, art, bereich, name, von }.
   Sicherungen aus der Zeit vor dem Vermerk (Anweisung 44) erkennt Play an ihrer Zeile in geleert.json. */
export async function sicherungenVon(projektOrdner) {
  const geleert = await liesJson(path.join(projektOrdner, 'entscheidungen', 'geleert.json'), []);
  const out = [];
  for (const k of await ordner(path.join(projektOrdner, 'sicherungen'))) {
    const vermerk = await liesJson(path.join(projektOrdner, 'sicherungen', k, 'sicherung.json'), null);
    const zeile = geleert.find(e => e.sicherung === `sicherungen/${k}`);
    const v = vermerk ?? (zeile ? { datum: zeile.datum, art: 'leeren', bereich: zeile.bereich, name: zeile.name } : null);
    if (v?.datum) out.push({ kennung: k, ...v });
  }
  return out.sort((a, b) => (a.datum < b.datum ? 1 : -1));
}

/* Anweisung 45 (e): holt eine Sicherung zurück. Vorher sichert Play den jetzigen Stand, damit auch das umkehrbar ist. */
export async function holeZurueck(p, w, kennung) {
  const quelle = path.join(p.ordner, 'sicherungen', kennung);
  const liste = await sicherungenVon(p.ordner);
  const alt = liste.find(s => s.kennung === kennung);
  if (!/^[\w.-]+$/.test(kennung) || !alt || !existsSync(quelle)) return { grund: 'Diese Sicherung gibt es nicht mehr.' };
  const neu = await sichere(p, w, { art: 'zurueckholen', von: alt.datum });
  for (const t of TEILE) {
    await weg(path.join(p.ordner, t));
    if (existsSync(path.join(quelle, t))) await fs.cp(path.join(quelle, t), path.join(p.ordner, t), { recursive: true });
  }
  for (const [name, wegName] of AUSSERHALB) {
    const ziel = w[wegName];
    if (!ziel || ziel.startsWith(p.ordner + path.sep) || !existsSync(path.join(quelle, name))) continue;
    await weg(ziel);
    await fs.cp(path.join(quelle, name), ziel, { recursive: true });
  }
  /* Der schnelle Start rechnet danach neu. */
  await weg(w.STAND_SPEICHER);
  return { sicherung: path.relative(p.ordner, neu).split(path.sep).join('/'), von: alt.datum };
}

export function heimatVon(j) { const a = teilApps(j?.bereiche); return a.find(b => b.prototyp)?.kennung ?? a[0]?.kennung ?? null; }

/* Hat die Teil-App einen Grundstock? Dann fragt Play zweimal (Anweisung 44 d). */
export async function hatGrundstock(projektOrdner, w, bereich) {
  const j = JSON.parse(await fs.readFile(path.join(projektOrdner, 'projekt.json'), 'utf8'));
  if (bereich !== heimatVon(j)) return false;
  const manifest = await fs.readFile(path.join(projektOrdner, 'manifest.js'), 'utf8').catch(() => '');
  return /["']plugins\/[a-z0-9-]+\.js["']/.test(manifest) || (await liesJson(w.GRUNDFUNKTIONEN, [])).some(g => (g.bereich ?? bereich) === bereich);
}

/* Merkt, zu welcher Teil-App eine Regel oder ein von Hand gespieltes Szenario gehört (nur außerhalb der Heimat nötig). */
export async function merkeTeilApp(projektOrdner, art, kennung, teilApp) {
  const datei = path.join(projektOrdner, 'entscheidungen', 'teilapps.json');
  const z = await liesJson(datei, {});
  (z[art] ??= {})[kennung] = teilApp;
  await schreibeJson(datei, z);
}

/* Schreibt einen Wert als JavaScript; Rechenvorschriften bleiben Rechenvorschriften. */
function alsJs(wert, tiefe = 1) {
  const pad = '  '.repeat(tiefe), zu = '  '.repeat(tiefe - 1);
  if (typeof wert === 'function') return String(wert);
  if (Array.isArray(wert)) return wert.length ? `[\n${wert.map(x => pad + alsJs(x, tiefe + 1)).join(',\n')}\n${zu}]` : '[]';
  if (wert && typeof wert === 'object') {
    const e = Object.entries(wert);
    return e.length ? `{\n${e.map(([k, v]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${alsJs(v, tiefe + 1)}`).join(',\n')}\n${zu}}` : '{}';
  }
  return JSON.stringify(wert);
}

/* Nimmt Fachobjekte aus einer Datendatei; der Kopfkommentar bleibt. Gibt true zurück, wenn sich etwas geändert hat. */
async function nimmAusDaten(datei, wurzeln) {
  const quelle = await fs.readFile(datei, 'utf8');
  const aufrufe = [];
  vm.runInNewContext(quelle, { Huelle: { daten: d => aufrufe.push(d) } }, { timeout: 1000 });
  if (aufrufe.length !== 1) return false;
  const d = aufrufe[0];
  const hatte = wurzeln.some(w => d.objekte?.[w] || d.arten?.[w]);
  if (!hatte) return false;
  for (const w of wurzeln) { if (d.objekte) delete d.objekte[w]; if (d.arten) delete d.arten[w]; }
  const kopf = /^\s*\/\*[\s\S]*?\*\/\s*/.exec(quelle)?.[0] ?? '';
  await fs.writeFile(datei, `${kopf}Huelle.daten(${alsJs(d)});\n`);
  return true;
}

/**
 * @param p { kennung, name, ordner } des Projekts, dessen Teil-App geleert wird
 * @param w Wege dieses Projekts (wegeVon)
 * @param navOrdner Ordner des Navigators, der dieses Projekt liest (dort liegen „Stimmt nicht“ und Bestätigung des Grundstocks)
 */
export async function leereBereich(p, w, bereich, navOrdner = null) {
  const jDatei = path.join(p.ordner, 'projekt.json');
  const j = JSON.parse(await fs.readFile(jDatei, 'utf8'));
  const apps = teilApps(j.bereiche);
  const b = apps.find(x => x.kennung === bereich);
  if (!b || !b.prototyp) return { grund: 'In diesem Bereich gibt es nichts zu leeren.' };
  const heimat = heimatVon(j), istHeimat = bereich === heimat;
  const gehoert = (t) => (t ?? heimat) === bereich;
  const jetzt = new Date();

  /* 1. Sicherung des ganzen Projekts, bevor irgendetwas wegkommt */
  const sicherung = await sichere(p, w, { art: 'leeren', bereich, name: b.name }, jetzt);

  const zuordnung = await liesJson(path.join(p.ordner, 'entscheidungen', 'teilapps.json'), {});
  const manifestDatei = path.join(p.ordner, 'manifest.js');
  let manifest = await fs.readFile(manifestDatei, 'utf8').catch(() => '');
  const ausManifest = (eintrag) => { manifest = manifest.replace(new RegExp(`\\n\\s*["']${eintrag.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'],?`), ''); };

  /* 2. Plugins in allen Fassungen, auch im Papierkorb */
  const plugins = new Set(), szenarien = new Set(), wuensche = new Set();
  for (const wurzel of [w.BAUSTEINE, w.PAPIERKORB]) {
    for (const k of await ordner(wurzel)) {
      const h = await liesJson(path.join(wurzel, k, 'herkunft.json'), null);
      if (!h || !gehoert(h.teilApp)) continue;
      plugins.add(k);
      for (const f of h.fassungen || []) { if (typeof f.drehbuch === 'string') szenarien.add(f.drehbuch); if (f.wunsch) wuensche.add(f.wunsch); }
      for (const x of h.wuensche || []) if (x.kennung) wuensche.add(x.kennung);
      await weg(path.join(wurzel, k));
    }
  }
  if (istHeimat) {
    for (const m of [...manifest.matchAll(/["']plugins\/([a-z0-9-]+)\.js["']/g)]) {
      plugins.add(m[1]);
      await weg(path.join(w.GRUND, `${m[1]}.js`));
      ausManifest(`plugins/${m[1]}.js`);
    }
  }
  /* 2b. Anweisung 45 (d): Fassungen, die ein Wunsch aus dieser Teil-App an einem Plugin eines anderen Bereichs gemacht hat,
     gehen mit zurück. Erkannt an `teilApp` an der Fassung; ohne Vermerk gehört eine Fassung zur Teil-App ihres Plugins.
     Das Plugin steht danach auf der letzten Fassung davor; bleibt nur die Grundausstattung, ist es wieder ganz die Grundausstattung. */
  let zurueckgenommen = 0;
  for (const wurzel of [w.BAUSTEINE, w.PAPIERKORB]) {
    for (const k of await ordner(wurzel)) {
      const o = path.join(wurzel, k), h = await liesJson(path.join(o, 'herkunft.json'), null);
      if (!h || !Array.isArray(h.fassungen) || !h.fassungen.some(f => f.teilApp === bereich)) continue;
      const raus = h.fassungen.filter(f => f.teilApp === bereich), rausNr = new Set(raus.map(f => f.nr));
      for (const f of raus) {
        if (typeof f.drehbuch === 'string') { szenarien.add(f.drehbuch); await weg(path.join(o, `${f.drehbuch}.drehbuch.js`)); }
        if (f.wunsch) wuensche.add(f.wunsch);
        await weg(path.join(o, `fassung-${String(f.nr).padStart(3, '0')}.js`));
      }
      zurueckgenommen += raus.length;
      h.fassungen = h.fassungen.filter(f => !rausNr.has(f.nr));
      h.wuensche = (h.wuensche || []).filter(x => !wuensche.has(x.kennung));
      let aktuell = h.aktuell;
      while (aktuell && rausNr.has(aktuell)) aktuell = raus.find(f => f.nr === aktuell)?.vorige ?? null;
      h.aktuell = aktuell ?? h.fassungen.at(-1)?.nr ?? 0;
      if (!h.fassungen.length || h.fassungen.every(f => f.art === 'grund')) await weg(o);
      else await schreibeJson(path.join(o, 'herkunft.json'), h);
    }
  }

  const verwaltung = await liesJson(w.VERWALTUNG, null);
  if (verwaltung?.aus?.some(k => plugins.has(k))) { verwaltung.aus = verwaltung.aus.filter(k => !plugins.has(k)); await schreibeJson(w.VERWALTUNG, verwaltung); }

  /* 3. Regeln */
  const regeln = new Set();
  for (const n of (await dateien(w.REGELN)).filter(n => n.endsWith('.js'))) {
    const quelle = await fs.readFile(path.join(w.REGELN, n), 'utf8');
    const kennung = /kennung\s*:\s*"([^"]+)"/.exec(quelle)?.[1] ?? n.replace(/\.js$/, '');
    const pfad = /pfad\s*:\s*"([^"]+)"/.exec(quelle)?.[1] ?? null;
    const t = zuordnung.regeln?.[n] ?? apps.find(x => (x.pfade || []).includes(pfad))?.kennung ?? heimat;
    if (t !== bereich) continue;
    regeln.add(kennung);
    await weg(path.join(w.REGELN, n));
    for (const a of (await dateien(path.join(w.REGELN, 'alt'))).filter(a => a.startsWith(`${kennung}.vor-`))) await weg(path.join(w.REGELN, 'alt', a));
    ausManifest(`regeln/${n}`);
  }

  /* 4. Szenarien: von Hand gespielte, für die Heimat die aus dem Manifest */
  for (const n of (await dateien(w.GESPIELT)).filter(n => n.endsWith('.js'))) {
    const k = n.replace(/\.js$/, '');
    if (!gehoert(zuordnung.gespielt?.[k])) continue;
    szenarien.add(k);
    await weg(path.join(w.GESPIELT, n));
  }
  if (istHeimat) {
    for (const m of [...manifest.matchAll(/["'](drehbuecher\/([a-z0-9-]+)\.js)["']/g)]) {
      const quelle = await fs.readFile(path.join(p.ordner, m[1]), 'utf8').catch(() => '');
      szenarien.add(/kennung\s*:\s*["']([^"']+)["']/.exec(quelle)?.[1] ?? m[2]);
      await weg(path.join(p.ordner, m[1]));
      ausManifest(m[1]);
    }
  }
  for (const k of szenarien) await weg(path.join(w.SOLL, `${k}.json`));
  if (manifest !== await fs.readFile(manifestDatei, 'utf8').catch(() => '')) await fs.writeFile(manifestDatei, manifest);

  /* 5. Daten */
  const wurzeln = [...new Set((b.fachobjekte || []).map(f => f.split('/')[0]))];
  const anderer = new Set(apps.filter(x => x.kennung !== bereich).flatMap(x => (x.fachobjekte || []).map(f => f.split('/')[0])));
  const eigene = wurzeln.filter(x => !anderer.has(x));
  await weg(path.join(p.ordner, 'daten', 'bereiche', `${bereich}.js`));
  if (istHeimat && eigene.length) for (const n of (await dateien(path.join(p.ordner, 'daten'))).filter(n => n.endsWith('.js'))) await nimmAusDaten(path.join(p.ordner, 'daten', n), eigene);

  /* 6. Grunddaten aus Wünschen der Teil-App und an ihren Fachobjekten */
  const grunddaten = await liesJson(w.GRUNDDATEN, []);
  const trifftEigene = (e) => { const t = String(e.pfad || '').split('/'); return (t[0] === 'arten' || t[0] === 'objekte') && eigene.includes(t[1]); };
  const bleiben = grunddaten.filter(e => !gehoert(e.teilApp) && !trifftEigene(e) && !wuensche.has(e.wunsch));
  for (const e of grunddaten) if (!bleiben.includes(e) && e.erwartungen) await weg(path.join(path.dirname(w.GRUNDDATEN), e.erwartungen));
  if (bleiben.length !== grunddaten.length) await schreibeJson(w.GRUNDDATEN, bleiben);

  /* 7. Entscheidungen zu dem, was wegkommt: Abgleich, Bedienungen, bewusst in Kauf, offene Wünsche, Fälle ohne Regel */
  const filtere = async (datei, behalten) => { const l = await liesJson(datei, null); if (Array.isArray(l)) { const r = l.filter(behalten); if (r.length !== l.length) await schreibeJson(datei, r); } };
  await filtere(w.ABGLEICH, e => !plugins.has(e.plugin) && !wuensche.has(e.wunsch));
  await filtere(w.BEDIENUNGEN, e => !(e.plugins || []).some(k => plugins.has(k)));
  await filtere(w.IN_KAUF, e => !regeln.has(e.regel) && !wuensche.has(e.wunsch));
  await filtere(w.UNBESTAETIGT, e => !plugins.has(e.ergebnis?.kennung) && !regeln.has(e.regel?.kennung) && !wuensche.has(e.id));
  /* Anweisung 49 (d): Anträge, die Wünsche dieser Teil-App gestellt haben */
  await filtere(path.join(p.ordner, 'entscheidungen', 'antraege.json'), e => e.von !== bereich);
  await filtere(w.FAELLE, e => !String(e.schluessel || '').split('|').some(t => eigene.includes(t) || eigene.some(x => t.startsWith(`${x}/`))));

  /* 8. Grundstock der Heimat mit allem, was der PO dazu gesagt hat */
  let grundfunktionen = 0;
  if (istHeimat) {
    const liste = await liesJson(w.GRUNDFUNKTIONEN, []);
    const weg2 = new Set(liste.filter(g => (g.bereich ?? bereich) === bereich).map(g => g.kennung));
    grundfunktionen = weg2.size;
    if (weg2.size) {
      await schreibeJson(w.GRUNDFUNKTIONEN, liste.filter(g => !weg2.has(g.kennung)));
      await filtere(w.GRUNDSTOCK_GEAENDERT, e => !weg2.has(e.kennung));
      if (navOrdner) for (const n of ['grundstock-anmerkungen.json', 'grundstock-bestaetigung.json']) {
        const datei = path.join(navOrdner, 'entscheidungen', n), x = await liesJson(datei, null);
        if (x && typeof x === 'object' && [...weg2].some(k => k in x)) { for (const k of weg2) delete x[k]; await schreibeJson(datei, x); }
      }
    }
  }

  /* 9. Was beim Abspielen mitgeschrieben wurde; der schnelle Start rechnet danach neu */
  const gearbeitet = await liesJson(w.GEARBEITET, null);
  if (gearbeitet && [...szenarien].some(k => k in gearbeitet)) { for (const k of szenarien) delete gearbeitet[k]; await schreibeJson(w.GEARBEITET, gearbeitet); }
  const einmal = w.EINMAL ? await liesJson(w.EINMAL, null) : null;
  if (einmal && [...plugins].some(k => k in einmal)) { for (const k of plugins) delete einmal[k]; await schreibeJson(w.EINMAL, einmal); }
  await weg(w.STAND_SPEICHER);

  /* 10. Der Bereich ist wieder leer; Namen seiner Fachobjekte gehen mit */
  const ziel = (function finde(l) { for (const k of l || []) { if (k.kennung === bereich) return k; const t = finde(k.kinder); if (t) return t; } return null; })(j.bereiche);
  Object.assign(ziel, { prototyp: false, fachobjekte: [] }); delete ziel.beispieldaten;
  for (const feld of ['fachobjektNamen', 'fachobjektEiner', 'feldNamen', 'angabeNamen']) for (const x of eigene) if (j[feld]) delete j[feld][x];
  await schreibeJson(jDatei, j);

  /* 11. Eine Zeile in der Herkunft */
  const geleert = path.join(p.ordner, 'entscheidungen', 'geleert.json');
  await schreibeJson(geleert, [...await liesJson(geleert, []), { bereich, name: b.name, datum: jetzt.toISOString(), sicherung: path.relative(p.ordner, sicherung).split(path.sep).join('/') }]);
  if (Object.keys(zuordnung).length) {
    /* Anweisung 49 (a): auch Grundausstattung und Szenarien aus dem Manifest, wenn die Heimat geleert wird */
    for (const art of ['regeln', 'gespielt', 'plugins', 'szenarien']) for (const [k, t] of Object.entries(zuordnung[art] || {})) if (t === bereich) delete zuordnung[art][k];
    await schreibeJson(path.join(p.ordner, 'entscheidungen', 'teilapps.json'), zuordnung);
  }
  return { plugins: plugins.size, zurueckgenommen, szenarien: szenarien.size, regeln: regeln.size, grundfunktionen, sicherung: path.relative(p.ordner, sicherung).split(path.sep).join('/') };
}
