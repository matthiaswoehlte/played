/* Feste Hülle, Teil 1: Bus, Zustand, Plugin-Lader.
   Themenunabhängig: hier steht kein Wort über ein Fachgebiet.

   Nachricht (Architekturgrundsatz §2):
     objekt     fester Pfad, z. B. "bereich/kennung"
     aktion     Ereignisart; zusammen die Form Objekt.Aktion
     parameter  Key/Value
     absender   Pfad des Senders ("plugins/<kennung>", "drehbuecher/<kennung>")
     zeit       Spielzeit "hh:mm"
     ausloeser  Nummer der Nachricht, die diese ausgelöst hat (oder null)
     erzaehlung Satz in Fachsprache für die Erzählzeile (optional)

   Ablauf einer Nachricht: Bühne kündigt an → Abonnenten verarbeiten →
   jede Zustandsänderung wird als <objekt>.geaendert zugestellt → fällige
   Ansichten zeichnen neu → Bühne zeigt die Bewegung. Eine stille Bühne
   überspringt nur das Zeigen; der Rechenweg ist derselbe.

   Vor dem Zustellen fragt der Bus die Prüfungen der Plugins (def.prueft). Sagt eine Nein,
   erreicht die Nachricht keinen Abonnenten, stattdessen geht <objekt>.verweigert hinaus.
   Das gilt für jede Nachricht, gleich ob sie aus einem Drehbuch oder von Hand kommt.

   Bus-Vertrag (Auftrag 005, BUS-VERTRAG.md): feste Reihenfolge nach Pfad, jede Nachricht trägt
   Nummer, Auslöser, Ursprung, Tiefe, Zeit und Objektpfad; ein Wert hat genau einen Besitzer
   (def.besitzt); Schleifen und Abstürze nehmen die ganze Kette zurück; Plugins warten nie und
   haben keine eigene Uhr und keinen eigenen Zufall. */
(function (global) {
  "use strict";

  /* ---------- Pfade und Muster ---------- */
  function teileMuster(muster) {
    var i = muster.lastIndexOf(".");
    if (i < 0) throw new Error("Pattern without action: " + muster);
    return { objekt: muster.slice(0, i), aktion: muster.slice(i + 1) };
  }
  /* "*" steht für genau einen Pfadteil oder für jede Aktion. */
  function passt(muster, objekt, aktion) {
    var m = teileMuster(muster);
    if (m.aktion !== "*" && m.aktion !== aktion) return false;
    var a = m.objekt.split("/"), b = objekt.split("/");
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== "*" && a[i] !== b[i]) return false;
    }
    return true;
  }
  function kopie(w) { return w === undefined ? undefined : JSON.parse(JSON.stringify(w)); }

  /* ---------- Datenmodell: Objektarten und Status (Auftrag 005, Stufe 2) ----------
     Die Daten des Tags beschreiben unter „arten“ je Bereich, wie ein Objekt heißt, welchen Status es
     haben kann, wohin es von dort weitergeht, welches Ereignis den Status setzt und welche Fristen die
     Uhr überwacht. Den Status führt die Hülle: Ein Plugin sendet den Befehl <objekt>.status, die Hülle
     prüft den Übergang und setzt ihn; alle anderen reagieren auf die Änderung. Die Worte kommen aus den
     Daten, die Hülle selbst kennt kein Fachgebiet. */
  var STATUS = "status";
  function arten() { return (Huelle.tag && Huelle.tag.arten) || {}; }
  function statusArt(bereich) { var a = arten()[bereich]; return a && a.status ? a : null; }
  function istStatusPfad(pfad) {
    var t = String(pfad).split("/");
    return t.length === 3 && t[2] === STATUS && !!statusArt(t[0]);
  }
  function nennung(objekt) {
    var t = String(objekt).split("/"), a = arten()[t[0]], o = zustand.lies(t.slice(0, 2).join("/"));
    try { if (a && a.nennung && o) return a.nennung(o, lesend); } catch (e) { /* dann die Kennung */ }
    return t[1] || objekt;
  }
  /* Anweisung 53: wie die Teil-App ein Objekt nennt, so wie es auf dem Bildschirm steht; null, wenn ihr Datenmodell keinen Namen hat */
  function nenne(pfad) {
    var t = String(pfad).split("/"), a = arten()[t[0]];
    if (t.length !== 2 || !a || !a.nennung || !zustand.lies(pfad)) return null;
    return nennung(pfad);
  }
  function statusName(bereich, s) {
    var a = statusArt(bereich);
    return a && a.status.werte[s] ? a.status.werte[s] : String(s);
  }
  function erlaubteNach(objekt) {
    var t = String(objekt).split("/"), a = statusArt(t[0]);
    if (!a) return [];
    return (a.status.uebergaenge[zustand.lies(t[0] + "/" + t[1] + "/" + STATUS)] || []).slice();
  }
  /* Warum ein Statuswechsel nicht geht, als Satz; null, wenn er geht */
  function statusNein(objekt, neu) {
    var t = String(objekt).split("/"), a = statusArt(t[0]);
    if (!a) return null;
    var alt = zustand.lies(t[0] + "/" + t[1] + "/" + STATUS);
    if (!a.status.werte[neu]) return "“" + neu + "” does not exist as a status";
    if (alt === neu || erlaubteNach(objekt).indexOf(neu) !== -1) return null;
    return nennung(objekt) + " is " + statusName(t[0], alt) + "; from " + statusName(t[0], alt) + " it cannot go to " + statusName(t[0], neu);
  }

  /* ---------- Zustand ---------- */
  var zustand = {
    wurzel: {},
    aenderungen: [],
    laden: function (objekte) { this.wurzel = kopie(objekte); this.aenderungen = []; },
    /* Rückgabe ist eine Kopie: geändert wird nur über setze(). */
    lies: function (pfad) {
      var w = this.wurzel, teile = pfad.split("/");
      for (var i = 0; i < teile.length; i++) {
        if (w === null || w === undefined) return undefined;
        w = w[teile[i]];
      }
      return kopie(w);
    },
    alle: function (bereich) {
      var b = this.wurzel[bereich] || {};
      return Object.keys(b).map(function (k) { return kopie(b[k]); });
    },
    /* Pfad = Objekt + Feld, z. B. "bereich/kennung/feld". wer: das Plugin, das setzt. */
    setze: function (pfad, wert, wer) {
      var teile = pfad.split("/"), feld = teile.pop(), w = this.wurzel;
      teile.forEach(function (t) {
        if (w[t] === undefined) w[t] = {};
        w = w[t];
      });
      var alt = w[feld];
      if (JSON.stringify(alt) === JSON.stringify(wert)) return;
      w[feld] = kopie(wert);
      this.aenderungen.push({ objekt: teile.join("/"), feld: feld, alt: kopie(alt), neu: kopie(wert), durch: wer || null });
    },
    nimmAenderungen: function () { var a = this.aenderungen; this.aenderungen = []; return a; }
  };

  /* ---------- Widersprüche ----------
     Setzen zwei Plugins auf dieselbe Nachricht hin denselben Wert verschieden, gilt der letzte.
     Das wird festgehalten; die Verwaltung sagt es beiden Plugins in Fachsprache. */
  var schreiber = {};    // je zugestellter Nachricht: pfad → { kennung, wert }
  function vermerke(kennung, pfad, wert) {
    var m = bus.aktuell;
    if (!m) return;
    var davor = schreiber[pfad];
    schreiber[pfad] = { kennung: kennung, wert: kopie(wert) };
    if (!davor || davor.kennung === kennung || JSON.stringify(davor.wert) === JSON.stringify(wert)) return;
    Huelle.widersprueche.push({
      a: davor.kennung, b: kennung, pfad: pfad, alt: davor.wert, neu: kopie(wert),
      ereignis: m.erzaehlung, nachricht: m.objekt + "." + m.aktion
    });
  }

  /* ---------- Schreibspur ----------
     Wer seit Tagesbeginn welchen Wert gesetzt hat, und auf welche Nachricht hin. Daraus sagt
     die Hülle mechanisch, welches Plugin einen Wert verursacht hat (für den Wächter). */
  var spur = {};
  /* Wer seit Tagesbeginn etwas getan hat: einen Wert geändert, eine Nachricht gesendet oder
     eine verweigert. Einrichten bei Tagesbeginn zählt nicht. Daraus folgt, welche Drehbücher
     zu einem Plugin gehören („Vorspielen“ an einem Plugin). */
  var taten = {};
  /* Welche Felder seit Tagesbeginn geändert wurden, je Bereich: Sternchen statt Kennung. Daraus folgt, ob ein
     Szenario eine Regel berührt (Teil 12, Lücken). */
  var felder = {};
  /* Wessen Abonnent oder Prüfung seit Tagesbeginn gerufen wurde: Ein Plugin, das in keinem Szenario
     gerufen wird, hat kein Szenario (Teil 12, Lücken). */
  var gerufen = {};
  /* Plugin → Fachobjekt → „liest“ oder „aendert“, je Tag: daraus berechnet der Navigator die Stränge (Auftrag 010).
     Daneben je Angabe ein Eintrag „mitarbeiter/abwesend“, damit ein Strang sagen kann, was am Fachobjekt angefasst wird. */
  var zugriffe = {};
  function merkeArt(z, schluessel, art) { if (art === "aendert" || !z[schluessel]) z[schluessel] = art; }
  function merkeZugriff(k, p, art) {
    var t = String(p).split("/"), z = zugriffe[k] || (zugriffe[k] = {});
    if (!t[0]) return;
    merkeArt(z, t[0], art);
    if (t.length >= 3) merkeArt(z, t[0] + "/" + t[2], art);
  }
  /* Ein gelesenes Fachobjekt meldet, welche Angaben das Plugin wirklich anschaut. */
  function meldetFelder(k, w, o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return o;
    return new Proxy(o, { get: function (t, f) {
      if (typeof f === "string" && f !== "kennung" && Object.prototype.hasOwnProperty.call(t, f)) merkeArt(zugriffe[k] || (zugriffe[k] = {}), w + "/" + f, "liest");
      return t[f];
    } });
  }
  function gelesen(k, p, w) {
    var t = String(p).split("/");
    if (t.length === 2) return meldetFelder(k, t[0], w);
    if (t.length === 1 && w && typeof w === "object") Object.keys(w).forEach(function (i) { w[i] = meldetFelder(k, t[0], w[i]); });
    return w;
  }
  /* Je Ursprungsereignis: welche Bereiche mit Status seine Kette ändert und ob dabei ein Plugin den
     Status dieses Bereichs gelesen hat. Ändert eine Kette Aufträge, ohne je auf ihren Status zu schauen,
     gilt für die übrigen Status keine Regel (Fälle ohne Regel, Stufe 2). */
  var wirkung = {};       // Ursprung-Nr → { aendert: { bereich }, liest: { bereich } }
  var verfolge = false;   // läuft gerade ein Abonnent oder eine Prüfung eines Plugins?
  function wirkungJetzt() { return verfolge && bus.kette ? wirkung[bus.kette.nr] : null; }
  function merkeLesen(bereich) { var w = wirkungJetzt(); if (w) w.liest[bereich] = true; }
  /* Ein gelesenes Objekt eines Bereichs mit Status meldet, wenn jemand seinen Status anschaut. */
  function beobachtet(bereich, o) {
    if (!verfolge || !o || typeof o !== "object" || !statusArt(bereich)) return o;
    return new Proxy(o, { get: function (t, k) { if (k === STATUS) merkeLesen(bereich); return t[k]; } });
  }
  function spure(kennung, pfad, wert) {
    if (JSON.stringify(zustand.lies(pfad)) === JSON.stringify(wert)) return;
    taten[kennung] = true;
    var t = String(pfad).split("/");
    if (t.length >= 3) felder[t[0] + "/*/" + t[2]] = true;
    var m = bus.aktuell;
    spur[pfad] = { kennung: kennung, absender: m ? m.absender : null, eigenesObjekt: !!m && pfad.indexOf(m.objekt + "/") === 0 };
  }

  /* ---------- Bus ----------
     Feste Reihenfolge: Ein Ereignis wird ganz abgearbeitet, bevor das nächste beginnt;
     Folgeereignisse kommen hinten in die Warteschlange. Zu einer Nachricht ruft der Bus zuerst die
     Hülle, dann die Plugins nach ihrem Pfad (plugins/<kennung>, alphabetisch), nie nach der
     Reihenfolge des Einspielens. Jede Nachricht trägt nr, ausloeser (die Nachricht, in deren
     Verarbeitung sie entstand), ursprung (die erste der Kette), tiefe, zeit und objekt. */
  var GRENZE_TIEFE = 40;           // so viele Glieder darf eine Kette höchstens haben
  var GRENZE_JE_URSPRUNG = 1000;   // so viele Nachrichten darf ein Ursprungsereignis höchstens auslösen
  var GRENZE_WIEDERHOLUNG = 3;     // dieselbe Nachricht so oft in der eigenen Auslöserkette: Kreis
  var aboNr = 0;
  function aboVor(a, b) {
    if (a.rang !== b.rang) return a.rang - b.rang;
    if (a.rang === 1 && a.besitzer !== b.besitzer) return a.besitzer < b.besitzer ? -1 : 1;
    return a.nr - b.nr;
  }
  var bus = {
    abos: [],
    warteschlange: [],
    protokoll: [],
    nr: 0,
    aktuell: null,     // die Nachricht aus der Warteschlange, die gerade verarbeitet wird
    kontext: null,     // die Nachricht, deren Abonnenten gerade laufen (auch eine Änderung)
    letzte: null,
    arbeitet: false,
    kette: null,       // { nr, vorher, spur, gescheitert, zahl } des laufenden Ursprungsereignisses

    /* info: { sicht } für Abos, die nur eine Ansicht fällig machen */
    abonniere: function (muster, tue, besitzer, info) {
      teileMuster(muster);
      var istPlugin = typeof besitzer === "string" && besitzer.indexOf("/") === -1;
      this.abos.push({ muster: muster, tue: tue, besitzer: besitzer, rang: istPlugin ? 1 : 0, nr: ++aboNr, sicht: info && info.sicht || null });
      this.abos.sort(aboVor);
    },
    entferneAbos: function (besitzer) {
      this.abos = this.abos.filter(function (a) { return a.besitzer !== besitzer; });
    },
    leeren: function () {
      this.warteschlange = []; this.protokoll = []; this.nr = 0; this.aktuell = null; this.kontext = null;
      this.letzte = null; this.kette = null;
    },
    vater: function () {
      return this.kontext || (this.letzte ? this.protokoll[this.letzte - 1] || null : null);
    },
    neu: function (n, absender) {
      if (!n || !n.objekt || !n.aktion) throw new Error("Message needs an object and an action");
      var v = this.vater();
      return {
        nr: null, objekt: n.objekt, aktion: n.aktion, parameter: n.parameter || {},
        absender: absender || n.absender || null, zeit: uhr.zeit,
        ausloeser: v ? v.nr : null, ursprung: v ? v.ursprung : null, tiefe: v ? v.tiefe + 1 : 0,
        erzaehlung: n.erzaehlung || null,
        /* Anweisung 49 (b): die Teil-App, aus der die Nachricht kommt; ihr Pfad trägt ihren Namen (teilApp/objekt) */
        teilApp: Huelle.herkunftTeilApp(n, absender || n.absender || null, v),
        /* stumm: die Bühne führt sie nicht vor (Meldungen und Takt der Uhr); Ketten zeigen sie */
        stumm: !!n.stumm
      };
    },
    sende: function (n, absender) { this.warteschlange.push(this.neu(n, absender)); },
    zustellen: function (m) {
      schreiber = {};
      var self = this, vorher = this.kontext;
      if (m.nr) this.kontext = m;
      this.abos.slice().forEach(function (a) {
        if (!passt(a.muster, m.objekt, m.aktion)) return;
        if (a.rang === 1 && !Huelle.hoertZu(a.besitzer, m)) return;
        if (m.nr) {
          if (a.sicht) { if ((m.sichten || (m.sichten = [])).indexOf(a.sicht) === -1) m.sichten.push(a.sicht); }
          else if (a.rang === 1 && (m.gerufen || (m.gerufen = [])).indexOf(a.besitzer) === -1) m.gerufen.push(a.besitzer);
        }
        var warVerfolgt = verfolge;
        verfolge = a.rang === 1 && !!m.nr;
        try {
          var r = a.tue(m);
          if (r && typeof r.then === "function") {
            r.then(null, function () {});
            self.scheitert(a.besitzer, Huelle.titelVon(a.besitzer) + " waits on the bus; a plugin must never wait there");
          }
        } catch (e) {
          Huelle.meldeFehler(a.besitzer, e);
          /* Nur ein Plugin nimmt die Kette zurück; ein Fehler in der Anzeige der Hülle nicht. */
          if (a.rang === 1) self.scheitert(a.besitzer, e && e.message ? e.message : String(e));
        } finally {
          verfolge = warVerfolgt;
        }
      });
      this.kontext = vorher;
    },
    /* Ein Plugin ist in der laufenden Kette ausgefallen: Die ganze Kette wird zurückgenommen. */
    scheitert: function (wer, text) {
      if (this.kette && !this.kette.gescheitert) this.kette.gescheitert = { wer: wer, text: text };
    },
    /* Flüchtig: wird zugestellt, aber nicht festgehalten (Uhr, Takt). */
    melde: function (objekt, aktion, parameter) {
      this.zustellen({ objekt: objekt, aktion: aktion, parameter: parameter || {} });
    },
    festhalten: function (m) {
      m.nr = ++this.nr;
      if (m.ursprung === null || m.ursprung === undefined) { m.ursprung = m.nr; m.tiefe = 0; }
      this.protokoll.push(m);
      return m;
    },
    /* Die Auslöserkette einer Nachricht, von ihr selbst bis zum Ursprung */
    vorfahren: function (m) {
      var out = [], x = m;
      while (x) { out.push(x); x = x.ausloeser ? this.protokoll[x.ausloeser - 1] : null; }
      return out;
    },
    /* Läuft die Kette im Kreis oder ufert sie aus? Dann ein Satz, sonst null. */
    schleife: function (m) {
      if (!this.kette) return null;
      this.kette.zahl++;
      function zeichen(x) {
        return x.absender + "|" + x.objekt + "." + x.aktion + (x.aktion === "geaendert" ? "|" + x.parameter.feld + "|" + x.durch : "");
      }
      var kette = this.vorfahren(m), z = zeichen(m), gleiche = [];
      kette.forEach(function (x, i) { if (zeichen(x) === z) gleiche.push(i); });
      var stueck = null;
      if (gleiche.length >= GRENZE_WIEDERHOLUNG) stueck = kette.slice(0, gleiche[1] + 1);
      else if (m.tiefe > GRENZE_TIEFE || this.kette.zahl > GRENZE_JE_URSPRUNG) stueck = kette.slice(0, Math.min(kette.length, 12));
      if (!stueck) return null;
      var wer = [];
      stueck.forEach(function (x) {
        [x.durch, /^plugins\//.test(x.absender || "") ? x.absender.slice(8) : null].concat(x.gerufen || []).forEach(function (k) {
          if (k && wer.indexOf(k) === -1) wer.push(k);
        });
      });
      var namen = wer.sort().map(function (k) { return "“" + Huelle.titelVon(k) + "”"; });
      var ursprung = this.protokoll[m.ursprung - 1];
      var zwischen = namen.length > 1 ? " between " + namen.slice(0, -1).join(", ") + " and " + namen[namen.length - 1]
        : namen.length ? " in " + namen[0] : "";
      return { wer: wer, satz: Huelle.ereignisName(ursprung) + " causes an endless loop" + zwischen + "." };
    },
    /* Stand vor dem Ursprungsereignis wieder herstellen; was von der Kette noch wartet, verfällt. */
    zuruecknehmen: function (grund) {
      var k = this.kette;
      if (!k) return;
      zustand.wurzel = kopie(k.vorher);
      zustand.aenderungen = [];
      spur = k.spur;
      this.warteschlange = this.warteschlange.filter(function (x) { return x.ursprung !== k.nr; });
      var ursprung = this.protokoll[k.nr - 1];
      ursprung.zurueckgenommen = grund.satz;
      this.kette = null;
      this.letzte = null;
      Object.keys(plugins).forEach(function (kn) { plugins[kn].faellig = true; });
      Huelle.meldeVertrag(grund.satz + " The previous state applies again.", grund.wer, "zurueckgenommen");
    },
    /* Prüft nach jedem Schritt, ob die Kette gescheitert ist; dann zurück. */
    gescheitert: function () {
      var g = this.kette && this.kette.gescheitert;
      if (!g) return false;
      var ursprung = this.protokoll[this.kette.nr - 1];
      this.zuruecknehmen({
        wer: [g.wer],
        satz: Huelle.ereignisName(ursprung) + ": “" + Huelle.titelVon(g.wer) + "” failed in the process (" + g.text + ")."
      });
      return true;
    },
    aenderungenZustellen: function (ausloeser) {
      var schlange = zustand.nimmAenderungen().map(function (a) { return { a: a, von: ausloeser }; });
      while (schlange.length) {
        var x = schlange.shift(), a = x.a;
        var m = this.festhalten({
          nr: null, objekt: a.objekt, aktion: "geaendert",
          parameter: { feld: a.feld, alt: a.alt, neu: a.neu },
          absender: "huelle/zustand", durch: a.durch, zeit: uhr.zeit, teilApp: a.durch ? Huelle.teilAppVon(a.durch) : x.von.teilApp,
          ausloeser: x.von.nr, ursprung: x.von.ursprung, tiefe: x.von.tiefe + 1, erzaehlung: null
        });
        var kreis = this.schleife(m);
        if (kreis) { this.zuruecknehmen(kreis); return; }
        this.zustellen(m);
        if (this.gescheitert()) return;
        zustand.nimmAenderungen().forEach(function (b) { schlange.push({ a: b, von: m }); });
      }
    },
    /* Arbeitet alles ab, bis Ruhe ist. Wird es ruhig, erfährt das der Bus-Takt;
       wer erst den Endstand einer ganzen Kette braucht, schreibt sich dort ein. */
    abarbeiten: async function (buehne) {
      this.arbeitet = true;
      try {
        for (;;) {
          while (this.warteschlange.length) {
            var m = this.festhalten(this.warteschlange.shift());
            if (m.ursprung === m.nr) {
              this.kette = { nr: m.nr, vorher: kopie(zustand.wurzel), spur: Object.assign({}, spur), gescheitert: null, zahl: 0 };
              wirkung[m.nr] = { aendert: {}, liest: {} };
            }
            var kreis = this.schleife(m);
            if (kreis) { this.zuruecknehmen(kreis); Huelle.zeichneFaellige(); continue; }
            await buehne.vorher(m);
            var bild = buehne.schnappschuss(m);
            this.aktuell = m;
            var nein = Huelle.urteil(m);
            if (nein) this.verweigere(m, nein);
            else this.zustellen(m);
            if (!this.gescheitert()) this.aenderungenZustellen(m);
            this.aktuell = null;
            if (this.kette) this.letzte = m.nr;
            Huelle.zeichneFaellige();
            await buehne.nachher(m, bild);
          }
          this.melde("bus/takt", "ruhe");
          if (this.gescheitert()) Huelle.zeichneFaellige();
          if (!this.warteschlange.length) { this.letzte = null; this.kette = null; return; }
        }
      } finally {
        this.arbeitet = false;
      }
    },
    /* Ein neues Ursprungsereignis (Drehbuch, Hand): hängt an keiner laufenden Kette. */
    sendeNeu: function (n, absender) {
      var m = this.neu(n, absender);
      m.ausloeser = null; m.ursprung = null; m.tiefe = 0;
      this.warteschlange.push(m);
    },
    verweigere: function (m, nein) {
      var vorher = this.kontext;
      this.kontext = m;
      try { this.sendeVerweigert(m, nein); }
      finally { this.kontext = vorher; }
    },
    sendeVerweigert: function (m, nein) {
      this.sende({
        objekt: m.objekt, aktion: "verweigert",
        parameter: { aktion: m.aktion, gewuenscht: m.parameter, grund: nein.grund },
        erzaehlung: nein.erzaehlung || nein.grund
      }, "huelle/pruefung");
    }
  };

  /* ---------- Status: die Hülle führt ihn (Datenmodell) ----------
     Befehl <objekt>.status { status }: Die Prüfung (Huelle.urteil) hat einen nicht erlaubten Übergang
     schon verweigert; hier wird gesetzt. Ein Ereignis aus status.durch (z. B. Onblock) setzt den Status
     ebenso, wenn der Übergang erlaubt ist. */
  function setzeStatus(objekt, neu) {
    var t = objekt.split("/"), p = t[0] + "/" + t[1] + "/" + STATUS;
    if (!zustand.lies(t[0] + "/" + t[1]) || statusNein(objekt, neu) || zustand.lies(p) === neu) return;
    felder[t[0] + "/*/" + STATUS] = true;
    zustand.setze(p, neu, null);
    return true;
  }
  bus.abonniere("*/*.*", function (m) {
    if (!m.nr) return;
    var t = m.objekt.split("/"), a = statusArt(t[0]);
    if (!a) return;
    var gesetzt = m.aktion === STATUS ? setzeStatus(m.objekt, m.parameter && m.parameter.status)
      : a.status.durch && a.status.durch[m.aktion] ? setzeStatus(m.objekt, a.status.durch[m.aktion]) : false;
    /* Anweisung 42: Den Status setzt Play, angestoßen hat es das sendende Plugin. Eigener Schlüssel, damit die Stränge bleiben, wie sie sind. */
    if (gesetzt && /^plugins\//.test(m.absender || "")) merkeArt(zugriffe[m.absender.slice(8)] || (zugriffe[m.absender.slice(8)] = {}), "befehl/" + t[0] + "/" + STATUS, "aendert");
  }, "huelle/status");

  /* Status zu Tagesbeginn: aus der Uhrzeit (status.zuBeginn), sonst der erste. */
  function statusZuBeginn(startzeit) {
    var jetzt = uhr.minuten(startzeit);
    Object.keys(arten()).sort().forEach(function (b) {
      var a = statusArt(b);
      if (!a) return;
      var erster = Object.keys(a.status.werte)[0], liste = zustand.wurzel[b] || {};
      Object.keys(liste).sort().forEach(function (id) {
        var s = erster;
        if (a.status.zuBeginn) {
          try { s = a.status.zuBeginn(kopie(liste[id]), jetzt, lesend) || erster; }
          catch (e) { Huelle.meldeFehler("daten", e); }
        }
        zustand.setze(b + "/" + id + "/" + STATUS, s, null);
      });
    });
  }

  /* Fällige Fristen: Objekte, die zur Zeit in ihrem Fristfeld noch im Status der Frist stehen */
  function fristenFaellig(hhmm) {
    var out = [];
    Object.keys(arten()).sort().forEach(function (b) {
      (arten()[b].fristen || []).forEach(function (f) {
        var liste = zustand.wurzel[b] || {};
        Object.keys(liste).sort().forEach(function (id) {
          var o = liste[id];
          if (o[STATUS] !== f.status || o[f.feld] !== hhmm) return;
          var satz = null;
          try { satz = f.satz ? f.satz(kopie(o)) : null; } catch (e) { Huelle.meldeFehler("daten", e); }
          out.push({ objekt: b + "/" + id, aktion: f.aktion, parameter: { frist: f.feld, zeit: hhmm }, erzaehlung: satz });
        });
      });
    });
    return out;
  }
  /* Hört ein Plugin auf diese Nachricht (Abonnent oder Prüfung)? */
  function hoertJemand(objekt, aktion) {
    if (bus.abos.some(function (a) { return a.rang === 1 && !a.sicht && passt(a.muster, objekt, aktion); })) return true;
    return reihenfolge.some(function (k) {
      return Object.keys(plugins[k].def.prueft || {}).some(function (mu) { return passt(mu, objekt, aktion); });
    });
  }

  /* ---------- Uhr ---------- */
  var uhr = {
    zeit: null,
    minuten: function (hhmm) { var t = String(hhmm).split(":"); return parseInt(t[0], 10) * 60 + parseInt(t[1], 10); },
    text: function (min) { return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + (min % 60)).slice(-2); },
    stelle: function (hhmm) { this.zeit = hhmm; bus.melde("uhr/tag", "tick", { zeit: hhmm }); }
  };

  /* ---------- Plugins ---------- */
  var plugins = {};      // kennung → { def, kontext, faellig }
  var reihenfolge = [];
  /* Ein Platz (def.platz = { kennung, titel, variante }) hat immer genau eine aktive
     Variante. Die anderen liegen im Vorrat und lassen sich ohne Nachladen zurückholen. */
  var vorrat = {};
  var einhaengungen = 0;
  var ablaeufe = 0;      // laufende Drehbücher; abgebrochene zählen, bis sie wirklich zu Ende sind
  var ladeName = null;   // Datei, die gerade eingespielt wird

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Prüfungen und Bedienungen dürfen nur lesen: Sie laufen auch während des Ziehens. */
  var lesend = {
    lies: function (p) { return zustand.lies(p); },
    alle: function (b) { return zustand.alle(b); },
    uhr: function () { return uhr.zeit; },
    minuten: function (t) { return uhr.minuten(t); },
    zeit: function (min) { return uhr.text(min); },
    /* Wohin der Status eines Objekts von hier aus weitergehen darf (Datenmodell), z. B. ["begonnen", "fertig"] */
    erlaubt: function (objekt) { return erlaubteNach(objekt); },
    /* Wie die Teil-App ein Objekt nennt (Datenmodell, nennung), z. B. „XC 615 Tanken auf TANK-01“; sonst null */
    nenne: function (pfad) { return nenne(pfad); },
    esc: esc
  };
  /* Dasselbe für Abonnenten und Prüfungen der Plugins: merkt sich, ob sie einen Status anschauen. */
  var verfolgend = Object.assign({}, lesend, {
    lies: function (p) {
      var w = zustand.lies(p), t = String(p).split("/");
      if (!verfolge) return w;
      if (t.length === 3 && t[2] === STATUS) merkeLesen(t[0]);
      else if (t.length === 2) return beobachtet(t[0], w);
      else if (t.length === 1 && w && typeof w === "object" && statusArt(t[0])) {
        Object.keys(w).forEach(function (k) { w[k] = beobachtet(t[0], w[k]); });
      }
      return w;
    },
    alle: function (b) {
      var liste = zustand.alle(b);
      return verfolge && statusArt(b) ? liste.map(function (o) { return beobachtet(b, o); }) : liste;
    },
    erlaubt: function (objekt) { merkeLesen(String(objekt).split("/")[0]); return erlaubteNach(objekt); }
  });

  /* ---------- Ein Wert, ein Besitzer ----------
     Jedes Plugin meldet in def.besitzt an, welche Werte es ändert (Muster wie bei abonniert: bereich, Stern, feld). Jeden Wert
     darf genau ein Plugin ändern; wer einen fremden oder nicht angemeldeten Wert setzt, ändert
     nichts, und die Hülle meldet es in einem Satz. Andere Plugins schicken dem Besitzer eine
     Nachricht (Befehl) und reagieren auf dessen Änderung (Tatsache). */
  function besitzerVon(pfad) {
    for (var i = 0; i < reihenfolge.length; i++) {
      var b = plugins[reihenfolge[i]].def.besitzt || [];
      for (var j = 0; j < b.length; j++) if (passt(b[j] + ".x", pfad, "x")) return reihenfolge[i];
    }
    return null;
  }
  /* Können zwei Muster denselben Pfad treffen? */
  function ueberlappen(a, b) {
    var x = a.split("/"), y = b.split("/");
    if (x.length !== y.length) return false;
    return x.every(function (t, i) { return t === "*" || y[i] === "*" || t === y[i]; });
  }
  function wertName(pfad) {
    var t = pfad.split("/");
    return "“" + t[t.length - 1] + "” on " + t.slice(0, -1).join("/");
  }
  var einrichten = false;   // beimStart läuft: Einrichten zählt nicht als Ereignis
  var implizit = {};        // Wert ohne angemeldeten Besitzer → das Plugin, das ihn heute zuerst geändert hat

  /* Zwei Besitzer für denselben Wert: gemeldet bei jedem Tagesbeginn; es gilt der erste nach Pfad,
     der andere ändert den Wert nicht. */
  function pruefeBesitz() {
    reihenfolge.forEach(function (a, i) {
      reihenfolge.slice(i + 1).forEach(function (b) {
        (plugins[a].def.besitzt || []).forEach(function (x) {
          (plugins[b].def.besitzt || []).forEach(function (y) {
            if (!ueberlappen(x, y)) return;
            Huelle.meldeVertrag("“" + plugins[a].def.titel + "” and “" + plugins[b].def.titel + "” both want to change " +
              wertName(x) + "; only one may do that. “" + plugins[a].def.titel + "”.", [a, b], "besitzer");
          });
        });
      });
    });
  }

  function kontextFuer(kennung) {
    var absender = "plugins/" + kennung;
    return Object.assign({}, verfolgend, {
      lies: function (p) { merkeZugriff(kennung, p, "liest"); return gelesen(kennung, p, verfolgend.lies(p)); },
      alle: function (b) { merkeZugriff(kennung, b, "liest"); return verfolgend.alle(b).map(function (o) { return meldetFelder(kennung, b, o); }); },
      setze: function (p, w) {
        /* Den Status führt die Hülle nach dem Datenmodell; ein Plugin sendet dafür <objekt>.status. */
        if (istStatusPfad(p)) {
          if (JSON.stringify(zustand.lies(p)) === JSON.stringify(w)) return;
          Huelle.meldeVertrag("“" + Huelle.titelVon(kennung) + "” sets the status of " + nennung(p) +
            " itself; Play keeps the status according to the data model. It stays as it was.", [kennung], "besitzer");
          return;
        }
        /* Ohne angemeldeten Besitzer (etwa eine ältere Fassung von vor dem Vertrag) gehört der Wert
           dem ersten Plugin, das ihn an diesem Tag ändert; auch dann gewinnt keins still. */
        var b = besitzerVon(p) || implizit[p] || (implizit[p] = kennung);
        if (b !== kennung) {
          Huelle.meldeVertrag("“" + Huelle.titelVon(kennung) + "” wants to change " + wertName(p) + "; only “" +
            Huelle.titelVon(b) + "” may do that. It stays as it was.", [kennung, b], "besitzer");
          /* Steht an beiden Plugins in der Leiste, wie früher ein Widerspruch; es gilt der Besitzer. */
          var m = bus.aktuell;
          Huelle.widersprueche.push({
            a: b, b: kennung, pfad: p, alt: zustand.lies(p), neu: kopie(w), besitzer: true,
            ereignis: m ? m.erzaehlung : null, nachricht: m ? m.objekt + "." + m.aktion : null
          });
          return;
        }
        if (!einrichten && !bus.aktuell) {
          Huelle.meldeVertrag("“" + Huelle.titelVon(kennung) + "” changes " + wertName(p) + " without a message. It stays as it was.", [kennung], "ohne-nachricht");
          return;
        }
        var wj = wirkungJetzt(), b0 = String(p).split("/")[0];
        if (wj && statusArt(b0) && JSON.stringify(zustand.lies(p)) !== JSON.stringify(w)) wj.aendert[b0] = true;
        merkeZugriff(kennung, p, "aendert");
        /* Hat ein anderes Plugin das per Nachricht veranlasst, ändert es den Wert mit (Auftrag 010: Strang über die Grenze). */
        var ausloeser = bus.aktuell && /^plugins\//.test(bus.aktuell.absender || "") ? bus.aktuell.absender.slice(8) : null, tp = String(p).split("/");
        if (ausloeser && ausloeser !== kennung && String(p).indexOf(bus.aktuell.objekt + "/") === 0) {
          merkeZugriff(ausloeser, p, "aendert");
          if (tp.length >= 3) merkeArt(zugriffe[ausloeser], "durch/" + kennung + "/" + tp[0] + "/" + tp[2], "aendert");
        }
        vermerke(kennung, p, w); spure(kennung, p, w); zustand.setze(p, w, kennung);
      },
      sende: function (n) { taten[kennung] = true; bus.sende(n, absender); Huelle.anstossen(); }
    });
  }

  /* ---------- Kein Warten, keine eigene Uhr, kein eigener Zufall ----------
     Geprüft am Quelltext dessen, was auf dem Bus läuft: beimStart, abonniert, prueft. Was nur
     zeichnet (ansicht, ergaenzt, vorschau), läuft außerhalb des Busses auf dem fertigen Zustand. */
  var VERBOTEN = [
    [/\bawait\b|\.then\s*\(|\bPromise\b/, "waits on the bus"],
    [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, "sets itself an alarm"],
    [/\bDate\b|performance\s*\.\s*now/, "uses its own clock instead of h.uhr()"],
    [/Math\s*\.\s*random|\bcrypto\b/, "uses its own randomness"],
    [/\bfetch\b|XMLHttpRequest|localStorage|sessionStorage|indexedDB/, "accesses the network or storage"]
  ];
  function vertragsbrueche(def) {
    var fn = [def.beimStart];
    ["abonniert", "prueft"].forEach(function (k) {
      Object.keys(def[k] || {}).forEach(function (m) { fn.push(def[k][m]); });
    });
    var out = [];
    fn.filter(function (f) { return typeof f === "function"; }).forEach(function (f) {
      var text = String(f);
      if (f.constructor && f.constructor.name === "AsyncFunction" && out.indexOf(VERBOTEN[0][1]) === -1) out.push(VERBOTEN[0][1]);
      VERBOTEN.forEach(function (v) { if (v[0].test(text) && out.indexOf(v[1]) === -1) out.push(v[1]); });
    });
    return out;
  }

  function sichtElement(kennung) { return document.querySelector('[data-sicht="' + kennung + '"]'); }

  function aushaengen(kennung) {
    var p = plugins[kennung];
    if (!p) return;
    bus.melde("huelle/sicht", "entfernt", { kennung: kennung });
    bus.entferneAbos(kennung);
    var el = sichtElement(kennung);
    if (el) el.remove();
    var st = document.querySelector('style[data-stil="' + kennung + '"]');
    if (st) st.remove();
    delete plugins[kennung];
    reihenfolge = reihenfolge.filter(function (k) { return k !== kennung; });
  }

  function einhaengen(def) {
    if (!def || !def.kennung) throw new Error("Plugin without an ID");
    var brueche = vertragsbrueche(def);
    if (brueche.length) {
      var satz = "“" + (def.titel || def.kennung) + "” " + brueche.join(", ") + "; it is not plugged in.";
      Huelle.meldeVertrag(satz, [def.kennung], "vertrag");
      throw new Error(satz);
    }
    aushaengen(def.kennung);
    einhaengungen++;
    if (def.platz) {
      vorrat[def.kennung] = def;
      reihenfolge.slice().forEach(function (k) {
        var d = plugins[k].def;
        if (d.platz && d.platz.kennung === def.platz.kennung) aushaengen(k);
      });
    }
    var eintrag = { def: def, kontext: kontextFuer(def.kennung), faellig: true };
    plugins[def.kennung] = eintrag;
    reihenfolge.push(def.kennung);
    reihenfolge.sort();

    Object.keys(def.abonniert || {}).forEach(function (muster) {
      bus.abonniere(muster, function (m) { gerufen[def.kennung] = true; merkeZugriff(def.kennung, m.objekt, "liest"); return def.abonniert[muster](m, eintrag.kontext); }, def.kennung);
    });

    if (def.stil) {
      var st = document.createElement("style");
      st.setAttribute("data-stil", def.kennung);
      st.textContent = def.stil;
      document.head.appendChild(st);
    }
    /* Wer eine fremde Ansicht ergänzt, sagt selbst, wann sie neu gezeichnet werden muss. */
    Object.keys(def.ergaenzt || {}).forEach(function (ziel) {
      (def.ergaenzt[ziel].neuBei || []).forEach(function (muster) {
        bus.abonniere(muster, function () { if (plugins[ziel]) plugins[ziel].faellig = true; }, def.kennung, { sicht: ziel });
      });
    });
    if (def.ansicht) {
      var ort = document.querySelector('[data-ort="' + (def.ansicht.ort || "haupt") + '"]');
      var el = document.createElement("section");
      el.className = "sicht";
      el.setAttribute("data-sicht", def.kennung);
      el.hidden = !Huelle.inOffenerTeilApp(def.kennung);
      el.style.order = def.ansicht.rang || 0;
      ort.appendChild(el);
      (def.ansicht.neuBei || []).forEach(function (muster) {
        bus.abonniere(muster, function () { eintrag.faellig = true; }, def.kennung, { sicht: def.kennung });
      });
    }
  }

  /* beob: wird nach jedem Plugin gerufen, das in dieser Ansicht gezeichnet hat (Anweisung 28d) */
  function zeichne(kennung, beob) {
    var p = plugins[kennung], el = sichtElement(kennung);
    p.faellig = false;
    if (!p.def.ansicht || !el) return;
    /* Was rollt, bleibt beim Neuzeichnen an seiner Stelle, außer ein Plugin rollt es selbst (Anweisung 67 a).
       Die alte Stellung kommt gleich nach dem Hauptbild zurück, noch bevor ergänzende Plugins zeichnen: So sehen sie die
       Stellung, die der Mensch sieht, und was sie dann hinrollen, bleibt stehen. */
    var rollstand = {};
    el.querySelectorAll("[data-rollen]").forEach(function (r) { rollstand[r.getAttribute("data-rollen")] = { el: r, o: r.scrollTop, l: r.scrollLeft }; });
    try { p.def.ansicht.zeichne(el, p.kontext); }
    catch (e) { Huelle.meldeFehler(kennung, e); }
    el.querySelectorAll("[data-rollen]").forEach(function (r) {
      var stand = rollstand[r.getAttribute("data-rollen")];
      if (!stand || stand.el === r) return; // dasselbe Element: Stellung ist noch da, oder das Plugin hat selbst gerollt
      if (r.scrollTop || r.scrollLeft) return; // neues Element, vom Plugin schon gerollt
      if (stand.o) r.scrollTop = stand.o;
      if (stand.l) r.scrollLeft = stand.l;
    });
    if (typeof beob === "function") beob(kennung);
    /* Kleine Plugins ergänzen eine fremde Ansicht, ohne sie neu zu liefern. */
    reihenfolge.forEach(function (k) {
      var z = (plugins[k].def.ergaenzt || {})[kennung];
      if (!z || Huelle.teilAppVon(k) !== Huelle.teilAppVon(kennung)) return;
      try { z.zeichne(el, lesend); }
      catch (e) { Huelle.meldeFehler(k, e); }
      if (typeof beob === "function") beob(k);
    });
    bus.melde("huelle/sicht", "gezeichnet", { kennung: kennung });
  }

  /* Ein neu eingehängtes Plugin richtet sich auf dem laufenden Stand ein; der Rest bleibt, wie er ist. */
  function starte(kennung) {
    var p = plugins[kennung];
    if (p.def.beimStart) {
      einrichten = true;
      try { p.def.beimStart(p.kontext); }
      catch (e) { Huelle.meldeFehler(kennung, e); }
      finally { einrichten = false; }
      zustand.nimmAenderungen();
    }
    reihenfolge.forEach(function (k) {
      if (k === kennung || p.def.beimStart || (p.def.ergaenzt && p.def.ergaenzt[k])) zeichne(k);
    });
  }

  /* ---------- Laden (klassische Skripte: geht auch per Doppelklick, ohne Server) ---------- */
  function ladeSkript(pfad) {
    return new Promise(function (ok, nein) {
      var s = document.createElement("script");
      s.src = pfad;
      s.onload = ok;
      s.onerror = function () { nein(new Error("File missing: " + pfad)); };
      document.head.appendChild(s);
    });
  }

  var Huelle = {
    bus: bus, zustand: zustand, uhr: uhr,
    tag: null,
    drehbuecher: [],
    fehler: [],
    bedienFehler: [],   // Anweisung 57: { satz, ki } je Bedienung des laufenden Szenarios, die mit der Maus nicht ging
    geladen: false,
    manifest: null,
    eingespielt: [],     // zur Laufzeit eingespielte Plugins: { name, quelle }
    aus: {},             // abgeschaltete Kennungen; sie hängen sich nicht ein, auch nicht über einen Wunsch
    grund: {},           // Grundausstattung: kennung → { titel, platz }
    inhalt: {},          // je eingespielter Datei: { plugins: [kennung], drehbuecher: [kennung] }
    widersprueche: [],
    regeln: {},          // kennung → Regel; eigene Objekte, kein Teil eines Plugins
    lesend: lesend,
    /* Was von Hand kommt, zeigt die Seite ohne Vorführung; der Player setzt hier seine Bühne ein. */
    handBuehne: {
      vorher: async function () {},
      schnappschuss: function () { return null; },
      nachher: async function () {}
    },

    /* Aufrufe der Daten-, Plugin- und Drehbuchdateien */
    /* Ein Projekt teilt seine Daten: Jede Teil-App bringt ihre Fachobjekte dazu (Auftrag 010). */
    /* Anweisung 53: dazu die Objektarten ihres Datenmodells, damit Play ihre Objekte so nennt, wie sie auf dem Bildschirm stehen. */
    daten: function (d) {
      if (!this.tag) { this.tag = d; return; }
      Object.assign(this.tag.objekte, d.objekte);
      if (d.arten) this.tag.arten = Object.assign({}, this.tag.arten, d.arten);
    },
    /* Anweisung 34: Grunddaten, die ein Wunsch geändert hat, je { pfad, wert }. Zählt beim Einspielen wie ein Plugin; wirkt ab dem nächsten neuen Tag. */
    grunddaten: function (liste) {
      var tag = this.tag;
      liste.forEach(function (e) {
        var t = e.pfad.split("/"), o = tag;
        for (var i = 0; o && i < t.length - 1; i++) o = o[t[i]];
        if (!o) throw new Error("Base data: path missing: " + e.pfad);
        o[t[t.length - 1]] = e.wert;
      });
      einhaengungen++;
    },
    /* Teil-Apps: Alle Plugins laufen auf einem Bus; sichtbar ist nur die offene Teil-App. */
    teilApp: (function () { var t = window.PLAY_TEILAPP || {}; return { offen: t.offen || null, heimat: t.heimat || null, plugins: t.plugins || {}, drehbuecher: t.drehbuecher || {}, daten: t.daten || [], titel: t.titel || null, untertitel: t.untertitel || null, leer: !!t.leer, namen: t.namen || {}, naehte: t.naehte || [], besitz: t.besitz || {}, mitPrototyp: t.mitPrototyp || [] }; })(),
    /* ---------- Hoheit je Teil-App (Anweisung 49 b, c) ----------
       Jedes Plugin gehört genau einer Teil-App. Es hört nur, solange seine Teil-App läuft (das gespielte Szenario, sonst die
       offene Teil-App), und nur auf Nachrichten dieser Teil-App, auf Uhr und Takt von Play und auf das, was eine andere
       Teil-App über eine Naht veröffentlicht (projekt.json: veroeffentlicht). */
    laeuft: null,
    teilAppVon: function (kennung) { var t = this.teilApp; return t.plugins[kennung] || t.heimat; },
    laufendeTeilApp: function () { return this.laeuft || this.teilApp.offen || this.teilApp.heimat; },
    /* Wem ein Fachobjekt gehört: die Teil-App, deren Fachobjekte seinen Pfad abdecken; sonst null */
    eignerVon: function (objekt) {
      var b = this.teilApp.besitz || {}, t = String(objekt).split("/");
      for (var i = t.length; i > 0; i--) { var k = t.slice(0, i).join("/"); if (b[k]) return b[k]; }
      return null;
    },
    /* Woher eine neue Nachricht kommt */
    herkunftTeilApp: function (n, absender, vater) {
      var a = String(absender || "");
      if (/^plugins\//.test(a)) return this.teilAppVon(a.slice(8));
      if (/^drehbuecher\//.test(a)) return this.teilAppVonSzenario(a.slice(12));
      if (/^hand\//.test(a)) return n.teilApp || this.laufendeTeilApp();
      if (/^huelle\/uhr/.test(a)) return n.objekt === "uhr/tag" ? null : this.eignerVon(n.objekt) || this.laufendeTeilApp();
      return vater ? vater.teilApp : null;
    },
    /* Veröffentlicht eine Teil-App diese Nachricht für die Teil-App ziel? Dann die Naht, sonst null. */
    naht: function (m, ziel) {
      var l = this.teilApp.naehte || [];
      for (var i = 0; i < l.length; i++) {
        var x = l[i];
        if (x.von === ziel || (x.fuer && x.fuer.indexOf(ziel) === -1)) continue;
        if ((x.muster || []).some(function (mu) { return passt(mu, m.objekt, m.aktion); })) return x;
      }
      return null;
    },
    hoertZu: function (kennung, m) {
      var t = this.teilAppVon(kennung);
      if (t !== this.laufendeTeilApp()) return false;
      if (!m.teilApp || m.teilApp === t) return true;
      return !/^hand\//.test(m.absender || "") && !!this.naht(m, t);
    },
    /* ---------- Blick der Hostapp (Anweisung 49 e) ----------
       Plugins, Szenarien, Zähler, Ketten und Maschinenraum zeigen die offene Teil-App; der Schalter „alle Bereiche“ zeigt alles.
       Der Schalter ist Bequemlichkeit des Betrachters und liegt im Browser. */
    alleBereiche: (function () { try { return localStorage.getItem("play/alle-bereiche") === "1"; } catch (e) { return false; } })(),
    mehrereTeilApps: function () { return (this.teilApp.mitPrototyp || []).length > 1; },
    blickTeilApp: function () { return this.teilApp.offen || this.teilApp.heimat; },
    imBlick: function (teilApp) { return this.alleBereiche || !this.blickTeilApp() || (teilApp || this.teilApp.heimat) === this.blickTeilApp(); },
    pluginImBlick: function (kennung) { return this.imBlick(this.teilAppVon(kennung)); },
    nachrichtImBlick: function (m) { return !m || !m.teilApp || this.imBlick(m.teilApp); },
    inOffenerTeilApp: function (kennung) { var t = this.teilApp; return (t.plugins[kennung] || t.heimat) === t.offen; },
    zeigeTeilApp: function (ta) {
      this.teilApp.offen = ta;
      var self = this;
      document.querySelectorAll("[data-sicht]").forEach(function (s) { s.hidden = !self.inOffenerTeilApp(s.getAttribute("data-sicht")); });
      this.markiereTeilApp();
    },
    /* Anweisung 48 (b): Der Rahmen gehört zur Teil-App. Plugins gestalten ihn mit `#nutzbereich[data-teilapp="…"]`. */
    markiereTeilApp: function () {
      var n = document.getElementById("nutzbereich");
      if (n) n.setAttribute("data-teilapp", this.teilApp.offen || this.teilApp.heimat || "");
    },
    teilAppVonSzenario: function (k) { return this.teilApp.drehbuecher[k] || this.teilApp.heimat; },
    drehbuecherOffen: function () {
      if (this.alleBereiche && !this.teilApp.leer) return this.drehbuecher;
      var self = this, l = this.drehbuecher.filter(function (d) { return self.teilAppVonSzenario(d.kennung) === self.teilApp.offen; });
      /* Anweisung 46: Eine leer geöffnete Teil-App hat noch keine Szenarien. */
      return l.length || this.teilApp.leer ? l : this.drehbuecher;
    },
    plugin: function (def) {
      if (ladeName) this.inhalt[ladeName].plugins.push(def.kennung);
      else this.grund[def.kennung] = { titel: def.titel, platz: def.platz || null };
      if (this.aus[def.kennung]) { einhaengungen++; return; }
      einhaengen(def);
      if (this.geladen) starte(def.kennung);
    },
    /* Eine Regel: { kennung, pfad (Geltungsbereich), satz, wortlaut, herkunft, art, pruefe(h) } */
    regel: function (r) {
      if (!r || !r.kennung || !r.pfad || !r.satz) throw new Error("A rule needs an ID, a path and a sentence");
      if (["bedingung", "ki", "nicht-zeigbar"].indexOf(r.art) === -1) throw new Error("Unknown kind of rule: " + r.art);
      if (r.art === "bedingung" && typeof r.pruefe !== "function") throw new Error("A condition needs pruefe()");
      this.regeln[r.kennung] = r;
    },
    /* Regeln, die über die Brücke kamen, im Wortlaut: Die unsichtbare Kopie bekommt sie mit. */
    regelQuellen: [],
    regelEinspielen: function (name, quelle) {
      new Function(quelle)();
      this.regelQuellen = this.regelQuellen.filter(function (r) { return r.name !== name; });
      this.regelQuellen.push({ name: name, quelle: quelle });
    },
    /* Über die Brücke kommen alle Dateien aus regeln/, auch Regeln aus Wünschen. Ohne Brücke gilt
       die Liste im Manifest. Die unsichtbare Kopie hinter der Brücke bekommt sie per Nachricht. */
    ladeRegeln: async function (still) {
      var self = this;
      if (location.protocol === "http:") {
        if (still) return;
        try {
          var r = await fetch("/regeln");
          if (!r.ok) throw new Error("Response " + r.status);
          (await r.json()).forEach(function (d) {
            try { self.regelEinspielen(d.name, d.quelle); }
            catch (e) { self.meldeFehler(d.name, e); }
          });
          return;
        } catch (e) { /* ältere Brücke ohne /regeln: Liste im Manifest */ }
      }
      var liste = this.manifest.regeln || [];
      for (var i = 0; i < liste.length; i++) await ladeSkript(liste[i]);
    },
    /* Eine Erwartung, die eine bewusste Änderung ersetzt: { drehbuch, nr, satz, alt, neu }.
       nr ist die Stelle in erwartet. Die Datei des Drehbuchs bleibt, wie sie ist. */
    erwartungen: [],
    erwartung: function (e) {
      if (!e || !e.drehbuch || typeof e.nr !== "number" || !e.neu) throw new Error("An expectation needs a scenario, a step and a new expectation");
      einhaengungen++;
      this.erwartungen.push(Object.assign({ datei: ladeName }, e));
    },
    /* Die Erwartungen eines Drehbuchs, wie sie gerade gelten */
    erwartungenVon: function (d) {
      var liste = (d.erwartet || []).slice();
      this.erwartungen.forEach(function (e) {
        if (e.drehbuch === d.kennung && e.nr < liste.length) liste[e.nr] = e.neu;
      });
      return liste;
    },
    drehbuch: function (d) {
      if (ladeName) this.inhalt[ladeName].drehbuecher.push(d.kennung);
      einhaengungen++;
      this.drehbuecher = this.drehbuecher.filter(function (x) { return x.kennung !== d.kennung; });
      this.drehbuecher.push(d);
    },

    meldeFehler: function (wer, e) {
      this.fehler.push({ wer: wer, text: e && e.message ? e.message : String(e) });
      if (global.console) console.error("Plugin " + wer + ":", e);
    },

    /* Bus-Vertrag: Meldungen in einem Satz (Besitzer, Schleife, Absturz, Warten, Uhr, Zufall).
       wer: Kennungen der beteiligten Plugins. Sie zählen wie ein Ausfall, damit ein Probelauf sie
       der KI zurückgibt; die Seite zeigt sie unter den Meldungen. */
    vertrag: [],
    hoerer: [],
    meldeVertrag: function (satz, wer, art) {
      var f = { wer: (wer || []).join(", ") || "bus", text: satz, satz: satz, vertrag: art || "vertrag", plugins: wer || [] };
      if (this.vertrag.some(function (x) { return x.satz === satz; })) return;
      this.vertrag.push(f);
      /* Ein abgewiesener fremder Schreiber ist kein Ausfall (es bleibt beim Besitzer), sondern ein
         Widerspruch an beiden Plugins. Alles andere (Schleife, Absturz, Warten) fällt aus. */
      if (f.vertrag !== "besitzer") this.fehler.push(f);
      if (global.console) console.warn("Bus-Vertrag: " + satz);
      this.hoerer.forEach(function (h) { try { h(f); } catch (e) { /* Anzeige darf den Bus nicht stören */ } });
    },
    /* Wie ein Ereignis in einem Satz heißt: seine Erzählung, sonst Objekt und Aktion */
    ereignisName: function (m) {
      if (!m) return "An event";
      return "“" + (m.erzaehlung || (m.objekt + " " + m.aktion)) + "”";
    },

    zeichneFaellige: function () {
      reihenfolge.forEach(function (k) { if (plugins[k].faellig) zeichne(k); });
    },

    /* Antwort der Prüfungen auf eine Nachricht: null oder { grund, erzaehlung }.
       Eine Prüfung gibt null, einen Satz oder { grund, erzaehlung } zurück. */
    urteil: function (n) {
      /* Ein Statuswechsel, den das Datenmodell nicht erlaubt, erreicht niemanden. */
      if (n.aktion === STATUS && n.objekt.split("/").length === 2 && statusArt(n.objekt.split("/")[0])) {
        var s = statusNein(n.objekt, n.parameter && n.parameter.status);
        if (s) return { grund: s, erzaehlung: "Status not changed: " + s };
      }
      for (var i = 0; i < reihenfolge.length; i++) {
        var k = reihenfolge[i], regeln = plugins[k].def.prueft || {}, muster = Object.keys(regeln);
        if (!this.hoertZu(k, n)) continue;
        for (var j = 0; j < muster.length; j++) {
          if (!passt(muster[j], n.objekt, n.aktion)) continue;
          var nein = null;
          gerufen[k] = true;
          verfolge = !!n.nr;
          try { nein = regeln[muster[j]](n, verfolgend); }
          catch (e) { this.meldeFehler(k, e); bus.scheitert(k, e && e.message ? e.message : String(e)); }
          finally { verfolge = false; }
          if (nein) { taten[k] = true; return typeof nein === "string" ? { grund: nein } : nein; }
        }
      }
      return null;
    },

    /* Solange ein Drehbuch läuft, gehört ihm die Seite. */
    gesperrt: function () { return ablaeufe > 0; },

    /* Liegt außerhalb eines Ablaufs etwas in der Warteschlange, wird es jetzt abgearbeitet. */
    anstossen: function () {
      if (bus.arbeitet || ablaeufe > 0 || !bus.warteschlange.length) return;
      bus.abarbeiten(this.handBuehne).catch(function (e) { Huelle.meldeFehler("bus", e); });
    },

    /* Eine Handlung von Hand: dieselbe Nachricht wie im Drehbuch, nur der Absender ist ein anderer. */
    handeln: function (n, absender) {
      bus.sendeNeu(n, absender);
      this.anstossen();
    },

    /* Was eine Ansicht anbietet, auch von anderen Plugins (b.sicht): { liste, h } */
    bedienungen: function (kennung) {
      var liste = [], von = [];
      var self = this;
      reihenfolge.forEach(function (k) {
        /* Anweisung 49 (b): Eine Bedienung bleibt in der Teil-App, in der sie geschieht. */
        if (self.teilAppVon(k) !== self.teilAppVon(kennung)) return;
        (plugins[k].def.bedienungen || []).forEach(function (b) {
          if ((b.sicht || k) === kennung) { liste.push(b); von.push(k); }
        });
      });
      return { liste: liste, von: von, h: lesend };
    },

    /* Anweisung 57: Fingerabdruck jeder Mausbedienung (Ziehen, Klicken, Doppelklicken) je Plugin, um zu sehen, welche ein Wunsch
       neu bringt oder ändert. Schlüssel "plugin|bedienung", Wert { abdruck, titel }. */
    bedienungsAbdruecke: function (nur) {
      var out = {};
      reihenfolge.forEach(function (k) {
        if (nur && nur.indexOf(k) === -1) return;
        (plugins[k].def.bedienungen || []).forEach(function (b, i) {
          if ((b.art || "ziehen") === "eingeben") return;
          var teile = Object.keys(b).sort().map(function (f) { return f + "=" + String(b[f]); });
          out[k + "|" + (b.kennung || b.titel || i)] ={ abdruck: teile.join("\n"), titel: b.titel || b.kennung || k, art: b.art || "ziehen" };
        });
      });
      return out;
    },

    /* Die eingehängten Plugins in fester Reihenfolge */
    aktive: function () { return reihenfolge.slice(); },

    /* Worte des Fachs für eine Bedienung (def.bedienungSatz eines Plugins, z. B. Fachsprache): Satzanfang oder null */
    bedienungSatz: function (z) {
      for (var i = 0; i < reihenfolge.length; i++) {
        var f = plugins[reihenfolge[i]].def.bedienungSatz;
        if (typeof f !== "function") continue;
        try { var t = f(z, lesend); if (t) return t; }
        catch (e) { this.meldeFehler(reihenfolge[i], e); }
      }
      return null;
    },

    zeichneNeu: function (kennung) { if (plugins[kennung]) zeichne(kennung); },
    /* Anweisung 28d: Wer zeichnet was? Einmal am Ende eines Szenarios, und nur wenn dort die Anzeige abweicht: { Ansicht: { Pfad: [Plugins] } }.
       Jede Ansicht wird dafür einmal neu gezeichnet, und nach jedem Plugin wird geschaut, was sich an ihr geändert hat. */
    zeichner: function () {
      var out = {};
      reihenfolge.forEach(function (k) {
        var el = sichtElement(k);
        if (!plugins[k].def.ansicht || !el || el.hidden) return;
        var je = out[k] = {}, vorher = {};
        zeichne(k, function (wer) {
          var jetzt = {};
          el.querySelectorAll("[data-pfad]").forEach(function (e) { var p = e.getAttribute("data-pfad"); jetzt[p] = (jetzt[p] || 0) + 1; });
          Object.keys(Object.assign({}, vorher, jetzt)).forEach(function (p) { if (vorher[p] !== jetzt[p]) (je[p] = je[p] || []).push(wer); });
          vorher = jetzt;
        });
      });
      return out;
    },

    /* Stellt den gemockten Tag her; Plugins richten sich ein, ohne dass das als Ereignis zählt. */
    neuerTag: function (startzeit) {
      bus.leeren();
      this.fehler = [];
      this.vertrag = [];
      this.widersprueche = [];
      implizit = {};
      pruefeBesitz();
      zustand.laden(this.tag.objekte);
      uhr.zeit = startzeit;
      this.startzeit = startzeit;
      statusZuBeginn(startzeit);
      wirkung = {};
      this.fristOhneRegel = [];
      einrichten = true;
      reihenfolge.forEach(function (k) {
        var p = plugins[k];
        if (!p.def.beimStart) return;
        try { p.def.beimStart(p.kontext); }
        catch (e) { Huelle.meldeFehler(k, e); }
      });
      einrichten = false;
      zustand.nimmAenderungen();
      spur = {};
      taten = {};
      felder = {};
      gerufen = {};
      zugriffe = {};
      this.anfang = kopie(zustand.wurzel);
      reihenfolge.forEach(zeichne);
      bus.melde("huelle/tag", "neu", {});
    },

    /* Welche Variante auf welchem Platz aktiv ist: { platz: kennung } */
    stand: function () {
      var s = {};
      reihenfolge.slice().sort().forEach(function (k) {
        var d = plugins[k].def;
        if (d.platz) s[d.platz.kennung] = k;
      });
      return s;
    },

    /* Für den Umschalter: alle Plätze mit ihren Varianten */
    plaetze: function () {
      var aktiv = this.stand(), out = {};
      function nimm(platz, titel, kennung, variante) {
        var p = out[platz] || (out[platz] = { kennung: platz, titel: null, varianten: [] });
        if (titel) p.titel = titel;
        if (!p.varianten.some(function (v) { return v.kennung === kennung; })) {
          p.varianten.push({ kennung: kennung, titel: variante, aktiv: aktiv[platz] === kennung });
        }
      }
      Object.keys(vorrat).forEach(function (k) {
        var pl = vorrat[k].platz;
        nimm(pl.kennung, pl.titel, k, pl.variante);
      });
      (this.manifest.bereit || []).forEach(function (b) { nimm(b.platz, null, b.kennung, b.variante); });
      return Object.keys(out).map(function (k) { return out[k]; });
    },

    /* Schaltet eine Variante ein; beim ersten Mal wird ihre Datei nachgeladen. */
    wechsle: async function (kennung) {
      if (vorrat[kennung]) return this.plugin(vorrat[kennung]);
      var b = (this.manifest.bereit || []).filter(function (x) { return x.kennung === kennung; })[0];
      if (!b) throw new Error("This variant does not exist");
      await ladeSkript(b.datei + "?stand=" + Date.now());
    },

    /* Spielt ein Plugin aus Quelltext ein. Gleiche Kennung ersetzt, neue kommt dazu. */
    einspielen: function (name, quelle) {
      var vorher = einhaengungen;
      this.inhalt[name] = { plugins: [], drehbuecher: [] };
      this.erwartungen = this.erwartungen.filter(function (e) { return e.datei !== name; });
      ladeName = name;
      try { new Function(quelle)(); }
      finally { ladeName = null; }
      if (einhaengungen === vorher) throw new Error("The file contains no plugin and no scenario");
      this.eingespielt = this.eingespielt.filter(function (e) { return e.name !== name; });
      this.eingespielt.push({ name: name, quelle: quelle });
    },

    /* Schaltet Plugins ab, die schon hängen: für Läufe in der unsichtbaren Kopie. */
    schalteAus: function (kennungen) {
      kennungen.forEach(function (k) { Huelle.aus[k] = true; aushaengen(k); });
    },

    /* Überschrift eines Plugins für Sätze in der Seite */
    titelVon: function (kennung) { return plugins[kennung] ? plugins[kennung].def.titel : kennung; },

    /* Welches Plugin hat die Werte dieser Objekte seit Tagesbeginn gesetzt? Genau eins oder null.
       - Kam die Nachricht von einem Plugin, zählt dieses: Es hat entschieden, ein anderes
         hat nur ausgeführt (Umverteilen schickt „zuweisen“, Einsatz ändern setzt).
       - Kam sie von Hand oder aus einem Drehbuch und betrifft das Objekt der Nachricht selbst,
         war es die Hand bzw. das Drehbuch, kein Plugin.
       - Setzt ein Plugin auf ein solches Ereignis hin Werte an anderen Objekten, zählt das Plugin. */
    verursacher: function (objekte) {
      var wer = {};
      Object.keys(spur).forEach(function (pfad) {
        if (!objekte.some(function (o) { return pfad.indexOf(o + "/") === 0; })) return;
        var s = spur[pfad];
        var vonPlugin = s.absender && s.absender.indexOf("plugins/") === 0;
        var von = vonPlugin || s.eigenesObjekt ? s.absender : "plugins/" + s.kennung;
        wer[von || "?"] = true;
      });
      var liste = Object.keys(wer);
      if (liste.length !== 1 || liste[0].indexOf("plugins/") !== 0) return null;
      return liste[0].slice("plugins/".length);
    },

    /* Plugins, die seit Tagesbeginn etwas getan haben (Wert geändert, gesendet, verweigert) */
    taeter: function () { return Object.keys(taten).sort(); },

    /* Anweisung 23: je geladenes Plugin ein Abdruck seines Inhalts, und ob es etwas anzeigt.
       Wer anzeigt oder nur zeichnet, wirkt in jedem Szenario. */
    pluginAbdruecke: function () {
      var out = {};
      reihenfolge.forEach(function (k) {
        var d = plugins[k].def;
        var text = JSON.stringify(d, function (s, v) { return typeof v === "function" ? String(v) : v; });
        var h = 5381;
        for (var i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
        out[k] = {
          abdruck: text.length + ":" + h,
          /* Anweisung 55 (c): Wer beim Start etwas tut (z. B. neue Flüge anlegt), wird beim Abspielen immer geladen. */
          beimStart: !!d.beimStart,
          ueberall: !!(d.ansicht || d.ergaenzt || d.beschreibe) || !(Object.keys(d.abonniert || {}).length || Object.keys(d.prueft || {}).length)
        };
      });
      return out;
    },

    /* Anweisung 22: Plugins, die in diesem Szenario auf eine Bedienung antworten. Ein Szenario spielt die Nachricht
       ab, ohne die Maus: Gerufen wird das Plugin dann nicht. Erkannt wird es daran, dass seine Bedienung genau die
       Aktion auslöst, die im Szenario vorkommt (am Code der Bedienung, nie an Text eines Modells). */
    bedient: function () {
      var gesendet = {};
      bus.protokoll.forEach(function (m) { if (/^(hand|drehbuecher)\//.test(m.absender || "")) gesendet[m.aktion] = true; });
      return reihenfolge.filter(function (k) {
        return (plugins[k].def.bedienungen || []).some(function (b) {
          var quelle = String(b.ereignis), treffer = quelle.match(/aktion\s*:\s*["'][^"']+/g) || [];
          return treffer.some(function (t) { return gesendet[t.replace(/^aktion\s*:\s*["']/, "")]; });
        });
      }).sort();
    },
    /* Felder, die seit Tagesbeginn geändert wurden, je Bereich (Sternchen statt Kennung) */
    felder: function () { return Object.keys(felder).sort(); },
    /* Plugins, deren Abonnent oder Prüfung seit Tagesbeginn gerufen wurde */
    gerufen: function () { return Object.keys(gerufen).sort(); },
    zugriffe: function () { return JSON.parse(JSON.stringify(zugriffe)); },
    /* Reagiert ein Plugin auf Nachrichten (Abonnent oder Prüfung)? Reine Anzeige und Bedienung nicht. */
    reagiert: function (kennung) {
      var d = plugins[kennung] && plugins[kennung].def;
      return !!d && (Object.keys(d.abonniert || {}).length > 0 || Object.keys(d.prueft || {}).length > 0);
    },
    /* Anweisung 45 (b): Worauf ein Plugin hört (Pfade seiner Abonnements) und ob es überhaupt etwas ändern kann. Ändern kann
       es nur über Abonnements, beim Start oder beim Zeichnen der eigenen Ansicht; alles andere bekommt nur Lesezugriff. */
    hoertAuf: function (kennung) {
      var d = plugins[kennung] && plugins[kennung].def;
      return d ? Object.keys(d.abonniert || {}) : [];
    },
    kannAendern: function (kennung) {
      var d = plugins[kennung] && plugins[kennung].def;
      return !!d && (Object.keys(d.abonniert || {}).length > 0 || !!d.beimStart || !!d.ansicht);
    },

    /* Alle Bedienungen aller Plugins, gleich an welcher Ansicht */
    alleBedienungen: function () {
      var liste = [];
      reihenfolge.forEach(function (k) { liste = liste.concat(plugins[k].def.bedienungen || []); });
      return liste;
    },

    /* Eine Nachricht in Worten des Fachs (def.erzaehle der Plugins, Muster wie bei abonniert) oder null */
    erzaehle: function (m) {
      for (var i = 0; i < reihenfolge.length; i++) {
        var k = reihenfolge[i], e = plugins[k].def.erzaehle || {}, muster = Object.keys(e);
        for (var j = 0; j < muster.length; j++) {
          if (!passt(muster[j], m.objekt, m.aktion)) continue;
          try { var t = e[muster[j]](m, lesend); if (t) return t; }
          catch (x) { this.meldeFehler(k, x); }
        }
      }
      return null;
    },

    /* Mehrere geänderte Felder eines Objekts als ein Satz (def.beschreibeObjekt der Plugins):
       o = { pfad, felder: { feld: { alt, neu } } }; null, wenn kein Plugin Worte dafür hat */
    beschreibeObjekt: function (o) {
      for (var i = 0; i < reihenfolge.length; i++) {
        var k = reihenfolge[i], b = plugins[k].def.beschreibeObjekt || {}, muster = Object.keys(b);
        for (var j = 0; j < muster.length; j++) {
          if (!passt(muster[j] + ".x", o.pfad, "x")) continue;
          try { var t = b[muster[j]](o, lesend); if (t) return t; }
          catch (x) { this.meldeFehler(k, x); }
        }
      }
      return null;
    },

    /* Abweichungs-Sätze der aktiven Plugins: [{ muster, tue, kontext }] */
    beschreibungen: function () {
      var out = [];
      reihenfolge.forEach(function (k) {
        var p = plugins[k], b = p.def.beschreibe || {};
        Object.keys(b).forEach(function (muster) { out.push({ muster: muster, tue: b[muster], kontext: p.kontext }); });
      });
      /* Zuletzt die Worte des Datenmodells für den Status: „XA 745 ist jetzt Am Block statt Erwartet“ */
      Object.keys(arten()).sort().forEach(function (b) {
        if (!statusArt(b)) return;
        out.push({ muster: b + "/*/" + STATUS, kontext: lesend, tue: function (u) {
          var t = u.pfad.split("/");
          return nennung(t[0] + "/" + t[1]) + " is now " + statusName(b, u.neu) +
            (u.alt === undefined || u.alt === null ? "" : " instead of " + statusName(b, u.alt));
        } });
      });
      return out;
    },
    /* Kann dieses Plugin am Plan etwas ändern? Mechanisch: Es bietet eine Bedienung an, oder sein
       Code setzt oder sendet etwas. Nur zeichnen, ergänzen, Stil: nein. Nicht geladen: unbekannt (true). */
    kannPlanAendern: function (kennung) {
      var p = plugins[kennung];
      if (!p) return true;
      var d = p.def;
      if ((d.bedienungen || []).length) return true;
      var code = [d.beimStart].concat(Object.keys(d.abonniert || {}).map(function (k) { return d.abonniert[k]; }))
        .filter(function (x) { return typeof x === "function"; }).map(String).join(" ");
      return /\.(setze|sende)\s*\(/.test(code);
    },

    /* Muster von Werten im Zustand, die nur der Anzeige dienen (def.anzeige der aktiven Plugins) */
    nurAnzeige: function () {
      var out = [];
      reihenfolge.forEach(function (k) { out = out.concat(plugins[k].def.anzeige || []); });
      return out;
    },
    passtPfad: function (muster, pfad) { return passt(muster + ".x", pfad, "x"); },

    /* Ein Drehbuch ablaufen lassen. Sichtbar und still nehmen denselben Weg;
       mittel = { buehne, warte(ms), stelle(hhmm), minute, nachEreignis(e)? } */
    ablauf: async function (d, mittel) {
      var von = uhr.minuten(d.von), bis = uhr.minuten(d.bis), vorher = this.laeuft;
      ablaeufe++;
      /* Anweisung 49 (b): Während eines Szenarios arbeiten nur die Plugins seiner Teil-App. */
      this.laeuft = this.teilAppVonSzenario(d.kennung);
      /* Anweisung 57: Bedienungen des Szenarios, die mit der Maus nicht gingen */
      this.bedienFehler = [];
      try {
        for (var t = von; t <= bis; t++) {
          var jetzt = uhr.text(t);
          mittel.stelle(jetzt);
          /* Zu Tagesbeginn steht der Status schon nach der Uhrzeit; danach gibt die Uhr jede Minute ihren Takt. */
          if (t > von) await this.takt(jetzt, mittel.buehne);
          var faellig = d.ereignisse.filter(function (e) { return e.zeit === jetzt; });
          for (var i = 0; i < faellig.length; i++) {
            /* Anweisung 57: Ein Schritt mit „bedienung“ wird mit der Maus auf der Seite ausgeführt wie von Hand, nicht als Nachricht eingespeist. */
            if (faellig[i].bedienung) await this.bedienung.spiele(faellig[i], mittel);
            else bus.sendeNeu(faellig[i], "drehbuecher/" + d.kennung);
            await bus.abarbeiten(mittel.buehne);
            /* Nach jedem Ereignis, wenn seine Kette durch ist (z. B. Anhalten, wo ein Verstoß entsteht) */
            if (mittel.nachEreignis) await mittel.nachEreignis(faellig[i]);
          }
          if (t < bis) await mittel.warte(mittel.minute);
        }
      } finally {
        ablaeufe--;
        this.laeuft = vorher;
      }
    },

    /* Der Takt der Uhr für eine Minute (Auftrag 005, Stufe 2), in dieser Reihenfolge:
       1. „Es ist hh:mm“ (uhr/tag.minute), nur wenn ein Plugin darauf hört; sonst wäre jede Minute Rauschen.
       2. Die Meldungen des gemockten Tags zu dieser Minute (z. B. Onblock), stumm vorgeführt.
       3. Die Fristen: Steht ein Objekt zur Zeit in seinem Fristfeld noch im Status der Frist, geht deren
          Ereignis hinaus, auch wenn niemand darauf hört; dann ist es ein Fall ohne Regel.
       Jedes ist ein eigenes Ursprungsereignis vom Absender huelle/uhr. */
    takt: async function (hhmm, buehne) {
      /* Jedes Ereignis der Uhr wird ganz abgearbeitet, bevor das nächste hinausgeht (Bus-Vertrag 1):
         Sonst kämen die Folgen von „Es ist hh:mm“ erst nach einer Meldung dran und zählten zu deren Kette. */
      async function einzeln(n) {
        bus.sendeNeu(n, "huelle/uhr");
        await bus.abarbeiten(buehne);
      }
      var liste = [], self = this;
      if (hoertJemand("uhr/tag", "minute")) {
        await einzeln({ objekt: "uhr/tag", aktion: "minute", parameter: { zeit: hhmm }, stumm: true });
      }
      if (this.tag && typeof this.tag.meldungen === "function") {
        try { liste = this.tag.meldungen(hhmm, lesend) || []; } catch (e) { this.meldeFehler("daten", e); }
      }
      for (var i = 0; i < liste.length; i++) await einzeln(Object.assign({}, liste[i], { stumm: true }));
      var fristen = fristenFaellig(hhmm);
      for (var j = 0; j < fristen.length; j++) {
        var x = fristen[j];
        if (!hoertJemand(x.objekt, x.aktion)) self.fristOhneRegel.push({ zeit: hhmm, objekt: x.objekt, aktion: x.aktion, satz: x.erzaehlung });
        await einzeln(x);
      }
    },
    /* Fristen, die heute abgelaufen sind, ohne dass ein Plugin darauf hört: [{ zeit, objekt, aktion, satz }] */
    fristOhneRegel: [],

    /* Fälle ohne Regel (Stufe 2), gruppiert nach Objektart: [{ art, name, faelle: [{ schluessel, satz, zuletzt? }] }].
       blind: aus den Szenarien gemessen (Huelle.statusBlind() je Szenario), [schluessel "<bereich>/*.<aktion>|<bereich>"].
       - Fristen, auf die kein Plugin hört („Ein Flug ist zur geplanten Onblock-Zeit noch nicht am Block“)
       - Ereignisse einer Art, auf die kein Plugin hört und die keinen Status setzen
       - Ereignisse, deren Kette Objekte mit Status ändert, ohne je deren Status anzuschauen: je Status
         außer dem gewöhnlichen ein Fall („Krankmeldung trifft einen Auftrag, der schon Begonnen ist“) */
    faelleOhneRegel: function (blind) {
      var self = this, gruppen = {}, reihe = [];
      function gruppe(b) {
        if (!gruppen[b]) { gruppen[b] = { art: b, name: (arten()[b] || {}).name || b, faelle: [] }; reihe.push(b); }
        return gruppen[b];
      }
      Object.keys(arten()).sort().forEach(function (b) {
        var a = arten()[b];
        (a.fristen || []).forEach(function (f) {
          if (hoertJemand(b + "/x", f.aktion)) return;
          var zuletzt = self.fristOhneRegel.filter(function (x) { return x.aktion === f.aktion && x.objekt.indexOf(b + "/") === 0; }).pop();
          gruppe(b).faelle.push({ schluessel: "frist|" + b + "|" + f.aktion, satz: f.fall + ": no rule.", wunsch: f.fall + ": ",
            zuletzt: zuletzt ? zuletzt.satz : null });
        });
        Object.keys(a.ereignisse || {}).sort().forEach(function (akt) {
          if (hoertJemand(b + "/x", akt) || (a.status && a.status.durch && a.status.durch[akt])) return;
          var name = a.ereignisse[akt];
          gruppe(b).faelle.push({ schluessel: "ereignis|" + b + "|" + akt, satz: name + " " + (a.bei || "") + ": no rule.",
            wunsch: name + " " + (a.bei || "") + ": " });
        });
      });
      (blind || []).slice().sort().forEach(function (k) {
        var teile = k.split("|"), muster = teile[0], ziel = teile[1];
        var b = muster.split("/")[0], akt = muster.slice(muster.lastIndexOf(".") + 1), a = arten()[b], z = statusArt(ziel);
        var name = a && a.ereignisse && a.ereignisse[akt];
        if (!name || !z) return;
        Object.keys(z.status.werte).slice(1).forEach(function (s) {
          var satz = name + " meets " + (z.einen || z.name) + " that is already " + z.status.werte[s] + "";
          gruppe(ziel).faelle.push({ schluessel: "status|" + muster + "|" + ziel + "|" + s, satz: satz + ": no rule.", wunsch: satz + ": " });
        });
      });
      return reihe.map(function (b) { return gruppen[b]; });
    },
    /* Ketten dieses Tags, die Objekte mit Status geändert haben, ohne deren Status anzuschauen:
       Schlüssel "<bereich>/*.<aktion>|<geänderter Bereich>". Schaut eine Kette desselben Ereignisses den
       Status an, gilt das Ereignis für diesen Bereich als bedacht. */
    statusBlind: function (mitBedacht) {
      var blind = {}, bedacht = {};
      Object.keys(wirkung).forEach(function (nr) {
        var m = bus.protokoll[nr - 1], w = wirkung[nr];
        if (!m || m.zurueckgenommen || m.objekt === "uhr/tag") return;
        var muster = m.objekt.split("/")[0] + "/*." + m.aktion;
        Object.keys(w.aendert).forEach(function (b) {
          var k = muster + "|" + b;
          if (w.liest[b]) bedacht[k] = true; else blind[k] = true;
        });
      });
      if (mitBedacht) return Object.keys(bedacht).sort();
      return Object.keys(blind).filter(function (k) { return !bedacht[k]; }).sort();
    },

    lade: async function (manifest) {
      this.manifest = manifest;
      var still = new URLSearchParams(location.search).has("nachspielen");
      /* Vor den Plugins: Was abgeschaltet ist, soll gar nicht erst hängen. */
      if (!still) await Huelle.verwaltung.ladeStand();
      this.markiereTeilApp();
      /* Ein Projekt kann eigenes Aussehen mitbringen (Netz-Navigator); die Dispo hat keins. */
      (manifest.stil || []).forEach(function (datei) {
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = datei;
        document.head.appendChild(l);
      });
      var liste = [].concat(manifest.daten, this.teilApp.daten, manifest.plugins, manifest.drehbuecher);
      if (still) liste = liste.concat((manifest.bereit || []).map(function (b) { return b.datei; }));
      for (var i = 0; i < liste.length; i++) await ladeSkript(liste[i]);
      await this.ladeRegeln(still);
      if (!this.tag) throw new Error("No data was loaded");
      if (!this.drehbuecher.length) throw new Error("No scenario was loaded");
      if (still) {
        this.geladen = true;
        /* Anweisung 57: Auch der Probelauf bedient mit der Maus; dafür hört die Hülle in der Kopie auf Zeiger und Klicks. */
        Huelle.bedienung.start(true);
        Huelle.nachspiel.dienen();
      } else {
        /* Der Tag steht erst nach start(); gespeicherte Wünsche hängen sich davor ein. */
        await Huelle.wunsch.ladeGespeicherte();
        await Huelle.soll.lade();
        this.geladen = true;
        Huelle.player.start();
        Huelle.soll.start();
        Huelle.wunsch.start();
        Huelle.bedienung.start();
        Huelle.aufzeichnung.start();
        Huelle.leiste.start();
        Huelle.kette.start();
        Huelle.waechter.start();
        Huelle.luecken.start();
        Huelle.abgleich.start();
        Huelle.verwaltung.pruefe({ start: true });
      }
    }
  };

  global.Huelle = Huelle;
})(typeof window !== "undefined" ? window : globalThis);
