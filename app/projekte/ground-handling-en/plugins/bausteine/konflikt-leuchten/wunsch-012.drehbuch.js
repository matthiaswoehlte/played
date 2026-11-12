/* Drehbuch: Der Disponent klappt die Konfliktliste auf und wählt zwei Einträge aus.
   08:03 Überlappung XA 745 Fäkalien entleeren und Betanken: Beide Balken und die Zeile von
   F. Ohlsen leuchten auf.
   08:07 MA-01 meldet sich krank: XC 810 Beladen ist ohne Mitarbeiter, für Beladen ist 09:15–09:35
   niemand frei, Konflikte 6 → 7.
   08:11 Kapazitätslücke XC 810 Beladen: Der Auftrag leuchtet unter „Nicht zugewiesene Aufträge“. */
Huelle.drehbuch({
  kennung: "wunsch-012",
  titel: "Highlight everyone in a conflict from the list",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "08:00", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Dispatcher opens the conflict list"
    },
    {
      zeit: "08:03", objekt: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01", aktion: "hervorheben",
      parameter: { objekte: ["auftraege/XA745-FAEK-01", "auftraege/XA745-TANK-01", "mitarbeiter/MA-22"] },
      erzaehlung: "Dispatcher selects conflict: overlap XA 745 lavatory service and XA 745 fuelling"
    },
    {
      zeit: "08:07", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:07" },
      erzaehlung: "Sick call AG-01 from 08:07"
    },
    {
      zeit: "08:11", objekt: "konflikte/kapazitaet-XC810-BELA-01", aktion: "hervorheben",
      parameter: { objekte: ["auftraege/XC810-BELA-01"] },
      erzaehlung: "Dispatcher selects conflict: capacity gap XC 810 loading"
    }
  ],
  erwartet: [
    {
      text: "The overlap for F. Ohlsen is selected; its two bars and his row are in the daily plan.",
      pruefe: [
        { nachricht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01.hervorheben" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-FAEK-01" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-TANK-01" },
        { sicht: "gantt", enthaelt: "mitarbeiter/MA-22" }
      ]
    },
    {
      text: "The capacity gap at XC 810 Loading is selected; the task is under “Unassigned tasks”.",
      pruefe: [
        { nachricht: "konflikte/kapazitaet-XC810-BELA-01.hervorheben" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/kapazitaet-XC810-BELA-01" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-BELA-01" },
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: null }
      ]
    },
    {
      text: "Highlighting does not change the plan: the selected tasks keep their time and agent.",
      pruefe: [
        { pfad: "auftraege/XA745-FAEK-01/start", gleich: "08:25" },
        { pfad: "auftraege/XA745-FAEK-01/ende", gleich: "08:45" },
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XA745-TANK-01/mitarbeiter", gleich: "MA-22" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-BELA-01/ende", gleich: "09:35" }
      ]
    },
    {
      text: "The conflict counter is at 7: the six overlaps and the capacity gap at XC 810 Loading.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
