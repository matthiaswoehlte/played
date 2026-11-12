/* Was diese Seite lädt. Neues kommt als eigene Datei dazu und wird hier eingetragen. */
Huelle.lade({
  daten: ["daten/tag.js"],
  plugins: [
    "plugins/gantt.js",
    "plugins/nicht-zugewiesen.js",
    "plugins/konfliktzaehler.js",
    "plugins/verhalten-krankmeldung.js",
    "plugins/verhalten-einsatz.js",
    "plugins/fachsprache.js"
  ],
  /* Regeln sind eigene Objekte mit Geltungsbereich (pfad), kein Teil eines Plugins. */
  regeln: [
    "regeln/ladegruppe-je-flug.js",
    "regeln/beginn-ab-on-block.js",
    "regeln/qualifikation-passt.js",
    "regeln/mindestdauer.js",
    "regeln/abwesend-auftraege-geloest.js",
    "regeln/fremd-schichtplanung-zwei-auftraege.js"
  ],
  /* Liegt bereit und wird erst beim Umschalten in die offene Seite geladen. Leer, seit die
     Variante „Automatisch umverteilen“ im Papierkorb liegt (PO, 07.11.2026, wegen N-111). */
  bereit: [],
  drehbuecher: ["drehbuecher/krankmeldung-ma-01.js", "drehbuecher/krankmeldung-ma-20.js"]
}).catch(function (e) {
  var d = document.createElement("div");
  d.className = "ladefehler";
  d.textContent = "Die Seite konnte nicht vollständig geladen werden: " + e.message;
  document.body.prepend(d);
});
