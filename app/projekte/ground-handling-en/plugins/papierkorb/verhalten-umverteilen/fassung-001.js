/* Plugin Verhalten „Bei Krankmeldung automatisch umverteilen“: Aufträge, die nach dem
   Zeitpunkt noch laufen, gehen an den ersten freien, qualifizierten Mitarbeiter.
   Nur was nicht unterzubringen ist, wird gelöst und geht in die Liste. */
(function () {
  function ueberschneiden(h, a, b) {
    return h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende);
  }
  function verfuegbar(h, m, a) {
    if (m.abwesend && (m.abwesendAb === null || h.minuten(a.ende) > h.minuten(m.abwesendAb))) return false;
    return h.minuten(a.start) >= h.minuten(m.schichtStart) && h.minuten(a.ende) <= h.minuten(m.schichtEnde);
  }

  Huelle.plugin({
    kennung: "verhalten-umverteilen",
    titel: "Reassign automatically on a sick call",
    platz: { kennung: "krankmeldung", titel: "On sick call", variante: "Reassign automatically" },
    abonniert: {
      "mitarbeiter/*.krankmeldung": function (m, h) {
        var id = m.objekt.split("/")[1], ab = m.parameter.ab;
        h.setze(m.objekt + "/abwesend", true);
        h.setze(m.objekt + "/grund", "krank");
        h.setze(m.objekt + "/abwesendAb", ab);

        var auftraege = h.alle("auftraege"), leute = h.alle("mitarbeiter");
        auftraege
          .filter(function (a) { return a.mitarbeiter === id && h.minuten(a.ende) > h.minuten(ab); })
          .forEach(function (a) {
            var ersatz = leute.filter(function (k) {
              if (k.kennung === id || !verfuegbar(h, k, a)) return false;
              if (k.qualifikationen.indexOf(a.arbeit) === -1) return false;
              return !auftraege.some(function (o) {
                return o.kennung !== a.kennung && o.mitarbeiter === k.kennung && ueberschneiden(h, o, a);
              });
            })[0];

            /* Die Auswahl dieser Runde zählt für den nächsten Auftrag schon mit. */
            a.mitarbeiter = ersatz ? ersatz.kennung : null;
            if (ersatz) {
              h.sende({
                objekt: "auftraege/" + a.kennung, aktion: "zuweisen",
                parameter: { mitarbeiter: ersatz.kennung, grund: "krank", vorher: id },
                erzaehlung: "Sick call " + id + " → " + a.flug + " " + a.arbeit + " taken over by " + ersatz.name
              });
            } else {
              h.sende({
                objekt: "auftraege/" + a.kennung, aktion: "loesen",
                parameter: { grund: "krank", mitarbeiter: id },
                erzaehlung: "Sick call " + id + " → " + a.flug + " " + a.arbeit + ": nobody available, now without an agent"
              });
            }
          });
      },
      "auftraege/*.zuweisen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", m.parameter.mitarbeiter);
      },
      "auftraege/*.loesen": function (m, h) {
        h.setze(m.objekt + "/mitarbeiter", null);
      }
    }
  });
})();
