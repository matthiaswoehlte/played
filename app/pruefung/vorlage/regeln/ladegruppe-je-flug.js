/* Regel aus dem Netz: N-66 (Played Flow Tagesdisposition, Fassung 11: R39), Stand gültig.
   Geprüft wird: Alle zugewiesenen Aufträge Entladen und Beladen eines Flugs liegen bei
   Mitarbeitern derselben Gruppe. Unzugewiesene zählen nicht; das ist eine Lücke, kein Mischen. */
Huelle.regel({
  kennung: "ladegruppe-je-flug",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "Entladen und Beladen eines Flugs macht dieselbe Ladegruppe.",
  wortlaut: "Entladen und Beladen desselben Flugs macht immer dieselbe Ladegruppe zu 4 Leuten mit Transportwagen. Das ist fest, keine offene Entscheidung.",
  herkunft: {
    datum: "2026-09-28",
    wie: "vom Refiner formuliert, vom PO geändert und übernommen",
    quelle: "Umfang Fassung 6 des Prototyps der Tagesdisposition",
    netz: "N-66"
  },
  art: "bedingung",
  pruefe: function (h) {
    var LADEN = ["Entladen", "Beladen"];
    var leute = {};
    h.alle("mitarbeiter").forEach(function (m) { leute[m.kennung] = m; });
    function gruppe(a) { return leute[a.mitarbeiter].gruppe; }
    function einmal(liste) { return liste.filter(function (x, i) { return liste.indexOf(x) === i; }); }
    function aufzaehlen(liste) {
      return liste.length < 2 ? liste.join("") : liste.slice(0, -1).join(", ") + " und " + liste[liste.length - 1];
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
        satz: flug + ": " + (gemischt ? arbeiten[0] : "Entladen und Beladen") + " machen " +
          aufzaehlen([haupt].concat(gruppen.slice(1))) + " (" + namen.join(", ") + ")",
        /* für die Erzählzeile beim Vorspielen: „… – ab jetzt macht eine zweite Gruppe mit: …“ */
        ab: (gruppen.length === 2 ? "macht eine zweite Gruppe mit: " : "machen weitere Gruppen mit: ") +
          aufzaehlen(gruppen.slice(1)) + " (" + namen.join(", ") + ")"
      });
    });
    return out;
  }
});
