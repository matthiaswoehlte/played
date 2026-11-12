Huelle.drehbuch({
  kennung: "wunsch-039",
  titel: "Konfliktliste neben dem Geräteplan",
  von: "08:00",
  bis: "08:20",
  ereignisse: [],
  erwartet: [
    {
      text: "Neben dem Geräteplan steht die Liste der Gerätekonflikte.",
      pruefe: [{ sicht: "geraete-plan", enthaelt: "kennzahlen/geraetekonfliktfeld" }]
    },
    {
      text: "Zu Beginn ist kein Konflikt im Geräteplan hervorgehoben.",
      pruefe: [{ pfad: "kennzahlen/geraetekonfliktliste/konfliktwahl", gleich: null }]
    }
  ]
});