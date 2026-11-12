Huelle.drehbuch({
  kennung: "eintrag-erledigt",
  titel: "Erster Eintrag wird erledigt",
  von: "08:00",
  bis: "08:05",
  ereignisse: [
    { zeit: "08:01", objekt: "eintraege/E-1", aktion: "erledigen", erzaehlung: "Erster Eintrag ist erledigt" }
  ],
  erwartet: [
    { text: "Der erste Eintrag ist abgehakt.", pruefe: [{ pfad: "eintraege/E-1/erledigt", gleich: true }] }
  ]
});
