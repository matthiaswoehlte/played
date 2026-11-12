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
  satz: "If an agent is absent from a point in time, all their tasks still running after that time are unassigned and stay unassigned.",
  wortlaut: "All tasks still running after that time are unassigned and listed under “Unassigned tasks”",
  herkunft: {
    datum: "2026-09-29",
    wie: "chosen and taken over by the PO with a click (wording of the chosen option from prototype version 7)",
    quelle: "Scope of version 8 of the Daily Dispatch prototype",
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
        satz: a.flug + " " + a.arbeit + " is still with " + m.name + ", absent " +
          (m.abwesendAb === null ? "all day" : "from " + m.abwesendAb)
      };
    });
  }
});
