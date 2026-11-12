Huelle.plugin({
  kennung: "geraet-konflikt-rand",
  titel: "Red outline on conflicting equipment tasks",
  ergaenzt: {
    "geraete-gantt": {
      neuBei: ["geraeteauftraege/*.geaendert", "wartungen/*.geaendert", "geraete/*.geaendert"],
      zeichne: function (el, h) {
        function liste(bereich) {
          var a = h.alle(bereich) || {};
          if (Array.isArray(a)) return a.filter(Boolean);
          return Object.keys(a).map(function (k) { var o = a[k] || {}; if (!o.kennung) o.kennung = k; return o; });
        }
        function ueberlappt(a1, e1, a2, e2) { return a1 < e2 && a2 < e1; }
        var auftraege = liste("geraeteauftraege").filter(function (a) { return a.geraet && a.start && a.ende; });
        var wartungen = liste("wartungen");
        var imKonflikt = {};
        var proGeraet = {};
        auftraege.forEach(function (a) {
          (proGeraet[a.geraet] = proGeraet[a.geraet] || []).push(a);
          // wrong equipment type for this task
          var typ = h.lies("geraete/" + a.geraet + "/typ");
          if (typ && a.typ && typ !== a.typ) imKonflikt[a.kennung] = true;
          // equipment is in maintenance at that time
          wartungen.forEach(function (w) {
            if (w.geraet !== a.geraet) return;
            if (w.tag && a.tag && w.tag !== a.tag) return;
            if (ueberlappt(h.minuten(a.start), h.minuten(a.ende), h.minuten(w.start), h.minuten(w.ende))) imKonflikt[a.kennung] = true;
          });
        });
        // two tasks on the same equipment at the same time
        Object.keys(proGeraet).forEach(function (g) {
          var l = proGeraet[g];
          for (var i = 0; i < l.length; i++) {
            for (var j = i + 1; j < l.length; j++) {
              var x = l[i], y = l[j];
              if (x.tag && y.tag && x.tag !== y.tag) continue;
              if (ueberlappt(h.minuten(x.start), h.minuten(x.ende), h.minuten(y.start), h.minuten(y.ende))) {
                imKonflikt[x.kennung] = true;
                imKonflikt[y.kennung] = true;
              }
            }
          }
        });
        var balken = el.querySelectorAll('[data-pfad^="geraeteauftraege/"]');
        for (var k = 0; k < balken.length; k++) {
          var b = balken[k];
          var id = b.getAttribute("data-pfad").split("/")[1];
          if (imKonflikt[id]) b.classList.add("pl-gk-konflikt");
        }
      }
    }
  },
  stil: ".pl-gk-konflikt { outline: 2px solid var(--koralle); outline-offset: -1px; box-shadow: 0 0 0 1px var(--koralle); }"
});