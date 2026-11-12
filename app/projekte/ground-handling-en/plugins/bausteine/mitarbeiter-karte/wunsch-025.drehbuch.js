/* Drehbuch: Der Disponent öffnet die Mitarbeiterdaten.
   07:58 V. Engström öffnen, 08:03 wieder schließen.
   08:08 R. Aldinger meldet sich krank: XC 810 Entladen und Beladen werden gelöst, für Beladen ist
   niemand frei, Konflikte 6 → 7.
   08:11 R. Aldinger öffnen: Status krank ab 08:08, Eintritt 01.04.2012. */
Huelle.drehbuch({
  kennung: "wunsch-025",
  titel: "View agent details in the overlay",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "07:58", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: "MA-05" },
      erzaehlung: "Dispatcher opens the agent details of V. Engström"
    },
    {
      zeit: "08:03", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: null },
      erzaehlung: "Dispatcher closes the agent details of V. Engström"
    },
    {
      zeit: "08:08", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:08" },
      erzaehlung: "Sick call AG-01 from 08:08"
    },
    {
      zeit: "08:11", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: "MA-01" },
      erzaehlung: "Dispatcher opens the agent details of R. Aldinger"
    }
  ],
  erwartet: [
    {
      text: "The overlay with the agent details of R. Aldinger is open.",
      pruefe: [
        { nachricht: "kennzahlen/mitarbeiterkarte.anzeigen" },
        { pfad: "kennzahlen/mitarbeiterkarte/mitarbeiter", gleich: "MA-01" },
        { sicht: "gantt", enthaelt: "kennzahlen/mitarbeiterkarte" }
      ]
    },
    {
      text: "R. Aldinger has been with the company since 01.04.2012 and is sick from 08:08.",
      pruefe: [
        { pfad: "mitarbeiter/MA-01/eintritt", gleich: "01.04.2012" },
        { pfad: "mitarbeiter/MA-01/abwesend", gleich: true },
        { pfad: "mitarbeiter/MA-01/grund", gleich: "krank" },
        { pfad: "mitarbeiter/MA-01/abwesendAb", gleich: "08:08" }
      ]
    },
    {
      text: "V. Engström stays present, and viewing changes nothing in his tasks.",
      pruefe: [
        { pfad: "mitarbeiter/MA-05/abwesend", gleich: false },
        { pfad: "auftraege/XB622-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { pfad: "auftraege/XB622-ENTL-01/start", gleich: "07:45" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "The conflict counter is at 7: the six overlaps and the capacity gap at XC 810 Loading.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
