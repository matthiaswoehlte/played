/* Startet für eine Prüfung eine eigene Brücke mit Wegwerf-Ordner für Sollergebnisse.
   Die Prüfungen spielen Drehbücher ab und jeder gesehene Endstand wird Sollergebnis;
   gegen die echte Brücke würden sie die Dateien im Repo überschreiben.
   mitKopie: arbeitet auf einer Kopie der echten Wünsche und Sollergebnisse, damit eine
   Prüfung löschen und abschalten kann, ohne dass die Dateien im Repo das merken.
   Port: Die Zahl im Aufruf ist nur ein Wunsch. Ist er belegt (etwa weil im vollen Lauf mehrere
   Prüfungen gleichzeitig laufen), nimmt die Brücke einen freien Port. Von Hand gespielte Szenarien
   liegen ebenfalls in einer Kopie, damit eine Prüfung, die eins behält, keine andere stört.
   Testvorlage (Anweisung 18 des PO, 09.11.): Alles, was der PO in der App wachsen lässt (Plugins aus
   Wünschen, Szenarien, Sollergebnisse, Entscheidungen, Regeln), kommt aus pruefung/vorlage, nie aus seiner
   Dispo. Die Vorlage wächst nur, wenn Play eine neue Fähigkeit bekommt; so bleibt die Prüfzeit gleich, wie
   viele Plugins und Szenarien der PO auch baut. */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vorlageKopie } from './vorlage-kopie.mjs';

const PLAY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = path.join(PLAY, 'server', 'start.mjs');
export const VORLAGE = path.join(PLAY, 'pruefung', 'vorlage');

/* Wunschport, wenn frei; sonst einer, den das System vergibt. */
function freierPort(wunsch) {
  const probe = p => new Promise(fertig => {
    const s = net.createServer();
    s.once('error', () => fertig(null));
    s.listen(p, '127.0.0.1', () => { const frei = s.address().port; s.close(() => fertig(frei)); });
  });
  return probe(wunsch).then(p => p ?? probe(0));
}

export async function eigeneBruecke(wunschPort = 4328, { mitKopie = false, ohneAbgleiche = false, attrappe = null, attrappeAbgleich = null, attrappeAuswahl = null, wuenscheAnPlay = null, protokoll = null, projekte = null, mitNavigator = false, mitSpeicher = false, ausVorlage = null } = {}) {
  const erster = await freierPort(wunschPort);
  /* Anweisung 51 (b): ausVorlage startet Play aus einer Wegwerf-Kopie, die nur aus Code und Testvorlage besteht (auch die
     Projektdatei); ein Ordner aus einem früheren Start wird weiterbenutzt. Ohne: wie bisher aus dem Play-Ordner. */
  const kopie = ausVorlage === true ? vorlageKopie() : null;
  const playOrdner = kopie ? kopie.play : typeof ausVorlage === 'string' ? ausVorlage : null;
  const start = playOrdner ? path.join(playOrdner, 'server', 'start.mjs') : START;
  const ordner = mkdtempSync(path.join(os.tmpdir(), 'play-soll-'));
  const umgebung = { PLAY_SOLLERGEBNISSE: ordner };
  /* Von Hand gespielte Szenarien: Kopie, damit Behalten und Löschen das Repo nicht berühren */
  const gespielt = mkdtempSync(path.join(os.tmpdir(), 'play-gespielt-'));
  if (existsSync(path.join(VORLAGE, 'drehbuecher', 'gespielt'))) cpSync(path.join(VORLAGE, 'drehbuecher', 'gespielt'), gespielt, { recursive: true });
  umgebung.PLAY_GESPIELT = gespielt;
  let plugindaten = null;
  /* Regeln immer als Kopie: Ein Wunsch kann eine Regel anlegen, die nicht ins Repo gehört. */
  const regeln = mkdtempSync(path.join(os.tmpdir(), 'play-regeln-'));
  cpSync(path.join(VORLAGE, 'regeln'), regeln, { recursive: true });
  umgebung.PLAY_REGELN = regeln;
  /* Entscheidungen „bewusst in Kauf genommen“ ebenfalls nur in der Kopie */
  const inKauf = path.join(regeln, '..', path.basename(regeln) + '-in-kauf.json');
  if (existsSync(path.join(VORLAGE, 'entscheidungen', 'in-kauf.json'))) cpSync(path.join(VORLAGE, 'entscheidungen', 'in-kauf.json'), inKauf);
  umgebung.PLAY_IN_KAUF = inKauf;
  /* Abgleich nach dem Einspielen (Überschuss, enger, KI-Regeln) und die Entscheidungen dazu: nur in der Kopie.
     ohneAbgleiche: beginnt leer, für Prüfungen, die nur die eigenen Abgleiche zählen (die des PO bleiben im Repo). */
  const abgleich = path.join(regeln, '..', path.basename(regeln) + '-abgleich.json');
  if (!ohneAbgleiche && existsSync(path.join(VORLAGE, 'entscheidungen', 'abgleich.json'))) cpSync(path.join(VORLAGE, 'entscheidungen', 'abgleich.json'), abgleich);
  umgebung.PLAY_ABGLEICH = abgleich;
  /* Wahl des PO, welches Plugin eine Bedienung übernimmt: nur in der Kopie */
  const bedienungen = path.join(regeln, '..', path.basename(regeln) + '-bedienungen.json');
  if (existsSync(path.join(VORLAGE, 'entscheidungen', 'bedienungen.json'))) cpSync(path.join(VORLAGE, 'entscheidungen', 'bedienungen.json'), bedienungen);
  umgebung.PLAY_BEDIENUNGEN = bedienungen;
  /* Abgehakte Fälle ohne Regel: nur in der Kopie */
  const faelle = path.join(regeln, '..', path.basename(regeln) + '-faelle.json');
  if (existsSync(path.join(VORLAGE, 'entscheidungen', 'faelle.json'))) cpSync(path.join(VORLAGE, 'entscheidungen', 'faelle.json'), faelle);
  umgebung.PLAY_FAELLE = faelle;
  /* Grunddaten aus Wünschen und berührte Grundfunktionen (Anweisung 34): nur in der Kopie */
  const grunddaten = path.join(regeln, '..', path.basename(regeln) + '-grunddaten.json');
  const grundstockGeaendert = path.join(regeln, '..', path.basename(regeln) + '-grundstock-geaendert.json');
  umgebung.PLAY_GRUNDDATEN = grunddaten;
  umgebung.PLAY_UNBESTAETIGT = path.join(regeln, '..', path.basename(regeln) + '-unbestaetigt.json');
  umgebung.PLAY_GRUNDSTOCK_GEAENDERT = grundstockGeaendert;
  /* Welche Plugins in welchem Szenario gearbeitet haben: nur in der Kopie */
  const gearbeitet = path.join(regeln, '..', path.basename(regeln) + '-gearbeitet.json');
  umgebung.PLAY_GEARBEITET = gearbeitet;
  /* Schneller Start: nur die Prüfung dazu arbeitet mit dem Speicher, alle anderen rechnen wie immer alles. */
  const speicher = path.join(regeln, '..', path.basename(regeln) + '-stand.json');
  umgebung.PLAY_STAND_SPEICHER = speicher;
  if (!mitSpeicher) umgebung.PLAY_OHNE_SPEICHER = '1';
  /* Grundstock: wird nur gelesen, darum direkt die Testvorlage */
  umgebung.PLAY_GRUNDFUNKTIONEN = path.join(VORLAGE, 'grundfunktionen.json');
  /* Plugins immer aus der Vorlage (als Kopie); mitKopie bringt dazu ihre Sollergebnisse mit. */
  plugindaten = mkdtempSync(path.join(os.tmpdir(), 'play-plugins-'));
  cpSync(path.join(VORLAGE, 'plugins', 'bausteine'), path.join(plugindaten, 'bausteine'), { recursive: true });
  if (existsSync(path.join(VORLAGE, 'plugins', 'papierkorb'))) cpSync(path.join(VORLAGE, 'plugins', 'papierkorb'), path.join(plugindaten, 'papierkorb'), { recursive: true });
  if (existsSync(path.join(VORLAGE, 'plugins', 'verwaltung.json'))) cpSync(path.join(VORLAGE, 'plugins', 'verwaltung.json'), path.join(plugindaten, 'verwaltung.json'));
  umgebung.PLAY_PLUGINDATEN = plugindaten;
  if (mitKopie) cpSync(path.join(VORLAGE, 'sollergebnisse'), ordner, { recursive: true });
  /* Eingang der Anhänge, bis ein Wunsch eingespielt ist */
  const anhaenge = mkdtempSync(path.join(os.tmpdir(), 'play-anhaenge-'));
  umgebung.PLAY_ANHAENGE = anhaenge;
  /* Projekte (Auftrag 009): weitere Projekte aus pruefung/vorlage/projekte in einer Kopie, dazu das zuletzt
     geöffnete. projekte: true legt die Kopie an; ein Ordner (aus einem früheren Start) wird weiterbenutzt,
     damit eine Prüfung Play neu starten und sehen kann, welches Projekt wiederkommt. */
  let projekteOrdner = null;
  if (projekte) {
    projekteOrdner = typeof projekte === 'string' ? projekte : mkdtempSync(path.join(os.tmpdir(), 'play-projekte-'));
    if (projekte === true) cpSync(path.join(VORLAGE, 'projekte'), projekteOrdner, { recursive: true });
  } else {
    /* Ohne Projekte: ein leerer Ordner, damit keine Prüfung das zuletzt geöffnete Projekt des PO erbt. */
    projekteOrdner = mkdtempSync(path.join(os.tmpdir(), 'play-projekte-'));
  }
  /* Netz-Navigator (Auftrag 009, Stufe 2): eingefrorene Kopie aus der Testvorlage, nie der des PO. */
  if (mitNavigator) cpSync(path.join(VORLAGE, 'navigator', 'netz-navigator'), path.join(projekteOrdner, 'netz-navigator'), { recursive: true });
  umgebung.PLAY_PROJEKTE = projekteOrdner;
  if (attrappe) umgebung.PLAY_KI_ATTRAPPE = attrappe;
  if (attrappeAbgleich) umgebung.PLAY_KI_ATTRAPPE_ABGLEICH = attrappeAbgleich;
  if (attrappeAuswahl) umgebung.PLAY_KI_ATTRAPPE_AUSWAHL = attrappeAuswahl;
  if (wuenscheAnPlay) umgebung.PLAY_WUENSCHE_AN_PLAY = wuenscheAnPlay;
  if (protokoll) umgebung.PLAY_KI_PROTOKOLL = protokoll;
  /* Zwei gleichzeitige Prüfungen können denselben freien Port erwischen; dann mit einem neuen nochmal. */
  let kind, port = erster;
  for (let versuch = 1; ; versuch++) {
    umgebung.PLAY_PORT = String(port);
    kind = spawn(process.execPath, [start, '--ohne-browser'], {
      env: { ...process.env, ...umgebung },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const gestartet = await new Promise(fertig => {
      kind.stdout.once('data', () => fertig(true));
      kind.once('exit', () => fertig(false));
    });
    if (gestartet) {
      /* Meldet die Seite, dass sie steht, sagt die Prüfung das einmal: Daran startet der volle Lauf die nächste. */
      let gesagt = false;
      kind.stdout.on('data', d => {
        if (!gesagt && /Seite bereit/.test(String(d))) { gesagt = true; console.log('     Seite geladen'); }
      });
      break;
    }
    if (versuch === 5) throw new Error(`Port ${port} ist belegt oder die Brücke startet nicht.`);
    port = await freierPort(0);
  }
  process.on('exit', () => {
    kind.kill();
    rmSync(ordner, { recursive: true, force: true });
    rmSync(regeln, { recursive: true, force: true });
    rmSync(inKauf, { force: true });
    rmSync(abgleich, { force: true });
    rmSync(bedienungen, { force: true });
    rmSync(faelle, { force: true });
    rmSync(gearbeitet, { force: true });
    rmSync(speicher, { force: true });
    rmSync(anhaenge, { recursive: true, force: true });
    rmSync(gespielt, { recursive: true, force: true });
    if (plugindaten) rmSync(plugindaten, { recursive: true, force: true });
    if (projekteOrdner && projekte !== projekteOrdner) rmSync(projekteOrdner, { recursive: true, force: true });
    if (kopie) rmSync(kopie.wurzel, { recursive: true, force: true });
  });
  return { play: playOrdner, adresse: `http://127.0.0.1:${port}/`, kind, projekte: projekteOrdner, ordner, plugindaten, regeln, inKauf, abgleich, anhaenge, bedienungen, gespielt, faelle, gearbeitet, speicher };
}
