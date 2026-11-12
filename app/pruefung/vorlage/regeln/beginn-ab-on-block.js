/* Regel aus dem Netz: N-44 (Played Flow Tagesdisposition, Fassung 11: R160), Stand gültig.
   Geprüft wird: Kein Auftrag beginnt vor dem On-Block seines Flugs, gleich ob zugewiesen.
   Der Flug eines Auftrags ist der mit derselben Flugnummer im Flugplan (so verknüpfen die Daten). */
Huelle.regel({
  kennung: "beginn-ab-on-block",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "Eine Arbeit an einem Flug beginnt frühestens bei On-Block.",
  wortlaut: "Der Flieger muss von den Flugdaten her gelandet und on-block sein.",
  herkunft: {
    datum: "2026-09-27",
    wie: "Wortlaut des PO",
    quelle: "Ausgangsaussage, Auftrag des PO an Claude Code",
    netz: "N-44"
  },
  art: "bedingung",
  pruefe: function (h) {
    var onBlock = {};
    h.alle("fluege").forEach(function (f) { onBlock[f.flug] = f.onBlock; });
    return h.alle("auftraege").filter(function (a) {
      return onBlock[a.flug] && h.minuten(a.start) < h.minuten(onBlock[a.flug]);
    }).map(function (a) {
      return {
        pfade: ["auftraege/" + a.kennung],
        satz: a.flug + " " + a.arbeit + " beginnt um " + a.start + ", On-Block ist erst um " + onBlock[a.flug]
      };
    });
  }
});
