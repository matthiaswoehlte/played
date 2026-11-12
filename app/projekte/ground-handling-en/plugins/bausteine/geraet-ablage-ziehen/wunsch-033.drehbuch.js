Huelle.drehbuch({
  kennung: "wunsch-033",
  titel: "Drag equipment tasks to and from the unassigned list",
  von: "05:40",
  bis: "06:00",
  ereignisse: [
    { zeit: "05:41", bedienung: "ziehen", greift: "geraeteauftraege/XA101-GPU", sicht: "geraete-gantt", nach: "ablagen/geraete-offen", erzaehlung: "The dispatcher drags XA 101 Ground power into the unassigned list" },
    { zeit: "05:43", bedienung: "ziehen", greift: "geraeteauftraege/XA101-GPU", sicht: "geraete-offen", nach: "geraete/GPU-01", erzaehlung: "The dispatcher drags XA 101 Ground power onto GPU-01" },
    { zeit: "05:45", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-gantt", nach: "ablagen/geraete-offen", erzaehlung: "The dispatcher drags XA 101 Stairs into the unassigned list" },
    { zeit: "05:47", bedienung: "ziehen", greift: "geraeteauftraege/XA101-STR", sicht: "geraete-offen", nach: "geraete/GPU-02", erzaehlung: "The dispatcher drags XA 101 Stairs onto GPU-02" }
  ],
  erwartet: [
    { text: "XA 101 Ground power is then on GPU-01 and keeps its time 05:43", pruefe: [ { pfad: "geraeteauftraege/XA101-GPU/geraet", gleich: "GPU-01" }, { pfad: "geraeteauftraege/XA101-GPU/start", gleich: "05:43" } ] },
    { text: "XA 101 Stairs was unassigned on the way", pruefe: [ { nachricht: "geraeteauftraege/XA101-STR.loesen" } ] },
    { text: "XA 101 Stairs is then on GPU-02 and keeps its time 05:42", pruefe: [ { pfad: "geraeteauftraege/XA101-STR/geraet", gleich: "GPU-02" }, { pfad: "geraeteauftraege/XA101-STR/start", gleich: "05:42" } ] },
    { text: "XA 101 Stairs on GPU-02 is shown as a conflict", pruefe: [ { sicht: "geraete-konflikte", enthaelt: "geraeteauftraege/XA101-STR" } ] }
  ]
});