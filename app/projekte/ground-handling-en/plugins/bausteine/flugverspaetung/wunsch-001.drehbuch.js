/* Drehbuch: XC 810 verspätet sich um 20 Minuten, gemeldet um 08:30.
   Alle elf Aufträge rücken um 20 Minuten. XC 810 Innenraum-Cleaning läuft dann bis 10:00
   und überschneidet sich bei MA-40 mit XB 933 Innenraum-Cleaning ab 09:45: Konflikte 6 → 7. */
Huelle.drehbuch({
  kennung: "wunsch-001",
  titel: "XC 810 delayed by 20 minutes",
  von: "08:20",
  bis: "08:40",
  ereignisse: [
    {
      zeit: "08:30", objekt: "fluege/XC810", aktion: "verspaetung",
      parameter: { minuten: 20 },
      erzaehlung: "XC 810 is delayed by 20 minutes"
    }
  ],
  erwartet: [
    {
      text: "XC 810 is on block at 09:10 instead of 08:50 and off block at 10:00 instead of 09:40.",
      pruefe: [
        { nachricht: "fluege/XC810.verspaetung" },
        { pfad: "fluege/XC810/onBlock", gleich: "09:10" },
        { pfad: "fluege/XC810/offBlock", gleich: "10:00" }
      ]
    },
    {
      text: "All four unloading tasks of XC 810 now run from 09:15 to 09:35.",
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
      text: "All four loading tasks of XC 810 now run from 09:35 to 09:55.",
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
      text: "Lavatory service, fuelling and cabin cleaning of XC 810 also move by 20 minutes.",
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
      text: "The tasks of XC 810 stay with their agents in the daily plan.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: "MA-40" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-CLEAN-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-ENTL-01" }
      ]
    },
    {
      text: "The tasks of other flights keep their times.",
      pruefe: [
        { pfad: "auftraege/XB933-CLEAN-03/start", gleich: "09:45" },
        { pfad: "auftraege/XB933-CLEAN-03/ende", gleich: "10:15" },
        { pfad: "auftraege/XA745-BELA-01/start", gleich: "09:00" },
        { pfad: "fluege/XB933/onBlock", gleich: "09:25" }
      ]
    },
    {
      text: "The conflict counter is at 7, because XC 810 and XB 933 Cabin cleaning overlap for I. Reindl.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
