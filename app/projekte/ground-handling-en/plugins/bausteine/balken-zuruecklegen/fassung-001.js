/* Plugin: Balken aus dem Tagesplan zurück in „Nicht zugewiesene Aufträge“ ziehen.
   Die Liste wird dafür als Ablageort markiert. Der Zug bildet die Nachricht „zuruecklegen“:
   Der Auftrag behält seine Zeit und ist danach ohne Mitarbeiter. Von dort lässt er sich wie
   gewohnt („Auftrag aus der Liste ziehen“) wieder auf einen Mitarbeiter ziehen. */
(function () {
  var LISTE = "listen/nicht-zugewiesen";

  Huelle.plugin({
    kennung: "balken-zuruecklegen",
    titel: "Drag bar back to the list",
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
        titel: "Drag bar to ”Unassigned tasks”",
        sicht: "gantt",
        fasst: ".pl-balken",
        ziel: ".pl-ablage",
        rollt: ".pl-rahmen",
        leer: "Drag to an agent or to ”Unassigned tasks”",
        ereignis: function (g, h) {
          if (!g.ziel || g.ziel.pfad !== LISTE) return null;
          var a = h.lies(g.pfad);
          if (!a || !a.mitarbeiter) return null;
          var m = h.lies("mitarbeiter/" + a.mitarbeiter);
          return {
            objekt: g.pfad, aktion: "zuruecklegen",
            parameter: { mitarbeiter: a.mitarbeiter },
            erzaehlung: "Dispatcher moves " + a.flug + " " + a.arbeit + " back to ”Unassigned tasks”",
            hinweis: a.flug + " " + a.arbeit + " then has no agent" + (m ? " instead of " + m.name : "") + ", the time stays"
          };
        }
      }
    ]
  });
})();
