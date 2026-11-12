/* Drehbuch: Status der Aufträge. Der Tag beginnt um 08:40:
   XA 745 Entladen (08:20–08:40) ist vorbei: Fertig. XA 745 Fäkalien entleeren (08:25–08:45) und
   XA 745 Betanken (08:30–08:55) laufen: Begonnen. XC 810 Entladen (08:55–09:15) und XC 810 Betanken
   (09:05–09:30) haben noch nicht begonnen: Offen.
   08:44 Status-Menü an XA 745 Fäkalien entleeren, 08:46 auf Fertig.
   08:56 Status-Menü an XC 810 Entladen, 08:57 auf Begonnen. Die Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-022",
  titel: "Status eines Auftrags am Balken setzen",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "kennzahlen/statusmenue", aktion: "anzeigen",
      parameter: { auftrag: "XA745-FAEK-01" },
      erzaehlung: "Disponent öffnet den Status von XA 745 Fäkalien entleeren"
    },
    {
      zeit: "08:46", objekt: "auftraege/XA745-FAEK-01", aktion: "status",
      parameter: { status: "fertig" },
      erzaehlung: "Disponent setzt XA 745 Fäkalien entleeren auf Fertig"
    },
    {
      zeit: "08:56", objekt: "kennzahlen/statusmenue", aktion: "anzeigen",
      parameter: { auftrag: "XC810-ENTL-01" },
      erzaehlung: "Disponent öffnet den Status von XC 810 Entladen"
    },
    {
      zeit: "08:57", objekt: "auftraege/XC810-ENTL-01", aktion: "status",
      parameter: { status: "begonnen" },
      erzaehlung: "Disponent setzt XC 810 Entladen auf Begonnen"
    }
  ],
  erwartet: [
    {
      text: "Zu Tagesbeginn um 08:40 ist XA 745 Entladen Fertig, XA 745 Betanken Begonnen und XC 810 Betanken Offen.",
      pruefe: [
        { pfad: "auftraege/XA745-ENTL-01/status", gleich: "fertig" },
        { pfad: "auftraege/XA745-TANK-01/status", gleich: "begonnen" },
        { pfad: "auftraege/XC810-TANK-01/status", gleich: "offen" }
      ]
    },
    {
      text: "XA 745 Fäkalien entleeren ist über das Status-Menü auf Fertig gesetzt.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.status" },
        { pfad: "auftraege/XA745-FAEK-01/status", gleich: "fertig" }
      ]
    },
    {
      text: "XC 810 Entladen ist über das Status-Menü auf Begonnen gesetzt.",
      pruefe: [
        { nachricht: "kennzahlen/statusmenue.anzeigen" },
        { nachricht: "auftraege/XC810-ENTL-01.status" },
        { pfad: "auftraege/XC810-ENTL-01/status", gleich: "begonnen" }
      ]
    },
    {
      text: "Nach der Wahl ist das Status-Menü wieder zu, die Aufträge bleiben bei ihren Mitarbeitern und Zeiten.",
      pruefe: [
        { pfad: "kennzahlen/statusmenue/auftrag", gleich: null },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "08:55" },
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-FAEK-01" }
      ]
    },
    {
      text: "Der Konfliktzähler bleibt bei 6.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
