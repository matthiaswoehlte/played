/* Regel aus dem Netz: N-125 (Played Flow Tagesdisposition, Fassung 11: R100), Stand gültig.
   Auch als Prüfung vor dem Zustellen da: „Einsatz ändern“ verweigert eine Zeitänderung unter
   5 Minuten. Nicht zusammengelegt; der Wächter meldet, was trotzdem durchkommt. */
Huelle.regel({
  kennung: "mindestdauer",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "A task is at least 5 minutes long.",
  wortlaut: "The same rules apply as for dragging, including that a task is at least 5 minutes long.",
  herkunft: {
    datum: "2026-09-30",
    wie: "worded by Claude, taken over by the PO in the chat",
    quelle: "Scope of version 10 of the Daily Dispatch prototype",
    netz: "N-125"
  },
  art: "bedingung",
  pruefe: function (h) {
    var KUERZESTE = 5;
    return h.alle("auftraege").filter(function (a) {
      return h.minuten(a.ende) - h.minuten(a.start) < KUERZESTE;
    }).map(function (a) {
      var dauer = h.minuten(a.ende) - h.minuten(a.start);
      return {
        pfade: ["auftraege/" + a.kennung],
        satz: a.flug + " " + a.arbeit + " lasts only " + dauer + (dauer === 1 ? " minute" : " minutes")
      };
    });
  }
});
