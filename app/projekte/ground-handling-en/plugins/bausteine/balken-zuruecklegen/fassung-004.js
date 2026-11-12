/* Plugin: Balken aus dem Tagesplan zurück in „Nicht zugewiesene Aufträge“ ziehen.
   Die Liste wird dafür als Ablageort markiert. Der Zug bildet die Nachricht „zuruecklegen“:
   Der Auftrag behält seine Zeit und ist danach ohne Mitarbeiter. Von dort lässt er sich wie
   gewohnt („Auftrag aus der Liste ziehen“) wieder auf einen Mitarbeiter ziehen. */
(function () {
  var LISTE = "listen/nicht-zugewiesen";
  var liste = null;   // die zuletzt gezeichnete Ansicht „Nicht zugewiesene Aufträge“

  /* Liegt der gezogene Balken über der Liste? Die anderen Bedienungen am Balken suchen nur
     Zeilen im Tagesplan als Ablageort, darum wird die Liste hier am Zugweg selbst gemessen. */
  function ueberListe(g) {
    if (!liste || !liste.isConnected || !g.sicht) return false;
    var b = g.sicht.querySelector('.pl-bahn .pl-balken[data-pfad="' + g.pfad + '"]');
    if (!b) return false;
    var r = b.getBoundingClientRect(), z = liste.getBoundingClientRect();
    var y = r.top + r.height / 2 + (g.dy || 0);
    if (y < z.top || y > z.bottom) return false;
    return [r.left + 6, r.left + r.width / 2, r.right - 6].some(function (x) {
      x += g.dx || 0;
      return x >= z.left && x <= z.right;
    });
  }

  /* Solange der Zug in die Liste geht, ist sie als Ablageort umrandet. */
  function vorschau(g, n) {
    if (!liste) return;
    var ablage = liste.querySelector(".pl-ablage");
    if (ablage) ablage.classList.toggle("pl-ablage-aktiv", !!n && n.aktion === "zuruecklegen");
  }

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
          liste = el;
        }
      }
    },
    /* „zuruecklegen“ setzt „Einsatz ändern“ um: Der Mitarbeiter eines Auftrags gehört nur ihm (Bus-Vertrag). */
    bedienungen: [
      {
        kennung: "balken-in-liste",
        titel: "Drag bar to ”Unassigned tasks”",
        sicht: "gantt",
        fasst: ".pl-balken",
        ziel: ".pl-ablage, .pl-ablage .pl-offen",
        rollt: ".pl-rahmen",
        leer: "Drag to an agent or to ”Unassigned tasks”",
        vorschau: vorschau,
        ereignis: function (g, h) {
          if (!(g.ziel && inListe(g.ziel.pfad, h)) && !ueberListe(g)) return null;
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
    stil: [
      ".pl-ablage { box-sizing: border-box; min-height: 100%; border-radius: 8px; }",
      ".pl-ablage.pl-ablage-aktiv { box-shadow: inset 0 0 0 2px var(--akzent); background: var(--glas); }"
    ].join("\n")
  });
})();
