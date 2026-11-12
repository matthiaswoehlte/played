/* Feste Hülle, Teil 3: Erwartung, Endstand, Sollergebnis.
   Endstand = Zustand plus das, was jede Ansicht zeigt (Pfade).
   Ein gesehener Endstand ist Sollergebnis, je Drehbuch und je Variantenstand.
   Fehlt eins für den aktuellen Stand, gilt der zuletzt gesehene Endstand als Vergleich.
   Sollergebnisse sind Dateien im Repo (sollergebnisse/<kennung>.json), kein Browserspeicher:
   Sie sind die Grundlage, um den Stand später ins Netz zu übernehmen.
   Per Doppelklick gibt es keine Brücke; dann gelten sie nur, solange die Seite offen ist. */
(function () {
  "use strict";
  var H = window.Huelle;
  var MIT_DATEIEN = location.protocol === "http:";
  var ALTER_SCHLUESSEL = "play/sollergebnisse/1";   // nur noch zum einmaligen Übernehmen
  var HINWEIS_DOPPELKLICK = "Per Doppelklick bleibt das Sollergebnis nur, solange die Seite offen ist. Als Datei gespeichert wird es über „Play starten“.";

  var sammlung = {};
  var lesbar = true;                  // ohne gelesenen Stand wird nichts überschrieben
  var schreibfehler = false;
  var kette = Promise.resolve();      // Schreiben in der Reihenfolge des Geschehens
  var gemeldet = {};
  var offen = [];                     // Meldungen, bevor die Seite steht

  function melde(text) {
    if (gemeldet[text]) return;
    gemeldet[text] = true;
    if (H.geladen) H.player.melde(text); else offen.push(text);
  }

  function schreibe(kennung) {
    if (!MIT_DATEIEN || !lesbar) return;
    var e = sammlung[kennung];
    var inhalt = e ? JSON.stringify({ kennung: kennung, zuletzt: e.zuletzt, je: e.je }) : null;
    var pfad = "/sollergebnis/" + encodeURIComponent(kennung);
    kette = kette.then(function () {
      return fetch(pfad, inhalt
        ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: inhalt }
        : { method: "DELETE" });
    }).then(function (r) {
      if (!r.ok) throw new Error("Antwort " + r.status);
    }).catch(function () {
      schreibfehler = true;
      melde("Das Sollergebnis ließ sich nicht als Datei speichern.");
    });
  }

  /* Was aus der Zeit vor den Dateien noch im Browser steht, wird einmalig zur Datei. */
  async function uebernimmAltes() {
    var alt = null;
    try { alt = JSON.parse(localStorage.getItem(ALTER_SCHLUESSEL)); } catch (e) { return; }
    if (!alt) return;
    H.drehbuecher.forEach(function (d) {
      if (alt[d.kennung] && !sammlung[d.kennung]) {
        sammlung[d.kennung] = alt[d.kennung];
        schreibe(d.kennung);
      }
    });
    await kette;
    if (!schreibfehler) {
      try { localStorage.removeItem(ALTER_SCHLUESSEL); } catch (e) { /* bleibt liegen, stört nicht */ }
    }
  }

  function gleich(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function pruefeEinzeln(p) {
    if (p.pfad !== undefined) return gleich(H.zustand.lies(p.pfad), p.gleich);
    if (p.sicht !== undefined) {
      var s = document.querySelector('[data-sicht="' + p.sicht + '"]');
      var da = !!(s && s.querySelector('[data-pfad="' + (p.enthaelt || p.enthaeltNicht) + '"]'));
      return p.enthaelt ? da : !da;
    }
    if (p.nachricht !== undefined) {
      return H.bus.protokoll.some(function (m) { return m.objekt + "." + m.aktion === p.nachricht; });
    }
    return false;
  }

  /* Eine Erwartung mit „bei“ gilt nur, wenn genau diese Varianten aktiv sind. */
  function geltende(d) {
    var stand = H.stand();
    return H.erwartungenVon(d).filter(function (e) {
      return Object.keys(e.bei || {}).every(function (platz) { return stand[platz] === e.bei[platz]; });
    });
  }

  function flach(w, pfad, out) {
    if (w !== null && typeof w === "object" && !Array.isArray(w)) {
      Object.keys(w).forEach(function (k) { flach(w[k], pfad ? pfad + "/" + k : k, out); });
    } else {
      out[pfad] = w;
    }
    return out;
  }

  /* Was eine Ansicht mehr oder weniger zeigt, je Pfad einmal (Pfade können mehrfach vorkommen). */
  /* Was der Anforderer an einem Element sieht: seine Beschriftung (aria-label) oder ein Eingabefeld
     mit Platzhalter. Kein Fachwissen: Die Hülle liest nur, was auf dem Bildschirm steht. */
  function anfuehrung(t) { return "„" + String(t).replace(/„/g, "‚").replace(/“/g, "‘") + "“"; }
  function beschriftung(e) {
    var l = e.getAttribute("aria-label");
    if (l) return l;
    var f = e.matches("input, textarea") ? e : e.querySelector("input, textarea");
    if (f && f.placeholder) return (f.type === "search" ? "das Suchfeld " : "das Eingabefeld ") + anfuehrung(f.placeholder);
    return null;
  }
  /* Ohne Beschriftung: Ist das Element ein Ablageort einer Bedienung, heißt es nach ihr. */
  function nameImBild(sicht, pfad) {
    var e = document.querySelector('[data-sicht="' + sicht + '"] [data-pfad="' + pfad.replace(/"/g, '\\"') + '"]');
    if (!e) return null;
    var n = beschriftung(e);
    if (n) return n;
    var b = H.alleBedienungen().filter(function (x) {
      try { return x.ziel && x.titel && e.matches(x.ziel); } catch (f) { return false; }
    })[0];
    return b ? "die Ablagefläche für " + anfuehrung(b.titel) : null;
  }

  function zaehle(liste) { var z = {}; liste.forEach(function (p) { z[p] = (z[p] || 0) + 1; }); return z; }
  function sichtUnterschied(u) {
    var a = zaehle(u.alt), b = zaehle(u.neu), out = { dazu: [], weg: [], mehr: [], weniger: [] };
    Object.keys(Object.assign({}, a, b)).sort().forEach(function (p) {
      if (!a[p]) out.dazu.push(p);
      else if (!b[p]) out.weg.push(p);
      else if (b[p] > a[p]) out.mehr.push(p);
      else if (b[p] < a[p]) out.weniger.push(p);
    });
    return out;
  }

  /* Plan oder Anzeige? Was eine Ansicht zeigt, ist Anzeige; im Zustand ist es Plan, außer ein
     Plugin sagt, der Wert ist nur für die Anzeige da (z. B. ob eine Liste aufgeklappt ist). */
  function ebene(pfad) {
    if (pfad.indexOf("sichten/") === 0) return "anzeige";
    return H.nurAnzeige().some(function (m) { return H.passtPfad(m, pfad); }) ? "anzeige" : "plan";
  }

  /* Hat kein Plugin Worte dafür, sagt die Hülle wenigstens, wo es anders ist. */
  function ohneWorte(unterschiede) {
    var sicht = unterschiede.filter(function (u) { return u.pfad.indexOf("sichten/") === 0; })[0];
    if (!sicht) return "Ein Wert im Endstand ist anders; dafür gibt es noch keinen Satz.";
    var mehr = sicht.neu.length - sicht.alt.length;
    var titel = "„" + H.titelVon(sicht.pfad.slice("sichten/".length)) + "“";
    if (mehr > 0) return titel + " zeigt jetzt " + mehr + " Einträge mehr";
    if (mehr < 0) return titel + " zeigt jetzt " + (-mehr) + " Einträge weniger";
    return titel + " zeigt jetzt andere Einträge";
  }

  H.soll = {
    geltende: geltende,
    /* Ist diese eine Erwartung am Endstand erfüllt? null, wenn sie mit den aktiven Varianten nicht gilt. */
    erfuellt: function (e) {
      var stand = H.stand();
      if (!Object.keys(e.bei || {}).every(function (platz) { return stand[platz] === e.bei[platz]; })) return null;
      return e.pruefe.every(pruefeEinzeln);
    },

    /* Liest die Dateien, bevor das erste Drehbuch läuft. */
    lade: async function () {
      if (!MIT_DATEIEN) return;
      try {
        var r = await fetch("/sollergebnisse");
        if (!r.ok) throw new Error("Antwort " + r.status);
        sammlung = await r.json();
      } catch (e) {
        lesbar = false;
        melde("Die Sollergebnisse ließen sich nicht lesen und werden nicht gespeichert. Bitte das Fenster von Play schließen und neu starten.");
        return;
      }
      await uebernimmAltes();
    },

    start: function () {
      offen.splice(0).forEach(function (t) { H.player.melde(t); });
    },

    /* Erste nicht erfüllte Erwartung, sonst null. Ein gespieltes Drehbuch trägt eine Kopie seines
       Endstands; gibt es ein Sollergebnis, gilt das, denn ein Wunsch darf das Ergebnis ändern.
       hatSoll: für die unsichtbare Kopie, die die Sollergebnisse nur als Grundlagen bekommt. */
    pruefe: function (d, hatSoll) {
      if (H.fehler.length) return "Ein Baustein ist während des Ablaufs ausgefallen.";
      if (d.gespielt && (hatSoll === undefined ? this.grundlage(d.kennung) : hatSoll)) return null;
      var liste = geltende(d);
      for (var i = 0; i < liste.length; i++) {
        if (!liste[i].pruefe.every(pruefeEinzeln)) return liste[i].text;
      }
      return null;
    },

    /* namen: was ein Element ist, so wie der Anforderer es sieht (Beschriftung, Suchfeld), damit ein
       Satz es auch nennen kann, wenn es später fehlt. Nur Elemente mit eigener Beschriftung. */
    endstand: function () {
      var sichten = {}, namen = {};
      document.querySelectorAll("[data-sicht]").forEach(function (s) {
        if (s.hidden) return;
        var pfade = [];
        s.querySelectorAll("[data-pfad]").forEach(function (e) {
          var p = e.getAttribute("data-pfad"), n = beschriftung(e);
          pfade.push(p);
          if (n && !namen[p]) namen[p] = n;
        });
        sichten[s.getAttribute("data-sicht")] = pfade.sort();
      });
      var out = { zustand: JSON.parse(JSON.stringify(H.zustand.wurzel)), sichten: sichten };
      if (Object.keys(namen).length) out.namen = namen;
      return out;
    },

    /* Unterschiede soll → ist. Was im Soll noch nicht vorkam, ist neu dazugekommen und keine Abweichung. */
    vergleiche: function (soll, ist) {
      var a = flach(soll.zustand, "", {}), b = flach(ist.zustand, "", {}), out = [];
      Object.keys(a).forEach(function (p) {
        if (!gleich(a[p], b[p])) out.push({ pfad: p, alt: a[p], neu: b[p] });
      });
      Object.keys(soll.sichten).forEach(function (k) {
        if (ist.sichten[k] === undefined) return;
        if (!gleich(soll.sichten[k], ist.sichten[k])) {
          /* namen: wie der Anforderer die Elemente sieht, die keine Fachobjekte sind */
          var namen = Object.assign({}, soll.namen || {}, ist.namen || {});
          ist.sichten[k].forEach(function (p) {
            if (namen[p] || soll.sichten[k].indexOf(p) !== -1) return;
            var n = nameImBild(k, p);
            if (n) namen[p] = n;
          });
          out.push({ pfad: "sichten/" + k, alt: soll.sichten[k], neu: ist.sichten[k], titel: H.titelVon(k), namen: namen });
        }
      });
      return out;
    },

    /* Je Änderung ein Satz in Fachsprache, mit Ebene: [{ ebene: "plan"|"anzeige", satz }].
       Die Worte kommen von den Plugins (beschreibe); ein Hook darf einen Satz, mehrere oder null
       (heißt: dazu ist nichts zu sagen) liefern. Bei Ansichten bekommt er dazu, weg, mehr, weniger. */
    aenderungen: function (unterschiede) {
      var hooks = H.beschreibungen(), out = [], stumm = 0;
      unterschiede.forEach(function (u) {
        var e = ebene(u.pfad);
        if (u.pfad.indexOf("sichten/") === 0) u = Object.assign({}, u, sichtUnterschied(u));
        for (var i = 0; i < hooks.length; i++) {
          if (!H.passtPfad(hooks[i].muster, u.pfad)) continue;
          var t = hooks[i].tue(u, hooks[i].kontext);
          if (!t || (Array.isArray(t) && !t.length)) { stumm++; return; }
          [].concat(t).forEach(function (satz) { out.push({ ebene: e, satz: satz }); });
          return;
        }
        out.push({ ebene: e, satz: ohneWorte([u]) });
      });
      /* Nur Stummes: Es ist trotzdem etwas anders, das soll nicht untergehen. */
      if (!out.length && stumm) out.push({ ebene: ebene(unterschiede[0].pfad), satz: ohneWorte(unterschiede) });
      return out;
    },

    /* Ein Satz in Fachsprache; die Worte kommen von den Plugins. Ohne Worte gilt ersatz. */
    satz: function (unterschiede, ersatz) {
      if (!unterschiede.length) return null;
      var hooks = H.beschreibungen();
      function beschreibe(liste) {
        var saetze = [];
        liste.forEach(function (u) {
          /* Bei Ansichten bekommt der Hook dazu, weg, mehr, weniger – wie in aenderungen() */
          if (u.pfad.indexOf("sichten/") === 0) u = Object.assign({}, u, sichtUnterschied(u));
          for (var i = 0; i < hooks.length; i++) {
            if (!H.passtPfad(hooks[i].muster, u.pfad)) continue;
            var t = hooks[i].tue(u, hooks[i].kontext);
            [].concat(t || []).forEach(function (x) { if (x) saetze.push(x); });
            return;
          }
        });
        return saetze;
      }
      var imZustand = unterschiede.filter(function (u) { return u.pfad.indexOf("sichten/") !== 0; });
      var saetze = beschreibe(imZustand);
      if (!saetze.length) saetze = beschreibe(unterschiede);
      if (!saetze.length) return ersatz === undefined ? ohneWorte(unterschiede) : ersatz;
      var rest = saetze.length - 1;
      return saetze[0] + (rest === 1 ? "; " + saetze[1] : rest > 1 ? "; " + saetze[1] + (rest === 2 ? " (und eine weitere Änderung)" : " (und " + (rest - 1) + " weitere Änderungen)") : "");
    },

    standSchluessel: function () { return JSON.stringify(H.stand()); },

    /* Vergleichsgrundlage: { endstand, gleicherStand } oder null */
    grundlage: function (kennung) {
      var e = sammlung[kennung];
      if (!e) return null;
      var st = this.standSchluessel();
      if (e.je[st]) return { endstand: e.je[st], gleicherStand: true };
      if (e.zuletzt && e.je[e.zuletzt]) return { endstand: e.je[e.zuletzt], gleicherStand: false };
      return null;
    },

    alleGrundlagen: function () {
      var self = this, out = {};
      H.drehbuecher.forEach(function (d) { out[d.kennung] = self.grundlage(d.kennung); });
      return out;
    },

    /* Speichert den Endstand als Sollergebnis; zurück kommt die Rücknahme. */
    merke: function (kennung, endstand) {
      var st = this.standSchluessel();
      var vorher = sammlung[kennung] ? JSON.parse(JSON.stringify(sammlung[kennung])) : null;
      var e = sammlung[kennung] || (sammlung[kennung] = { zuletzt: null, je: {} });
      e.je[st] = endstand;
      e.zuletzt = st;
      schreibe(kennung);
      if (!MIT_DATEIEN) melde(HINWEIS_DOPPELKLICK);
      return function () {
        if (vorher) sammlung[kennung] = vorher; else delete sammlung[kennung];
        schreibe(kennung);
      };
    },

    anzahl: function () {
      return Object.keys(sammlung).reduce(function (n, k) { return n + Object.keys(sammlung[k].je).length; }, 0);
    }
  };
})();
