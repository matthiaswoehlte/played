/* Plugin: Doppelklick auf den Namen eines Mitarbeiters im Tagesplan öffnet ein Overlay mit seinen
   Daten: Name, Eintrittsdatum, Qualifikationen und Status. Die Bedienung kennt nur Klicks, darum
   merkt der erste Klick den Mitarbeiter vor. Danach liegt eine halbe Sekunde lang eine unsichtbare Fläche
   über dem Namen (die Frist läuft allein im Stil, ohne Uhr im Zustand); nur ein Klick auf diese Fläche
   öffnet das Overlay. Ist sie weg, zählt der nächste Klick wieder als erster.
   Die Eintrittsdaten sind erfunden wie der ganze Tag. Der Status folgt aus der Abwesenheit,
   eine Krankmeldung zeigt sich also auch im geöffneten Overlay sofort. */
(function () {
  var KARTE = "kennzahlen/mitarbeiterkarte";
  var WAHL = "kennzahlen/mitarbeiterwahl";
  var EINTRITT = {
    "MA-01": "01.04.2012", "MA-02": "15.09.2015", "MA-03": "01.03.2010", "MA-04": "01.07.2018",
    "MA-05": "01.10.2016", "MA-06": "15.02.2019", "MA-07": "01.06.2021", "MA-08": "01.04.2014",
    "MA-09": "01.08.2017", "MA-10": "15.05.2020", "MA-11": "01.11.2013", "MA-12": "01.02.2022",
    "MA-20": "01.05.2009", "MA-21": "15.03.2016", "MA-22": "01.09.2011",
    "MA-30": "01.06.2015", "MA-31": "15.10.2018",
    "MA-40": "01.03.2017", "MA-41": "01.12.2019", "MA-42": "15.04.2021", "MA-43": "01.09.2023"
  };

  function statusText(m) {
    if (!m.abwesend) return "Anwesend";
    var grund = m.grund || "abwesend";
    return grund.charAt(0).toUpperCase() + grund.slice(1) + (m.abwesendAb ? " ab " + m.abwesendAb : "");
  }

  function zeile(h, name, wert, klasse) {
    return '<div class="pl-mkarte-zeile"><span class="pl-mkarte-feld">' + h.esc(name) + "</span>" +
      '<span class="' + (klasse || "") + '">' + h.esc(wert) + "</span></div>";
  }

  Huelle.plugin({
    kennung: "mitarbeiter-karte",
    titel: "Mitarbeiterdaten per Doppelklick",
    anzeige: [KARTE + "/mitarbeiter", WAHL + "/mitarbeiter", WAHL + "/klick"],
    beimStart: function (h) {
      h.alle("mitarbeiter").forEach(function (m) {
        h.setze("mitarbeiter/" + m.kennung + "/eintritt", EINTRITT[m.kennung] || null);
      });
      h.setze(KARTE + "/mitarbeiter", null);
      h.setze(WAHL + "/klick", 0);
      h.setze(WAHL + "/mitarbeiter", null);
    },
    abonniert: {
      "kennzahlen/mitarbeiterwahl.vormerken": function (m, h) {
        h.setze(WAHL + "/mitarbeiter", m.parameter.mitarbeiter);
        /* Jeder erste Klick zeichnet neu, auch auf denselben Namen: Das startet die Frist von vorn. */
        h.setze(WAHL + "/klick", (h.lies(WAHL + "/klick") || 0) + 1);
      },
      "kennzahlen/mitarbeiterkarte.anzeigen": function (m, h) {
        h.setze(KARTE + "/mitarbeiter", m.parameter.mitarbeiter);
        h.setze(WAHL + "/mitarbeiter", null);
      }
    },
    ergaenzt: {
      gantt: {
        neuBei: ["kennzahlen/mitarbeiterkarte.geaendert", "kennzahlen/mitarbeiterwahl.geaendert"],
        zeichne: function (el, h) {
          var vorgemerkt = h.lies(WAHL + "/mitarbeiter");
          var namensfeld = vorgemerkt ? el.querySelector('.pl-zeile[data-pfad="mitarbeiter/' + vorgemerkt + '"] .pl-name') : null;
          if (namensfeld) namensfeld.insertAdjacentHTML("beforeend", '<i class="pl-mzweit" data-zweiter="ja"></i>');
          var id = h.lies(KARTE + "/mitarbeiter");
          var m = id ? h.lies("mitarbeiter/" + id) : null;
          if (!m) return;
          el.insertAdjacentHTML("beforeend",
            '<div class="pl-mkarte-ebene" data-pfad="' + KARTE + '" aria-label="' + h.esc("die Karte mit den Mitarbeiterdaten von " + m.name) + '">' +
            '<div class="pl-mkarte-grund"></div>' +
            '<div class="pl-mkarte">' +
            '<span class="pl-mkarte-zu" title="Schließen">×</span>' +
            "<h3>" + h.esc(m.name) + " <small>" + h.esc(m.kennung) + "</small></h3>" +
            zeile(h, "Name", m.name) +
            zeile(h, "Eintritt in die Firma", m.eintritt || "nicht bekannt") +
            zeile(h, "Qualifikation", (m.qualifikationen || []).join(", ")) +
            zeile(h, "Status", statusText(m), m.abwesend ? "pl-mkarte-krank" : "pl-mkarte-da") +
            "</div></div>");
        }
      }
    },
    bedienungen: [
      {
        kennung: "mitarbeiter-doppelklick",
        titel: "Doppelklick auf den Namen: Mitarbeiterdaten öffnen",
        sicht: "gantt",
        art: "klicken",
        fasst: ".pl-name, .pl-mzweit",
        ereignis: function (g, h) {
          var m = h.lies(g.pfad);
          if (!m) return null;
          if (g.daten.zweiter) {
            return {
              objekt: KARTE, aktion: "anzeigen",
              parameter: { mitarbeiter: m.kennung },
              erzaehlung: "Disponent öffnet die Mitarbeiterdaten von " + m.name
            };
          }
          return { objekt: WAHL, aktion: "vormerken", parameter: { mitarbeiter: m.kennung }, erzaehlung: null };
        }
      },
      {
        kennung: "mitarbeiter-karte-schliessen",
        titel: "Mitarbeiterdaten schließen",
        sicht: "gantt",
        art: "klicken",
        fasst: ".pl-mkarte-grund, .pl-mkarte-zu",
        ereignis: function (g, h) {
          var id = h.lies(KARTE + "/mitarbeiter");
          var m = id ? h.lies("mitarbeiter/" + id) : null;
          return {
            objekt: KARTE, aktion: "anzeigen",
            parameter: { mitarbeiter: null },
            erzaehlung: "Disponent schließt die Mitarbeiterdaten" + (m ? " von " + m.name : "")
          };
        }
      }
    ],
    beschreibe: {
      "mitarbeiter/*/eintritt": function () { return null; },
      "kennzahlen/mitarbeiterwahl/mitarbeiter": function () { return null; },
      "kennzahlen/mitarbeiterwahl/klick": function () { return null; },
      "kennzahlen/mitarbeiterkarte/mitarbeiter": function (u, h) {
        var m = u.neu ? h.lies("mitarbeiter/" + u.neu) : null;
        return m ? "Die Mitarbeiterdaten von " + m.name + " sind jetzt geöffnet" : "Die Mitarbeiterdaten sind jetzt geschlossen";
      }
    },
    stil: [
      ".pl-name { position: relative; cursor: pointer; user-select: none; }",
      ".pl-mzweit { position: absolute; top: 0; right: 0; bottom: 0; left: 0; animation: pl-mzweit-frist .5s step-end forwards; }",
      "@keyframes pl-mzweit-frist { from { visibility: visible; } to { visibility: hidden; } }",
      ".pl-mkarte-ebene { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 60; display: flex; align-items: center; justify-content: center; }",
      ".pl-mkarte-grund { position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: rgba(0,0,0,.45); }",
      ".pl-mkarte { position: relative; min-width: 320px; max-width: 440px; padding: 16px 20px; border: 1px solid var(--kante); border-radius: 10px; background: #0c2d38; color: var(--text); font-size: 13.5px; line-height: 1.4; box-shadow: 0 10px 30px rgba(0,0,0,.6); }",
      ".pl-mkarte h3 { margin: 0 24px 10px 0; font-size: 16px; font-weight: 600; }",
      ".pl-mkarte h3 small { color: var(--dim); font-size: 12px; font-weight: 400; }",
      ".pl-mkarte-zu { position: absolute; top: 8px; right: 12px; color: var(--dim); font-size: 20px; line-height: 1; cursor: pointer; user-select: none; }",
      ".pl-mkarte-zu:hover { color: var(--text); }",
      ".pl-mkarte-zeile { display: flex; gap: 12px; padding: 4px 0; border-top: 1px solid var(--kante); }",
      ".pl-mkarte-feld { flex: 0 0 140px; color: var(--dim); }",
      ".pl-mkarte-krank { color: var(--koralle); font-weight: 600; }",
      ".pl-mkarte-da { color: var(--gruen); font-weight: 600; }"
    ].join("\n")
  });
})();
