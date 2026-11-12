/* Wunsch 012: Ein Klick auf einen Eintrag der Konfliktliste lässt die Beteiligten 2,5 Sekunden
   aufleuchten. Der Wunsch ändert drei vorhandene Plugins, weil Liste, Balken und offene Aufträge
   in drei Ansichten liegen. Deshalb stehen hier drei Aufrufe von Huelle.plugin, je einer unter
   der eigenen Kennung „konfliktzaehler“, „gantt“ und „nicht-zugewiesen“.
   Wer an einem Konflikt beteiligt ist, weiß nur der Konfliktzähler: Er nennt die Pfade in der
   Nachricht „hervorheben“. Die Ansichten lassen leuchten, was sie davon gerade zeigen.
   Das Leuchten ist reine Darstellung und ändert keinen Wert im Zustand. */
(function () {
  var DAUER = 2500;   // so lange leuchtet es in ms
  var TAKT = { duration: DAUER / 4, iterations: 4, direction: "alternate", easing: "ease-in-out" };
  var OBJEKT = [
    { boxShadow: "0 0 0 1px var(--gold)", filter: "brightness(1.1)", zIndex: 5 },
    { boxShadow: "0 0 0 3px var(--gold), 0 0 14px 4px var(--gold)", filter: "brightness(1.7)", zIndex: 5 }
  ];
  var ZEILE = [
    { backgroundColor: "rgba(233,196,118,.10)", boxShadow: "inset 0 0 0 1px var(--gold)" },
    { backgroundColor: "rgba(233,196,118,.38)", boxShadow: "inset 0 0 0 2px var(--gold)" }
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
      stand: function () {
        var lauf = laeufe[0];
        return lauf && lauf.playState === "running" ? lauf.currentTime : null;
      },
      weiter: function (el, ms) {
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

  /* Plugin Konfliktzähler. Rechnet wie die letzte Prototyp-Fassung: Überlappungen,
     Kapazitätslücken, fehlende Qualifikation, außerhalb der Anwesenheit.
     Gezählt wird, wenn eine Kette von Ereignissen durch ist, damit der Zähler nur
     den Endstand zeigt und nicht die Zwischenschritte. Jeder Konflikt trägt einen festen Pfad.
     Ein Klick auf den Zähler klappt die Liste der Konflikte auf und zu, ein Klick auf einen
     Eintrag hebt die Beteiligten hervor. */
  (function () {
    function anwesendFuer(h, m, a) {
      if (!m.abwesend) return true;
      if (m.abwesendAb === null) return false;
      return h.minuten(a.ende) <= h.minuten(m.abwesendAb);
    }
    function ueberschneiden(h, a, b) {
      return h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende);
    }
    function hatQuali(m, arbeit) { return m.qualifikationen.indexOf(arbeit) !== -1; }

    /* Fester Pfad eines Konflikts, unabhängig von der Reihenfolge der beiden Aufträge */
    function pfadVon(art, a, b) {
      return "konflikte/" + art + "-" + (b ? [a, b].sort().join("-") : a);
    }

    function finde(h) {
      var auftraege = h.alle("auftraege"), leute = h.alle("mitarbeiter"), out = [];
      function person(id) { return leute.filter(function (m) { return m.kennung === id; })[0] || null; }

      auftraege.forEach(function (a, i) {
        if (!a.mitarbeiter) return;
        auftraege.slice(i + 1).forEach(function (b) {
          if (b.mitarbeiter === a.mitarbeiter && ueberschneiden(h, a, b)) {
            out.push({ art: "Overlap", auftrag: a.kennung, mit: b.kennung, pfad: pfadVon("ueberlappung", a.kennung, b.kennung) });
          }
        });
      });

      auftraege.forEach(function (a) {
        var eigener = a.mitarbeiter ? person(a.mitarbeiter) : null;
        if (eigener && anwesendFuer(h, eigener, a) && hatQuali(eigener, a.arbeit)) return;
        var ersatz = leute.some(function (m) {
          if (!anwesendFuer(h, m, a) || !hatQuali(m, a.arbeit)) return false;
          return !auftraege.some(function (o) {
            return o.kennung !== a.kennung && o.mitarbeiter === m.kennung && ueberschneiden(h, o, a);
          });
        });
        if (!ersatz) out.push({ art: "Capacity gap", auftrag: a.kennung, pfad: pfadVon("kapazitaet", a.kennung) });
      });

      auftraege.forEach(function (a) {
        var p = a.mitarbeiter ? person(a.mitarbeiter) : null;
        if (!p) return;
        if (!hatQuali(p, a.arbeit)) out.push({ art: "Missing qualification", auftrag: a.kennung, pfad: pfadVon("qualifikation", a.kennung) });
        if (!anwesendFuer(h, p, a) || h.minuten(a.start) < h.minuten(p.schichtStart) || h.minuten(a.ende) > h.minuten(p.schichtEnde)) {
          out.push({ art: "Outside shift or presence", auftrag: a.kennung, pfad: pfadVon("anwesenheit", a.kennung) });
        }
      });
      return out;
    }

    function schluessel(k) { return k.art + "|" + k.auftrag + "|" + (k.mit || ""); }

    /* Ein Satz zum ersten neu entstandenen Konflikt */
    function grund(h, neu, alt) {
      var bekannt = alt.map(schluessel);
      var k = neu.filter(function (x) { return bekannt.indexOf(schluessel(x)) === -1; })[0];
      if (!k) return "";
      var a = h.lies("auftraege/" + k.auftrag);
      var was = a.flug + " " + a.arbeit;
      if (k.art === "Capacity gap") return ": nobody is available any more for " + was + "";
      if (k.art === "Overlap") return ": " + was + " overlaps";
      if (k.art === "Missing qualification") return ": for " + was + " is missing the qualification";
      return ": " + was + " is outside shift or presence";
    }

    function nameVon(h, a) {
      var m = a.mitarbeiter ? h.lies("mitarbeiter/" + a.mitarbeiter) : null;
      return m ? m.name : "";
    }

    /* Flug und Arbeit der Aufträge eines Konflikts */
    function wasVon(h, k) {
      var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
      return a.flug + " " + a.arbeit + (b ? " and " + b.flug + " " + b.arbeit : "");
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

    /* Ein Eintrag der Liste: Art, Wer und Was, darunter die Zeit */
    function eintrag(h, k) {
      var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
      var wer = nameVon(h, a), zeit;
      if (b) {
        var von = Math.max(h.minuten(a.start), h.minuten(b.start)) === h.minuten(a.start) ? a.start : b.start;
        var bis = Math.min(h.minuten(a.ende), h.minuten(b.ende)) === h.minuten(a.ende) ? a.ende : b.ende;
        zeit = von + "–" + bis;
      } else {
        zeit = a.start + "–" + a.ende;
      }
      return '<div class="pl-konflikt" data-pfad="' + h.esc(k.pfad) + '">' +
        '<div class="pl-konfliktkopf"><b>' + h.esc(k.art) + "</b>" + (wer ? " " + h.esc(wer) : "") + "</div>" +
        "<div>" + h.esc(wasVon(h, k)) + "</div>" +
        '<div class="pl-konfliktzeit">' + h.esc(zeit) + "</div></div>";
    }

    function nachBeginn(h, liste) {
      return liste.slice().sort(function (x, y) {
        return h.minuten(h.lies("auftraege/" + x.auftrag).start) - h.minuten(h.lies("auftraege/" + y.auftrag).start);
      });
    }

    Huelle.plugin({
      kennung: "konfliktzaehler",
      titel: "Conflicts",
      beimStart: function (h) {
        var liste = finde(h);
        h.setze("kennzahlen/konflikte/wert", liste.length);
        h.setze("kennzahlen/konflikte/liste", liste);
        h.setze("kennzahlen/konflikte/offen", false);
      },
      abonniert: {
        "bus/takt.ruhe": function (m, h) {
          var alt = h.lies("kennzahlen/konflikte/liste") || [];
          var neu = finde(h);
          if (JSON.stringify(alt) === JSON.stringify(neu)) return;
          h.sende({
            objekt: "kennzahlen/konflikte", aktion: "veraendert",
            parameter: { von: alt.length, auf: neu.length, liste: neu },
            erzaehlung: alt.length === neu.length ? null
              : "Conflicts " + alt.length + " → " + neu.length + grund(h, neu, alt)
          });
        },
        "kennzahlen/konflikte.veraendert": function (m, h) {
          h.setze("kennzahlen/konflikte/wert", m.parameter.auf);
          h.setze("kennzahlen/konflikte/liste", m.parameter.liste);
        },
        "kennzahlen/konflikte.anzeigen": function (m, h) {
          h.setze("kennzahlen/konflikte/offen", m.parameter.offen);
        }
      },
      ansicht: {
        ort: "seite",
        rang: 1,
        neuBei: ["kennzahlen/konflikte.geaendert", "auftraege/*.geaendert"],
        zeichne: function (el, h) {
          var bisher = el.querySelector(".pl-konfliktliste");
          var rollstand = bisher ? bisher.scrollTop : 0;

          var wert = h.lies("kennzahlen/konflikte/wert");
          var offen = h.lies("kennzahlen/konflikte/offen");
          var liste = "";
          if (offen) {
            var eintraege = nachBeginn(h, h.lies("kennzahlen/konflikte/liste") || [])
              .map(function (k) { return eintrag(h, k); }).join("");
            liste = '<div class="pl-konfliktliste">' +
              (eintraege || '<div class="pl-leer">No conflicts.</div>') + "</div>";
          }
          el.innerHTML = '<div class="pl-zaehler" data-pfad="kennzahlen/konflikte">' +
            '<span class="pl-zahl' + (wert ? " pl-warn" : "") + '">' + wert + "</span>" +
            '<span class="pl-zahltext">Conflicts ' + (offen ? "▾" : "▸") + "</span></div>" + liste;

          var neu = el.querySelector(".pl-konfliktliste");
          if (neu) neu.scrollTop = rollstand;
        }
      },
      bedienungen: [
        {
          kennung: "konflikt-hervorheben",
          titel: "Highlight everyone in a conflict",
          art: "klicken",
          fasst: ".pl-konflikt",
          ereignis: function (g, h) {
            var k = (h.lies("kennzahlen/konflikte/liste") || [])
              .filter(function (x) { return x.pfad === g.pfad; })[0];
            if (!k) return null;
            return {
              objekt: g.pfad, aktion: "hervorheben",
              parameter: { objekte: beteiligte(h, k) },
              erzaehlung: "Dispatcher selects conflict: " + k.art + " " + wasVon(h, k)
            };
          }
        },
        {
          kennung: "konfliktliste",
          titel: "Expand and collapse the conflict list",
          art: "klicken",
          fasst: ".pl-zaehler",
          ereignis: function (g, h) {
            var offen = !h.lies("kennzahlen/konflikte/offen");
            return {
              objekt: g.pfad, aktion: "anzeigen",
              parameter: { offen: offen },
              erzaehlung: "Dispatcher " + (offen ? "expands the conflict list" : "collapses the conflict list")
            };
          }
        }
      ],
      beschreibe: {
        "kennzahlen/konflikte/offen": function (u) {
          return "The conflict list is now " + (u.neu ? "aufgeklappt" : "zugeklappt");
        }
      },
      stil: [
        ".pl-zaehler { display: flex; align-items: baseline; gap: 10px; border-radius: 8px; padding: 2px 4px; cursor: pointer; user-select: none; }",
        ".pl-zahl { font-size: 38px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--gruen); }",
        ".pl-zahl.pl-warn { color: var(--koralle); }",
        ".pl-zahltext { font-size: 14.5px; color: var(--dim); }",
        ".pl-zaehler.gelandet .pl-zahl { animation: pl-sprung .7s ease-out; display: inline-block; }",
        "@keyframes pl-sprung { 0% { transform: scale(1.7); } 100% { transform: scale(1); } }",
        ".pl-konfliktliste { margin-top: 8px; max-height: 34vh; overflow-y: auto; }",
        ".pl-konflikt { padding: 6px 9px; margin-bottom: 6px; border: 1px solid var(--kante); border-left: 3px solid var(--koralle); border-radius: 6px; background: var(--glas); color: var(--text); font-size: 12.5px; line-height: 1.3; cursor: pointer; user-select: none; }",
        ".pl-konflikt:hover { box-shadow: inset 0 0 0 1px var(--akzent); }",
        ".pl-konfliktkopf b { font-weight: 600; color: var(--koralle); }",
        ".pl-konfliktzeit { color: var(--dim); font-size: 12px; }"
      ].join("\n")
    });
  })();

  /* Plugin Gantt: eine Zeile je Mitarbeiter, Balken = Auftrag. Ersetzt die Fassung aus wunsch-011.
     Die Ansicht fängt keinen Zeiger selbst ein: Sie meldet zwei Bedienungen an, die Hülle macht
     daraus Nachrichten. An der Kante gefasst ändert sich Beginn oder Ende. Am Balken gefasst
     rückt er in der eigenen Zeile als Ganzes in der Zeit („verschieben“, dieselbe Nachricht wie
     bei einer Flugverspätung), auf einer anderen Zeile wechselt der Mitarbeiter („umplanen“).
     Balken mit einer Überlappung aus der Konfliktliste tragen einen roten Rand.
     Sich überschneidende Balken liegen versetzt und decken sich um ein Drittel ihrer Höhe.
     Bei „hervorheben“ leuchten die genannten Balken und Zeilen auf. */
  (function () {
    var FARBE = {
      "Unloading": "pl-entl", "Loading": "pl-bela", "Lavatory service": "pl-faek",
      "Fuelling": "pl-tank", "Cabin cleaning": "pl-clean"
    };
    var HOEHE = 18;     // Höhe eines Balkens in px
    var VERSATZ = 12;   // Abstand der Balkenspuren in px: zwei Drittel der Höhe, ein Drittel deckt sich
    var LUFT = 6;       // Abstand über und unter den Balken einer Zeile zusammen in px
    var NAME = 205;     // Breite der Namensspalte in px
    var RASTER = 5;     // Raster beim Ziehen in Minuten
    var ACHSE = 20;     // Höhe der Zeitachse in px
    var SICHTBAR = 5;   // so viele Minuten bleibt ein Balken in der Vorschau mindestens stehen

    /* Zeitachse aus den Aufträgen, auf volle Stunden gerundet */
    function achse(h, auftraege) {
      var von = Infinity, bis = -Infinity;
      auftraege.forEach(function (a) {
        von = Math.min(von, h.minuten(a.start));
        bis = Math.max(bis, h.minuten(a.ende));
      });
      return { von: Math.floor(von / 60) * 60, bis: Math.ceil(bis / 60) * 60 };
    }

    /* Sich überschneidende Balken eines Mitarbeiters liegen versetzt übereinander.
       Die Liste ist nach Spur geordnet, damit die höhere Spur immer obenauf liegt. */
    function spuren(h, liste) {
      var enden = [];
      liste.sort(function (a, b) { return h.minuten(a.start) - h.minuten(b.start); });
      return liste.map(function (a) {
        var s = 0;
        while (enden[s] !== undefined && enden[s] > h.minuten(a.start)) s++;
        enden[s] = h.minuten(a.ende);
        return { auftrag: a, spur: s };
      }).sort(function (x, y) { return x.spur - y.spur; });
    }

    /* Liegt in der nächsten Spur ein Balken zur selben Zeit, ist der untere Teil dieses Balkens bedeckt. */
    function bedeckt(h, x, alle) {
      var a = x.auftrag;
      return alle.some(function (y) {
        var b = y.auftrag;
        return y.spur === x.spur + 1 &&
          h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende);
      });
    }

    function jetztLinks(h, ax) {
      var f = (h.minuten(h.uhr()) - ax.von) / (ax.bis - ax.von);
      return "calc(" + NAME + "px + (100% - " + NAME + "px) * " + Math.max(0, Math.min(1, f)) + ")";
    }

    function uhrzeit(min) {
      return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
    }
    function aufRaster(min) { return Math.round(min / RASTER) * RASTER; }

    var letzteAchse = null;
    var glanz = leuchten();

    /* Weg des Zeigers in Minuten auf der Zeitachse */
    function wegInMinuten(g, ax, bahn) {
      return g.dx / bahn.getBoundingClientRect().width * (ax.bis - ax.von);
    }

    function zeichne(el, h) {
      var bisher = el.querySelector(".pl-rahmen");
      var rollstand = bisher ? bisher.scrollTop : 0;
      var glanzStand = glanz.stand();

      var auftraege = h.alle("auftraege");
      var ax = achse(h, auftraege);
      letzteAchse = ax;
      var spanne = ax.bis - ax.von;
      function prozent(min) { return (min - ax.von) / spanne * 100; }

      var ueberlappungen = (h.lies("kennzahlen/konflikte/liste") || [])
        .filter(function (k) { return k.art === "Overlap"; });

      /* Roter Rand: je Überlappung des Auftrags ein Rand, der den Konflikt als Objekt trägt. */
      function raender(kennung) {
        return ueberlappungen
          .filter(function (k) { return k.auftrag === kennung || k.mit === kennung; })
          .map(function (k) { return '<i class="pl-konfliktrand" data-pfad="' + h.esc(k.pfad) + '"></i>'; })
          .join("");
      }

      var kopf = "";
      for (var t = ax.von; t <= ax.bis; t += 60) {
        kopf += '<span class="pl-stunde" style="left:' + prozent(t) + '%">' + ("0" + t / 60).slice(-2) + ":00</span>";
      }
      var stunden = "";
      for (var u = ax.von + 60; u < ax.bis; u += 60) {
        stunden += '<i class="pl-linie" style="left:' + prozent(u) + '%"></i>';
      }

      var zeilen = h.alle("mitarbeiter").map(function (m) {
        var meine = spuren(h, auftraege.filter(function (a) { return a.mitarbeiter === m.kennung; }));
        var anzahl = meine.reduce(function (n, x) { return Math.max(n, x.spur + 1); }, 1);
        var balken = meine.map(function (x) {
          var a = x.auftrag, s = h.minuten(a.start), e = h.minuten(a.ende);
          var lage = (x.spur > 0 ? " pl-obenauf" : "") + (bedeckt(h, x, meine) ? " pl-bedeckt" : "");
          return '<div class="pl-balken ' + (FARBE[a.arbeit] || "") + lage + '" data-pfad="auftraege/' + h.esc(a.kennung) + '"' +
            ' title="' + h.esc(a.flug + " · " + a.arbeit + " · " + a.start + "–" + a.ende + " · Task " + a.kennung) + '"' +
            ' style="left:' + prozent(s) + "%;width:" + (prozent(e) - prozent(s)) + "%;top:" + (x.spur * VERSATZ + 2) + 'px">' +
            "<span>" + h.esc(a.flug) + "</span>" + raender(a.kennung) +
            '<i class="pl-griff pl-griff-start" data-kante="start"></i>' +
            '<i class="pl-griff pl-griff-ende" data-kante="ende"></i></div>';
        }).join("");
        var frei = h.minuten(m.schichtStart) > ax.von
          ? '<i class="pl-vorschicht" style="width:' + prozent(h.minuten(m.schichtStart)) + '%"></i>' : "";
        var weg = "", marke = "";
        if (m.abwesend) {
          var ab = m.abwesendAb === null ? ax.von : h.minuten(m.abwesendAb);
          weg = '<i class="pl-abwesend" style="left:' + prozent(ab) + '%"></i>';
          marke = '<span class="pl-marke">' + h.esc(m.grund) + (m.abwesendAb ? " from " + h.esc(m.abwesendAb) : "") + "</span>";
        }
        return '<div class="pl-zeile" data-pfad="mitarbeiter/' + h.esc(m.kennung) + '">' +
          '<div class="pl-name" title="' + h.esc(m.gruppe) + '"><b>' + h.esc(m.name) + "</b> " +
          '<small>' + h.esc(m.kennung) + "</small>" + marke + "</div>" +
          '<div class="pl-bahn" style="height:' + ((anzahl - 1) * VERSATZ + HOEHE + LUFT) + 'px">' + frei + stunden + weg + balken + "</div></div>";
      }).join("");

      var legende = Object.keys(FARBE).map(function (name) {
        return '<span><i class="' + FARBE[name] + '"></i>' + h.esc(name) + "</span>";
      }).join("") + '<span><i class="pl-konfliktmuster"></i>Overlap</span>';

      el.innerHTML = '<div class="pl-kopf"><h2>Daily Plan</h2><div class="pl-legende">' + legende + "</div></div>" +
        '<div class="pl-rahmen"><div class="pl-achse"><div class="pl-achsbahn">' + kopf + "</div></div>" + zeilen +
        '<i class="pl-jetzt" style="left:' + jetztLinks(h, ax) + '"></i></div>';

      var rahmen = el.querySelector(".pl-rahmen");
      if (rahmen) rahmen.scrollTop = rollstand;
      glanz.weiter(el, glanzStand);
    }

    function balkenIn(el, pfad) {
      return el.querySelector('.pl-bahn .pl-balken[data-pfad="' + pfad + '"]');
    }

    function balkenLegen(b, s, e) {
      var spanne = letzteAchse.bis - letzteAchse.von;
      b.style.left = (s - letzteAchse.von) / spanne * 100 + "%";
      b.style.width = (e - s) / spanne * 100 + "%";
    }

    /* Der Balken zeigt während des Ziehens die Zeiten, die das Ereignis setzen würde. */
    function balkenVorschau(b, s, e) {
      balkenLegen(b, s, e);
      b.classList.add("pl-gezogen");
      b.removeAttribute("title");
      b.querySelector("span").textContent = uhrzeit(s) + "–" + uhrzeit(e);
    }

    function kantenVorschau(g, n, el, h) {
      var a = h.lies(g.pfad), b = balkenIn(el, g.pfad);
      if (!a || !b || !letzteAchse) return;
      var s = h.minuten(a.start), e = h.minuten(a.ende);
      if (n && n.parameter) {
        var t = h.minuten(n.parameter.zeit);
        if (n.parameter.kante === "start") s = Math.min(t, e - SICHTBAR);
        else e = Math.max(t, s + SICHTBAR);
      }
      balkenVorschau(b, s, e);
    }

    /* Nur ein Zug in der Zeit zeigt sich am Balken; sonst liegt er an seinem alten Platz. */
    function schiebeVorschau(g, n, el, h) {
      var a = h.lies(g.pfad), b = balkenIn(el, g.pfad);
      if (!a || !b || !letzteAchse) return;
      var s = h.minuten(a.start), e = h.minuten(a.ende);
      if (n && n.aktion === "verschieben") {
        balkenVorschau(b, s + n.parameter.minuten, e + n.parameter.minuten);
        return;
      }
      balkenLegen(b, s, e);
      b.classList.remove("pl-gezogen");
      b.querySelector("span").textContent = a.flug;
    }

    Huelle.plugin({
      kennung: "gantt",
      titel: "Gantt",
      ansicht: {
        ort: "haupt",
        neuBei: ["auftraege/*.geaendert", "mitarbeiter/*.geaendert", "kennzahlen/konflikte.geaendert"],
        zeichne: zeichne
      },
      bedienungen: [
        {
          kennung: "balken-kante",
          titel: "Drag bar at the edge",
          fasst: ".pl-griff",
          zeiger: "ew-resize",
          vorschau: kantenVorschau,
          ereignis: function (g, h) {
            var a = h.lies(g.pfad), ax = letzteAchse, bahn = g.sicht.querySelector(".pl-bahn");
            if (!a || !ax || !bahn) return null;
            var vorn = g.daten.kante === "start";
            var alt = h.minuten(vorn ? a.start : a.ende);
            var neu = Math.max(ax.von, Math.min(ax.bis, aufRaster(alt + wegInMinuten(g, ax, bahn))));
            if (neu === alt) return { hinweis: "Stays at " + a.start + "–" + a.ende };
            return {
              objekt: g.pfad, aktion: "zeitaendern",
              parameter: { kante: g.daten.kante, zeit: uhrzeit(neu) },
              erzaehlung: a.flug + " " + a.arbeit + (vorn ? " now starts at " : " now ends at ") + uhrzeit(neu)
            };
          }
        },
        {
          kennung: "balken-auf-zeile",
          titel: "Move bar or drag onto a row",
          fasst: ".pl-balken",
          ziel: ".pl-zeile",
          rollt: ".pl-rahmen",
          leer: "Move within its own row or drag onto an agent",
          vorschau: schiebeVorschau,
          ereignis: function (g, h) {
            if (!g.ziel) return null;
            var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
            if (!a || !m) return null;
            if (m.kennung !== a.mitarbeiter) {
              return {
                objekt: g.pfad, aktion: "umplanen",
                parameter: { mitarbeiter: m.kennung },
                erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
                hinweis: m.name + " kann " + a.arbeit + ", the time stays the same"
              };
            }
            var ax = letzteAchse, bahn = g.sicht.querySelector(".pl-bahn");
            if (!ax || !bahn) return null;
            var s = h.minuten(a.start), dauer = h.minuten(a.ende) - s;
            var neu = Math.max(ax.von, Math.min(ax.bis - dauer, aufRaster(s + wegInMinuten(g, ax, bahn))));
            if (neu === s) return { hinweis: "Stays at " + a.start + "–" + a.ende };
            var zeiten = uhrzeit(neu) + "–" + uhrzeit(neu + dauer);
            return {
              objekt: g.pfad, aktion: "verschieben",
              parameter: { minuten: neu - s, grund: "disponent" },
              erzaehlung: "Dispatcher moves " + a.flug + " " + a.arbeit + " to " + zeiten,
              hinweis: a.flug + " " + a.arbeit + " then runs " + zeiten
            };
          }
        }
      ],
      abonniert: {
        "uhr/tag.tick": function (m, h) {
          var linie = document.querySelector(".pl-jetzt");
          if (linie && letzteAchse) linie.style.left = jetztLinks(h, letzteAchse);
        },
        "konflikte/*.hervorheben": function (m) {
          glanz.starte(m.parameter.objekte);
        }
      },
      stil: [
        '[data-sicht="gantt"] { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }',
        ".pl-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }",
        ".pl-legende { display: flex; gap: 12px; flex-wrap: wrap; color: var(--dim); font-size: 11.5px; }",
        ".pl-legende i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }",
        ".pl-legende i.pl-konfliktmuster { box-sizing: border-box; border: 2px solid var(--koralle); }",
        ".pl-rahmen { position: relative; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }",
        ".pl-achse { position: sticky; top: 0; z-index: 7; height: " + ACHSE + "px; padding-left: " + NAME + "px; background: #08232c; }",
        ".pl-achsbahn { position: relative; height: 100%; }",
        ".pl-stunde { position: absolute; transform: translateX(-50%); color: var(--dim); font-size: 11px; }",
        ".pl-stunde:first-child { transform: none; } .pl-stunde:last-child { transform: translateX(-100%); }",
        ".pl-zeile { display: flex; align-items: stretch; border-bottom: 1px solid var(--raster); border-radius: 4px; scroll-margin-top: " + ACHSE + "px; }",
        ".pl-name { flex: 0 0 " + NAME + "px; width: " + NAME + "px; padding: 3px 6px 2px 0; font-size: 12px; line-height: 1.25; white-space: nowrap; overflow: hidden; }",
        ".pl-name b { font-weight: 600; } .pl-name small { color: var(--dim); font-size: 10.5px; }",
        ".pl-marke { margin-left: 5px; padding: 0 5px; border-radius: 6px; font-size: 10.5px; color: #ffd9d4; background: rgba(255,111,97,.28); }",
        ".pl-bahn { position: relative; flex: 1; min-width: 0; }",
        ".pl-linie { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--rasterStd); }",
        ".pl-vorschicht { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,.28); }",
        ".pl-abwesend { position: absolute; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, rgba(255,111,97,.20) 0 5px, transparent 5px 11px); }",
        ".pl-balken { position: absolute; height: " + HOEHE + "px; min-width: 6px; border-radius: 4px; color: #fff; font-size: 10.5px; line-height: " + HOEHE + "px; padding: 0 4px; white-space: nowrap; overflow: hidden; cursor: grab; touch-action: none; user-select: none; }",
        ".pl-balken.pl-bedeckt { line-height: " + VERSATZ + "px; }",
        ".pl-balken.pl-obenauf { box-shadow: 0 -1px 3px rgba(0,0,0,.5); }",
        ".pl-konfliktrand { position: absolute; top: 0; right: 0; bottom: 0; left: 0; box-sizing: border-box; border: 2px solid var(--koralle); border-radius: 4px; pointer-events: none; }",
        ".pl-griff { position: absolute; top: 0; bottom: 0; width: 5px; cursor: ew-resize; touch-action: none; }",
        ".pl-griff-start { left: 0; } .pl-griff-ende { right: 0; }",
        ".pl-griff:hover { background: rgba(255,255,255,.4); }",
        ".pl-balken.pl-gezogen { z-index: 5; box-shadow: 0 0 0 1px var(--gold); }",
        ".pl-entl { background: linear-gradient(135deg, #5a8bff, #2f5fc4); }",
        ".pl-bela { background: linear-gradient(135deg, #8f7bff, #3a2fb0); }",
        ".pl-faek { background: linear-gradient(135deg, #b98f4e, #7a5a2e); }",
        ".pl-tank { background: linear-gradient(135deg, #3fe0cf, #1d7a6d); }",
        ".pl-clean { background: linear-gradient(135deg, #a982d8, #6b4a7a); }",
        ".pl-zeile.leuchtet { animation: pl-zeile-leuchtet .65s ease-in-out infinite alternate; }",
        ".pl-zeile.gelandet { animation: none; }",
        "@keyframes pl-zeile-leuchtet { from { background: rgba(233,196,118,.10); box-shadow: inset 0 0 0 1px var(--gold); } to { background: rgba(233,196,118,.30); box-shadow: inset 0 0 0 2px var(--gold); } }",
        ".pl-jetzt { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--gold); box-shadow: 0 0 6px var(--gold); z-index: 6; pointer-events: none; }"
      ].join("\n")
    });
  })();

  /* Plugin Liste „Nicht zugewiesene Aufträge“.
     Ein Auftrag aus der Liste lässt sich auf eine Mitarbeiterzeile im Tagesplan ziehen. Das ist
     dieselbe Nachricht „umplanen“ wie beim Ziehen eines Balkens: Ob es erlaubt ist und was es
     bewirkt, steht im Verhalten „Einsatz ändern“. Die Ablageorte liegen in der Ansicht Gantt.
     Bei „hervorheben“ leuchten die genannten Aufträge der Liste auf. */
  (function () {
    var glanz = leuchten();

    Huelle.plugin({
      kennung: "nicht-zugewiesen",
      titel: "Unassigned tasks",
      ansicht: {
        ort: "seite",
        rang: 2,
        neuBei: ["auftraege/*.geaendert", "kennzahlen/konflikte.geaendert"],
        zeichne: function (el, h) {
          var glanzStand = glanz.stand();
          var offen = h.alle("auftraege")
            .filter(function (a) { return !a.mitarbeiter; })
            .sort(function (a, b) { return h.minuten(a.start) - h.minuten(b.start); });
          var luecken = (h.lies("kennzahlen/konflikte/liste") || [])
            .filter(function (k) { return k.art === "Capacity gap"; })
            .map(function (k) { return k.auftrag; });

          var zeilen = offen.map(function (a) {
            var niemand = luecken.indexOf(a.kennung) !== -1
              ? '<span class="pl-niemand">nobody available</span>' : "";
            return '<div class="pl-offen" data-pfad="auftraege/' + h.esc(a.kennung) + '" title="Task ' + h.esc(a.kennung) + '">' +
              "<b>" + h.esc(a.flug) + "</b> " + h.esc(a.arbeit) + niemand +
              '<div class="pl-offenzeit">' + h.esc(a.start) + "–" + h.esc(a.ende) + "</div></div>";
          }).join("");

          el.innerHTML = "<h2>Unassigned tasks <span class=\"pl-anzahl\">" + offen.length + "</span></h2>" +
            (zeilen || '<div class="pl-leer">All tasks are assigned.</div>');
          glanz.weiter(el, glanzStand);
        }
      },
      bedienungen: [
        {
          kennung: "offen-auf-zeile",
          titel: "Drag task onto an agent",
          fasst: ".pl-offen",
          ziel: ".pl-zeile",
          rollt: ".pl-rahmen",
          leer: "Drag onto an agent in the daily plan",
          ereignis: function (g, h) {
            if (!g.ziel) return null;
            var a = h.lies(g.pfad), m = h.lies(g.ziel.pfad);
            if (!a || !m) return null;
            return {
              objekt: g.pfad, aktion: "umplanen",
              parameter: { mitarbeiter: m.kennung },
              erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name,
              hinweis: m.name + " kann " + a.arbeit + ", the time stays the same"
            };
          }
        }
      ],
      abonniert: {
        "konflikte/*.hervorheben": function (m) {
          glanz.starte(m.parameter.objekte);
        }
      },
      stil: [
        '[data-sicht="nicht-zugewiesen"] { flex: 1; min-height: 0; overflow-y: auto; }',
        ".pl-anzahl { margin-left: 4px; padding: 0 7px; border-radius: 9px; font-size: 12px; background: var(--glas2); }",
        ".pl-offen { padding: 7px 10px; margin-bottom: 7px; border: 1px solid var(--kante); border-radius: 8px; background: #123a4a; color: var(--text); font-size: 13px; line-height: 1.3; white-space: nowrap; cursor: grab; touch-action: none; user-select: none; }",
        ".pl-offen b { font-weight: 600; }",
        ".pl-offenzeit { color: var(--dim); font-size: 12px; }",
        ".pl-niemand { float: right; padding: 0 6px; border-radius: 6px; font-size: 11px; color: #ffd9d4; background: rgba(255,111,97,.28); }",
        ".pl-leer { color: var(--dim); }"
      ].join("\n")
    });
  })();
})();
