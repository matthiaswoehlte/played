/* Plugin: Auftrag aus „Nicht zugewiesene Aufträge“ auf einen Mitarbeiter ziehen.
   Dieselbe Nachricht „umplanen“ wie beim Ziehen eines Balkens: Ob es erlaubt ist und was es
   bewirkt, steht im Verhalten „Einsatz ändern“. Die Ablageorte liegen im Tagesplan. */
Huelle.plugin({
  kennung: "offen-zuweisen",
  titel: "Auftrag aus der Liste ziehen",
  bedienungen: [
    {
      kennung: "offen-auf-zeile",
      titel: "Auftrag auf Mitarbeiter ziehen",
      sicht: "nicht-zugewiesen",
      fasst: ".pl-offen",
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: "Auf einen Mitarbeiter im Tagesplan ziehen",
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Disponent zieht " + a.flug + " " + a.arbeit + " auf " + m.name,
          hinweis: m.name + " kann " + a.arbeit + " übernehmen, die Zeit bleibt"
        };
      }
    }
  ],
  stil: ".pl-offen { cursor: grab; touch-action: none; user-select: none; }"
});
