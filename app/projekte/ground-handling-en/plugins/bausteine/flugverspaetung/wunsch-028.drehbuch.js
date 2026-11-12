/* Drehbuch: XC 810 verspätet sich um 20 Minuten, während XC 810 Entladen bei R. Aldinger schon begonnen ist.
   08:44 Disponent setzt XC 810 Entladen (R. Aldinger) auf Begonnen.
   08:48 Verspätung 20 Minuten: On-Block 09:10, alle elf Aufträge rücken mit, auch der begonnene.
   Er läuft dann 09:15–09:35 und bleibt Begonnen. Bei I. Reindl überschneiden sich XC 810 und
   XB 933 Innenraum-Cleaning: Konflikte 6 → 7. */
Huelle.drehbuch({
  kennung: "wunsch-028",
  titel: "Delay of XC 810 hits a started task",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "auftraege/XC810-ENTL-01", aktion: "status",
      parameter: { status: "begonnen" },
      erzaehlung: "Dispatcher sets XC 810 unloading to Started"
    },
    {
      zeit: "08:48", objekt: "fluege/XC810", aktion: "verspaetung",
      parameter: { minuten: 20 },
      erzaehlung: "XC 810 is delayed by 20 minutes"
    }
  ],
  erwartet: [
    {
      text: "The started task XC 810 Unloading for R. Aldinger moves with the flight to 09:15–09:35.",
      pruefe: [
        { nachricht: "auftraege/XC810-ENTL-01.verschieben" },
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-01/ende", gleich: "09:35" },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" }
      ]
    },
    {
      text: "XC 810 Unloading with R. Aldinger stays Started.",
      pruefe: [{ pfad: "auftraege/XC810-ENTL-01/status", gleich: "begonnen" }]
    },
    {
      text: "The open tasks of XC 810 move too and stay Open.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-02/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-02/status", gleich: "offen" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "10:00" }
      ]
    },
    {
      text: "XC 810 is now on block at 09:10 instead of 08:50.",
      pruefe: [
        { nachricht: "fluege/XC810.verspaetung" },
        { pfad: "fluege/XC810/onBlock", gleich: "09:10" },
        { pfad: "fluege/XC810/offBlock", gleich: "10:00" }
      ]
    },
    {
      text: "The conflict counter is at 7, because XC 810 and XB 933 Cabin cleaning overlap for I. Reindl.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
