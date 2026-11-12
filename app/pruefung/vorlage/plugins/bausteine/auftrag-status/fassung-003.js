/* Plugin: Jeder Auftrag hat einen Status: Offen, Begonnen oder Fertig.
   Fassung 3 (Auftrag 005, Stufe 2): Den Status führt jetzt Play nach dem Datenmodell (daten/tag.js),
   auch den Status zu Tagesbeginn nach der Uhrzeit aus deinem Wunsch. Dieses Plugin zeigt ihn: Am Balken
   sitzt ein kleines Status-Zeichen; ein Klick darauf öffnet ein Menü mit den drei Status, ein Klick auf
   einen Status schickt den Befehl, Play setzt ihn, wenn der Übergang erlaubt ist. Was von hier aus nicht
   erlaubt ist, steht im Menü grau. Der Status steht auch im Overlay beim Überfahren. Welches Menü offen
   ist, steht unter kennzahlen/statusmenue. */
(function () {
  var NAMEN = { offen: "Offen", begonnen: "Begonnen", fertig: "Fertig" };
  var REIHE = ["offen", "begonnen", "fertig"];
  var MENUE = "kennzahlen/statusmenue";

  function statusVon(a) { return NAMEN[a.status] ? a.status : "offen"; }

  Huelle.plugin({
    kennung: "auftrag-status",
    titel: "Auftragsstatus",
    besitzt: ["kennzahlen/statusmenue/auftrag"],
    beimStart: function (h) {
      h.setze(MENUE + "/auftrag", null);
    },
    abonniert: {
      "kennzahlen/statusmenue.anzeigen": function (m, h) {
        h.setze(MENUE + "/auftrag", m.parameter.auftrag);
      },
      /* Nach der Wahl geht das Menü zu, gleich ob Play den Status gesetzt oder verweigert hat. */
      "auftraege/*.geaendert": function (m, h) {
        if (m.parameter.feld === "status" && h.lies(MENUE + "/auftrag") === m.objekt.split("/")[1]) {
          h.sende({ objekt: MENUE, aktion: "anzeigen", parameter: { auftrag: null }, erzaehlung: null });
        }
      },
      "auftraege/*.verweigert": function (m, h) {
        if (m.parameter.aktion === "status" && h.lies(MENUE + "/auftrag") === m.objekt.split("/")[1]) {
          h.sende({ objekt: MENUE, aktion: "anzeigen", parameter: { auftrag: null }, erzaehlung: null });
        }
      }
    },
    ergaenzt: {
      gantt: {
        neuBei: ["kennzahlen/statusmenue.geaendert"],
        zeichne: function (el, h) {
          var offenBei = h.lies(MENUE + "/auftrag");
          var zeilen = el.querySelectorAll(".pl-zeile");
          Array.prototype.forEach.call(zeilen, function (zeile, i) {
            var oben = zeilen.length > 4 && i >= zeilen.length / 2;
            zeile.querySelectorAll(".pl-bahn .pl-balken").forEach(function (b) {
              var a = h.lies(b.dataset.pfad);
              if (!a) return;
              var s = statusVon(a);
              b.insertAdjacentHTML("beforeend",
                '<i class="pl-statuszeichen pl-status-' + s + '" title="Status: ' + NAMEN[s] + '"></i>');
              var tip = b.querySelector(".pl-tip");
              if (tip) {
                var zeile2 = '<div class="pl-tipzeile">Status: <b>' + NAMEN[s] + "</b></div>";
                var konflikte = tip.querySelector(".pl-tipkonflikte");
                if (konflikte) konflikte.insertAdjacentHTML("beforebegin", zeile2);
                else tip.insertAdjacentHTML("beforeend", zeile2);
              }
              if (offenBei !== a.kennung) return;
              b.classList.add("pl-statusmenue-offen");
              var erlaubt = h.erlaubt("auftraege/" + a.kennung);
              var eintraege = REIHE.map(function (k) {
                var nein = k !== s && erlaubt.indexOf(k) === -1;
                return '<div class="pl-statuswahl' + (k === s ? " pl-statuswahl-aktiv" : "") + (nein ? " pl-statuswahl-nein" : "") +
                  '"' + (nein ? ' title="Von ' + NAMEN[s] + ' geht es nicht auf ' + NAMEN[k] + '"' : "") + ' data-pfad="auftraege/' +
                  h.esc(a.kennung) + '" data-status="' + k + '"><i class="pl-statuspunkt pl-status-' + k + '"></i>' + NAMEN[k] + "</div>";
              }).join("");
              b.insertAdjacentHTML("beforeend", '<div class="pl-statusmenue' + (oben ? " pl-statusmenue-oben" : "") + '">' + eintraege + "</div>");
            });
          });
        }
      }
    },
    bedienungen: [
      {
        kennung: "statusmenue-oeffnen",
        titel: "Status-Menü am Balken öffnen und schließen",
        sicht: "gantt",
        art: "klicken",
        fasst: ".pl-statuszeichen",
        ereignis: function (g, h) {
          var a = h.lies(g.pfad);
          if (!a) return null;
          var offen = h.lies(MENUE + "/auftrag") === a.kennung;
          return {
            objekt: MENUE, aktion: "anzeigen",
            parameter: { auftrag: offen ? null : a.kennung },
            erzaehlung: "Disponent " + (offen ? "schließt" : "öffnet") + " den Status von " + a.flug + " " + a.arbeit
          };
        }
      },
      {
        kennung: "status-setzen",
        titel: "Status eines Auftrags setzen",
        sicht: "gantt",
        art: "klicken",
        fasst: ".pl-statuswahl",
        ereignis: function (g, h) {
          var a = h.lies(g.pfad), s = g.daten.status;
          if (!a || !NAMEN[s]) return null;
          return {
            objekt: g.pfad, aktion: "status",
            parameter: { status: s },
            erzaehlung: "Disponent setzt " + a.flug + " " + a.arbeit + " auf " + NAMEN[s]
          };
        }
      }
    ],
    beschreibe: {
      "kennzahlen/statusmenue/auftrag": function () { return null; }
    },
    stil: [
      ".pl-statuszeichen { position: absolute; right: 6px; top: 4px; width: 9px; height: 9px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid #fff; cursor: pointer; z-index: 2; }",
      ".pl-statuszeichen:hover { box-shadow: 0 0 0 2px var(--gold); }",
      ".pl-status-offen { background: transparent; }",
      ".pl-status-begonnen { background: linear-gradient(90deg, #fff 50%, transparent 50%); }",
      ".pl-status-fertig { background: #fff; }",
      ".pl-balken.pl-statusmenue-offen { overflow: visible; z-index: 9; }",
      ".pl-balken.pl-statusmenue-offen .pl-tip { display: none; }",
      ".pl-statusmenue { position: absolute; right: 0; top: calc(100% + 3px); min-width: 120px; padding: 4px; border: 1px solid var(--kante); border-radius: 8px; background: #0c2d38; box-shadow: 0 6px 18px rgba(0,0,0,.55); z-index: 10; line-height: 1.3; }",
      ".pl-statusmenue.pl-statusmenue-oben { top: auto; bottom: calc(100% + 3px); }",
      ".pl-statuswahl { padding: 4px 8px; border-radius: 5px; color: var(--text); font-size: 12px; cursor: pointer; white-space: nowrap; }",
      ".pl-statuswahl:hover { background: var(--glas); }",
      ".pl-statuswahl.pl-statuswahl-aktiv { color: var(--gold); font-weight: 600; }",
      ".pl-statuswahl.pl-statuswahl-nein { opacity: .45; }",
      ".pl-statuspunkt { display: inline-block; width: 9px; height: 9px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--text); margin-right: 6px; vertical-align: -1px; }",
      ".pl-statuspunkt.pl-status-begonnen { background: linear-gradient(90deg, var(--text) 50%, transparent 50%); }",
      ".pl-statuspunkt.pl-status-fertig { background: var(--text); }"
    ].join("\n")
  });
})();
