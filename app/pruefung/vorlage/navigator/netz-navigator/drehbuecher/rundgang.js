Huelle.drehbuch({
  kennung: "rundgang",
  titel: "In die Disposition und zurück zur Karte",
  von: "08:00",
  bis: "08:05",
  ereignisse: [
    { zeit: "08:01", objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: "bereiche/disposition" }, erzaehlung: "Disposition wird geöffnet" },
    { zeit: "08:03", objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: "karte" }, erzaehlung: "Zurück zur Karte" }
  ],
  erwartet: [
    { text: "Am Ende steht wieder die Karte da.", pruefe: [{ pfad: "navi/jetzt/pfad", gleich: "karte" }] }
  ]
});
