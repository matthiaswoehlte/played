/* Drehbuch: Der Tag beginnt um 08:40.
   XA 745 Betanken (08:30–08:55) läuft: Begonnen. XA 745 Entladen (08:20–08:40) ist vorbei: Fertig.
   XA 745 Innenraum-Cleaning bei I. Reindl (08:35–09:05) läuft: Begonnen.
   08:44 XA 745 Betanken zurück in die Liste: Offen; die Überlappung bei F. Ohlsen entfällt, Konflikte 6 → 5.
   08:48 XA 745 Entladen zurück in die Liste: Offen; R. Aldinger ist frei, keine Kapazitätslücke.
   08:52 I. Reindl krank: XA 745, XC 810 und XB 933 Innenraum-Cleaning werden gelöst; XA 745 geht
   auf Offen, die beiden anderen waren schon Offen. J. Sattler ist frei, die Konflikte bleiben 5. */
Huelle.drehbuch({
  kennung: "wunsch-031",
  titel: "Tasks in the list go back to Open",
  von: "08:40",
  bis: "09:00",
  ereignisse: [
    {
      zeit: "08:44", objekt: "auftraege/XA745-TANK-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-22" },
      erzaehlung: "Dispatcher puts the started XA 745 fuelling back into “Unassigned tasks”"
    },
    {
      zeit: "08:48", objekt: "auftraege/XA745-ENTL-01", aktion: "zuruecklegen",
      parameter: { mitarbeiter: "MA-09" },
      erzaehlung: "Dispatcher puts the done XA 745 unloading back into “Unassigned tasks”"
    },
    {
      zeit: "08:52", objekt: "mitarbeiter/MA-40", aktion: "krankmeldung",
      parameter: { ab: "08:52" },
      erzaehlung: "I. Reindl reports sick from 08:52"
    }
  ],
  erwartet: [
    {
      text: "After being put back, the started XA 745 Fuelling is in the list without an agent and is set to Open.",
      pruefe: [
        { nachricht: "auftraege/XA745-TANK-01.zuruecklegen" },
        { nachricht: "auftraege/XA745-TANK-01.status" },
        { pfad: "auftraege/XA745-TANK-01/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-TANK-01/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-TANK-01" }
      ]
    },
    {
      text: "After being put back, the done XA 745 Unloading is in the list without an agent and is set to Open.",
      pruefe: [
        { nachricht: "auftraege/XA745-ENTL-01.status" },
        { pfad: "auftraege/XA745-ENTL-01/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-ENTL-01/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-ENTL-01" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "The started XA 745 Cabin cleaning is unassigned because of I. Reindl's sick call and is set to Open.",
      pruefe: [
        { nachricht: "auftraege/XA745-CLEAN-03.loesen" },
        { nachricht: "auftraege/XA745-CLEAN-03.status" },
        { pfad: "auftraege/XA745-CLEAN-03/mitarbeiter", gleich: null },
        { pfad: "auftraege/XA745-CLEAN-03/status", gleich: "offen" },
        { sicht: "nicht-zugewiesen", enthaelt: "auftraege/XA745-CLEAN-03" }
      ]
    },
    {
      text: "Started tasks that stay with their agent keep their status.",
      pruefe: [
        { pfad: "auftraege/XA745-FAEK-01/mitarbeiter", gleich: "MA-22" },
        { pfad: "auftraege/XA745-FAEK-01/status", gleich: "begonnen" },
        { pfad: "auftraege/XA745-CLEAN-01/status", gleich: "begonnen" }
      ]
    },
    {
      text: "The tasks put back keep their times.",
      pruefe: [
        { pfad: "auftraege/XA745-TANK-01/start", gleich: "08:30" },
        { pfad: "auftraege/XA745-TANK-01/ende", gleich: "08:55" },
        { pfad: "auftraege/XA745-ENTL-01/start", gleich: "08:20" },
        { pfad: "auftraege/XA745-ENTL-01/ende", gleich: "08:40" }
      ]
    },
    {
      bei: { krankmeldung: "verhalten-krankmeldung" },
      text: "The conflict counter is at 5, because XA 745 Lavatory service and Fuelling no longer overlap for F. Ohlsen.",
      pruefe: [{ pfad: "kennzahlen/konflikte/wert", gleich: 5 }]
    }
  ]
});
