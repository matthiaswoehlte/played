/* Hineinzoomen: Bereich → seine Plugins und Regeln; Plugin → Herkunftskette (Wunsch → Fassungen → berührte Szenarien →
   Entscheidungen, je mit Datum); Faden → die Beziehungen, die ihn bilden. Dieses Plugin führt, wo der PO gerade ist. */
(function () {
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function datum(d) { return d ? '<time>' + esc(d) + "</time>" : ""; }

  /* Anweisung 30e: die eigene Zahl jeder Ebene; ein Klick öffnet die Liste dessen, was sie zählt. */
  function merk(z, umfang, titel) {
    var n = z.verstoesse + z.faelle + z.abweichend + z.stimmtnicht;
    return n ? '<em class="nv-merk ' + (z.verstoesse ? "nv-rot" : "nv-gelb") + '" data-punkte="' + esc(umfang) + '" data-titel="' + esc(titel) + '">' + n + "</em>" : "";
  }

  function bereich(b, h) {
    var plugins = h.alle("bausteine").filter(function (p) { return p.bereich === b.kennung; });
    var regeln = h.alle("fachregeln").filter(function (r) { return r.bereich === b.kennung; });
    var teile = [];
    if (!b.eltern) teile.push("Responsible: " + (b.verantwortlich || "nobody yet"));
    if (b.baustand === "leer") teile.push("still empty");
    if (b.baustand === "daten") teile.push("data only");
    if (b.fachobjekte.length) teile.push(b.fachobjekte.join(", "));
    var kopf = '<header class="nv-kopf"><h2>' + esc(b.name) + "</h2><p>" + esc(teile.join(" · ")) + "</p></header>";
    var kacheln = plugins.map(function (p) {
      var n = p.fassungen.length;
      return '<button class="nv-kachel nv-klick' + (p.aus ? " nv-aus" : "") + '" data-pfad="bausteine/' + p.kennung + '" data-name="' + esc(p.name) + '"><strong>' + esc(p.name) + "</strong><span>" +
        (n ? "Version " + p.aktuell : "Base equipment") + (p.aus ? " · switched off" : "") + "</span>" + merk(p.zahl, "bausteine/" + p.kennung, p.name) + "</button>";
    }).join("");
    if (b.ohnePlugin.verstoesse + b.ohnePlugin.faelle + b.ohnePlugin.abweichend) kacheln += '<div class="nv-kachel"><strong>Without plugin</strong><span>No plugin works on this yet.</span>' + merk(b.ohnePlugin, "ohne/" + b.kennung, b.name + ": without plugin") + "</div>";
    var liste = regeln.map(function (r) {
      var kauf = r.inKauf.map(function (k) { return '<small class="nv-klein">Knowingly accepted: ' + esc(k.satz) + " " + esc(k.datum) + "</small>"; }).join("");
      return '<li><span>' + esc(r.satz) + (r.wie ? '<small class="nv-klein">' + esc(r.wie) + "</small>" : "") + kauf + "</span>" + datum(r.datum) + "</li>";
    }).join("");
    var grund = h.alle("grundfunktionen").filter(function (g) { return g.bereich === b.kennung; }).map(function (g) {
      return '<button class="nv-kachel' + (g.bestaetigt ? "" : " nv-grund") + ' nv-klick" data-pfad="grundfunktionen/' + g.kennung + '" data-name="' + esc(g.name) + '"><strong>' + esc(g.name) + "</strong><span>" +
        (g.anmerkung ? "Not right" : g.vorschlag ? "Proposal" : g.quelle.art === "ohne" ? "no source" : "with source") + "</span>" + merk(g.zahl, "grundfunktionen/" + g.kennung, g.name) + "</button>";
    }).join("");
    if (grund) {
      var alle = h.alle("grundfunktionen").filter(function (g) { return g.bereich === b.kennung; });
      var offen = alle.some(function (g) { return !g.bestaetigt && !g.anmerkung; });
      var bestaetigt = alle.filter(function (g) { return g.bestaetigt; }).map(function (g) { return g.bestaetigt; })[0];
      grund = "<h3>Starter kit</h3><p class=\"nv-klein\">" + (offen ? VERMERK : bestaetigt ? "Recorded afterwards, confirmed by the PO on " + esc(bestaetigt) + "." : "Recorded afterwards.") + '</p><div class="nv-kacheln">' + grund + "</div>" +
        (offen ? '<button class="nv-stimmtnicht nv-klick" data-bestaetigen="1" data-bereich="' + esc(b.kennung) + '">List confirmed</button>' : "");
    }
    /* Anweisung 44: Was geleert wurde, steht nur noch als eine Zeile da. */
    var geleert = (b.geleert || []).map(function (d) { return '<p class="nv-klein nv-geleert">Area ”' + esc(b.name) + "” cleared on " + esc(d) + "</p>"; }).join("");
    return kopf + geleert + (kacheln ? '<div class="nv-kacheln">' + kacheln + "</div>" : "") + grund +
      (liste ? '<h3>Rules</h3><ul class="nv-liste">' + liste + "</ul>" : "");
  }

  var VERMERK = "Recorded afterwards, not yet reviewed by the PO.";

  function grundfunktion(g) {
    var q = g.quelle;
    var quelle = q.art === "ohne"
      ? "<article><p>Built by Claude Code, without a request from the PO.</p>" + (q.zusatz ? '<p class="nv-klein">' + esc(q.zusatz) + "</p>" : "") + "</article>"
      : "<article><h4>" + esc(q.art === "wortlaut" ? "PO's wording" : "From the prototype's scope") + datum(q.datum) + "</h4><blockquote>" + esc(q.wortlaut) + '</blockquote><p class="nv-klein">' + esc(q.wie) + "</p></article>";
    var anmerkung = g.anmerkung ? "<article><h4>Your note" + datum(g.anmerkungDatum) + "</h4><p>" + esc(g.anmerkung) + '</p><button class="nv-stimmtnicht nv-klick" data-zuruecknehmen="1" data-gf="' + esc(g.kennung) + '">Undo</button></article>' : "";
    var vermerk = g.anmerkung ? "Recorded afterwards, marked ”Not right” by the PO." : g.vorschlag ? "Proposal: A request changed this after your confirmation." : g.bestaetigt ? "Recorded afterwards, confirmed by the PO on " + esc(g.bestaetigt) + "." : VERMERK;
    return '<header class="nv-kopf"><h2>' + esc(g.name) + "</h2><p>" + vermerk + "</p></header>" +
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
      return '<article' + (f.nr === p.aktuell ? ' class="nv-aktuell"' : "") + "><h4>Version " + f.nr + (wunschName(f) ? " · " + wunschName(f) : "") + (f.unbestaetigt ? " · not yet confirmed" : "") + datum(f.datum) + "</h4><p>" + esc(f.kurz) + "</p></article>";
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
    var WORT = { offen: "A decision is waiting", instabil: "Decision withdrawn or reversed", widerspruch: "Contradiction" };
    var zeilen = f.straenge.map(function (b) {
      var marke = '<i class="nv-marke nv-z-' + b.zustand + '"></i>', wort = (WORT[b.zustand] ? "<small>" + WORT[b.zustand] + "</small>" : "") +
        (b.punkte.length ? '<em class="nv-merk nv-merk-strang ' + (b.zustand === "widerspruch" ? "nv-rot" : "nv-gelb") + '" data-punkte="' + esc("strang/" + b.id) + '" data-titel="' + esc(b.satz) + '">' + b.punkte.length + "</em>" : "");
      if (b.wer === "plugin") return '<li>' + marke + '<button class="nv-link nv-klick" data-pfad="bausteine/' + b.kennung + '" data-name="' + esc(h.lies("bausteine/" + b.kennung + "/name")) + '">' + esc(b.satz) + "</button>" + wort + "</li>";
      return "<li>" + marke + "<span>" + esc(b.satz) + "</span>" + wort + "</li>";
    }).join("");
    return '<header class="nv-kopf"><h2>' + esc(von) + " and " + esc(nach) + "</h2><p>" + (f.straenge.length === 1 ? "One thread" : f.straenge.length + " threads") + " between these areas.</p></header>" +
      '<ul class="nv-liste">' + zeilen + "</ul>";
  }

  Huelle.plugin({
    kennung: "hineinzoomen",
    titel: "Zoom in",
    besitzt: ["navi/jetzt/pfad", "grundfunktionen/*/anmerkung", "grundfunktionen/*/bestaetigt", "grundfunktionen/*/vorschlag"],
    abonniert: {
      "navi/jetzt.gehen": function (m, h) { h.setze("navi/jetzt/pfad", m.parameter.ziel); },
      "grundfunktionen/*.stimmtnicht": function (m, h) { h.setze(m.objekt + "/bestaetigt", null); h.setze(m.objekt + "/vorschlag", false); h.setze(m.objekt + "/anmerkung", m.parameter.text); },
      /* Das Datum kommt von Play: Die Bestätigung gilt erst, wenn sie gespeichert ist. */
      "grundfunktionen/*.stimmtnichtzurueckgenommen": function (m, h) { h.setze(m.objekt + "/anmerkung", null); h.setze(m.objekt + "/bestaetigt", m.parameter.bestaetigt); },
      "bereiche/*.grundstockbestaetigt": function (m, h) { m.parameter.kennungen.forEach(function (k) { h.setze("grundfunktionen/" + k + "/vorschlag", false); h.setze("grundfunktionen/" + k + "/bestaetigt", m.parameter.datum); }); }
    },
    bedienungen: [{
      kennung: "punkte", titel: "Show open items", art: "klicken", fasst: "[data-punkte]",
      ereignis: function (g) { return { objekt: "navi/jetzt", aktion: "punktezeigen", parameter: { umfang: g.daten.punkte, titel: g.daten.titel }, erzaehlung: "Shows open items" }; }
    }, {
      kennung: "bestaetigen", titel: "List confirmed", art: "klicken", fasst: "[data-bestaetigen]",
      ereignis: function (g) { return { objekt: "bereiche/" + g.daten.bereich, aktion: "grundstockbestaetigen", parameter: {}, erzaehlung: "Confirms the starter kit" }; }
    }, {
      kennung: "stimmtnichtzurueck", titel: "Undo ”Not right”", art: "klicken", fasst: "[data-zuruecknehmen]",
      ereignis: function (g) { return { objekt: "grundfunktionen/" + g.daten.gf, aktion: "stimmtnichtzuruecknehmen", parameter: {}, erzaehlung: "Undoes ”Not right”" }; }
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
      neuBei: ["navi/*.geaendert", "grundfunktionen/*.geaendert"],
      zeichne: function (el, h) {
        var pfad = h.lies("navi/jetzt/pfad");
        var art = pfad.split("/")[0];
        var obj = art === "karte" ? null : h.lies(pfad);
        if (!obj || (art === "bereiche" && obj.ordner)) { el.innerHTML = ""; return; }
        el.innerHTML = '<div class="nv-tief" data-rollen="tief">' +
          (art === "bereiche" ? bereich(obj, h) : art === "bausteine" ? plugin(obj) : art === "grundfunktionen" ? grundfunktion(obj) : faden(obj, h)) + "</div>";
      }
    }
  });
})();
