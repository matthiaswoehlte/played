/* Drehbuch: Krankmeldung MA-20 ab 09:00.
   „Aufträge lösen“ wie in der letzten Prototyp-Fassung gemessen (XC810-TANK-01 wird gelöst,
   Konflikte bleiben 6), „Automatisch umverteilen“ nach deren Regel gerechnet. */
Huelle.drehbuch({
  kennung: "krankmeldung-ma-20",
  titel: "Sick call AG-20 from 09:00",
  von: "08:45",
  bis: "09:10",
  ereignisse: [
    {
      zeit: "09:00", objekt: "mitarbeiter/MA-20", aktion: "krankmeldung",
      parameter: { ab: "09:00" },
      erzaehlung: "Sick call AG-20 from 09:00"
    }
  ],
  erwartet: [
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "XC 810 Fuelling is without an agent under “Unassigned tasks”.",
      pruefe: [
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-TANK-01" },
        { pfad: "kennzahlen/konflikte/wert", gleich: 6 }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-umverteilen" },
      text: "E. Novak takes over XC 810 Fuelling; the list stays empty.",
      pruefe: [
        { pfad: "auftraege/XC810-TANK-01/mitarbeiter", gleich: "MA-21" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-TANK-01" }
      ]
    }
  ]
});
