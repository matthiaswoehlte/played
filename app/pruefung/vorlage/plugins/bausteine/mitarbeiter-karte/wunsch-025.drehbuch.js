/* Drehbuch: Der Disponent öffnet die Mitarbeiterdaten.
   07:58 V. Engström öffnen, 08:03 wieder schließen.
   08:08 R. Aldinger meldet sich krank: XC 810 Entladen und Beladen werden gelöst, für Beladen ist
   niemand frei, Konflikte 6 → 7.
   08:11 R. Aldinger öffnen: Status krank ab 08:08, Eintritt 01.04.2012. */
Huelle.drehbuch({
  kennung: "wunsch-025",
  titel: "Mitarbeiterdaten im Overlay ansehen",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "07:58", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: "MA-05" },
      erzaehlung: "Disponent öffnet die Mitarbeiterdaten von V. Engström"
    },
    {
      zeit: "08:03", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: null },
      erzaehlung: "Disponent schließt die Mitarbeiterdaten von V. Engström"
    },
    {
      zeit: "08:08", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:08" },
      erzaehlung: "Krankmeldung MA-01 ab 08:08"
    },
    {
      zeit: "08:11", objekt: "kennzahlen/mitarbeiterkarte", aktion: "anzeigen",
      parameter: { mitarbeiter: "MA-01" },
      erzaehlung: "Disponent öffnet die Mitarbeiterdaten von R. Aldinger"
    }
  ],
  erwartet: [
    {
      text: "Das Overlay mit den Mitarbeiterdaten von R. Aldinger ist geöffnet.",
      pruefe: [
        { nachricht: "kennzahlen/mitarbeiterkarte.anzeigen" },
        { pfad: "kennzahlen/mitarbeiterkarte/mitarbeiter", gleich: "MA-01" },
        { sicht: "gantt", enthaelt: "kennzahlen/mitarbeiterkarte" }
      ]
    },
    {
      text: "R. Aldinger ist seit dem 01.04.2012 in der Firma und ab 08:08 krank.",
      pruefe: [
        { pfad: "mitarbeiter/MA-01/eintritt", gleich: "01.04.2012" },
        { pfad: "mitarbeiter/MA-01/abwesend", gleich: true },
        { pfad: "mitarbeiter/MA-01/grund", gleich: "krank" },
        { pfad: "mitarbeiter/MA-01/abwesendAb", gleich: "08:08" }
      ]
    },
    {
      text: "V. Engström bleibt anwesend, und das Ansehen ändert nichts an seinen Aufträgen.",
      pruefe: [
        { pfad: "mitarbeiter/MA-05/abwesend", gleich: false },
        { pfad: "auftraege/XB622-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { pfad: "auftraege/XB622-ENTL-01/start", gleich: "07:45" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "Der Konfliktzähler steht auf 7: die sechs Überlappungen und die Kapazitätslücke bei XC 810 Beladen.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
