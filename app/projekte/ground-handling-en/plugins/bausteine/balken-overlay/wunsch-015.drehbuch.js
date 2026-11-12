/* Drehbuch: Der Disponent zieht XC 810 Betanken auf I. Reindl, die nicht betanken darf.
   Dort überschneidet es sich (09:05–09:30) mit XC 810 Innenraum-Cleaning (09:10–09:40).
   Konflikte 6 → 8: „Qualifikation fehlt“ und eine Überlappung. Beide stehen im Overlay
   des Balkens XC 810 Betanken, das beim Überfahren mit der Maus erscheint. */
Huelle.drehbuch({
  kennung: "wunsch-015",
  titel: "Assignment details with conflicts on hover",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Dispatcher drags XC 810 fuelling to I. Reindl"
    },
    {
      zeit: "08:20", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Dispatcher opens the conflict list"
    }
  ],
  erwartet: [
    {
      text: "XC 810 Fuelling is now with I. Reindl in the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.umplanen" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "The overlay on the bar XC 810 Fuelling names both conflicts: missing qualification and the overlap with XC 810 Cabin cleaning.",
      pruefe: [
        { sicht: "gantt", enthaelt: "konflikte/qualifikation-XC810-TANK-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC810-CLEAN-01-XC810-TANK-01" }
      ]
    },
    {
      text: "The same conflicts are in the conflict list.",
      pruefe: [
        { pfad: "kennzahlen/konflikte/offen", gleich: true },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/qualifikation-XC810-TANK-01" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC810-CLEAN-01-XC810-TANK-01" }
      ]
    },
    {
      text: "The conflict counter is at 8: the six overlaps from the start of the day, plus for I. Reindl the missing qualification and the overlap of XC 810 Fuelling and Cabin cleaning.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 8 }]
    }
  ]
});
