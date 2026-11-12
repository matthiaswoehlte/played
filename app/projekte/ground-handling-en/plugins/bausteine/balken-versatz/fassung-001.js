/* Plugin: Sich überschneidende Balken liegen versetzt und decken sich um ein Drittel ihrer Höhe.
   Die Spur jedes Balkens legt der Tagesplan fest; hier steht nur, wie eng die Spuren liegen.
   Die höhere Spur liegt obenauf. */
(function () {
  var HOEHE = 18;     // Höhe eines Balkens in px
  var VERSATZ = 12;   // Abstand der Spuren in px: zwei Drittel der Höhe, ein Drittel deckt sich
  var LUFT = 6;       // Abstand über und unter den Balken einer Zeile zusammen in px

  function spur(b) { return Number(b.dataset.spur); }

  function bedeckt(h, x, alle) {
    var a = h.lies(x.dataset.pfad);
    return alle.some(function (y) {
      var b = h.lies(y.dataset.pfad);
      return spur(y) === spur(x) + 1 &&
        h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende);
    });
  }

  Huelle.plugin({
    kennung: "balken-versatz",
    titel: "Show overlapping bars offset",
    ergaenzt: {
      gantt: {
        zeichne: function (el, h) {
          el.querySelectorAll(".pl-bahn").forEach(function (bahn) {
            var balken = Array.prototype.slice.call(bahn.querySelectorAll(".pl-balken"));
            balken.sort(function (x, y) { return spur(x) - spur(y); });
            balken.forEach(function (b) {
              b.style.top = spur(b) * VERSATZ + 2 + "px";
              if (spur(b) > 0) b.classList.add("pl-obenauf");
              if (bedeckt(h, b, balken)) b.classList.add("pl-bedeckt");
              bahn.appendChild(b);
            });
            var oberste = balken.length ? spur(balken[balken.length - 1]) : 0;
            bahn.style.height = oberste * VERSATZ + HOEHE + LUFT + "px";
          });
        }
      }
    },
    stil: [
      ".pl-balken.pl-bedeckt { line-height: " + VERSATZ + "px; }",
      ".pl-balken.pl-obenauf { box-shadow: 0 -1px 3px rgba(0,0,0,.5); }"
    ].join("\n")
  });
})();
