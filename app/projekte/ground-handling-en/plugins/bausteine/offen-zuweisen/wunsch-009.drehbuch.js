/* Drehbuch: MA-01 meldet sich um 08:00 krank, der Disponent teilt aus der Liste neu ein.
   Gelöst werden XC810-ENTL-01 (08:55–09:15) und XC810-BELA-01 (09:15–09:35), für Beladen ist
   niemand frei: Konflikte 6 → 7.
   XC 810 Entladen auf V. Engström: frei von 08:35 bis 09:30, Konflikte bleiben 7.
   XC 810 Beladen auf D. Mahler: verweigert, er darf nur betanken.
   XC 810 Beladen auf W. Fiedler: Die Kapazitätslücke entfällt, dafür überschneidet es sich ab
   09:30 mit XB 933 Entladen, Konflikte bleiben 7. */
Huelle.drehbuch({
  kennung: "wunsch-009",
  titel: "Sick call AG-01: reassign tasks from the list",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "08:00", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:00" },
      erzaehlung: "Sick call AG-01 from 08:00"
    },
    {
      zeit: "08:04", objekt: "auftraege/XC810-ENTL-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-05" },
      erzaehlung: "Dispatcher drags XC 810 unloading to V. Engström"
    },
    {
      zeit: "08:08", objekt: "auftraege/XC810-BELA-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Dispatcher drags XC 810 loading to D. Mahler"
    },
    {
      zeit: "08:12", objekt: "auftraege/XC810-BELA-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-06" },
      erzaehlung: "Dispatcher drags XC 810 loading to W. Fiedler"
    }
  ],
  erwartet: [
    {
      text: "R. Aldinger is reported sick from 08:00.",
      pruefe: [
        { nachricht: "mitarbeiter/MA-01.krankmeldung" },
        { pfad: "mitarbeiter/MA-01/abwesend", gleich: true },
        { pfad: "mitarbeiter/MA-01/abwesendAb", gleich: "08:00" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "XC 810 Unloading was unassigned from the agent by the sick call.",
      pruefe: [{ nachricht: "auftraege/XC810-ENTL-01.loesen" }]
    },
    {
      text: "XC 810 Loading was unassigned from the agent by the sick call.",
      pruefe: [{ nachricht: "auftraege/XC810-BELA-01.loesen" }]
    },
    {
      text: "XC 810 Unloading is now with V. Engström in the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XC810-ENTL-01.umplanen" },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-ENTL-01" }
      ]
    },
    {
      text: "D. Mahler does not get XC 810 Loading, because he is not qualified for loading.",
      pruefe: [{ nachricht: "auftraege/XC810-BELA-01.verweigert" }]
    },
    {
      text: "XC 810 Loading is now with W. Fiedler in the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XC810-BELA-01.umplanen" },
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: "MA-06" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-BELA-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-BELA-01" }
      ]
    },
    {
      text: "The reassigned tasks keep their times.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "08:55" },
        { pfad: "auftraege/XC810-ENTL-01/ende", gleich: "09:15" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-BELA-01/ende", gleich: "09:35" }
      ]
    },
    {
      text: "Whatever is done before 08:00 stays with R. Aldinger.",
      pruefe: [
        { pfad: "auftraege/XA101-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC508-BELA-01/mitarbeiter", gleich: "MA-01" }
      ]
    },
    {
      text: "The conflict counter is at 7, because XC 810 Loading and XB 933 Unloading overlap for W. Fiedler.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
