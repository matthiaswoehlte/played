/* Drehbuch: MA-01 meldet sich um 08:00 krank, der Disponent teilt aus der Liste neu ein.
   Gelöst werden XC810-ENTL-01 (08:55–09:15) und XC810-BELA-01 (09:15–09:35), für Beladen ist
   niemand frei: Konflikte 6 → 7.
   XC 810 Entladen auf V. Engström: frei von 08:35 bis 09:30, Konflikte bleiben 7.
   XC 810 Beladen auf D. Mahler: verweigert, er darf nur betanken.
   XC 810 Beladen auf W. Fiedler: Die Kapazitätslücke entfällt, dafür überschneidet es sich ab
   09:30 mit XB 933 Entladen, Konflikte bleiben 7. */
Huelle.drehbuch({
  kennung: "wunsch-009",
  titel: "Krankmeldung MA-01: Aufträge aus der Liste neu einteilen",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "08:00", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:00" },
      erzaehlung: "Krankmeldung MA-01 ab 08:00"
    },
    {
      zeit: "08:04", objekt: "auftraege/XC810-ENTL-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-05" },
      erzaehlung: "Disponent zieht XC 810 Entladen auf V. Engström"
    },
    {
      zeit: "08:08", objekt: "auftraege/XC810-BELA-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Disponent zieht XC 810 Beladen auf D. Mahler"
    },
    {
      zeit: "08:12", objekt: "auftraege/XC810-BELA-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-06" },
      erzaehlung: "Disponent zieht XC 810 Beladen auf W. Fiedler"
    }
  ],
  erwartet: [
    {
      text: "R. Aldinger ist ab 08:00 krank gemeldet.",
      pruefe: [
        { nachricht: "mitarbeiter/MA-01.krankmeldung" },
        { pfad: "mitarbeiter/MA-01/abwesend", gleich: true },
        { pfad: "mitarbeiter/MA-01/abwesendAb", gleich: "08:00" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "XC 810 Entladen ist durch die Krankmeldung vom Mitarbeiter gelöst worden.",
      pruefe: [{ nachricht: "auftraege/XC810-ENTL-01.loesen" }]
    },
    {
      text: "XC 810 Beladen ist durch die Krankmeldung vom Mitarbeiter gelöst worden.",
      pruefe: [{ nachricht: "auftraege/XC810-BELA-01.loesen" }]
    },
    {
      text: "XC 810 Entladen liegt jetzt bei V. Engström im Tagesplan.",
      pruefe: [
        { nachricht: "auftraege/XC810-ENTL-01.umplanen" },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-ENTL-01" }
      ]
    },
    {
      text: "D. Mahler bekommt XC 810 Beladen nicht, weil er nicht beladen darf.",
      pruefe: [{ nachricht: "auftraege/XC810-BELA-01.verweigert" }]
    },
    {
      text: "XC 810 Beladen liegt jetzt bei W. Fiedler im Tagesplan.",
      pruefe: [
        { nachricht: "auftraege/XC810-BELA-01.umplanen" },
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: "MA-06" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-BELA-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-BELA-01" }
      ]
    },
    {
      text: "Die neu eingeteilten Aufträge behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "08:55" },
        { pfad: "auftraege/XC810-ENTL-01/ende", gleich: "09:15" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-BELA-01/ende", gleich: "09:35" }
      ]
    },
    {
      text: "Was vor 08:00 fertig ist, bleibt bei R. Aldinger.",
      pruefe: [
        { pfad: "auftraege/XA101-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC508-BELA-01/mitarbeiter", gleich: "MA-01" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 7, weil sich bei W. Fiedler XC 810 Beladen und XB 933 Entladen überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
