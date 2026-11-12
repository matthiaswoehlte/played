/* Feste Hülle, Teil 6: Bedienung von Hand.
   Plugins melden in def.bedienungen an, was sich bei ihnen bedienen lässt. Die Hülle fängt
   Zeiger, Klick und Eingabe ab, lässt das Plugin daraus eine Nachricht bilden und schickt
   sie über den Bus, genau wie ein Drehbuch. Ob sie erlaubt ist, entscheiden die Prüfungen
   (def.prueft); dieselbe Antwort sieht man schon während des Ziehens.

   Bedienung: { kennung, titel, sicht, art, fasst, ziel, rollt, leer, zeiger, ereignis, vorschau }
     sicht     Kennung der Ansicht, in der sie gilt; ohne Angabe die eigene
     art       "ziehen" (Vorgabe), "klicken", "doppelklicken" oder "eingeben"
     fasst     CSS-Auswahl in der Ansicht. Das innerste gefasste Element gewinnt. Fassen mehrere
               Bedienungen dasselbe Element, gilt die erste, die etwas zurückgibt: So teilen sich
               kleine Plugins einen Zug, ohne voneinander zu wissen.
     ziel      nur ziehen: CSS-Auswahl der Ablageorte (mit data-pfad); zeigt den mitlaufenden Geist
     rollt     nur ziehen: CSS-Auswahl des Bereichs, der am Rand mitrollt
     leer      nur ziehen: Satz, solange noch kein Ereignis entsteht
     zeiger    nur ziehen: Mauszeiger während des Ziehens
     ereignis  function (g, h): Nachricht, { hinweis } oder null
     vorschau  nur ziehen: function (g, n, el, h) zeigt den Zug in der eigenen Ansicht */
(function () {
  "use strict";
  var H = window.Huelle;

  var SCHWELLE = 4;   // so viele px Weg, bevor aus einem Klick ein Ziehen wird
  var RAND = 24;      // Abstand zum unteren Bereichsrand in px, ab dem mitgerollt wird
  var RAND_OBEN = 44; // oben mit Platz für eine stehende Kopfzeile
  var ROLLEN = 12;    // Rollweg je Mausbewegung in px
  var RAND_SEITE = 32; // Abstand zum linken und rechten Bereichsrand in px, ab dem waagrecht mitgerollt wird
  var GESPERRT = "Nothing can be changed by hand while a scenario is playing.";

  var zug = null;
  var sperrHinweis = null;
  /* Anweisung 57: Ein Szenario führt eine Bedienung mit der Maus aus. Solange gilt die Sperre während des Vorspielens nicht für sie. */
  var ausSzenario = false;
  var gesendet = null;    // { plugin, bedienung } der Bedienung, die zuletzt eine Nachricht geschickt hat
  var gespielt = {};      // "plugin|bedienung" → true: Bedienungen, die ein Szenario mit der Maus ausgeführt hat
  function gesperrt() { return H.gesperrt() && !ausSzenario; }
  function sende(f, n) {
    var plugin = f.von[f.angebote.indexOf(f.b)];
    gesendet = { plugin: plugin, bedienung: f.b.kennung };
    if (ausSzenario) gespielt[plugin + "|" + (f.b.kennung || f.b.titel)] = true;
    H.handeln(n, absender(f));
  }

  function meldeGesperrt() {
    if (sperrHinweis && sperrHinweis.isConnected) return;
    sperrHinweis = H.player.melde(GESPERRT, "hinweis");
  }

  /* Die Bedienung, die zu dem Element unter dem Zeiger gehört */
  function finde(e, art) { return findeAn(e.target, art); }

  function findeAn(ziel, art) {
    var sicht = ziel && ziel.closest ? ziel.closest("[data-sicht]") : null;
    if (!sicht) return null;
    var kennung = sicht.getAttribute("data-sicht"), angebot = H.bedienungen(kennung);
    var innerstes = null, angebote = [], von = [];
    angebot.liste.forEach(function (b, i) {
      if ((b.art || "ziehen") !== art) return;
      var t = ziel.closest(b.fasst);
      if (!t || !sicht.contains(t)) return;
      if (t === innerstes) { angebote.push(b); von.push(angebot.von[i]); }
      else if (!innerstes || innerstes.contains(t)) { innerstes = t; angebote = [b]; von = [angebot.von[i]]; }
    });
    if (!innerstes) return null;
    var traeger = innerstes.closest("[data-pfad]");
    return {
      kennung: kennung, art: art, b: angebote[0], angebote: angebote, von: von, h: angebot.h, sicht: sicht, element: innerstes,
      pfad: traeger ? traeger.getAttribute("data-pfad") : null,
      daten: Object.assign({}, innerstes.dataset)
    };
  }

  function absender(f) { return "hand/" + f.kennung + "/" + f.b.kennung; }

  /* Die erste Angabe unter den Bedienungen dieses Griffs */
  function angabe(f, feld) {
    var mit = f.angebote.filter(function (b) { return b[feld]; })[0];
    return mit ? mit[feld] : undefined;
  }

  /* ---------- Wer eine Bedienung übernimmt ----------
     Geben mehrere Plugins zu derselben Bedienung etwas zurück, wollen sie sie alle übernehmen.
     Dann gilt die Wahl des PO; bis er wählt, die feste Reihenfolge (die erste, die etwas zurückgibt).
     Schlüssel: Ansicht, Art und die beteiligten Plugins. */
  var wahl = {};        // Schlüssel → { gewaehlt, datum, ... } vom PO
  var streit = null;    // Schlüssel → { schluessel, sicht, art, plugins, quelle, ziel, beispiel }
  var streitStand = null;

  function schluessel(kennung, art, wer) { return kennung + "|" + art + "|" + wer.slice().sort().join("+"); }

  function verschiedene(von) {
    return von.filter(function (k, i) { return von.indexOf(k) === i; });
  }

  /* Alle Bedienungen, die etwas zurückgeben, und die Plugins dazu, in fester Reihenfolge */
  function treffer(f, g, still) {
    var out = [];
    for (var i = 0; i < f.angebote.length; i++) {
      try {
        var n = f.angebote[i].ereignis(g, f.h);
        if (n) out.push({ i: i, n: n });
      } catch (e) { if (!still && !out.length) H.meldeFehler(f.kennung, e); }
    }
    return { liste: out, wer: verschiedene(out.map(function (t) { return f.von[t.i]; })) };
  }

  function merkeStreit(f, art, wer, g, n) {
    if (!streit) return;
    var s = schluessel(f.kennung, art, wer);
    if (streit[s]) return;
    streit[s] = { schluessel: s, sicht: f.kennung, art: art, plugins: wer, quelle: g.pfad, ziel: g.ziel ? g.ziel.pfad : null, beispiel: n && n.erzaehlung };
  }

  /* Die Bedienung, die etwas zurückgibt, ist ab da die gewählte. */
  function bilde(f, g) {
    var t = treffer(f, g, false);
    if (!t.liste.length) return null;
    var nimm = t.liste[0];
    if (t.wer.length > 1) {
      merkeStreit(f, f.art, t.wer, g, nimm.n);
      var w = wahl[schluessel(f.kennung, f.art, t.wer)];
      if (w) nimm = t.liste.filter(function (x) { return f.von[x.i] === w.gewaehlt; })[0] || nimm;
    }
    f.b = f.angebote[nimm.i];
    return nimm.n;
  }

  /* Sucht auf dem gezeichneten Stand jede Bedienung ab: jedes gefasste Element, beim Ziehen auf
     jedes Ziel. Nur lesen; dauert wenige Millisekunden. Neu bei jedem Tagesbeginn und wenn sich
     die Plugins ändern. */
  function suche() {
    var gefunden = {};
    document.querySelectorAll("[data-sicht]").forEach(function (sicht) {
      var kennung = sicht.getAttribute("data-sicht"), angebot = H.bedienungen(kennung);
      ["ziehen", "klicken", "doppelklicken", "eingeben"].forEach(function (art) {
        var von = angebot.von.filter(function (k, i) { return (angebot.liste[i].art || "ziehen") === art; });
        if (verschiedene(von).length < 2) return;
        var quellen = [];
        angebot.liste.forEach(function (b) {
          if ((b.art || "ziehen") !== art) return;
          sicht.querySelectorAll(b.fasst).forEach(function (el) { if (quellen.indexOf(el) === -1) quellen.push(el); });
        });
        quellen.forEach(function (el) {
          var f = findeAn(el, art);
          if (!f || f.sicht !== sicht || verschiedene(f.von).length < 2) return;
          var ziele = [null], auswahl = art === "ziehen" ? angabe(f, "ziel") : null;
          if (auswahl) document.querySelectorAll(auswahl).forEach(function (z) { ziele.push(z.getAttribute("data-pfad")); });
          ziele.forEach(function (z) {
            var g = { pfad: f.pfad, daten: f.daten, sicht: f.sicht, dx: 0, dy: 0, ziel: z ? { pfad: z } : null };
            if (art === "eingeben") g.wert = el.type === "checkbox" ? el.checked : el.value;
            var t = treffer(f, g, true);
            if (t.wer.length < 2) return;
            var s = schluessel(kennung, art, t.wer);
            if (!gefunden[s]) gefunden[s] = { schluessel: s, sicht: kennung, art: art, plugins: t.wer, quelle: f.pfad, ziel: z, beispiel: t.liste[0].n.erzaehlung };
          });
        });
      });
    });
    return gefunden;
  }

  /* Gefundenes bleibt, solange dieselben Plugins hängen: Was erst später möglich wird (etwa ein
     Auftrag in „Nicht zugewiesene Aufträge“), kommt dazu, sobald es gezeichnet ist. */
  var nachsuchen = true;
  function streitListe() {
    var stand = H.aktive().join(",");
    if (!streit || streitStand !== stand) { streitStand = stand; streit = {}; nachsuchen = true; }
    if (nachsuchen) {
      nachsuchen = false;
      try {
        var neu = suche();
        Object.keys(neu).forEach(function (s) { if (!streit[s]) streit[s] = neu[s]; });
      } catch (e) { H.meldeFehler("bedienung", e); }
    }
    return Object.keys(streit).sort().map(function (s) { return Object.assign({ wahl: wahl[s] || null }, streit[s]); });
  }

  function ladeWahl() {
    return fetch("/bedienungen").then(function (r) { return r.ok ? r.json() : []; }).then(function (liste) {
      wahl = {};
      (liste || []).forEach(function (e) { wahl[e.schluessel] = e; });
      if (H.leiste) H.leiste.zeichne();
    }).catch(function () {});
  }

  /* ---------- Klicken und Eingeben ---------- */
  function einmalig(e, art) {
    var f = finde(e, art);
    if (!f) return;
    if (gesperrt()) { e.preventDefault(); meldeGesperrt(); return; }
    var t = e.target;
    var n = bilde(f, {
      pfad: f.pfad, daten: f.daten, sicht: f.sicht,
      wert: art === "eingeben" ? (t.type === "checkbox" ? t.checked : t.value) : undefined
    });
    if (n && n.objekt) sende(f, n);
  }

  /* ---------- Ziehen ---------- */
  function zielUnter(z) {
    var auswahl = angabe(z, "ziel");
    if (!auswahl) return null;
    var e = document.elementFromPoint(z.x, z.y);
    var t = e ? e.closest(auswahl) : null;
    return t ? { element: t, pfad: t.getAttribute("data-pfad") } : null;
  }

  /* Was der Zug gerade bedeuten würde: Lage, Nachricht und Urteil dazu */
  function auswerten(z) {
    var ziel = zielUnter(z);
    var g = {
      pfad: z.pfad, daten: z.daten, sicht: z.sicht,
      dx: z.x - z.x0, dy: z.y - z.y0, ziel: ziel ? { pfad: ziel.pfad } : null
    };
    var n = bilde(z, g), urteil;
    if (!n || !n.objekt) {
      var leer = z.angebote.map(function (b) { return b.leer; }).filter(Boolean).join(" · ");
      urteil = { art: "leer", text: (n && n.hinweis) || leer };
    } else {
      var nein = H.urteil(n);
      urteil = nein ? { art: "nein", text: "✕ " + nein.grund }
        : { art: "ja", text: "✓ " + (n.hinweis || n.erzaehlung || "") };
    }
    return { g: g, n: n && n.objekt ? n : null, roh: n, urteil: urteil, ziel: ziel };
  }

  function geistBauen(z) {
    var r = z.element.closest("[data-pfad]").getBoundingClientRect();
    var c = z.element.closest("[data-pfad]").cloneNode(true);
    c.removeAttribute("data-pfad");
    c.removeAttribute("title");
    c.querySelectorAll("[data-pfad]").forEach(function (k) { k.removeAttribute("data-pfad"); });
    c.classList.add("huelle-geist");
    c.style.position = "fixed";
    c.style.width = r.width + "px";
    c.style.height = r.height + "px";
    z.greifX = z.x0 - r.left;
    z.greifY = z.y0 - r.top;
    document.body.appendChild(c);
    z.geist = c;
  }

  function tippBauen(z) {
    z.tipp = document.createElement("div");
    document.body.appendChild(z.tipp);
  }

  function zielMarkeLoeschen() {
    document.querySelectorAll(".huelle-ziel-ja, .huelle-ziel-nein").forEach(function (e) {
      e.classList.remove("huelle-ziel-ja", "huelle-ziel-nein");
    });
  }

  /* Läuft auch nach einem Neuzeichnen während des Ziehens: nichts davon hängt an alten Elementen. */
  function zeigen(z) {
    var w = auswerten(z);
    zielMarkeLoeschen();
    if (w.ziel && w.urteil.art !== "leer") w.ziel.element.classList.add("huelle-ziel-" + w.urteil.art);
    document.body.classList.toggle("huelle-verboten", w.urteil.art === "nein");

    if (z.geist) {
      var quelle = z.sicht.querySelector('[data-pfad="' + z.pfad + '"]');
      if (quelle) {
        quelle.classList.add("huelle-quelle");
        quelle.removeAttribute("title");
      }
      z.geist.style.left = z.x - z.greifX + "px";
      z.geist.style.top = z.y - z.greifY + "px";
    }
    /* Die gewählte Bedienung zeigt ihren Zug zuletzt; die anderen räumen ihren auf. */
    var gewaehlt = w.roh ? z.b : null;
    z.angebote.filter(function (b) { return b !== gewaehlt; }).concat(gewaehlt ? [gewaehlt] : []).forEach(function (b) {
      if (!b.vorschau) return;
      try { b.vorschau(w.g, b === gewaehlt ? w.roh : null, z.sicht, z.h); }
      catch (e) { H.meldeFehler(z.kennung, e); }
    });

    z.tipp.className = "huelle-tipp huelle-tipp-" + w.urteil.art;
    z.tipp.textContent = w.urteil.text;
    z.tipp.hidden = !w.urteil.text;
    z.tipp.style.left = Math.max(0, Math.min(z.x + 12, window.innerWidth - z.tipp.offsetWidth - 4)) + "px";
    z.tipp.style.top = Math.max(0, z.y - 36) + "px";
  }

  function rollen(z) {
    var auswahl = angabe(z, "rollt");
    var bereich = auswahl ? z.sicht.querySelector(auswahl) : null;
    if (!bereich) return;
    var r = bereich.getBoundingClientRect();
    if (z.y < r.top + RAND_OBEN) bereich.scrollTop -= ROLLEN;
    else if (z.y > r.bottom - RAND) bereich.scrollTop += ROLLEN;
    /* Anweisung 61: auch waagrecht (zweitägiger Plan), aber nur, solange der Zeiger über dem Bereich steht; wer in eine
       Liste daneben zieht, soll den Plan nicht verschieben. */
    if (z.y >= r.top && z.y <= r.bottom) {
      if (z.x >= r.left && z.x < r.left + RAND_SEITE) bereich.scrollLeft -= ROLLEN;
      else if (z.x <= r.right && z.x > r.right - RAND_SEITE) bereich.scrollLeft += ROLLEN;
    }
  }

  function beginnen(e) {
    if (e.button !== 0 || zug) return;
    var f = finde(e, "ziehen");
    if (!f) return;
    /* Steckt im ziehbaren Element etwas zum Klicken (z. B. ein Menü im Balken), gewinnt dort der Klick. */
    var k = finde(e, "klicken");
    if (k && k.element !== f.element && f.element.contains(k.element)) return;
    if (gesperrt()) { meldeGesperrt(); return; }
    e.preventDefault();
    zug = Object.assign(f, {
      zeigerNr: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, laeuft: false
    });
    /* Ein Zeiger, den ein Szenario führt, lässt sich nicht einfangen; die Hülle hört ohnehin am Dokument. */
    try { f.sicht.setPointerCapture(e.pointerId); } catch (x) { /* dann ohne */ }
  }

  function bewegen(e) {
    if (!zug || e.pointerId !== zug.zeigerNr) return;
    var z = zug;
    z.x = e.clientX;
    z.y = e.clientY;
    if (!z.laeuft) {
      if (Math.abs(z.x - z.x0) + Math.abs(z.y - z.y0) < SCHWELLE) return;
      z.laeuft = true;
      document.body.classList.add("huelle-zieht");
      document.body.style.setProperty("--huelle-zeiger", angabe(z, "zeiger") || "grabbing");
      if (angabe(z, "ziel")) geistBauen(z);
      tippBauen(z);
    }
    rollen(z);
    zeigen(z);
  }

  /* Beendet den Zug. Die Ansicht zeichnet sich neu, damit keine Vorschau stehen bleibt;
     dann geht die Nachricht auf den Bus, auch wenn sie verweigert wird: Das sagt die
     Erzählzeile wie beim Vorspielen, am Plan ändert sich nichts. */
  function beenden(abbruch) {
    var z = zug;
    zug = null;
    var n = z.laeuft && !abbruch && !gesperrt() ? auswerten(z).n : null;
    if (z.sicht.hasPointerCapture(z.zeigerNr)) z.sicht.releasePointerCapture(z.zeigerNr);
    if (z.geist) z.geist.remove();
    if (z.tipp) z.tipp.remove();
    zielMarkeLoeschen();
    document.body.classList.remove("huelle-zieht", "huelle-verboten");
    if (z.laeuft) H.zeichneNeu(z.kennung);
    if (n) sende(z, n);
  }

  /* ---------- Anweisung 57: Bedienung im Szenario, mit der Maus wie von Hand ----------
     Schritt: { zeit, bedienung: "ziehen"|"klicken"|"doppelklicken", greift: "<pfad>", sicht?, griff?: "links"|"rechts",
     nach?: "<pfad des Ablageorts>", minuten?: Zahl, erzaehlung? }. Die Hülle sucht das Element mit dem Pfad, wie es auf
     der Seite liegt, und schickt Zeigerereignisse an das, was dort oben liegt: Drücken, Bewegen, Loslassen. Was dabei
     nicht greift oder sich nicht ablegen lässt, steht in H.bedienFehler, mit einem Satz für den Anforderer und einem für die KI. */
  var ZEIGER = 57;          // eigene Zeigernummer, damit die echte Maus nicht dazwischenkommt
  var SCHRITTE = 8;

  function esc(t) { return window.CSS && CSS.escape ? CSS.escape(t) : String(t).replace(/["\\]/g, "\\$&"); }
  function lage(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; }
  function obenAuf(el, x, y) { var t = document.elementFromPoint(x, y); return t && (t === el || el.contains(t)) ? t : null; }

  /* ---------- Anweisung 61 (a): Der Probelauf rollt wie ein Mensch ----------
     Vor dem Greifen, vor dem Ablegen und vor dem Prüfen des erwarteten Endes kommt die Stelle in den sichtbaren Ausschnitt,
     waagrecht und senkrecht. Gerollt wird nur, wo die Stelle nicht frei zu sehen ist oder am Rand liegt (dort rollen Hülle
     und Plugins beim Ziehen mit); dann so, dass sie in der Mitte des Bereichs steht. */
  var SICHER = 80;   // Abstand zum Rand eines rollenden Bereichs, ab dem eine Stelle als frei zu sehen gilt

  function wurzelVon(sicht) {
    return sicht ? document.querySelector('[data-sicht="' + esc(sicht) + '"]') : document.getElementById("nutzbereich") || document.body;
  }
  function rollbar(e) {
    var c = getComputedStyle(e);
    var x = /(auto|scroll|overlay)/.test(c.overflowX) && e.scrollWidth > e.clientWidth + 1;
    var y = /(auto|scroll|overlay)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 1;
    return x || y ? { el: e, x: x, y: y } : null;
  }
  /* Die rollenden Bereiche um ein Element, der innerste zuerst */
  function rahmen(el) {
    var out = [];
    for (var e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      var r = rollbar(e);
      if (r) out.push(r);
    }
    return out;
  }
  /* Ein Bild weiter, damit ein Plugin auf das Rollen antworten kann (z. B. Datum oben links, nur Sichtbares zeichnen) */
  function bildWeiter() {
    return new Promise(function (ok) {
      var fertig = false;
      function f() { if (!fertig) { fertig = true; ok(); } }
      requestAnimationFrame(f);
      setTimeout(f, 50);
    });
  }
  /* Ist etwas vom Element im sichtbaren Ausschnitt, also nicht von einem rollenden Bereich abgeschnitten? */
  function imAusschnitt(e) {
    var r = lage(e);
    if (!r) return false;
    var l = Math.max(0, r.left), o = Math.max(0, r.top), re = Math.min(window.innerWidth, r.right), u = Math.min(window.innerHeight, r.bottom);
    rahmen(e).forEach(function (k) { var b = innen(k); l = Math.max(l, b.l); o = Math.max(o, b.o); re = Math.min(re, b.r); u = Math.min(u, b.u); });
    return re > l && u > o;
  }
  function innen(k) {
    var b = k.el.getBoundingClientRect(), l = b.left + k.el.clientLeft, o = b.top + k.el.clientTop;
    return { l: l, o: o, r: l + k.el.clientWidth, u: o + k.el.clientHeight };
  }

  /* Bringt die Stelle (fx, fy, gemessen vom Element aus) in den sichtbaren Ausschnitt. hole() liefert das Element, auch
     wenn ein Plugin es beim Rollen neu gezeichnet hat. Ergebnis: { el, x, y } auf dem Bildschirm, oder null. */
  async function insBild(hole, fx, fy) {
    for (var runde = 0; runde < 3; runde++) {
      var el = hole(), r = el && lage(el);
      if (!r) return null;
      var gerollt = false;
      var liste = rahmen(el);
      for (var i = 0; i < liste.length; i++) {
        var k = liste[i], b = innen(k);
        r = lage(el);
        var x = r.left + fx, y = r.top + fy;
        var mx = Math.min(SICHER, (b.r - b.l) / 4), my = Math.min(SICHER, (b.u - b.o) / 4);
        /* In der zweiten Runde war die Stelle frei, aber verdeckt (stehende Kopfzeile, Namensspalte): dann in die Mitte. */
        var mitte = runde > 0 && i === 0;
        if (k.x && (mitte || x < b.l + mx || x > b.r - mx)) { var vl = k.el.scrollLeft; k.el.scrollLeft += x - (b.l + b.r) / 2; gerollt = gerollt || k.el.scrollLeft !== vl; }
        if (k.y && (mitte || y < b.o + my || y > b.u - my)) { var vo = k.el.scrollTop; k.el.scrollTop += y - (b.o + b.u) / 2; gerollt = gerollt || k.el.scrollTop !== vo; }
      }
      r = lage(el);
      var fx2 = r.left + fx, fy2 = r.top + fy;
      if (fx2 < 0 || fy2 < 0 || fx2 > window.innerWidth || fy2 > window.innerHeight) {
        window.scrollBy(fx2 - window.innerWidth / 2, fy2 - window.innerHeight / 2);
        gerollt = true;
      }
      if (gerollt) await bildWeiter();
      el = hole();
      r = el && lage(el);
      if (!r) return null;
      var px = r.left + fx, py = r.top + fy;
      if (px >= 0 && py >= 0 && px <= window.innerWidth && py <= window.innerHeight && obenAuf(el, px, py)) return { el: el, x: px, y: py };
      if (!gerollt && runde > 0) return null;
    }
    return null;
  }

  /* Elemente mit diesem Pfad, die auf der Seite Platz einnehmen; das gezogene selbst ausgenommen */
  function kandidaten(pfad, sicht, ausser) {
    var wurzel = wurzelVon(sicht);
    if (!wurzel) return [];
    return Array.prototype.filter.call(wurzel.querySelectorAll('[data-pfad="' + esc(pfad) + '"]'), function (el) {
      return !(ausser && (ausser === el || ausser.contains(el) || el.contains(ausser))) && lage(el);
    });
  }

  /* Steht das Element gar nicht auf der Seite, weil ein Plugin nur das Sichtbare zeichnet, rollt der Probelauf die
     Bereiche der Ansicht durch, wie ein Mensch, der sucht. Höchstens 60 Stellen; sonst bleibt alles, wie es war. */
  async function sucheDurchRollen(pfad, sicht, ausser) {
    var wurzel = wurzelVon(sicht);
    if (!wurzel) return false;
    var bereiche = Array.prototype.map.call(wurzel.querySelectorAll("*"), rollbar).filter(Boolean);
    var stellen = 0;
    for (var i = 0; i < bereiche.length && stellen < 60; i++) {
      var k = bereiche[i], el = k.el, alt = { l: el.scrollLeft, o: el.scrollTop };
      var sx = Math.max(1, el.clientWidth * 0.8), sy = Math.max(1, el.clientHeight * 0.8);
      var maxL = k.x ? el.scrollWidth - el.clientWidth : 0, maxO = k.y ? el.scrollHeight - el.clientHeight : 0;
      for (var o = 0; o <= maxO + sy - 1 && stellen < 60; o += sy) {
        for (var l = 0; l <= maxL + sx - 1 && stellen < 60; l += sx) {
          el.scrollLeft = Math.min(l, maxL); el.scrollTop = Math.min(o, maxO);
          stellen++;
          await bildWeiter();
          if (kandidaten(pfad, sicht, ausser).length) return true;
        }
      }
      el.scrollLeft = alt.l; el.scrollTop = alt.o;
    }
    if (stellen) await bildWeiter();
    return false;
  }

  /* Das Element mit diesem Pfad, so wie die Maus es träfe: sichtbar, in den Blick gerollt, nicht verdeckt.
     stelle(el) sagt, welcher Punkt des Elements gemeint ist: { fx, fy }. Ergebnis { el, x, y } oder
     { el, verdeckt: true } (da, aber nicht frei zu sehen) oder null (nicht auf der Seite). */
  async function greifbar(pfad, sicht, ausser, stelle) {
    var alle = kandidaten(pfad, sicht, ausser);
    if (!alle.length && await sucheDurchRollen(pfad, sicht, ausser)) alle = kandidaten(pfad, sicht, ausser);
    if (!alle.length) return null;
    for (var i = 0; i < alle.length; i++) {
      var p = stelle(alle[i]), nr = i;
      var t = await insBild(function () {
        var neu = kandidaten(pfad, sicht, ausser);
        return alle[nr] && alle[nr].isConnected ? alle[nr] : neu[nr] || neu[0] || null;
      }, p.fx, p.fy);
      if (t) { t.fx = p.fx; t.fy = p.fy; return t; }
    }
    return { el: alle[0], verdeckt: true };
  }

  /* Wie der Anforderer das Objekt kennt: Name aus dem Datenmodell, sonst was dort steht */
  function nameVon(pfad, el) {
    var h = H.bedienungen("").h, n = null;
    try { n = h.nenne(pfad); } catch (e) { /* dann vom Bildschirm */ }
    if (!n && el) n = el.getAttribute("aria-label") || (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return n || pfad.split("/").pop();
  }
  function beschreibe(t) {
    if (!t) return "nichts";
    var w = t.closest("[data-pfad]");
    return "<" + t.tagName.toLowerCase() + (t.className && typeof t.className === "string" ? " class=\"" + t.className + "\"" : "") + ">" +
      (w ? " in [data-pfad=\"" + w.getAttribute("data-pfad") + "\"]" : "") + (t.closest("[data-sicht]") ? " in the view \"" + t.closest("[data-sicht]").getAttribute("data-sicht") + "\"" : "");
  }
  function angeboteText(el, art) {
    var s = el && el.closest("[data-sicht]");
    if (!s) return "The element is not in any view.";
    var a = H.bedienungen(s.getAttribute("data-sicht"));
    var l = a.liste.map(function (b, i) { return (b.art || "ziehen") === art ? "`" + a.von[i] + "` " + (b.kennung || "") + " grabs `" + b.fasst + "`" + (b.ziel ? ", target `" + b.ziel + "`" : "") : null; }).filter(Boolean);
    return l.length ? "Actions of this kind in the view ”" + s.getAttribute("data-sicht") + "”: " + l.join("; ") + "."
      : "In the view ”" + s.getAttribute("data-sicht") + "” there is no action of the kind ”" + art + "”.";
  }

  /* Anweisung 58: Damit die KI ein Szenario mit echten Kennungen nachbessern kann: Gibt es das Objekt, und was ist
     in der Ansicht zu diesem Zeitpunkt zu greifen? Höchstens 12 Pfade derselben Art, mit dem, was darauf steht. */
  function wasDaIst(pfad, sicht) {
    var daten = null;
    try { daten = H.zustand.lies(pfad); } catch (e) { /* dann gibt es das Objekt nicht */ }
    var satz = daten ? " The object exists in the data (" + JSON.stringify(daten).slice(0, 300) + "), but it is not visible at this point."
      : " There is no object with this path in the data; use an identifier from the data.";
    var wurzel = sicht ? document.querySelector('[data-sicht="' + esc(sicht) + '"]') : document.getElementById("nutzbereich");
    if (!wurzel) return satz + (sicht ? " The view \"" + sicht + "\" is not on the page." : "");
    var art = pfad.split("/")[0] + "/", gesehen = {}, liste = [];
    /* Anweisung 61 (b): zuerst, was im Ausschnitt steht, dann, was der Probelauf durch Rollen erreicht */
    var alle = Array.prototype.filter.call(wurzel.querySelectorAll('[data-pfad^="' + esc(art) + '"]'), function (e) { return lage(e); });
    alle.filter(imAusschnitt).concat(alle).forEach(function (e) {
      var p = e.getAttribute("data-pfad");
      if (gesehen[p] || liste.length >= 12) return;
      gesehen[p] = true;
      liste.push(p + " (“" + (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30) + "”)");
    });
    return satz + (liste.length ? " Visible at this point" + (sicht ? " in \"" + sicht + "\"" : "") + ": " + liste.join(", ") + "."
      : " At this point nothing with paths \"" + art + "…\" is visible there.");
  }

  function zeiger(art, ziel, x, y, extra) {
    var e = new PointerEvent(art, Object.assign({
      bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y,
      pointerId: ZEIGER, pointerType: "mouse", isPrimary: true, button: 0, buttons: art === "pointerup" ? 0 : 1
    }, extra || {}));
    return (ziel || document.body).dispatchEvent(e);
  }
  function maus(art, ziel, x, y, detail) {
    return ziel.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: detail || 1 }));
  }

  /* Minuten auf der Zeitachse in Bildpunkte: am nächsten Rahmen mit data-von und data-bis */
  function proMinute(el) {
    var achse = el.closest("[data-von][data-bis]");
    if (!achse) return null;
    function min(v) { return /:/.test(v) ? H.bedienungen("").h.minuten(v) : Number(v); }
    var von = min(achse.getAttribute("data-von")), bis = min(achse.getAttribute("data-bis")), r = achse.getBoundingClientRect();
    return bis > von && r.width ? r.width / (bis - von) : null;
  }

  function scheitert(satz, ki) {
    H.bedienFehler.push({ satz: satz, ki: ki });
    if (H.player && !new URLSearchParams(location.search).has("nachspielen")) H.player.melde(satz, "fehler");
    return false;
  }

  /* Anweisung 61 (b): Was die KI über die Ansicht erfährt, gilt auch fürs Ablegen: welche Ablageorte der Bedienung zu
     diesem Zeitpunkt zu sehen sind, höchstens 12, mit dem, was darauf steht. */
  function ablageText(oben) {
    var s = oben && oben.closest("[data-sicht]");
    if (!s) return "";
    var a = H.bedienungen(s.getAttribute("data-sicht")), gesehen = {}, liste = [];
    a.liste.forEach(function (b) {
      if ((b.art || "ziehen") !== "ziehen" || !b.ziel) return;
      var treffer = [];
      try { treffer = document.querySelectorAll(b.ziel); } catch (e) { return; }
      Array.prototype.forEach.call(treffer, function (e) {
        var p = e.getAttribute("data-pfad"), r = lage(e);
        if (!p || gesehen[p] || !r || liste.length >= 12) return;
        if (!imAusschnitt(e)) return;
        gesehen[p] = true;
        liste.push(p + " (“" + (e.getAttribute("aria-label") || (e.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 30) + "”)");
      });
    });
    return liste.length ? " Drop targets visible at this moment: " + liste.join(", ") + "." : " No drop target for this action is visible at this moment.";
  }

  async function spiele(s, mittel) {
    var art = s.bedienung, pfad = String(s.greift || "");
    var pause = mittel && mittel.minute ? 60 : 0;
    function warte() { return pause ? new Promise(function (ok) { setTimeout(ok, pause); }) : Promise.resolve(); }
    /* Anweisung 61 (a): Die Stelle zum Greifen kommt in den sichtbaren Ausschnitt, wie der Anforderer hinrollen würde. */
    var griff = await greifbar(pfad, s.sicht, null, function (e) {
      var r = lage(e);
      return { fx: s.griff === "links" ? Math.min(2, r.width / 4) : s.griff === "rechts" ? r.width - Math.min(2, r.width / 4) : r.width / 2, fy: r.height / 2 };
    });
    var el = griff && griff.el;
    var name = nameVon(pfad, el);
    /* Anweisung 58, AGENTS.md: Gibt es das Objekt gar nicht, hat es keinen Namen; dann keine Kennung im Satz für den PO. */
    var gibtEs = false;
    try { gibtEs = H.zustand.lies(pfad) !== undefined; } catch (e) { /* gibt es nicht */ }
    if (!griff) return scheitert(gibtEs ? name + " is not visible on the page." : "What this step should grab with the mouse does not exist in the sample data.",
      "In scenario step " + JSON.stringify(s) + " there is no visible element with data-pfad=\"" + pfad + "\"" + (s.sicht ? " in the view \"" + s.sicht + "\"" : "") +
      ", not even after scrolling through the view." + wasDaIst(pfad, s.sicht));
    if (griff.verdeckt) {
      var r0 = lage(el), oben0 = r0 ? document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2) : null;
      return scheitert(name + " cannot be scrolled into view.",
        "In step " + JSON.stringify(s) + " [data-pfad=\"" + pfad + "\"] could not be made fully visible by scrolling; on top in its place is: " + beschreibe(oben0) + "." + wasDaIst(pfad, s.sicht));
    }
    var x = griff.x, y = griff.y;
    var oben = document.elementFromPoint(x, y);
    gesendet = null;
    ausSzenario = true;
    try {
      if (art === "klicken" || art === "doppelklicken") {
        zeiger("pointerdown", oben, x, y); zeiger("pointerup", oben, x, y); maus("click", oben, x, y, 1);
        if (art === "doppelklicken") { zeiger("pointerdown", oben, x, y); zeiger("pointerup", oben, x, y); maus("click", oben, x, y, 2); maus("dblclick", oben, x, y, 2); }
        if (!gesendet) return scheitert((art === "doppelklicken" ? "A double-click" : "A click") + " on " + name + " does nothing.",
          "At step " + JSON.stringify(s) + " no action sent a message. Under the pointer: " + beschreibe(oben) + ". " + angeboteText(oben, art));
        return true;
      }
      /* Ziehen: Drücken. Nimmt die Hülle den Zug nicht an, würde der Browser stattdessen Text markieren. */
      var angenommen = !zeiger("pointerdown", oben, x, y);
      maus("mousedown", oben, x, y);
      if (!zug || !angenommen) {
        if (zug) beenden(true);
        return scheitert(name + " cannot be dragged with the mouse.",
          "At step " + JSON.stringify(s) + " no action accepts the drag; the browser would select text. Under the pointer: " + beschreibe(oben) + ". " + angeboteText(oben, "ziehen"));
      }
      /* Wohin losgelassen wird: ein Punkt auf dem Ablageort, oder auf dem gezogenen Objekt selbst, um „minuten“ versetzt */
      var zielPfad = s.nach ? String(s.nach) : pfad, ausser = s.nach ? el : null, zielName = s.nach ? nameVon(zielPfad, null) : name;
      var px = null;
      if (s.minuten) {
        px = proMinute(el);
        if (!px && s.nach) { var z0 = kandidaten(zielPfad, null, el)[0]; px = z0 && proMinute(z0); }
        if (!px) { beenden(true); return scheitert(name + " cannot be moved along the time axis.",
          "In step " + JSON.stringify(s) + " \"minuten\" is set, but above [data-pfad=\"" + pfad + "\"] there is no frame with data-von and data-bis (time axis in minutes)."); }
      }
      var versatz = s.minuten ? s.minuten * px : 0;
      var stelle = function (e) {
        var r = lage(e);
        if (!s.nach) return { fx: x - r.left + versatz, fy: y - r.top };
        /* Wie ein Mensch: gerade hinüber, wo der Ablageort dort zu sehen ist; sonst in die Mitte dessen, was von ihm zu sehen
           ist (eine Gerätezeile über zwei Tage ist viel breiter als der Ausschnitt). Ist nichts von ihm zu sehen, in seine Mitte. */
        var bx = x + versatz, vl = Math.max(0, r.left), vr = Math.min(window.innerWidth, r.right);
        rahmen(e).forEach(function (k) { var b = innen(k); vl = Math.max(vl, b.l); vr = Math.min(vr, b.r); });
        var m = Math.min(SICHER, (vr - vl) / 4);
        var fx = vr - vl > 4 ? (bx >= vl + m && bx <= vr - m ? bx : (vl + vr) / 2) - r.left : r.width / 2;
        return { fx: fx, fy: r.height / 2 };
      };
      /* Ohne Ablageort (nur auf der Zeitachse verschieben) liegt der Endpunkt neben dem Objekt, wie bisher. */
      var ziel = s.nach ? await greifbar(zielPfad, null, ausser, stelle) : { el: el, x: x + versatz, y: y };
      if (!ziel || ziel.verdeckt) {
        beenden(true);
        return scheitert(ziel ? zielName + " cannot be scrolled into view." : zielName + " is not visible on the page.",
          "In step " + JSON.stringify(s) + (ziel ? " the target [data-pfad=\"" + zielPfad + "\"] could not be made fully visible by scrolling."
            : " there is no visible target with data-pfad=\"" + zielPfad + "\", not even after scrolling through the view.") + wasDaIst(zielPfad, null) + ablageText(oben));
      }
      /* Nachgefasst wird an derselben Stelle des Ablageorts, an die gerollt wurde. */
      var zielEl = ziel.el, zp = s.nach ? { fx: ziel.fx, fy: ziel.fy } : null, zx = ziel.x, zy = ziel.y;
      /* Das Rollen kann das Gegriffene verschoben haben; der Weg beginnt dort, wo der Zeiger steht. Erst ein kleines Stück
         zur Seite, wie die Hand beim Anfassen: Liegt der Ablageort nach dem Rollen an derselben Stelle auf dem Bildschirm,
         würde aus dem Drücken sonst nie ein Ziehen. */
      zeiger("pointermove", document.elementFromPoint(x + SCHWELLE + 4, y), x + SCHWELLE + 4, y);
      for (var i = 1; i <= SCHRITTE; i++) {
        var px2 = x + (zx - x) * i / SCHRITTE, py2 = y + (zy - y) * i / SCHRITTE;
        zeiger("pointermove", document.elementFromPoint(px2, py2), px2, py2);
        await warte();
      }
      /* Ist beim Ziehen etwas mitgerollt (Rand) oder neu gezeichnet worden, steht das Ziel jetzt woanders: nachfassen. */
      for (var n = 0; s.nach && n < 3; n++) {
        var jetzt = zielEl.isConnected ? zielEl : kandidaten(zielPfad, null, ausser)[0];
        var jr = jetzt && lage(jetzt);
        if (!jr) break;
        var nx = jr.left + zp.fx, ny = jr.top + zp.fy;
        if (Math.abs(nx - zx) < 1 && Math.abs(ny - zy) < 1) break;
        zielEl = jetzt; zx = nx; zy = ny;
        zeiger("pointermove", document.elementFromPoint(zx, zy), zx, zy);
        await warte();
      }
      var unter = document.elementFromPoint(zx, zy);
      zeiger("pointerup", unter, zx, zy);
      maus("mouseup", unter || document.body, zx, zy);
      if (!gesendet) {
        var wohin = s.nach ? " onto " + nameVon(zielPfad, zielEl) : "";
        return scheitert(name + " cannot be dropped" + wohin + ".",
          "In step " + JSON.stringify(s) + " no action sent a message on release. Under the pointer on release: " + beschreibe(unter) + ". " +
          angeboteText(oben, "ziehen") + ablageText(oben));
      }
      return true;
    } finally {
      if (zug) beenden(true);
      ausSzenario = false;
    }
  }

  H.bedienung = {
    /* Anweisung 57: einen Schritt eines Szenarios mit der Maus ausführen; true, wenn eine Bedienung eine Nachricht geschickt hat */
    spiele: spiele,
    /* Anweisung 61 (a): Vor dem Prüfen des erwarteten Endes kommt, was eine Ansicht zeigen soll, in den sichtbaren Ausschnitt,
       wie der Anforderer hinrollen würde. Ergebnis: { saetze, ki }: je ein Satz für den Anforderer (nur, wenn das Objekt einen
       Namen hat, nie eine Kennung) und einer für die KI mit dem, was in der Ansicht stattdessen zu sehen ist. */
    zeigeErwartetes: async function (d) {
      var saetze = [], ki = [], liste = H.soll.geltende(d);
      for (var i = 0; i < liste.length; i++) {
        for (var k = 0; k < liste[i].pruefe.length; k++) {
          var p = liste[i].pruefe[k];
          if (p.sicht === undefined || !p.enthaelt) continue;
          var pf = String(p.enthaelt);
          var t = await greifbar(pf, p.sicht, null, function (e) { var r = lage(e); return { fx: r.width / 2, fy: r.height / 2 }; });
          if (t && !t.verdeckt) continue;
          var gibtEs = false;
          try { gibtEs = H.zustand.lies(pf) !== undefined; } catch (e) { /* gibt es nicht */ }
          var bekannt = null;
          try { bekannt = H.bedienungen("").h.nenne(pf); } catch (e) { /* ohne Namen */ }
          if (!bekannt && t && t.el) bekannt = t.el.getAttribute("aria-label");
          if (bekannt && (t || gibtEs)) saetze.push(bekannt + " cannot be brought into the visible area.");
          ki.push("The expectation ”" + liste[i].text + "” looks for [data-pfad=\"" + pf + "\"] in the view \"" + p.sicht + "\"; " +
            (t ? "it could not be made fully visible by scrolling." : "it is not there, not even after scrolling through the view.") + wasDaIst(pf, p.sicht));
        }
      }
      return { saetze: saetze, ki: ki };
    },
    /* Bedienungen, die Szenarien seit dem Leeren mit der Maus ausgeführt haben: ["plugin|bedienung"] */
    gespielt: function () { return Object.keys(gespielt).sort(); },
    gespieltLeeren: function () { gespielt = {}; },
    /* Wo mehrere Plugins dieselbe Bedienung übernehmen wollen: [{ schluessel, sicht, art, plugins, quelle, ziel, beispiel, wahl }] */
    streit: function () { return streitListe(); },
    streitVon: function (kennung) {
      return streitListe().filter(function (x) { return x.plugins.indexOf(kennung) !== -1; });
    },
    /* Der PO wählt, welches Plugin die Bedienung übernimmt; satz und name gehen in die Herkunft. */
    waehle: function (x, kennung, satz, name) {
      return fetch("/bedienungen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schluessel: x.schluessel, plugins: x.plugins, gewaehlt: kennung, satz: satz, name: name })
      }).then(function (r) { if (!r.ok) throw new Error("The choice could not be saved"); return ladeWahl(); });
    },

    /* Die Wahl des PO, wer eine umstrittene Bedienung übernimmt, gilt auch in den Kopien des Probelaufs. */
    wahlListe: function () { return Object.keys(wahl).map(function (s) { return wahl[s]; }); },
    setzeWahl: function (liste) { wahl = {}; (liste || []).forEach(function (e) { wahl[e.schluessel] = e; }); },

    /* still: in der unsichtbaren Kopie des Probelaufs; die Wahl kommt dort mit dem Auftrag. */
    start: function (still) {
      if (!still) ladeWahl();
      H.bus.abonniere("huelle/tag.neu", function () { nachsuchen = true; }, "huelle/bedienung");
      document.addEventListener("pointerdown", beginnen, true);
      document.addEventListener("pointermove", bewegen);
      document.addEventListener("pointerup", function (e) {
        if (zug && e.pointerId === zug.zeigerNr) beenden(false);
      });
      document.addEventListener("pointercancel", function (e) {
        if (zug && e.pointerId === zug.zeigerNr) beenden(true);
      });
      document.addEventListener("keydown", function (e) {
        if (zug && e.key === "Escape") beenden(true);
      });
      /* Der Browser soll Balken und Text nicht selbst als Bild mitziehen. */
      document.addEventListener("dragstart", function (e) {
        if (finde(e, "ziehen")) e.preventDefault();
      });
      document.addEventListener("click", function (e) { einmalig(e, "klicken"); });
      document.addEventListener("dblclick", function (e) { einmalig(e, "doppelklicken"); });
      document.addEventListener("change", function (e) { einmalig(e, "eingeben"); });

      H.bus.abonniere("huelle/sicht.gezeichnet", function (m) {
        nachsuchen = true;
        if (zug && zug.laeuft && zug.kennung === m.parameter.kennung) zeigen(zug);
      }, "huelle/bedienung");
      H.bus.abonniere("huelle/sicht.entfernt", function (m) {
        if (zug && zug.kennung === m.parameter.kennung) beenden(true);
      }, "huelle/bedienung");
    }
  };
})();
