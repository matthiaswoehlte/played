/* Plugin: Balken in der eigenen Zeile nach links und rechts verschieben.
   Der Balken rückt als Ganzes in der Zeit; das ist dieselbe Nachricht „verschieben“ wie bei
   einer Flugverspätung. Auf einer anderen Zeile gibt es hier nichts zu tun. */
(function () {
  var RASTER = 5;     // Raster beim Ziehen in Minuten

  function achse(sicht) {
    var r = sicht.querySelector(".pl-rahmen");
    return r ? { von: Number(r.dataset.von), bis: Number(r.dataset.bis) } : null;
  }
  function aufRaster(min) { return Math.round(min / RASTER) * RASTER; }

  /* Nur ein Zug in der Zeit zeigt sich am Balken; sonst liegt er an seinem alten Platz. */
  function vorschau(g, n, el, h) {
    var a = h.lies(g.pfad), ax = achse(el);
    var b = el.querySelector('.pl-bahn .pl-balken[data-pfad="' + g.pfad + '"]');
    if (!a || !b || !ax) return;
    var zug = n && n.aktion === "verschieben" ? n.parameter.minuten : 0;
    var s = h.minuten(a.start) + zug, e = h.minuten(a.ende) + zug, spanne = ax.bis - ax.von;
    b.style.left = (s - ax.von) / spanne * 100 + "%";
    b.style.width = (e - s) / spanne * 100 + "%";
    b.classList.toggle("pl-gezogen", !!zug);
    if (zug) b.removeAttribute("title");
    b.querySelector("span").textContent = zug ? h.zeit(s) + "–" + h.zeit(e) : a.flug;
  }

  Huelle.plugin({
    kennung: "balken-verschieben",
    titel: "Move bar within the row",
    bedienungen: [
      {
        kennung: "balken-verschieben",
        titel: "Move bar within its own row",
        sicht: "gantt",
        fasst: ".pl-balken",
        ziel: ".pl-zeile",
        rollt: ".pl-rahmen",
        leer: "Move within its own row",
        vorschau: vorschau,
        ereignis: function (g, h) {
          if (!g.ziel) return null;
          var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
          var ax = achse(g.sicht), bahn = g.sicht.querySelector(".pl-bahn");
          if (!a || !m || !ax || !bahn || m.kennung !== a.mitarbeiter) return null;
          var s = h.minuten(a.start), dauer = h.minuten(a.ende) - s;
          var weg = g.dx / bahn.getBoundingClientRect().width * (ax.bis - ax.von);
          var neu = Math.max(ax.von, Math.min(ax.bis - dauer, aufRaster(s + weg)));
          if (neu === s) return { hinweis: "Stays at " + a.start + "–" + a.ende };
          var zeiten = h.zeit(neu) + "–" + h.zeit(neu + dauer);
          return {
            objekt: g.pfad, aktion: "verschieben",
            parameter: { minuten: neu - s, grund: "disponent" },
            erzaehlung: "Dispatcher moves " + a.flug + " " + a.arbeit + " to " + zeiten,
            hinweis: a.flug + " " + a.arbeit + " then runs " + zeiten
          };
        }
      }
    ],
    stil: [
      ".pl-balken { cursor: grab; touch-action: none; }",
      ".pl-balken.pl-gezogen { z-index: 5; box-shadow: 0 0 0 1px var(--gold); }"
    ].join("\n")
  });
})();
