/* Drehbuch: Der Disponent verschiebt zwei Balken in ihrer eigenen Zeile.
   Nach links: XA 745 Fäkalien entleeren um 20 Minuten auf 08:05–08:25. Damit entfällt bei
   MA-22 die Überschneidung mit XA 745 Betanken ab 08:30: Konflikte 6 → 5.
   Nach rechts: XC 810 Betanken um 10 Minuten auf 09:15–09:40, bei MA-20 ohne Überschneidung. */
Huelle.drehbuch({
  kennung: "wunsch-008",
  titel: "Move assignment bars left and right",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XA745-FAEK-01", aktion: "verschieben",
      parameter: { minuten: -20, grund: "disponent" },
      erzaehlung: "Dispatcher moves XA 745 lavatory service to 08:05–08:25"
    },
    {
      zeit: "08:22", objekt: "auftraege/XC810-TANK-01", aktion: "verschieben",
      parameter: { minuten: 10, grund: "disponent" },
      erzaehlung: "Dispatcher moves XC 810 fuelling to 09:15–09:40"
    }
  ],
  erwartet: [
    {
      text: "XA 745 Lavatory service is moved left and runs from 08:05 to 08:25.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.verschieben" },
        { pfad: "auftraege/XA745-FAEK-01/start", gleich: "08:05" },
        { pfad: "auftraege/XA745-FAEK-01/ende", gleich: "08:25" }
      ]
    },
    {
      text: "XC 810 Fuelling is moved right and runs from 09:15 to 09:40.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.verschieben" },
        { pfad: "auftraege/XC810-TANK-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-TANK-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "Both tasks stay with their agents in the daily plan.",
      pruefe: [
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-20" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-FAEK-01" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XA745-FAEK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "Other tasks of the same flights keep their times.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "The block times of the flights stay unchanged.",
      pruefe: [
        { pfad: "fluege/XA745/onBlock", gleich: "08:15" },
        { pfad: "fluege/XA745/offBlock", gleich: "09:25" },
        { pfad: "fluege/XC810/onBlock", gleich: "08:50" },
        { pfad: "fluege/XC810/offBlock", gleich: "09:40" }
      ]
    },
    {
      text: "The conflict counter is at 5, because XA 745 Lavatory service and Fuelling no longer overlap for F. Ohlsen.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
