/* Übersicht: links eine kleine Karte, die zeigt, wo der PO gerade ist. Ein Klick springt dorthin. */
(function () {
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* In welchen Bereichen der PO gerade steht: beim Faden in beiden */
  function bereicheVon(pfad, h) {
    var t = pfad.split("/");
    var ziele = t[0] === "bereiche" ? [t[1]] : (t[0] === "bausteine" || t[0] === "grundfunktionen") ? [h.lies(pfad + "/bereich")] :
      t[0] === "faeden" ? [h.lies(pfad + "/von"), h.lies(pfad + "/nach")] : [];
    var out = [];
    ziele.forEach(function (k) { for (; k; k = h.lies("bereiche/" + k + "/eltern")) out.push(k); });
    return out;
  }

  Huelle.plugin({
    kennung: "uebersicht",
    titel: "Overview",
    bedienungen: [{
      kennung: "springen", titel: "Jump there", art: "klicken", fasst: "[data-pfad]",
      ereignis: function (g) {
        return { objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: g.pfad }, erzaehlung: "Jumps to " + g.daten.name };
      }
    }],
    ansicht: {
      ort: "seite",
      rang: 1,
      neuBei: ["navi/*.geaendert"],
      zeichne: function (el, h) {
        var pfad = h.lies("navi/jetzt/pfad");
        var hier = bereicheVon(pfad, h);
        var kaesten = h.alle("bereiche").map(function (b) {
          var drin = hier.indexOf(b.kennung) !== -1;
          var punkte = "";
          if (drin && pfad.indexOf("bausteine/") === 0) {
            punkte = '<span class="nv-punkte">' + h.alle("bausteine").filter(function (p) { return p.bereich === b.kennung; }).map(function (p) {
              var p2 = "bausteine/" + p.kennung;
              return '<button class="nv-punkt nv-klick' + (p2 === pfad ? " nv-hier" : "") + '" data-pfad="' + p2 + '" data-name="' + esc(p.name) + '" title="' + esc(p.name) + '" aria-label="' + esc(p.name) + '"></button>';
            }).join("") + "</span>";
          }
          return '<div class="nv-minibox nv-b-' + b.baustand + (drin ? " nv-hier" : "") + '" style="margin-left:' + b.tiefe * 12 + 'px"><button class="nv-klick" data-pfad="bereiche/' + b.kennung + '" data-name="' + esc(b.name) + '">' + esc(b.name) + "</button>" + punkte + "</div>";
        }).join("");
        el.innerHTML = '<div class="nv-mini"><button class="nv-gesamt nv-klick' + (pfad === "karte" ? " nv-hier" : "") + '" data-pfad="karte" data-name="the map">Whole map</button>' + kaesten + "</div>";
      }
    }
  });
})();
