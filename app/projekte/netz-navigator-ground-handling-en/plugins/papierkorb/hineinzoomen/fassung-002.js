/* Hineinzoomen: Bereich → seine Plugins und Regeln; Plugin → Herkunftskette (Wunsch → Fassungen → berührte Szenarien →
   Entscheidungen, je mit Datum); Faden → die Beziehungen, die ihn bilden. Dieses Plugin führt, wo der PO gerade ist. */
(function () {
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function datum(d) { return d ? '<time>' + esc(d) + "</time>" : ""; }

  function bereich(b, h) {
    var plugins = h.alle("bausteine").filter(function (p) { return p.bereich === b.kennung; });
    var regeln = h.alle("fachregeln").filter(function (r) { return r.bereich === b.kennung; });
    var kopf = '<header class="nv-kopf"><h2>' + esc(b.name) + "</h2><p>Responsible: " + esc(b.verantwortlich || "nobody yet") +
      (b.prototyp ? "" : " · data only") + " · " + esc(b.fachobjekte.join(", ")) + "</p></header>";
    var kacheln = plugins.map(function (p) {
      var n = p.fassungen.length;
      return '<button class="nv-kachel nv-klick' + (p.aus ? " nv-aus" : "") + '" data-pfad="bausteine/' + p.kennung + '" data-name="' + esc(p.name) + '"><strong>' + esc(p.name) + "</strong><span>" +
        (n ? "Version " + p.aktuell : "Base equipment") + (p.aus ? " · switched off" : "") + "</span></button>";
    }).join("");
    var liste = regeln.map(function (r) {
      var kauf = r.inKauf.map(function (k) { return '<small class="nv-klein">Knowingly accepted: ' + esc(k.satz) + " " + esc(k.datum) + "</small>"; }).join("");
      return '<li><span>' + esc(r.satz) + (r.wie ? '<small class="nv-klein">' + esc(r.wie) + "</small>" : "") + kauf + "</span>" + datum(r.datum) + "</li>";
    }).join("");
    var grund = h.alle("grundfunktionen").filter(function (g) { return g.bereich === b.kennung; }).map(function (g) {
      return '<button class="nv-kachel nv-grund nv-klick" data-pfad="grundfunktionen/' + g.kennung + '" data-name="' + esc(g.name) + '"><strong>' + esc(g.name) + "</strong><span>" +
        (g.anmerkung ? "Not right" : g.quelle.art === "ohne" ? "no source" : "with source") + "</span></button>";
    }).join("");
    if (grund) grund = "<h3>Starter kit</h3><p class=\"nv-klein\">" + vermerk(b) + '</p><div class="nv-kacheln">' + grund + "</div>" + (b.durchgesehen ? "" : '<button class="nv-stimmtnicht nv-klick" data-durchgesehen="1" data-bereich="' + esc(b.kennung) + '">List reviewed</button>');
    return kopf + (kacheln ? '<div class="nv-kacheln">' + kacheln + "</div>" : "") + grund +
      (liste ? '<h3>Rules</h3><ul class="nv-liste">' + liste + "</ul>" : "");
  }

  function vermerk(b) { return "Added afterwards, " + (b.durchgesehen ? "reviewed by the PO on " + esc(b.durchgesehen) : "not yet reviewed by the PO") + "."; }

  /* Der Prototyp kennt keine echte Uhr: Als Datum gilt der jüngste Tag in den gelesenen Daten. */
  function juengsterTag(h) {
    var tage = [];
    h.alle("bausteine").forEach(function (p) {
      p.fassungen.forEach(function (f) { tage.push(f.datum); });
      p.arbeitetIn.forEach(function (s) { tage.push(s.datum); });
    });
    h.alle("fachregeln").forEach(function (r) { tage.push(r.datum); });
    function wert(d) { return d.split(".").reverse().join(""); }
    return tage.filter(Boolean).reduce(function (a, d) { return !a || wert(d) > wert(a) ? d : a; }, null);
  }

  function grundfunktion(g, h) {
    var q = g.quelle;
    var quelle = q.art === "ohne"
      ? "<article><p>Built by Claude Code, without a request from the PO.</p>" + (q.zusatz ? '<p class="nv-klein">' + esc(q.zusatz) + "</p>" : "") + "</article>"
      : "<article><h4>" + esc(q.art === "wortlaut" ? "PO's wording" : "From the prototype's scope") + datum(q.datum) + "</h4><blockquote>" + esc(q.wortlaut) + '</blockquote><p class="nv-klein">' + esc(q.wie) + "</p></article>";
    var anmerkung = g.anmerkung ? "<article><h4>Your note" + datum(g.anmerkungDatum) + "</h4><p>" + esc(g.anmerkung) + "</p></article>" : "";
    return '<header class="nv-kopf"><h2>' + esc(g.name) + "</h2><p>" + vermerk(h.lies("bereiche/" + g.bereich)) + "</p></header>" +
      '<div class="nv-kette">' + glied("Function", "<article><p>" + esc(g.satz) + "</p></article>") + glied("Source", quelle) +
      glied("Not right", anmerkung + '<textarea class="nv-anmerkung" rows="3" placeholder="What is not right about it?"></textarea><button class="nv-stimmtnicht nv-klick" data-stimmtnicht="1" data-gf="' + esc(g.kennung) + '">Not right</button>') + "</div>";
  }

  function glied(titel, inhalt) {
    return inhalt ? '<section class="nv-glied"><h3>' + titel + "</h3>" + inhalt + "</section>" : "";
  }

  function wunschName(f) { return f.wunsch ? "Request " + f.wunsch : ""; }

  function plugin(p) {
    var wuensche = p.fassungen.filter(function (f) { return f.wortlaut; }).map(function (f) {
      var fragen = f.rueckfragen.map(function (d) {
        return '<div class="nv-frage"><span>Question: ' + esc(d.frage) + "</span><span>Answer: " + esc(d.antwort) + "</span>" + datum(d.datum) + "</div>";
      }).join("");
      var anhaenge = f.anhaenge.length ? '<p class="nv-klein">Attachments: ' + esc(f.anhaenge.join(", ")) + "</p>" : "";
      return '<article><h4>' + esc(wunschName(f) || "Change") + datum(f.datum) + "</h4><blockquote>" + esc(f.wortlaut) + "</blockquote>" + fragen + anhaenge + "</article>";
    }).join("");

    var fassungen = p.fassungen.slice().reverse().map(function (f) {
      return '<article' + (f.nr === p.aktuell ? ' class="nv-aktuell"' : "") + "><h4>Version " + f.nr + (wunschName(f) ? " · " + wunschName(f) : "") + datum(f.datum) + "</h4><p>" + esc(f.kurz) + "</p></article>";
    }).join("");

    var szenarien = "";
    p.fassungen.forEach(function (f) {
      if (f.gespielt) szenarien += "<article><h4>" + esc(f.gespielt.name) + datum(f.datum) + "</h4><p>Played for this, version " + f.nr + ".</p></article>";
      f.erwartungen.forEach(function (e) {
        szenarien += "<article><h4>" + esc(e.name) + datum(f.datum) + "</h4><p>" + esc(e.satz) + '</p><p class="nv-alt">Before: ' + esc(e.alt) + '</p><p class="nv-neu">Now: ' + esc(e.neu) + "</p></article>";
      });
    });

    var arbeitet = p.arbeitetIn.map(function (s) {
      return "<article><h4>" + esc(s.name) + "</h4><p>last played on " + esc(s.datum) + "</p></article>";
    }).join("");

    var alle = p.entscheidungen.slice();
    p.fassungen.forEach(function (f) { alle = alle.concat(f.entscheidungen); });
    var entscheidungen = alle.map(function (e) {
      return "<article><h4>" + esc(e.wie) + datum(e.datum) + "</h4>" + (e.satz ? "<p>" + esc(e.satz) + "</p>" : "") + "</article>";
    }).join("");

    return '<header class="nv-kopf"><h2>' + esc(p.name) + "</h2>" + (p.fassungen.length ? "" : "<p>Base equipment, there is no request for it.</p>") + "</header>" +
      '<div class="nv-kette">' + glied("Request", wuensche) + glied("Versions", fassungen) + glied("Scenarios touched", szenarien) + glied("Works in these scenarios", arbeitet) + glied("Decisions", entscheidungen) + "</div>";
  }

  function faden(f, h) {
    var von = h.lies("bereiche/" + f.von + "/name"), nach = h.lies("bereiche/" + f.nach + "/name");
    var zeilen = f.beziehungen.map(function (b) {
      if (b.wer === "plugin") return '<li><button class="nv-link nv-klick" data-pfad="bausteine/' + b.kennung + '" data-name="' + esc(h.lies("bausteine/" + b.kennung + "/name")) + '">' + esc(b.satz) + "</button></li>";
      return "<li><span>" + esc(b.satz) + "</span></li>";
    }).join("");
    return '<header class="nv-kopf"><h2>' + esc(von) + " and " + esc(nach) + "</h2><p>" + f.beziehungen.length + " relations form this thread.</p></header>" +
      '<ul class="nv-liste">' + zeilen + "</ul>";
  }

  Huelle.plugin({
    kennung: "hineinzoomen",
    titel: "Zoom in",
    besitzt: ["navi/jetzt/pfad", "grundfunktionen/*/anmerkung", "bereiche/*/durchgesehen"],
    beimStart: function (h) { h.alle("bereiche").forEach(function (b) { h.setze("bereiche/" + b.kennung + "/durchgesehen", null); }); },
    beschreibe: { "bereiche/*/durchgesehen": function (u) { return u.neu ? "The starter kit was reviewed by the PO on " + u.neu : null; } },
    abonniert: {
      "navi/jetzt.gehen": function (m, h) { h.setze("navi/jetzt/pfad", m.parameter.ziel); },
      "grundfunktionen/*.stimmtnicht": function (m, h) { h.setze(m.objekt + "/anmerkung", m.parameter.text); },
      "bereiche/*.durchgesehen": function (m, h) { h.setze(m.objekt + "/durchgesehen", m.parameter.datum); }
    },
    bedienungen: [{
      kennung: "durchgesehen", titel: "List reviewed", art: "klicken", fasst: "[data-durchgesehen]",
      ereignis: function (g, h) {
        return { objekt: "bereiche/" + g.daten.bereich, aktion: "durchgesehen", parameter: { datum: juengsterTag(h) }, erzaehlung: "Starter kit is reviewed" };
      }
    }, {
      kennung: "stimmtnicht", titel: "Not right", art: "klicken", fasst: "[data-stimmtnicht]",
      ereignis: function (g) {
        var feld = document.querySelector(".nv-anmerkung"), text = feld ? feld.value.trim() : "";
        if (!text) return null;
        return { objekt: "grundfunktionen/" + g.daten.gf, aktion: "stimmtnicht", parameter: { text: text }, erzaehlung: "Notes: not right" };
      }
    }, {
      kennung: "oeffnen", titel: "Open plugin", art: "klicken", fasst: "[data-pfad]",
      ereignis: function (g) {
        return { objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: g.pfad }, erzaehlung: "Opens " + g.daten.name };
      }
    }],
    ansicht: {
      ort: "haupt",
      rang: 3,
      neuBei: ["navi/*.geaendert", "grundfunktionen/*.geaendert", "bereiche/*.geaendert"],
      zeichne: function (el, h) {
        var pfad = h.lies("navi/jetzt/pfad");
        var art = pfad.split("/")[0];
        var obj = art === "karte" ? null : h.lies(pfad);
        if (!obj) { el.innerHTML = ""; return; }
        el.innerHTML = '<div class="nv-tief" data-rollen="tief">' +
          (art === "bereiche" ? bereich(obj, h) : art === "bausteine" ? plugin(obj) : art === "grundfunktionen" ? grundfunktion(obj, h) : faden(obj, h)) + "</div>";
      }
    }
  });
})();
