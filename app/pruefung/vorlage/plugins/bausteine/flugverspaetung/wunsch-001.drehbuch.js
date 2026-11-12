/* Drehbuch: XC 810 verspätet sich um 20 Minuten, gemeldet um 08:30.
   Alle elf Aufträge rücken um 20 Minuten. XC 810 Innenraum-Cleaning läuft dann bis 10:00
   und überschneidet sich bei MA-40 mit XB 933 Innenraum-Cleaning ab 09:45: Konflikte 6 → 7. */
Huelle.drehbuch({
  kennung: "wunsch-001",
  titel: "Verspätung XC 810 um 20 Minuten",
  von: "08:20",
  bis: "08:40",
  ereignisse: [
    {
      zeit: "08:30", objekt: "fluege/XC810", aktion: "verspaetung",
      parameter: { minuten: 20 },
      erzaehlung: "XC 810 verspätet sich um 20 Minuten"
    }
  ],
  erwartet: [
    {
      text: "XC 810 ist um 09:10 statt um 08:50 on block und um 10:00 statt um 09:40 off block.",
      pruefe: [
        { nachricht: "fluege/XC810.verspaetung" },
        { pfad: "fluege/XC810/onBlock", gleich: "09:10" },
        { pfad: "fluege/XC810/offBlock", gleich: "10:00" }
      ]
    },
    {
      text: "Alle vier Entladen-Aufträge von XC 810 laufen jetzt von 09:15 bis 09:35.",
      pruefe: [
        { nachricht: "auftraege/XC810-ENTL-01.verschieben" },
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-01/ende", gleich: "09:35" },
        { pfad: "auftraege/XC810-ENTL-02/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-02/ende", gleich: "09:35" },
        { pfad: "auftraege/XC810-ENTL-03/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-03/ende", gleich: "09:35" },
        { pfad: "auftraege/XC810-ENTL-04/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-04/ende", gleich: "09:35" }
      ]
    },
    {
      text: "Alle vier Beladen-Aufträge von XC 810 laufen jetzt von 09:35 bis 09:55.",
      pruefe: [
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:35" },
        { pfad: "auftraege/XC810-BELA-01/ende", gleich: "09:55" },
        { pfad: "auftraege/XC810-BELA-02/start", gleich: "09:35" },
        { pfad: "auftraege/XC810-BELA-02/ende", gleich: "09:55" },
        { pfad: "auftraege/XC810-BELA-03/start", gleich: "09:35" },
        { pfad: "auftraege/XC810-BELA-03/ende", gleich: "09:55" },
        { pfad: "auftraege/XC810-BELA-04/start", gleich: "09:35" },
        { pfad: "auftraege/XC810-BELA-04/ende", gleich: "09:55" }
      ]
    },
    {
      text: "Fäkalien entleeren, Betanken und Innenraum-Cleaning von XC 810 rücken ebenfalls um 20 Minuten.",
      pruefe: [
        { pfad: "auftraege/XC810-FAEK-01/start", gleich: "09:20" },
        { pfad: "auftraege/XC810-FAEK-01/ende", gleich: "09:40" },
        { pfad: "auftraege/XC810-TANK-01/start", gleich: "09:25" },
        { pfad: "auftraege/XC810-TANK-01/ende", gleich: "09:50" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:30" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "10:00" }
      ]
    },
    {
      text: "Die Aufträge von XC 810 bleiben bei ihren Mitarbeitern im Tagesplan.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-CLEAN-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-ENTL-01" }
      ]
    },
    {
      text: "Die Aufträge anderer Flüge behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XB933-CLEAN-03/start", gleich: "09:45" },
        { pfad: "auftraege/XB933-CLEAN-03/ende", gleich: "10:15" },
        { pfad: "auftraege/XA745-BELA-01/start", gleich: "09:00" },
        { pfad: "fluege/XB933/onBlock", gleich: "09:25" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 7, weil sich bei I. Reindl XC 810 und XB 933 Innenraum-Cleaning überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
