/* Plugin: Ein Klick auf den Konfliktzähler klappt die Liste der Konflikte auf und zu.
   Die Liste pflegt der Konfliktzähler; hier steht nur, wie sie aussieht und ob sie offen ist. */
(function () {
  function nameVon(h, a) {
    var m = a.mitarbeiter ? h.lies("mitarbeiter/" + a.mitarbeiter) : null;
    return m ? m.name : "";
  }

  /* Ein Eintrag: Art, Wer und Was, darunter die Zeit */
  function eintrag(h, k) {
    var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
    var zeit = a.start + "–" + a.ende;
    if (b) {
      var von = Math.max(h.minuten(a.start), h.minuten(b.start)) === h.minuten(a.start) ? a.start : b.start;
      var bis = Math.min(h.minuten(a.ende), h.minuten(b.ende)) === h.minuten(a.ende) ? a.ende : b.ende;
      zeit = von + "–" + bis;
    }
    var wer = nameVon(h, a);
    var was = a.flug + " " + a.arbeit + (b ? " und " + b.flug + " " + b.arbeit : "");
    return '<div class="pl-konflikt" data-pfad="' + h.esc(k.pfad) + '">' +
      '<div class="pl-konfliktkopf"><b>' + h.esc(k.art) + "</b>" + (wer ? " " + h.esc(wer) : "") + "</div>" +
      "<div>" + h.esc(was) + "</div>" +
      '<div class="pl-konfliktzeit">' + h.esc(zeit) + "</div></div>";
  }

  function nachBeginn(h, liste) {
    return liste.slice().sort(function (x, y) {
      return h.minuten(h.lies("auftraege/" + x.auftrag).start) - h.minuten(h.lies("auftraege/" + y.auftrag).start);
    });
  }

  Huelle.plugin({
    kennung: "konflikt-liste",
    titel: "Liste der Konflikte",
    besitzt: ["kennzahlen/konflikte/offen"],
    beimStart: function (h) {
      h.setze("kennzahlen/konflikte/offen", false);
    },
    abonniert: {
      "kennzahlen/konflikte.anzeigen": function (m, h) {
        h.setze("kennzahlen/konflikte/offen", m.parameter.offen);
      }
    },
    ergaenzt: {
      konfliktzaehler: {
        neuBei: ["kennzahlen/konflikte.geaendert", "auftraege/*.geaendert"],
        zeichne: function (el, h) {
          var offen = h.lies("kennzahlen/konflikte/offen");
          var text = el.querySelector(".pl-zahltext");
          if (text) text.textContent += " " + (offen ? "▾" : "▸");
          if (!offen) return;
          var eintraege = nachBeginn(h, h.lies("kennzahlen/konflikte/liste") || [])
            .map(function (k) { return eintrag(h, k); }).join("");
          el.insertAdjacentHTML("beforeend", '<div class="pl-konfliktliste" data-rollen="konflikte">' +
            (eintraege || '<div class="pl-leer">Keine Konflikte.</div>') + "</div>");
        }
      }
    },
    bedienungen: [
      {
        kennung: "konfliktliste",
        titel: "Konfliktliste auf- und zuklappen",
        sicht: "konfliktzaehler",
        art: "klicken",
        fasst: ".pl-zaehler",
        ereignis: function (g, h) {
          var offen = !h.lies("kennzahlen/konflikte/offen");
          return {
            objekt: g.pfad, aktion: "anzeigen",
            parameter: { offen: offen },
            erzaehlung: "Disponent klappt die Konfliktliste " + (offen ? "auf" : "zu")
          };
        }
      }
    ],
    beschreibe: {
      "kennzahlen/konflikte/offen": function (u) {
        return "Die Konfliktliste ist jetzt " + (u.neu ? "aufgeklappt" : "zugeklappt");
      }
    },
    stil: [
      ".pl-zaehler { cursor: pointer; user-select: none; }",
      ".pl-konfliktliste { margin-top: 8px; max-height: 34vh; overflow-y: auto; }",
      ".pl-konflikt { padding: 6px 9px; margin-bottom: 6px; border: 1px solid var(--kante); border-left: 3px solid var(--koralle); border-radius: 6px; background: var(--glas); color: var(--text); font-size: 12.5px; line-height: 1.3; user-select: none; }",
      ".pl-konfliktkopf b { font-weight: 600; color: var(--koralle); }",
      ".pl-konfliktzeit { color: var(--dim); font-size: 12px; }"
    ].join("\n")
  });
})();
