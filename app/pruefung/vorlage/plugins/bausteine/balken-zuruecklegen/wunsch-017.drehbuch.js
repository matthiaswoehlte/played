/* Drehbuch: Der Disponent legt Balken zurück in die Liste und teilt neu ein.
   08:14 XC 810 Betanken (D. Mahler, 09:05–09:30) zurück in die Liste. E. Novak ist frei, keine
   Kapazitätslücke: Konflikte bleiben 6.
   08:20 XC 810 Betanken aus der Liste auf E. Novak (frei zwischen 08:20 und 09:40): Konflikte bleiben 6.
   08:24 XC 810 Innenraum-Cleaning (I. Reindl, 09:10–09:40) zurück in die Liste. J. Sattler ist frei,
   keine Kapazitätslücke: Konflikte bleiben 6. */
Huelle.drehbuch({
  kennung: "wunsch-017",
  titel: "Balken zurück in die Liste ziehen und neu einteilen",
  von: "08:10",
  bis: "08:30",
  ereignisse: [
    {
      zeit: "08:14", objekt: "auftraege/XC810-TANK-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-20" },
      erzaehlung: "Disponent legt XC 810 Betanken zurück in „Nicht zugewiesene Aufträge“"
    },
    {
      zeit: "08:20", objekt: "auftraege/XC810-TANK-01", aktion: "umplanen",
      parameter: { mitarbeiter: "MA-21" },
      erzaehlung: "Disponent zieht XC 810 Betanken auf E. Novak"
    },
    {
      zeit: "08:24", objekt: "auftraege/XC810-CLEAN-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-40" },
      erzaehlung: "Disponent legt XC 810 Innenraum-Cleaning zurück in „Nicht zugewiesene Aufträge“"
    }
  ],
  erwartet: [
    {
      text: "XC 810 Betanken wurde aus dem Tagesplan zurück in die Liste gelegt.",
      pruefe: [{ nachricht: "auftraege/XC810-TANK-01.zuruecklegen" }]
    },
    {
      text: "XC 810 Betanken liegt danach aus der Liste bei E. Novak im Tagesplan.",
      pruefe: [
        { nachricht: "auftraege/XC810-TANK-01.umplanen" },
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-TANK-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" }
      ]
    },
    {
      text: "XC 810 Innenraum-Cleaning liegt ohne Mitarbeiter unter „Nicht zugewiesene Aufträge“ und nicht mehr im Tagesplan.",
      pruefe: [
        { nachricht: "auftraege/XC810-CLEAN-01.zuruecklegen" },
        { pfad: "auftraege/XC810-CLEAN-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-CLEAN-01" },
        { sicht: "gantt", enthaeltNicht: "auftraege/XC810-CLEAN-01" }
      ]
    },
    {
      text: "Die Aufträge behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XC810-TANK-01/start", gleich: "09:05" },
        { pfad: "auftraege/XC810-TANK-01/ende", gleich: "09:30" },
        { pfad: "auftraege/XC810-CLEAN-01/start", gleich: "09:10" },
        { pfad: "auftraege/XC810-CLEAN-01/ende", gleich: "09:40" }
      ]
    },
    {
      text: "Der Konfliktzähler steht auf 6, weil für XC 810 Innenraum-Cleaning J. Sattler frei ist.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 6 }]
    }
  ]
});
