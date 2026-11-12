/* Plugin: Balken aus dem Tagesplan zurück in „Nicht zugewiesene Aufträge“ ziehen.
   Die Liste wird dafür als Ablageort markiert. Der Zug bildet die Nachricht „zuruecklegen“:
   Der Auftrag behält seine Zeit und ist danach ohne Mitarbeiter. Von dort lässt er sich wie
   gewohnt („Auftrag aus der Liste ziehen“) wieder auf einen Mitarbeiter ziehen. */
(function () {
  var LISTE = "listen/nicht-zugewiesen";

  /* Getroffen ist die Liste selbst oder ein Auftrag, der in ihr liegt. */
  function inListe(pfad, h) {
    if (pfad === LISTE) return true;
    var o = pfad && pfad.indexOf("auftraege/") === 0 ? h.lies(pfad) : null;
    return !!o && !o.mitarbeiter;
  }

  Huelle.plugin({
    kennung: "balken-zuruecklegen",
    titel: "Drag bar back to the list",
    ergaenzt: {
      "nicht-zugewiesen": {
        zeichne: function (el) {
          /* Ablageort als eigenes Element in der Liste: Die Ansicht selbst wird beim Suchen
             der Ablageorte nicht mitgefunden. Der Inhalt der Liste wandert unverändert hinein. */
          var ablage = el.ownerDocument.createElement("div");
          ablage.className = "pl-ablage";
          ablage.setAttribute("data-pfad", LISTE);
          while (el.firstChild) ablage.appendChild(el.firstChild);
          el.appendChild(ablage);
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
        ziel: ".pl-ablage, .pl-ablage .pl-offen",
        rollt: ".pl-rahmen",
        leer: "Drag to an agent or to ”Unassigned tasks”",
        ereignis: function (g, h) {
          if (!g.ziel || !inListe(g.ziel.pfad, h)) return null;
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
    ],
    stil: ".pl-ablage { min-height: 100%; min-height: 120px; border-radius: 8px; }"
  });
})();
