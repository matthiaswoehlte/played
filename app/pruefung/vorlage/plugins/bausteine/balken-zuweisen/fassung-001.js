/* Plugin: Balken auf einen anderen Mitarbeiter ziehen.
   Bildet die Nachricht „umplanen“. Ob die Zuteilung erlaubt ist, steht im Verhalten
   „Einsatz ändern“. In der eigenen Zeile gibt es hier nichts zu tun. */
Huelle.plugin({
  kennung: "balken-zuweisen",
  titel: "Balken auf Mitarbeiter ziehen",
  bedienungen: [
    {
      kennung: "balken-auf-zeile",
      titel: "Balken auf Zeile ziehen",
      sicht: "gantt",
      fasst: ".pl-balken",
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: "Auf einen Mitarbeiter ziehen",
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m || m.kennung === a.mitarbeiter) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Disponent zieht " + a.flug + " " + a.arbeit + " auf " + m.name,
          hinweis: m.name + " kann " + a.arbeit + " übernehmen, die Zeit bleibt"
        };
      }
    }
  ],
  stil: ".pl-balken { cursor: grab; touch-action: none; }"
});
