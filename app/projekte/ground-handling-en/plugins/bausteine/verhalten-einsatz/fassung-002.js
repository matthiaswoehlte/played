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

  /* Zug auf einen Mitarbeiter ohne passende Qualifikation: dieselbe Nachricht „umplanen“,
     nur mit dem Hinweis auf den Konflikt. In allen anderen Fällen gibt sie null zurück, dann
     bilden „Balken auf Mitarbeiter ziehen“ und „Auftrag aus der Liste ziehen“ den Zug. */
  function ohneQualifikation(kennung, sicht, fasst, leer) {
    return {
      kennung: kennung,
      titel: "Drag onto an agent without the right qualification",
      sicht: sicht,
      fasst: fasst,
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: leer,
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m || !m.qualifikationen || m.kennung === a.mitarbeiter) return null;
        if (m.qualifikationen.indexOf(a.arbeit) !== -1) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
          hinweis: "Works, but without the right qualification: conflict"
        };
      }
    };
  }

  Huelle.plugin({
    kennung: "verhalten-einsatz",
    titel: "Change assignment",
    prueft: {
      "auftraege/*.umplanen": function (m, h) {
        var a = h.lies(m.objekt), neu = h.lies("mitarbeiter/" + m.parameter.mitarbeiter);
        if (!a || !neu) return "This task or agent does not exist";
        /* Ohne passende Qualifikation wird trotzdem zugewiesen; der Konfliktzähler meldet „Qualifikation fehlt“. */
        return null;
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
      }
    },
    bedienungen: [
      ohneQualifikation("balken-ohne-qualifikation", "gantt", ".pl-balken", "Drag onto an agent"),
      ohneQualifikation("offen-ohne-qualifikation", "nicht-zugewiesen", ".pl-offen", "Drag onto an agent in the daily plan")
    ]
  });
})();
