/* Plugin: Fährt die Maus über einen Balken im Tagesplan, zeigt ein kleines Overlay den Flug mit
   seiner besten Zeit (On-Block, sonst Touchdown, sonst ETA), den Mitarbeiter, den Einsatz und alle
   Konflikte, an denen der Einsatz beteiligt ist. Es enthält alles, was bisher im einfachen Tooltip
   stand, und ersetzt ihn. Reine Darstellung über CSS-Hover, ändert keinen Wert. Die Konflikte
   pflegt der Konfliktzähler; jeder Eintrag trägt den Pfad seines Konflikts. */
(function () {
  function flugVon(h, a) { return h.lies("fluege/" + a.kennung.split("-")[0]); }

  function besteZeit(f) {
    if (!f) return null;
    if (f.onBlock) return "On-Block " + f.onBlock;
    if (f.touchdown) return "Touchdown " + f.touchdown;
    if (f.eta) return "ETA " + f.eta;
    return null;
  }

  function ueberschneidung(h, a, b) {
    var von = Math.max(h.minuten(a.start), h.minuten(b.start));
    var bis = Math.min(h.minuten(a.ende), h.minuten(b.ende));
    return h.zeit(von) + "–" + h.zeit(bis);
  }

  function konfliktText(h, k, a, m) {
    if (k.art === "Überlappung") {
      var andere = h.lies("auftraege/" + (k.auftrag === a.kennung ? k.mit : k.auftrag));
      return andere ? "mit " + andere.flug + " " + andere.arbeit + ", " + ueberschneidung(h, a, andere) : "";
    }
    if (k.art === "Kapazitätslücke") return "niemand Passendes ist frei";
    if (k.art === "Qualifikation fehlt") return m ? m.name + " hat keine Qualifikation für " + a.arbeit : "";
    if (!m) return "";
    if (m.abwesend) return m.grund ? m.grund + (m.abwesendAb ? " ab " + m.abwesendAb : "") : "abwesend";
    return "Schicht " + m.schichtStart + "–" + m.schichtEnde;
  }

  function overlay(h, a, klassen) {
    var f = flugVon(h, a);
    var m = a.mitarbeiter ? h.lies("mitarbeiter/" + a.mitarbeiter) : null;
    var zeit = besteZeit(f);
    var flugzeile = f
      ? '<div class="pl-tipzeile">' + h.esc([zeit, f.offBlock ? "Off-Block " + f.offBlock : null].filter(Boolean).join(" · ")) + "</div>"
      : "";
    var kopf = "<b>" + h.esc(a.flug) + "</b>" +
      (f ? ' <small>' + h.esc([f.muster, f.position].filter(Boolean).join(" · ")) + "</small>" : "");
    var konflikte = (h.lies("kennzahlen/konflikte/liste") || []).filter(function (k) {
      return k.auftrag === a.kennung || k.mit === a.kennung;
    }).map(function (k) {
      var text = konfliktText(h, k, a, m);
      return '<div class="pl-tipkonflikt" data-pfad="' + h.esc(k.pfad) + '"><b>' + h.esc(k.art) + "</b>" +
        (text ? " " + h.esc(text) : "") + "</div>";
    }).join("");
    return '<div class="pl-tip' + klassen + '">' +
      '<div class="pl-tipkopf">' + kopf + "</div>" + flugzeile +
      '<div class="pl-tipzeile">' + (m ? "<b>" + h.esc(m.name) + "</b> <small>" + h.esc(m.kennung) + "</small>" : "ohne Mitarbeiter") + "</div>" +
      '<div class="pl-tipzeile">' + h.esc(a.arbeit + " · " + a.start + "–" + a.ende) + "</div>" +
      '<div class="pl-tipzeile pl-tipdim">Auftrag ' + h.esc(a.kennung) + "</div>" +
      (konflikte ? '<div class="pl-tipkonflikte">' + konflikte + "</div>" : "") +
      "</div>";
  }

  Huelle.plugin({
    kennung: "balken-overlay",
    titel: "Einsatz-Details beim Überfahren",
    ergaenzt: {
      gantt: {
        neuBei: ["kennzahlen/konflikte.geaendert", "fluege/*.geaendert"],
        zeichne: function (el, h) {
          var rahmen = el.querySelector(".pl-rahmen");
          var von = rahmen ? Number(rahmen.dataset.von) : 0, bis = rahmen ? Number(rahmen.dataset.bis) : 1;
          var zeilen = el.querySelectorAll(".pl-zeile");
          Array.prototype.forEach.call(zeilen, function (zeile, i) {
            var oben = zeilen.length > 4 && i >= zeilen.length / 2;
            zeile.querySelectorAll(".pl-bahn .pl-balken").forEach(function (b) {
              var a = h.lies(b.dataset.pfad);
              if (!a) return;
              var rechts = bis > von && (h.minuten(a.start) - von) / (bis - von) > 0.6;
              b.removeAttribute("title");
              b.insertAdjacentHTML("beforeend", overlay(h, a, (oben ? " pl-tip-oben" : "") + (rechts ? " pl-tip-rechts" : "")));
            });
          });
        }
      }
    },
    stil: [
      ".pl-balken > span { display: block; overflow: hidden; }",
      ".pl-balken:hover { overflow: visible; z-index: 8; }",
      ".pl-tip { display: none; position: absolute; left: 0; top: calc(100% + 4px); min-width: 220px; max-width: 320px; padding: 7px 9px; border: 1px solid var(--kante); border-radius: 8px; background: #0c2d38; color: var(--text); font-size: 12px; line-height: 1.35; white-space: normal; pointer-events: none; box-shadow: 0 6px 18px rgba(0,0,0,.55); }",
      ".pl-balken:hover .pl-tip { display: block; }",
      ".pl-balken.pl-gezogen .pl-tip { display: none; }",
      ".pl-tip.pl-tip-oben { top: auto; bottom: calc(100% + 4px); }",
      ".pl-tip.pl-tip-rechts { left: auto; right: 0; }",
      ".pl-tipkopf { font-size: 13px; margin-bottom: 2px; } .pl-tipkopf b { font-weight: 600; }",
      ".pl-tip small, .pl-tipdim { color: var(--dim); font-size: 11px; }",
      ".pl-tipzeile b { font-weight: 600; }",
      ".pl-tipkonflikte { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--kante); }",
      ".pl-tipkonflikt { padding-left: 6px; border-left: 2px solid var(--koralle); margin-bottom: 3px; }",
      ".pl-tipkonflikt b { color: var(--koralle); font-weight: 600; }"
    ].join("\n")
  });
})();
