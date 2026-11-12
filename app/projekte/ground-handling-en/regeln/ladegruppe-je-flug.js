/* Regel aus dem Netz: N-66 (Played Flow Tagesdisposition, Fassung 11: R39), Stand gültig.
   Geprüft wird: Alle zugewiesenen Aufträge Entladen und Beladen eines Flugs liegen bei
   Mitarbeitern derselben Gruppe. Unzugewiesene zählen nicht; das ist eine Lücke, kein Mischen. */
Huelle.regel({
  kennung: "ladegruppe-je-flug",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "The same ramp team does unloading and loading of a flight.",
  wortlaut: "Unloading and loading of the same flight is always done by the same ramp team of 4 people with transport carts. This is fixed, not an open decision.",
  herkunft: {
    datum: "2026-09-28",
    wie: "worded by the Refiner, changed and taken over by the PO",
    quelle: "Scope of version 6 of the Daily Dispatch prototype",
    netz: "N-66"
  },
  art: "bedingung",
  pruefe: function (h) {
    var LADEN = ["Unloading", "Loading"];
    var leute = {};
    h.alle("mitarbeiter").forEach(function (m) { leute[m.kennung] = m; });
    function gruppe(a) { return leute[a.mitarbeiter].gruppe; }
    function einmal(liste) { return liste.filter(function (x, i) { return liste.indexOf(x) === i; }); }
    function aufzaehlen(liste) {
      return liste.length < 2 ? liste.join("") : liste.slice(0, -1).join(", ") + " and " + liste[liste.length - 1];
    }

    var jeFlug = {};
    h.alle("auftraege").forEach(function (a) {
      if (LADEN.indexOf(a.arbeit) === -1 || !a.mitarbeiter || !leute[a.mitarbeiter]) return;
      (jeFlug[a.flug] = jeFlug[a.flug] || []).push(a);
    });

    var out = [];
    Object.keys(jeFlug).sort().forEach(function (flug) {
      var liste = jeFlug[flug], zahl = {};
      liste.forEach(function (a) { zahl[gruppe(a)] = (zahl[gruppe(a)] || 0) + 1; });
      var gruppen = Object.keys(zahl);
      if (gruppen.length < 2) return;
      /* Die Gruppe mit den meisten Aufträgen ist die des Flugs; die anderen weichen ab. */
      gruppen.sort(function (x, y) { return zahl[y] - zahl[x] || (x < y ? -1 : 1); });
      var haupt = gruppen[0];
      var abweichend = liste.filter(function (a) { return gruppe(a) !== haupt; });
      var arbeiten = einmal(abweichend.map(function (a) { return a.arbeit; }));
      var gemischt = arbeiten.length === 1 && liste.some(function (a) { return a.arbeit === arbeiten[0] && gruppe(a) === haupt; });
      var betroffen = gemischt ? liste.filter(function (a) { return a.arbeit === arbeiten[0]; }) : liste;
      var namen = einmal(abweichend.map(function (a) { return leute[a.mitarbeiter].name; }));
      out.push({
        pfade: abweichend.concat(betroffen.filter(function (a) { return abweichend.indexOf(a) === -1; }))
          .map(function (a) { return "auftraege/" + a.kennung; }),
        satz: flug + ": " + (gemischt ? arbeiten[0] + " is done by " : "Unloading and loading are done by ") +
          aufzaehlen([haupt].concat(gruppen.slice(1))) + " (" + namen.join(", ") + ")",
        /* für die Erzählzeile beim Vorspielen: „… – ab jetzt macht eine zweite Gruppe mit: …“ */
        ab: (gruppen.length === 2 ? "a second team is also working: " : "further teams are also working: ") +
          aufzaehlen(gruppen.slice(1)) + " (" + namen.join(", ") + ")"
      });
    });
    return out;
  }
});
