/* Drehbuch: Der Disponent zieht vier Balken an ihren Rändern, je einmal für jeden Fall.
   Rechts verlängern: XC 810 Innenraum-Cleaning bis 10:00, überschneidet sich bei MA-40 mit
   XB 933 Innenraum-Cleaning ab 09:45: Konflikte 6 → 7.
   Links verlängern, links verkürzen, rechts verkürzen: ohne neue Überschneidung. */
Huelle.drehbuch({
  kennung: "wunsch-004",
  titel: "Einsatzbalken mit der Maus verlängern und verkürzen",
  von: "08:15",
  bis: "08:40",
  ereignisse: [
    {
      zeit: "08:20", objekt: "auftraege/XC810-CLEAN-01", aktion: "zeitaendern",
      parameter: { kante: "ende", zeit: "10:00" },
      erzaehlung: "XC 810 Innenraum-Cleaning endet jetzt um 10:00"
    },
    {
      zeit: "08:24", objekt: "auftraege/XB933-TANK-01", aktion: "zeitaendern",
      parameter: { kante: "start", zeit: "09:30" },
      erzaehlung: "XB 933 Betanken beginnt jetzt um 09:30"
    },
    {
      zeit: "08:28", objekt: "auftraege/XC810-BELA-01", aktion: "zeitaendern",
      parameter: { kante: "start", zeit: "09:20" },
      erzaehlung: "XC 810 Beladen beginnt jetzt um 09:20"
    },
    {
      zeit: "08:32", objekt: "auftraege/XB933-BELA-01", aktion: "zeitaendern",
      parameter: { kante: "ende", zeit: "10:10" },
      erzaehlung: "XB 933 Beladen endet jetzt um 10:10"
    }
  ],
  erwartet: [
    {
      text: "XC 810 Innenraum-Cleaning ist am rechten Rand verlängert und läuft von 09:10 bis 10:00.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.zeitaendern" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "10:00" }
      ]
    },
    {
      text: "XB 933 Betanken ist am linken Rand verlängert und läuft von 09:30 bis 10:05.",
      pruefe: [
        { nachricht: "auftraege/XB933-TANK-01.zeitaendern" },
        { pfad: "auftraege/XB933-TANK-01/start", gleich: "09:30" },
        { pfad: "auftraege/XB933-TANK-01/ende", gleich: "10:05" }
      ]
    },
    {
      text: "XC 810 Beladen ist am linken Rand verkürzt und läuft von 09:20 bis 09:35.",
      pruefe: [
        { nachricht: "auftraege/XC810-BELA-01.zeitaendern" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:20" },
        { pfad: "auftraege/XC810-BELA-01/ende", gleich: "09:35" }
      ]
    },
    {
      text: "XB 933 Beladen ist am rechten Rand verkürzt und läuft von 10:00 bis 10:10.",
      pruefe: [
        { nachricht: "auftraege/XB933-BELA-01.zeitaendern" },
        { pfad: "auftraege/XB933-BELA-01/start", gleich: "10:00" },
        { pfad: "auftraege/XB933-BELA-01/ende", gleich: "10:10" }
      ]
    },
    {
      text: "Die Aufträge bleiben bei ihren Mitarbeitern im Tagesplan.",
      pruefe: [
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: "MA-40" },
        { pfad: "auftraege/XB933-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-CLEAN-01" },
        { sicht: "gantt", enthaelt: "auftraege/XB933-BELA-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "Andere Aufträge desselben Flugs behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XC810-BELA-02/start", gleich: "09:15" },
        { pfad: "auftraege/XB933-BELA-02/ende", gleich: "10:20" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 7, weil sich bei I. Reindl XC 810 und XB 933 Innenraum-Cleaning überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
