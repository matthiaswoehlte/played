/* Drehbuch: XC 810 verspätet sich um 20 Minuten, während XC 810 Entladen bei R. Aldinger schon begonnen ist.
   08:44 Disponent setzt XC 810 Entladen (R. Aldinger) auf Begonnen.
   08:48 Verspätung 20 Minuten: On-Block 09:10, alle elf Aufträge rücken mit, auch der begonnene.
   Er läuft dann 09:15–09:35 und bleibt Begonnen. Bei I. Reindl überschneiden sich XC 810 und
   XB 933 Innenraum-Cleaning: Konflikte 6 → 7. */
Huelle.drehbuch({
  kennung: "wunsch-028",
  titel: "Verspätung XC 810 trifft einen begonnenen Auftrag",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "auftraege/XC810-ENTL-01", aktion: "status",
      parameter: { status: "begonnen" },
      erzaehlung: "Disponent setzt XC 810 Entladen auf Begonnen"
    },
    {
      zeit: "08:48", objekt: "fluege/XC810", aktion: "verspaetung",
      parameter: { minuten: 20 },
      erzaehlung: "XC 810 verspätet sich um 20 Minuten"
    }
  ],
  erwartet: [
    {
      text: "Der begonnene Auftrag XC 810 Entladen bei R. Aldinger rückt mit dem Flug auf 09:15–09:35.",
      pruefe: [
        { nachricht: "auftraege/XC810-ENTL-01.verschieben" },
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-01/ende", gleich: "09:35" },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" }
      ]
    },
    {
      text: "XC 810 Entladen bei R. Aldinger bleibt Begonnen.",
      pruefe: [{ pfad: "auftraege/XC810-ENTL-01/status", gleich: "begonnen" }]
    },
    {
      text: "Die offenen Aufträge von XC 810 rücken ebenfalls und bleiben Offen.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-02/start", gleich: "09:15" },
        { pfad: "auftraege/XC810-ENTL-02/status", gleich: "offen" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "10:00" }
      ]
    },
    {
      text: "XC 810 ist jetzt um 09:10 statt um 08:50 on block.",
      pruefe: [
        { nachricht: "fluege/XC810.verspaetung" },
        { pfad: "fluege/XC810/onBlock", gleich: "09:10" },
        { pfad: "fluege/XC810/offBlock", gleich: "10:00" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 7, weil sich bei I. Reindl XC 810 und XB 933 Innenraum-Cleaning überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    }
  ]
});
