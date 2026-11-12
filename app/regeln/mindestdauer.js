/* Regel aus dem Netz: N-125 (Played Flow Tagesdisposition, Fassung 11: R100), Stand gültig.
   Auch als Prüfung vor dem Zustellen da: „Einsatz ändern“ verweigert eine Zeitänderung unter
   5 Minuten. Nicht zusammengelegt; der Wächter meldet, was trotzdem durchkommt. */
Huelle.regel({
  kennung: "mindestdauer",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "Ein Auftrag ist mindestens 5 Minuten lang.",
  wortlaut: "Es gelten dieselben Regeln wie beim Ziehen, auch dass ein Auftrag mindestens 5 Minuten lang ist.",
  herkunft: {
    datum: "2026-09-30",
    wie: "von Claude formuliert, vom PO im Chat übernommen",
    quelle: "Umfang Fassung 10 des Prototyps der Tagesdisposition",
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
        satz: a.flug + " " + a.arbeit + " dauert nur " + dauer + (dauer === 1 ? " Minute" : " Minuten")
      };
    });
  }
});
