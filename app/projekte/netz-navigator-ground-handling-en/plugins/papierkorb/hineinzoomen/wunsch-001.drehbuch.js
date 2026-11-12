Huelle.drehbuch({
  kennung: "wunsch-001",
  titel: "Review starter kit, mark stays",
  von: "08:00",
  bis: "08:15",
  ereignisse: [
    { zeit: "08:02", objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: "bereiche/disposition" }, erzaehlung: "Dispatch is opened" },
    { zeit: "08:05", objekt: "grundfunktionen/balkenfarbe", aktion: "stimmtnicht", parameter: { text: "The legend is missing." }, erzaehlung: "Notes: bar colour is not right" },
    { zeit: "08:10", objekt: "bereiche/disposition", aktion: "durchgesehen", parameter: { datum: "09.11.2026" }, erzaehlung: "Starter kit is reviewed" }
  ],
  erwartet: [
    { text: "The Dispatch starter kit was reviewed on 09.11.2026.", pruefe: [{ pfad: "bereiche/disposition/durchgesehen", gleich: "09.11.2026" }, { nachricht: "bereiche/disposition.durchgesehen" }] },
    { text: "The bar colour stays marked “Not right” and can still be seen in the starter kit.", pruefe: [{ pfad: "grundfunktionen/balkenfarbe/anmerkung", gleich: "The legend is missing." }, { sicht: "hineinzoomen", enthaelt: "grundfunktionen/balkenfarbe" }] }
  ]
});