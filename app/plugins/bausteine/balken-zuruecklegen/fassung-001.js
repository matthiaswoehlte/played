/* Plugin: Balken aus dem Tagesplan zurück in „Nicht zugewiesene Aufträge“ ziehen.
   Die Liste wird dafür als Ablageort markiert. Der Zug bildet die Nachricht „zuruecklegen“:
   Der Auftrag behält seine Zeit und ist danach ohne Mitarbeiter. Von dort lässt er sich wie
   gewohnt („Auftrag aus der Liste ziehen“) wieder auf einen Mitarbeiter ziehen. */
(function () {
  var LISTE = "listen/nicht-zugewiesen";

  Huelle.plugin({
    kennung: "balken-zuruecklegen",
    titel: "Balken zurück in die Liste ziehen",
    ergaenzt: {
      "nicht-zugewiesen": {
        zeichne: function (el) {
          el.classList.add("pl-ablage");
          el.setAttribute("data-pfad", LISTE);
        }
      }
    },
    abonniert: {
      "auftraege/*.zuruecklegen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", null);
      }
    },
    bedienungen: [
      {
        kennung: "balken-in-liste",
        titel: "Balken in „Nicht zugewiesene Aufträge“ ziehen",
        sicht: "gantt",
        fasst: ".pl-balken",
        ziel: ".pl-ablage",
        rollt: ".pl-rahmen",
        leer: "Auf einen Mitarbeiter oder in „Nicht zugewiesene Aufträge“ ziehen",
        ereignis: function (g, h) {
          if (!g.ziel || g.ziel.pfad !== LISTE) return null;
          var a = h.lies(g.pfad);
          if (!a || !a.mitarbeiter) return null;
          var m = h.lies("mitarbeiter/" + a.mitarbeiter);
          return {
            objekt: g.pfad, aktion: "zuruecklegen",
            parameter: { mitarbeiter: a.mitarbeiter },
            erzaehlung: "Disponent legt " + a.flug + " " + a.arbeit + " zurück in „Nicht zugewiesene Aufträge“",
            hinweis: a.flug + " " + a.arbeit + " ist dann ohne Mitarbeiter" + (m ? " statt bei " + m.name : "") + ", die Zeit bleibt"
          };
        }
      }
    ]
  });
})();
