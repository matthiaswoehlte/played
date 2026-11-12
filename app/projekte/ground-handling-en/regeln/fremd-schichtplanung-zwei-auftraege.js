/* Beweisregel für den Geltungsbereich, keine Aussage des PO.
   Sie gehört zu einem anderen Played Flow (Schichtplanung) und darf in der Tagesdisposition
   nie geprüft werden. Am gemockten Tag wäre sie oft verletzt: Würde sie geprüft, fiele es auf. */
Huelle.regel({
  kennung: "fremd-schichtplanung-zwei-auftraege",
  pfad: "bodenabfertigung/schichtplanung",
  satz: "An agent has at most two tasks per day.",
  wortlaut: null,
  herkunft: {
    datum: "2026-11-07",
    wie: "Proof rule by Claude Code for order 006, not a statement by the PO",
    quelle: "Docs/dialog/2026-11-07-006-leitplanken.prompt.md",
    netz: null
  },
  art: "bedingung",
  pruefe: function (h) {
    var zahl = {};
    h.alle("auftraege").forEach(function (a) {
      if (a.mitarbeiter) zahl[a.mitarbeiter] = (zahl[a.mitarbeiter] || 0) + 1;
    });
    return Object.keys(zahl).filter(function (k) { return zahl[k] > 2; }).map(function (k) {
      return { pfade: ["mitarbeiter/" + k], satz: k + " has " + zahl[k] + " tasks" };
    });
  }
});
