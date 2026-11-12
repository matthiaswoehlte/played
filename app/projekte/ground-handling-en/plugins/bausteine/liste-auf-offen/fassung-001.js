/* Plugin: Was unter „Nicht zugewiesene Aufträge“ landet, geht auf Offen, auch wenn es schon
   Begonnen oder Fertig war. Der Disponent darf das überstimmen; dabei wird nichts verweigert.
   Es zählt allein, dass der Auftrag keinen Mitarbeiter mehr hat, gleich ob zurückgelegt oder
   durch eine Krankmeldung gelöst. Den Status setzt Play auf den Befehl hin. */
Huelle.plugin({
  kennung: "liste-auf-offen",
  titel: "Back to Open from the list",
  abonniert: {
    "auftraege/*.geaendert": function (m, h) {
      if (m.parameter.feld !== "mitarbeiter" || m.parameter.neu) return;
      var a = h.lies(m.objekt);
      if (!a || a.status === "offen") return;
      h.sende({
        objekt: m.objekt, aktion: "status",
        parameter: { status: "offen" },
        erzaehlung: a.flug + " " + a.arbeit + " is back to Open with no agent"
      });
    }
  }
});
