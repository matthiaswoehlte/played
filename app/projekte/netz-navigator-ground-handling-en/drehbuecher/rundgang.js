Huelle.drehbuch({
  kennung: "rundgang",
  titel: "Into Dispatch and back to the map",
  von: "08:00",
  bis: "08:05",
  ereignisse: [
    { zeit: "08:01", objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: "bereiche/disposition" }, erzaehlung: "Dispatch is opened" },
    { zeit: "08:03", objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: "karte" }, erzaehlung: "Back to the map" }
  ],
  erwartet: [
    { text: "At the end the map is shown again.", pruefe: [{ pfad: "navi/jetzt/pfad", gleich: "karte" }] }
  ]
});
