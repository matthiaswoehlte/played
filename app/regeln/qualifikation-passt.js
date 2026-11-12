/* Regel aus dem Netz: N-132 (Played Flow Tagesdisposition, Fassung 5: R106), Stand gültig, vom PO bestätigt am 30.09.2026.
   Bis 07.11.2026 stand hier N-54 („nur mit passender Qualifikation“). Der PO hat entschieden:
   „N-132 ist richtig.“ Eine Zuweisung ohne Qualifikation ist erlaubt und ein Konflikt, kein Verbot
   (Docs/design-log/2026-11-07-entscheidungen-n111-n132.md). Die Kennung bleibt, damit die Regel
   dieselbe bleibt; nur Satz, Wortlaut und Herkunft sind neu.
   Geprüft wird nach N-132 (Entscheidung des PO vom 07.11., Rückfrage zu Stufe 2 von 006): Liegt ein
   Auftrag bei jemandem ohne die Qualifikation, die wie die Arbeit heißt, muss der Konflikt
   „Qualifikation fehlt“ für ihn in der Konfliktliste stehen. Der Fall selbst ist erlaubt und als
   Konflikt sichtbar; gemeldet wird nur, wenn der Konflikt fehlt. Dass „Einsatz ändern“ das
   Umplanen ohne Qualifikation heute verweigert, korrigiert der PO selbst in der App. */
Huelle.regel({
  kennung: "qualifikation-passt",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "Ein Auftrag bei einem Mitarbeiter ohne die nötige Qualifikation bleibt zugewiesen und ist der Konflikt „Qualifikation fehlt“.",
  wortlaut: "Lasse ich den Balken trotzdem bei einem Mitarbeiter ohne Qualifikation fallen, wird zugewiesen und ein neuer Konflikt „Qualifikation fehlt“ entsteht in der Konfliktliste.",
  herkunft: {
    datum: "2026-09-27",
    wie: "aus dem Umfang des Prototyps übernommen, vom PO im Chat bestätigt am 30.09.2026",
    quelle: "Umfang Fassung 2 des Prototyps der Tagesdisposition",
    netz: "N-132"
  },
  art: "bedingung",
  pruefe: function (h) {
    var leute = {}, alsKonflikt = {};
    h.alle("mitarbeiter").forEach(function (m) { leute[m.kennung] = m; });
    (h.lies("kennzahlen/konflikte/liste") || []).forEach(function (k) {
      if (k.art === "Qualifikation fehlt") alsKonflikt[k.auftrag] = true;
    });
    return h.alle("auftraege").filter(function (a) {
      var m = a.mitarbeiter ? leute[a.mitarbeiter] : null;
      return m && m.qualifikationen.indexOf(a.arbeit) === -1 && !alsKonflikt[a.kennung];
    }).map(function (a) {
      return {
        pfade: ["auftraege/" + a.kennung],
        satz: a.flug + " " + a.arbeit + ": " + leute[a.mitarbeiter].name + " hat keine Qualifikation für " + a.arbeit +
          ", und in der Konfliktliste fehlt „Qualifikation fehlt“"
      };
    });
  }
});
