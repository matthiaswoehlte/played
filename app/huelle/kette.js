/* Feste Hülle, Teil 13: Ketten (Auftrag 005, Stufe 1).
   Damit der PO sieht, was ein Ereignis ausgelöst hat: je Ursprungsereignis des laufenden Tags eine
   aufklappbare Kette, z. B. „R. Aldinger meldet sich ab 08:00 krank → … → Tagesplan, Konflikte“.
   Gelesen wird nur das Protokoll des Busses (nr, ausloeser, ursprung); die Worte kommen von den
   Plugins (erzaehle, beschreibeObjekt, beschreibe) und aus den Erzählungen. */
(function () {
  "use strict";
  var H = window.Huelle;
  var el = {};
  var offen = false;
  var aufgeklappt = {};   // Ursprung-Nr → aufgeklappt (übersteht das Neuzeichnen)

  function knoten(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function titel(k) { return H.titelVon(k); }
  function liste(xs) {
    return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " und " + xs[xs.length - 1];
  }

  /* ---------- Was der PO sieht ----------
     Wenig, präzise, nichts aus dem Maschinenraum (AGENTS.md, 08.11.): keine Pfade, Feldnamen,
     Kennungen. Mehrere Änderungen an einem Objekt werden ein Satz; was nur die Anzeige berührt
     (Liste auf- oder zugeklappt, Menü offen), erscheint nicht als eigenes Glied. Die Worte kommen
     von den Plugins (erzaehle, beschreibeObjekt, beschreibe), meist aus der Fachsprache. */
  function nurAnzeige(m) {
    var pfad = m.objekt + "/" + m.parameter.feld;
    return H.nurAnzeige().some(function (mu) { return H.passtPfad(mu, pfad); });
  }

  /* Ein geändertes Objekt in einem Satz */
  function objektSatz(g) {
    var s = H.beschreibeObjekt({ pfad: g.objekt, felder: g.felder });
    if (s) return s;
    var saetze = [];
    Object.keys(g.felder).forEach(function (feld) {
      var f = g.felder[feld], t = null;
      try { t = H.soll.satz([{ pfad: g.objekt + "/" + feld, alt: f.alt, neu: f.neu }], null); } catch (e) { t = null; }
      if (t && saetze.indexOf(t) === -1) saetze.push(t);
    });
    if (saetze.length) return saetze.join("; ");
    return g.durch ? "„" + titel(g.durch) + "“ ändert etwas, wofür es noch keine Worte gibt" : "Es ändert sich etwas, wofür es noch keine Worte gibt";
  }

  /* Die sichtbaren Glieder unter einer Nachricht: Änderungen je Objekt zusammengefasst, reine
     Anzeige weggelassen, Nachrichten ohne Worte und ohne sichtbare Folgen weggelassen. */
  function glieder(m, kinder) {
    var out = [], gruppen = {};
    (kinder[m.nr] || []).forEach(function (k) {
      if (k.aktion === "geaendert") {
        var unter = glieder(k, kinder);
        if (nurAnzeige(k) && !unter.length) return;
        var g = gruppen[k.objekt];
        if (!g) { g = gruppen[k.objekt] = { wert: true, objekt: k.objekt, felder: {}, durch: k.durch, unter: [] }; out.push(g); }
        var f = g.felder[k.parameter.feld];
        g.felder[k.parameter.feld] = { alt: f ? f.alt : k.parameter.alt, neu: k.parameter.neu };
        g.unter = g.unter.concat(unter);
        return;
      }
      var n = glied(k, kinder, false);
      if (n) out.push(n);
    });
    out.forEach(function (g) { if (g.wert) g.satz = objektSatz(g); });
    return out;
  }

  /* Eine Nachricht als Glied. Ohne Ursprung: Hat sie Änderungen am eigenen Objekt, sagt der Satz,
     was sich dort geändert hat (das Ergebnis statt der Ankündigung), es sei denn, ein Plugin hat
     eigene Worte für sie. Der Ursprung bleibt, was geschah („Disponent zieht …“). */
  function glied(m, kinder, ursprung) {
    var gl = glieder(m, kinder), satz = H.erzaehle(m);
    var eigen = gl.filter(function (g) { return g.wert && g.objekt === m.objekt; })[0];
    if (!satz && !ursprung && eigen) { satz = eigen.satz; gl = gl.filter(function (g) { return g !== eigen; }).concat(eigen.unter); }
    if (!satz && m.aktion === "verweigert") satz = "Verweigert: " + (m.parameter.grund || m.erzaehlung || "");
    if (!satz) satz = m.erzaehlung || null;
    if (!satz && !ursprung && !gl.length) return null;
    if (!satz) satz = "„" + (wer(m)[0] || "Ein Plugin") + "“ reagiert";
    return { m: m, satz: satz, wer: wer(m), unter: gl };
  }

  function wer(m) {
    var namen = [];
    if (m.durch) namen.push(titel(m.durch));
    (m.gerufen || []).forEach(function (k) { if (namen.indexOf(titel(k)) === -1) namen.push(titel(k)); });
    return namen;
  }

  /* Kinder je Nachricht */
  function baum() {
    var p = H.bus.protokoll, kinder = {}, wurzeln = [];
    p.forEach(function (m) {
      if (m.ursprung === m.nr) wurzeln.push(m);
      else (kinder[m.ausloeser] || (kinder[m.ausloeser] = [])).push(m);
    });
    return { wurzeln: wurzeln, kinder: kinder };
  }
  function sichtenVon(m, kinder, out) {
    (m.sichten || []).forEach(function (s) { if (out.indexOf(s) === -1) out.push(s); });
    (kinder[m.nr] || []).forEach(function (k) { sichtenVon(k, kinder, out); });
    return out;
  }
  function zahl(n) {
    return n.unter.reduce(function (z, k) { return z + 1 + zahl(k); }, 0);
  }

  /* Kurzform: Ursprung → erste Folgen → Ansichten */
  function kurzform(n, kinder) {
    var folgen = [];
    (function sammle(x) {
      x.unter.forEach(function (k) {
        if (!k.wert && folgen.length < 3 && folgen.indexOf(k.satz) === -1) folgen.push(k.satz);
        sammle(k);
      });
    })(n);
    var sichten = sichtenVon(n.m, kinder, []).map(titel);
    var teile = [n.satz];
    if (folgen.length) teile.push(folgen.join(" · "));
    if (sichten.length && n.unter.length) teile.push(sichten.join(", "));
    return teile.join(" → ");
  }

  function zeile(n) {
    var m = n.m;
    var li = knoten("li", "kette-glied" + (n.wert ? " kette-wert" : "") + (m && m.aktion === "verweigert" ? " kette-nein" : ""));
    if (m) li.dataset.nr = m.nr;
    li.appendChild(knoten("span", "kette-satz", n.satz));
    if (n.wert) { if (n.durch) li.appendChild(knoten("span", "kette-wer", "durch " + titel(n.durch))); }
    else if (n.wer.length) li.appendChild(knoten("span", "kette-wer", m.aktion === "geaendert" ? "durch " + n.wer[0] : "→ " + liste(n.wer)));
    if (n.unter.length) {
      var ul = knoten("ul");
      n.unter.forEach(function (x) { ul.appendChild(zeile(x)); });
      li.appendChild(ul);
    }
    return li;
  }

  /* Je Ursprung der sichtbare Baum; ohne Folgen heißt: kein sichtbares Glied und nicht zurückgenommen. */
  function ketten() {
    var b = baum();
    /* Anweisung 49 (e): nur Ketten der offenen Teil-App, außer bei „alle Bereiche“ */
    return b.wurzeln.filter(function (m) { return H.nachrichtImBlick(m); }).map(function (m) {
      var n = glied(m, b.kinder, true);
      return { m: m, n: n, kurz: kurzform(n, b.kinder), folgen: zahl(n), ohne: !zahl(n) && !m.zurueckgenommen };
    });
  }

  function zeichne() {
    if (!offen || !el.liste) return;
    var alle = ketten();
    el.liste.innerHTML = "";
    if (!alle.length) {
      el.liste.appendChild(knoten("div", "plugin-notiz", "Noch kein Ereignis. Spiel ein Szenario vor oder bediene die Anwendung."));
      return;
    }
    alle.slice().reverse().forEach(function (k) {
      if (k.ohne) return;
      var m = k.m;
      var d = knoten("details", "kette" + (m.zurueckgenommen ? " kette-zurueck" : ""));
      d.dataset.ursprung = m.nr;
      d.open = !!aufgeklappt[m.nr];
      d.addEventListener("toggle", function () { aufgeklappt[m.nr] = d.open; });
      var s = knoten("summary");
      s.appendChild(knoten("span", "kette-zeit", m.zeit));
      s.appendChild(knoten("span", "kette-kurz", k.kurz));
      s.appendChild(knoten("span", "kette-zahl", k.folgen === 1 ? "1 Folge" : k.folgen + " Folgen"));
      d.appendChild(s);
      if (m.zurueckgenommen) d.appendChild(knoten("div", "kette-meldung", "Zurückgenommen: " + m.zurueckgenommen));
      var ul = knoten("ul", "kette-baum");
      ul.appendChild(zeile(k.n));
      d.appendChild(ul);
      el.liste.appendChild(d);
    });
    /* Bedienungen ohne Folgen: eine graue Zeile, aufklappbar */
    var ohne = alle.filter(function (k) { return k.ohne; });
    if (ohne.length) {
      var d = knoten("details", "kette kette-ohne");
      d.open = !!aufgeklappt.ohne;
      d.addEventListener("toggle", function () { aufgeklappt.ohne = d.open; });
      d.appendChild(knoten("summary", null, ohne.length === 1 ? "1 Bedienung ohne Folgen" : ohne.length + " Bedienungen ohne Folgen"));
      var ul = knoten("ul", "kette-baum");
      ohne.slice().reverse().forEach(function (k) {
        var li = knoten("li", "kette-glied");
        li.appendChild(knoten("span", "kette-zeit", k.m.zeit));
        li.appendChild(knoten("span", "kette-satz", k.n.satz));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      el.liste.appendChild(d);
    }
  }

  function schalte(auf) {
    offen = auf;
    el.bereich.hidden = !offen;
    el.knopf.setAttribute("aria-expanded", String(offen));
    el.knopf.classList.toggle("an", offen);
    if (offen) zeichne();
    if (H.leiste && H.leiste.spalte) H.leiste.spalte();
  }

  H.kette = {
    sichtbar: function () { return offen; },
    zeige: function () { schalte(true); },
    /* Für die Prüfung: die Kurzformen aller Ketten, älteste zuerst */
    kurzformen: function () {
      return ketten().map(function (k) { return { nr: k.m.nr, kurz: k.kurz, zurueck: k.m.zurueckgenommen || null, ohneFolgen: k.ohne }; });
    },
    start: function () {
      el.bereich = document.getElementById("ketten");
      el.liste = document.getElementById("ketteListe");
      el.knopf = document.getElementById("ketteKnopf");
      el.zu = document.getElementById("kettenZu");
      el.zeile = document.getElementById("zeile");
      el.knopf.addEventListener("click", function () { schalte(!offen); });
      el.zu.addEventListener("click", function () { schalte(false); });
      /* Ein Klick auf die Erzählzeile klappt die Ketten auf, die jüngste offen */
      el.zeile.title = "Klick: Kette dieses Ereignisses aufklappen";
      el.zeile.addEventListener("click", function () {
        var w = baum().wurzeln;
        if (w.length) aufgeklappt[w[w.length - 1].nr] = true;
        schalte(true);
      });
      H.bus.abonniere("bus/takt.ruhe", zeichne, "huelle/kette");
      H.bus.abonniere("huelle/tag.neu", function () { aufgeklappt = {}; zeichne(); }, "huelle/kette");
    }
  };
})();
