Huelle.drehbuch({
  kennung: "wunsch-036",
  titel: "Drag equipment bars to another unit",
  von: "05:40",
  bis: "06:00",
  ereignisse: [
    { zeit: "05:41", bedienung: "ziehen", greift: "geraeteauftraege/XA101-GPU", sicht: "geraete-gantt", nach: "geraete/GPU-01", erzaehlung: "The dispatcher drags XA 101 Ground power from GPU-03 onto GPU-01" },
    { zeit: "05:45", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-gantt", nach: "geraete/GPU-02", erzaehlung: "The dispatcher drags XA 101 Stairs from STR-05 onto GPU-02" }
  ],
  erwartet: [
    { text: "XA 101 Ground power is then on GPU-01 and keeps its time 05:43–06:29", pruefe: [ { nachricht: "geraeteauftraege/XA101-GPU.umplanen" }, { pfad: "geraeteauftraege/XA101-GPU/geraet", gleich: "GPU-01" }, { pfad: "geraeteauftraege/XA101-GPU/start", gleich: "05:43" }, { pfad: "geraeteauftraege/XA101-GPU/ende", gleich: "06:29" }, { sicht: "geraete-gantt", enthaelt: "geraeteauftraege/XA101-GPU" } ] },
    { text: "XA 101 Stairs is then on GPU-02 and keeps its time 05:42–06:01", pruefe: [ { nachricht: "geraeteauftraege/XA101-STR.umplanen" }, { pfad: "geraeteauftraege/XA101-STR/geraet", gleich: "GPU-02" }, { pfad: "geraeteauftraege/XA101-STR/start", gleich: "05:42" }, { pfad: "geraeteauftraege/XA101-STR/ende", gleich: "06:01" } ] },
    { text: "XA 101 Stairs on GPU-02 is shown as a conflict in the existing conflict list", pruefe: [ { sicht: "geraete-konflikte", enthaelt: "geraeteauftraege/XA101-STR" } ] },
    { text: "Neither task ends up in the unassigned list", pruefe: [ { sicht: "geraete-offen", enthaeltNicht: "geraeteauftraege/XA101-GPU" }, { sicht: "geraete-offen", enthaeltNicht: "geraeteauftraege/XA101-STR" } ] }
  ]
});