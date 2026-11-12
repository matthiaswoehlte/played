/* Feste Hülle, Teil 9: Plugin-Leiste und Zähler der Abweichungen.
   Beide sitzen in einer eigenen Spalte neben der Bühne, der Prototyp bleibt ganz sichtbar.
   Auf- und Zuklappen und Filter sind Bequemlichkeit des Betrachters: Sie liegen im Browser,
   und zwar erst, wenn jemand etwas verändert hat. */
(function () {
  "use strict";
  var H = window.Huelle;
  var SCHLUESSEL = "play/leiste/1";
  var RUECKKEHR = "play/rueckkehr/1";
  var WORTLAUT_KURZ = 110;

  var FILTER = [
    { kennung: "alle", text: "All", passt: function () { return true; } },
    { kennung: "an", text: "On", passt: function (e) { return e.an; } },
    { kennung: "aus", text: "Off", passt: function (e) { return !e.an; } },
    { kennung: "abweichend", text: "Deviates", passt: function (e) { return e.an && H.verwaltung.letzterStand(e.kennung) === "weichtAb"; } },
    { kennung: "wunsch", text: "From request", passt: function (e) { return e.art === "wunsch" || e.art === "umbau"; } },
    { kennung: "grund", text: "Base equipment", passt: function (e) { return e.art === "grund"; } }
  ];

  var ansicht = { leiste: false, abweichungen: false, filter: "alle", suche: "" };
  var zu = {};             // Ebene und Ursache → Liste der Drehbücher eingeklappt
  var entwurf = {};        // „kennung|art“ → { offen, text }: Angefangenes übersteht das Neuzeichnen
  var el = {};
  var gezeichnet = {};     // Inhalt je Bereich: Unverändertes wird nicht neu gebaut, sonst ginge ein Klick ins Leere

  function ladeAnsicht() {
    try { Object.assign(ansicht, JSON.parse(localStorage.getItem(SCHLUESSEL)) || {}); }
    catch (e) { /* ohne Speicher bleibt alles eingeklappt */ }
  }
  function merkeAnsicht() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(ansicht)); }
    catch (e) { /* gilt dann nur bis zum Neuladen */ }
  }

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
  function kuerze(text) {
    return text.length > WORTLAUT_KURZ ? text.slice(0, WORTLAUT_KURZ).replace(/\s+\S*$/, "") + " …" : text;
  }
  function datum(iso) {
    return iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  }
  function anzahl(n, eins, viele) { return n + " " + (n === 1 ? eins : viele); }

  /* ---------- Spalte ---------- */
  function zeigeSpalte() {
    el.leiste.hidden = !ansicht.leiste;
    el.abweichungen.hidden = !ansicht.abweichungen || !H.verwaltung.gruppen().length;
    el.verstoesse.hidden = !(H.waechter && H.waechter.sichtbar());
    var offen = !el.leiste.hidden || !el.abweichungen.hidden || !el.verstoesse.hidden || !!(H.luecken && H.luecken.sichtbar()) || !!(H.kette && H.kette.sichtbar());
    el.spalte.hidden = !offen;
    document.body.classList.toggle("verwaltung-offen", offen);
    el.pluginKnopf.setAttribute("aria-expanded", String(ansicht.leiste));
    el.pluginKnopf.classList.toggle("an", ansicht.leiste);
    el.abweichKnopf.setAttribute("aria-expanded", String(!el.abweichungen.hidden));
    el.abweichKnopf.classList.toggle("an", !el.abweichungen.hidden);
    el.verstossKnopf.setAttribute("aria-expanded", String(!el.verstoesse.hidden));
    el.verstossKnopf.classList.toggle("an", !el.verstoesse.hidden);
  }

  function schalteLeiste(offen) {
    ansicht.leiste = offen;
    merkeAnsicht();
    zeigeSpalte();
  }

  /* ---------- Abweichungen ----------
     Je Drehbuch: was sich geändert hat (Flug, Arbeit, Person), ob der Plan betroffen ist oder nur
     die Anzeige, und der Weg: Folge deines Wunsches → „So ist es jetzt richtig“, sonst „Stimmt nicht“
     am Plugin, vorbefüllt mit dem Satz. Ein Wunsch, der nur die Anzeige ändert, ist keine Abweichung. */
  var EBENE = { plan: "Plan", anzeige: "Display only" };
  var EBENE_ERKLAERT = {
    plan: "Assignment, time, conflict or status is different.",
    anzeige: "The plan is the same; only what the daily plan shows is different."
  };

  function eintragVon(kennung) {
    return kennung ? H.verwaltung.eintraege().concat(H.verwaltung.papierkorb()).filter(function (x) { return x.kennung === kennung; })[0] || null : null;
  }
  function nenne(e) { return e ? "“" + (e.wortlaut ? kuerze(e.wortlaut) : e.name) + "”" : ""; }

  function ursacheSatz(g) {
    var u = g.ursache, n = g.drehbuecher.length, e = eintragVon(u.kennung);
    var enden = n === 1 ? "1 scenario ends" : "" + n + " scenarios end";
    if (u.art === "wunsch") return (e && e.wortlaut ? "Since your request " : "Since ") + nenne(e) + " " + enden + " differently.";
    if (u.art === "aus") return "Since “" + e.name + "” was switched off, " + enden + " differently.";
    if (u.art === "geloescht") return "Since “" + e.name + "” is in the bin, " + enden + " differently.";
    if (u.art === "variante") return "With the chosen variant, " + enden + " differently from last time.";
    if (u.art === "offen") return (n === 1 ? "1 scenario ends" : n + " scenarios end") + " differently. " + (H.verwaltung.fortschrittSatz() || "The cause is still being found") + ".";
    return (n === 1 ? "1 scenario ends" : n + " scenarios end") + " differently, and no plugin explains it.";
  }

  /* Der Weg in einem Satz */
  function wegSatz(g) {
    var u = g.ursache;
    if (u.art === "wunsch") return "If this is the result of your request as you want it: “This is right now”. Otherwise “Not right”, and the sentence goes to the plugin.";
    if (u.art === "aus" || u.art === "geloescht") return "If it should be like this: “This is right now”. Otherwise “Go to plugin” and switch it back on or restore it.";
    return "If it should be like this: “This is right now”.";
  }

  function schluessel(g) { return g.ebene + "|" + g.ursache.art + "|" + (g.ursache.kennung || ""); }
  function uebernehmbar(d) { return !!d.endstand; }

  function zeichneGruppe(g) {
    var kasten = knoten("div", "abweichung ebene-" + g.ebene);
    var k = schluessel(g);
    kasten.dataset.ursache = g.ursache.kennung || g.ursache.art;
    kasten.dataset.ebene = g.ebene;

    var marke = knoten("div", "abweichung-ebene " + g.ebene, EBENE[g.ebene]);
    marke.title = EBENE_ERKLAERT[g.ebene];
    kasten.appendChild(marke);
    var kopf = knoten("button", "abweichung-satz", ursacheSatz(g));
    kopf.type = "button";
    kopf.setAttribute("aria-expanded", String(!zu[k]));
    kopf.addEventListener("click", function () { zu[k] = !zu[k]; zeichneAbweichungen(); });
    kasten.appendChild(kopf);
    kasten.appendChild(knoten("div", "abweichung-weg", EBENE_ERKLAERT[g.ebene] + " " + wegSatz(g)));

    var plugin = g.ursache.kennung && eintragVon(g.ursache.kennung);
    var fuss = knoten("div", "knopfzeile");
    var alle = g.drehbuecher.filter(uebernehmbar).map(function (d) { return d.kennung; });
    if (alle.length > 1 && H.verwaltung.moeglich()) {
      fuss.appendChild(knopf("All: This is right now", function () { H.verwaltung.uebernimm(alle); }, "richtig"));
    }
    if (plugin) fuss.appendChild(knopf("Go to plugin", function () { H.leiste.zeige(g.ursache.kennung); }));
    if (fuss.children.length) kasten.appendChild(fuss);

    if (!zu[k]) {
      var liste = knoten("ul", "abweichung-liste");
      g.drehbuecher.forEach(function (d) {
        var z = knoten("li");
        z.dataset.drehbuch = d.kennung;
        z.appendChild(knoten("strong", null, d.titel));
        var saetze = knoten("ul", "abweichung-saetze");
        d.saetze.forEach(function (t) { saetze.appendChild(knoten("li", null, t)); });
        z.appendChild(saetze);
        var knoepfe = knoten("div", "knopfzeile");
        if (uebernehmbar(d) && H.verwaltung.moeglich()) {
          knoepfe.appendChild(knopf("This is right now", function () { H.verwaltung.uebernimm([d.kennung]); }, "richtig"));
        }
        if (g.ursache.art === "wunsch" && plugin && plugin.an && H.verwaltung.moeglich()) {
          knoepfe.appendChild(knopf("Not right", function () {
            H.leiste.stimmtNicht(g.ursache.kennung, "In scenario “" + d.titel + "”: " + d.saetze.join("; ") + ". This should not happen: ");
          }, "stimmt-nicht"));
        }
        if (knoepfe.children.length) z.appendChild(knoepfe);
        liste.appendChild(z);
      });
      kasten.appendChild(liste);
    }
    return kasten;
  }

  /* Ein Satz je Wunsch, der nur die Anzeige ändert; zählt nicht als Abweichung. */
  function nurAnzeigeSatz(w) {
    return "Your request " + nenne(eintragVon(w.kennung)) + " only changes the display.";
  }

  function unveraendert(bereich, inhalt) {
    var text = JSON.stringify(inhalt);
    if (gezeichnet[bereich] === text) return true;
    gezeichnet[bereich] = text;
    return false;
  }

  function zeichneAbweichungen() {
    var gruppen = H.verwaltung.gruppen(), nur = H.verwaltung.nurAnzeige();
    var inhalt = gruppen.map(function (g) {
      return [schluessel(g), ursacheSatz(g), g.drehbuecher.map(function (d) { return [d.kennung, d.saetze, !!d.endstand]; })];
    });
    if (unveraendert("abweichungen", [inhalt, nur, zu, H.verwaltung.fortschrittSatz()])) return;
    var gezaehlt = {};
    gruppen.forEach(function (g) { g.drehbuecher.forEach(function (d) { gezaehlt[d.kennung] = true; }); });
    var n = Object.keys(gezaehlt).length;
    var imPlan = gruppen.some(function (g) { return g.ebene === "plan"; });
    el.abweichKnopf.hidden = !n;
    el.abweichKnopf.textContent = (n === 1 ? "1 scenario ends differently" : n + " scenarios end differently") + (imPlan ? "" : " (display only)");
    el.abweichKnopf.classList.toggle("nur-anzeige", !imPlan);
    el.abweichungen.textContent = "";
    var kopf = knoten("div", "leiste-kopf");
    kopf.appendChild(knoten("h2", null, "Deviations"));
    var schliessen = knopf("×", function () { ansicht.abweichungen = false; merkeAnsicht(); zeigeSpalte(); });
    schliessen.title = "Collapse";
    schliessen.setAttribute("aria-label", "Collapse deviations");
    kopf.appendChild(schliessen);
    el.abweichungen.appendChild(kopf);
    gruppen.forEach(function (g) { el.abweichungen.appendChild(zeichneGruppe(g)); });
    nur.forEach(function (w) {
      var z = knoten("div", "abweichung-nur-anzeige", nurAnzeigeSatz(w));
      z.dataset.wunsch = w.kennung;
      el.abweichungen.appendChild(z);
    });
  }

  /* ---------- Leiste ---------- */
  function herkunftZeile(e) {
    if (e.art === "grund") return (e.variante || e.platz ? "Base equipment, variant" : "Base equipment") + ((e.wortlaute || []).length ? ", extended by your request" : "");
    if (e.art === "datei") return "Applied from a file, valid until reload";
    if (!e.datum) return "From a rebuild without its own request";
    return "Request from " + datum(e.datum) + (e.wortlaute.length > 1 ? ", plus " + anzahl(e.wortlaute.length - 1, "weiterer", "weitere") : "");
  }

  function standAbzeichen(e) {
    if (e.art === "datei") return null;
    if (!e.an) return knoten("span", "abzeichen aus", "off");
    var s = H.verwaltung.letzterStand(e.kennung);
    if (s === "weichtAb") return knoten("span", "abzeichen abweichend", "deviates");
    if (s === "nurAnzeige") return knoten("span", "abzeichen nur-anzeige", "display only");
    if (s === "stimmt") return knoten("span", "abzeichen stimmt", "correct");
    return knoten("span", "abzeichen", "being checked");
  }

  function drehbuchZeile(e) {
    var liste = H.verwaltung.beruehrt(e.kennung);
    if (e.art === "datei") return null;
    if (!liste) return knoten("div", "plugin-dreh", H.verwaltung.fortschrittSatz() || "Finding scenarios …");
    if (!liste.length) return knoten("div", "plugin-dreh", "Changes no result of any scenario");
    var d = knoten("details", "plugin-dreh");
    d.appendChild(knoten("summary", null, "Touches " + anzahl(liste.length, "scenario", "scenarios")));
    var ul = knoten("ul");
    liste.forEach(function (x) { ul.appendChild(knoten("li", null, x.titel)); });
    d.appendChild(ul);
    return d;
  }

  /* Nur die Drehbücher, in denen dieses Plugin etwas tut (nicht alle, deren Bild es mitzeichnet) */
  function vorspielen(e) { H.player.spielePlugin(e.kennung); }

  /* Mehrere Plugins wollen dieselbe Bedienung übernehmen: ein Satz, an jedem beteiligten Plugin
     derselbe, und je Plugin ein Knopf. Bis der PO wählt, gilt die feste Reihenfolge (das erste). */
  function nameVon(kennung) {
    var x = H.verwaltung.eintraege().filter(function (y) { return y.kennung === kennung; })[0];
    return x ? x.name : H.titelVon(kennung);
  }
  function streitSatz(x) {
    var namen = x.plugins.map(function (k) { return "“" + nameVon(k) + "”"; });
    var liste = namen.slice(0, -1).join(", ") + " and " + namen[namen.length - 1];
    var anfang = H.bedienungSatz(x) || ("For the same action" + (x.beispiel ? " (z. B. “" + x.beispiel + "”)" : ""));
    return anfang + ", " + liste + " want to take this over.";
  }
  function streitBlock(x) {
    var satz = streitSatz(x);
    var entschieden = !!x.wahl && x.plugins.indexOf(x.wahl.gewaehlt) !== -1;
    /* Anweisung 37: Gelb, solange der PO wählen muss; danach nur noch ein blasser Vermerk. */
    var d = knoten("div", "plugin-bedienung " + (entschieden ? "ist-entschieden" : "wartet-auf-wahl"));
    d.appendChild(knoten("div", null, satz + " " + (entschieden
      ? "On " + datum(x.wahl.datum) + " you chose: this is taken over by “" + nameVon(x.wahl.gewaehlt) + "”."
      : "Until you choose, this is taken over by “" + nameVon(x.plugins[0]) + "”.")));
    if (H.verwaltung.moeglich()) {
      var zeile = knoten("div", "knopfzeile");
      x.plugins.forEach(function (k) {
        var gilt = entschieden && x.wahl.gewaehlt === k;
        var b = knopf("“" + nameVon(k) + "” takes over", function () {
          b.disabled = true;
          H.bedienung.waehle(x, k, satz, nameVon(k)).catch(function (err) { H.player.melde(err.message, "hinweis"); });
        }, "bedienung-waehlen");
        b.dataset.waehlt = k;
        if (gilt) { b.disabled = true; b.classList.add("ist-gewaehlt"); b.setAttribute("aria-pressed", "true"); }
        zeile.appendChild(b);
      });
      d.appendChild(zeile);
    }
    return d;
  }

  function zeichneEintrag(e) {
    var k = knoten("article", "plugin" + (e.an ? "" : " ist-aus"));
    k.dataset.plugin = e.kennung;

    var kopf = knoten("div", "plugin-kopf");
    kopf.appendChild(knoten("h3", null, e.name));
    var abz = standAbzeichen(e);
    if (abz) kopf.appendChild(abz);
    k.appendChild(kopf);

    k.appendChild(knoten("div", "plugin-herkunft", herkunftZeile(e)));
    (e.wortlaute || []).forEach(function (w) {
      k.appendChild(knoten("blockquote", null, w.wortlaut));
      herkunftZusatz(k, e.kennung, w);
    });
    if (e.umbau) k.appendChild(knoten("div", "plugin-notiz", "Plus a rebuild without its own request."));
    if (!(e.wortlaute || []).length && e.kurz) k.appendChild(knoten("div", "plugin-notiz", e.kurz));

    /* Entscheidungen des PO aus dem Abgleich mit dem Wunsch, an der geltenden Fassung */
    var gilt = (e.fassungen || []).filter(function (f) { return f.aktuell; })[0];
    ((gilt && gilt.entscheidungen) || []).filter(function (x) { return x.wahl === "behalten"; }).forEach(function (x) {
      k.appendChild(knoten("div", "plugin-notiz plugin-entscheidung", (x.art === "mehr" ? "Kept" : "Left as is") + " on " + datum(x.datum) + ": " + x.was));
    });
    if (H.verwaltung.letzterStand(e.kennung) === "nurAnzeige") k.appendChild(knoten("div", "plugin-notiz nur-anzeige", "Your request only changes the display."));
    var dreh = drehbuchZeile(e);
    if (dreh) k.appendChild(dreh);
    var tut = H.verwaltung.drehbuecherVon(e.kennung);
    if (e.an && e.art !== "datei" && tut && !tut.length) k.appendChild(knoten("div", "plugin-notiz", "No scenario shows this, please try it yourself."));

    var fassungen = fassungenBlock(e);
    if (fassungen) k.appendChild(fassungen);
    H.verwaltung.widerspruecheVon(e.kennung).forEach(function (s) {
      k.appendChild(knoten("div", "plugin-widerspruch", s));
    });
    H.bedienung.streitVon(e.kennung).forEach(function (x) { k.appendChild(streitBlock(x)); });

    var fuss = knoten("div", "knopfzeile");
    if (H.verwaltung.moeglich() && e.art !== "datei") {
      if (e.platz) {
        fuss.appendChild(knoten("span", "plugin-notiz", "Chosen with the switch at the top"));
      } else {
        fuss.appendChild(knopf(e.an ? "Switch off" : "Switch on", function () { H.verwaltung.schalte(e.kennung, !e.an); }, "schalter"));
      }
    }
    var eigene = H.verwaltung.drehbuecherVon(e.kennung);
    if (e.an && e.art !== "datei" && (!eigene || eigene.length)) {
      var vk = knopf("Play", function () { vorspielen(e); }, "vorspielen");
      if (eigene) vk.title = eigene.map(function (d) { return d.titel; }).join(" · ");
      fuss.appendChild(vk);
    }
    if (H.verwaltung.moeglich() && e.vorige) {
      fuss.appendChild(knopf("Back to the previous version", function () { H.verwaltung.zurueck(e.kennung); }, "zurueck"));
    }
    if (H.verwaltung.moeglich() && e.art === "wunsch") {
      fuss.appendChild(knopf("Delete", function () { H.verwaltung.loesche(e.kennung); }, "loeschen"));
    }
    k.appendChild(fuss);
    if (H.verwaltung.moeglich() && e.art !== "datei" && e.an) {
      k.appendChild(kiFeld(e, "aendern", "Change", "What should be different about “" + e.name + "”?"));
      k.appendChild(kiFeld(e, "stimmt-nicht", "Not right", "What is wrong? Best right after a run, then the steps are sent along."));
    }
    return k;
  }

  /* Zum Wortlaut eines Wunsches bzw. einer Fassung: welcher Teil, Anhänge (zum Öffnen), Rückfragen mit Antwort */
  function herkunftZusatz(ziel, kennung, w) {
    if (w.teil) ziel.appendChild(knoten("div", "plugin-notiz", "Part " + w.teil.nr + " of " + w.teil.von + ": " + w.teil.text));
    if ((w.anhaenge || []).length) ziel.appendChild(H.anhaenge.verweise(kennung, w.anhaenge));
    (w.rueckfragen || []).forEach(function (r) {
      var d = knoten("div", "plugin-rueckfrage");
      d.appendChild(knoten("div", null, "Question: " + r.rueckfrage));
      if ((r.teile || []).length) {
        var ol = knoten("ol");
        r.teile.forEach(function (t) { ol.appendChild(knoten("li", null, t)); });
        d.appendChild(ol);
      }
      var antwort = [r.soMachen ? "“Do it like this”" : null, r.antwort ? "“" + r.antwort + "”" : null].filter(Boolean).join(" and ");
      if (antwort) d.appendChild(knoten("div", null, "Your answer" + (r.datum ? " on " + datum(r.datum) : "") + ": " + antwort));
      if ((r.anhaenge || []).length) d.appendChild(H.anhaenge.verweise(kennung, r.anhaenge));
      ziel.appendChild(d);
    });
  }

  /* Fassungen: jede mit dem auslösenden Satz im Wortlaut; die geltende ist markiert. */
  function fassungenBlock(e) {
    var liste = e.fassungen || [];
    if (liste.length < 2) return null;
    var d = knoten("details", "plugin-fassungen");
    d.appendChild(knoten("summary", null, "Version " + e.fassung + " of " + e.fassungen.length));
    var ul = knoten("ul");
    liste.forEach(function (f) {
      var li = knoten("li", f.aktuell ? "gilt" : f.gilt ? "" : "verworfen");
      li.dataset.fassung = f.nr;
      li.appendChild(knoten("strong", null, "Version " + f.nr + (f.aktuell ? " · current" : "")));
      var art = { wunsch: "Request", aendern: "Changed", "stimmt-nicht": "Corrected", zuschnitt: "Trimmed", grund: "Base equipment", vertrag: "Switched to the bus contract" }[f.art] || "";
      li.appendChild(knoten("span", "plugin-notiz", art + (f.datum ? " on " + datum(f.datum) : "")));
      if (f.wortlaut) {
        li.appendChild(knoten("blockquote", null, f.wortlaut));
        herkunftZusatz(li, e.kennung, f);
      } else if (f.kurz) li.appendChild(knoten("div", "plugin-notiz", f.kurz));
      ul.appendChild(li);
    });
    d.appendChild(ul);
    return d;
  }

  /* Feld für einen Satz an die KI, der genau dieses Plugin betrifft */
  function kiFeld(e, art, titel, platzhalter) {
    var schluessel = e.kennung + "|" + art;
    var stand = entwurf[schluessel] || (entwurf[schluessel] = { offen: false, text: "" });
    stand.anhaenge = stand.anhaenge || [];   // überlebt ein Neuzeichnen der Leiste wie der Text
    var d = knoten("details", "plugin-ki " + art);
    d.open = stand.offen;
    d.addEventListener("toggle", function () { stand.offen = d.open; });
    d.appendChild(knoten("summary", null, titel));
    var form = knoten("form");
    var feld = knoten("textarea");
    feld.rows = 2;
    feld.placeholder = platzhalter;
    feld.value = stand.text;
    feld.addEventListener("input", function () { stand.text = feld.value; });
    form.appendChild(feld);
    var los = knoten("button", null, "Send");
    los.type = "submit";
    los.title = "Strg+Enter";
    form.appendChild(los);
    var anh = H.anhaenge.an(feld, stand.anhaenge);
    form.appendChild(anh.zeile);
    H.wunsch.strgEnter(feld, form);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = feld.value.trim();
      if (!text) return;
      anh.holen().then(function (anhaenge) {
        delete entwurf[schluessel];
        if (art === "aendern") H.wunsch.aendere(e.kennung, text, anhaenge);
        else H.wunsch.stimmtNicht(e.kennung, text, anhaenge);
        feld.value = "";
        anh.leeren();
        d.open = false;
      });
    });
    d.appendChild(form);
    return d;
  }

  function passtSuche(e) {
    var s = ansicht.suche.trim().toLowerCase();
    return !s || [e.name, e.wortlaut, e.kurz].some(function (t) { return t && t.toLowerCase().indexOf(s) !== -1; });
  }

  function zeichneFilter() {
    el.filter.textContent = "";
    FILTER.forEach(function (f) {
      var b = knopf(f.text, function () { ansicht.filter = f.kennung; merkeAnsicht(); H.leiste.zeichne(); });
      b.dataset.filter = f.kennung;
      b.classList.toggle("an", ansicht.filter === f.kennung);
      el.filter.appendChild(b);
    });
  }

  function zeichnePapierkorb() {
    var liste = H.verwaltung.papierkorb();
    el.korb.hidden = !liste.length;
    el.korbTitel.textContent = "Bin (" + liste.length + ")";
    el.korbListe.textContent = "";
    liste.forEach(function (w) {
      var z = knoten("article", "plugin ist-aus");
      z.dataset.korb = w.kennung;
      z.appendChild(knoten("h3", null, w.name));
      if (w.wortlaut) z.appendChild(knoten("blockquote", null, w.wortlaut));
      var fuss = knoten("div", "knopfzeile");
      fuss.appendChild(knopf("Restore", function () { H.verwaltung.stelleWiederHer(w.kennung); }, "wiederherstellen"));
      z.appendChild(fuss);
      el.korbListe.appendChild(z);
    });
  }

  function zeichneListe() {
    var alle = H.verwaltung.eintraege();
    var filter = FILTER.filter(function (f) { return f.kennung === ansicht.filter; })[0] || FILTER[0];
    var sichtbar = alle.filter(function (e) { return filter.passt(e) && passtSuche(e); });
    el.anzahl.textContent = String(alle.length);

    var hinweis = !H.verwaltung.moeglich();
    el.hinweis.hidden = !hinweis;
    if (hinweis) {
      el.hinweis.textContent = H.wunsch.moeglich()
        ? "Managing only works after a restart: please close the Play window and double-click “Play starten”."
        : "Managing only works via “Play starten”.";
    }

    var inhalt = sichtbar.map(function (e) {
      return [e, H.verwaltung.letzterStand(e.kennung), H.verwaltung.beruehrt(e.kennung), H.verwaltung.widerspruecheVon(e.kennung), H.verwaltung.drehbuecherVon(e.kennung), H.bedienung.streitVon(e.kennung)];
    });
    zeichneFilter();
    zeichnePapierkorb();
    /* Wer gerade in ein Feld schreibt, wird nicht gestört; nach dem Verlassen wird nachgezeichnet. */
    if (el.liste.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") {
      gezeichnet.liste = null;
      return;
    }
    if (unveraendert("liste", [inhalt, entwurf, H.verwaltung.fortschrittSatz()])) return;
    var scroll = el.leiste.scrollTop;
    el.liste.textContent = "";
    sichtbar.forEach(function (e) { el.liste.appendChild(zeichneEintrag(e)); });
    if (!sichtbar.length) el.liste.appendChild(knoten("div", "plugin-notiz", "Nothing found."));
    el.leiste.scrollTop = scroll;
  }

  H.leiste = {
    start: function () {
      /* Anweisung 49 (e): Schalter „alle Bereiche“, nur wenn es mehr als eine Teil-App mit Prototyp gibt */
      var ab = document.getElementById("alleBereicheKnopf");
      if (ab) {
        ab.hidden = !H.mehrereTeilApps() || H.teilApp.leer;
        ab.classList.toggle("an", H.alleBereiche);
        ab.setAttribute("aria-pressed", H.alleBereiche ? "true" : "false");
        ab.addEventListener("click", function () {
          try { localStorage.setItem("play/alle-bereiche", H.alleBereiche ? "0" : "1"); } catch (e) { return; }
          H.leiste.merkeFuerNeuladen();
          location.reload();
        });
      }
      el.spalte = document.getElementById("verwaltung");
      el.leiste = document.getElementById("leiste");
      el.abweichungen = document.getElementById("abweichungen");
      el.verstoesse = document.getElementById("verstoesse");
      el.verstossKnopf = document.getElementById("verstossKnopf");
      el.pluginKnopf = document.getElementById("pluginKnopf");
      el.abweichKnopf = document.getElementById("abweichKnopf");
      el.anzahl = document.getElementById("pluginAnzahl");
      el.suche = document.getElementById("pluginSuche");
      el.filter = document.getElementById("pluginFilter");
      el.hinweis = document.getElementById("leisteHinweis");
      el.liste = document.getElementById("pluginListe");
      el.korb = document.getElementById("papierkorb");
      el.korbTitel = el.korb.querySelector("summary");
      el.korbListe = document.getElementById("papierkorbListe");

      ladeAnsicht();
      el.suche.value = ansicht.suche;
      el.pluginKnopf.addEventListener("click", function () { schalteLeiste(!ansicht.leiste); });
      document.getElementById("leisteZu").addEventListener("click", function () { schalteLeiste(false); });
      el.abweichKnopf.addEventListener("click", function () {
        ansicht.abweichungen = !ansicht.abweichungen;
        merkeAnsicht();
        zeigeSpalte();
      });
      el.liste.addEventListener("focusout", function () { setTimeout(function () { H.leiste.zeichne(); }, 0); });
      el.suche.addEventListener("input", function () {
        ansicht.suche = el.suche.value;
        merkeAnsicht();
        zeichneListe();
      });
      this.zeichne();
      this.rueckkehr();
    },

    /* Welche Bereiche der Spalte offen sind; der Wächter fragt das nach jedem Neuzeichnen an. */
    spalte: function () { if (el.liste) zeigeSpalte(); },
    /* Anweisung 30c: öffnet die Stelle, an der der PO über dieses Szenario entscheidet. */
    zeigeAbweichung: function (kennung) {
      ansicht.abweichungen = true;
      zu = {};
      merkeAnsicht();
      zeichneAbweichungen();
      zeigeSpalte();
      return Array.prototype.filter.call(el.abweichungen.querySelectorAll("[data-drehbuch]"), function (x) { return x.dataset.drehbuch === kennung; })[0] || null;
    },

    zeichne: function () {
      if (!el.liste) return;
      zeichneListe();
      zeichneAbweichungen();
      zeigeSpalte();
      if (H.luecken) H.luecken.zeichne();
    },

    /* „Stimmt nicht“ an einem Plugin öffnen, vorbefüllt mit dem Satz aus den Abweichungen */
    stimmtNicht: function (kennung, text) {
      entwurf[kennung + "|stimmt-nicht"] = { offen: true, text: text };
      gezeichnet.liste = null;
      this.zeige(kennung);
      var feld = el.spalte.querySelector('[data-plugin="' + kennung + '"] .plugin-ki.stimmt-nicht textarea');
      if (feld) { feld.focus(); feld.setSelectionRange(feld.value.length, feld.value.length); }
    },

    /* Öffnet die Leiste an einem Plugin; ein Filter darf es nicht verstecken. */
    zeige: function (kennung) {
      ansicht.filter = "alle";
      ansicht.suche = "";
      el.suche.value = "";
      ansicht.leiste = true;
      merkeAnsicht();
      this.zeichne();
      var k = el.spalte.querySelector('[data-plugin="' + kennung + '"], [data-korb="' + kennung + '"]');
      if (!k) return;
      if (k.dataset.korb) el.korb.open = true;
      k.scrollIntoView({ block: "center" });
      k.classList.remove("hervor");
      void k.offsetWidth;
      k.classList.add("hervor");
    },

    /* Nach einer Verwaltungsaktion lädt die Seite neu; Wahl und Platz in der Liste bleiben. */
    merkeFuerNeuladen: function () {
      try {
        sessionStorage.setItem(RUECKKEHR, JSON.stringify({ wahl: H.player.drehbuch(), scroll: el.leiste.scrollTop, korb: el.korb.open }));
      } catch (e) { /* dann beginnt die Seite oben */ }
    },
    gemerkteWahl: function () {
      try { return (JSON.parse(sessionStorage.getItem(RUECKKEHR)) || {}).wahl || null; }
      catch (e) { return null; }
    },
    rueckkehr: function () {
      try {
        var r = JSON.parse(sessionStorage.getItem(RUECKKEHR));
        sessionStorage.removeItem(RUECKKEHR);
        if (r) { el.leiste.scrollTop = r.scroll; el.korb.open = !!r.korb; }
      } catch (e) { /* dann beginnt die Seite oben */ }
    }
  };
})();
