/* Netz-Navigator: Die Daten liefert der Leser in Play (daten/herkunft.js entsteht beim Laden aus der Herkunft
   des gelesenen Projekts); die Grundausstattung sind vier kleine Plugins. */
Huelle.lade({
  stil: ["plugins/aussehen.css"],
  daten: ["daten/herkunft.js"],
  plugins: [
    "plugins/karte.js",
    "plugins/hineinzoomen.js",
    "plugins/uebersicht.js",
    "plugins/ariadnefaden.js"
  ],
  regeln: [],
  bereit: [],
  drehbuecher: ["drehbuecher/rundgang.js"]
});
