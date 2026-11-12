/* Drehbuch: Der Disponent legt Balken zurück in die Liste und teilt neu ein.
   08:14 XC 810 Betanken (D. Mahler, 09:05–09:30) zurück in die Liste. E. Novak ist frei, keine
   Kapazitätslücke: Konflikte bleiben 6.
   08:20 XC 810 Betanken aus der Liste auf E. Novak (frei zwischen 08:20 und 09:40): Konflikte bleiben 6.
   08:24 XC 810 Innenraum-Cleaning (I. Reindl, 09:10–09:40) zurück in die Liste. J. Sattler ist frei,
   keine Kapazitätslücke: Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-017",
  titel: "Drag bar back to the list and reassign",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XC810-TANK-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Dispatcher puts XC 810 fuelling back into “Unassigned tasks”"
    },
    {
      zeit: "08:20", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-21" },
      erzaehlung: "Dispatcher drags XC 810 fuelling to E. Novak"
    },
    {
      zeit: "08:24", objekt: "auftraege/XC810-CLEAN-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Dispatcher puts XC 810 cabin cleaning back into “Unassigned tasks”"
    }
  ],
  erwartet: [
    {
      text: "XC 810 Fuelling was put back from the daily plan into the list.",
      pruefe: [{ nachricht: "auftraege/XC810-TANK-01.zuruecklegen" }]
    },
    {
      text: "XC 810 Fuelling is then, from the list, with E. Novak in the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.umplanen" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "XC 810 Cabin cleaning is without an agent under “Unassigned tasks” and no longer in the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.zuruecklegen" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-CLEAN-01" },
        { sicht: "gantt", enthaeltNicht: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "The tasks keep their times.",
      pruefe: [
        { pfad: "auftraege/XC810-TANK-01/start", gleich: "09:05" },
        { pfad: "auftraege/XC810-TANK-01/ende", gleich: "09:30" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "The conflict counter is at 6, because J. Sattler is available for XC 810 Cabin cleaning.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
