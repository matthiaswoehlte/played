/* Plugin Verhalten „Einsatz ändern“: entscheidet, ob ein Auftrag umgeplant oder in der Zeit
   geändert werden darf, und setzt es um. Gilt für Drehbuch und Hand gleichermaßen; die
   Prüfung ist dieselbe, die beim Ziehen schon „passt“ oder „passt nicht“ sagt. */
(function () {
  var KUERZESTE = 5;  // kürzeste Dauer eines Auftrags in Minuten

  function neueDauer(m, h) {
    var kante = m.parameter.kante, zeit = m.parameter.zeit;
    var start = kante === "start" ? zeit : h.lies(m.objekt + "/start");
    var ende = kante === "ende" ? zeit : h.lies(m.objekt + "/ende");
    return h.minuten(ende) - h.minuten(start);
  }

  Huelle.plugin({
    kennung: "verhalten-einsatz",
    titel: "Change assignment",
    besitzt: ["auftraege/*/mitarbeiter", "auftraege/*/start", "auftraege/*/ende"],
    prueft: {
      "auftraege/*.umplanen": function (m, h) {
        var a = h.lies(m.objekt), neu = h.lies("mitarbeiter/" + m.parameter.mitarbeiter);
        if (!a || !neu) return "This task or agent does not exist";
        if (neu.qualifikationen.indexOf(a.arbeit) !== -1) return null;
        var grund = neu.name + " has no qualification for " + a.arbeit;
        var bisher = a.mitarbeiter ? h.lies("mitarbeiter/" + a.mitarbeiter) : null;
        return {
          grund: grund,
          erzaehlung: "Assignment refused: " + grund + (bisher ? ", " + a.flug + " stays with " + bisher.name : "")
        };
      },
      "auftraege/*.zeitaendern": function (m, h) {
        if (neueDauer(m, h) >= KUERZESTE) return null;
        return "A task lasts at least " + KUERZESTE + " minutes";
      }
    },
    abonniert: {
      "auftraege/*.umplanen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", m.parameter.mitarbeiter);
      },
      "auftraege/*.zeitaendern": function (m, h) {
        h.setze(m.objekt + "/" + m.parameter.kante, m.parameter.zeit);
      },
      "auftraege/*.verschieben": function (m, h) {
        var min = m.parameter.minuten;
        h.setze(m.objekt + "/start", h.zeit(h.minuten(h.lies(m.objekt + "/start")) + min));
        h.setze(m.objekt + "/ende", h.zeit(h.minuten(h.lies(m.objekt + "/ende")) + min));
      },
      /* Gelöst (z. B. nach Krankmeldung) oder in die Liste zurückgelegt: danach ohne Mitarbeiter.
         Der Mitarbeiter eines Auftrags gehört nur diesem Plugin (Bus-Vertrag). */
      "auftraege/*.loesen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", null);
      },
      "auftraege/*.zuruecklegen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", null);
      }
    }
  });
})();
