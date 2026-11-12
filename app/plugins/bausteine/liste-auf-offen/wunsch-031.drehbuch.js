/* Drehbuch: Der Tag beginnt um 08:40.
   XA 745 Betanken (08:30–08:55) läuft: Begonnen. XA 745 Entladen (08:20–08:40) ist vorbei: Fertig.
   XA 745 Innenraum-Cleaning bei I. Reindl (08:35–09:05) läuft: Begonnen.
   08:44 XA 745 Betanken zurück in die Liste: Offen; die Überlappung bei F. Ohlsen entfällt, Konflikte 6 → 5.
   08:48 XA 745 Entladen zurück in die Liste: Offen; R. Aldinger ist frei, keine Kapazitätslücke.
   08:52 I. Reindl krank: XA 745, XC 810 und XB 933 Innenraum-Cleaning werden gelöst; XA 745 geht
   auf Offen, die beiden anderen waren schon Offen. J. Sattler ist frei, die Konflikte bleiben 5. */
Huelle.drehbuch({
  kennung: "wunsch-031",
  titel: "Aufträge in der Liste gehen wieder auf Offen",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "auftraege/XA745-TANK-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-22" },
      erzaehlung: "Disponent legt das begonnene XA 745 Betanken zurück in „Nicht zugewiesene Aufträge“"
    },
    {
      zeit: "08:48", objekt: "auftraege/XA745-ENTL-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-09" },
      erzaehlung: "Disponent legt das fertige XA 745 Entladen zurück in „Nicht zugewiesene Aufträge“"
    },
    {
      zeit: "08:52", objekt: "mitarbeiter/MA-40", aktion: "krankmeldung",
      parameter: { ab: "08:52" },
      erzaehlung: "I. Reindl meldet sich ab 08:52 krank"
    }
  ],
  erwartet: [
    {
      text: "Das begonnene XA 745 Betanken liegt nach dem Zurücklegen ohne Mitarbeiter in der Liste und steht auf Offen.",
      pruefe: [
        { nachricht: "auftraege/XA745-TANK-01.zuruecklegen" },
        { nachricht: "auftraege/XA745-TANK-01.status" },
        { pfad: "auftraege/XA745-TANK-01/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-TANK-01/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-TANK-01" }
      ]
    },
    {
      text: "Das fertige XA 745 Entladen liegt nach dem Zurücklegen ohne Mitarbeiter in der Liste und steht auf Offen.",
      pruefe: [
        { nachricht: "auftraege/XA745-ENTL-01.status" },
        { pfad: "auftraege/XA745-ENTL-01/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-ENTL-01/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-ENTL-01" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "Das begonnene XA 745 Innenraum-Cleaning ist durch die Krankmeldung von I. Reindl gelöst und steht auf Offen.",
      pruefe: [
        { nachricht: "auftraege/XA745-CLEAN-03.loesen" },
        { nachricht: "auftraege/XA745-CLEAN-03.status" },
        { pfad: "auftraege/XA745-CLEAN-03/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-CLEAN-03/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-CLEAN-03" }
      ]
    },
    {
      text: "Begonnene Aufträge, die bei ihrem Mitarbeiter bleiben, behalten ihren Status.",
      pruefe: [
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { pfad: "auftraege/XA745-FAEK-01/status", gleich: "begonnen" },
        { pfad: "auftraege/XA745-CLEAN-01/status", gleich: "begonnen" }
      ]
    },
    {
      text: "Die zurückgelegten Aufträge behalten ihre Zeiten.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XA745-ENTL-01/start", gleich: "08:20" },
        { pfad: "auftraege/XA745-ENTL-01/ende", gleich: "08:40" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "Der Konfliktzähler steht auf 5, weil sich bei F. Ohlsen XA 745 Fäkalien entleeren und Betanken nicht mehr überschneiden.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
