/* Plugin: Balken auf einen anderen Mitarbeiter ziehen.
   Bildet die Nachricht „umplanen“. Ob die Zuteilung erlaubt ist, steht im Verhalten
   „Einsatz ändern“. In der eigenen Zeile gibt es hier nichts zu tun. */
Huelle.plugin({
  kennung: "balken-zuweisen",
  titel: "Drag bars to agents",
  bedienungen: [
    {
      kennung: "balken-auf-zeile",
      titel: "Drag bar onto a row",
      sicht: "gantt",
      fasst: ".pl-balken",
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: "Drag onto an agent",
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m || m.kennung === a.mitarbeiter) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
          hinweis: m.name + " kann " + a.arbeit + ", the time stays the same"
        };
      }
    }
  ],
  stil: ".pl-balken { cursor: grab; touch-action: none; }"
});
