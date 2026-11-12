/* Drehbuch: Der Disponent zieht vier Balken auf andere Mitarbeiter.
   Erlaubt: XA 745 Betanken von F. Ohlsen zu E. Novak (beide Betanken). Damit entfällt bei
   MA-22 die Überschneidung mit XA 745 Fäkalien entleeren: Konflikte 6 → 5.
   Erlaubt: XA 745 Innenraum-Cleaning von I. Reindl zu J. Sattler (beide Cleaning), J. Sattler
   ist ab 08:30 frei, die Konflikte bleiben bei 5.
   Verweigert: XC 810 Betanken auf I. Reindl und XC 810 Innenraum-Cleaning auf D. Mahler. */
Huelle.drehbuch({
  kennung: "wunsch-005",
  titel: "Einsatzbalken auf andere Mitarbeiter ziehen",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:13", objekt: "auftraege/XA745-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-21" },
      erzaehlung: "Disponent zieht XA 745 Betanken auf E. Novak"
    },
    {
      zeit: "08:17", objekt: "auftraege/XA745-CLEAN-03", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-41" },
      erzaehlung: "Disponent zieht XA 745 Innenraum-Cleaning auf J. Sattler"
    },
    {
      zeit: "08:21", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Disponent zieht XC 810 Betanken auf I. Reindl"
    },
    {
      zeit: "08:25", objekt: "auftraege/XC810-CLEAN-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Disponent zieht XC 810 Innenraum-Cleaning auf D. Mahler"
    }
  ],
  erwartet: [
    {
      text: "XA 745 Betanken liegt jetzt bei E. Novak statt bei F. Ohlsen.",
      pruefe: [
        { nachricht: "auftraege/XA745-TANK-01.umplanen" },
        { pfad: "auftraege/XA745-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-TANK-01" }
      ]
    },
    {
      text: "XA 745 Innenraum-Cleaning liegt jetzt bei J. Sattler statt bei I. Reindl.",
      pruefe: [
        { nachricht: "auftraege/XA745-CLEAN-03.umplanen" },
        { pfad: "auftraege/XA745-CLEAN-03/mitarbeiter", gleich: "MA-41" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-CLEAN-03" }
      ]
    },
    {
      text: "XC 810 Betanken bleibt bei D. Mahler, weil I. Reindl nicht betanken darf.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.verweigert" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-20" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "XC 810 Innenraum-Cleaning bleibt bei I. Reindl, weil D. Mahler kein Cleaning machen darf.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.verweigert" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "Die Zeiten der gezogenen Aufträge bleiben unverändert.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XA745-CLEAN-03/start", gleich: "08:35" },
        { pfad: "auftraege/XA745-CLEAN-03/ende", gleich: "09:05" }
      ]
    },
    {
      text: "Kein Auftrag landet unter „Nicht zugewiesene Aufträge“.",
      pruefe: [
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XA745-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XA745-CLEAN-03" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 5, weil sich bei F. Ohlsen XA 745 Betanken und Fäkalien entleeren nicht mehr überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
