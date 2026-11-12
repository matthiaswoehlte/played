/* Plugin: Ein Klick auf einen Eintrag der Konfliktliste lässt die Beteiligten in 2,5 Sekunden
   zweimal aufblinken, nur mit goldenem Rand; Helligkeit und Hintergrund bleiben, wie sie sind. Wer beteiligt ist, steht in der Nachricht „hervorheben“; jede Ansicht lässt
   leuchten, was sie davon gerade zeigt. Das Leuchten ist reine Darstellung und ändert keinen
   Wert im Zustand. */
(function () {
  var DAUER = 2500;   // so lange leuchtet es in ms
  var TAKT = { duration: DAUER / 4, iterations: 4, direction: "alternate", easing: "ease-in-out" };
  /* Zwei Blinker: aus → an → aus → an → aus (vier Hälften, abwechselnd). Kein Filter und keine
     Hintergrundfarbe, damit nichts anderes dunkler oder getönt wirkt. */
  var OBJEKT = [
    { boxShadow: "0 0 0 0 transparent", zIndex: 5 },
    { boxShadow: "0 0 0 3px var(--gold), 0 0 14px 4px var(--gold)", zIndex: 5 }
  ];
  var ZEILE = [
    { boxShadow: "inset 0 0 0 0 transparent" },
    { boxShadow: "inset 0 0 0 2px var(--gold)" }
  ];

  /* Leuchten in einer Ansicht. Wird die Ansicht währenddessen neu gezeichnet, läuft es an
     derselben Stelle weiter und dauert dadurch nicht länger. */
  function leuchten() {
    var sicht = null, pfade = [], laeufe = [];

    function zeige(ms) {
      laeufe = [];
      pfade.forEach(function (pfad) {
        var t = sicht.querySelector('[data-pfad="' + pfad + '"]');
        if (!t || !t.animate) return;
        var lauf = t.animate(t.classList.contains("pl-zeile") ? ZEILE : OBJEKT, TAKT);
        lauf.currentTime = ms;
        laeufe.push(lauf);
      });
    }

    return {
      neuGezeichnet: function (el) {
        var lauf = laeufe[0];
        var ms = lauf && lauf.playState === "running" ? lauf.currentTime : null;
        sicht = el;
        if (ms !== null) { zeige(ms); return; }
        pfade = [];
        laeufe = [];
      },
      starte: function (neu) {
        laeufe.forEach(function (lauf) { lauf.cancel(); });
        pfade = neu;
        if (!sicht) return;
        zeige(0);
        var t = laeufe[0] ? laeufe[0].effect.target : null;
        if (t && t.scrollIntoView) (t.closest(".pl-zeile") || t).scrollIntoView({ block: "nearest" });
      }
    };
  }

  /* Die Pfade aller Beteiligten: erst die Aufträge, dann ihre Mitarbeiter */
  function beteiligte(h, k) {
    var kennungen = k.mit ? [k.auftrag, k.mit] : [k.auftrag];
    var pfade = kennungen.map(function (id) { return "auftraege/" + id; });
    kennungen.forEach(function (id) {
      var m = h.lies("auftraege/" + id).mitarbeiter;
      if (m && pfade.indexOf("mitarbeiter/" + m) === -1) pfade.push("mitarbeiter/" + m);
    });
    return pfade;
  }

  function wasVon(h, k) {
    var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
    return a.flug + " " + a.arbeit + (b ? " und " + b.flug + " " + b.arbeit : "");
  }

  var imPlan = leuchten(), inListe = leuchten();

  Huelle.plugin({
    kennung: "konflikt-leuchten",
    titel: "Beteiligte aufleuchten lassen",
    ergaenzt: {
      gantt: { zeichne: function (el) { imPlan.neuGezeichnet(el); } },
      "nicht-zugewiesen": { zeichne: function (el) { inListe.neuGezeichnet(el); } }
    },
    abonniert: {
      "konflikte/*.hervorheben": function (m) {
        imPlan.starte(m.parameter.objekte);
        inListe.starte(m.parameter.objekte);
      }
    },
    bedienungen: [
      {
        kennung: "konflikt-hervorheben",
        titel: "Beteiligte eines Konflikts hervorheben",
        sicht: "konfliktzaehler",
        art: "klicken",
        fasst: ".pl-konflikt",
        ereignis: function (g, h) {
          var k = (h.lies("kennzahlen/konflikte/liste") || [])
            .filter(function (x) { return x.pfad === g.pfad; })[0];
          if (!k) return null;
          return {
            objekt: g.pfad, aktion: "hervorheben",
            parameter: { objekte: beteiligte(h, k) },
            erzaehlung: "Disponent wählt Konflikt: " + k.art + " " + wasVon(h, k)
          };
        }
      }
    ],
    stil: [
      ".pl-konflikt { cursor: pointer; }",
      ".pl-konflikt:hover { box-shadow: inset 0 0 0 1px var(--akzent); }"
    ].join("\n")
  });
})();
