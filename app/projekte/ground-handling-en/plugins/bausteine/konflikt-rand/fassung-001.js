/* Plugin: Überlappende Balken tragen einen roten Rand.
   Je Überlappung des Auftrags ein Rand, der den Konflikt als Objekt trägt. Sobald der
   Konflikt aus der Liste des Konfliktzählers verschwindet, ist auch der Rand weg. */
Huelle.plugin({
  kennung: "konflikt-rand",
  titel: "Red outline on overlap",
  ergaenzt: {
    gantt: {
      neuBei: ["kennzahlen/konflikte.geaendert"],
      zeichne: function (el, h) {
        (h.lies("kennzahlen/konflikte/liste") || [])
          .filter(function (k) { return k.art === "Overlap"; })
          .forEach(function (k) {
            [k.auftrag, k.mit].forEach(function (id) {
              var b = el.querySelector('.pl-bahn .pl-balken[data-pfad="auftraege/' + id + '"]');
              if (b) b.insertAdjacentHTML("beforeend", '<i class="pl-konfliktrand" data-pfad="' + h.esc(k.pfad) + '"></i>');
            });
          });
        var legende = el.querySelector(".pl-legende");
        if (legende) legende.insertAdjacentHTML("beforeend", '<span><i class="pl-konfliktmuster"></i>Overlap</span>');
      }
    }
  },
  stil: [
    ".pl-legende i.pl-konfliktmuster { box-sizing: border-box; border: 2px solid var(--koralle); }",
    ".pl-konfliktrand { position: absolute; top: 0; right: 0; bottom: 0; left: 0; box-sizing: border-box; border: 2px solid var(--koralle); border-radius: 4px; pointer-events: none; }"
  ].join("\n")
});
