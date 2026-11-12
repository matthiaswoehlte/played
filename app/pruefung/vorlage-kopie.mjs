/* Wegwerf-Kopie von Play nur aus Code und Testvorlage (Anweisung 18 a und 51 b des PO).
   Aus dem Play-Ordner kommt nur der Code (server, huelle, index.html). Alles, was ein Projekt ausmacht, kommt aus
   pruefung/vorlage: die feste Projektdatei und der Grundstock der Dispo (vorlage/stamm), Plugins aus Wünschen,
   Szenarien, Sollergebnisse, Entscheidungen, Regeln, Grundfunktionen, das Probeprojekt und der Netz-Navigator.
   So hängt eine Prüfung nie an dem, was der PO in seiner Dispo baut, leert oder neu anlegt.
   Die Kopie liegt in derselben Tiefe wie das Original (<wurzel>/prototype-ideas/play), damit Wege nach oben gleich bleiben.
   Rückgabe: { wurzel, play } */
import { cpSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VORLAGE = path.join(PLAY, 'pruefung', 'vorlage');

export function vorlageKopie(praefix = 'play-vorlage-') {
  const wurzel = mkdtempSync(path.join(os.tmpdir(), praefix));
  const play = path.join(wurzel, 'prototype-ideas', 'play');
  mkdirSync(play, { recursive: true });
  const nimm = (von, nach) => { if (existsSync(von)) cpSync(von, nach, { recursive: true }); };
  /* Code von Play */
  for (const n of ['server', 'huelle', 'index.html']) nimm(path.join(PLAY, n), path.join(play, n));
  /* Projekt aus der Vorlage */
  nimm(path.join(VORLAGE, 'stamm'), play);
  for (const n of ['bausteine', 'papierkorb', 'verwaltung.json']) nimm(path.join(VORLAGE, 'plugins', n), path.join(play, 'plugins', n));
  nimm(path.join(VORLAGE, 'drehbuecher', 'gespielt'), path.join(play, 'drehbuecher', 'gespielt'));
  nimm(path.join(VORLAGE, 'sollergebnisse'), path.join(play, 'sollergebnisse'));
  nimm(path.join(VORLAGE, 'entscheidungen'), path.join(play, 'entscheidungen'));
  nimm(path.join(VORLAGE, 'regeln'), path.join(play, 'regeln'));
  nimm(path.join(VORLAGE, 'grundfunktionen.json'), path.join(play, 'grundfunktionen.json'));
  nimm(path.join(VORLAGE, 'projekte'), path.join(play, 'projekte'));
  nimm(path.join(VORLAGE, 'navigator', 'netz-navigator'), path.join(play, 'projekte', 'netz-navigator'));
  return { wurzel, play };
}
