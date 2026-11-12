/* Plugin Verhalten „Krankmeldung ab Zeitpunkt“: Aufträge, die danach noch laufen,
   werden gelöst und liegen danach ohne Mitarbeiter. Wie die letzte Prototyp-Fassung
   mit der Entscheidung „Alle Aufträge, die nach dem Zeitpunkt noch laufen, werden gelöst“. */
Huelle.plugin({
  kennung: "verhalten-krankmeldung",
  titel: "Sick call from a point in time",
  platz: { kennung: "krankmeldung", titel: "On sick call", variante: "Unassign tasks" },
  besitzt: ["mitarbeiter/*/abwesend", "mitarbeiter/*/grund", "mitarbeiter/*/abwesendAb"],
  abonniert: {
    "mitarbeiter/*.krankmeldung": function (m, h) {
      var id = m.objekt.split("/")[1], ab = m.parameter.ab, wer = h.lies(m.objekt + "/name") || id;
      h.setze(m.objekt + "/abwesend", true);
      h.setze(m.objekt + "/grund", "krank");
      h.setze(m.objekt + "/abwesendAb", ab);
      h.alle("auftraege")
        .filter(function (a) { return a.mitarbeiter === id && h.minuten(a.ende) > h.minuten(ab); })
        .forEach(function (a) {
          h.sende({
            objekt: "auftraege/" + a.kennung, aktion: "loesen",
            parameter: { grund: "krank", mitarbeiter: id },
            erzaehlung: "Sick call " + wer + " → " + a.flug + " " + a.arbeit + " now without an agent"
          });
        });
    }
    /* „loesen“ setzt „Einsatz ändern“ um: Der Mitarbeiter eines Auftrags gehört nur ihm (Bus-Vertrag). */
  }
});
