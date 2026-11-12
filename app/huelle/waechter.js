/* Feste Hülle, Teil 10: Wächter über die Regeln.
   Der Wächter meldet, er handelt nicht: Er ändert keinen Zustand, sperrt keine Nachricht und
   korrigiert nichts. Sperren vor dem Zustellen bleibt Sache von `prueft` in den Plugins.

   Geprüft werden nur Regeln der Art „bedingung“, deren Geltungsbereich auf dem Weg vom
   Played Flow (Pfad in den Daten) nach oben liegt. Geprüft wird bei Tagesbeginn und wenn
   eine Kette durch ist (bus/takt.ruhe), gleich ob aus Drehbuch oder von Hand; dazu beim
   Nachspielen am Ende jedes Drehbuchs. Kommt der Bus-Vertrag (005), hängt sich der Wächter
   dort an das Kettenende, sonst ändert sich nichts.

   Die Regelliste ist Maschinenraum: In der Seite stehen nur Verstöße als Sätze und auf
   Nachfrage („Warum?“) die eine Regel mit ihrem Wortlaut. */
(function () {
  "use strict";
  var H = window.Huelle;
  var SCHLUESSEL = "play/waechter/1";
  var LEUCHTEN_MS = 6000;
  var TAKT = { duration: LEUCHTEN_MS / 8, iterations: 8, direction: "alternate", easing: "ease-in-out" };
  /* Weiß, nicht Koralle: Koralle heißt im Tagesplan „Konflikt“, das Leuchten zeigt nur, worum es geht. */
  var OBJEKT = [
    { boxShadow: "0 0 0 1px rgba(255,255,255,.6)", filter: "brightness(1.1)", zIndex: 5 },
    { boxShadow: "0 0 0 3px #fff, 0 0 14px 4px rgba(255,255,255,.75)", filter: "brightness(1.5)", zIndex: 5 }
  ];

  var jetzt = [];          // Verstöße am Zustand, wie er gerade ist
  var amEnde = {};         // je Drehbuch: { titel, verstoesse } aus dem Nachspielen
  var aufrufe = {};        // je Regel: wie oft geprüft (Maschinenraum, für die Prüfung)
  var fehler = [];         // Regeln, die beim Prüfen ausgefallen sind
  var ansicht = { offen: false };
  var warum = {};          // Schlüssel → „Warum?“ aufgeklappt
  var inKauf = {};         // Schlüssel → Entscheidung des PO, den Verstoß bewusst in Kauf zu nehmen
  var el = {};
  var gezeichnet = null;

  /* Liegt der Geltungsbereich auf dem Weg vom Played Flow nach oben? */
  function gilt(regel, flowPfad) {
    if (!flowPfad) return false;
    return flowPfad === regel.pfad || flowPfad.indexOf(regel.pfad + "/") === 0;
  }

  function pruefeAlle() {
    var flow = H.tag && H.tag.pfad, out = [], gesehen = {};
    Object.keys(H.regeln).sort().forEach(function (k) {
      var r = H.regeln[k];
      if (r.art !== "bedingung" || !gilt(r, flow)) return;
      aufrufe[k] = (aufrufe[k] || 0) + 1;
      var liste;
      try { liste = r.pruefe(H.lesend) || []; }
      catch (e) {
        fehler.push({ regel: k, text: e && e.message ? e.message : String(e) });
        if (window.console) console.error("Regel " + k + ":", e);
        return;
      }
      liste.forEach(function (v) {
        var pfade = (v.pfade || []).slice();
        var schluessel = k + "|" + pfade.slice().sort().join(",");
        if (gesehen[schluessel]) return;
        gesehen[schluessel] = true;
        out.push({
          schluessel: schluessel, regel: k, pfade: pfade,
          satz: v.satz + " – " + r.satz,
          kurz: v.satz, ab: v.ab || null,
          verursacher: H.verursacher(pfade)
        });
      });
    });
    return out;
  }

  /* ---------- Wo ein Verstoß entsteht ----------
     Je abgeschlossener Kette merkt sich der Wächter, welche Nachricht sie angestoßen hat (aus dem
     Drehbuch oder von Hand) und was er danach meldete. Entstanden ist ein Verstoß bei der Kette,
     ab der ein Verstoß derselben Regel an denselben Objekten ohne Unterbrechung bis jetzt besteht.
     Die betroffenen Objekte dürfen sich unterwegs ändern (bei XC 810 kommen Aufträge dazu), solange
     sich die Meldungen von Kette zu Kette ein Objekt teilen. */
  var verlauf = [];        // [{ ausloeser, schritt, verstoesse }] seit Tagesbeginn
  var gelesen = 0;         // so weit ist das Protokoll des Busses gelesen
  var schritte = 0;        // so viele Ereignisse aus Drehbüchern seit Tagesbeginn

  function vonAussen(m) { return /^(drehbuecher|hand)\//.test(m.absender || ""); }
  function gleicher(a, b) {
    return a.regel === b.regel && a.pfade.some(function (p) { return b.pfade.indexOf(p) !== -1; });
  }
  /* Die Nachricht, die die gerade abgeschlossene Kette angestoßen hat */
  function ausloeserDerKette() {
    var p = H.bus.protokoll, erste = null;
    for (var i = gelesen; i < p.length; i++) {
      if (!vonAussen(p[i])) continue;
      if (!erste) erste = p[i];
      if (/^drehbuecher\//.test(p[i].absender)) schritte++;
    }
    gelesen = p.length;
    return erste;
  }
  function entstehung(v) {
    var i = verlauf.length - 1;
    if (i < 0 || !verlauf[i].verstoesse.some(function (w) { return gleicher(w, v); })) return null;
    var bei = null;
    for (; i >= 0; i--) {
      var w = verlauf[i].verstoesse.filter(function (x) { return gleicher(x, bei || v); })[0];
      if (!w) break;
      bei = w;
    }
    var e = verlauf[i + 1];
    if (!e.ausloeser) return { tagesbeginn: true };
    var m = e.ausloeser;
    return {
      schritt: /^drehbuecher\//.test(m.absender) ? e.schritt : null,
      von: m.absender, zeit: m.zeit, erzaehlung: m.erzaehlung || null, objekt: m.objekt, aktion: m.aktion,
      kurz: bei.kurz, ab: bei.ab, pfade: bei.pfade.slice()
    };
  }

  function neuGeprueft(m) {
    jetzt = pruefeAlle();
    if (m && m.objekt === "huelle/tag") {
      verlauf = []; gelesen = 0; schritte = 0;
      verlauf.push({ ausloeser: null, schritt: 0, verstoesse: jetzt });
    } else if (m && m.objekt === "bus/takt") {
      var a = ausloeserDerKette();
      if (a) verlauf.push({ ausloeser: a, schritt: schritte, verstoesse: jetzt });
    }
    jetzt.forEach(function (v) { v.entsteht = entstehung(v); });
    if (el.liste) zeichne();
  }

  H.bus.abonniere("huelle/tag.neu", neuGeprueft, "huelle/waechter");
  H.bus.abonniere("bus/takt.ruhe", neuGeprueft, "huelle/waechter");

  /* ---------- Anzeige ---------- */
  function knoten(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function knopf(text, tue, klasse) {
    var b = knoten("button", klasse, text);
    b.type = "button";
    b.addEventListener("click", tue);
    return b;
  }
  function datum(iso) {
    var t = String(iso || "").split("-");
    return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : "";
  }

  /* Ein Eintrag je Verstoß: jetzt im Tagesplan und/oder am Ende von Drehbüchern */
  function eintraege() {
    var out = {}, reihe = [];
    function nimm(v) {
      if (!out[v.schluessel]) {
        out[v.schluessel] = { v: v, jetzt: false, drehbuecher: [] };
        reihe.push(v.schluessel);
      }
      return out[v.schluessel];
    }
    jetzt.forEach(function (v) { var e = nimm(v); e.jetzt = true; e.entsteht = v.entsteht || null; });
    /* Regeln, die sich nur als Satz prüfen lassen: Einschätzung aus dem Abgleich nach dem Einspielen */
    if (H.abgleich) H.abgleich.verstoesse().forEach(function (v) { nimm(v).einschaetzung = true; });
    Object.keys(amEnde).forEach(function (k) {
      amEnde[k].verstoesse.forEach(function (v) {
        if (H.regeln[v.regel]) nimm(v).drehbuecher.push({ kennung: k, titel: amEnde[k].titel, entsteht: v.entsteht || null });
      });
    });
    return reihe.filter(function (k) { return H.punkte.hierZuhause("verstoss|" + k); }).map(function (k) { return out[k]; });
  }

  function loesche() {
    document.getAnimations().forEach(function (a) { if (a.id === "verstoss") a.cancel(); });
  }
  function leuchte(pfade) {
    loesche();
    var erstes = null;
    pfade.forEach(function (p) {
      document.querySelectorAll('[data-sicht] [data-pfad="' + p + '"]').forEach(function (t) {
        if (!t.animate) return;
        var lauf = t.animate(OBJEKT, TAKT);
        lauf.id = "verstoss";
        if (!erstes) erstes = t;
      });
    });
    if (erstes && erstes.scrollIntoView) (erstes.closest(".pl-zeile") || erstes).scrollIntoView({ block: "nearest" });
  }

  function warumBlock(r) {
    var d = knoten("div", "verstoss-warum");
    d.appendChild(knoten("div", null, "Regel: " + r.satz));
    if (r.wortlaut) d.appendChild(knoten("blockquote", null, r.wortlaut));
    var h = r.herkunft || {};
    d.appendChild(knoten("div", "plugin-notiz", [datum(h.datum), h.wie, h.quelle].filter(Boolean).join(" · ")));
    return d;
  }

  /* Welches Drehbuch zeigt, wie der Verstoß entsteht? Zuerst die, an deren Ende er steht;
     sonst das, das gerade im Tagesplan gelaufen ist. */
  function vorspielbar(e) {
    var d = e.drehbuecher.filter(function (x) { return x.entsteht && x.entsteht.schritt; })[0];
    if (d) return { kennung: d.kennung, entsteht: d.entsteht };
    var s = e.jetzt && e.entsteht;
    if (s && s.schritt && /^drehbuecher\//.test(s.von)) {
      var kennung = s.von.slice("drehbuecher/".length);
      if (H.drehbuecher.some(function (x) { return x.kennung === kennung; })) return { kennung: kennung, entsteht: s };
    }
    return null;
  }
  /* Entsteht der Verstoß in keinem Drehbuch, sagt ein Satz, woher er stammt. */
  function nichtVorspielbar(e) {
    var s = e.jetzt && e.entsteht;
    if (s && /^hand\//.test(s.von || "")) {
      return "Nichts vorzuspielen: Der Verstoß entstand von Hand um " + s.zeit +
        (s.erzaehlung ? " („" + s.erzaehlung + "“)" : "") + ", nicht in einem Szenario.";
    }
    var amTag = (s && s.tagesbeginn) || e.drehbuecher.some(function (x) { return x.entsteht && x.entsteht.tagesbeginn; });
    if (amTag) return "Nichts vorzuspielen: Der Verstoß steht schon im gemockten Tag, bevor das erste Ereignis kommt.";
    return "Nichts vorzuspielen: Der Verstoß stammt aus einem früheren Stand, kein Szenario lässt ihn entstehen.";
  }

  function zeichneEintrag(e) {
    var v = e.v, r = H.regeln[v.regel];
    var k = knoten("div", "verstoss");
    k.dataset.regel = v.regel;
    k.dataset.schluessel = v.schluessel;
    var satz = knopf(v.satz, function () { if (e.jetzt) leuchte(v.pfade); }, "verstoss-satz");
    if (!e.jetzt) satz.disabled = true;
    k.appendChild(satz);

    var wo = [];
    if (e.einschaetzung) {
      k.classList.add("einschaetzung");
      wo.push("Einschätzung der KI zum Plugin „" + (H.verwaltung.nameVon(v.plugin) || v.plugin) + "“, nach dem Einspielen; nicht am Tagesplan geprüft");
    }
    if (e.jetzt) wo.push("Jetzt im Tagesplan");
    if (e.drehbuecher.length) {
      wo.push("Am Ende von " + e.drehbuecher.map(function (d) { return "„" + d.titel + "“"; }).join(", "));
    }
    k.appendChild(knoten("div", "verstoss-wo", wo.join(" · ")));

    /* Der Mensch entscheidet: Ein bewusst in Kauf genommener Verstoß bleibt sichtbar, so gekennzeichnet. */
    var kauf = inKauf[v.schluessel];
    if (kauf) {
      k.classList.add("in-kauf");
      k.appendChild(knoten("div", "verstoss-in-kauf", "Bewusst in Kauf genommen am " + datum(String(kauf.datum).slice(0, 10)) +
        (kauf.wunsch ? " (beim Einspielen von " + kauf.wunsch + ")" : "")));
    }

    var fuss = knoten("div", "knopfzeile");
    fuss.appendChild(knopf("Warum?", function () { warum[v.schluessel] = !warum[v.schluessel]; gezeichnet = null; zeichne(); }, "warum"));
    if (location.protocol === "http:") {
      if (kauf) fuss.appendChild(knopf("Nicht mehr in Kauf nehmen", function () { entscheide("/in-kauf/zurueck", { schluessel: v.schluessel }); }, "nicht-in-kauf"));
      else fuss.appendChild(knopf("Bewusst in Kauf nehmen", function () {
        entscheide("/in-kauf", { schluessel: v.schluessel, regel: v.regel, satz: v.satz });
      }, "in-kauf-nehmen"));
    }
    if (v.verursacher) {
      fuss.appendChild(knopf("Zum Plugin", function () { H.leiste.zeige(v.verursacher); }, "zum-plugin"));
    }
    /* „Vorspielen“ zeigt den Moment, in dem der Verstoß entsteht, und steht da, solange er besteht. */
    var ziel = vorspielbar(e);
    if (ziel) {
      fuss.appendChild(knopf("Vorspielen", function () {
        H.player.spieleBisVerstoss(ziel.kennung, ziel.entsteht);
      }, "vorspielen"));
    }
    k.appendChild(fuss);
    if (!ziel && !e.einschaetzung) k.appendChild(knoten("div", "verstoss-herkunft", nichtVorspielbar(e)));
    if (warum[v.schluessel] && r) k.appendChild(warumBlock(r));
    return k;
  }

  /* Entscheidungen liegen als Datei hinter der Brücke, nicht im Browser. */
  function uebernimm(liste) {
    inKauf = {};
    (liste || []).forEach(function (e) { inKauf[e.schluessel] = e; });
    gezeichnet = null;
    if (el.liste) zeichne();
  }
  function entscheide(pfad, inhalt) {
    return fetch(pfad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inhalt) })
      .then(function (r) { if (!r.ok) throw new Error("Antwort " + r.status); return r.json(); })
      .then(uebernimm)
      .then(function () { H.punkte.entschieden("verstoss", inhalt.schluessel); })
      .catch(function () { H.player.melde("Die Entscheidung ließ sich nicht speichern."); });
  }
  function ladeInKauf() {
    if (location.protocol !== "http:") return Promise.resolve();
    return fetch("/in-kauf").then(function (r) { return r.ok ? r.json() : []; }).then(uebernimm).catch(function () {});
  }

  function anzahlText(n) { return n === 1 ? "1 Regelverstoß" : n + " Regelverstöße"; }

  function zeichne() {
    var liste = eintraege();
    var inhalt = JSON.stringify([liste.map(function (e) {
      return [e.v.schluessel, e.v.satz, e.v.verursacher, e.jetzt, e.drehbuecher, !!e.einschaetzung];
    }), warum, H.player && H.player.laeuftGerade()]);
    el.knopf.hidden = !liste.length;
    el.knopf.textContent = anzahlText(liste.length);
    H.leiste.spalte();
    if (gezeichnet === inhalt) return;
    gezeichnet = inhalt;
    el.liste.textContent = "";
    liste.forEach(function (e) { el.liste.appendChild(zeichneEintrag(e)); });
  }

  function merke() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(ansicht)); } catch (e) { /* gilt bis zum Neuladen */ }
  }

  /* Ein Satz für die Erzählzeile: welche Nachricht den Verstoß ausgelöst hat */
  function satzZurEntstehung(s) {
    var was = s.erzaehlung || (s.objekt + " " + s.aktion);
    return "Hier entsteht der Verstoß: " + was + " – ab jetzt " + (s.ab || "gilt: " + s.kurz) + ".";
  }

  H.waechter = {
    gilt: gilt,
    leuchte: leuchte,
    loesche: loesche,
    satzZurEntstehung: satzZurEntstehung,
    /* Nach einer neuen Regel: am Zustand, wie er gerade ist, neu prüfen */
    neu: neuGeprueft,
    /* Bewusst in Kauf genommen? Solche Verstöße halten keinen Probelauf auf. */
    istInKauf: function (schluessel) { return !!inKauf[schluessel]; },
    ladeInKauf: ladeInKauf,
    jetzt: function () { return jetzt.slice(); },
    aufrufe: function () { return Object.assign({}, aufrufe); },
    fehler: function () { return fehler.slice(); },
    anzahl: function () { return el.liste ? eintraege().length : jetzt.length; },
    sichtbar: function () { return !!el.liste && ansicht.offen && eintraege().length > 0; },

    /* Was die Liste zeigt, ohne Darstellung (für die Prüfung) */
    eintraege: function () {
      return eintraege().map(function (e) {
        var ziel = vorspielbar(e);
        return { satz: e.v.satz, regel: e.v.regel, schluessel: e.v.schluessel, inKauf: !!inKauf[e.v.schluessel], jetzt: e.jetzt, einschaetzung: !!e.einschaetzung, drehbuecher: e.drehbuecher.map(function (d) { return d.kennung; }),
          vorspielen: ziel, herkunft: ziel ? null : nichtVorspielbar(e) };
      });
    },

    /* Ergebnis des Nachspielens: je Drehbuch die Verstöße an seinem Ende */
    nachgespielt: function (drehbuecher) {
      amEnde = {};
      Object.keys(drehbuecher || {}).forEach(function (k) {
        var d = drehbuecher[k];
        if (d.verstoesse && d.verstoesse.length) amEnde[k] = { titel: d.titel, verstoesse: d.verstoesse };
      });
      if (el.liste) zeichne();
    },
    /* Verstöße am Ende eines Drehbuchs (für die Prüfung) */
    amEnde: function (kennung) { return amEnde[kennung] ? amEnde[kennung].verstoesse.slice() : []; },
    zeichne: function () { if (el.liste) zeichne(); },
    /* Anweisung 30c: öffnet die Stelle, an der der PO über diesen Verstoß entscheidet, mit seiner Regel. */
    zeigeStelle: function (schluessel) {
      ansicht.offen = true;
      warum[schluessel] = true;
      merke();
      gezeichnet = null;
      zeichne();
      return Array.prototype.filter.call(el.liste.children, function (x) { return x.dataset.schluessel === schluessel; })[0] || null;
    },

    start: function () {
      el.knopf = document.getElementById("verstossKnopf");
      el.bereich = document.getElementById("verstoesse");
      el.liste = document.getElementById("verstossListe");
      try { Object.assign(ansicht, JSON.parse(localStorage.getItem(SCHLUESSEL)) || {}); } catch (e) { /* bleibt zu */ }
      el.knopf.addEventListener("click", function () {
        ansicht.offen = !ansicht.offen;
        merke();
        zeichne();
        /* Beim Aufklappen leuchten die Balken, um die es gerade geht. */
        if (ansicht.offen) {
          var pfade = [];
          jetzt.forEach(function (v) { v.pfade.forEach(function (p) { if (pfade.indexOf(p) === -1) pfade.push(p); }); });
          leuchte(pfade);
        }
      });
      document.getElementById("verstoesseZu").addEventListener("click", function () {
        ansicht.offen = false;
        merke();
        zeichne();
      });
      jetzt = pruefeAlle();
      zeichne();
      ladeInKauf();
    }
  };
})();
