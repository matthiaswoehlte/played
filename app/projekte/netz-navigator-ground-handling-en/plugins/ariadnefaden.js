/* Ariadnefaden: Der Weg, den der PO gegangen ist, bleibt als leuchtender Faden sichtbar. Ein Klick auf eine Stelle
   bringt ihn dorthin zurück; der Weg bleibt dabei stehen, die Stelle wird nur als „hier“ markiert. */
(function () {
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function name(pfad, h) {
    if (pfad === "karte") return "Map";
    if (pfad.indexOf("faeden/") === 0) return h.lies("bereiche/" + h.lies(pfad + "/von") + "/name") + " and " + h.lies("bereiche/" + h.lies(pfad + "/nach") + "/name");
    return h.lies(pfad + "/name");
  }

  Huelle.plugin({
    kennung: "ariadnefaden",
    titel: "Ariadne's thread",
    besitzt: ["navi/faden/stationen", "navi/faden/hier"],
    abonniert: {
      "navi/jetzt.geaendert": function (m, h) {
        var ziel = h.lies("navi/jetzt/pfad");
        var weg = h.lies("navi/faden/stationen").slice();
        var i = weg.indexOf(ziel);
        if (i === -1) { weg.push(ziel); i = weg.length - 1; h.setze("navi/faden/stationen", weg); }
        h.setze("navi/faden/hier", i);
      }
    },
    bedienungen: [{
      kennung: "zurueck", titel: "Back to this point", art: "klicken", fasst: "[data-pfad]",
      ereignis: function (g) {
        return { objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: g.pfad }, erzaehlung: "Goes back to " + g.daten.name };
      }
    }],
    ansicht: {
      ort: "haupt",
      rang: 1,
      neuBei: ["navi/*.geaendert"],
      zeichne: function (el, h) {
        var hier = h.lies("navi/faden/hier");
        el.innerHTML = '<nav class="nv-faden">' + h.lies("navi/faden/stationen").map(function (p, i) {
          var n = name(p, h);
          return '<button class="nv-station nv-klick' + (i === hier ? " nv-hier" : "") + '" data-pfad="' + esc(p) + '" data-name="' + esc(n) + '">' + esc(n) + "</button>";
        }).join('<span class="nv-strang"></span>') + "</nav>";
      }
    }
  });
})();
