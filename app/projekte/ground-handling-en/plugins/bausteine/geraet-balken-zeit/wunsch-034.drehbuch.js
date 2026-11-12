Huelle.drehbuch({
  kennung: "wunsch-034",
  titel: "Move and stretch equipment bars",
  von: "05:40",
  bis: "06:00",
  ereignisse: [
    { zeit: "05:41", bedienung: "ziehen", greift: "geraeteauftraege/XA101-GPU", sicht: "geraete-gantt", minuten: 10, erzaehlung: "The dispatcher moves XA 101 Ground power 10 minutes later" },
    { zeit: "05:44", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-gantt", griff: "rechts", minuten: 9, erzaehlung: "The dispatcher drags the end of XA 101 Stairs 9 minutes later" },
    { zeit: "05:47", bedienung: "ziehen", greift: "geraeteauftraege/XA101-BLT", sicht: "geraete-gantt", griff: "links", minuten: -7, erzaehlung: "The dispatcher drags the start of XA 101 Belt loading 7 minutes earlier" },
    { zeit: "05:50", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-gantt", nach: "ablagen/geraete-offen", erzaehlung: "The dispatcher drags XA 101 Stairs into the unassigned list" }
  ],
  erwartet: [
    { text: "XA 101 Ground power now runs 05:53–06:39 and stays on GPU-03", pruefe: [ { nachricht: "geraeteauftraege/XA101-GPU.verschieben" }, { pfad: "geraeteauftraege/XA101-GPU/start", gleich: "05:53" }, { pfad: "geraeteauftraege/XA101-GPU/ende", gleich: "06:39" }, { pfad: "geraeteauftraege/XA101-GPU/geraet", gleich: "GPU-03" }, { sicht: "geraete-gantt", enthaelt: "geraeteauftraege/XA101-GPU" } ] },
    { text: "XA 101 Stairs still starts at 05:42 and now ends at 06:10", pruefe: [ { pfad: "geraeteauftraege/XA101-STR/start", gleich: "05:42" }, { pfad: "geraeteauftraege/XA101-STR/ende", gleich: "06:10" } ] },
    { text: "XA 101 Belt loading now starts at 05:40, still ends at 06:24 and stays on BLT-02", pruefe: [ { pfad: "geraeteauftraege/XA101-BLT/start", gleich: "05:40" }, { pfad: "geraeteauftraege/XA101-BLT/ende", gleich: "06:24" }, { pfad: "geraeteauftraege/XA101-BLT/geraet", gleich: "BLT-02" } ] },
    { text: "XA 101 Stairs dropped on the list is unassigned as before", pruefe: [ { nachricht: "geraeteauftraege/XA101-STR.loesen" }, { pfad: "geraeteauftraege/XA101-STR/geraet", gleich: null }, { sicht: "geraete-offen", enthaelt: "geraeteauftraege/XA101-STR" } ] }
  ]
});
