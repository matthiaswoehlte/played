/* Drehbuch: Der Disponent klappt die Konfliktliste auf und wählt zwei Einträge aus.
   08:03 Überlappung XA 745 Fäkalien entleeren und Betanken: Beide Balken und die Zeile von
   F. Ohlsen leuchten auf.
   08:07 MA-01 meldet sich krank: XC 810 Beladen ist ohne Mitarbeiter, für Beladen ist 09:15–09:35
   niemand frei, Konflikte 6 → 7.
   08:11 Kapazitätslücke XC 810 Beladen: Der Auftrag leuchtet unter „Nicht zugewiesene Aufträge“. */
Huelle.drehbuch({
  kennung: "wunsch-012",
  titel: "Beteiligte eines Konflikts aus der Liste hervorheben",
  von: "07:55",
  bis: "08:15",
  ereignisse: [
    {
      zeit: "08:00", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Disponent klappt die Konfliktliste auf"
    },
    {
      zeit: "08:03", objekt: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01", aktion: "hervorheben",
      parameter: { objekte: ["auftraege/XA745-FAEK-01", "auftraege/XA745-TANK-01", "mitarbeiter/MA-22"] },
      erzaehlung: "Disponent wählt Konflikt: Überlappung XA 745 Fäkalien entleeren und XA 745 Betanken"
    },
    {
      zeit: "08:07", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:07" },
      erzaehlung: "Krankmeldung MA-01 ab 08:07"
    },
    {
      zeit: "08:11", objekt: "konflikte/kapazitaet-XC810-BELA-01", aktion: "hervorheben",
      parameter: { objekte: ["auftraege/XC810-BELA-01"] },
      erzaehlung: "Disponent wählt Konflikt: Kapazitätslücke XC 810 Beladen"
    }
  ],
  erwartet: [
    {
      text: "Die Überlappung bei F. Ohlsen ist gewählt, ihre beiden Balken und seine Zeile stehen im Tagesplan.",
      pruefe: [
        { nachricht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01.hervorheben" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-FAEK-01" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-TANK-01" },
        { sicht: "gantt", enthaelt: "mitarbeiter/MA-22" }
      ]
    },
    {
      text: "Die Kapazitätslücke bei XC 810 Beladen ist gewählt, der Auftrag steht unter „Nicht zugewiesene Aufträge“.",
      pruefe: [
        { nachricht: "konflikte/kapazitaet-XC810-BELA-01.hervorheben" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/kapazitaet-XC810-BELA-01" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-BELA-01" },
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: null }
      ]
    },
    {
      text: "Das Hervorheben ändert nichts am Plan: Die gewählten Aufträge behalten Zeit und Mitarbeiter.",
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
      text: "Der Konfliktzähler steht auf 7: die sechs Überlappungen und die Kapazitätslücke bei XC 810 Beladen.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
