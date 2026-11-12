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
      titel: "Auf Mitarbeiter ohne passende Qualifikation ziehen",
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
          erzaehlung: "Disponent zieht " + a.flug + " " + a.arbeit + " auf " + m.name,
          hinweis: "Geht, aber ohne passende Qualifikation: Konflikt"
        };
      }
    };
  }

  Huelle.plugin({
    kennung: "verhalten-einsatz",
    titel: "Einsatz ändern",
    prueft: {
      "auftraege/*.umplanen": function (m, h) {
        var a = h.lies(m.objekt), neu = h.lies("mitarbeiter/" + m.parameter.mitarbeiter);
        if (!a || !neu) return "Diesen Auftrag oder Mitarbeiter gibt es nicht";
        /* Ohne passende Qualifikation wird trotzdem zugewiesen; der Konfliktzähler meldet „Qualifikation fehlt“. */
        return null;
      },
      "auftraege/*.zeitaendern": function (m, h) {
        if (neueDauer(m, h) >= KUERZESTE) return null;
        return "Ein Auftrag dauert mindestens " + KUERZESTE + " Minuten";
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
      ohneQualifikation("balken-ohne-qualifikation", "gantt", ".pl-balken", "Auf einen Mitarbeiter ziehen"),
      ohneQualifikation("offen-ohne-qualifikation", "nicht-zugewiesen", ".pl-offen", "Auf einen Mitarbeiter im Tagesplan ziehen")
    ]
  });
})();
