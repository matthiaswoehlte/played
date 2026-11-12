/* Feste Hülle, Teil 11: Abgleich von Wunsch und Plugin (Auftrag 006, Stufe 3).
   Nach jedem eingespielten Plugin vergleicht die Brücke im Hintergrund den Wunsch im Wortlaut mit dem,
   was eingespielt wurde. Hier kommt das Ergebnis an:
   - Tut das Plugin mehr, als der Wunsch sagt: ein Satz „… tut auch etwas, was du nicht gesagt hast: …
     Behalten?“ mit „Behalten“ (steht mit Datum in der Herkunft) und „Weg damit“ (Ändern-Lauf entfernt genau das).
   - Fasst das Plugin oder die Regel den Wunsch enger: „So lassen“ oder „Wie gesagt“ (Ändern-Lauf bzw. neue
     Fassung der Regel, so weit, wie der Wunsch es sagt).
   - Bricht es nach Einschätzung eine Regel, die sich nur als Satz prüfen lässt: Das erscheint beim Wächter
     wie die anderen Verstöße, gekennzeichnet als Einschätzung.
   Solange der Abgleich läuft, steht eine Zeile mit Fortschritt da (AGENTS.md: Fortschritt ist immer sichtbar). */
(function () {
  "use strict";
  var H = window.Huelle;
  var TAKT_MS = 1200;
  var MIT_BRUECKE = location.protocol === "http:";
  var stand = [];           // was /abgleich liefert
  var gezeigt = {};         // wunsch|art-nr → Meldung steht schon da
  var verfolgt = {};        // wunsch → Zeile mit Fortschritt

  function schicke(pfad, inhalt) {
    return fetch(pfad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inhalt) })
      .then(function (r) { if (!r.ok) throw new Error("Response " + r.status); return r.json(); });
  }

  function lade() {
    if (!MIT_BRUECKE) return Promise.resolve(stand);
    return fetch("/abgleich").then(function (r) { return r.ok ? r.json() : []; }).then(function (liste) {
      stand = liste || [];
      return stand;
    }).catch(function () { return stand; });
  }

  function wer(e) {
    return e.plugin ? "“" + (H.verwaltung.nameVon(e.plugin) || e.name || e.plugin) + "”" : "The rule “" + (e.regel ? e.regel.satz : "") + "”";
  }

  /* Ein Satz je offenem Punkt */
  function satz(e, art, p) {
    var was = p.was.replace(/\s+$/, "");
    if (art === "mehr") return wer(e) + " also does something you did not ask for: " + was + " Keep it?";
    if (p.regel && e.regel) return "The rule “" + e.regel.satz + "” makes your request narrower than you said it: " + was + " Leave it like this?";
    return wer(e) + " makes your request narrower than you said it: " + was + " Leave it like this?";
  }

  /* „Weg damit“ bzw. „Wie gesagt“: ein gewöhnlicher Ändern-Lauf mit Probelauf, wie jeder andere Wunsch */
  function aendern(e, art, p) {
    if (art === "mehr") {
      H.wunsch.aendere(e.plugin, "Remove exactly what I did not ask for: " + p.was +
        " Everything else in this plugin stays as it is. My request was: “" + e.wortlaut + "”");
    } else if (p.regel && e.regel) {
      H.wunsch.regelNeu(e.regel.kennung, "The rule “" + e.regel.satz + "” should apply as broadly as I said it: “" +
        e.wortlaut + "”. Too narrow is: " + p.was);
    } else {
      H.wunsch.aendere(e.plugin, "Implement my request as broadly as I said it: “" + e.wortlaut + "”. Too narrow is: " + p.was);
    }
  }

  function biete(e, art, p) {
    var schluessel = e.wunsch + "|" + art + "-" + p.nr;
    if (gezeigt[schluessel]) return;
    gezeigt[schluessel] = true;
    var ja = art === "mehr" ? "Keep" : "Leave it", nein = art === "mehr" ? "Remove it" : "As I said";
    var m = H.player.melde(satz(e, art, p), "abgleich", [
      { text: ja, tue: function (m) { entscheide(m, e, art, p, "behalten"); } },
      { text: nein, tue: function (m) { entscheide(m, e, art, p, "weg"); } }
    ]);
    m.dataset.abgleich = schluessel;
  }

  function entscheide(m, e, art, p, wahl) {
    m.remove();
    schicke("/abgleich/" + e.wunsch + "/entscheide", { art: art, nr: p.nr, wahl: wahl }).then(function () {
      (e.entscheidungen = e.entscheidungen || {})[art + "-" + p.nr] = { wahl: wahl, datum: new Date().toISOString() };
      if (wahl === "weg") aendern(e, art, p);
      else H.verwaltung.ladeStand().then(function () { H.leiste.zeichne(); });
    }).catch(function () {
      delete gezeigt[e.wunsch + "|" + art + "-" + p.nr];
      H.player.melde("The decision could not be saved.");
    });
  }

  /* Offene Punkte aller geltenden Abgleiche anbieten; was entschieden ist, kommt nicht wieder. */
  function bieteAn() {
    stand.forEach(function (e) {
      if (e.status !== "fertig" || !e.gilt) return;
      ["mehr", "enger"].forEach(function (art) {
        (e[art] || []).forEach(function (p) {
          if (!(e.entscheidungen || {})[art + "-" + p.nr]) biete(e, art, p);
        });
      });
    });
    if (H.waechter && H.waechter.neu) H.waechter.neu();
  }

  /* Fortschritt: „Abgleich mit deinem Wunsch läuft (seit 12 s, meist unter einer Minute): KI …“ */
  function verfolge(id) {
    if (!MIT_BRUECKE || verfolgt[id]) return;
    var zeile = null, beginn = Date.now();
    verfolgt[id] = true;
    function frage() {
      lade().then(function () {
        var e = stand.filter(function (x) { return x.wunsch === id; }).pop();
        var sek = Math.round((Date.now() - beginn) / 1000);
        if (!e && sek < 10) { setTimeout(frage, TAKT_MS); return; }
        if (e && e.status === "laeuft") {
          if (!zeile) zeile = H.player.melde("", "arbeit abgleich-lauf");
          zeile.querySelector("span").textContent = "Checking against your request in the background (for " + (e.sekunden || sek) +
            " s, usually under a minute), you can keep playing: AI " + (e.schritt || "beginnt");
          setTimeout(frage, TAKT_MS);
          return;
        }
        if (zeile) zeile.remove();
        delete verfolgt[id];
        if (e && e.status === "fehlgeschlagen") H.player.melde("The check against your request did not finish: " + (e.grund || "") + " The plugin is not changed.", "hinweis");
        bieteAn();
      });
    }
    frage();
  }

  H.abgleich = {
    lade: lade,
    verfolge: verfolge,
    /* Was gerade angeboten wird (für die Prüfung) */
    offen: function () {
      return Array.prototype.map.call(document.querySelectorAll("#meldungen .meldung.abgleich"), function (m) {
        return { schluessel: m.dataset.abgleich, satz: m.querySelector("span").textContent };
      });
    },
    stand: function () { return stand.slice(); },

    /* Verstöße gegen Regeln, die sich nur als Satz prüfen lassen, nach Einschätzung des Abgleichs.
       Gelten, solange das Plugin in der eingeschätzten Fassung eingeschaltet ist. Form wie beim Wächter. */
    verstoesse: function () {
      var aus = {}, out = [], gesehen = {};
      (H.verwaltung.eintraege() || []).forEach(function (x) { aus[x.kennung] = x; });
      stand.forEach(function (e) {
        if (e.status !== "fertig" || !e.gilt) return;
        (e.verstoesse || []).forEach(function (v) {
          var r = H.regeln[v.regel], p = aus[v.plugin];
          if (!r || (p && (!p.an || (p.fachlich && v.fassung && p.fachlich !== v.fassung)))) return;
          var schluessel = v.regel + "|plugins/" + v.plugin;
          if (gesehen[schluessel]) return;
          gesehen[schluessel] = true;
          out.push({
            schluessel: schluessel, regel: v.regel, pfade: [], einschaetzung: true, plugin: v.plugin,
            satz: v.satz + " – " + r.satz, kurz: v.satz, verursacher: v.plugin
          });
        });
      });
      return out;
    },

    start: function () {
      if (!MIT_BRUECKE) return;
      lade().then(function () {
        stand.forEach(function (e) { if (e.status === "laeuft") verfolge(e.wunsch); });
        bieteAn();
      });
    }
  };
})();
