/* Drehbuch: Der Disponent sucht im Tagesplan.
   08:03 „Engström“: ein Treffer, die Zeile von V. Engström (MA-05).
   08:07 „810“: elf Balken von XC 810, in Planreihenfolge zuerst XC 810 Entladen bei R. Aldinger.
   08:10 Enter: XC 810 Beladen bei R. Aldinger (2 von 11).
   08:13 Enter: XC 810 Entladen bei S. Brendel (3 von 11).
   Die Suche ändert nichts am Plan, die Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-023",
  titel: "Search agents and flights in the daily plan",
  von: "08:00",
  bis: "08:20",
  ereignisse: [
    {
      zeit: "08:03", objekt: "kennzahlen/suche", aktion: "suchen",
      parameter: { begriff: "Engström", nr: 0 },
      erzaehlung: "Dispatcher searches for “Engström”: V. Engström (AG-05) (1 of 1)"
    },
    {
      zeit: "08:07", objekt: "kennzahlen/suche", aktion: "suchen",
      parameter: { begriff: "810", nr: 0 },
      erzaehlung: "Dispatcher searches for “810”: XC 810 unloading with R. Aldinger (1 of 11)"
    },
    {
      zeit: "08:10", objekt: "kennzahlen/suche", aktion: "suchen",
      parameter: { begriff: "810", nr: 1 },
      erzaehlung: "Dispatcher searches on for “810”: XC 810 loading with R. Aldinger (2 of 11)"
    },
    {
      zeit: "08:13", objekt: "kennzahlen/suche", aktion: "suchen",
      parameter: { begriff: "810", nr: 2 },
      erzaehlung: "Dispatcher searches on for “810”: XC 810 unloading with S. Brendel (3 of 11)"
    }
  ],
  erwartet: [
    {
      text: "The search field sits above the daily plan.",
      pruefe: [{ sicht: "gantt", enthaelt: "kennzahlen/suche" }]
    },
    {
      text: "The search is for “810”, and after pressing Enter twice the search is on the third hit, XC 810 Unloading with S. Brendel.",
      pruefe: [
        { nachricht: "kennzahlen/suche.suchen" },
        { pfad: "kennzahlen/suche/begriff", gleich: "810" },
        { pfad: "kennzahlen/suche/nr", gleich: 2 },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-02" },
        { sicht: "gantt", enthaelt: "mitarbeiter/MA-05" }
      ]
    },
    {
      text: "Search does not change the plan: the tasks found keep their agents and times.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC810-ENTL-02/mitarbeiter", gleich: "MA-02" },
        { pfad: "auftraege/XC810-ENTL-02/start", gleich: "08:55" },
        { pfad: "auftraege/XC810-ENTL-02/ende", gleich: "09:15" }
      ]
    },
    {
      text: "The conflict counter stays at 6.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
