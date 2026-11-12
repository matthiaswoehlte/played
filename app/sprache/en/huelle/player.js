/* Feste Hülle, Teil 2: Bühne, Player, Einspielen.
   Die Bühne zeigt jede Nachricht: Erzählzeile, Leuchten am Objekt mit demselben
   Pfad (data-pfad), danach die Bewegung vom alten an den neuen Platz.
   Sie kennt nur Pfade, kein Fachgebiet. */
(function () {
  "use strict";
  var H = window.Huelle;

  var TAKT = { minute: 200, leuchten: 1300, flug: 900, landen: 350 };  // ms bei Tempo 1

  var lauf = 0;           // jede neue Wiedergabe bekommt eine Nummer; alte brechen ab
  var pausiert = false;
  var tempo = 1;
  var zustandPlayer = "bereit";   // bereit · laeuft · pause · fertig
  var drehbuch = null;
  var ruecknahme = null;  // nimmt das zuletzt gespeicherte Sollergebnis zurück
  var aufgeschoben = [];  // was während eines Durchlaufs eingespielt werden soll
  var angehalten = false; // Vorspielen endete dort, wo ein Verstoß entsteht
  var el = {};

  function Abbruch() {}
  function AmVerstoss() {}  // Vorspielen endet dort, wo ein Verstoß entsteht

  function warte(ms, meinLauf) {
    return new Promise(function (ok, nein) {
      var rest = ms, zuletzt = performance.now();
      (function schritt() {
        if (meinLauf !== lauf) return nein(new Abbruch());
        var jetzt = performance.now();
        if (!pausiert) rest -= (jetzt - zuletzt) * tempo;
        zuletzt = jetzt;
        if (rest <= 0) return ok();
        setTimeout(schritt, Math.min(30, Math.max(4, rest / tempo)));
      })();
    });
  }

  function finde(pfad) { return document.querySelector('[data-pfad="' + pfad + '"]'); }
  function alleZu(pfad) { return document.querySelectorAll('[data-pfad="' + pfad + '"]'); }

  /* ---------- Erzählzeile ---------- */
  function erzaehle(zeit, text) {
    var alt = el.zeile.textContent;
    if (alt && el.zeile.dataset.spur === "1") {
      var d = document.createElement("div");
      d.textContent = alt;
      el.spur.appendChild(d);
      while (el.spur.children.length > 2) el.spur.removeChild(el.spur.firstChild);
    }
    el.zeile.dataset.spur = "1";
    el.zeile.classList.remove("verstoss-moment");
    el.zeile.textContent = zeit + "  " + text;
    el.zeile.classList.remove("neu");
    void el.zeile.offsetWidth;
    el.zeile.classList.add("neu");
  }

  /* ---------- Meldungen ---------- */
  /* knoepfe: [{ text, tue(meldung) }] */
  function melde(text, art, knoepfe, wie) {
    var m = document.createElement("div");
    m.className = "meldung" + (art ? " " + art : "");
    var t = document.createElement("span");
    t.textContent = text;
    var x = document.createElement("button");
    x.textContent = "×";
    x.title = "Hide";
    x.addEventListener("click", function () { m.remove(); });
    m.appendChild(t);
    var rechts = document.createElement("span");
    rechts.className = "knoepfe";
    (knoepfe || []).forEach(function (k) {
      var b = document.createElement("button");
      b.className = "aktion";
      b.textContent = k.text;
      b.addEventListener("click", function () { k.tue(m); });
      rechts.appendChild(b);
    });
    /* Anweisung 33: Eine Meldung, die auf deine Entscheidung wartet, lässt sich nicht wegklicken. */
    if (!(wie && wie.bleibt)) rechts.appendChild(x);
    m.appendChild(rechts);
    el.meldungen.appendChild(m);
    return m;
  }

  /* ---------- Bühne ---------- */
  function buehneFuer(meinLauf) {
    return {
      vorher: async function (m) {
        if (m.stumm) return;
        var sichtbar = alleZu(m.objekt);
        if (m.erzaehlung) erzaehle(m.zeit, m.erzaehlung);
        if (!sichtbar.length && !m.erzaehlung) return;
        sichtbar.forEach(function (e) {
          e.scrollIntoView({ block: "nearest", inline: "nearest" });
          e.classList.add("leuchtet");
        });
        await warte(TAKT.leuchten, meinLauf);
      },
      schnappschuss: function (m) {
        var e = finde(m.objekt);
        if (!e) return null;
        var r = e.getBoundingClientRect();
        var c = e.cloneNode(true);
        c.classList.remove("leuchtet");
        return { rahmen: r, kopie: c };
      },
      nachher: async function (m, bild) {
        if (m.stumm) return;
        var e = finde(m.objekt);
        if (!e) return;
        e.scrollIntoView({ block: "nearest", inline: "nearest" });
        var r = e.getBoundingClientRect();
        var bewegt = bild && (Math.abs(r.left - bild.rahmen.left) > 4 || Math.abs(r.top - bild.rahmen.top) > 4);
        if (bewegt) {
          await fliege(bild, e, r, meinLauf);
        }
        e.classList.remove("leuchtet");
        e.classList.add("gelandet");
        await warte(TAKT.landen, meinLauf);
      }
    };
  }

  /* Von Hand steht das Objekt schon, wo es hin soll: keine Vorführung, nur die Erzählzeile.
     Der gezeigte Endstand eines Durchlaufs gilt ab der ersten Handlung nicht mehr. */
  var handBuehne = {
    vorher: async function (m) {
      if (m.stumm) return;
      if (m.absender !== "huelle/uhr") el.ergebnis.hidden = true;
      if (m.erzaehlung) erzaehle(m.zeit, m.erzaehlung);
    },
    schnappschuss: function () { return null; },
    nachher: async function () {}
  };

  async function fliege(bild, ziel, r, meinLauf) {
    var g = bild.kopie, a = bild.rahmen;
    g.removeAttribute("data-pfad");
    g.classList.add("flieger");
    g.style.cssText += ";position:fixed;margin:0;z-index:50;left:" + a.left + "px;top:" + a.top +
      "px;width:" + a.width + "px;height:" + a.height + "px;";
    document.body.appendChild(g);
    ziel.style.visibility = "hidden";
    var anim = g.animate([
      { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" },
      { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }
    ], { duration: TAKT.flug, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" });
    anim.playbackRate = tempo;
    try { await warte(TAKT.flug, meinLauf); }
    finally { g.remove(); ziel.style.visibility = ""; }
  }

  /* ---------- Ende eines Durchlaufs ---------- */
  function zeigeErgebnis(art, text, widerspruchMoeglich) {
    el.ergebnis.hidden = false;
    el.ergebnis.className = "ergebnis " + art;
    el.ergebnisText.textContent = text;
    el.widerspruch.hidden = !widerspruchMoeglich;
  }

  /* Wer bis zum Ende zugeschaut hat, hat es gesehen: Der Endstand wird Sollergebnis,
     außer das Drehbuch selbst ist nicht erfüllt. „Stimmt so nicht“ nimmt das zurück. */
  function abschluss() {
    var erwartung = H.soll.pruefe(drehbuch);
    ruecknahme = null;
    /* Ein Verstoß bleibt gemeldet, auch wenn der Endstand Sollergebnis wird oder das Drehbuch nicht erfüllt ist. */
    var n = H.waechter.jetzt().length;
    var dazu = n ? " Ends with " + (n === 1 ? "1 rule violation." : n + " rule violations.") : "";
    if (erwartung) {
      zeigeErgebnis("rot", "Not as expected. Expected: " + erwartung + dazu, false);
      return;
    }
    var endstand = H.soll.endstand();
    var g = H.soll.grundlage(drehbuch.kennung);
    /* Plan oder nur Anzeige? Was ein Wunsch, der nur die Anzeige ändert, an der Anzeige ändert, ist keine Abweichung. */
    var unterschiede = g ? H.soll.vergleiche(g.endstand, endstand) : [];
    var aend = unterschiede.length ? H.soll.aenderungen(unterschiede) : [];
    var imPlan = aend.filter(function (a) { return a.ebene === "plan"; });
    var nurAnzeigeVon = !imPlan.length && aend.length ? H.verwaltung.nurAnzeigeBei(drehbuch.kennung) : null;
    var zeige = imPlan.length ? imPlan : nurAnzeigeVon ? [] : aend;
    var satz = zeige.length ? (imPlan.length ? "in the plan: " : "only in the display: ") + zeige[0].satz +
      (zeige.length >= 2 ? "; " + zeige[1].satz : "") + (zeige.length === 3 ? " (and one more change)" : zeige.length > 3 ? " (and " + (zeige.length - 2) + " more changes)" : "") : null;
    if (nurAnzeigeVon) dazu = " Your request “" + H.verwaltung.nameVon(nurAnzeigeVon) + "” only changes the display." + dazu;
    var geltend = H.soll.geltende(drehbuch);
    ruecknahme = H.soll.merke(drehbuch.kennung, endstand);

    var eigene = geltend.some(function (e) { return e.bei; });
    if (satz && (g.gleicherStand || !eigene)) {
      zeigeErgebnis("gelb", "Different from what you last saw, " + satz + dazu, true);
    } else if (geltend.length) {
      zeigeErgebnis(n ? "gelb" : "gruen", "As expected: " + geltend[0].text + dazu, true);
    } else {
      zeigeErgebnis(n ? "gelb" : "gruen", "Seen: From now on, this end state is the expected result." + dazu, true);
    }
  }

  function widersprich() {
    if (ruecknahme) ruecknahme();
    ruecknahme = null;
    zeigeErgebnis("ruhig", "Not taken over: The expected result stays as it was.", false);
    H.verwaltung.pruefe();
  }

  /* ---------- Wiedergabe ---------- */
  function setzeZustand(z) {
    zustandPlayer = z;
    el.play.textContent = z === "laeuft" ? "Pause" : z === "pause" ? "Continue" : z === "fertig" ? "Again" : "Play";
    el.play.classList.toggle("an", z === "laeuft");
  }

  function aufStart() {
    lauf++;
    pausiert = false;
    angehalten = false;
    if (el.zeile) el.zeile.classList.remove("verstoss-moment");
    ruecknahme = null;
    document.querySelectorAll(".flieger").forEach(function (g) { g.remove(); });
    H.neuerTag(drehbuch.von);
    el.uhr.textContent = drehbuch.von;
    el.zeile.textContent = "";   // Der Titel steht schon in der Auswahl (Anweisung 25 des PO, 09.11.)
    el.zeile.dataset.spur = "0";
    el.spur.textContent = "";
    el.ergebnis.hidden = true;
    setzeZustand("bereit");
  }

  /* halt: { schritt, … } aus dem Wächter – nach diesem Ereignis endet das Vorspielen. Die beteiligten
     Balken leuchten einige Sekunden, die Erzählzeile sagt, welche Nachricht den Verstoß ausgelöst hat.
     Danach ist der Plan frei bedienbar (kein Pausieren: in einer Pause wäre alles von Hand gesperrt).
     Ein Endstand wird hier nicht Sollergebnis, denn das Drehbuch ist nicht zu Ende gelaufen. */
  async function spiele(halt) {
    aufStart();
    var meinLauf = lauf;
    var nr = 0;
    setzeZustand("laeuft");
    try {
      await H.ablauf(drehbuch, {
        buehne: buehneFuer(meinLauf),
        minute: TAKT.minute,
        warte: function (ms) { return warte(ms, meinLauf); },
        stelle: function (t) { H.uhr.stelle(t); el.uhr.textContent = t; },
        nachEreignis: async function (e) {
          nr++;
          if (!halt || nr !== halt.schritt) return;
          erzaehle(e.zeit, H.waechter.satzZurEntstehung(halt));
          el.zeile.classList.add("verstoss-moment");
          H.waechter.leuchte(halt.pfade);
          throw new AmVerstoss();
        }
      });
      abschluss();
      setzeZustand("fertig");
      await holeNach();
      H.verwaltung.pruefe();
      return true;
    } catch (e) {
      if (e instanceof AmVerstoss) {
        angehalten = true;
        zeigeErgebnis("ruhig", "Paused at " + H.uhr.zeit + ", where the rule violation occurs. You can now use the plan; “Again” plays the whole scenario.", false);
        setzeZustand("fertig");
        await holeNach();
        return false;
      }
      if (!(e instanceof Abbruch)) throw e;
      return false;
    }
  }

  /* Mehrere Drehbücher nacheinander; jeder Eingriff (Von vorn, andere Wahl, Beenden) beendet die Folge.
     titel: wofür die Folge läuft, z. B. der Name eines Plugins */
  async function spieleFolge(kennungen, titel) {
    var pause = 1800;
    try {
      for (var i = 0; i < kennungen.length; i++) {
        el.folge.hidden = kennungen.length < 2 && !titel;
        el.folge.textContent = (titel ? titel + ": " : "") + "Scenario " + (i + 1) + " of " + kennungen.length;
        waehle(kennungen[i]);
        el.wahl.value = kennungen[i];
        if (!await spiele()) return;
        if (i + 1 < kennungen.length) await warte(pause, lauf);
      }
    } catch (e) {
      if (!(e instanceof Abbruch)) throw e;
    } finally {
      el.folge.hidden = true;
    }
  }

  function umschalten() {
    if (zustandPlayer === "laeuft") {
      pausiert = true;
      document.getAnimations().forEach(function (a) { if (a.playState === "running") a.pause(); });
      setzeZustand("pause");
    } else if (zustandPlayer === "pause") {
      pausiert = false;
      document.getAnimations().forEach(function (a) { if (a.playState === "paused") a.play(); });
      setzeZustand("laeuft");
    } else {
      spiele();
    }
  }

  function vonVorn() {
    aufStart();
    holeNach();
  }

  function setzeTempo(wert) {
    tempo = wert;
    document.getAnimations().forEach(function (a) { if (a.effect && a.effect.target && a.effect.target.classList.contains("flieger")) a.playbackRate = wert; });
    el.tempo.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("an", Number(b.dataset.wert) === wert);
    });
  }

  function waehle(kennung) {
    drehbuch = H.drehbuecher.filter(function (d) { return d.kennung === kennung; })[0];
    aufStart();
    holeNach();
  }

  /* ---------- Einspielen ----------
     Ein laufender Durchlauf wird nicht gestört: Was während des Spielens kommt,
     wartet bis zum Ende. Danach laufen alle Drehbücher im Hintergrund nach. */
  function zeichnePlaetze() {
    el.plaetze.textContent = "";
    H.plaetze().forEach(function (p) {
      if (p.varianten.length < 2) return;
      var feld = document.createElement("span");
      feld.className = "platz";
      feld.appendChild(document.createTextNode(p.titel || ""));
      var wahl = document.createElement("span");
      wahl.className = "wahl";
      p.varianten.forEach(function (v) {
        var b = document.createElement("button");
        b.textContent = v.titel;
        b.dataset.variante = v.kennung;
        b.classList.toggle("an", v.aktiv);
        b.addEventListener("click", function () { if (!v.aktiv) spieleEin(function () { return H.wechsle(v.kennung); }); });
        wahl.appendChild(b);
      });
      feld.appendChild(wahl);
      el.plaetze.appendChild(feld);
    });
  }

  function laeuftGerade() { return zustandPlayer === "laeuft" || zustandPlayer === "pause"; }

  async function fuehreEin(tue) {
    try {
      await tue();
    } catch (e) {
      melde("This could not be applied: " + e.message);
      return;
    }
    zeichnePlaetze();
    zeichneDrehbuecher();
    H.verwaltung.pruefe();
  }

  function spieleEin(tue, wie) {
    if (laeuftGerade()) {
      aufgeschoben.push(tue);
      melde("Will be applied as soon as this run is over.", "hinweis");
      return;
    }
    /* Von Hand eingespielt: zurück auf den Anfang, damit das Neue gleich spielbar ist. */
    var erledigt = fuehreEin(tue);
    if (!(wie && wie.ohneNeustart)) erledigt.then(aufStart);
  }

  async function holeNach() {
    var liste = aufgeschoben;
    aufgeschoben = [];
    el.meldungen.querySelectorAll(".hinweis").forEach(function (m) { m.remove(); });
    for (var i = 0; i < liste.length; i++) await fuehreEin(liste[i]);
  }

  /* ---------- Player-Liste ----------
     Die Auswahl oben: die Drehbücher, darunter je Plugin „Vorspielen“ (nur die Drehbücher, in denen
     es etwas tut), „Alle Szenen“, „Beenden“ und „Aufnehmen“. Was mit „@“ beginnt, ist ein Befehl
     und kein Drehbuch; danach steht wieder das gewählte Drehbuch in der Auswahl. */
  function option(eltern, wert, text) {
    var o = document.createElement("option");
    o.value = wert;
    o.textContent = text;
    eltern.appendChild(o);
    return o;
  }
  function gruppe(text) {
    var g = document.createElement("optgroup");
    g.label = text;
    el.wahl.appendChild(g);
    return g;
  }
  function pluginsMitDrehbuch() {
    if (!H.verwaltung) return [];
    return H.verwaltung.eintraege().filter(function (e) { return e.an && e.art !== "datei"; }).map(function (e) {
      return { kennung: e.kennung, name: e.name, drehbuecher: H.verwaltung.drehbuecherVon(e.kennung) };
    }).filter(function (x) { return x.drehbuecher && x.drehbuecher.length; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
  }
  var gezeigteListe = null;
  function zeichneDrehbuecher() {
    var plugins = pluginsMitDrehbuch().filter(function (x) { return H.pluginImBlick(x.kennung); });
    var offene = H.drehbuecherOffen();
    var schluessel = JSON.stringify([offene.map(function (d) { return [d.kennung, d.titel]; }),
      plugins.map(function (x) { return [x.kennung, x.name, x.drehbuecher.length]; }), H.wunsch.moeglich(), uhrLaeuft]);
    if (schluessel === gezeigteListe) return;
    gezeigteListe = schluessel;
    el.wahl.textContent = "";
    var dreh = gruppe("Scenarios");
    offene.forEach(function (d) { option(dreh, d.kennung, d.titel); });
    if (plugins.length) {
      var je = gruppe("Play per plugin");
      plugins.forEach(function (x) {
        option(je, "@plugin:" + x.kennung, "Play: " + x.name + " (" + (x.drehbuecher.length === 1 ? "1 scenario" : x.drehbuecher.length + " scenarios") + ")");
      });
    }
    var befehle = gruppe("Player");
    option(befehle, "@alle", "All scenes (" + offene.length + " scenarios in a row)");
    option(befehle, "@beenden", "Stop");
    option(befehle, "@uhr", uhrLaeuft ? "Stop clock" : "Start clock");
    if (H.wunsch.moeglich()) option(befehle, "@aufnehmen", "Record");
    if (drehbuch) el.wahl.value = drehbuch.kennung;
  }

  function spielePlugin(kennung) {
    var liste = H.verwaltung.drehbuecherVon(kennung);
    var name = H.verwaltung.nameVon(kennung);
    if (liste && !liste.length) {
      melde("“" + name + "”: No scenario shows this. Please try it yourself.", "hinweis");
      return;
    }
    spieleFolge(liste ? liste.map(function (d) { return d.kennung; }) : [drehbuch.kennung], name);
  }

  /* Bricht das Vorspielen ab, wo es gerade steht. Die angefangene Kette läuft noch zu Ende
     (ohne Vorführung), danach lässt sich die Dispo von Hand bedienen. */
  async function beende() {
    var lief = laeuftGerade() || !el.folge.hidden || uhrLaeuft;
    lauf++;
    pausiert = false;
    document.getAnimations().forEach(function (a) { if (a.playState === "paused") a.play(); });
    document.querySelectorAll(".flieger").forEach(function (g) { g.remove(); });
    document.querySelectorAll(".leuchtet").forEach(function (e) { e.classList.remove("leuchtet"); });
    el.folge.hidden = true;
    for (var i = 0; i < 200 && H.gesperrt(); i++) await new Promise(function (ok) { setTimeout(ok, 15); });
    H.anstossen();
    if (!lief) return;
    zeigeErgebnis("ruhig", "Stopped at " + H.uhr.zeit + ". You can now use the plan; “Again” plays the scenario from the start.", false);
    setzeZustand("fertig");
    await holeNach();
  }

  /* Aufnehmen: ein frischer Tag; was der Anforderer jetzt von Hand tut, wird aufgezeichnet und
     lässt sich mit „Als Drehbuch behalten“ als neues Drehbuch speichern (Aufzeichnung: aufzeichnung.js). */
  async function nimmAuf() {
    await beende();
    aufStart();
    zeigeErgebnis("ruhig", "Recording from " + drehbuch.von + ": What you do in the daily plan now is recorded. “Keep as scenario” saves it as a new scenario.", false);
    el.ergebnis.classList.add("aufnahme");
  }

  /* Uhr laufen lassen (Auftrag 005, Stufe 2): Ab der Uhrzeit, auf der die Dispo gerade steht, rückt die
     Uhr Minute für Minute vor und gibt ihren Takt (Meldungen, Fristen). Die Dispo bleibt dabei bedienbar.
     Ein Szenario, „Beenden“ oder „Uhr anhalten“ hält sie an. */
  var uhrLaeuft = false;
  async function lasseUhrLaufen() {
    if (uhrLaeuft) return beende();
    await beende();
    var meinLauf = lauf, t = H.uhr.minuten(H.uhr.zeit || drehbuch.von), ab = H.uhr.text(t);
    uhrLaeuft = true;
    zeichneDrehbuecher();
    zeigeErgebnis("ruhig", "The clock runs from " + ab + ". You can use the dispatch meanwhile; “Stop clock” or “Stop” stops it.", false);
    try {
      while (t < 24 * 60 - 1) {
        await warte(TAKT.minute * 2, meinLauf);
        while (H.bus.arbeitet || H.gesperrt()) await warte(15, meinLauf);
        t++;
        var jetzt = H.uhr.text(t);
        H.uhr.stelle(jetzt);
        el.uhr.textContent = jetzt;
        await H.takt(jetzt, handBuehne);
        if (H.luecken) H.luecken.zeichne();
      }
    } catch (e) {
      if (!(e instanceof Abbruch)) throw e;
    } finally {
      uhrLaeuft = false;
      zeichneDrehbuecher();
    }
  }

  function befehl(wert) {
    if (wert.indexOf("@plugin:") === 0) spielePlugin(wert.slice("@plugin:".length));
    else if (wert === "@alle") spieleFolge(H.drehbuecherOffen().map(function (d) { return d.kennung; }), "All scenes");
    else if (wert === "@beenden") beende();
    else if (wert === "@aufnehmen") nimmAuf();
    else if (wert === "@uhr") lasseUhrLaufen();
  }

  function nimmDatei(datei) {
    if (!datei) return;
    datei.text().then(function (quelle) {
      spieleEin(function () { H.einspielen(datei.name, quelle); });
    });
  }

  H.player = {
    spieleEin: spieleEin,
    melde: melde,
    laeuftGerade: laeuftGerade,
    spieleFolge: spieleFolge,
    spielePlugin: spielePlugin,
    beende: beende,
    nimmAuf: nimmAuf,
    zeichneListe: function () { zeichneDrehbuecher(); },
    drehbuch: function () { return drehbuch ? drehbuch.kennung : null; },
    /* Was der Anforderer seit Tagesbeginn gesehen hat, für „Stimmt nicht“: Erzählzeilen und Ergebnis */
    beobachtet: function () {
      var zeilen = H.bus.protokoll.filter(function (m) { return m.erzaehlung; }).map(function (m) {
        return m.zeit + " " + m.erzaehlung;
      });
      if (!zeilen.length) return null;
      var schluss = el.ergebnis.hidden ? "" : "\nIn the end it said: " + el.ergebnisText.textContent;
      return "Scenario: " + (drehbuch ? drehbuch.titel : "keins") + "\n" + zeilen.slice(-150).join("\n") + schluss;
    },
    /* Spielt ein Drehbuch von vorn vor; ohne Angabe das gewählte. */
    spieleDrehbuch: function (kennung) {
      if (kennung) { waehle(kennung); el.wahl.value = kennung; }
      spiele();
    },
    /* Spielt ein Drehbuch bis zu dem Ereignis, bei dem ein Verstoß entsteht, und hält dort an. */
    spieleBisVerstoss: function (kennung, entsteht) {
      waehle(kennung);
      el.wahl.value = kennung;
      spiele(entsteht);
    },
    /* Steht der Player gerade am Moment eines Verstoßes? (für die Prüfung) */
    amVerstoss: function () { return angehalten; },
    start: function () {
      ["play", "vonVorn", "tempo", "uhr", "zeile", "spur", "ergebnis", "ergebnisText", "widerspruch", "wahl",
       "titel", "untertitel", "plaetze", "einspielen", "datei", "meldungen", "folge"].forEach(function (id) {
        el[id] = document.getElementById(id);
      });
      el.titel.textContent = H.teilApp.titel || H.tag.titel;
      el.untertitel.textContent = H.teilApp.untertitel || H.tag.untertitel || "";
      document.title = H.teilApp.titel || H.tag.titel;
      zeichneDrehbuecher();
      el.wahl.addEventListener("change", function () {
        var wert = el.wahl.value;
        if (wert.charAt(0) !== "@") return waehle(wert);
        el.wahl.value = drehbuch.kennung;
        befehl(wert);
      });
      el.play.addEventListener("click", umschalten);
      el.vonVorn.addEventListener("click", vonVorn);
      el.widerspruch.addEventListener("click", widersprich);
      el.tempo.addEventListener("click", function (e) {
        if (e.target.dataset.wert) setzeTempo(Number(e.target.dataset.wert));
      });
      el.einspielen.addEventListener("click", function () { el.datei.value = ""; el.datei.click(); });
      el.datei.addEventListener("change", function () { nimmDatei(el.datei.files[0]); });
      document.addEventListener("dragover", function (e) { e.preventDefault(); document.body.classList.add("ziehen"); });
      document.addEventListener("dragleave", function (e) { if (!e.relatedTarget) document.body.classList.remove("ziehen"); });
      document.addEventListener("drop", function (e) {
        e.preventDefault();
        document.body.classList.remove("ziehen");
        nimmDatei(e.dataTransfer.files[0]);
      });
      H.handBuehne = handBuehne;
      /* Bus-Vertrag: Besitzer, Schleife, Absturz in einem Satz unter den Meldungen */
      H.hoerer.push(function (f) { melde(f.satz, "vertrag"); });
      setzeTempo(1);
      zeichnePlaetze();
      var gemerkt = H.leiste.gemerkteWahl();
      var offene = H.drehbuecherOffen();
      var da = offene.some(function (d) { return d.kennung === gemerkt; });
      waehle(da ? gemerkt : (offene[0] || H.drehbuecher[0]).kennung);
      el.wahl.value = drehbuch.kennung;
    }
  };
})();
