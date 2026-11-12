/* Zeigt die Einträge; „erledigen“ hakt einen ab. */
Huelle.plugin({
  kennung: "liste",
  titel: "Liste",
  besitzt: ["eintraege"],
  abonniert: {
    "eintraege.erledigen": function (m, h) { h.setze(m.objekt + "/erledigt", true); }
  },
  ansicht: {
    ort: "haupt",
    rang: 1,
    neuBei: ["eintraege.geaendert"],
    zeichne: function (el, h) {
      el.innerHTML = '<ul class="pl-probe">' + h.alle("eintraege").map(function (e) {
        return '<li data-pfad="eintraege/' + e.kennung + '">' + (e.erledigt ? "✓ " : "") + e.text + "</li>";
      }).join("") + "</ul>";
    }
  }
});
