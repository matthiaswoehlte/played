/* Regel aus dem Netz: N-111 (Played Flow Tagesdisposition), Stand gültig.
   Übernommen am 07.11.2026 auf Entscheidung des PO („N-111 gilt“), zugleich wanderte die Variante
   „Automatisch umverteilen“ in den Papierkorb (Docs/design-log/2026-11-07-entscheidungen-n111-n132.md).
   Geprüft wird, was sich am Zustand feststellen lässt: Kein Auftrag, der nach dem Beginn der
   Abwesenheit noch läuft, liegt bei dem abwesenden Mitarbeiter. Ohne Zeitpunkt (abwesendAb leer)
   gilt die Abwesenheit den ganzen Tag. Ob ein gelöster Auftrag danach von selbst an jemand anderen
   ging, steht nicht im Zustand; das zeigt diese Bedingung nicht. */
Huelle.regel({
  kennung: "abwesend-auftraege-geloest",
  pfad: "bodenabfertigung/tagesdisposition",
  satz: "Ist ein Mitarbeiter ab einem Zeitpunkt abwesend, werden alle seine Aufträge, die nach dem Zeitpunkt noch laufen, gelöst und bleiben unzugewiesen.",
  wortlaut: "Alle Aufträge, die nach dem Zeitpunkt noch laufen, werden gelöst und liegen unzugewiesen unter „Nicht zugewiesene Aufträge“",
  herkunft: {
    datum: "2026-09-29",
    wie: "vom PO per Klick gewählt und übernommen (Wortlaut der gewählten Option aus Prototyp-Fassung 7)",
    quelle: "Umfang Fassung 8 des Prototyps der Tagesdisposition",
    netz: "N-111"
  },
  art: "bedingung",
  pruefe: function (h) {
    var leute = {};
    h.alle("mitarbeiter").forEach(function (m) { leute[m.kennung] = m; });
    return h.alle("auftraege").filter(function (a) {
      var m = a.mitarbeiter ? leute[a.mitarbeiter] : null;
      if (!m || !m.abwesend) return false;
      return m.abwesendAb === null || h.minuten(a.ende) > h.minuten(m.abwesendAb);
    }).map(function (a) {
      var m = leute[a.mitarbeiter];
      return {
        pfade: ["auftraege/" + a.kennung, "mitarbeiter/" + m.kennung],
        satz: a.flug + " " + a.arbeit + " liegt noch bei " + m.name + ", abwesend " +
          (m.abwesendAb === null ? "den ganzen Tag" : "ab " + m.abwesendAb)
      };
    });
  }
});
