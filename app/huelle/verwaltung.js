/* Feste Hülle, Teil 8: Verwaltung der Plugins.
   Ein Eintrag ist ein kleines Plugin: aus der Grundausstattung oder aus Wünschen, mit seiner
   Herkunft im Wortlaut und seinen Fassungen. Was an, aus oder im Papierkorb ist, steht in Dateien,
   nicht im Browser.

   Nach jeder Änderung wird unsichtbar nachgespielt. Zuerst der Stand der Seite: Das liefert
   die Abweichungen und, wer in welchem Szenario gearbeitet hat (das „berührt“ ein Plugin).
   Nur wenn etwas abweicht, und nur für diese Szenarien, wird die Ursache gemessen (Vorgabe des PO, 09.11.):
   - Die Wünsche kommen der Reihe nach dazu. Der Wunsch, ab dem ein Drehbuch nicht mehr zum
     Sollergebnis passt, ist seine Ursache.
   - Abgeschaltetes und Gelöschtes kommt probeweise dazu: Passt es dann, ist das die Ursache. */
(function () {
  "use strict";
  var H = window.Huelle;
  var MIT_BRUECKE = location.protocol === "http:";
  var RUHE_TAKT_MS = 400;

  var stand = { wuensche: [], papierkorb: [], aus: [] };
  var lesbar = false;
  var ergebnis = leer();
  var gemeldetBereit = false;
  var durchgang = 0;
  /* Fortschritt der Messung: { fertig, gesamt, beginn } oder null (AGENTS.md: Fortschritt ist immer sichtbar) */
  var fortschritt = null;

  function leer() {
    return { fertig: false, gemessen: false, ist: null, widersprueche: [], ursachen: {}, beruehrt: {} };
  }

  function istDrehbuchDatei(name) { return /\.drehbuch\.js$|^gespielt-/.test(name); }
  function istAn(w) { return stand.aus.indexOf(w.kennung) === -1; }
  function ausWunsch() { return stand.wuensche.filter(function (w) { return !w.grund; }); }
  function herkunftVon(kennung) {
    return stand.wuensche.filter(function (w) { return w.kennung === kennung; })[0] || null;
  }
  /* Das Plugin, zu dessen Wunsch ein Drehbuch gespielt wurde */
  function besitzerVon(drehbuch) {
    return stand.wuensche.filter(function (w) { return !w.grund && eigeneDrehbuecher(w).indexOf(drehbuch) !== -1; })[0] || null;
  }
  /* Kennungen der Drehbücher, die zu einem Plugin gehören */
  function eigeneDrehbuecher(w) {
    return (w.dateien || []).filter(function (d) { return istDrehbuchDatei(d.name); })
      .map(function (d) { return wunschZuDatei(d.name); });
  }
  /* Weicht ein Drehbuch im Plan ab (Zuweisung, Zeit, Konflikt, Status, oder seine Erwartung scheitert)
     oder nur in der Anzeige (Overlay, Farbe, Hervorhebung)? Beides wird getrennt gemessen. */
  function imPlan(d) { return !!(d.plan || d.erwartung || (d.satz && !d.aenderungen)); }
  function inAnzeige(d) { return !!d.anzeige; }
  function auffaellig(d) { return imPlan(d) || inAnzeige(d); }
  var EBENEN = { plan: imPlan, anzeige: inAnzeige };
  function nachKennung(r) {
    var out = {};
    (r.drehbuecher || []).forEach(function (d) { out[d.kennung] = d; });
    return out;
  }

  function lauf(wie) {
    return new Promise(function (fertig) { H.nachspiel.lauf(null, fertig, wie); });
  }

  /* Später eingespielt gewinnt: Wünsche stehen in ihrer Reihenfolge, Eingespieltes danach. */
  function ordne(dateien) {
    function rang(d) { return /^wunsch-/.test(d.name) ? d.name : "~" + d.name; }
    return dateien.slice().sort(function (a, b) { return rang(a) < rang(b) ? -1 : rang(a) > rang(b) ? 1 : 0; });
  }

  function wunschZuDatei(name) { return name.replace(/\.(drehbuch\.)?js$/, ""); }

  /* Eingespielt ohne den Plugin-Teil der genannten Wünsche; ihre Drehbücher bleiben dabei. */
  function ohnePlugins(wuensche) {
    var weg = wuensche.map(function (w) { return w.kennung; });
    return H.eingespielt.filter(function (e) {
      return istDrehbuchDatei(e.name) || weg.indexOf(wunschZuDatei(e.name)) === -1;
    });
  }

  async function ruhe(meine) {
    while (meine === durchgang && H.player.laeuftGerade()) {
      await new Promise(function (ok) { setTimeout(ok, RUHE_TAKT_MS); });
    }
  }

  async function nacheinander(aufgaben, meine) {
    var naechste = 0;
    if (!fortschritt) fortschritt = { fertig: 0, gesamt: 0, beginn: Date.now() };
    fortschritt.gesamt += aufgaben.length;
    H.leiste.zeichne();
    zeigeStand();
    async function arbeiter() {
      while (naechste < aufgaben.length && meine === durchgang) {
        var a = aufgaben[naechste++];
        await ruhe(meine);
        /* Viele Läufe: je einer in einer Kopie. Wenige: Jeder verteilt seine Drehbücher auf mehrere. */
        a.ergebnis = nachKennung(await lauf(Object.assign({ teile: Math.max(1, Math.floor(H.nachspiel.kerne / aufgaben.length)) }, a.wie)));
        if (meine === durchgang && fortschritt) { fortschritt.fertig++; H.leiste.zeichne(); zeigeStand(); }
      }
    }
    var arbeiterListe = [];
    /* So viele gleichzeitig, wie der Rechner Kerne hat; die Hülle hält die übrigen Kopien in der Warteschlange. */
    for (var i = 0; i < Math.min(H.nachspiel.kerne, aufgaben.length); i++) arbeiterListe.push(arbeiter());
    await Promise.all(arbeiterListe);
  }

  function aufgabenFuerStand() {
    var aus = Object.keys(H.aus), reihe = [], proben = [];
    var an = stand.wuensche.filter(function (w) { return istAn(w) && w.dateien.length; });
    /* Reihe: ohne die letzten Wünsche, von „keiner“ bis „alle außer dem letzten“. */
    an.forEach(function (w, i) {
      reihe.push({ kennung: w.kennung, wie: { eingespielt: ohnePlugins(an.slice(i)) } });
    });
    /* Probe: Abgeschaltetes und Gelöschtes wieder dazu */
    ausWunsch().concat(stand.papierkorb).forEach(function (w) {
      if (istAn(w) && stand.wuensche.indexOf(w) !== -1) return;
      proben.push({ kennung: w.kennung, dazu: true, wie: { eingespielt: ordne(H.eingespielt.concat(w.dateien)) } });
    });
    /* Probe: abgeschaltete Grundausstattung wieder dazu */
    grundEintraege().forEach(function (g) {
      if (!g.variante && H.aus[g.kennung]) {
        proben.push({ kennung: g.kennung, dazu: true, wie: { aus: aus.filter(function (k) { return k !== g.kennung; }) } });
      }
    });
    return { an: an, reihe: reihe, proben: proben };
  }

  function mitEigenem(liste, w) {
    var dazu = [];
    eigeneDrehbuecher(w).forEach(function (eigene) {
      if (liste.some(function (d) { return d.kennung === eigene; })) return;
      var d = H.drehbuecher.filter(function (x) { return x.kennung === eigene; })[0];
      if (d) dazu.push({ kennung: eigene, titel: d.titel });
    });
    return dazu.concat(liste);
  }

  /* Was ein Plugin berührt, steht schon im normalen Abspielen: Dort hat es etwas geändert oder auf eine Bedienung
     geantwortet. Ein Plugin, das zeichnet, wirkt in jedem Szenario. Dazu immer die Szenarien, die zu seinem Wunsch gespielt wurden. */
  function beruehrtAusLauf(ist) {
    var abdruecke = H.pluginAbdruecke(), out = {};
    var eintraege = stand.wuensche.concat(stand.papierkorb);
    var kennungen = eintraege.map(function (w) { return w.kennung; }).concat(Object.keys(H.grund));
    kennungen.forEach(function (k) {
      var ueberall = !!(abdruecke[k] && abdruecke[k].ueberall);
      var liste = H.drehbuecher.filter(function (d) {
        var r = ist[d.kennung];
        return r && (ueberall || (r.taeter || []).indexOf(k) !== -1 || (r.bedient || []).indexOf(k) !== -1);
      }).map(function (d) { return { kennung: d.kennung, titel: d.titel }; });
      var eintrag = eintraege.filter(function (w) { return w.kennung === k; })[0];
      out[k] = eintrag ? mitEigenem(liste, eintrag) : liste;
    });
    return out;
  }

  function werteAus(ist, plan) {
    var beruehrt = beruehrtAusLauf(ergebnis.ist), ursachen = {};
    Object.keys(ist).filter(function (k) { return auffaellig(ist[k]); }).forEach(function (k) {
      ursachen[k] = {};
      Object.keys(EBENEN).forEach(function (e) {
        if (EBENEN[e](ist[k])) ursachen[k][e] = ursacheVon(k, plan, EBENEN[e]);
      });
    });
    return { beruehrt: beruehrt, ursachen: ursachen };
  }

  /* Bleibt eine Ursache unbekannt, weil zwei Wünsche dasselbe Drehbuch ändern (die Reihe nimmt alle späteren
     zusammen weg, dann passt es nie): jeden Wunsch einzeln weglassen. Passt es ohne genau diesen, ist er es;
     passen mehrere, gilt der zuletzt eingespielte. Weggelassen werden nur Wünsche, die ein offenes Drehbuch
     überhaupt berühren; zusätzliche Läufe gibt es nur, wenn etwas offen bleibt. */
  async function einzelnGemessen(werte, plan, meine) {
    var ursachen = werte.ursachen, offen = [];
    Object.keys(ursachen).forEach(function (k) {
      Object.keys(ursachen[k]).forEach(function (e) { if (ursachen[k][e].art === "unbekannt") offen.push([k, e]); });
    });
    if (!offen.length) return;
    var einzeln = plan.an.filter(function (w) {
      return (werte.beruehrt[w.kennung] || []).some(function (d) { return offen.some(function (o) { return o[0] === d.kennung; }); });
    }).map(function (w) { return { kennung: w.kennung, wie: { eingespielt: ohnePlugins([w]), auswahl: plan.auswahl || undefined } }; });
    if (!einzeln.length) return;
    await nacheinander(einzeln, meine);
    if (meine !== durchgang) return;
    offen.forEach(function (o) {
      for (var i = einzeln.length - 1; i >= 0; i--) {
        var r = einzeln[i].ergebnis && einzeln[i].ergebnis[o[0]];
        if (r && !EBENEN[o[1]](r)) { ursachen[o[0]][o[1]] = { art: "wunsch", kennung: einzeln[i].kennung }; return; }
      }
    });
  }

  /* Anweisung 27: Ist die Abweichung dieses Szenarios mit den Läufen der Wünsche, die darin gearbeitet haben, schon erklärt? */
  function erklaert(k, zuerst, ist) {
    var g = H.soll.grundlage(k);
    if (g && !g.gleicherStand) return true;
    return Object.keys(EBENEN).every(function (e) {
      return !EBENEN[e](ist[k]) || zuerst.some(function (a) { return a.ergebnis && a.ergebnis[k] && !EBENEN[e](a.ergebnis[k]); });
    });
  }

  /* Was aus ist, liegt am nächsten: Passt es mit ihm, ist es die Ursache. */
  function ursacheVon(k, plan, weichtAb) {
    var i, r;
    for (i = (plan.zuerst || []).length - 1; i >= 0; i--) {
      r = plan.zuerst[i].ergebnis && plan.zuerst[i].ergebnis[k];
      if (r && !weichtAb(r)) return { art: "wunsch", kennung: plan.zuerst[i].kennung };
    }
    for (i = 0; i < plan.proben.length; i++) {
      var p = plan.proben[i];
      r = p.ergebnis && p.ergebnis[k];
      if (p.dazu && r && !weichtAb(r)) {
        var imKorb = stand.papierkorb.some(function (w) { return w.kennung === p.kennung; });
        return { art: imKorb ? "geloescht" : "aus", kennung: p.kennung };
      }
    }
    var g = H.soll.grundlage(k);
    if (g && !g.gleicherStand) return { art: "variante" };
    for (i = plan.reihe.length - 1; i >= 0; i--) {
      r = plan.reihe[i].ergebnis && plan.reihe[i].ergebnis[k];
      if (r && !weichtAb(r)) return { art: "wunsch", kennung: plan.reihe[i].kennung };
    }
    /* Ein Drehbuch, das zu einem Wunsch gespielt wurde, gehört zu dessen Plugin. Ohne das Plugin
       läuft es gar nicht erst wie gedacht, darum findet die Reihe oben es nie: Weicht es ab und
       erklärt kein späterer Wunsch das, liegt es an diesem Plugin (z. B. an einer späteren Fassung). */
    var eigner = besitzerVon(k);
    if (eigner) return { art: "wunsch", kennung: eigner.kennung };
    return { art: "unbekannt" };
  }

  function grundEintraege() {
    var out = Object.keys(H.grund).map(function (k) {
      var g = H.grund[k], aktiv = g.platz ? H.stand()[g.platz.kennung] === k : !H.aus[k];
      return Object.assign({
        kennung: k, art: "grund", name: g.titel || k, an: aktiv,
        platz: g.platz ? g.platz.kennung : null, variante: !!(g.platz && !aktiv)
      }, herkunftFelder(herkunftVon(k)));
    });
    (H.manifest.bereit || []).forEach(function (b) {
      if (H.grund[b.kennung]) return;
      out.push({ kennung: b.kennung, art: "grund", name: b.variante, an: false, platz: b.platz, variante: true });
    });
    return out;
  }

  /* Wünsche im Wortlaut und Fassungen eines Plugins, wie die Leiste sie zeigt */
  function herkunftFelder(w) {
    if (!w) return { wortlaute: [], fassungen: [], fassung: null, fachlich: null, vorige: null };
    var gueltig = {}, nr = w.aktuell, aktuell = null, fachlich = null;
    while (nr) {
      var f = (w.fassungen || []).filter(function (x) { return x.nr === nr; })[0];
      if (!f) break;
      if (!aktuell) aktuell = f;
      /* Eine Umstellung auf den Bus-Vertrag ändert kein Verhalten: Fachlich gilt die Fassung darunter. */
      if (!fachlich && f.art !== "vertrag") fachlich = f;
      gueltig[f.nr] = true;
      nr = f.vorige;
    }
    var gesehen = {};
    var wortlaute = (w.wuensche || []).filter(function (x) {
      if (!x.wortlaut || gesehen[x.wortlaut]) return false;
      gesehen[x.wortlaut] = true;
      return true;
    });
    return {
      wortlaute: wortlaute,
      umbau: (w.wuensche || []).some(function (x) { return !x.wortlaut; }),
      fassungen: (w.fassungen || []).map(function (f) {
        return Object.assign({ gilt: !!gueltig[f.nr], aktuell: aktuell && f.nr === aktuell.nr }, f);
      }).reverse(),
      fassung: aktuell ? aktuell.nr : null,
      fachlich: fachlich ? fachlich.nr : aktuell ? aktuell.nr : null,
      vorige: fachlich ? fachlich.vorige : aktuell ? aktuell.vorige : null
    };
  }

  function name(kennung) {
    var e = H.verwaltung.eintraege().filter(function (x) { return x.kennung === kennung; })[0];
    return e ? e.name : H.titelVon(kennung);
  }

  /* Ein Satz je Paar, an beiden Plugins derselbe. */
  function widerspruchSaetze() {
    var gesehen = {}, out = [];
    ergebnis.widersprueche.forEach(function (w) {
      var a = w.a, b = w.b, schluessel = a + "|" + b + "|" + w.nachricht;
      if (gesehen[schluessel]) return;
      gesehen[schluessel] = true;
      var wann = w.ereignis ? "Bei „" + w.ereignis + "“" : "Beim selben Ereignis";
      var was = w.was ? " (" + w.was + ")" : "";
      out.push({
        an: [a, b],
        /* Bus-Vertrag: Es gilt der Besitzer des Werts (a), der andere ändert nichts. */
        satz: w.besitzer
          ? wann + " wollen „" + name(a) + "“ und „" + name(b) + "“ denselben Wert festlegen" + was + "; es gilt „" + name(a) + "“, dem er gehört."
          : wann + " legen „" + name(a) + "“ und „" + name(b) + "“ Verschiedenes fest" + was + "; es gilt „" + name(b) + "“."
      });
    });
    return out;
  }


  /* Ein Wunsch ändert nur die Anzeige, wenn er Ursache von Abweichungen in der Anzeige ist,
     nirgends Ursache einer Abweichung im Plan, seine eigenen Drehbücher im Plan stimmen und sein
     Plugin nichts am Plan ändern kann (keine Bedienung, setzt und sendet nichts). */
  function nurAnzeigeWuensche() {
    var ist = ergebnis.ist || {}, anzeige = {}, plan = {};
    Object.keys(ergebnis.ursachen).forEach(function (k) {
      var u = ergebnis.ursachen[k];
      if (u.plan && u.plan.kennung) plan[u.plan.kennung] = true;
      if (u.anzeige && u.anzeige.art === "wunsch" && ist[k]) (anzeige[u.anzeige.kennung] = anzeige[u.anzeige.kennung] || []).push(ist[k].titel);
    });
    var out = {};
    Object.keys(anzeige).forEach(function (w) {
      var eintrag = herkunftVon(w);
      if (plan[w] || !eintrag || eintrag.grund || H.kannPlanAendern(w)) return;
      if (eigeneDrehbuecher(eintrag).some(function (d) { return ist[d] && imPlan(ist[d]); })) return;
      out[w] = anzeige[w];
    });
    return out;
  }

  async function aendere(pfad) {
    var r = await fetch(pfad, { method: "POST" });
    if (!r.ok) throw new Error("Antwort " + r.status);
  }

  /* Die Seite baut sich aus den Dateien neu auf, wie beim Zurücknehmen eines Wunsches. */
  function fuehreAus(pfad) {
    if (H.wunsch.offen()) {
      H.player.melde("Das geht, sobald dein Wunsch fertig ist.", "hinweis");
      return;
    }
    H.player.spieleEin(async function () {
      await aendere(pfad);
      H.leiste.merkeFuerNeuladen();
      location.reload();
    }, { ohneNeustart: true });
  }

  /* Anweisung 20 des PO (09.11.): Welche Plugins in welchem Szenario gearbeitet haben, steht danach im Projektordner.
     Das Nachspielen läuft nach jedem Laden und nach jedem Vorspielen; das Datum setzt die Brücke. */
  function merkeGearbeitet(ist, gueltig) {
    if (!MIT_BRUECKE) return;
    var szenarien = {}, zugriffe = {};
    Object.keys(ist).forEach(function (k) {
      zugriffe[k] = ist[k].zugriffe || {};
      var alle = (ist[k].taeter || []).concat(ist[k].gerufen || [], ist[k].bedient || []);
      szenarien[k] = alle.filter(function (p, i) { return alle.indexOf(p) === i; }).sort();
    });
    fetch("/gearbeitet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ szenarien: szenarien, zugriffe: zugriffe, gueltig: gueltig || null }) })
      .catch(function () { /* beim nächsten Nachspielen wieder */ });
  }

  /* ---------- Schneller Start (Anweisung 23 des PO, 09.11.) ----------
     Der zuletzt ermittelte Stand steht je Projekt in einer Datei. Beim Start zeigt Play ihn sofort und spielt nur die
     Szenarien neu, die eine Änderung betreffen kann. Im Zweifel alle: Ein falscher Stand wäre schlimmer als Warten. */
  /* rechne: was gerade im Hintergrund läuft ({ titel, fertig, gesamt }) oder null. Nichts in Play wartet darauf (Ergänzung des PO, 09.11.). */
  var standVon = null, rechne = null, letzterStart = null, letzterLauf = null, gemessenBei = null;

  function kurz(wert) {
    var text = JSON.stringify(wert === undefined ? null : wert), h = 5381;
    for (var i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
    return text.length + ":" + h;
  }
  function jeSzenario(quelle) {
    var out = {};
    H.drehbuecher.forEach(function (d) { out[d.kennung] = kurz(quelle(d)); });
    return out;
  }
  function abdruckJetzt() {
    var soll = H.soll.alleGrundlagen();
    return {
      plugins: H.pluginAbdruecke(),
      gemeinsam: kurz({ regeln: H.regelQuellen, daten: H.anfang, stand: H.stand(), aus: Object.keys(H.aus).sort() }),
      szenarien: jeSzenario(function (d) { return d; }),
      soll: jeSzenario(function (d) { return soll[d.kennung]; })
    };
  }

  /* Die Szenarien, die neu gespielt werden müssen; null heißt alle. */
  function auswahlNach(speicher, huelle, jetzt) {
    var alt = speicher.abdruck, ist = speicher.ergebnis.ist;
    if (speicher.huelle !== huelle || alt.gemeinsam !== jetzt.gemeinsam) return null;
    var namen = Object.keys(Object.assign({}, alt.plugins, jetzt.plugins)), geaendert = [], alle = false;
    namen.forEach(function (k) {
      var a = alt.plugins[k], n = jetzt.plugins[k];
      if (a && n && a.abdruck === n.abdruck) return;
      if (!a || !n || a.ueberall || n.ueberall) alle = true;
      geaendert.push(k);
    });
    if (alle) return null;
    return H.drehbuecher.map(function (d) { return d.kennung; }).filter(function (k) {
      if (alt.szenarien[k] !== jetzt.szenarien[k] || alt.soll[k] !== jetzt.soll[k] || !ist[k]) return true;
      var x = (ist[k].taeter || []).concat(ist[k].gerufen || []);
      return geaendert.some(function (p) { return x.indexOf(p) !== -1; });
    });
  }

  function zeigeStand() {
    var el = document.getElementById("standZeile");
    if (!el) return;
    if (rechne) {
      var teil = fortschritt && fortschritt.gesamt ? { titel: "woran es liegt", fertig: fortschritt.fertig, gesamt: fortschritt.gesamt } : rechne;
      el.textContent = "Rechne nach" + (teil.titel ? ": " + teil.titel : "") + " · " + teil.fertig + " von " + teil.gesamt;
      el.hidden = false;
      return;
    }
    if (einmal) {
      el.textContent = "Spiele neues Plugin einmal ab: " + einmal.titel + " · " + (einmal.fertig + 1) + " von " + einmal.gesamt;
      el.hidden = false;
      return;
    }
    if (!standVon) { el.hidden = true; return; }
    var d = new Date(standVon), jetzt = new Date();
    var p = function (n) { return ("0" + n).slice(-2); };
    var tag = d.toDateString() === jetzt.toDateString() ? "" : p(d.getDate()) + "." + p(d.getMonth() + 1) + ". ";
    el.textContent = "Stand von " + tag + p(d.getHours()) + ":" + p(d.getMinutes());
    el.hidden = false;
  }

  async function ladeSpeicher() {
    if (!MIT_BRUECKE) return { speicher: null, huelle: null };
    try {
      var r = await fetch("/stand-speicher");
      return r.ok ? await r.json() : { speicher: null, huelle: null };
    } catch (e) { return { speicher: null, huelle: null }; }
  }
  /* Die Zahlen am Kasten im Navigator: dieselben, die Play in der Steuerleiste zeigt. */
  function punkteFuerKarte() {
    var ist = ergebnis.ist || {}, faelle = [];
    (H.luecken ? H.luecken.faelle() : []).forEach(function (g) { g.faelle.forEach(function (f) { faelle.push({ schluessel: f.schluessel, satz: f.satz }); }); });
    return {
      faelle: faelle,
      abweichend: Object.keys(ist).filter(function (k) { return auffaellig(ist[k]); }).map(function (k) {
        var a = (ist[k].aenderungen || [])[0];
        return { kennung: k, titel: ist[k].titel, satz: a ? a.satz : ist[k].satz || null };
      })
    };
  }
  function schreibeSpeicher(abdruck, huelle) {
    if (!MIT_BRUECKE) return Promise.resolve();
    standVon = new Date().toISOString();
    return fetch("/stand-speicher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      zeit: standVon, huelle: huelle, abdruck: abdruck, punkte: punkteFuerKarte(),
      ergebnis: { ist: ergebnis.ist, widersprueche: ergebnis.widersprueche, ursachen: ergebnis.ursachen, beruehrt: ergebnis.beruehrt }
    }) }).catch(function () { /* beim nächsten Mal wieder */ });
  }
  function meldeBereit() {
    /* Für den vollen Prüflauf: Die Seite steht, die nächste Prüfung darf starten (Vorgabe des PO, 09.11.). */
    if (!gemeldetBereit && location.protocol === "http:") {
      gemeldetBereit = true;
      fetch("/bereit", { method: "POST" }).catch(function () { /* nur für den Prüflauf */ });
    }
  }
  function nurDiese(ist, auswahl) {
    var out = {};
    auswahl.forEach(function (k) { if (ist[k]) out[k] = ist[k]; });
    return out;
  }
  function gueltigeKennungen() { return H.drehbuecher.map(function (d) { return d.kennung; }); }

  /* Anweisung 45 (b): Ein Plugin, das etwas ändern könnte, aber in keinem Szenario gearbeitet hat, spielt Play nach dem
     Nachrechnen einmal im Hintergrund ab: im ersten Szenario seiner Teil-App, am Ende ergänzt um ein Ereignis, auf das es
     hört (fester Pfad aus seinem Abonnement, beim Sternchen das erste Objekt des Bereichs). Was es dabei anfasst, merkt sich
     Play mit seinem Abdruck; erst eine neue Fassung wird wieder abgespielt. Nichts in Play wartet darauf. */
  var einmal = null;   // { titel, fertig, gesamt } während des Abspielens
  async function einmalAbspielen(meine) {
    if (!MIT_BRUECKE || einmal) return;
    var bekannt = null;
    try { var r = await fetch("/einmal"); bekannt = r.ok ? await r.json() : null; } catch (e) { bekannt = null; }
    if (!bekannt || meine !== durchgang) return;
    var ist = ergebnis.ist || {}, ab = H.pluginAbdruecke(), gespielt = {};
    Object.keys(ist).forEach(function (s) {
      ["taeter", "gerufen", "bedient"].forEach(function (f) { (ist[s][f] || []).forEach(function (k) { gespielt[k] = true; }); });
      Object.keys(ist[s].zugriffe || {}).forEach(function (k) { if (Object.keys(ist[s].zugriffe[k]).length) gespielt[k] = true; });
    });
    var offen = H.aktive().filter(function (k) {
      return H.kannAendern(k) && !gespielt[k] && ab[k] && !(bekannt[k] && bekannt[k].abdruck === ab[k].abdruck);
    });
    if (!offen.length || !H.drehbuecher.length) return;
    einmal = { titel: "", fertig: 0, gesamt: offen.length };
    for (var i = 0; i < offen.length && meine === durchgang; i++) {
      var k = offen[i], ihre = H.teilApp.plugins[k] || H.teilApp.heimat;
      var d = H.drehbuecher.filter(function (x) { return H.teilAppVonSzenario(x.kennung) === ihre; })[0] || H.drehbuecher[0];
      var ereignis = null;
      H.hoertAuf(k).some(function (muster) {
        var m = /^([a-z][\w-]*)\/([^.]+)\.(.+)$/.exec(muster);
        if (!m || m[3] === "*") return false;
        var id = m[2] === "*" ? Object.keys(H.lesend.lies(m[1]) || {})[0] : m[2];
        if (!id) return false;
        ereignis = { zeit: d.bis, objekt: m[1] + "/" + id, aktion: m[3], parameter: {}, erzaehlung: "Play spielt „" + H.titelVon(k) + "“ einmal ab" };
        return true;
      });
      einmal = { titel: H.titelVon(k), fertig: i, gesamt: offen.length };
      zeigeStand();
      await ruhe(meine);
      var zusatz = {};
      if (ereignis) zusatz[d.kennung] = [ereignis];
      var jetzt = await lauf({ auswahl: [d.kennung], zusatz: zusatz });
      var x = (jetzt.drehbuecher || [])[0] || {};
      await fetch("/einmal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        kennung: k, abdruck: ab[k].abdruck, szenario: d.kennung,
        ereignis: ereignis ? ereignis.objekt.split("/")[0] + "/*." + ereignis.aktion : null,
        zugriffe: (x.zugriffe || {})[k] || {}
      }) }).catch(function () { /* beim nächsten Laden wieder */ });
    }
    einmal = null;
    zeigeStand();
  }

  H.verwaltung = {
    /* Wie der letzte Start verlief (für die Prüfung): { art: "voll"|"teil"|"unveraendert", szenarien } */
    letzterStart: function () { return letzterStart; },
    /* Wie viel die Ursachensuche zuletzt gekostet hat: { szenarien (abweichende), laeufe } */
    letzterLauf: function () { return letzterLauf; },

    /* Anweisung 31c: Die Plugins, die in diesen Szenarien gebraucht werden: { kennung: true }. null heißt im Zweifel alle:
       Seit der letzten Messung hat sich ein Plugin geändert, oder ein Szenario ist noch nie gelaufen. Wer zeichnet, bleibt in seiner Teil-App dabei. */
    nurNoetig: function (szenarien) {
      var ist = ergebnis.ist || {}, ab = H.pluginAbdruecke(), noetig = {};
      if (!gemessenBei || gemessenBei !== kurz(ab)) return null;
      if (szenarien.some(function (s) { return !ist[s]; })) return null;
      szenarien.forEach(function (s) {
        ["taeter", "gerufen", "bedient", "anzeigeVon"].forEach(function (f) { (ist[s][f] || []).forEach(function (k) { noetig[k] = true; }); });
      });
      Object.keys(ab).forEach(function (k) {
        var ihre = H.teilApp.plugins[k] || H.teilApp.heimat;
        /* Anweisung 55 (c): Plugins mit beimStart immer, damit das Ergebnis nicht von der Aufteilung abhängt. */
        if (ab[k].beimStart) { noetig[k] = true; return; }
        if (ab[k].ueberall && szenarien.some(function (s) { return H.teilAppVonSzenario(s) === ihre; })) noetig[k] = true;
      });
      return noetig;
    },

    moeglich: function () { return MIT_BRUECKE && lesbar; },
    fertig: function () { return ergebnis.fertig; },

    /* Welche Szenarien ein Wunsch an diesen Plugins betrifft (Anweisung 18 des PO, 09.11.): die, in deren
       Ketten eines davon beim letzten Abspielen gearbeitet hat (gerufen oder etwas geändert). null heißt
       alle: Ein Plugin ist neu, zeichnet nur (das tut es in jedem Szenario) oder die Messung fehlt noch. */
    betroffene: function (kennungen) {
      var ist = ergebnis.ist;
      if (!ergebnis.fertig || !ist || !kennungen || !kennungen.length) return null;
      var aktiv = H.aktive();
      if (kennungen.some(function (k) { return aktiv.indexOf(k) === -1 || !H.reagiert(k); })) return null;
      return H.drehbuecher.filter(function (d) {
        var x = ist[d.kennung];
        if (!x) return true;
        return kennungen.some(function (k) { return (x.taeter || []).indexOf(k) !== -1 || (x.gerufen || []).indexOf(k) !== -1; });
      }).map(function (d) { return d.kennung; });
    },

    /* Liest, was an, aus und im Papierkorb ist; sagt der Hülle, was nicht hängen soll. */
    ladeStand: async function () {
      if (!MIT_BRUECKE) return;
      try {
        var r = await fetch("/plugins");
        if (!r.ok) throw new Error("Antwort " + r.status);
        stand = await r.json();
        lesbar = true;
      } catch (e) {
        lesbar = false;
        return;
      }
      var ausGrund = {};
      /* Ein Plugin aus Wünschen liefert die Brücke gar nicht erst aus; die Grundausstattung hält die Hülle an. */
      stand.aus.forEach(function (k) {
        var w = herkunftVon(k);
        if (!w || w.grund) ausGrund[k] = true;
      });
      H.aus = ausGrund;
    },

    eintraege: function () {
      /* Anweisung 46: In der leer geöffneten Teil-App gibt es noch keine Plugins. */
      if (H.teilApp.leer) return [];
      var bekannt = {};
      stand.wuensche.forEach(function (w) { w.dateien.forEach(function (d) { bekannt[d.name] = true; }); });
      var wuensche = ausWunsch().map(function (w) {
        var erster = (w.wuensche || []).filter(function (x) { return x.wortlaut; })[0];
        return Object.assign({
          kennung: w.kennung, art: "wunsch", name: w.name || w.kennung, an: istAn(w),
          wortlaut: erster ? erster.wortlaut : null, datum: erster ? erster.datum : null, kurz: w.kurz || null
        }, herkunftFelder(w));
      }).reverse();
      /* Per Datei eingespielt: gilt nur, solange die Seite offen ist. */
      var fremd = H.eingespielt.filter(function (e) {
        /* Geänderte Grunddaten und Erwartungen aus Wünschen bringt die Brücke als Datei mit; sie sind kein Plugin. */
        return !bekannt[e.name] && !istDrehbuchDatei(e.name) && e.name !== "grunddaten.js" && !/\.(erwartungen|grunddaten)\.js$/.test(e.name);
      }).map(function (e) {
        return { kennung: e.name, art: "datei", name: e.name, an: true };
      });
      /* Anweisung 49 (e): nur die Plugins der offenen Teil-App, außer bei „alle Bereiche“ */
      return fremd.concat(wuensche, grundEintraege()).filter(function (e) { return e.art === "datei" || H.pluginImBlick(e.kennung); });
    },

    papierkorb: function () {
      if (H.teilApp.leer) return [];
      return stand.papierkorb.filter(function (w) { return H.imBlick(w.teilApp); }).map(function (w) {
        var erster = (w.wuensche || []).filter(function (x) { return x.wortlaut; })[0];
        return { kennung: w.kennung, name: w.name || w.kennung, wortlaut: erster ? erster.wortlaut : null, datum: erster ? erster.datum : null };
      }).reverse();
    },

    /* Abweichende Drehbücher, zusammengefasst nach Ebene (Plan / nur Anzeige) und Ursache.
       Was ein Wunsch, der nur die Anzeige ändert, an der Anzeige ändert, ist keine Abweichung:
       Dafür steht nurAnzeige(). */
    gruppen: function () {
      var ist = ergebnis.ist;
      if (!ist) return [];
      var nur = nurAnzeigeWuensche(), gruppen = {}, reihe = [];
      Object.keys(ist).forEach(function (k) {
        var d = ist[k];
        /* Anweisung 31a: Abweichungen zählen an der Teil-App ihres Szenarios. */
        if (H.teilApp.offen && !H.imBlick(H.teilAppVonSzenario(k))) return;
        ["plan", "anzeige"].forEach(function (e) {
          if (!EBENEN[e](d)) return;
          var u = (ergebnis.ursachen[k] || {})[e] || { art: ergebnis.fertig ? "unbekannt" : "offen" };
          if (e === "anzeige" && u.art === "wunsch" && nur[u.kennung]) return;
          var schluessel = e + "|" + u.art + "|" + (u.kennung || "");
          if (!gruppen[schluessel]) { gruppen[schluessel] = { ebene: e, ursache: u, drehbuecher: [] }; reihe.push(schluessel); }
          var saetze = (d.aenderungen || []).filter(function (x) { return x.ebene === e; }).map(function (x) { return x.satz; });
          if (e === "plan" && d.erwartung) saetze.unshift("Das Szenario erwartet: " + d.erwartung);
          if (!saetze.length && d.satz) saetze.push(d.satz);
          gruppen[schluessel].drehbuecher.push(Object.assign({}, d, { saetze: saetze }));
        });
      });
      /* Plan zuerst: Darüber musst du entscheiden. */
      reihe.sort(function (x, y) { return gruppen[x].ebene === gruppen[y].ebene ? 0 : gruppen[x].ebene === "plan" ? -1 : 1; });
      return reihe.map(function (k) { return gruppen[k]; });
    },

    /* Liegt die Abweichung eines Drehbuchs in der Anzeige an einem Wunsch, der nur die Anzeige ändert? Dessen Kennung, sonst null. */
    nurAnzeigeBei: function (drehbuch) {
      var u = (ergebnis.ursachen[drehbuch] || {}).anzeige;
      return u && u.art === "wunsch" && nurAnzeigeWuensche()[u.kennung] ? u.kennung : null;
    },
    nameVon: function (kennung) { return name(kennung); },

    /* Wünsche, die nur die Anzeige ändern: [{ kennung, drehbuecher: [titel] }] */
    nurAnzeige: function () {
      var nur = nurAnzeigeWuensche();
      return Object.keys(nur).map(function (k) { return { kennung: k, drehbuecher: nur[k] }; });
    },

    /* Drehbücher, in denen ein Plugin etwas tut: Es ändert einen Wert, sendet oder verweigert eine
       Nachricht, oder das Drehbuch wurde zu seinem Wunsch gespielt. Nur anzeigen zählt nicht.
       [{ kennung, titel }] in der Reihenfolge der Auswahl; null, solange noch nicht nachgespielt. */
    drehbuecherVon: function (kennung) {
      var ist = ergebnis.ist;
      if (!ist) return null;
      var w = herkunftVon(kennung), eigene = w ? eigeneDrehbuecher(w) : [], ihre = H.teilAppVon(kennung);
      /* Anweisung 49 (e): „Vorspielen“ an einem Plugin spielt nur Szenarien seiner Teil-App. */
      return H.drehbuecher.filter(function (d) {
        if (H.teilAppVonSzenario(d.kennung) !== ihre) return false;
        var r = ist[d.kennung];
        return eigene.indexOf(d.kennung) !== -1 || !!(r && (r.taeter || []).indexOf(kennung) !== -1);
      }).map(function (d) { return { kennung: d.kennung, titel: d.titel }; });
    },

    /* Drehbücher, die ein Eintrag berührt; null, solange es noch nicht gemessen ist. */
    beruehrt: function (kennung) {
      if (!ergebnis.gemessen) return null;
      var ihre = H.teilAppVon(kennung);
      return (ergebnis.beruehrt[kennung] || []).filter(function (k) { return H.teilAppVonSzenario(typeof k === "string" ? k : k.kennung) === ihre; });
    },

    /* stimmt · weichtAb · nurAnzeige · offen. Weicht ab: Es ist die gemessene Ursache, oder sein eigenes Drehbuch endet anders. */
    letzterStand: function (kennung) {
      if (!ergebnis.gemessen) return "offen";
      if (nurAnzeigeWuensche()[kennung]) return "nurAnzeige";
      var ist = ergebnis.ist, ursache = Object.keys(ergebnis.ursachen).some(function (k) {
        var u = ergebnis.ursachen[k];
        return !!((u.plan && u.plan.kennung === kennung) || (u.anzeige && u.anzeige.kennung === kennung));
      });
      var w = herkunftVon(kennung);
      var eigenes = (w ? eigeneDrehbuecher(w) : []).some(function (d) { return ist[d] && auffaellig(ist[d]); });
      return ursache || eigenes ? "weichtAb" : "stimmt";
    },

    /* Felder, die irgendein Szenario ändert (je Bereich, Sternchen statt Kennung): { feld: true } */
    geaenderteFelder: function () {
      var out = {}, ist = ergebnis.ist || {};
      Object.keys(ist).forEach(function (k) { (ist[k].felder || []).forEach(function (f) { out[f] = true; }); });
      return out;
    },

    /* Ereignisse, deren Kette in irgendeinem Szenario Objekte mit Status ändert, ohne ihn anzuschauen,
       und in keinem Szenario darauf achtet: ["<bereich>/*.<aktion>|<bereich>"] (Fälle ohne Regel) */
    statusBlind: function () {
      var blind = {}, bedacht = {}, ist = ergebnis.ist || {};
      Object.keys(ist).forEach(function (k) {
        (ist[k].blind || []).forEach(function (x) { blind[x] = true; });
        (ist[k].bedacht || []).forEach(function (x) { bedacht[x] = true; });
      });
      H.statusBlind().forEach(function (x) { blind[x] = true; });
      H.statusBlind(true).forEach(function (x) { bedacht[x] = true; });
      return Object.keys(blind).filter(function (x) { return !bedacht[x]; }).sort();
    },

    /* Wird ein Plugin in irgendeinem Szenario gerufen (Abonnent oder Prüfung)? */
    gerufen: function (kennung) {
      var ist = ergebnis.ist || {};
      return Object.keys(ist).some(function (k) { return (ist[k].gerufen || []).indexOf(kennung) !== -1; });
    },

    widerspruecheVon: function (kennung) {
      return widerspruchSaetze().filter(function (w) { return w.an.indexOf(kennung) !== -1; }).map(function (w) { return w.satz; });
    },

    schalte: function (kennung, an) { fuehreAus("/plugin/" + kennung + (an ? "/an" : "/aus")); },
    loesche: function (kennung) { fuehreAus("/plugin/" + kennung + "/loeschen"); },
    stelleWiederHer: function (kennung) { fuehreAus("/plugin/" + kennung + "/wiederherstellen"); },
    zurueck: function (kennung) { fuehreAus("/plugin/" + kennung + "/zurueck"); },

    /* „So ist es jetzt richtig“: Der neue Endstand wird Sollergebnis. */
    uebernimm: function (kennungen) {
      kennungen.forEach(function (k) {
        var d = ergebnis.ist && ergebnis.ist[k];
        if (d && d.endstand) H.soll.merke(k, d.endstand);
      });
      this.pruefe();
    },

    /* „Ursachen werden ermittelt: 7 von 20 Läufen, noch etwa 12 s“ oder null */
    fortschrittSatz: function () {
      if (!fortschritt || !fortschritt.gesamt) return null;
      var f = fortschritt, satz = "Ursachen werden ermittelt: " + f.fertig + " von " + f.gesamt + " Läufen";
      if (f.fertig) {
        var rest = Math.ceil((Date.now() - f.beginn) / f.fertig * (f.gesamt - f.fertig) / 1000);
        satz += rest > 0 ? ", noch etwa " + rest + " s" : "";
      }
      return satz;
    },

    pruefe: async function (wie) {
      var meine = ++durchgang, beimStart = !!(wie && wie.start);
      fortschritt = null;
      await this.ladeStand();
      var geladen = await ladeSpeicher(), abdruck = abdruckJetzt();
      var speicher = beimStart ? geladen.speicher : null, auswahl = null, alt = null;
      if (speicher) {
        /* Der gespeicherte Stand steht sofort da, das Nachrechnen ergänzt ihn. */
        alt = speicher.ergebnis;
        ergebnis = { fertig: true, gemessen: true, ist: alt.ist, widersprueche: alt.widersprueche || [], ursachen: alt.ursachen || {}, beruehrt: alt.beruehrt || {} };
        standVon = speicher.zeit;
        H.waechter.nachgespielt(ergebnis.ist);
        H.leiste.zeichne();
        H.player.zeichneListe();
        zeigeStand();
        H.punkte.nachStand();
        auswahl = auswahlNach(speicher, geladen.huelle, abdruck);
        if (auswahl && !auswahl.length) {
          letzterStart = { art: "unveraendert", szenarien: 0 };
          if (JSON.stringify(speicher.abdruck) !== JSON.stringify(abdruck) || !speicher.punkte) schreibeSpeicher(abdruck, geladen.huelle).then(H.punkte.neu);
          meldeBereit();
          einmalAbspielen(meine);
          return;
        }
        ergebnis.fertig = false;
      }
      rechne = { titel: "", fertig: 0, gesamt: auswahl ? auswahl.length : H.drehbuecher.length };
      zeigeStand();
      H.punkte.rechnet(auswahl || H.drehbuecher.map(function (d) { return d.kennung; }));
      await ruhe(meine);
      if (meine !== durchgang) return;
      var jetzt = await lauf({ mitEndstand: true, auswahl: auswahl || undefined, fortschritt: function (f, g, titel) {
        if (meine !== durchgang || !rechne) return;
        rechne = { titel: titel || rechne.titel, fertig: f, gesamt: g };
        zeigeStand();
      } });
      if (meine !== durchgang) return;
      var neu = nachKennung(jetzt), gueltig = gueltigeKennungen();
      /* Bis die neue Messung steht, bleibt die alte stehen: Die Liste soll nicht bei jedem Durchlauf flackern. */
      ergebnis.fertig = false;
      if (auswahl) {
        var zusammen = {};
        gueltig.forEach(function (k) { if (neu[k] || alt.ist[k]) zusammen[k] = neu[k] || alt.ist[k]; });
        ergebnis.ist = zusammen;
        /* Was ein geändertes Szenario oder Plugin gesagt hatte, sagt der neue Lauf selbst. */
        var gemeinsam = (alt.widersprueche || []).concat(jetzt.widersprueche || []), gesehen = {};
        ergebnis.widersprueche = gemeinsam.filter(function (w) {
          var s = kurz(w);
          if (gesehen[s]) return false;
          gesehen[s] = true;
          return true;
        });
      } else {
        ergebnis.ist = neu;
        ergebnis.widersprueche = jetzt.widersprueche || [];
      }
      H.waechter.nachgespielt(ergebnis.ist);
      merkeGearbeitet(neu, auswahl ? gueltig : null);
      H.leiste.zeichne();
      H.player.zeichneListe();

      /* Ursachen nur, wo etwas abweicht, und nur für diese Szenarien. Ohne Abweichung läuft hier nichts. */
      var frisch = auswahl ? nurDiese(ergebnis.ist, auswahl) : ergebnis.ist;
      var abweichend = Object.keys(frisch).filter(function (k) { return auffaellig(frisch[k]); });
      var plan = abweichend.length ? aufgabenFuerStand() : { an: [], reihe: [], proben: [] };
      plan.auswahl = abweichend;
      /* Anweisung 27 und 28d: Zuerst nur die Wünsche, die in einem abweichenden Szenario wirklich etwas getan haben (geändert,
         auf eine Bedienung geantwortet, gezeichnet, was abweicht, oder es ist ihr eigenes Szenario). Nur diese werden weggelassen, alle anderen bleiben
         dabei, sonst fiele die Schuld eines zeichnenden Plugins auf ein früheres. Die volle Reihe und das Abgeschaltete
         laufen nur für die Szenarien, die das nicht erklärt. */
      var kandidaten = plan.an.filter(function (w) {
        return abweichend.some(function (k) {
          var r = frisch[k];
          return (r.taeter || []).indexOf(w.kennung) !== -1 || (r.bedient || []).indexOf(w.kennung) !== -1 || (r.anzeigeVon || []).indexOf(w.kennung) !== -1 || eigeneDrehbuecher(w).indexOf(k) !== -1;
        });
      });
      var zuerst = kandidaten.map(function (w, i) {
        return { kennung: w.kennung, wie: { eingespielt: ohnePlugins(kandidaten.slice(i)), auswahl: abweichend } };
      });
      plan.zuerst = zuerst;
      await nacheinander(zuerst, meine);
      if (meine !== durchgang) return;
      var unerklaert = abweichend.filter(function (k) { return !erklaert(k, zuerst, frisch); });
      if (unerklaert.length) {
        var rest = plan.reihe.concat(plan.proben);
        rest.forEach(function (a) { a.wie.auswahl = unerklaert; });
        await nacheinander(rest, meine);
        if (meine !== durchgang) return;
      }
      var werte = werteAus(frisch, plan);
      await einzelnGemessen(werte, plan, meine);
      if (meine !== durchgang) return;
      if (auswahl) {
        Object.keys(alt.ursachen || {}).forEach(function (k) {
          if (auswahl.indexOf(k) === -1 && gueltig.indexOf(k) !== -1) werte.ursachen[k] = alt.ursachen[k];
        });
      }
      ergebnis.beruehrt = werte.beruehrt;
      ergebnis.ursachen = werte.ursachen;
      ergebnis.gemessen = true;
      ergebnis.fertig = true;
      gemessenBei = kurz(abdruck.plugins);
      letzterLauf = { szenarien: abweichend.length, laeufe: fortschritt ? fortschritt.gesamt : 0 };
      if (beimStart) letzterStart = { art: auswahl ? "teil" : "voll", szenarien: auswahl ? auswahl.length : gueltig.length };
      rechne = null;
      fortschritt = null;
      schreibeSpeicher(abdruck, geladen.huelle).then(function () { H.punkte.rechnet(null); H.punkte.nachStand(); });
      zeigeStand();
      meldeBereit();
      H.leiste.zeichne();
      einmalAbspielen(meine);
    }
  };
})();
