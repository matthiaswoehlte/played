/* Plugin: Auftrag aus „Nicht zugewiesene Aufträge“ auf einen Mitarbeiter ziehen.
   Dieselbe Nachricht „umplanen“ wie beim Ziehen eines Balkens: Ob es erlaubt ist und was es
   bewirkt, steht im Verhalten „Einsatz ändern“. Die Ablageorte liegen im Tagesplan. */
Huelle.plugin({
  kennung: "offen-zuweisen",
  titel: "Drag task from the list",
  bedienungen: [
    {
      kennung: "offen-auf-zeile",
      titel: "Drag task onto an agent",
      sicht: "nicht-zugewiesen",
      fasst: ".pl-offen",
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: "Drag onto an agent in the daily plan",
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
          hinweis: m.name + " kann " + a.arbeit + ", the time stays the same"
        };
      }
    }
  ],
  stil: ".pl-offen { cursor: grab; touch-action: none; user-select: none; }"
});
