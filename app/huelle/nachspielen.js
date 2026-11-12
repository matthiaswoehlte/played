/* Feste Hülle, Teil 4: Nachspielen.
   Läuft in einer unsichtbaren zweiten Kopie der Seite, damit der sichtbare Ablauf
   nicht gestört wird. Dieselben Dateien, derselbe Rechenweg, nur die Bühne ist still.
   Die beiden Seiten reden über postMessage; das geht auch per Doppelklick ohne Server. */
(function () {
  "use strict";
  var H = window.Huelle;
  /* je Kopie, ab dem Moment, in dem sie ihren Platz hat; im vollen Prüflauf (PLAY_KERNE gesetzt) teilen sich
     mehrere Prüfungen den Rechner, eine Kopie braucht dort länger */
  var ZEITLIMIT = window.PLAY_KERNE ? 120000 : 30000;

  /* Gleichzeitig (Nachtrag des PO zu 005, 07.11.2026): Jedes Drehbuch läuft in seiner eigenen
     unsichtbaren Kopie, die Kopien berühren sich nicht. Darum laufen getrennte Drehbücher in
     getrennten Kopien gleichzeitig, so viele, wie der Rechner Kerne hat; die übrigen warten.
     Innerhalb eines Drehbuchs bleibt alles nacheinander. Damit der Browser jeder Kopie einen eigenen
     Prozess gibt, hat jeder Platz eine eigene Adresse (kopie-3.localhost); sonst rechneten alle
     Kopien im selben Strang nacheinander, nur abwechselnd. Per Doppelklick ohne Brücke gibt es
     keine eigenen Adressen, dann läuft eine Kopie nach der anderen. */
  var GETRENNT = location.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  var KERNE = GETRENNT ? Math.max(1, Math.min(32, window.PLAY_KERNE || navigator.hardwareConcurrency || 4)) : 1;   // PLAY_KERNE: nur im vollen Prüflauf
  var MINDESTENS_JE_KOPIE = 3;
  var ADRESSE_FRIST = 8000;   // so lange darf eine Kopie unter eigener Adresse brauchen, bis sie sich meldet
  var freiePlaetze = [], wartend = [], offeneLaeufe = 0, self_ersparnis = null;
  /* Anweisung 67 (b): das Ergebnis des letzten Laufs ohne das Neue, mit seinem Schlüssel */
  var gemerkt = null;
  for (var p = 1; p <= KERNE; p++) freiePlaetze.push(p);

  function platz() {
    return new Promise(function (ok) {
      if (freiePlaetze.length) ok(freiePlaetze.shift());
      else wartend.push(ok);
    });
  }
  function gibFrei(nr) {
    if (wartend.length) wartend.shift()(nr);
    else freiePlaetze.push(nr);
  }
  function adresse(nr) {
    if (!GETRENNT) return "index.html?nachspielen=1";
    return "http://kopie-" + nr + ".localhost:" + location.port + "/index.html?nachspielen=1";
  }

  /* Drehbücher in zusammenhängende Teile, in der Reihenfolge der Auswahl */
  function teileVon(liste, anzahl) {
    var n = Math.max(1, Math.min(anzahl, liste.length)), out = [], von = 0;
    for (var i = 0; i < n; i++) {
      var groesse = Math.floor(liste.length / n) + (i < liste.length % n ? 1 : 0);
      out.push(liste.slice(von, von + groesse));
      von += groesse;
    }
    return out;
  }

  /* Ergebnisse der Teile, nach Drehbuch sortiert, nicht nach dem Fertigwerden */
  function zusammen(ergebnisse) {
    var out = { abweichungen: [], ausfaelle: [], gruende: [], drehbuecher: [], widersprueche: [], bedienungenNeu: [], bedienungenGespielt: [], bedienHinweise: [] };
    ergebnisse.forEach(function (r) {
      Object.keys(out).forEach(function (k) {
        (r[k] || []).forEach(function (x) {
          /* Ein Ausfall der Kopie selbst steht in jedem Teil gleich; einmal reicht. */
          if (typeof x === "string" && out[k].indexOf(x) !== -1) return;
          out[k].push(x);
        });
      });
    });
    out.abbruch = ergebnisse.some(function (r) { return r.abbruch; });
    return out;
  }

  var stilleBuehne = {
    vorher: async function () {},
    schnappschuss: function () { return null; },
    nachher: async function () {}
  };

  /* Kurzer Fingerabdruck eines Endstands: Reicht, um zwei Läufe zu vergleichen. */
  function abdruck(wert) {
    var text = JSON.stringify(wert), h = 5381;
    for (var i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
    return text.length + ":" + h;
  }

  /* Anweisung 48 (c): Fingerabdruck dessen, was im Nutzbereich zu sehen ist: Lage, Größe, Farben, Schrift und Text jedes
     sichtbaren Elements. Zwei Läufe desselben Szenarios mit gleichem Abdruck sehen gleich aus. */
  var BILD_STILE = ["color", "backgroundColor", "backgroundImage", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "textTransform",
    "textDecorationLine", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderLeftColor", "borderLeftWidth", "borderRadius", "outlineStyle", "opacity", "transform"];
  function bild() {
    var n = document.getElementById("nutzbereich");
    if (!n) return null;
    var ursprung = n.getBoundingClientRect(), teile = [], alle = n.querySelectorAll("*"), bereich = document.createRange();
    function lage(r) { return [Math.round(r.left - ursprung.left), Math.round(r.top - ursprung.top), Math.round(r.width), Math.round(r.height)].join(","); }
    for (var i = 0; i < alle.length; i++) {
      var e = alle[i], r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var c = getComputedStyle(e);
      if (c.visibility === "hidden") continue;
      /* Der Text selbst: wo er steht und wie breit er läuft (Schrift, Abstände, Umbruch) */
      var text = [];
      for (var k = e.firstChild; k; k = k.nextSibling) {
        if (k.nodeType !== 3 || !k.nodeValue.trim()) continue;
        bereich.selectNodeContents(k);
        text.push(k.nodeValue.trim().slice(0, 40) + "@" + lage(bereich.getBoundingClientRect()));
      }
      teile.push([e.tagName, lage(r), BILD_STILE.map(function (s) { return c[s]; }).join("|"), text.join(";")]);
    }
    return abdruck(teile);
  }

  /* Anweisung 28d: Die Plugins, die das gezeichnet haben, was in der Anzeige abweicht. Was jetzt fehlt, hat keinen Zeichner mehr;
     dann kommen alle in Frage, die an dieser Ansicht zeichnen. */
  function zeichnerDerAbweichung(unterschiede) {
    var teile = unterschiede.filter(function (u) { return u.pfad.indexOf("sichten/") === 0; });
    if (!teile.length) return [];
    var z = H.zeichner(), out = {};
    function zaehle(l) { var c = {}; l.forEach(function (p) { c[p] = (c[p] || 0) + 1; }); return c; }
    teile.forEach(function (u) {
      var je = z[u.pfad.slice("sichten/".length)] || {}, a = zaehle(u.alt), b = zaehle(u.neu);
      Object.keys(Object.assign({}, a, b)).forEach(function (p) {
        if (a[p] === b[p]) return;
        (je[p] || [].concat.apply([], Object.keys(je).map(function (x) { return je[x]; }))).forEach(function (k) { out[k] = true; });
      });
    });
    return Object.keys(out).sort();
  }

  /* In der unsichtbaren Kopie */
  async function fuehreAus(auftrag) {
    /* Regeln der Seite und eine neue Regel aus einem Wunsch, der gerade probegespielt wird */
    (auftrag.regeln || []).forEach(function (r) { H.regelEinspielen(r.name, r.quelle); });
    H.schalteAus(auftrag.aus);
    H.bedienung.setzeWahl(auftrag.bedienWahl);
    auftrag.eingespielt.forEach(function (e) { H.einspielen(e.name, e.quelle); });
    var plaetze = Object.keys(auftrag.stand);
    for (var i = 0; i < plaetze.length; i++) {
      if (!H.aus[auftrag.stand[plaetze[i]]]) await H.wechsle(auftrag.stand[plaetze[i]]);
    }
    /* Probe: Was neu kommt, wird zuletzt eingespielt und gewinnt seinen Platz. */
    var schonDa = H.pluginAbdruecke(), bedienungVorher = H.bedienungsAbdruecke();
    (auftrag.kandidat || []).forEach(function (e) { H.einspielen(e.name, e.quelle); });
    var kandidatNamen = (auftrag.kandidat || []).map(function (e) { return e.name; });
    /* Anweisung 57: Mausbedienungen, die das Neue bringt oder ändert. Ein Szenario muss jede davon mit der Maus ausführen. */
    var kandidatPlugins = [];
    kandidatNamen.forEach(function (n) { kandidatPlugins = kandidatPlugins.concat((H.inhalt[n] || {}).plugins || []); });
    var bedienungNachher = H.bedienungsAbdruecke(kandidatPlugins), bedienungenNeu = [];
    Object.keys(bedienungNachher).forEach(function (k) {
      if (!bedienungVorher[k] || bedienungVorher[k].abdruck !== bedienungNachher[k].abdruck) bedienungenNeu.push({ schluessel: k, titel: bedienungNachher[k].titel, art: bedienungNachher[k].art });
    });
    H.bedienung.gespieltLeeren();
    var bedienHinweise = [];
    /* Anweisung 55: Was ein Wunsch neu mitbringt, gehört zur Teil-App des Wunsches, wie nach dem Speichern (Anweisung 49).
       Ohne das zählte es im Probelauf zur Heimat: Ergänzungen fremder Ansichten zeichneten nicht, neue Szenarien liefen dort. */
    if (auftrag.teilApp) kandidatNamen.forEach(function (n) {
      var drin = H.inhalt[n] || {};
      (drin.plugins || []).forEach(function (k) { if (!schonDa[k] && !H.teilApp.plugins[k]) H.teilApp.plugins[k] = auftrag.teilApp; });
      (drin.drehbuecher || []).forEach(function (k) { if (!H.teilApp.drehbuecher[k]) H.teilApp.drehbuecher[k] = auftrag.teilApp; });
    });
    var abweichungen = [], ausfaelle = [], drehbuecher = [], widersprueche = [];
    /* Anweisung 58 (b): je Ausfall ein Satz für den PO in Fachsprache, welches Szenario was nicht geschafft hat */
    var gruende = [];
    /* Nur der eigene Teil; alle Kopien haben dieselbe Liste, auch mit Drehbüchern aus dem Neuen. */
    /* Nur die betroffenen Szenarien (Anweisung 18), dazu immer die, die das Neue mitbringt */
    var neueSzenarien = [];
    kandidatNamen.forEach(function (n) { neueSzenarien = neueSzenarien.concat((H.inhalt[n] || {}).drehbuecher || []); });
    var auswahl = auftrag.auswahl ? H.drehbuecher.filter(function (d) {
      return auftrag.auswahl.indexOf(d.kennung) !== -1 || neueSzenarien.indexOf(d.kennung) !== -1;
    }) : H.drehbuecher;
    /* Anweisung 57: Die vorhandenen Szenarien werden in beiden Läufen (ohne und mit dem Neuen) gleich aufgeteilt; was das Neue an
       Szenarien mitbringt, läuft im letzten Teil hinten an. Sonst liefe ein vorhandenes Szenario nach einem anderen Vorgänger in
       seiner Kopie, und was der stehen lässt (z. B. ein offenes Fenster), sähe aus wie eine Änderung durch den Wunsch. */
    var vorhandene = auswahl.filter(function (d) { return neueSzenarien.indexOf(d.kennung) === -1; });
    var neue = auswahl.filter(function (d) { return neueSzenarien.indexOf(d.kennung) !== -1; });
    var meine = auftrag.teil ? (teileVon(vorhandene, auftrag.teil.von)[auftrag.teil.nr] || []).concat(auftrag.teil.nr === auftrag.teil.von - 1 ? neue : []) : vorhandene.concat(neue);
    for (var n = 0; n < meine.length; n++) {
      var d = meine[n], ausfaelleVorher = ausfaelle.length;
      /* Anweisung 45 (b): Ein Plugin, das in keinem Szenario arbeitet, wird einmal mit einem zusätzlichen Ereignis am Ende abgespielt. */
      if (auftrag.zusatz && auftrag.zusatz[d.kennung]) d = Object.assign({}, d, { ereignisse: d.ereignisse.concat(auftrag.zusatz[d.kennung]) });
      parent.postMessage({ art: "fortschritt", fertig: n, gesamt: meine.length, titel: d.titel }, "*");
      H.zeigeTeilApp(H.teilAppVonSzenario(d.kennung));
      H.neuerTag(d.von);
      /* Anweisung 55: auch wie es am Anfang aussieht. Ein Wunsch kann etwas zeigen, das das Szenario bis zum Ende wieder auflöst
         (z. B. Geräteaufträge ohne Gerät, die es zuteilt); nur am Ende verglichen, sähe er aus wie wirkungslos. */
      var bildAnfang = auftrag.mitBild ? bild() : undefined;
      await H.ablauf(d, {
        buehne: stilleBuehne, minute: 0,
        warte: async function () {},
        stelle: function (t) { H.uhr.stelle(t); }
      });
      /* Der Vergleich mit dem Gesehenen sagt, was jetzt anders ist; das Drehbuch nur, was fehlt. */
      var g = auftrag.grundlagen[d.kennung];
      var endstand = H.soll.endstand();
      var unterschiede = g ? H.soll.vergleiche(g.endstand, endstand) : [];
      var satz = g ? H.soll.satz(unterschiede) : null;
      /* Je Änderung ein Satz mit Ebene: Plan (Zuweisung, Zeit, Konflikt, Status) oder nur Anzeige */
      var aenderungen = unterschiede.length ? H.soll.aenderungen(unterschiede) : [];
      /* Anweisung 61 (a): Was das erwartete Ende zeigen soll, kommt vorher in den sichtbaren Ausschnitt. */
      var nichtZuSehen = await H.bedienung.zeigeErwartetes(d);
      var erwartung = H.soll.pruefe(d, !!g);
      /* Eine Erwartung ändern darf das Neue nur, wo es ihr widerspricht: Die alte muss jetzt scheitern. */
      if (!H.fehler.length) {
        H.erwartungen.forEach(function (e) {
          if (e.drehbuch !== d.kennung || !e.alt || kandidatNamen.indexOf(e.datei) === -1) return;
          if (H.soll.erfuellt(e.alt) === true) {
            ausfaelle.push(d.titel + ": Die Erwartung „" + e.alt.text + "“ wurde geändert, obwohl die Änderung ihr nicht widerspricht. Erwartungen, die die Änderung nicht berührt, bleiben fest.");
            gruende.push("„" + d.titel + "“: Der Wunsch hätte die Erwartung „" + e.alt.text + "“ geändert, obwohl er ihr nicht widerspricht.");
          }
        });
      }
      drehbuecher.push({
        kennung: d.kennung, titel: d.titel, satz: satz, erwartung: erwartung, abdruck: abdruck(endstand),
        mitErwartung: H.erwartungenVon(d).length > 0,
        aenderungen: aenderungen,
        plan: aenderungen.some(function (a) { return a.ebene === "plan"; }),
        anzeige: aenderungen.some(function (a) { return a.ebene === "anzeige"; }),
        endstand: auftrag.mitEndstand && (satz || (d.gespielt && erwartung)) ? endstand : null,
        /* Was der Wächter am Ende dieses Drehbuchs meldet; ein Sollergebnis ändert daran nichts. */
        verstoesse: H.waechter.jetzt(),
        /* Welche Plugins in diesem Drehbuch etwas getan haben */
        taeter: H.taeter(),
        /* Welche Felder dieses Szenario ändert (berührt es eine Regel?) */
        felder: H.felder(),
        gerufen: H.gerufen(),
        zugriffe: H.zugriffe(),
        /* Wer in diesem Szenario auf eine Bedienung antwortet (nur für die Herkunft, Anweisung 22) */
        bedient: H.bedient(),
        /* Ändert eine Kette Objekte mit Status, ohne ihn anzuschauen? (Fälle ohne Regel) */
        blind: H.statusBlind(), bedacht: H.statusBlind(true),
        roh: auftrag.roh ? endstand : undefined,
        /* zuletzt: Es zeichnet die Ansichten einmal neu */
        anzeigeVon: zeichnerDerAbweichung(unterschiede),
        /* Anweisung 48 (c): wie es am Ende aussieht, und in welcher Teil-App */
        teilApp: H.teilAppVonSzenario(d.kennung),
        bild: auftrag.mitBild ? bild() : undefined,
        bildAnfang: bildAnfang
      });
      H.widersprueche.forEach(function (w) {
        widersprueche.push(Object.assign({ was: H.soll.satz([{ pfad: w.pfad, alt: w.alt, neu: w.neu }], null) }, w));
      });
      H.fehler.forEach(function (f) {
        ausfaelle.push(d.titel + ": " + f.wer + " ist ausgefallen: " + f.text);
        gruende.push("„" + d.titel + "“: " + (f.satz || "„" + H.titelVon(f.wer) + "“ ist dabei ausgefallen."));
      });
      /* Anweisung 57: Was sich mit der Maus nicht greifen oder ablegen ließ, ist ein Ausfall wie jeder andere. */
      (H.bedienFehler || []).forEach(function (f) { ausfaelle.push(d.titel + ": " + f.satz); gruende.push("„" + d.titel + "“: " + f.satz); bedienHinweise.push(d.titel + ": " + f.ki); });
      /* Ein von Hand gespieltes Ergebnis darf ein Wunsch ändern: Das meldet die Abweichung unten. */
      if (erwartung && !H.fehler.length && !d.gespielt) {
        ausfaelle.push(d.titel + ": Nicht erfüllt: " + erwartung);
        gruende.push("„" + d.titel + "“ endet nicht wie erwartet: " + erwartung + (nichtZuSehen.saetze.length ? " " + nichtZuSehen.saetze.join(" ") : ""));
        nichtZuSehen.ki.forEach(function (k) { bedienHinweise.push(d.titel + ": " + k); });
      }
      drehbuecher[drehbuecher.length - 1].ausfall = ausfaelle.length > ausfaelleVorher;
      if (satz) abweichungen.push(d.titel + ": " + satz);
      else if (erwartung) abweichungen.push(d.titel + ": Erwartet war: " + erwartung);      parent.postMessage({ art: "fortschritt", fertig: n + 1, gesamt: meine.length }, "*");
    }
    return { abweichungen: abweichungen, ausfaelle: ausfaelle, gruende: gruende, drehbuecher: drehbuecher, widersprueche: widersprueche,
      bedienungenNeu: bedienungenNeu, bedienungenGespielt: H.bedienung.gespielt(), bedienHinweise: bedienHinweise };
  }

  /* Was nach dem Neuen am Ende eines Drehbuchs gemeldet wird und vorher dort nicht stand */
  /* Anweisung 36: Wer in einem Szenario mit Abweichung mitgewirkt hat: bei einem Ausfall oder Regelverstoß alle,
     die dort gearbeitet haben, bei einem anderen Ende die, die erst mit dem Neuen tätig wurden. */
  function beteiligt(vorher, nachher) {
    var alt = {}, out = {};
    (vorher.drehbuecher || []).forEach(function (d) { alt[d.kennung] = d; });
    (nachher.drehbuecher || []).forEach(function (d) {
      if (!d.ausfall && !d.satz) return;
      var frueher = (alt[d.kennung] || {}).taeter || [];
      (d.taeter || []).concat(d.ausfall ? d.gerufen || [] : []).forEach(function (k) {
        if (d.ausfall || frueher.indexOf(k) === -1) out[k] = true;
      });
    });
    return Object.keys(out);
  }

  function neueVerstoesse(vorher, nachher) {
    var alt = {}, neu = {}, reihe = [];
    (vorher.drehbuecher || []).forEach(function (d) {
      (d.verstoesse || []).forEach(function (v) { alt[d.kennung + "#" + v.schluessel] = true; });
    });
    (nachher.drehbuecher || []).forEach(function (d) {
      (d.verstoesse || []).forEach(function (v) {
        if (alt[d.kennung + "#" + v.schluessel]) return;
        /* Bewusst in Kauf genommen: bleibt sichtbar, hält aber keinen Probelauf auf. */
        if (H.waechter.istInKauf(v.schluessel)) return;
        if (!neu[v.schluessel]) { neu[v.schluessel] = { schluessel: v.schluessel, regel: v.regel, satz: v.satz, drehbuecher: [] }; reihe.push(v.schluessel); }
        neu[v.schluessel].drehbuecher.push(d.titel);
        d.ausfall = true;
      });
    });
    return reihe.map(function (k) { return neu[k]; });
  }

  H.nachspiel = {
    /* Einstieg der unsichtbaren Kopie */
    dienen: function () {
      H.neuerTag(H.drehbuecher[0].von);
      window.addEventListener("message", function (e) {
        if (!e.data || e.data.art !== "nachspielen") return;
        fuehreAus(e.data).then(function (ergebnis) {
          parent.postMessage({ art: "nachgespielt", ergebnis: ergebnis }, "*");
        }, function (fehler) {
          var text = "Das Nachspielen ging nicht zu Ende: " + fehler.message;
          parent.postMessage({ art: "nachgespielt", ergebnis: { abbruch: true, abweichungen: [text], ausfaelle: [text], gruende: ["Der Probelauf brach mitten in einem Szenario ab."] } }, "*");
        });
      });
      parent.postMessage({ art: "kopie-bereit" }, "*");
    },

    /* Probelauf für etwas, das noch nicht in der Seite ist, mit dem Wächter über alle Drehbücher:
       einmal ohne, einmal mit dem Neuen, beide gleichzeitig. Verstöße, die es ohne schon gibt, sind nicht seine.
       regeln: eine neue Regel aus dem Wunsch, sie gilt in beiden Läufen.
       fortschritt(fertig, gesamt): je fertiges Drehbuch, beide Läufe zusammen gezählt.
       fertig({ ausfaelle, verstoesse: [{ regel, satz, drehbuecher: [titel] }] }) */
    probe: function (kandidat, regeln, fertig, fortschritt, auswahl, wunsch) {
      var self = this, stand = { vorher: [0, 0], nachher: [0, 0] };
      function melde(welcher) {
        return function (f, g) {
          stand[welcher] = [f, g];
          if (fortschritt) fortschritt(stand.vorher[0] + stand.nachher[0], stand.vorher[1] + stand.nachher[1]);
        };
      }
      var haelfte = Math.max(1, Math.floor(KERNE / 2));
      Promise.all([
        /* Anweisung 67 (b): Die Hälfte ohne das Neue nimmt das Ergebnis des letzten Laufs dieses Wunsches, wenn sich seitdem nichts geändert hat. */
        new Promise(function (ok) { self.lauf(null, ok, { regeln: regeln, teile: haelfte, fortschritt: melde("vorher"), auswahl: auswahl, mitBild: true, merken: wunsch || null }); }),
        new Promise(function (ok) { self.lauf(kandidat, ok, { regeln: regeln, teile: haelfte, fortschritt: melde("nachher"), auswahl: auswahl, mitBild: true }); })
      ]).then(function (r) {
        var verstoesse = neueVerstoesse(r[0], r[1]);
        /* Anweisung 38: Kennungen der Szenarien, die anders endeten; die KI kennt sie vielleicht noch nicht. */
        var szenarien = (r[1].drehbuecher || []).filter(function (d) { return d.ausfall || d.satz; }).map(function (d) { return d.kennung; });
        /* Anweisung 48 (c): je Szenario, ob es mit dem Neuen anders aussieht */
        var alt = {};
        (r[0].drehbuecher || []).forEach(function (d) { alt[d.kennung] = d; });
        var bilder = (r[1].drehbuecher || []).filter(function (d) { return alt[d.kennung] && d.bild; }).map(function (d) {
          return { kennung: d.kennung, titel: d.titel, teilApp: d.teilApp, anders: d.bild !== alt[d.kennung].bild || d.bildAnfang !== alt[d.kennung].bildAnfang, daten: !!d.satz };
        });
        /* Anweisung 57: neue oder geänderte Mausbedienungen, die kein Szenario mit der Maus ausgeführt hat; je eine */
        var gespielt = r[1].bedienungenGespielt || [], schon = {};
        var ungeprueft = (r[1].bedienungenNeu || []).filter(function (b) {
          if (schon[b.schluessel] || gespielt.indexOf(b.schluessel) !== -1) return false;
          schon[b.schluessel] = true;
          return true;
        });
        /* Anweisung 58: Ein Ausfall, den es ohne das Neue genauso gibt (z. B. ein Szenario, dessen Klick schon vorher nichts bewirkt),
           ist nicht seiner, wie bei den Verstößen. Ausfälle und Gründe stehen paarweise in derselben Reihenfolge. Bricht die Kopie
           selbst ab (abbruch), wird nichts herausgenommen: Dann ist nicht bekannt, was das Neue tut. */
        var vorher = {};
        (r[0].ausfaelle || []).forEach(function (x) { vorher[x] = true; });
        (r[0].bedienHinweise || []).forEach(function (x) { vorher[x] = true; });
        var alleAus = r[1].ausfaelle || [], alleGruende = r[1].gruende || [], ausfaelle = [], gruende = [];
        alleAus.forEach(function (x, i) {
          if (vorher[x] && !r[0].abbruch && !r[1].abbruch) return;
          ausfaelle.push(x);
          if (alleGruende[i]) gruende.push(alleGruende[i]);
        });
        var bedienHinweise = (r[1].bedienHinweise || []).filter(function (x) { return !vorher[x]; });
        /* Anweisung 58: Eine neue Mausbedienung, die ein Szenario mit der Maus ausgeführt hat, ist eine sichtbare Wirkung, auch wenn
           die Bilder der vorhandenen Szenarien gleich bleiben. */
        var mausGeprueft = (r[1].bedienungenNeu || []).some(function (b) { return gespielt.indexOf(b.schluessel) !== -1; }) ||
          /* Ebenso ein neues Szenario des Wunsches, das mit erfüllten Erwartungen durchläuft: Es zeigt, was der Wunsch sichtbar macht,
             auch wenn das erst nach einer Bedienung erscheint (z. B. der Konflikt „falsche Geräteart“ nach dem Ablegen). */
          (r[1].drehbuecher || []).some(function (d) { return !alt[d.kennung] && !d.ausfall && d.mitErwartung; });
        fertig({ ausfaelle: ausfaelle, gruende: gruende, verstoesse: verstoesse, abweichungen: r[1].abweichungen || [], beteiligt: beteiligt(r[0], r[1]), szenarien: szenarien, bilder: bilder,
          ungeprueft: ungeprueft, keinSzenario: !(r[1].drehbuecher || []).length, bedienHinweise: bedienHinweise, mausGeprueft: mausGeprueft });
      });
    },

    /* Wie viele eingespielte Dateien der letzte gewöhnliche Lauf in seine Kopien geladen hat (für die Prüfung) */
    ersparnis: function () { return self_ersparnis; },

    /* So viele Kopien laufen höchstens gleichzeitig */
    kerne: KERNE,

    /* Anweisung 67 (b): Kennungen der Szenarien, die ein Wunsch der Teil-App teilApp berühren kann: ihre eigenen und die der
       Teil-Apps, die über eine Naht von ihr hören. null heißt alle: Das Projekt hat nur eine Teil-App. */
    szenarienDerTeilApp: function (teilApp) {
      if (!teilApp || !H.mehrereTeilApps()) return null;
      var dazu = [teilApp];
      (H.teilApp.naehte || []).forEach(function (n) {
        if (n.von !== teilApp) return;
        (n.fuer || (H.teilApp.mitPrototyp || [])).forEach(function (t) { if (dazu.indexOf(t) === -1) dazu.push(t); });
      });
      /* Anweisung 48 (a) bleibt: Von jeder anderen Teil-App läuft ein Szenario mit, damit der Probelauf sieht, wenn der Wunsch
         ihr Aussehen mitverändert (z. B. Stil, der über die eigene Teil-App hinausgreift). */
      var fremdeSchon = {};
      return H.drehbuecher.filter(function (d) {
        var t = H.teilAppVonSzenario(d.kennung);
        if (dazu.indexOf(t) !== -1) return true;
        if (fremdeSchon[t]) return false;
        fremdeSchon[t] = true;
        return true;
      }).map(function (d) { return d.kennung; });
    },

    /* wie: { eingespielt, stand, aus, mitEndstand, regeln, teile, fortschritt(fertig, gesamt), auswahl };
       auswahl: nur diese Szenarien (Kennungen) und die, die der Kandidat mitbringt; ohne Angabe alle.
       ohne Angabe gilt der Stand der Seite. teile: auf wie viele Kopien die Drehbücher verteilt
       werden; ohne Angabe teilen sich die gerade offenen Läufe die Kerne. */
    lauf: function (kandidat, fertig, wie) {
      wie = wie || {};
      /* Jede Kopie spielt erst alle Wünsche ein; das kostet mehr als ein Drehbuch. Gemessen (07.11., 14 Drehbücher)
         ist ein Lauf mit 3 bis 6 Kopien am schnellsten, mit 12 wieder langsamer: darum je Kopie mindestens 3. */
      var liste = wie.auswahl ? H.drehbuecher.filter(function (d) { return wie.auswahl.indexOf(d.kennung) !== -1; }) : H.drehbuecher;
      var anzahl = Math.max(1, Math.min(Math.ceil(Math.max(1, liste.length) / MINDESTENS_JE_KOPIE), wie.teile || Math.floor(KERNE / offeneLaeufe)));
      if (!GETRENNT) anzahl = 1;
      var auftrag = {
        art: "nachspielen", stand: wie.stand || H.stand(), eingespielt: wie.eingespielt || H.eingespielt, kandidat: kandidat,
        aus: wie.aus || Object.keys(H.aus), mitEndstand: !!wie.mitEndstand, roh: !!wie.roh,
        regeln: H.regelQuellen.concat(wie.regeln || []),
        grundlagen: H.soll.alleGrundlagen(),
        auswahl: wie.auswahl || null,
        zusatz: wie.zusatz || null,
        mitBild: !!wie.mitBild,
        bedienWahl: H.bedienung.wahlListe(),
        teilApp: kandidat ? (H.teilApp.offen || H.teilApp.heimat) : null
      };
      /* Anweisung 67 (b): Derselbe Auftrag mit derselben Aufteilung ergibt dasselbe Ergebnis; dann wird es nicht noch einmal gespielt.
         Der Schlüssel umfasst alles, was die Kopien bekommen, dazu die Zuordnung zu den Teil-Apps; gemerkt wird nur der letzte Lauf. */
      var merkSchluessel = wie.merken && !kandidat ? abdruck([wie.merken, auftrag, anzahl, liste.map(function (d) { return d.kennung; }), H.teilApp.plugins, H.teilApp.drehbuecher]) : null;
      if (merkSchluessel && gemerkt && gemerkt.schluessel === merkSchluessel) {
        var kopieDavon = JSON.parse(gemerkt.ergebnis);
        setTimeout(function () { fertig(kopieDavon); }, 0);
        return;
      }
      offeneLaeufe++;
      /* Bis eine Kopie sich meldet, zählt ihr Teil nach der Liste der Seite (ohne Drehbücher aus dem Neuen). */
      var je = teileVon(liste, anzahl).map(function (t) { return [0, t.length]; });
      function melde(nr, f, g, titel) {
        je[nr] = [f, g];
        if (!wie.fortschritt) return;
        var summe = [0, 0];
        je.forEach(function (x) { if (x) { summe[0] += x[0]; summe[1] += x[1]; } });
        wie.fortschritt(summe[0], summe[1], titel);
      }
      /* Anweisung 31c: Ein gewöhnlicher Lauf lädt in jeder Kopie nur die Wünsche, die in ihren Szenarien beim letzten Abspielen gearbeitet
         haben, und die, die dort zeichnen. Im Zweifel (neues oder geändertes Plugin, Probelauf, Ursachensuche) alle. */
      var gewoehnlich = !kandidat && !wie.mitBild && !wie.eingespielt && !wie.aus && !wie.stand && !wie.zusatz && !(wie.regeln && wie.regeln.length);
      var zerlegt = teileVon(liste, anzahl), ersparnis = { alle: 0, geladen: 0 };
      function nurDieNoetigen(nr) {
        var noetig = gewoehnlich ? H.verwaltung.nurNoetig(zerlegt[nr].map(function (d) { return d.kennung; })) : null;
        var hier = !noetig ? auftrag.eingespielt : auftrag.eingespielt.filter(function (e) {
          var drin = (H.inhalt[e.name] || {}).plugins || [];
          return !drin.length || drin.some(function (k) { return noetig[k]; });
        });
        ersparnis.alle += auftrag.eingespielt.length;
        ersparnis.geladen += hier.length;
        return hier;
      }
      var teilLaeufe = [];
      for (var nr = 0; nr < anzahl; nr++) {
        teilLaeufe.push((function (nr) {
          var eingespielt = nurDieNoetigen(nr);
          return platz().then(function (p) {
            return kopie(Object.assign({ teil: { nr: nr, von: anzahl } }, auftrag, { eingespielt: eingespielt }), p, function (f, g, titel) { melde(nr, f, g, titel); })
              .then(function (r) { gibFrei(p); return r; });
          });
        })(nr));
      }
      if (gewoehnlich) self_ersparnis = ersparnis;
      Promise.all(teilLaeufe).then(function (ergebnisse) {
        offeneLaeufe--;
        var r = zusammen(ergebnisse);
        if (merkSchluessel && !r.abbruch) gemerkt = { schluessel: merkSchluessel, ergebnis: JSON.stringify(r) };
        fertig(r);
      });
    }
  };

  /* Eine unsichtbare Kopie auf Platz p spielt ihren Teil der Drehbücher. */
  function kopie(auftrag, p, fortschritt) {
    return new Promise(function (fertig) {
      var rahmen = document.createElement("iframe");
      rahmen.src = adresse(p);
      /* Über die Brücke läuft fremder Quelltext der KI; per Doppelklick lädt eine Sandbox keine Dateien. */
      if (location.protocol === "http:") rahmen.setAttribute("sandbox", "allow-scripts");
      rahmen.setAttribute("aria-hidden", "true");
      rahmen.style.cssText = "position:absolute;left:-10000px;top:0;width:1400px;height:900px;visibility:hidden;";

      function ende(ergebnis) {
        window.removeEventListener("message", hoere);
        clearTimeout(uhrwerk);
        rahmen.remove();
        fertig(ergebnis);
      }
      function hoere(e) {
        if (e.source !== rahmen.contentWindow || !e.data) return;
        if (e.data.art === "kopie-bereit") {
          clearTimeout(adressePruefen);
          rahmen.contentWindow.postMessage(auftrag, "*");
        } else if (e.data.art === "fortschritt") {
          /* Anweisung 58: Die Zeit gilt ohne Fortschritt, nicht für alle Szenarien der Kopie zusammen; ein langsamer Rechner ist kein Ausfall. */
          if (e.data.titel) zuletzt = e.data.titel;
          clearTimeout(uhrwerk);
          uhrwerk = setTimeout(abgelaufen, ZEITLIMIT);
          fortschritt(e.data.fertig, e.data.gesamt, e.data.titel);
        } else if (e.data.art === "nachgespielt") {
          ende(e.data.ergebnis);
        }
      }
      var zuletzt = null;
      function abgelaufen() {
        var text = zuletzt ? "Das Nachspielen kam im Szenario „" + zuletzt + "“ nicht weiter; vielleicht wartet oder kreist dort ein Plugin." : "Das Nachspielen kam nicht zu Ende.";
        ende({ abbruch: true, abweichungen: [text], ausfaelle: [text], gruende: [zuletzt ? "„" + zuletzt + "“ kam im Probelauf nicht zu Ende." : "Der Probelauf wurde in der vorgesehenen Zeit nicht fertig."] });
      }
      var uhrwerk = setTimeout(abgelaufen, ZEITLIMIT);

      /* Ein älterer Server kennt die eigenen Adressen nicht, und die Kopie meldet sich nie: dann wie
         früher alle unter der Adresse der Seite, eine nach der anderen. */
      var adressePruefen = GETRENNT ? setTimeout(function () {
        if (!GETRENNT) return;
        GETRENNT = false;
        window.removeEventListener("message", hoere);
        clearTimeout(uhrwerk);
        rahmen.remove();
        kopie(auftrag, p, fortschritt).then(fertig);
      }, ADRESSE_FRIST) : null;

      window.addEventListener("message", hoere);
      document.body.appendChild(rahmen);
    });
  }
})();
