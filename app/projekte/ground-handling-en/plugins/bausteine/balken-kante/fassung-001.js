/* Plugin: Balken im Tagesplan am Rand verlängern und verkürzen.
   Bringt die Griffe an den Balken selbst mit und bildet daraus die Nachricht „zeitaendern“.
   Ob die Änderung erlaubt ist und was sie bewirkt, steht im Verhalten „Einsatz ändern“. */
(function () {
  var RASTER = 5;     // Raster beim Ziehen in Minuten
  var SICHTBAR = 5;   // so viele Minuten bleibt ein Balken in der Vorschau mindestens stehen

  function achse(sicht) {
    var r = sicht.querySelector(".pl-rahmen");
    return r ? { von: Number(r.dataset.von), bis: Number(r.dataset.bis) } : null;
  }
  function aufRaster(min) { return Math.round(min / RASTER) * RASTER; }
  function wegInMinuten(g, ax, bahn) {
    return g.dx / bahn.getBoundingClientRect().width * (ax.bis - ax.von);
  }

  function vorschau(g, n, el, h) {
    var a = h.lies(g.pfad), ax = achse(el);
    var b = el.querySelector('.pl-bahn .pl-balken[data-pfad="' + g.pfad + '"]');
    if (!a || !b || !ax) return;
    var s = h.minuten(a.start), e = h.minuten(a.ende), spanne = ax.bis - ax.von;
    if (n && n.parameter) {
      var t = h.minuten(n.parameter.zeit);
      if (n.parameter.kante === "start") s = Math.min(t, e - SICHTBAR);
      else e = Math.max(t, s + SICHTBAR);
    }
    b.style.left = (s - ax.von) / spanne * 100 + "%";
    b.style.width = (e - s) / spanne * 100 + "%";
    b.classList.add("pl-gezogen");
    b.removeAttribute("title");
    b.querySelector("span").textContent = h.zeit(s) + "–" + h.zeit(e);
  }

  Huelle.plugin({
    kennung: "balken-kante",
    titel: "Drag bar at the edge",
    ergaenzt: {
      gantt: {
        zeichne: function (el) {
          el.querySelectorAll(".pl-bahn .pl-balken").forEach(function (b) {
            b.insertAdjacentHTML("beforeend",
              '<i class="pl-griff pl-griff-start" data-kante="start"></i>' +
              '<i class="pl-griff pl-griff-ende" data-kante="ende"></i>');
          });
        }
      }
    },
    bedienungen: [
      {
        kennung: "balken-kante",
        titel: "Drag bar at the edge",
        sicht: "gantt",
        fasst: ".pl-griff",
        zeiger: "ew-resize",
        vorschau: vorschau,
        ereignis: function (g, h) {
          var a = h.lies(g.pfad), ax = achse(g.sicht), bahn = g.sicht.querySelector(".pl-bahn");
          if (!a || !ax || !bahn) return null;
          var vorn = g.daten.kante === "start";
          var alt = h.minuten(vorn ? a.start : a.ende);
          var neu = Math.max(ax.von, Math.min(ax.bis, aufRaster(alt + wegInMinuten(g, ax, bahn))));
          if (neu === alt) return { hinweis: "Stays at " + a.start + "–" + a.ende };
          return {
            objekt: g.pfad, aktion: "zeitaendern",
            parameter: { kante: g.daten.kante, zeit: h.zeit(neu) },
            erzaehlung: a.flug + " " + a.arbeit + (vorn ? " now starts at " : " now ends at ") + h.zeit(neu)
          };
        }
      }
    ],
    stil: [
      ".pl-griff { position: absolute; top: 0; bottom: 0; width: 5px; cursor: ew-resize; touch-action: none; }",
      ".pl-griff-start { left: 0; } .pl-griff-ende { right: 0; }",
      ".pl-griff:hover { background: rgba(255,255,255,.4); }",
      ".pl-balken.pl-gezogen { z-index: 5; box-shadow: 0 0 0 1px var(--gold); }"
    ].join("\n")
  });
})();
