/* Plugin: Suchfeld im Kopf des Tagesplans, auf der Höhe des Titels „Tagesplan“ direkt daneben.
   Markiert werden Mitarbeiter, deren Name oder Kurzform den Suchbegriff oder ein Wort daraus
   enthält, und Balken, deren Flugnummer den Suchbegriff enthält (Leerzeichen zählen nicht,
   „xc810“ findet „XC 810“). Mit Enter auf demselben Begriff, oder mit ▾, springt die Suche zum
   nächsten Treffer. Die Treffer laufen von oben nach unten durch den Plan, in jeder Zeile zuerst
   der Mitarbeiter und dann seine Balken nach Beginn. Suchbegriff und aktueller Treffer stehen
   unter kennzahlen/suche und dienen nur der Anzeige. */
(function () {
  var SUCHE = "kennzahlen/suche";
  var zuletzt = null;   // zuletzt gezeichneter Stand der Suche, um nur bei Änderung zu springen

  function norm(t) { return String(t || "").toLowerCase().replace(/[\s.\-]+/g, ""); }

  function passtName(m, begriff) {
    var texte = [norm(m.name), norm(m.kennung)];
    var teile = [norm(begriff)].concat(String(begriff).split(/\s+/).map(norm).filter(function (t) { return t.length >= 3; }));
    return teile.some(function (t) {
      return t && texte.some(function (x) { return x.indexOf(t) !== -1; });
    });
  }
  function passtFlug(a, begriff) {
    var t = norm(begriff);
    return !!t && norm(a.flug).indexOf(t) !== -1;
  }

  /* Alle Treffer in Planreihenfolge, als Pfade */
  function treffer(h, begriff) {
    if (!norm(begriff)) return [];
    var auftraege = h.alle("auftraege"), out = [];
    h.alle("mitarbeiter").forEach(function (m) {
      if (passtName(m, begriff)) out.push("mitarbeiter/" + m.kennung);
      auftraege.filter(function (a) { return a.mitarbeiter === m.kennung && passtFlug(a, begriff); })
        .sort(function (x, y) { return h.minuten(x.start) - h.minuten(y.start) || (x.kennung < y.kennung ? -1 : 1); })
        .forEach(function (a) { out.push("auftraege/" + a.kennung); });
    });
    return out;
  }

  function stelle(nr, n) { return n ? ((nr % n) + n) % n : 0; }

  function nameVon(h, pfad) {
    var o = h.lies(pfad);
    if (!o) return "";
    if (pfad.indexOf("mitarbeiter/") === 0) return o.name + " (" + o.kennung + ")";
    var m = o.mitarbeiter ? h.lies("mitarbeiter/" + o.mitarbeiter) : null;
    return o.flug + " " + o.arbeit + (m ? " with " + m.name : "");
  }

  /* Die Nachricht „suchen“: neuer Begriff beginnt beim ersten Treffer, derselbe Begriff geht weiter. */
  function suchen(h, wert, weiter) {
    var begriff = String(wert || "").trim();
    var alt = h.lies(SUCHE + "/begriff") || "", altNr = h.lies(SUCHE + "/nr") || 0;
    if (!begriff) {
      if (!alt) return null;
      return { objekt: SUCHE, aktion: "suchen", parameter: { begriff: "", nr: 0 }, erzaehlung: "Dispatcher clears the search in the daily plan" };
    }
    var liste = treffer(h, begriff), n = liste.length;
    var nochmal = weiter || begriff === alt;
    var nr = nochmal && n ? stelle(altNr + 1, n) : 0;
    var erz = n
      ? "Dispatcher searches " + (nochmal && begriff === alt ? "again for" : "for") + " “" + begriff + "”: " +
        nameVon(h, liste[nr]) + " (" + (nr + 1) + " of " + n + ")"
      : "Dispatcher searches for ”" + begriff + "”: no match";
    return { objekt: SUCHE, aktion: "suchen", parameter: { begriff: begriff, nr: nr }, erzaehlung: erz };
  }

  Huelle.plugin({
    kennung: "plan-suche",
    titel: "Search in the daily plan",
    besitzt: ["kennzahlen/suche/begriff", "kennzahlen/suche/nr"],
    anzeige: ["kennzahlen/suche/begriff", "kennzahlen/suche/nr"],
    beimStart: function (h) {
      h.setze(SUCHE + "/begriff", "");
      h.setze(SUCHE + "/nr", 0);
    },
    abonniert: {
      "kennzahlen/suche.suchen": function (m, h) {
        h.setze(SUCHE + "/begriff", m.parameter.begriff || "");
        h.setze(SUCHE + "/nr", m.parameter.nr || 0);
      }
    },
    ergaenzt: {
      gantt: {
        neuBei: ["kennzahlen/suche.geaendert"],
        zeichne: function (el, h) {
          var rahmen = el.querySelector(".pl-rahmen");
          if (!rahmen) return;
          var begriff = h.lies(SUCHE + "/begriff") || "", nr = h.lies(SUCHE + "/nr") || 0;
          var liste = treffer(h, begriff), n = liste.length, i = stelle(nr, n);
          var akt = n ? liste[i] : null;
          var stand = !begriff ? "" : n ? (i + 1) + " of " + n : "no match";

          var titel = el.querySelector(".pl-kopf h2");
          (titel || rahmen).insertAdjacentHTML(titel ? "afterend" : "beforebegin",
            '<div class="pl-suche" data-pfad="' + SUCHE + '">' +
            '<input class="pl-suche-feld" type="search" placeholder="Search agent or flight" value="' + h.esc(begriff) + '">' +
            '<span class="pl-suche-stand' + (begriff && !n ? " pl-suche-leer" : "") + '">' + h.esc(stand) + "</span>" +
            (n > 1 ? '<span class="pl-suche-weiter" title="Next match (Enter)">▾</span>' : "") +
            "</div>");

          var ziel = null;
          liste.forEach(function (p) {
            var t = p.indexOf("mitarbeiter/") === 0
              ? el.querySelector('.pl-zeile[data-pfad="' + p + '"]')
              : el.querySelector('.pl-bahn .pl-balken[data-pfad="' + p + '"]');
            if (!t) return;
            t.classList.add("pl-suchtreffer");
            if (p === akt) { t.classList.add("pl-suchaktuell"); ziel = t; }
          });

          var jetzt = begriff + "|" + nr;
          if (zuletzt !== null && jetzt !== zuletzt) {
            var feld = el.querySelector(".pl-suche-feld");
            if (feld && feld.focus) {
              feld.focus({ preventScroll: true });
              if (feld.setSelectionRange) try { feld.setSelectionRange(begriff.length, begriff.length); } catch (e) {}
            }
            if (ziel && ziel.scrollIntoView) (ziel.closest(".pl-zeile") || ziel).scrollIntoView({ block: "nearest" });
          }
          zuletzt = jetzt;
        }
      }
    },
    bedienungen: [
      {
        kennung: "plan-suchen",
        titel: "Search in the daily plan (Enter: next match)",
        sicht: "gantt",
        art: "eingeben",
        fasst: ".pl-suche-feld",
        ereignis: function (g, h) { return suchen(h, g.wert, false); }
      },
      {
        kennung: "plan-suche-weiter",
        titel: "To the next search match",
        sicht: "gantt",
        art: "klicken",
        fasst: ".pl-suche-weiter",
        ereignis: function (g, h) { return suchen(h, h.lies(SUCHE + "/begriff"), true); }
      }
    ],
    beschreibe: {
      "kennzahlen/suche/begriff": function (u) {
        return u.neu ? "The daily plan is now searched for ”" + u.neu + "”" : "The search in the daily plan is now empty";
      },
      "kennzahlen/suche/nr": function () { return null; }
    },
    stil: [
      ".pl-suche { display: flex; align-items: center; gap: 8px; margin: 0 auto 0 14px; }",
      ".pl-suche-feld { width: 220px; padding: 1px 8px; border: 1px solid var(--kante); border-radius: 6px; background: var(--glas); color: var(--text); font-size: 12px; outline: none; }",
      ".pl-suche-feld:focus { border-color: var(--akzent); }",
      ".pl-suche-stand { color: var(--dim); font-size: 11.5px; white-space: nowrap; }",
      ".pl-suche-stand.pl-suche-leer { color: var(--koralle); }",
      ".pl-suche-weiter { padding: 0 7px; border: 1px solid var(--kante); border-radius: 6px; color: var(--text); font-size: 12px; cursor: pointer; user-select: none; }",
      ".pl-suche-weiter:hover { border-color: var(--akzent); }",
      ".pl-zeile.pl-suchtreffer .pl-name { background: rgba(233,196,118,.22); border-radius: 4px; }",
      ".pl-zeile.pl-suchtreffer .pl-name b { color: var(--gold); }",
      ".pl-zeile.pl-suchaktuell { box-shadow: inset 0 0 0 2px var(--gold); }",
      ".pl-balken.pl-suchtreffer { outline: 2px solid var(--gold); outline-offset: 1px; }",
      ".pl-balken.pl-suchaktuell { outline-width: 3px; filter: brightness(1.35); box-shadow: 0 0 10px 3px var(--gold); z-index: 4; }"
    ].join("\n")
  });
})();
