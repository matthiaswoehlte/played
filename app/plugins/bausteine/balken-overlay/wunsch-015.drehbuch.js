/* Drehbuch: Der Disponent zieht XC 810 Betanken auf I. Reindl, die nicht betanken darf.
   Dort überschneidet es sich (09:05–09:30) mit XC 810 Innenraum-Cleaning (09:10–09:40).
   Konflikte 6 → 8: „Qualifikation fehlt“ und eine Überlappung. Beide stehen im Overlay
   des Balkens XC 810 Betanken, das beim Überfahren mit der Maus erscheint. */
Huelle.drehbuch({
  kennung: "wunsch-015",
  titel: "Einsatz-Details mit Konflikten beim Überfahren",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Disponent zieht XC 810 Betanken auf I. Reindl"
    },
    {
      zeit: "08:20", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Disponent klappt die Konfliktliste auf"
    }
  ],
  erwartet: [
    {
      text: "XC 810 Betanken liegt jetzt bei I. Reindl im Tagesplan.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.umplanen" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "Das Overlay am Balken XC 810 Betanken nennt beide Konflikte: fehlende Qualifikation und die Überlappung mit XC 810 Innenraum-Cleaning.",
      pruefe: [
        { sicht: "gantt", enthaelt: "konflikte/qualifikation-XC810-TANK-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC810-CLEAN-01-XC810-TANK-01" }
      ]
    },
    {
      text: "Dieselben Konflikte stehen in der Konfliktliste.",
      pruefe: [
        { pfad: "kennzahlen/konflikte/offen", gleich: true },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/qualifikation-XC810-TANK-01" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC810-CLEAN-01-XC810-TANK-01" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 8: die sechs Überlappungen vom Tagesbeginn, dazu bei I. Reindl die fehlende Qualifikation und die Überlappung von XC 810 Betanken und Innenraum-Cleaning.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 8 }]
    }
  ]
});
