/* Plugin Konfliktzähler. Rechnet wie die letzte Prototyp-Fassung: Überlappungen,
   Kapazitätslücken, fehlende Qualifikation, außerhalb der Anwesenheit.
   Gezählt wird, wenn eine Kette von Ereignissen durch ist, damit der Zähler nur
   den Endstand zeigt und nicht die Zwischenschritte. Jeder Konflikt trägt einen festen Pfad. */
(function () {
  function anwesendFuer(h, m, a) {
    if (!m.abwesend) return true;
    if (m.abwesendAb === null) return false;
    return h.minuten(a.ende) <= h.minuten(m.abwesendAb);
  }
  function ueberschneiden(h, a, b) {
    return h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende);
  }
  function hatQuali(m, arbeit) { return m.qualifikationen.indexOf(arbeit) !== -1; }

  /* Fester Pfad eines Konflikts, unabhängig von der Reihenfolge der beiden Aufträge */
  function pfadVon(art, a, b) {
    return "konflikte/" + art + "-" + (b ? [a, b].sort().join("-") : a);
  }

  function finde(h) {
    var auftraege = h.alle("auftraege"), leute = h.alle("mitarbeiter"), out = [];
    function person(id) { return leute.filter(function (m) { return m.kennung === id; })[0] || null; }

    auftraege.forEach(function (a, i) {
      if (!a.mitarbeiter) return;
      auftraege.slice(i + 1).forEach(function (b) {
        if (b.mitarbeiter === a.mitarbeiter && ueberschneiden(h, a, b)) {
          out.push({ art: "Overlap", auftrag: a.kennung, mit: b.kennung, pfad: pfadVon("ueberlappung", a.kennung, b.kennung) });
        }
      });
    });

    auftraege.forEach(function (a) {
      var eigener = a.mitarbeiter ? person(a.mitarbeiter) : null;
      if (eigener && anwesendFuer(h, eigener, a) && hatQuali(eigener, a.arbeit)) return;
      var ersatz = leute.some(function (m) {
        if (!anwesendFuer(h, m, a) || !hatQuali(m, a.arbeit)) return false;
        return !auftraege.some(function (o) {
          return o.kennung !== a.kennung && o.mitarbeiter === m.kennung && ueberschneiden(h, o, a);
        });
      });
      if (!ersatz) out.push({ art: "Capacity gap", auftrag: a.kennung, pfad: pfadVon("kapazitaet", a.kennung) });
    });

    auftraege.forEach(function (a) {
      var p = a.mitarbeiter ? person(a.mitarbeiter) : null;
      if (!p) return;
      if (!hatQuali(p, a.arbeit)) out.push({ art: "Missing qualification", auftrag: a.kennung, pfad: pfadVon("qualifikation", a.kennung) });
      if (!anwesendFuer(h, p, a) || h.minuten(a.start) < h.minuten(p.schichtStart) || h.minuten(a.ende) > h.minuten(p.schichtEnde)) {
        out.push({ art: "Outside shift or presence", auftrag: a.kennung, pfad: pfadVon("anwesenheit", a.kennung) });
      }
    });
    return out;
  }

  function schluessel(k) { return k.art + "|" + k.auftrag + "|" + (k.mit || ""); }

  /* Ein Satz zum ersten neu entstandenen Konflikt */
  function grund(h, neu, alt) {
    var bekannt = alt.map(schluessel);
    var k = neu.filter(function (x) { return bekannt.indexOf(schluessel(x)) === -1; })[0];
    if (!k) return "";
    var a = h.lies("auftraege/" + k.auftrag);
    var was = a.flug + " " + a.arbeit;
    if (k.art === "Capacity gap") return ": nobody is available any more for " + was + "";
    if (k.art === "Overlap") return ": " + was + " overlaps";
    if (k.art === "Missing qualification") return ": for " + was + " is missing the qualification";
    return ": " + was + " is outside shift or presence";
  }

  Huelle.plugin({
    kennung: "konfliktzaehler",
    titel: "Conflicts",
    besitzt: ["kennzahlen/konflikte/wert", "kennzahlen/konflikte/liste"],
    beimStart: function (h) {
      var liste = finde(h);
      h.setze("kennzahlen/konflikte/wert", liste.length);
      h.setze("kennzahlen/konflikte/liste", liste);
    },
    abonniert: {
      "bus/takt.ruhe": function (m, h) {
        var alt = h.lies("kennzahlen/konflikte/liste") || [];
        var neu = finde(h);
        if (JSON.stringify(alt) === JSON.stringify(neu)) return;
        h.sende({
          objekt: "kennzahlen/konflikte", aktion: "veraendert",
          parameter: { von: alt.length, auf: neu.length, liste: neu },
          erzaehlung: alt.length === neu.length ? null
            : "Conflicts " + alt.length + " → " + neu.length + grund(h, neu, alt)
        });
      },
      "kennzahlen/konflikte.veraendert": function (m, h) {
        h.setze("kennzahlen/konflikte/wert", m.parameter.auf);
        h.setze("kennzahlen/konflikte/liste", m.parameter.liste);
      }
    },
    ansicht: {
      ort: "seite",
      rang: 1,
      neuBei: ["kennzahlen/konflikte.geaendert"],
      zeichne: function (el, h) {
        var wert = h.lies("kennzahlen/konflikte/wert");
        el.innerHTML = '<div class="pl-zaehler" data-pfad="kennzahlen/konflikte">' +
          '<span class="pl-zahl' + (wert ? " pl-warn" : "") + '">' + wert + "</span>" +
          '<span class="pl-zahltext">Conflicts</span></div>';
      }
    },
    stil: [
      ".pl-zaehler { display: flex; align-items: baseline; gap: 10px; border-radius: 8px; padding: 2px 4px; }",
      ".pl-zahl { font-size: 38px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--gruen); }",
      ".pl-zahl.pl-warn { color: var(--koralle); }",
      ".pl-zahltext { font-size: 14.5px; color: var(--dim); }",
      ".pl-zaehler.gelandet .pl-zahl { animation: pl-sprung .7s ease-out; display: inline-block; }",
      "@keyframes pl-sprung { 0% { transform: scale(1.7); } 100% { transform: scale(1); } }"
    ].join("\n")
  });
})();
