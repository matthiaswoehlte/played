/* Drehbuch: Krankmeldung MA-01 ab 08:00.
   Erwartung je Variante (bei): „Aufträge lösen“ wie in der letzten Prototyp-Fassung
   gemessen (gelöst werden XC810-ENTL-01 und XC810-BELA-01, Konflikte 6 → 7),
   „Automatisch umverteilen“ nach deren Regel für den ersten freien Qualifizierten gerechnet. */
Huelle.drehbuch({
  kennung: "krankmeldung-ma-01",
  titel: "Sick call AG-01 from 08:00",
  von: "07:45",
  bis: "08:10",
  ereignisse: [
    {
      zeit: "08:00", objekt: "mitarbeiter/MA-01", aktion: "krankmeldung",
      parameter: { ab: "08:00" },
      erzaehlung: "Sick call AG-01 from 08:00"
    }
  ],
  erwartet: [
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "XC 810 Unloading is without an agent under “Unassigned tasks”.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "gantt", enthaeltNicht: "auftraege/XC810-ENTL-01" },
        { nachricht: "auftraege/XC810-ENTL-01.loesen" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "XC 810 Loading is without an agent under “Unassigned tasks”.",
      pruefe: [
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-BELA-01" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "The conflict counter is at 7.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 7 }]
    },
    {
      bei: { krankmeldung: "verhalten-umverteilen" },
      text: "V. Engström takes over XC 810 Unloading; only XC 810 Loading is under “Unassigned tasks”.",
      pruefe: [
        { pfad: "auftraege/XC810-ENTL-01/mitarbeiter", gleich: "MA-05" },
        { sicht: "gantt", enthaelt: "auftraege/XC810-ENTL-01" },
        { sicht: "nicht-zugewiesen", enthaeltNicht: "auftraege/XC810-ENTL-01" },
        { nachricht: "auftraege/XC810-ENTL-01.zuweisen" },
        { pfad: "auftraege/XC810-BELA-01/mitarbeiter", gleich: null },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XC810-BELA-01" }
      ]
    },
    {
      text: "Whatever is done before 08:00 stays with MA-01.",
      pruefe: [
        { pfad: "auftraege/XA101-ENTL-01/mitarbeiter", gleich: "MA-01" },
        { pfad: "auftraege/XC508-BELA-01/mitarbeiter", gleich: "MA-01" }
      ]
    }
  ]
});
