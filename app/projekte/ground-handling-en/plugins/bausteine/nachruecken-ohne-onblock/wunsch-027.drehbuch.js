/* Drehbuch: XB 933 (On-Block geplant 09:25) kommt erst um 09:45 an Block.
   09:22 Disponent setzt XB 933 Fäkalien entleeren auf Begonnen: Dieser Auftrag bleibt stehen.
   Alle anderen Aufträge von XB 933 sind offen und rücken von 09:25 bis 09:45 um 20 Minuten.
   Dadurch entsteht keine neue Überschneidung, die Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-027",
  titel: "XB 933 arrives on block 20 minutes later",
  von: "09:20",
  bis: "09:50",
  ereignisse: [
    {
      zeit: "09:22", objekt: "auftraege/XB933-FAEK-01", aktion: "status",
      parameter: { status: "begonnen" },
      erzaehlung: "Dispatcher sets XB 933 lavatory service to Started"
    }
  ],
  erwartet: [
    {
      text: "XB 933 is not on block yet at 09:25 and arrives on block at 09:45.",
      pruefe: [
        { nachricht: "fluege/XB933.ohneOnblock" },
        { nachricht: "fluege/XB933.onblock" },
        { pfad: "fluege/XB933/status", gleich: "amBlock" }
      ]
    },
    {
      text: "Unloading and loading of XB 933 are 20 minutes later: unloading 09:50–10:10, loading 10:20–10:40.",
      pruefe: [
        { nachricht: "auftraege/XB933-ENTL-01.verschieben" },
        { pfad: "auftraege/XB933-ENTL-01/start", gleich: "09:50" },
        { pfad: "auftraege/XB933-ENTL-01/ende", gleich: "10:10" },
        { pfad: "auftraege/XB933-ENTL-04/start", gleich: "09:50" },
        { pfad: "auftraege/XB933-BELA-01/start", gleich: "10:20" },
        { pfad: "auftraege/XB933-BELA-01/ende", gleich: "10:40" }
      ]
    },
    {
      text: "Fuelling and cabin cleaning of XB 933 also move by 20 minutes.",
      pruefe: [
        { pfad: "auftraege/XB933-TANK-01/start", gleich: "10:00" },
        { pfad: "auftraege/XB933-TANK-01/ende", gleich: "10:25" },
        { pfad: "auftraege/XB933-CLEAN-03/start", gleich: "10:05" },
        { pfad: "auftraege/XB933-CLEAN-03/ende", gleich: "10:35" }
      ]
    },
    {
      text: "The started task XB 933 Lavatory service stays at 09:35–09:55.",
      pruefe: [
        { pfad: "auftraege/XB933-FAEK-01/status", gleich: "begonnen" },
        { pfad: "auftraege/XB933-FAEK-01/start", gleich: "09:35" },
        { pfad: "auftraege/XB933-FAEK-01/ende", gleich: "09:55" }
      ]
    },
    {
      text: "The tasks stay with their agents, and other flights keep their times.",
      pruefe: [
        { pfad: "auftraege/XB933-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { sicht: "gantt", enthaelt: "auftraege/XB933-ENTL-01" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "The conflict counter stays at 6.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
