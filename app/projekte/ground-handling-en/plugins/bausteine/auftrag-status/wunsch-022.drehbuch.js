/* Drehbuch: Status der Aufträge. Der Tag beginnt um 08:40:
   XA 745 Entladen (08:20–08:40) ist vorbei: Fertig. XA 745 Fäkalien entleeren (08:25–08:45) und
   XA 745 Betanken (08:30–08:55) laufen: Begonnen. XC 810 Entladen (08:55–09:15) und XC 810 Betanken
   (09:05–09:30) haben noch nicht begonnen: Offen.
   08:44 Status-Menü an XA 745 Fäkalien entleeren, 08:46 auf Fertig.
   08:56 Status-Menü an XC 810 Entladen, 08:57 auf Begonnen. Die Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-022",
  titel: "Set a task's status on the bar",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "kennzahlen/statusmenue", aktion: "anzeigen",
      parameter: { auftrag: "XA745-FAEK-01" },
      erzaehlung: "Dispatcher opens the status of XA 745 lavatory service"
    },
    {
      zeit: "08:46", objekt: "auftraege/XA745-FAEK-01", aktion: "status",
      parameter: { status: "fertig" },
      erzaehlung: "Dispatcher sets XA 745 lavatory service to Done"
    },
    {
      zeit: "08:56", objekt: "kennzahlen/statusmenue", aktion: "anzeigen",
      parameter: { auftrag: "XC810-ENTL-01" },
      erzaehlung: "Dispatcher opens the status of XC 810 unloading"
    },
    {
      zeit: "08:57", objekt: "auftraege/XC810-ENTL-01", aktion: "status",
      parameter: { status: "begonnen" },
      erzaehlung: "Dispatcher sets XC 810 unloading to Started"
    }
  ],
  erwartet: [
    {
      text: "At the start of the day at 08:40, XA 745 Unloading is Done, XA 745 Fuelling is Started and XC 810 Fuelling is Open.",
      pruefe: [
        { pfad: "auftraege/XA745-ENTL-01/status", gleich: "fertig" },
        { pfad: "auftraege/XA745-TANK-01/status", gleich: "begonnen" },
        { pfad: "auftraege/XC810-TANK-01/status", gleich: "offen" }
      ]
    },
    {
      text: "XA 745 Lavatory service is set to Done via the status menu.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.status" },
        { pfad: "auftraege/XA745-FAEK-01/status", gleich: "fertig" }
      ]
    },
    {
      text: "XC 810 Unloading is set to Started via the status menu.",
      pruefe: [
        { nachricht: "kennzahlen/statusmenue.anzeigen" },
        { nachricht: "auftraege/XC810-ENTL-01.status" },
        { pfad: "auftraege/XC810-ENTL-01/status", gleich: "begonnen" }
      ]
    },
    {
      text: "After the choice the status menu closes again; the tasks stay with their agents and times.",
      pruefe: [
        { pfad: "kennzahlen/statusmenue/auftrag", gleich: null },
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC810-ENTL-01/start", gleich: "08:55" },
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { sicht: "gantt", enthaelt: "auftraege/XA745-FAEK-01" }
      ]
    },
    {
      text: "The conflict counter stays at 6.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
