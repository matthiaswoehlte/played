/* Offene Punkte (Anweisung 30): die Liste dessen, was eine Zahl auf der Karte zählt, als schwebendes Fenster der Hostapp.
   Sie gehört zum gelesenen Projekt, nicht zur gerade offenen Teil-App: Sie bleibt offen, wenn der PO zwischen dessen Teil-Apps und
   dem Navigator wechselt, und schließt sich, sobald er ein anderes Projekt öffnet. Wo das Fenster steht und ob es eingeklappt ist,
   ist Bequemlichkeit des Betrachters und liegt im Browser; die Einträge kommen immer frisch von der Brücke.
   Jeder Eintrag hängt an der festen Kennung seines Dings. Der Navigator ändert nichts: Ein Klick öffnet die Stelle, an der der PO entscheidet. */
(function () {
  "use strict";
  var H = window.Huelle;
  var STILL = { neu: function () {}, nachStand: function () {}, rechnet: function () {}, entschieden: function () {}, hierZuhause: function () { return true; } };
  if (location.protocol !== "http:" || new URLSearchParams(location.search).has("nachspielen")) { H.punkte = STILL; return; }

  var SCHLUESSEL = "play/punkte/1", ZIEL = "play/punkte-ziel/1";
  var fenster = document.getElementById("punkteFenster"), zahl = document.getElementById("punkteZahl");
  var liste = null;        // { projekt, umfang, titel, zu, x, y }
  var daten = null;        // Antwort der Brücke zur offenen Liste
  var rechnet = null;      // Szenarien, die gerade nachgerechnet werden
  var ladung = 0;
  var zuordnung = {};      // offener Punkt → seine Teil-App

  function lies(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function schreib(k, w) { try { if (w) localStorage.setItem(k, JSON.stringify(w)); else localStorage.removeItem(k); } catch (e) { /* gilt bis zum Neuladen */ } }
  function merke() { schreib(SCHLUESSEL, liste); }
  function holen(umfang) {
    return fetch("/offene-punkte?umfang=" + encodeURIComponent(umfang)).then(function (r) { return r.ok ? r.json() : null; });
  }
  function knoten(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function schliessen() { liste = null; daten = null; merke(); zeichne(); }

  function neu() {
    var meine = ++ladung;
    return holen(liste ? liste.umfang : "").then(function (d) {
      if (meine !== ladung) return;
      merkeZuordnung(d);
      if (!liste) return;
      if (!d || d.projekt !== liste.projekt) { schliessen(); return; }
      daten = d;
      zeichne();
    }).catch(function () { /* beim nächsten Anlass wieder */ });
  }

  /* Anweisung 31a: Die Zähler in der Steuerleiste gelten für die offene Teil-App. */
  function merkeZuordnung(d) {
    zuordnung = d && d.projekt === d.offen.projekt ? d.teilAppJe : {};
    if (H.waechter && H.waechter.zeichne) H.waechter.zeichne();
    if (H.luecken) H.luecken.zeichne();
  }

  function oeffnen(umfang, titel) {
    var alt = liste || {};
    liste = { projekt: null, umfang: umfang, titel: titel, zu: false, x: alt.x, y: alt.y };
    return holen(umfang).then(function (d) {
      if (!d || !liste || liste.umfang !== umfang) return;
      liste.projekt = d.projekt;
      daten = d;
      merke();
      zeichne();
    }).catch(function () { if (H.player) H.player.melde("Play ist gerade nicht erreichbar.", "fehler"); });
  }

  function offeneAnzahl() {
    return daten ? daten.eintraege.filter(function (e) { return e.farbe !== "klar"; }).length : 0;
  }
  function schlimmste() {
    return daten && daten.eintraege.some(function (e) { return e.farbe === "rot"; }) ? "rot" : "gelb";
  }

  /* Anweisung 49 (d): Ein Antrag wird hier entschieden. „Annehmen“ öffnet die andere Teil-App und schickt ihn dort als Wunsch ab. */
  function antragZeile(e) {
    var z = knoten("div", "punkt antrag " + e.farbe);
    z.dataset.punkt = e.id;
    z.appendChild(knoten("span", null, e.satz));
    [["Annehmen", "annehmen"], ["Ablehnen", "ablehnen"]].forEach(function (k) {
      var b = knoten("button", "antrag-knopf", k[0]);
      b.type = "button";
      b.addEventListener("click", function () { entscheideAntrag(e, k[1]); });
      z.appendChild(b);
    });
    return z;
  }
  function entscheideAntrag(e, entscheidung) {
    fetch("/antraege/" + encodeURIComponent(e.schluessel), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entscheidung: entscheidung }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { H.player.melde(x.d.grund || "Das ließ sich nicht entscheiden.", "fehler"); return; }
        if (x.d.status !== "angenommen") { H.punkte.entschieden("antraege", e.schluessel); return; }
        var hier = daten.offen, s = { art: "antrag", text: x.d.text };
        if (hier.projekt === x.d.projekt && hier.teilApp === x.d.an) { stelle(s); H.punkte.entschieden("antraege", e.schluessel); return; }
        if (x.d.prototyp) { wechsle(x.d.projekt + "/" + x.d.an, s); return; }
        /* Ohne Prototyp: Die andere Teil-App öffnet leer, der Antrag ist die erste Beschreibung. */
        schreib(ZIEL, s);
        fetch("/prototyp-vormerken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bereich: x.d.an }) })
          .then(function (r) { if (r.ok) location.reload(); else { schreib(ZIEL, null); H.player.melde("Der andere Bereich ließ sich nicht öffnen.", "fehler"); } });
      }).catch(function () { H.player.melde("Play ist gerade nicht erreichbar.", "fehler"); });
  }

  function zeile(e) {
    if (e.art === "antrag") return antragZeile(e);
    var b = knoten("button", "punkt " + e.farbe, e.satz);
    b.type = "button";
    b.dataset.punkt = e.id;
    if (rechnet && (e.szenarien || []).some(function (s) { return rechnet.indexOf(s) !== -1; })) b.appendChild(knoten("small", null, "wird nachgerechnet"));
    b.addEventListener("click", function () { gehe(e); });
    return b;
  }

  function zeichne() {
    var offen = !!liste && !!daten && !liste.zu;
    fenster.hidden = !offen;
    var n = offeneAnzahl();
    zahl.hidden = !(liste && daten && liste.zu && n);
    zahl.className = "punkte-zahl " + schlimmste();
    zahl.textContent = n;
    if (!offen) return;
    fenster.textContent = "";
    if (liste.x !== undefined) { fenster.style.left = liste.x + "px"; fenster.style.top = liste.y + "px"; fenster.style.bottom = "auto"; }
    var kopf = knoten("div", "punkte-kopf");
    kopf.appendChild(knoten("h2", null, n ? liste.titel + " · " + n : liste.titel));
    var ein = knoten("button", null, "–");
    ein.type = "button"; ein.title = "Einklappen"; ein.setAttribute("aria-label", "Einklappen");
    ein.addEventListener("click", function () { liste.zu = true; merke(); zeichne(); });
    var weg = knoten("button", null, "×");
    weg.type = "button"; weg.title = "Schließen"; weg.setAttribute("aria-label", "Schließen");
    weg.addEventListener("click", schliessen);
    kopf.appendChild(ein);
    kopf.appendChild(weg);
    ziehbar(kopf);
    fenster.appendChild(kopf);
    var inhalt = knoten("div", "punkte-liste");
    var klar = daten.eintraege.filter(function (e) { return e.farbe === "klar"; });
    daten.eintraege.filter(function (e) { return e.farbe !== "klar"; }).forEach(function (e) { inhalt.appendChild(zeile(e)); });
    if (klar.length) {
      var d = knoten("details", "punkte-klar");
      d.appendChild(knoten("summary", null, klar.length === 1 ? "1 Strang ist klar" : klar.length + " Stränge sind klar"));
      klar.forEach(function (e) { d.appendChild(zeile(e)); });
      inhalt.appendChild(d);
    }
    if (!daten.eintraege.length) inhalt.appendChild(knoten("p", "punkte-leer", "Hier ist nichts mehr offen."));
    fenster.appendChild(inhalt);
  }

  function ziehbar(kopf) {
    kopf.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      var r = fenster.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      function zieh(m) {
        liste.x = Math.max(0, Math.min(window.innerWidth - 80, m.clientX - dx));
        liste.y = Math.max(0, Math.min(window.innerHeight - 40, m.clientY - dy));
        fenster.style.left = liste.x + "px"; fenster.style.top = liste.y + "px"; fenster.style.bottom = "auto";
      }
      function los() { document.removeEventListener("pointermove", zieh); document.removeEventListener("pointerup", los); merke(); }
      document.addEventListener("pointermove", zieh);
      document.addEventListener("pointerup", los);
    });
  }

  /* ---------- Zur Stelle ---------- */
  function markiere(el) {
    if (!el) return;
    H.leiste.spalte();
    el.classList.add("punkt-hier");
    el.scrollIntoView({ block: "nearest" });
    setTimeout(function () { el.classList.remove("punkt-hier"); }, 4000);
  }
  function stelle(z) {
    if (z.art === "verstoss") markiere(H.waechter.zeigeStelle(z.schluessel));
    else if (z.art === "fall") markiere(H.luecken.zeigeStelle(z.schluessel));
    else if (z.art === "abweichung") markiere(H.leiste.zeigeAbweichung(z.schluessel));
    else if (z.art === "antrag") H.wunsch.abschicken(z.text);
    else if (z.pfad) { H.bus.sende({ objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: z.pfad }, erzaehlung: "Öffnet die Stelle" }, "huelle/punkte"); H.anstossen(); }
  }
  function wechsle(ziel, stelleDort) {
    schreib(ZIEL, stelleDort);
    fetch("/projekt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kennung: ziel }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (x.ok) { location.reload(); return; }
        schreib(ZIEL, null);
        H.player.melde(x.d.grund || "Das ließ sich nicht öffnen.", "fehler");
      }).catch(function () { schreib(ZIEL, null); H.player.melde("Play ist gerade nicht erreichbar.", "fehler"); });
  }
  function gehe(e) {
    var hier = daten.offen;
    if (e.art === "strang" || e.art === "stimmtnicht") {
      var z = { art: e.art, pfad: e.pfad || "grundfunktionen/" + e.gf };
      if (hier.projekt === daten.navigator) stelle(z);
      else wechsle(daten.navigator, z);
      return;
    }
    var imZiel = hier.projekt === daten.projekt && hier.teilApp === e.bereich;
    var s = { art: e.art, schluessel: e.schluessel };
    if (imZiel) stelle(s);
    else wechsle(daten.projekt + "/" + e.bereich, s);
  }

  /* ---------- Bitte vom Navigator, gelöste Einträge ---------- */
  H.bus.abonniere("navi/jetzt.punktezeigen", function (m) {
    if (/^hand\//.test(m.absender || "")) oeffnen(m.parameter.umfang, m.parameter.titel);
  }, "huelle/punkte");
  /* Anweisung 30d: Jede Entscheidung läuft als Nachricht über den Bus; daran prüft die Liste ihre Einträge neu. */
  H.bus.abonniere("entscheidungen/*.entschieden", function () { neu(); }, "huelle/punkte");

  H.punkte = {
    neu: neu,
    /* Gehört dieser Punkt zur offenen Teil-App? Unbekanntes bleibt sichtbar. */
    /* Anweisung 46: Zur leer geöffneten Teil-App gehört noch kein Punkt. */
    hierZuhause: function (id) { if (H.teilApp.leer) return false; if (H.alleBereiche) return true; return !zuordnung[id] || !H.teilApp.offen || zuordnung[id] === H.teilApp.offen; },
    /* Der Stand steht: Eine Stelle, die vor dem Neuladen gewählt wurde, wird jetzt geöffnet. */
    nachStand: function () {
      var z = lies(ZIEL);
      if (z) { schreib(ZIEL, null); stelle(z); }
    },
    /* Szenarien, die gerade neu gespielt werden; null heißt: fertig, die Liste prüft sich neu. */
    rechnet: function (szenarien) {
      rechnet = szenarien;
      if (szenarien) zeichne(); else neu();
    },
    entschieden: function (art, schluessel) {
      H.bus.sende({ objekt: "entscheidungen/" + art, aktion: "entschieden", parameter: { schluessel: schluessel }, erzaehlung: "Entscheidung des PO" }, "huelle/punkte");
      H.anstossen();
    }
  };

  zahl.addEventListener("click", function () { liste.zu = false; merke(); zeichne(); });
  liste = lies(SCHLUESSEL);
  neu();
})();
