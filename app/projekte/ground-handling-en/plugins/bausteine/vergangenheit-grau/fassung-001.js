/* Plugin: In der Zeitleiste über dem Tagesplan ist die vergangene Zeit grau hinterlegt,
   vom Beginn der Achse bis zur aktuellen Uhrzeit. Reine Darstellung, ändert keinen Wert.
   Die Achse liest es aus dem Rahmen des Tagesplans; mit jeder Spielminute wächst das Grau mit,
   ohne dass der Tagesplan neu gezeichnet wird. */
(function () {
  var GRAU = "rgba(150,160,165,.30)";
  var sicht = null;

  function markiere(el, h) {
    if (!el) return;
    var rahmen = el.querySelector(".pl-rahmen"), bahn = el.querySelector(".pl-achsbahn");
    if (!rahmen || !bahn) return;
    var von = Number(rahmen.dataset.von), bis = Number(rahmen.dataset.bis);
    if (!(bis > von)) return;
    var f = (h.minuten(h.uhr()) - von) / (bis - von);
    var p = Math.max(0, Math.min(1, f)) * 100;
    bahn.classList.add("pl-vergangen");
    bahn.style.backgroundImage = "linear-gradient(to right, " + GRAU + " 0, " + GRAU + " " + p + "%, transparent " + p + "%)";
  }

  Huelle.plugin({
    kennung: "vergangenheit-grau",
    titel: "Past time in grey",
    ergaenzt: {
      gantt: {
        zeichne: function (el, h) {
          sicht = el;
          markiere(el, h);
        }
      }
    },
    abonniert: {
      "uhr/tag.tick": function (m, h) {
        markiere(sicht, h);
      }
    },
    stil: ".pl-achsbahn.pl-vergangen { background-repeat: no-repeat; }"
  });
})();
