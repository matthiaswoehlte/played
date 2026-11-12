/* Projektwähler (Auftrag 009): Play kennt mehrere Projekte, jedes eine eigene Nutzapp in eigenem Ordner.
   Ein Klick öffnet ein anderes Projekt: Die Brücke schaltet um, die Seite lädt neu und zeigt dessen
   Nutzapp. Play merkt sich das zuletzt geöffnete. Ohne Brücke (Seite als Datei) gibt es keinen Wähler. */
(function () {
  "use strict";
  var H = window.Huelle;
  var wahl = document.getElementById("projektWahl");
  if (location.protocol !== "http:" || new URLSearchParams(location.search).has("nachspielen")) return;

  /* Anweisung 21: „Stimmt nicht“ am Grundstock bleibt erhalten. Plugins haben keinen Zugriff auf das Netz; nur von Hand. */
  H.bus.abonniere("grundfunktionen/*.stimmtnicht", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    fetch("/grundstock-anmerkung", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kennung: m.objekt.split("/")[1], text: m.parameter.text }) }).then(function () { H.punkte.entschieden("stimmtnicht", m.objekt.split("/")[1]); }).catch(function () {
      if (H.player) H.player.melde("Play can't be reached right now. Your note has not been saved.", "fehler");
    });
  }, "huelle/projekte");

  /* Anweisung 33 (c): „Stimmt nicht“ zurücknehmen; Play meldet danach, ob der Kasten wieder als bestätigt gilt. */
  H.bus.abonniere("grundfunktionen/*.stimmtnichtzuruecknehmen", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    var kennung = m.objekt.split("/")[1];
    fetch("/grundstock-anmerkung", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kennung: kennung, text: null }) }).then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function (a) {
      H.bus.sende({ objekt: m.objekt, aktion: "stimmtnichtzurueckgenommen", parameter: { bestaetigt: a.bestaetigt }, erzaehlung: "“Not right” withdrawn" }, "huelle/projekte");
      H.punkte.entschieden("stimmtnicht", kennung);
      H.anstossen();
    }).catch(function () {
      if (H.player) H.player.melde("Play can't be reached right now. Your note stays in place.", "fehler");
    });
  }, "huelle/projekte");

  /* Anweisung 26: Play hält die Bestätigung mit dem echten Datum fest und meldet erst danach, was bestätigt ist. */
  H.bus.abonniere("bereiche/*.grundstockbestaetigen", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    fetch("/grundstock-bestaetigung", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bereich: m.objekt.split("/")[1] }) }).then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function (a) {
      H.bus.sende({ objekt: m.objekt, aktion: "grundstockbestaetigt", parameter: { datum: a.datum, kennungen: a.kennungen }, erzaehlung: "Starter kit confirmed on " + a.datum }, "huelle/projekte");
      H.anstossen();
    }).catch(function () {
      if (H.player) H.player.melde("Play can't be reached right now. The confirmation has not been saved.", "fehler");
    });
  }, "huelle/projekte");

  /* Entscheidung 7: Der Navigator bittet, Play tut es. */
  H.bus.abonniere("bereiche/*.prototypbeginnen", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    post("/prototyp-vormerken", { bereich: m.objekt.split("/")[1] }).then(function (x) {
      if (x.ok) location.reload();
      else if (H.player) H.player.melde(x.d.grund || "This could not be started.", "fehler");
    }).catch(function () {
      if (H.player) H.player.melde("Play can't be reached right now.", "fehler");
    });
  }, "huelle/projekte");

  /* Anweisung 44: Bereich leeren. Play fragt in einem Satz, bei der Teil-App mit Grundstock ein zweites Mal; erst dann wird gelöscht. */
  H.bus.abonniere("bereiche/*.bereichleeren", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    var bereich = m.objekt.split("/")[1];
    var fehler = function (x) { if (H.player) H.player.melde((x && x.d && x.d.grund) || "Play can't be reached right now.", "fehler"); };
    post("/bereich-leeren", { bereich: bereich, nurFragen: true }).then(function (x) {
      if (!x.ok) return fehler(x);
      if (!window.confirm("Everything in “" + x.d.name + "” will be deleted. The other areas stay as they are.")) return;
      if (x.d.grundstock && !window.confirm("“" + x.d.name + "” holds the starter kit and all your requests. Really delete everything? A backup will be kept.")) return;
      if (H.player) H.player.melde("Clearing “" + x.d.name + "” …", "hinweis");
      return post("/bereich-leeren", { bereich: bereich }).then(function (y) { if (y.ok) location.reload(); else fehler(y); });
    }).catch(function () { fehler(null); });
  }, "huelle/projekte");

  /* Anweisung 45 (e): Sicherung zurückholen, nach einer Rückfrage; Play sichert vorher den jetzigen Stand. */
  H.bus.abonniere("sicherungen/*.zurueckholen", function (m) {
    if (!/^hand\//.test(m.absender || "")) return;
    var p = m.parameter || {};
    var fehler = function (x) { if (H.player) H.player.melde((x && x.d && x.d.grund) || "Play can't be reached right now.", "fehler"); };
    if (!window.confirm("Restore the state from " + (p.zeit || "?") + "? The current state will be backed up first.")) return;
    if (H.player) H.player.melde("Restoring the state from " + (p.zeit || "?") + " …", "hinweis");
    post("/sicherung-zurueckholen", { sicherung: m.objekt.split("/")[1] }).then(function (y) { if (y.ok) location.reload(); else fehler(y); }).catch(function () { fehler(null); });
  }, "huelle/projekte");

  function fuelle(stand) {
    wahl.textContent = "";
    function zeile(wert, text, aus) {
      var o = document.createElement("option");
      o.value = wert;
      o.textContent = text;
      o.disabled = !!aus;
      wahl.appendChild(o);
    }
    var hier = null;
    /* Auftrag 011 (PO, 10.11.): Der Wähler zeigt nur Projekte in der Sprache des offenen Projekts; ganz unten wechselt ein Eintrag zur anderen. */
    var offen = stand.liste.filter(function (p) { return p.kennung === stand.aktuell; })[0];
    var meine = (offen && offen.sprache) || "Deutsch";
    stand.liste.forEach(function (p) {
      if ((p.sprache || "Deutsch") !== meine) return;
      if (p.kennung === stand.aktuell) hier = p;
      /* Solange ein Projekt nur eine Teil-App hat, reicht sein Name. Teil-Apps ohne Prototyp lassen sich noch nicht öffnen. */
      if (p.teilApps.length < 2 && p.teilApps.every(function (a) { return a.prototyp; })) { zeile(p.kennung, p.name); return; }
      var offen = false;
      p.teilApps.forEach(function (a) {
        var erste = a.prototyp && !offen;
        if (erste) offen = true;
        if (a.prototyp) zeile(erste ? p.kennung : p.kennung + "/" + a.kennung, p.name + " › " + a.name);
        /* Anweisung 46: die leer geöffnete Teil-App steht im Wähler wie jede andere */
        else if (stand.vorgemerkt && p.kennung === stand.aktuell && a.kennung === stand.vorgemerkt.bereich) zeile(p.kennung + "/" + a.kennung, p.name + " › " + a.name);
        else if (a.leer && p.kennung === stand.aktuell && !p.liest) zeile(BEGINNE + a.kennung, p.name + " › " + a.name + " – Start prototype …");
        else zeile(p.kennung + "/" + a.kennung, p.name + " › " + a.name, true);
      });
    });
    zeile(NEU_LINIE, "──────────", true);
    if (hier && !hier.liest) zeile(NEU_BEREICH, "New area …");
    zeile(NEU_PROJEKT, "New project …");
    /* Auftrag 011: Kopie des offenen Projekts; ein Navigator wird mit seinem Projekt kopiert, nicht allein. */
    if (hier && !hier.liest) zeile(KOPIE, "Make a copy …");
    var andere = stand.liste.filter(function (p) { return (p.sprache || "Deutsch") !== meine && !p.liest; })[0];
    /* Die Beschriftung steht in der Sprache, zu der sie wechselt; sie wird darum nie übersetzt (bleibt). */
    if (andere) zeile(andere.kennung, meine === "Englisch" ? /*bleibt*/"Deutsch" : /*bleibt*/"English");
    wahl.value = stand.wert;
    /* Auftrag 011: Eine übersetzte Kopie trägt einmal, beim Projekt, ihren Vermerk. */
    wahl.title = hier && hier.vermerk ? hier.name + ": " + hier.vermerk : "";
    wahl.hidden = false;
  }

  var NEU_LINIE = "?linie", NEU_BEREICH = "?bereich", NEU_PROJEKT = "?projekt", KOPIE = "?kopie", BEGINNE = "?beginne:";

  function post(weg, inhalt) {
    return fetch(weg, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inhalt) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  /* Kleines Fenster für „Neuer Bereich …“ und „Neues Projekt …“ */
  function fenster(titel, felder, knopf, absenden) {
    var d = document.createElement("dialog");
    d.className = "projekt-fenster";
    var h = document.createElement("h3");
    h.textContent = titel;
    var f = document.createElement("form");
    f.method = "dialog";
    f.appendChild(h);
    felder.forEach(function (x) { f.appendChild(x); });
    var fehler = document.createElement("p");
    fehler.className = "projekt-fehler";
    f.appendChild(fehler);
    var zeile = document.createElement("div");
    zeile.className = "projekt-knoepfe";
    var ab = document.createElement("button");
    ab.type = "button";
    ab.textContent = "Cancel";
    ab.addEventListener("click", function () { d.close(); });
    var ok = document.createElement("button");
    ok.type = "submit";
    ok.textContent = knopf;
    zeile.appendChild(ab);
    zeile.appendChild(ok);
    f.appendChild(zeile);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      ok.disabled = true;
      absenden().then(function (x) {
        ok.disabled = false;
        if (x.ok) d.close();
        else fehler.textContent = x.d.grund || "This could not be created.";
      }).catch(function () { ok.disabled = false; fehler.textContent = "Play can't be reached right now."; });
    });
    d.appendChild(f);
    d.addEventListener("close", function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
  }
  function beschriftet(text, feld) {
    var l = document.createElement("label");
    l.textContent = text;
    l.appendChild(feld);
    return l;
  }
  function eingabe() { var i = document.createElement("input"); i.type = "text"; return i; }

  function neuerBereich() {
    var hier = stand.liste.filter(function (p) { return p.kennung === stand.aktuell; })[0];
    var name = eingabe(), wer = eingabe(), platz = document.createElement("select"), art = document.createElement("input");
    art.type = "checkbox";
    [{ kennung: "", name: "Top level" }].concat(hier.ordner).forEach(function (o) {
      var x = document.createElement("option");
      x.value = o.kennung;
      x.textContent = o.kennung ? "Under “" + o.name + "”" : o.name;
      platz.appendChild(x);
    });
    var werZeile = beschriftet("Responsible", wer);
    platz.addEventListener("change", function () { werZeile.hidden = !!platz.value; });
    fenster("New area", [beschriftet("Name", name), beschriftet("Location", platz), werZeile, beschriftet("Contains further areas", art)], "Create", function () {
      return post("/bereich", { name: name.value, unter: platz.value || null, verantwortlich: wer.value, ordner: art.checked }).then(function (x) {
        if (x.ok) {
          if (H.player) H.player.melde("“" + name.value.trim() + "” now appears dashed on the map.", "hinweis");
          fetch("/projekte").then(function (r) { return r.json(); }).then(function (s) { stand = s; fuelle(s); });
        }
        return x;
      });
    });
    name.focus();
  }
  function neuesProjekt() {
    var name = eingabe();
    fenster("New project", [beschriftet("Name", name)], "Create", function () {
      return post("/projekt-neu", { name: name.value }).then(function (x) { if (x.ok) location.reload(); return x; });
    });
    name.focus();
  }

  /* Auftrag 011: „Kopie anlegen …“. Die Kopie nimmt alles mit außer den Sicherungen und öffnet sich danach.
     Solange Play kopiert, steht im Fenster, was es gerade tut. */
  function kopieAnlegen() {
    var hier = stand.liste.filter(function (p) { return p.kennung === stand.aktuell; })[0];
    var name = eingabe(), sprache = document.createElement("select");
    name.value = hier.name + " (copy)";
    [["wie-original", "Same as the original"], ["englisch", "English"]].forEach(function (s) {
      var o = document.createElement("option");
      o.value = s[0];
      o.textContent = s[1];
      sprache.appendChild(o);
    });
    var lage = document.createElement("p");
    lage.className = "projekt-lage";
    fenster("Copy of “" + hier.name + "”", [beschriftet("Name", name), beschriftet("Language", sprache), lage], "Make a copy", function () {
      lage.textContent = "Copying “" + hier.name + "” with all areas, plugins, scenarios and the origin …";
      return post("/projekt-kopie", { name: name.value, sprache: sprache.value }).then(function (x) {
        if (x.ok && x.d.laeuft) return uebersetzt(lage);
        if (x.ok) { lage.textContent = "Done. The copy is opening."; location.reload(); }
        else lage.textContent = "";
        return x;
      });
    });
    name.select();
  }
  /* Stufe 2: Übersetzen dauert. Das Fenster zeigt, woran Play gerade ist, wie weit es ist und wie lange es noch ungefähr braucht;
     danach öffnet sich die Kopie. Ein Fehler steht im Fenster. */
  function uebersetzt(lage) {
    return new Promise(function (fertig) {
      function frage() {
        fetch("/projekt-kopie").then(function (r) { return r.json(); }).then(function (s) {
          if (s.fehler) { lage.textContent = s.fehler; fertig({ ok: false, d: { grund: s.fehler } }); return; }
          if (!s.laeuft && s.aktuell) { lage.textContent = "Done. The copy is opening."; location.reload(); return; }
          var prozent = Math.round((s.anteil || 0) * 100);
          lage.textContent = "Translating into English: " + (s.text || "…") + " · " + prozent + " %"
            + (s.rest ? " · about " + s.rest + (s.rest === 1 ? " minute left" : " minutes left") : "");
          setTimeout(frage, 1000);
        }).catch(function () { setTimeout(frage, 2000); });
      }
      frage();
    });
  }

  /* Anweisung 46: Leere Fläche heißt leere Fläche. Solange die neue Teil-App noch keinen Prototyp hat, zeigt der Nutzbereich nur
     eine ruhige Fläche mit ihrem Namen; während die KI baut, steht dort der Fortschritt. „Abbrechen“ lässt alles, wie es war. */
  if (H.teilApp.leer) {
    var flaeche = document.createElement("div");
    flaeche.className = "leere-flaeche";
    flaeche.innerHTML = '<strong></strong><p class="leere-flaeche-satz"></p><button type="button">Cancel</button>';
    flaeche.querySelector("strong").textContent = H.teilApp.titel || "";
    var satz = flaeche.querySelector("p"), abbrechen = flaeche.querySelector("button");
    satz.textContent = "Describe in the request field what should be built here.";
    abbrechen.addEventListener("click", function () {
      post("/prototyp-abbrechen", {}).then(function () { location.reload(); }).catch(function () { if (H.player) H.player.melde("Play can't be reached right now.", "fehler"); });
    });
    var orte = document.querySelector("#nutzbereich .orte");
    orte.parentNode.insertBefore(flaeche, orte);
    orte.hidden = true;
    H.leereFlaeche = {
      /* Fortschritt der KI, z. B. „schreibt Plugin 2 von 3“; ohne Text wieder die Aufforderung */
      zeige: function (text) {
        satz.textContent = text || "Describe in the request field what should be built here.";
        abbrechen.hidden = !!text;
      }
    };
  }

  var stand = null;
  fetch("/projekte").then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
    if (s) {
      stand = s;
      fuelle(s);
      if (s.vorgemerkt) H.wunsch.prototypBeginnen(s.vorgemerkt);
    }
  }).catch(function () { /* ohne Brücke kein Wähler */ });

  wahl.addEventListener("change", function () {
    var ziel = wahl.value;
    if (ziel === NEU_BEREICH || ziel === NEU_PROJEKT || ziel === KOPIE) {
      wahl.value = stand.wert;
      (ziel === NEU_BEREICH ? neuerBereich : ziel === KOPIE ? kopieAnlegen : neuesProjekt)();
      return;
    }
    if (ziel.indexOf(BEGINNE) === 0) {
      var hier = stand.liste.filter(function (p) { return p.kennung === stand.aktuell; })[0];
      var a = hier.teilApps.filter(function (x) { return x.kennung === ziel.slice(BEGINNE.length); })[0];
      wahl.value = stand.wert;
      /* Anweisung 46: sofort die neue, leere Teil-App öffnen */
      post("/prototyp-vormerken", { bereich: a.kennung }).then(function (x) {
        if (x.ok) location.reload();
        else if (H.player) H.player.melde(x.d.grund || "This could not be started.", "fehler");
      }).catch(function () { if (H.player) H.player.melde("Play cannot be reached right now.", "fehler"); });
      return;
    }
    wahl.disabled = true;
    fetch("/projekt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kennung: ziel }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (x.ok) { location.reload(); return; }
        wahl.disabled = false;
        if (stand) wahl.value = stand.wert;
        if (H.player) H.player.melde(x.d.grund || "The project could not be opened.", "fehler");
      })
      .catch(function () {
        wahl.disabled = false;
        if (stand) wahl.value = stand.wert;
        if (H.player) H.player.melde("Play cannot be reached right now. The project stays as it is.", "fehler");
      });
  });
})();
