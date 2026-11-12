Huelle.drehbuch({
  kennung: "wunsch-035",
  titel: "Equipment bars follow the mouse while dragging",
  von: "05:40",
  bis: "06:00",
  ereignisse: [
    { zeit: "05:41", bedienung: "ziehen", greift: "geraeteauftraege/XA101-BLT", sicht: "geraete-gantt", minuten: 5, erzaehlung: "The dispatcher drags XA 101 Belt loading 5 minutes later; the bar moves along with the mouse" },
    { zeit: "05:45", bedienung: "ziehen", greift: "geraeteauftraege/XA101-GPU", sicht: "geraete-gantt", griff: "rechts", minuten: 6, erzaehlung: "The dispatcher drags the end of XA 101 Ground power 6 minutes later; the bar grows with the mouse" },
    { zeit: "05:49", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-gantt", griff: "links", minuten: -2, erzaehlung: "The dispatcher drags the start of XA 101 Stairs 2 minutes earlier; the bar grows to the left with the mouse" }
  ],
  erwartet: [
    { text: "XA 101 Belt loading now runs 05:52–06:29 and stays on BLT-02", pruefe: [ { nachricht: "geraeteauftraege/XA101-BLT.verschieben" }, { pfad: "geraeteauftraege/XA101-BLT/start", gleich: "05:52" }, { pfad: "geraeteauftraege/XA101-BLT/ende", gleich: "06:29" }, { pfad: "geraeteauftraege/XA101-BLT/geraet", gleich: "BLT-02" }, { sicht: "geraete-gantt", enthaelt: "geraeteauftraege/XA101-BLT" } ] },
    { text: "XA 101 Ground power still starts at 05:43 and now ends at 06:35", pruefe: [ { nachricht: "geraeteauftraege/XA101-GPU.verschieben" }, { pfad: "geraeteauftraege/XA101-GPU/start", gleich: "05:43" }, { pfad: "geraeteauftraege/XA101-GPU/ende", gleich: "06:35" }, { pfad: "geraeteauftraege/XA101-GPU/geraet", gleich: "GPU-03" } ] },
    { text: "XA 101 Stairs now starts at 05:40 and still ends at 06:01", pruefe: [ { nachricht: "geraeteauftraege/XA101-STR.verschieben" }, { pfad: "geraeteauftraege/XA101-STR/start", gleich: "05:40" }, { pfad: "geraeteauftraege/XA101-STR/ende", gleich: "06:01" }, { pfad: "geraeteauftraege/XA101-STR/geraet", gleich: "STR-05" } ] }
  ]
});
