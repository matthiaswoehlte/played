/* Leser des Netz-Navigators (Auftrag 009, Stufe 2): sammelt die Herkunft eines anderen Projekts ein und macht
   daraus die Daten der Nutzapp „Netz-Navigator“. NUR LESEN: Hier steht kein einziger Schreibzugriff.

   Knoten: Bereiche, Plugins mit Fassungen (Wunsch im Wortlaut, Rückfragen, Anhänge, berührte Szenarien mit alter und
   neuer Erwartung, Entscheidungen des PO), Regeln mit Herkunft.
   Fäden werden berechnet, nie gepflegt (Entscheidung 4 des PO): Ein Faden entsteht, wenn etwas in einem Bereich
   Fachobjekte eines anderen liest oder ändert oder eine Regel über die Grenze reicht. Erkannt wird das an den festen
   Pfaden im Code der aktuellen Fassung, nie an Text eines Modells. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sicherungenVon } from './bereich-leeren.mjs';

const lies =(datei) => fs.readFile(datei, 'utf8').catch(() => null);
const liesJson = async (datei, sonst) => {
  const t = await lies(datei);
  if (t === null) return sonst;
  try { return JSON.parse(t); } catch { return sonst; }
};
const ordnerIn = async (o) => (await fs.readdir(o, { withFileTypes: true }).catch(() => [])).filter(e => e.isDirectory()).map(e => e.name).sort();
const dateienIn = async (o) => (await fs.readdir(o, { withFileTypes: true }).catch(() => [])).filter(e => e.isFile()).map(e => e.name).sort();

/* „2026-11-07T17:30:57.132Z“ → „07.11.2026“. Plugins dürfen keine Uhr benutzen, darum steht das Datum schon fertig da. */
const datum = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
};
/* Anweisung 45 (e): Datum und Uhrzeit nach der Uhr des Rechners, „09.11.2026, 17:21“ */
const zeitpunkt = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  const z = (n) => String(n).padStart(2, '0');
  return `${z(t.getDate())}.${z(t.getMonth() + 1)}.${t.getFullYear()}, ${z(t.getHours())}:${z(t.getMinutes())}`;
};
const wunschNr = (w) => { const m = /^wunsch-(\d+)$/.exec(String(w ?? '')); return m ? m[1] : null; };
const anzeigeFachobjekt = (wurzel, namen) => namen?.[wurzel] || wurzel.charAt(0).toUpperCase() + wurzel.slice(1);

/* Welche Fachobjekte ein Stück Code anfasst: Wurzel → „liest“ oder „aendert“. Ändern schlägt Lesen. */
export function zugriffe(code) {
  const out = new Map();
  const nimm = (wurzel, art) => { if (art === 'aendert' || !out.has(wurzel)) out.set(wurzel, art); };
  for (const m of code.matchAll(/\.(?:alle|lies|erlaubt)\(\s*["'`]([a-z][a-z-]*)/g)) nimm(m[1], 'liest');
  for (const m of code.matchAll(/\.setze\(\s*["'`]([a-z][a-z-]*)/g)) nimm(m[1], 'aendert');
  for (const b of code.matchAll(/besitzt\s*:\s*\[([^\]]*)\]/g)) {
    for (const m of b[1].matchAll(/["'`]([a-z][a-z-]*)/g)) nimm(m[1], 'aendert');
  }
  /* Abos ("mitarbeiter/*.krank": …) und Nachrichten an ein Objekt (objekt: "mitarbeiter/…") berühren es, ändern es aber nicht:
     Geändert hat nur, wer den Wert besitzt (Bus-Vertrag 6). */
  for (const m of code.matchAll(/["'`]([a-z][a-z-]*)(?:\/[^"'`\s]*)?\.[a-zäöüß]+["'`]\s*:/g)) nimm(m[1], 'liest');
  for (const m of code.matchAll(/objekt\s*:\s*["'`]([a-z][a-z-]*)\//g)) nimm(m[1], 'liest');
  return out;
}

/* Titel aller Szenarien des Projekts, je Kennung. Identität ist die Kennung, der Titel nur Beschriftung. */
async function szenarienNamen(q, kennungenPlugins) {
  const namen = new Map();
  const nimm = (text) => {
    if (!text) return;
    const k = /["']?kennung["']?\s*:\s*["']([^"']+)["']/.exec(text);
    const t = /["']?titel["']?\s*:\s*"([^"]+)"/.exec(text);
    if (k && t) namen.set(k[1], t[1]);
  };
  for (const ordner of [path.join(q.ordner, 'drehbuecher'), q.gespielt]) {
    for (const d of await dateienIn(ordner)) if (d.endsWith('.js')) nimm(await lies(path.join(ordner, d)));
  }
  for (const k of kennungenPlugins) {
    const ordner = path.join(q.bausteine, k);
    for (const d of await dateienIn(ordner)) if (d.endsWith('.drehbuch.js')) nimm(await lies(path.join(ordner, d)));
  }
  return namen;
}

function anhaengeVon(a) {
  return (a || []).map(x => (typeof x === 'string' ? x : x.name || x.datei || null)).filter(Boolean);
}

/* Eine Fassung so, wie der Navigator sie zeigt: nur Lesbares, keine Prüfanweisungen. */
function fassungAus(f, szenarien) {
  if (f.unbestaetigt) return { ...fassungOhneVermerk(f, szenarien), unbestaetigt: true };
  return fassungOhneVermerk(f, szenarien);
}
function fassungOhneVermerk(f, szenarien) {
  const name = (k) => szenarien.get(k) || 'Szenario ohne Titel';
  const rueckfragen = (f.rueckfragen || []).map(d => ({
    frage: d.rueckfrage || null, antwort: d.antwort || null, datum: datum(d.datum), anhaenge: anhaengeVon(d.anhaenge),
  })).filter(d => d.frage || d.antwort);
  const erwartungen = (f.erwartungen || []).map(e => ({
    szenario: e.drehbuch, name: name(e.drehbuch), satz: e.satz || null, alt: e.alt?.text || null, neu: e.neu?.text || null,
  }));
  return {
    nr: f.nr, art: f.art || null, datum: datum(f.datum), wunsch: wunschNr(f.wunsch), wortlaut: f.wortlaut || null, kurz: f.kurz || null,
    rueckfragen, anhaenge: anhaengeVon(f.anhaenge), erwartungen,
    gespielt: typeof f.drehbuch === 'string' ? { szenario: f.drehbuch, name: name(f.drehbuch) } : null,
    entscheidungen: (f.entscheidungen || []).map(e => ({ satz: e.was || null, wie: e.wie || null, datum: datum(e.datum) })),
  };
}

/* Entscheidungen aus dem Abgleich von Wunsch und Plugin: Was „mehr“ oder „enger“ war und wie der PO entschied. */
function abgleichEntscheidungen(eintrag) {
  const out = [];
  for (const [schluessel, e] of Object.entries(eintrag.entscheidungen || {})) {
    const [art, nr] = schluessel.split('-');
    const liste = art === 'mehr' ? eintrag.mehr : art === 'enger' ? eintrag.enger : art === 'verstoss' ? eintrag.verstoesse : null;
    const quelle = liste?.find(x => String(x.nr) === nr);
    out.push({
      wunsch: wunschNr(eintrag.wunsch), fassung: eintrag.fassung, satz: quelle?.was || quelle?.satz || null,
      wie: e.wie || null, datum: datum(e.datum),
    });
  }
  return out;
}

/* Bereiche sind ein Baum: Ein Knoten hat entweder Kinder (Ordner) oder ist eine Teil-App. */
export function flacheBereiche(liste, eltern = null, tiefe = 0) {
  return (liste || []).flatMap(b => [{ ...b, eltern, tiefe }, ...flacheBereiche(b.kinder, b.kennung, tiefe + 1)]);
}
export function teilApps(liste) { return flacheBereiche(liste).filter(b => !b.kinder); }

const RANG = { klar: 0, offen: 1, instabil: 2, widerspruch: 3 };
const schlechter = (a, b) => (RANG[b] > RANG[a] ? b : a);

/* Anweisung 27: Play hebt das Eingesammelte auf und sammelt nur neu, wenn sich beim gelesenen Projekt etwas geändert hat.
   Der Abdruck ist Name, Größe und Änderungszeit jeder Datei, die der Leser benutzt, dazu die Projektbeschreibung. Geht beim
   Bilden etwas schief, gibt es keinen Abdruck und Play sammelt neu: Im Navigator steht nie ein alter Stand. */
async function dateienUnter(o) {
  const eintraege = await fs.readdir(o, { withFileTypes: true }).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
  const teile = await Promise.all(eintraege.map(e => {
    const voll = path.join(o, e.name);
    return e.isDirectory() ? dateienUnter(voll) : [voll];
  }));
  return teile.flat();
}
const merkmal = (d) => fs.stat(d).then(s => `${d}|${s.size}|${s.mtimeMs}`, e => { if (e.code === 'ENOENT') return `${d}|fehlt`; throw e; });

async function abdruckVon(q) {
  try {
    const baeume = await Promise.all([q.bausteine, q.grund, q.regeln, q.gespielt, path.join(q.ordner, 'drehbuecher'), path.join(q.ordner, 'daten')].map(dateienUnter));
    const einzeln = [path.join(q.ordner, 'manifest.js'), path.join(q.ordner, 'entscheidungen', 'geleert.json'), path.join(q.ordner, 'sicherungen'), q.grunddaten, q.verwaltung, q.abgleich, q.inKauf, q.gearbeitet, q.stand, q.faelle, q.anmerkungen, q.bestaetigungen, q.grundfunktionen, q.grundstockGeaendert, q.antraege].filter(Boolean);
    const merkmale = await Promise.all([...baeume.flat(), ...einzeln].map(merkmal));
    return [JSON.stringify(q.projekt), ...merkmale.sort()].join("|");
  } catch { return null; }
}

const aufgehoben = new Map();
export async function herkunftAufgehoben(q) {
  const abdruck = await abdruckVon(q);
  const da = aufgehoben.get(q.ordner);
  if (abdruck !== null && da?.abdruck === abdruck) return da.daten;
  const daten = await sammleHerkunft(q);
  if (abdruck !== null) aufgehoben.set(q.ordner, { abdruck, daten });
  return daten;
}

/**
 * @param q Wege des gelesenen Projekts: { name, ordner, projekt, bausteine, grund, verwaltung, regeln, abgleich, inKauf, gespielt }
 * @returns Daten der Nutzapp, wie sie Huelle.daten bekommt
 */
export async function sammleHerkunft(q) {
  const manifest = (await lies(path.join(q.ordner, 'manifest.js'))) || '';
  const grundListe = [...manifest.matchAll(/["']plugins\/([a-z0-9-]+)\.js["']/g)].map(m => m[1]);
  const kennungen = [...new Set([...grundListe, ...await ordnerIn(q.bausteine)])].sort();
  const aus = new Set((await liesJson(q.verwaltung, { aus: [] })).aus || []);
  const szenarien = await szenarienNamen(q, kennungen);
  const abgleich = await liesJson(q.abgleich, []);
  const inKauf = await liesJson(q.inKauf, []);
  /* Anweisung 20: In welchen Szenarien jedes Plugin beim letzten Abspielen gearbeitet hat */
  const gearbeitet = await liesJson(q.gearbeitet, {});
  const arbeitetIn = (k) => Object.keys(gearbeitet).filter(s => gearbeitet[s].plugins?.includes(k))
    .map(s => ({ szenario: s, name: szenarien.get(s) || 'Szenario ohne Titel', datum: datum(gearbeitet[s].datum) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const projekt = q.projekt;
  const namen = projekt.fachobjektNamen || {};
  const besitzer = new Map();
  const knoten = flacheBereiche(projekt.bereiche);
  const apps = knoten.filter(b => !b.kinder);
  for (const b of apps) for (const f of b.fachobjekte || []) besitzer.set(f.split('/')[0], b.kennung);
  const heimat = apps.find(b => b.prototyp)?.kennung ?? apps[0]?.kennung;
  /* Stränge kommen aus den Ketten beim Abspielen. Nur wo noch nie gespielt wurde, aus dem Quelltext. */
  const laufzeit = new Map();
  for (const e of Object.values(gearbeitet)) {
    for (const [p, z] of Object.entries(e.zugriffe || {})) {
      if (!laufzeit.has(p)) laufzeit.set(p, new Map());
      for (const [w, a] of Object.entries(z)) if (a === 'aendert' || !laufzeit.get(p).has(w)) laufzeit.get(p).set(w, a);
    }
  }
  const standDatei = await liesJson(q.stand, null);
  const ist = Object.values(standDatei?.ergebnis?.ist || {});
  const inKaufSchluessel = new Set(inKauf.map(e => e.schluessel).filter(Boolean));
  const faelleDatei = await liesJson(q.faelle, []);
  const abgehakt = JSON.stringify(faelleDatei);
  const blindOffen = [...new Set(ist.flatMap(v => v.blind || []))].filter(k => !abgehakt.includes(k)).map(k => k.split('|')[0]);
  const quelltext = new Map();
  const umgekehrt = new Set();

  const bausteine = {};
  const straenge = [];
  /* Zu welcher Teil-App ein Szenario gehört: die seines Plugins, sonst die Dispo. */
  const szenarioBereich = new Map();
  /* Was am Fachobjekt angefasst wird, in den Worten des Projekts: „die Abwesenheit eines Mitarbeiters“.
     Ohne bekannte Angabe bleibt es beim Fachobjekt; ein Feldname erscheint nie. */
  const wasAm = (wurzel, felder) => {
    const worte = [...new Set(felder.map(f => projekt.feldNamen?.[wurzel]?.[f]).filter(Boolean))].sort();
    if (!worte.length) return anzeigeFachobjekt(wurzel, namen);
    const liste = worte.length === 1 ? worte[0] : `${worte.slice(0, -1).join(', ')} und ${worte[worte.length - 1]}`;
    return `${liste} ${projekt.fachobjektEiner?.[wurzel] ?? anzeigeFachobjekt(wurzel, namen)}`;
  };
  const beziehe = (bereich, z, wer, kennung, name) => {
    for (const [wurzel, art] of z) {
      if (wurzel.includes('/')) continue;
      const anderer = besitzer.get(wurzel);
      if (!anderer || anderer === bereich) continue;
      const felder = [...z].filter(([k, a]) => k.startsWith(`${wurzel}/`) && (wer === 'regel' || a === art)).map(([k]) => k.split('/')[1]);
      const fach = wasAm(wurzel, felder);
      const verb = art === 'aendert' ? 'ändert' : 'liest';
      straenge.push({
        von: bereich, nach: anderer, wurzel, wer, kennung, art, zustand: 'klar',
        satz: wer === 'regel' ? `Die Regel „${name}“ prüft ${fach}.` : `„${name}“ ${verb} ${fach}.`,
      });
    }
  };

  for (const k of kennungen) {
    const ordner = path.join(q.bausteine, k);
    const h = await liesJson(path.join(ordner, 'herkunft.json'), null);
    const nr = h?.aktuell ?? null;
    const eigener = nr ? await lies(path.join(ordner, `fassung-${String(nr).padStart(3, '0')}.js`)) : null;
    const code = eigener ?? (await lies(path.join(q.grund, `${k}.js`))) ?? '';
    const titel = /titel\s*:\s*"([^"]+)"/.exec(code)?.[1];
    const name = h?.name || titel || k;
    const fassungen = (h?.fassungen || []).map(f => fassungAus(f, szenarien));
    const entscheidungen = abgleich.filter(e => e.plugin === k).flatMap(abgleichEntscheidungen);
    const bereichVon = h?.teilApp ?? heimat;
    for (const f of h?.fassungen || []) if (typeof f.drehbuch === 'string' && h.teilApp) szenarioBereich.set(f.drehbuch, h.teilApp);
    bausteine[k] = { kennung: k, name, bereich: bereichVon, aktuell: nr, aus: aus.has(k), fassungen, entscheidungen, arbeitetIn: arbeitetIn(k) };
    quelltext.set(k, code);
    /* Anweisung 28c: Instabil ist ein Plugin nur, wenn eine Fassung zurückgenommen wurde. Mehrere Fassungen in dieselbe Richtung sind klar. */
    const geltend = new Set();
    for (let n = nr; n && !geltend.has(n);) { geltend.add(n); n = h.fassungen.find(f => f.nr === n)?.vorige; }
    if (h && h.fassungen.some(f => !geltend.has(f.nr))) umgekehrt.add(k);
    beziehe(bereichVon, laufzeit.size ? (laufzeit.get(k) ?? new Map()) : zugriffe(code), 'plugin', k, name);
  }

  /* Ein Plugin, das per Nachricht ein Plugin eines anderen Bereichs etwas ändern lässt, bildet einen Strang dorthin. */
  for (const [k, z] of laufzeit) {
    if (!bausteine[k]) continue;
    const je = new Map();
    for (const schluessel of z.keys()) {
      const m = /^durch\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(schluessel);
      if (!m || !bausteine[m[1]] || bausteine[m[1]].bereich === bausteine[k].bereich) continue;
      const id = `${m[1]}|${m[2]}`;
      if (!je.has(id)) je.set(id, { nach: bausteine[m[1]].bereich, wurzel: m[2], felder: [] });
      je.get(id).felder.push(m[3]);
    }
    for (const e of je.values()) straenge.push({ von: bausteine[k].bereich, nach: e.nach, wurzel: e.wurzel, wer: 'plugin', kennung: k, art: 'aendert', zustand: 'klar', satz: `„${bausteine[k].name}“ ändert ${wasAm(e.wurzel, e.felder)}.` });
  }

  const fachregeln = {};
  const regelCode = new Map();
  for (const d of await dateienIn(q.regeln)) {
    if (!d.endsWith('.js')) continue;
    const code = await lies(path.join(q.regeln, d));
    const k = /kennung\s*:\s*"([^"]+)"/.exec(code)?.[1];
    if (!k) continue;
    regelCode.set(k, code);
    const pfad = /pfad\s*:\s*"([^"]+)"/.exec(code)?.[1] ?? null;
    const satz = /satz\s*:\s*"([^"]+)"/.exec(code)?.[1] ?? k;
    const wie = /wie\s*:\s*"([^"]+)"/.exec(code)?.[1] ?? null;
    const tag = /datum\s*:\s*"([^"]+)"/.exec(code)?.[1] ?? null;
    const bereich = apps.find(b => (b.pfade || []).includes(pfad))?.kennung ?? heimat;
    /* Bewusst in Kauf genommene Verstöße hängen an der Regel, die sie brechen. */
    const inKaufHier = inKauf.filter(e => e.regel === k).map(e => ({ satz: e.satz || null, datum: datum(e.datum) }));
    fachregeln[k] = { kennung: k, satz, bereich, wie, datum: datum(tag), inKauf: inKaufHier };
    /* Welche Angaben eine Regel prüft, steht in ihrem Code. Den Namen braucht sie nur für ihren Satz. */
    const zr = zugriffe(code);
    for (const w of [...zr.keys()]) for (const f of Object.keys(projekt.feldNamen?.[w] ?? {})) if (f !== 'name' && new RegExp(`\\.${f}\\b`).test(code)) zr.set(`${w}/${f}`, 'liest');
    beziehe(bereich, zr, 'regel', k, satz);
  }

  /* Anweisung 49 (c): Jede Naht ist ein Strang. Eine Teil-App gibt ausdrücklich weiter, was andere lesen dürfen. */
  for (const x of flacheBereiche(projekt.bereiche)) {
    for (const n of x.veroeffentlicht || []) {
      for (const nach of n.fuer || apps.map(a => a.kennung).filter(k => k !== x.kennung)) {
        straenge.push({ von: x.kennung, nach, wurzel: n.kennung, wer: 'naht', kennung: n.kennung, art: 'liest', zustand: 'klar',
          satz: `${x.name} gibt ${n.was} an „${apps.find(a => a.kennung === nach)?.name ?? nach}“ weiter.` });
      }
    }
  }

  /* Anweisung 49 (d): Ein offener Antrag steht an der Naht zwischen den beiden Teil-Apps und wartet auf den PO der anderen. */
  const antraege = q.antraege ? await liesJson(q.antraege, []) : [];
  const nameVon = (k) => apps.find(b => b.kennung === k)?.name ?? k;
  for (const e of antraege.filter(x => x.status === 'offen')) {
    straenge.push({ von: e.von, nach: e.an, wurzel: e.id, wer: 'antrag', kennung: e.id, art: 'bittet', zustand: 'offen',
      satz: `Antrag: „${nameVon(e.von)}“ bittet „${nameVon(e.an)}“: ${e.satz}` });
  }

  /* Zustand je Strang: offen, Widerspruch, instabil; sonst klar. */
  for (const s of straenge) {
    if (s.wer === 'plugin') {
      const code = quelltext.get(s.kennung) ?? '';
      /* Anweisung 28b: Offen nur, wer das Fachobjekt ändert. Wer ein Ereignis nur beschreibt, lässt keine Entscheidung warten. */
      if (s.art === 'aendert' && blindOffen.some(m => m.startsWith(`${s.wurzel}/`) && code.includes(m))) s.zustand = 'offen';
      if (umgekehrt.has(s.kennung)) s.zustand = 'instabil';
    } else if (s.wer === 'regel') {
      const eigener = fachregeln[s.kennung].bereich;
      const gebrochen = Object.values(standDatei?.ergebnis?.ist || {}).some(v =>
        (v.verstoesse || []).some(x => x.regel === s.kennung && !inKaufSchluessel.has(x.schluessel)) &&
        (v.taeter || []).some(t => bausteine[t] && bausteine[t].bereich !== eigener));
      if (gebrochen) s.zustand = 'widerspruch';
    }
  }

  /* Bündel: je Paar von Knoten, die weder gleich noch Vor- und Nachfahren sind. So wandern die Stränge beim Hineinzoomen mit. */
  const nachKennung = new Map(knoten.map(b => [b.kennung, b]));
  const vorfahren = (k) => { const out = []; for (let n = nachKennung.get(k); n; n = n.eltern ? nachKennung.get(n.eltern) : null) out.push(n.kennung); return out; };
  const faeden = new Map();
  for (const s of straenge) {
    const va = vorfahren(s.von), na = vorfahren(s.nach);
    for (const x of va) {
      for (const y of na) {
        if (x === y || va.includes(y) || na.includes(x)) continue;
        const [von, nach] = [x, y].sort();
        const k = `${von}--${nach}`;
        if (!faeden.has(k)) faeden.set(k, { kennung: k, von, nach, zustand: 'klar', straenge: [] });
        const f = faeden.get(k);
        if (!f.straenge.includes(s)) { f.straenge.push(s); f.zustand = schlechter(f.zustand, s.zustand); }
      }
    }
  }

  /* Anweisung 21: der Grundstock, nachträglich erfasst. Eigene Knoten, keine echte Herkunft; was der PO dazu
     angemerkt hat, liegt beim Navigator. */
  const anmerkungen = await liesJson(q.anmerkungen, {});
  const bestaetigungen = await liesJson(q.bestaetigungen, {});
  const geaendert = q.grundstockGeaendert ? await liesJson(q.grundstockGeaendert, []) : [];
  const grundfunktionen = {};
  for (const g of await liesJson(q.grundfunktionen, [])) {
    const a = anmerkungen[g.kennung];
    /* Anweisung 34 (d): Hat ein Wunsch eine bestätigte Grundfunktion nach der Bestätigung berührt, ist sie wieder ein Vorschlag. */
    const best = bestaetigungen[g.kennung];
    const vorschlag = !!best && geaendert.some(e => e.kennung === g.kennung && (!best.zeit || e.datum > best.zeit));
    grundfunktionen[g.kennung] = { ...g, anmerkung: a?.text ?? null, anmerkungDatum: datum(a?.datum), vorschlag: !a && vorschlag, bestaetigt: a || vorschlag ? null : datum(best?.datum) };
  }

  /* Anweisung 30: jeder offene Punkt einzeln, an der festen Kennung seines Dings. Die Zahlen sind nur noch die Summe davon.
     Was der PO gelöst hat, fällt hier heraus: bewusst in Kauf Genommenes und Fälle, die keine Regel brauchen. */
  const istJe = standDatei?.ergebnis?.ist || {};
  const appMitPrototyp = (k) => apps.some(b => b.kennung === k && b.prototyp);
  /* Auch Gelöstes bekommt seine Teil-App: Die Steuerleiste zeigt es dort weiter als erledigt. */
  const allePunkte = [];
  const verstoesse = new Map();
  for (const [sz, v] of Object.entries(istJe)) {
    for (const x of v.verstoesse || []) {
      if (!verstoesse.has(x.schluessel)) verstoesse.set(x.schluessel, { x, szenarien: [], taeter: [] });
      const e = verstoesse.get(x.schluessel);
      e.szenarien.push(sz);
      /* Wer die betroffenen Objekte im Szenario wirklich ändert; so findet sich das Plugin auch, wenn die Hand den Anstoß gab. */
      const wurzeln = (x.pfade || []).map(p => p.split('/')[0]);
      e.taeter.push(...(v.taeter || []).filter(t => wurzeln.some(w => v.zugriffe?.[t]?.[w] === 'aendert')));
    }
  }
  for (const { x, szenarien, taeter } of verstoesse.values()) {
    const plugin = [x.verursacher, ...taeter].find(k => k && bausteine[k]) ?? null;
    allePunkte.push({ geloest: inKaufSchluessel.has(x.schluessel), id: `verstoss|${x.schluessel}`, art: 'verstoss', farbe: 'rot', satz: x.satz, schluessel: x.schluessel, regel: x.regel, plugin,
      bereich: plugin ? bausteine[plugin].bereich : szenarioBereich.get(szenarien[0]) ?? heimat, szenarien });
  }
  for (const a of standDatei?.punkte?.abweichend || []) {
    const u = standDatei.ergebnis?.ursachen?.[a.kennung] || {};
    const plugin = [u.plan?.kennung, u.anzeige?.kennung].find(k => k && bausteine[k]) ?? null;
    allePunkte.push({ id: `abweichung|${a.kennung}`, art: 'abweichung', farbe: 'gelb', satz: `„${a.titel}“ endet anders als erwartet${a.satz ? `: ${a.satz}` : '.'}`,
      schluessel: a.kennung, plugin, bereich: szenarioBereich.get(a.kennung) ?? heimat, szenarien: [a.kennung] });
  }
  const erledigteFaelle = new Set(faelleDatei.map(e => e.schluessel));
  for (const f of standDatei?.punkte?.faelle || []) {
    const [art, a, b] = f.schluessel.split('|');
    const muster = art === 'status' ? a : null, wurzel = art === 'status' ? b : a;
    const kandidaten = muster ? kennungen.filter(k => !aus.has(k) && (quelltext.get(k) ?? '').includes(muster)) : [];
    const plugin = kandidaten.find(k => laufzeit.get(k)?.get(wurzel) === 'aendert') ?? kandidaten[0] ?? null;
    const szenarien = muster ? Object.keys(istJe).filter(s => (istJe[s].blind || []).includes(`${muster}|${wurzel}`)) : [];
    const eigner = besitzer.get(wurzel);
    allePunkte.push({ geloest: erledigteFaelle.has(f.schluessel), id: `fall|${f.schluessel}`, art: 'fall', farbe: 'gelb', satz: f.satz, schluessel: f.schluessel, plugin, muster, wurzel,
      bereich: plugin ? bausteine[plugin].bereich : appMitPrototyp(eigner) ? eigner : heimat, szenarien });
  }
  for (const g of Object.values(grundfunktionen)) {
    if (g.anmerkung) allePunkte.push({ id: `stimmtnicht|${g.kennung}`, art: 'stimmtnicht', farbe: 'gelb', satz: `„${g.name}“ stimmt nicht: ${g.anmerkung}`, schluessel: g.kennung, gf: g.kennung, plugin: null, bereich: g.bereich, szenarien: [] });
  }
  for (const e of antraege) {
    allePunkte.push({ geloest: e.status !== 'offen', id: `antrag|${e.id}`, art: 'antrag', farbe: 'gelb', satz: `„${nameVon(e.von)}“ bittet „${nameVon(e.an)}“: ${e.satz}`,
      schluessel: e.id, plugin: null, bereich: e.an, von: e.von, szenarien: [] });
  }
  const punkte = allePunkte.filter(p => !p.geloest);
  const ROT_ZUERST = { verstoss: 0, abweichung: 1, stimmtnicht: 2, fall: 3 };
  punkte.sort((a, b) => ROT_ZUERST[a.art] - ROT_ZUERST[b.art] || (a.satz < b.satz ? -1 : a.satz > b.satz ? 1 : 0));

  /* Anweisung 30e: Jede Ebene trägt ihre eigene Zahl. Jeder Punkt hängt an genau einem Plugin, einer Grundfunktion oder „ohne Plugin“. */
  const zaehle = (liste) => ({ verstoesse: liste.filter(p => p.art === 'verstoss').length, faelle: liste.filter(p => p.art === 'fall').length,
    abweichend: liste.filter(p => p.art === 'abweichung').length, stimmtnicht: liste.filter(p => p.art === 'stimmtnicht').length });
  for (const b of Object.values(bausteine)) b.zahl = zaehle(punkte.filter(p => p.plugin === b.kennung));
  for (const g of Object.values(grundfunktionen)) g.zahl = zaehle(punkte.filter(p => p.gf === g.kennung));
  /* Zahl am Strang: was gerade an genau diesem Strang wartet. */
  for (const s of straenge) {
    s.id = `${s.wer}|${s.kennung}|${s.von}|${s.nach}|${s.wurzel}`;
    s.punkte = punkte.filter(p => s.wer === 'antrag' ? p.id === `antrag|${s.kennung}` : (s.wer === 'regel' ? p.regel === s.kennung && s.zustand === 'widerspruch'
      : p.art === 'fall' && p.plugin === s.kennung && !!p.muster && p.muster.startsWith(`${s.wurzel}/`) && s.zustand === 'offen')).map(p => p.id);
  }
  const zahlVon = (b) => zaehle(punkte.filter(p => (b.kinder ? flacheBereiche(b.kinder).some(k => k.kennung === p.bereich) : p.bereich === b.kennung)));
  const baustand = (b) => {
    if (b.kinder) { const k = b.kinder.map(baustand); return k.includes('prototyp') ? 'prototyp' : k.includes('daten') ? 'daten' : 'leer'; }
    return b.prototyp ? 'prototyp' : (b.fachobjekte || []).length ? 'daten' : 'leer';
  };
  /* Anweisung 44: Was geleert wurde, steht nur noch als eine Zeile mit Datum am Bereich. */
  const geleert = await liesJson(path.join(q.ordner, 'entscheidungen', 'geleert.json'), []);
  const bereiche = {};
  for (const b of knoten) {
    bereiche[b.kennung] = {
      kennung: b.kennung, name: b.name, verantwortlich: b.verantwortlich ?? null, eltern: b.eltern, tiefe: b.tiefe,
      ordner: !!b.kinder, beispieldaten: !!b.beispieldaten, baustand: baustand(b), prototyp: baustand(b) === 'prototyp', zahl: zahlVon(b),
      ohnePlugin: zaehle(punkte.filter(p => p.bereich === b.kennung && !p.plugin && !p.gf)),
      fachobjekte: [...new Set((b.fachobjekte || []).map(f => anzeigeFachobjekt(f.split('/')[0], namen)))],
      geleert: geleert.filter(e => e.bereich === b.kennung).map(e => datum(e.datum)),
    };
  }

  const alleFaeden = {};
  for (const [k, f] of [...faeden].sort(([a], [b]) => (a < b ? -1 : 1))) {
    f.straenge.sort((a, b) => (a.satz < b.satz ? -1 : a.satz > b.satz ? 1 : 0));
    alleFaeden[k] = f;
  }

  const angaben = await angabenVon(q, { gearbeitet, bausteine, besitzer, namen, regelCode });

  /* Anweisung 45 (e): Sicherungen des Projekts mit Datum, Uhrzeit und dem Satz, wovor sie entstanden. */
  const sicherungen = {};
  (await sicherungenVon(q.ordner)).forEach((s, i) => {
    sicherungen[s.kennung] = { kennung: s.kennung, reihe: i, zeit: zeitpunkt(s.datum),
      satz: s.art === 'zurueckholen' ? `vor dem Zurückholen der Sicherung vom ${zeitpunkt(s.von) ?? 'unbekannten Tag'}` : `vor dem Leeren von „${s.name ?? s.bereich}“` };
  });

  return {
    titel: 'Netz-Navigator',
    untertitel: `Herkunft von ${q.name} · nur lesen`,
    pfad: 'netz-navigator/karte',
    objekte: {
      navi: {
        jetzt: { kennung: 'jetzt', pfad: 'karte' },
        faden: { kennung: 'faden', stationen: ['karte'], hier: 0 },
      },
      bereiche, bausteine, fachregeln, faeden: alleFaeden, grundfunktionen, angaben, sicherungen,
    },
    punkte,
    /* Anweisung 31a: zu welcher Teil-App jeder Punkt gehört, auch der gelöste */
    teilAppJe: Object.fromEntries(allePunkte.map(p => [p.id, p.bereich])),
  };
}

/* Anweisung 42: je Angabe eines Fachobjekts, wer sie liest, wer sie ändert, welche Regeln sie bewachen und woher sie stammt.
   Fachobjekte sind die Arten im Datenmodell des Projekts. Lesen und Ändern kommen allein aus dem, was Play beim letzten
   Abspielen mitgeschrieben hat (gearbeitet.json); was nie gespielt wurde, steht leer da, nichts wird geschätzt.
   Kennung einer Angabe ist „<fachobjekt>--<angabe>“ aus festen Kennungen; ihr Name kommt aus projekt.json (angabeNamen). */
async function grundstockVon(q) {
  let tag = null;
  const Huelle = { daten(d) { if (!tag) tag = { objekte: {}, arten: {} }; Object.assign(tag.objekte, d.objekte || {}); Object.assign(tag.arten, d.arten || {}); } };
  const ordner = path.join(q.ordner, 'daten');
  for (const d of await dateienIn(ordner)) {
    if (!d.endsWith('.js')) continue;
    try { vm.runInNewContext(await lies(path.join(ordner, d)), { Huelle }, { timeout: 1000 }); } catch { /* bleibt, was sich lesen ließ */ }
  }
  return tag ?? { objekte: {}, arten: {} };
}

export async function angabenVon(q, { gearbeitet, bausteine, besitzer, namen, regelCode }) {
  const tag = await grundstockVon(q);
  const grunddaten = q.grunddaten ? await liesJson(q.grunddaten, []) : [];
  const angabeNamen = q.projekt.angabeNamen || {};
  const out = {};
  const eintrag = (w, f) => {
    const k = `${w}--${f}`;
    if (!out[k]) out[k] = { kennung: k, fachobjekt: w, angabe: f, fachobjektName: anzeigeFachobjekt(w, namen), name: angabeNamen[w]?.[f] ?? null,
      bereich: besitzer.get(w) ?? null, lesen: new Set(), aendern: new Set(), regeln: new Set(), grundstock: false };
    return out[k];
  };
  for (const [w, art] of Object.entries(tag.arten)) {
    for (const o of Object.values(tag.objekte[w] || {})) for (const f of Object.keys(o || {})) if (f !== 'kennung') eintrag(w, f).grundstock = true;
    if (art?.status) eintrag(w, 'status').grundstock = true;
  }
  /* Beim Abspielen mitgeschrieben: „<fachobjekt>/<angabe>“ gelesen oder geändert, „befehl/<fachobjekt>/status“ = Play den Status setzen lassen. */
  for (const e of Object.values(gearbeitet)) {
    for (const [p, z] of Object.entries(e.zugriffe || {})) {
      if (!bausteine[p]) continue;
      for (const [schluessel, a] of Object.entries(z)) {
        const befehl = /^befehl\/([^/]+)\/([^/]+)$/.exec(schluessel);
        const [w, f] = befehl ? [befehl[1], befehl[2]] : schluessel.split('/');
        if (!f || schluessel.split('/').length > (befehl ? 3 : 2) || !tag.arten[w]) continue;
        const x = eintrag(w, f);
        (befehl || a === 'aendert' ? x.aendern : x.lesen).add(p);
      }
    }
  }
  /* Regeln: welche Angaben eine Regel prüft, steht in ihrem Code an festen Namen. Was nur im Satz einer Meldung oder in einem
     Kommentar steht, bewacht nichts und zählt nicht. */
  for (const [r, quelle] of regelCode) {
    const wurzeln = zugriffe(quelle);
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\b(?:satz|wortlaut|erzaehlung)\s*:[^\n]*/g, '');
    for (const x of Object.values(out)) if (wurzeln.has(x.fachobjekt) && new RegExp(`\\.${x.angabe}\\b|["'\`]${x.angabe}["'\`]`).test(code)) x.regeln.add(r);
  }
  /* Herkunft: aus dem Grundstock, sonst aus dem frühesten Wunsch, dessen Plugin die Angabe ändert und sie in seinem Code nennt. */
  for (const x of Object.values(out)) {
    x.lesen = [...x.lesen].filter(k => !x.aendern.has(k)).sort();
    x.aendern = [...x.aendern].sort();
    x.regeln = [...x.regeln].sort();
    if (x.grundstock) x.herkunft = { art: 'grundstock' };
    else {
      const kandidaten = [];
      for (const k of x.aendern) {
        const h = await liesJson(path.join(q.bausteine, k, 'herkunft.json'), null);
        if (!h?.fassungen?.length) { kandidaten.push({ art: 'grundstock', zeit: '' }); continue; }
        for (const f of [...h.fassungen].sort((a, b) => a.nr - b.nr)) {
          const code = await lies(path.join(q.bausteine, k, `fassung-${String(f.nr).padStart(3, '0')}.js`));
          if (code && new RegExp(`\\b${x.angabe}\\b`).test(code)) { kandidaten.push({ art: 'wunsch', wunsch: wunschNr(f.wunsch), datum: datum(f.datum), plugin: k, zeit: String(f.datum ?? '') }); break; }
        }
      }
      kandidaten.sort((a, b) => (a.zeit < b.zeit ? -1 : a.zeit > b.zeit ? 1 : 0));
      const erste = kandidaten[0];
      x.herkunft = erste ? (({ zeit, ...rest }) => rest)(erste) : { art: 'unbekannt' };
    }
    /* Grunddaten, die ein Wunsch an dieser Angabe geändert hat (Anweisung 34), mit Datum. */
    x.geaendert = grunddaten.filter(e => {
      const t = String(e.pfad || '').split('/');
      return (t[0] === 'arten' && t[1] === x.fachobjekt && t[2] === x.angabe) || (t[0] === 'objekte' && t[1] === x.fachobjekt && t[3] === x.angabe);
    }).map(e => ({ wunsch: wunschNr(e.wunsch), datum: datum(e.datum), satz: e.satz || null }));
    delete x.grundstock;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
