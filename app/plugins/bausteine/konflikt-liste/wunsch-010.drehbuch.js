/* Drehbuch: Der Disponent klappt die Konfliktliste auf und ändert den Plan.
   Zu Beginn gibt es 6 Überlappungen: XA 337 und XA 745 bei MA-22, XC 508 bei MA-01 bis MA-04.
   08:15 XA 745 Fäkalien entleeren auf 08:05–08:25: Die Überlappung bei MA-22 entfällt, 6 → 5.
   08:19 XC 810 Innenraum-Cleaning bis 10:00: neue Überlappung mit XB 933 bei MA-40, 5 → 6.
   08:23 XB 933 Innenraum-Cleaning auf MA-41 (ab 08:30 frei): Diese Überlappung entfällt, 6 → 5.
   08:27 XC 810 Beladen ab 09:10: neue Überlappung mit XC 810 Entladen bei MA-01, 5 → 6. */
Huelle.drehbuch({
  kennung: "wunsch-010",
  titel: "Überlappungen im Tagesplan und in der Konfliktliste",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:12", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Disponent klappt die Konfliktliste auf"
    },
    {
      zeit: "08:15", objekt: "auftraege/XA745-FAEK-01", aktion: "verschieben",
      parameter: { minuten: -20, grund: "disponent" },
      erzaehlung: "Disponent schiebt XA 745 Fäkalien entleeren auf 08:05–08:25"
    },
    {
      zeit: "08:19", objekt: "auftraege/XC810-CLEAN-01", aktion: "zeitaendern",
      parameter: { kante: "ende", zeit: "10:00" },
      erzaehlung: "XC 810 Innenraum-Cleaning endet jetzt um 10:00"
    },
    {
      zeit: "08:23", objekt: "auftraege/XB933-CLEAN-03", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-41" },
      erzaehlung: "Disponent zieht XB 933 Innenraum-Cleaning auf J. Sattler"
    },
    {
      zeit: "08:27", objekt: "auftraege/XC810-BELA-01", aktion: "zeitaendern",
      parameter: { kante: "start", zeit: "09:10" },
      erzaehlung: "XC 810 Beladen beginnt jetzt um 09:10"
    }
  ],
  erwartet: [
    {
      text: "Die Konfliktliste ist aufgeklappt und zeigt die Überlappungen, die bestehen bleiben.",
      pruefe: [
        { nachricht: "kennzahlen/konflikte.anzeigen" },
        { pfad: "kennzahlen/konflikte/offen", gleich: true },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC508-BELA-01-XC508-ENTL-01" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XA337-FAEK-01-XA337-TANK-01" }
      ]
    },
    {
      text: "Die Balken dieser Überlappungen tragen im Tagesplan weiter den roten Rand.",
      pruefe: [
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC508-BELA-01-XC508-ENTL-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XA337-FAEK-01-XA337-TANK-01" }
      ]
    },
    {
      text: "Bei F. Ohlsen überschneiden sich XA 745 Fäkalien entleeren und Betanken nicht mehr: Der Konflikt ist aus Liste und Tagesplan verschwunden.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.verschieben" },
        { pfad: "auftraege/XA745-FAEK-01/start", gleich: "08:05" },
        { pfad: "auftraege/XA745-FAEK-01/ende", gleich: "08:25" },
        { sicht: "konfliktzaehler", enthaeltNicht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" },
        { sicht: "gantt", enthaeltNicht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" }
      ]
    },
    {
      text: "Die Überschneidung von XC 810 und XB 933 Innenraum-Cleaning bei I. Reindl ist durch die Umplanung auf J. Sattler wieder verschwunden.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.zeitaendern" },
        { nachricht: "auftraege/XB933-CLEAN-03.umplanen" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "10:00" },
        { pfad: "auftraege/XB933-CLEAN-03/mitarbeiter", gleich: "MA-41" },
        { sicht: "konfliktzaehler", enthaeltNicht: "konflikte/ueberlappung-XB933-CLEAN-03-XC810-CLEAN-01" },
        { sicht: "gantt", enthaeltNicht: "konflikte/ueberlappung-XB933-CLEAN-03-XC810-CLEAN-01" }
      ]
    },
    {
      text: "Bei R. Aldinger überschneiden sich jetzt XC 810 Entladen und Beladen: Der neue Konflikt steht in der Liste, beide Balken haben den roten Rand.",
      pruefe: [
        { nachricht: "auftraege/XC810-BELA-01.zeitaendern" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:10" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC810-BELA-01-XC810-ENTL-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC810-BELA-01-XC810-ENTL-01" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 6: viermal XC 508, einmal XA 337 und einmal XC 810.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
