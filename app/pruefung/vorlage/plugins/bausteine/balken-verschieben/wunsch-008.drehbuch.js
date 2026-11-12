/* Drehbuch: Der Disponent verschiebt zwei Balken in ihrer eigenen Zeile.
   Nach links: XA 745 Fäkalien entleeren um 20 Minuten auf 08:05–08:25. Damit entfällt bei
   MA-22 die Überschneidung mit XA 745 Betanken ab 08:30: Konflikte 6 → 5.
   Nach rechts: XC 810 Betanken um 10 Minuten auf 09:15–09:40, bei MA-20 ohne Überschneidung. */
Huelle.drehbuch({
  kennung: "wunsch-008",
  titel: "Einsatzbalken nach links und rechts verschieben",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XA745-FAEK-01", aktion: "verschieben",
      parameter: { minuten: -20, grund: "disponent" },
      erzaehlung: "Disponent schiebt XA 745 Fäkalien entleeren auf 08:05–08:25"
    },
    {
      zeit: "08:22", objekt: "auftraege/XC810-TANK-01", aktion: "verschieben",
      parameter: { minuten: 10, grund: "disponent" },
      erzaehlung: "Disponent schiebt XC 810 Betanken auf 09:15–09:40"
    }
  ],
  erwartet: [
    {
      text: "XA 745 Fäkalien entleeren ist nach links verschoben und läuft von 08:05 bis 08:25.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.verschieben" },
        { pfad: "auftraege/XA745-FAEK-01/start", gleich: "08:05" },
        { pfad: "auftraege/XA745-FAEK-01/ende", gleich: "08:25" }
      ]
    },
    {
      text: "XC 810 Betanken ist nach rechts verschoben und läuft von 09:15 bis 09:40.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.verschieben" },
        { pfad: "auftraege/XC810-TANK-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-TANK-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "Beide Aufträge bleiben bei ihren Mitarbeitern im Tagesplan.",
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
      text: "Andere Aufträge derselben Flüge behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "Die Block-Zeiten der Flüge bleiben unverändert.",
      pruefe: [
        { pfad: "fluege/XA745/onBlock", gleich: "08:15" },
        { pfad: "fluege/XA745/offBlock", gleich: "09:25" },
        { pfad: "fluege/XC810/onBlock", gleich: "08:50" },
        { pfad: "fluege/XC810/offBlock", gleich: "09:40" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 5, weil sich bei F. Ohlsen XA 745 Fäkalien entleeren und Betanken nicht mehr überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
