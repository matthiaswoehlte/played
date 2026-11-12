/* Plugin Liste „Nicht zugewiesene Aufträge“.
   Ein Auftrag aus der Liste lässt sich auf eine Mitarbeiterzeile im Tagesplan ziehen. Das ist
   dieselbe Nachricht „umplanen“ wie beim Ziehen eines Balkens: Ob es erlaubt ist und was es
   bewirkt, steht im Verhalten „Einsatz ändern“. Die Ablageorte liegen in der Ansicht Gantt. */
Huelle.plugin({
  kennung: "nicht-zugewiesen",
  titel: "Unassigned tasks",
  ansicht: {
    ort: "seite",
    rang: 2,
    neuBei: ["auftraege/*.geaendert", "kennzahlen/konflikte.geaendert"],
    zeichne: function (el, h) {
      var offen = h.alle("auftraege")
        .filter(function (a) { return !a.mitarbeiter; })
        .sort(function (a, b) { return h.minuten(a.start) - h.minuten(b.start); });
      var luecken = (h.lies("kennzahlen/konflikte/liste") || [])
        .filter(function (k) { return k.art === "Capacity gap"; })
        .map(function (k) { return k.auftrag; });

      var zeilen = offen.map(function (a) {
        var niemand = luecken.indexOf(a.kennung) !== -1
          ? '<span class="pl-niemand">nobody available</span>' : "";
        return '<div class="pl-offen" data-pfad="auftraege/' + h.esc(a.kennung) + '" title="Task ' + h.esc(a.kennung) + '">' +
          "<b>" + h.esc(a.flug) + "</b> " + h.esc(a.arbeit) + niemand +
          '<div class="pl-offenzeit">' + h.esc(a.start) + "–" + h.esc(a.ende) + "</div></div>";
      }).join("");

      el.innerHTML = "<h2>Unassigned tasks <span class=\"pl-anzahl\">" + offen.length + "</span></h2>" +
        (zeilen || '<div class="pl-leer">All tasks are assigned.</div>');
    }
  },
  bedienungen: [
    {
      kennung: "offen-auf-zeile",
      titel: "Drag task onto an agent",
      fasst: ".pl-offen",
      ziel: ".pl-zeile",
      rollt: ".pl-rahmen",
      leer: "Drag onto an agent in the daily plan",
      ereignis: function (g, h) {
        if (!g.ziel) return null;
        var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
        if (!a || !m) return null;
        return {
          objekt: g.pfad, aktion: "umplanen",
          parameter: { mitarbeiter: m.kennung },
          erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
          hinweis: m.name + " kann " + a.arbeit + ", the time stays the same"
        };
      }
    }
  ],
  stil: [
    '[data-sicht="nicht-zugewiesen"] { flex: 1; min-height: 0; overflow-y: auto; }',
    ".pl-anzahl { margin-left: 4px; padding: 0 7px; border-radius: 9px; font-size: 12px; background: var(--glas2); }",
    ".pl-offen { padding: 7px 10px; margin-bottom: 7px; border: 1px solid var(--kante); border-radius: 8px; background: #123a4a; color: var(--text); font-size: 13px; line-height: 1.3; white-space: nowrap; cursor: grab; touch-action: none; user-select: none; }",
    ".pl-offen b { font-weight: 600; }",
    ".pl-offenzeit { color: var(--dim); font-size: 12px; }",
    ".pl-niemand { float: right; padding: 0 6px; border-radius: 6px; font-size: 11px; color: #ffd9d4; background: rgba(255,111,97,.28); }",
    ".pl-leer { color: var(--dim); }"
  ].join("\n")
});
