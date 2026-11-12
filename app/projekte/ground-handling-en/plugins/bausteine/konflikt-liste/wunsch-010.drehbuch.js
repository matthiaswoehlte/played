/* Drehbuch: Der Disponent klappt die Konfliktliste auf und ändert den Plan.
   Zu Beginn gibt es 6 Überlappungen: XA 337 und XA 745 bei MA-22, XC 508 bei MA-01 bis MA-04.
   08:15 XA 745 Fäkalien entleeren auf 08:05–08:25: Die Überlappung bei MA-22 entfällt, 6 → 5.
   08:19 XC 810 Innenraum-Cleaning bis 10:00: neue Überlappung mit XB 933 bei MA-40, 5 → 6.
   08:23 XB 933 Innenraum-Cleaning auf MA-41 (ab 08:30 frei): Diese Überlappung entfällt, 6 → 5.
   08:27 XC 810 Beladen ab 09:10: neue Überlappung mit XC 810 Entladen bei MA-01, 5 → 6. */
Huelle.drehbuch({
  kennung: "wunsch-010",
  titel: "Overlaps in the daily plan and in the conflict list",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:12", objekt: "kennzahlen/konflikte", aktion: "anzeigen",
      parameter: { offen: true },
      erzaehlung: "Dispatcher opens the conflict list"
    },
    {
      zeit: "08:15", objekt: "auftraege/XA745-FAEK-01", aktion: "verschieben",
      parameter: { minuten: -20, grund: "disponent" },
      erzaehlung: "Dispatcher moves XA 745 lavatory service to 08:05–08:25"
    },
    {
      zeit: "08:19", objekt: "auftraege/XC810-CLEAN-01", aktion: "zeitaendern",
      parameter: { kante: "ende", zeit: "10:00" },
      erzaehlung: "XC 810 Cabin cleaning now ends at 10:00"
    },
    {
      zeit: "08:23", objekt: "auftraege/XB933-CLEAN-03", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-41" },
      erzaehlung: "Dispatcher drags XB 933 cabin cleaning to J. Sattler"
    },
    {
      zeit: "08:27", objekt: "auftraege/XC810-BELA-01", aktion: "zeitaendern",
      parameter: { kante: "start", zeit: "09:10" },
      erzaehlung: "XC 810 Loading now starts at 09:10"
    }
  ],
  erwartet: [
    {
      text: "The conflict list is expanded and shows the overlaps that remain.",
      pruefe: [
        { nachricht: "kennzahlen/konflikte.anzeigen" },
        { pfad: "kennzahlen/konflikte/offen", gleich: true },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC508-BELA-01-XC508-ENTL-01" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XA337-FAEK-01-XA337-TANK-01" }
      ]
    },
    {
      text: "The bars of these overlaps keep the red outline in the daily plan.",
      pruefe: [
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC508-BELA-01-XC508-ENTL-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XA337-FAEK-01-XA337-TANK-01" }
      ]
    },
    {
      text: "For F. Ohlsen, XA 745 lavatory service and fuelling no longer overlap: the conflict has gone from the list and the daily plan.",
      pruefe: [
        { nachricht: "auftraege/XA745-FAEK-01.verschieben" },
        { pfad: "auftraege/XA745-FAEK-01/start", gleich: "08:05" },
        { pfad: "auftraege/XA745-FAEK-01/ende", gleich: "08:25" },
        { sicht: "konfliktzaehler", enthaeltNicht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" },
        { sicht: "gantt", enthaeltNicht: "konflikte/ueberlappung-XA745-FAEK-01-XA745-TANK-01" }
      ]
    },
    {
      text: "The overlap of XC 810 and XB 933 cabin cleaning for I. Reindl is gone again after reassigning to J. Sattler.",
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
      text: "For R. Aldinger, XC 810 unloading and loading now overlap: the new conflict is in the list and both bars have the red outline.",
      pruefe: [
        { nachricht: "auftraege/XC810-BELA-01.zeitaendern" },
        { pfad: "auftraege/XC810-BELA-01/start", gleich: "09:10" },
        { sicht: "konfliktzaehler", enthaelt: "konflikte/ueberlappung-XC810-BELA-01-XC810-ENTL-01" },
        { sicht: "gantt", enthaelt: "konflikte/ueberlappung-XC810-BELA-01-XC810-ENTL-01" }
      ]
    },
    {
      text: "The conflict counter is at 6: four times XC 508, once XA 337 and once XC 810.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
