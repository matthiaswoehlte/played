/* Drehbuch: Der Disponent zieht vier Balken auf andere Mitarbeiter.
   Erlaubt: XA 745 Betanken von F. Ohlsen zu E. Novak (beide Betanken). Damit entfällt bei
   MA-22 die Überschneidung mit XA 745 Fäkalien entleeren: Konflikte 6 → 5.
   Erlaubt: XA 745 Innenraum-Cleaning von I. Reindl zu J. Sattler (beide Cleaning), J. Sattler
   ist ab 08:30 frei, die Konflikte bleiben bei 5.
   Verweigert: XC 810 Betanken auf I. Reindl und XC 810 Innenraum-Cleaning auf D. Mahler. */
Huelle.drehbuch({
  kennung: "wunsch-005",
  titel: "Drag assignment bars to other agents",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:13", objekt: "auftraege/XA745-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-21" },
      erzaehlung: "Dispatcher drags XA 745 fuelling to E. Novak"
    },
    {
      zeit: "08:17", objekt: "auftraege/XA745-CLEAN-03", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-41" },
      erzaehlung: "Dispatcher drags XA 745 cabin cleaning to J. Sattler"
    },
    {
      zeit: "08:21", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Dispatcher drags XC 810 fuelling to I. Reindl"
    },
    {
      zeit: "08:25", objekt: "auftraege/XC810-CLEAN-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Dispatcher drags XC 810 cabin cleaning to D. Mahler"
    }
  ],
  erwartet: [
    {
      text: "XA 745 Fuelling is now with E. Novak instead of F. Ohlsen.",
      pruefe: [
        { nachricht: "auftraege/XA745-TANK-01.umplanen" },
        { pfad: "auftraege/XA745-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-TANK-01" }
      ]
    },
    {
      text: "XA 745 Cabin cleaning is now with J. Sattler instead of I. Reindl.",
      pruefe: [
        { nachricht: "auftraege/XA745-CLEAN-03.umplanen" },
        { pfad: "auftraege/XA745-CLEAN-03/mitarbeiter", gleich: "MA-41" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-CLEAN-03" }
      ]
    },
    {
      text: "XC 810 Fuelling stays with D. Mahler, because I. Reindl is not allowed to fuel.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.verweigert" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-20" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "XC 810 Cabin cleaning stays with I. Reindl, because D. Mahler is not allowed to do cleaning.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.verweigert" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "The times of the dragged tasks stay the same.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XA745-CLEAN-03/start", gleich: "08:35" },
        { pfad: "auftraege/XA745-CLEAN-03/ende", gleich: "09:05" }
      ]
    },
    {
      text: "No task ends up under “Unassigned tasks”.",
      pruefe: [
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XA745-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XA745-CLEAN-03" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "The conflict counter is at 5, because XA 745 Fuelling and Lavatory service no longer overlap for F. Ohlsen.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
