/* Feste Hülle, Teil 12: bewusste Lücken (Auftrag 006, Stufe 3).
   - „Lässt sich hier nicht zeigen“: Regeln der Art „nicht-zeigbar“ (Antwortzeit, Last, Sicherheit …),
     entlang des Played Flows. Ein kleiner Zähler neben dem Wunschfeld, aufklappbar mit je einem Satz.
     Sie bleiben sichtbar, bis der echte Code sie prüft.
   - „Ohne Szenario“: Plugins und Regeln, die kein Szenario berührt, je ein Satz. Ein Klick legt den Satz
     als Anfang eines Wunsches ins Wunschfeld.
     Ein Plugin, das auf Nachrichten reagiert (Abonnent oder Prüfung), berührt ein Szenario, wenn es darin
     gerufen wird, etwas tut oder das Szenario ohne es anders endet. Reine Anzeige zeigt sich in jedem. Eine Regel (Bedingung) berührt ein Szenario, wenn das Szenario ein Feld
     ändert, das ihre Bedingung liest (Feld je Bereich, Sternchen statt Kennung). Regeln, die sich nur als
     Satz prüfen lassen, prüft der Abgleich am Plugin, nicht am Szenario; sie stehen hier nicht. */
(function () {
  "use strict";
  var H = window.Huelle;
  var SCHLUESSEL = "play/luecken/1";
  var ansicht = { offen: null };   // null · "nicht-zeigbar" · "ohne-szenario" · "faelle"
  var MIT_DATEIEN = location.protocol === "http:";
  var abgehakt = {};               // Fall ohne Regel → { satz, datum }: „Braucht keine Regel“
  var el = {};
  var gelesen = {};                // Regel → Felder, die ihre Bedingung liest
  var gezeichnet = null;

  function knoten(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function datum(iso) {
    var t = String(iso || "").slice(0, 10).split("-");
    return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : "";
  }
  function flow() { return H.tag && H.tag.pfad; }
  function gilt(r) { return H.waechter.gilt(r, flow()); }

  function nichtZeigbar() {
    return Object.keys(H.regeln).sort().map(function (k) { return H.regeln[k]; })
      .filter(function (r) { return r.art === "nicht-zeigbar" && gilt(r); });
  }

  /* Welche Felder liest die Bedingung einer Regel? Einmal am Zustand bei Tagesbeginn gemessen, nur lesend. */
  function felderVon(r) {
    if (gelesen[r.kennung]) return gelesen[r.kennung];
    var felder = {};
    function leser(bereich, o) {
      return new Proxy(o, { get: function (t, k) {
        if (typeof k === "string" && k !== "kennung") felder[bereich + "/*/" + k] = true;
        return t[k];
      } });
    }
    var h = Object.assign({}, H.lesend, {
      alle: function (b) {
        return (H.lesend.alle(b) || []).map(function (o) { return o && typeof o === "object" ? leser(b, o) : o; });
      },
      lies: function (p) {
        var t = String(p).split("/"), w = H.lesend.lies(p);
        if (t.length >= 3) felder[t[0] + "/*/" + t[2]] = true;
        else if (t.length === 2 && w && typeof w === "object") return leser(t[0], w);
        return w;
      }
    });
    try { r.pruefe(h); } catch (e) { /* der Wächter meldet das selbst */ }
    gelesen[r.kennung] = Object.keys(felder);
    return gelesen[r.kennung];
  }

  /* [{ art: "plugin"|"regel", kennung, satz }] oder null, solange die Messung noch läuft */
  function ohneSzenario() {
    if (!H.verwaltung.fertig() || H.verwaltung.beruehrt("gantt") === null) return null;
    var out = [];
    H.verwaltung.eintraege().forEach(function (e) {
      /* Nur was auf Nachrichten reagiert; reine Anzeige zeigt sich in jedem Szenario. */
      if (!e.an || e.art === "datei" || !H.reagiert(e.kennung)) return;
      var tut = H.verwaltung.drehbuecherVon(e.kennung) || [], beruehrt = H.verwaltung.beruehrt(e.kennung) || [];
      if (tut.length || beruehrt.length || H.verwaltung.gerufen(e.kennung)) return;
      out.push({ art: "plugin", kennung: e.kennung, satz: "There is no scenario for “" + e.name + "”." });
    });
    var geaendert = H.verwaltung.geaenderteFelder();
    Object.keys(H.regeln).sort().forEach(function (k) {
      var r = H.regeln[k];
      if (r.art !== "bedingung" || !gilt(r)) return;
      var liest = felderVon(r);
      if (liest.some(function (f) { return geaendert[f]; })) return;
      out.push({ art: "regel", kennung: k, satz: "There is no scenario for the rule “" + r.satz + "”." });
    });
    return out;
  }

  /* ---------- Fälle ohne Regel (Auftrag 005, Stufe 2) ----------
     Aus dem Datenmodell und den Szenarien: Fristen und Ereignisse, auf die kein Plugin hört, und
     Ereignisse, die Aufträge ändern, ohne auf ihren Status zu achten. Gruppiert nach Objektart. */
  function faelle() {
    var blind = H.verwaltung.fertig() ? H.verwaltung.statusBlind() : H.statusBlind();
    return H.faelleOhneRegel(blind);
  }
  /* Anweisung 31a: In der Steuerleiste stehen nur die Fälle der offenen Teil-App. */
  function faelleHier() {
    return faelle().map(function (g) {
      return { art: g.art, name: g.name, faelle: g.faelle.filter(function (f) { return H.punkte.hierZuhause("fall|" + f.schluessel); }) };
    }).filter(function (g) { return g.faelle.length; });
  }
  H.faelleOffen = function () {
    return faelle().reduce(function (n, g) { return n + g.faelle.filter(function (f) { return !abgehakt[f.schluessel]; }).length; }, 0);
  };
  function hakeAb(f, keine) {
    if (keine) abgehakt[f.schluessel] = { satz: f.satz, datum: new Date().toISOString() };
    else delete abgehakt[f.schluessel];
    gezeichnet = null;
    zeichne();
    if (!MIT_DATEIEN) return;
    fetch("/faelle", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schluessel: f.schluessel, satz: f.satz, keine: keine }) })
      .then(function (r) { if (!r.ok) throw new Error("Answer " + r.status); H.punkte.entschieden("fall", f.schluessel); })
      .catch(function () { H.player.melde("Could not save that this case needs no rule."); });
  }
  function ladeAbgehakte() {
    if (!MIT_DATEIEN) return Promise.resolve();
    return fetch("/faelle").then(function (r) { return r.ok ? r.json() : []; }).then(function (liste) {
      abgehakt = {};
      liste.forEach(function (e) { abgehakt[e.schluessel] = { satz: e.satz, datum: e.datum }; });
      gezeichnet = null;
      zeichne();
    }).catch(function () { /* ohne Brücke: nur bis zum Neuladen */ });
  }
  function zeichneFaelle(gruppen) {
    el.faelleListe.textContent = "";
    var erledigt = [];
    gruppen.forEach(function (g) {
      var offen = g.faelle.filter(function (f) { return !abgehakt[f.schluessel]; });
      erledigt = erledigt.concat(g.faelle.filter(function (f) { return abgehakt[f.schluessel]; }));
      if (!offen.length) return;
      el.faelleListe.appendChild(knoten("h3", "faelle-art", g.name));
      offen.forEach(function (f) {
        var d = knoten("div", "luecke");
        d.dataset.fall = f.schluessel;
        var b = knoten("button", "luecke-satz luecke-wunsch", f.satz);
        b.type = "button";
        b.title = "Put into the request field as the start of a request";
        b.addEventListener("click", function () { H.wunsch.vorbelegen(f.wunsch); });
        d.appendChild(b);
        if (f.zuletzt) d.appendChild(knoten("div", "plugin-notiz", "Just now: " + f.zuletzt + "."));
        var k = knoten("button", "fall-keine", "Needs no rule");
        k.type = "button";
        k.addEventListener("click", function () { hakeAb(f, true); });
        d.appendChild(k);
        el.faelleListe.appendChild(d);
      });
    });
    if (!erledigt.length) return;
    var det = knoten("details", "faelle-erledigt");
    det.appendChild(knoten("summary", null, erledigt.length === 1 ? "1 case needs no rule" : erledigt.length + " cases need no rule"));
    erledigt.forEach(function (f) {
      var d = knoten("div", "luecke");
      d.dataset.fallErledigt = f.schluessel;
      d.appendChild(knoten("div", "luecke-satz", f.satz.replace(/: keine Regel\.$/, "")));
      d.appendChild(knoten("div", "plugin-notiz", "Needs no rule, you said on " + datum(abgehakt[f.schluessel].datum) + "."));
      var k = knoten("button", "fall-keine", "Needs a rule after all");
      k.type = "button";
      k.addEventListener("click", function () { hakeAb(f, false); });
      d.appendChild(k);
      det.appendChild(d);
    });
    el.faelleListe.appendChild(det);
  }

  function merke() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(ansicht)); } catch (e) { /* gilt bis zum Neuladen */ }
  }
  function schalte(was) {
    ansicht.offen = ansicht.offen === was ? null : was;
    merke();
    gezeichnet = null;
    zeichne();
  }

  function zeichne() {
    if (!el.nzKnopf) return;
    var nz = nichtZeigbar(), ohne = ohneSzenario(), fg = faelleHier();
    var fOffen = fg.reduce(function (n, g) { return n + g.faelle.filter(function (f) { return !abgehakt[f.schluessel]; }).length; }, 0);
    var fAlle = fg.reduce(function (n, g) { return n + g.faelle.length; }, 0);
    el.faKnopf.hidden = !fAlle;
    el.faKnopf.textContent = fOffen === 1 ? "1 case without a rule" : fOffen + " cases without a rule";
    el.faKnopf.classList.toggle("an", ansicht.offen === "faelle" && !!fAlle);
    el.faKnopf.setAttribute("aria-expanded", String(ansicht.offen === "faelle" && !!fAlle));
    el.nzKnopf.hidden = !nz.length;
    el.nzKnopf.textContent = nz.length === 1 ? "1 item cannot be shown here" : nz.length + " items cannot be shown here";
    el.ohneKnopf.hidden = !(ohne && ohne.length);
    el.ohneKnopf.textContent = ohne ? ohne.length + " without a scenario" : "";
    el.nzKnopf.classList.toggle("an", ansicht.offen === "nicht-zeigbar" && !!nz.length);
    el.ohneKnopf.classList.toggle("an", ansicht.offen === "ohne-szenario" && !!(ohne && ohne.length));
    el.nzKnopf.setAttribute("aria-expanded", String(ansicht.offen === "nicht-zeigbar" && !!nz.length));
    el.ohneKnopf.setAttribute("aria-expanded", String(ansicht.offen === "ohne-szenario" && !!(ohne && ohne.length)));
    var inhalt = JSON.stringify([ansicht.offen, nz.map(function (r) { return r.kennung + r.satz; }), ohne, fg, abgehakt]);
    if (inhalt !== gezeichnet) {
      gezeichnet = inhalt;
      el.nzListe.textContent = "";
      nz.forEach(function (r) {
        var d = knoten("div", "luecke");
        d.dataset.regel = r.kennung;
        d.appendChild(knoten("div", "luecke-satz", r.satz));
        var h = r.herkunft || {};
        if (r.wortlaut) d.appendChild(knoten("div", "plugin-notiz", "Your request" + (h.datum ? " of " + datum(h.datum) : "") + ": “" + r.wortlaut + "”"));
        el.nzListe.appendChild(d);
      });
      el.ohneListe.textContent = "";
      (ohne || []).forEach(function (o) {
        var b = knoten("button", "luecke-satz luecke-wunsch", o.satz);
        b.type = "button";
        b.title = "Put into the request field as the start of a request";
        b.dataset[o.art === "plugin" ? "luecke" : "lueckeRegel"] = o.kennung;
        b.addEventListener("click", function () { H.wunsch.vorbelegen(o.satz + " "); });
        var d = knoten("div", "luecke");
        d.appendChild(b);
        el.ohneListe.appendChild(d);
      });
      zeichneFaelle(fg);
    }
    el.fa.hidden = !(ansicht.offen === "faelle" && fAlle);
    el.nz.hidden = !(ansicht.offen === "nicht-zeigbar" && nz.length);
    el.ohne.hidden = !(ansicht.offen === "ohne-szenario" && ohne && ohne.length);
    H.leiste.spalte();
  }

  H.luecken = {
    nichtZeigbar: function () { return nichtZeigbar().map(function (r) { return { kennung: r.kennung, satz: r.satz }; }); },
    ohneSzenario: ohneSzenario,
    felderVon: function (k) { return H.regeln[k] ? felderVon(H.regeln[k]) : null; },
    sichtbar: function () { return !!el.nz && (!el.nz.hidden || !el.ohne.hidden || !el.fa.hidden); },
    /* Fälle ohne Regel, wie die Leiste sie zeigt: [{ art, name, faelle: [{ schluessel, satz, zuletzt, abgehakt }] }] */
    faelle: function () {
      return faelle().map(function (g) {
        return { art: g.art, name: g.name, faelle: g.faelle.map(function (f) {
          return { schluessel: f.schluessel, satz: f.satz, zuletzt: f.zuletzt || null, abgehakt: !!abgehakt[f.schluessel] };
        }) };
      });
    },
    ladeAbgehakte: ladeAbgehakte,
    /* Anweisung 30c: öffnet die Stelle, an der der PO über diesen Fall entscheidet. */
    zeigeStelle: function (schluessel) {
      ansicht.offen = "faelle";
      merke();
      gezeichnet = null;
      zeichne();
      return Array.prototype.filter.call(el.faelleListe.querySelectorAll("[data-fall]"), function (x) { return x.dataset.fall === schluessel; })[0] || null;
    },
    zeichne: zeichne,
    start: function () {
      el.nzKnopf = document.getElementById("nichtZeigbarKnopf");
      el.ohneKnopf = document.getElementById("ohneSzenarioKnopf");
      el.nz = document.getElementById("nichtZeigbar");
      el.nzListe = document.getElementById("nichtZeigbarListe");
      el.ohne = document.getElementById("ohneSzenario");
      el.ohneListe = document.getElementById("ohneSzenarioListe");
      el.faKnopf = document.getElementById("faelleKnopf");
      el.fa = document.getElementById("faelle");
      el.faelleListe = document.getElementById("faelleListe");
      try { Object.assign(ansicht, JSON.parse(localStorage.getItem(SCHLUESSEL)) || {}); } catch (e) { /* bleibt zu */ }
      el.nzKnopf.addEventListener("click", function () { schalte("nicht-zeigbar"); });
      el.ohneKnopf.addEventListener("click", function () { schalte("ohne-szenario"); });
      document.getElementById("nichtZeigbarZu").addEventListener("click", function () { schalte("nicht-zeigbar"); });
      document.getElementById("ohneSzenarioZu").addEventListener("click", function () { schalte("ohne-szenario"); });
      el.faKnopf.addEventListener("click", function () { schalte("faelle"); });
      document.getElementById("faelleZu").addEventListener("click", function () { schalte("faelle"); });
      zeichne();
      ladeAbgehakte();
    }
  };
})();
