/* Plugin Tagesplan: die reine Anzeige, eine Zeile je Mitarbeiter, Balken = Auftrag.
   Alles Weitere an diesem Plan sind eigene kleine Plugins, die ihn über `ergaenzt` und
   `bedienungen` erweitern. Dafür trägt jeder Balken seine Spur und der Rahmen die Zeitachse. */
(function () {
  var FARBE = {
    "Entladen": "pl-entl", "Beladen": "pl-bela", "Fäkalien entleeren": "pl-faek",
    "Betanken": "pl-tank", "Innenraum-Cleaning": "pl-clean"
  };
  var SPUR = 21;      // Höhe einer Balkenspur in px
  var NAME = 205;     // Breite der Namensspalte in px

  /* Zeitachse aus den Aufträgen, auf volle Stunden gerundet */
  function achse(h, auftraege) {
    var von = Infinity, bis = -Infinity;
    auftraege.forEach(function (a) {
      von = Math.min(von, h.minuten(a.start));
      bis = Math.max(bis, h.minuten(a.ende));
    });
    return { von: Math.floor(von / 60) * 60, bis: Math.ceil(bis / 60) * 60 };
  }

  /* Sich überschneidende Balken eines Mitarbeiters liegen untereinander. */
  function spuren(h, liste) {
    var enden = [];
    liste.sort(function (a, b) { return h.minuten(a.start) - h.minuten(b.start); });
    return liste.map(function (a) {
      var s = 0;
      while (enden[s] !== undefined && enden[s] > h.minuten(a.start)) s++;
      enden[s] = h.minuten(a.ende);
      return { auftrag: a, spur: s };
    });
  }

  function jetztLinks(h, ax) {
    var f = (h.minuten(h.uhr()) - ax.von) / (ax.bis - ax.von);
    return "calc(" + NAME + "px + (100% - " + NAME + "px) * " + Math.max(0, Math.min(1, f)) + ")";
  }

  var letzteAchse = null;

  Huelle.plugin({
    kennung: "gantt",
    titel: "Tagesplan",
    ansicht: {
      ort: "haupt",
      neuBei: ["auftraege/*.geaendert", "mitarbeiter/*.geaendert"],
      zeichne: function (el, h) {
        var auftraege = h.alle("auftraege");
        var ax = achse(h, auftraege);
        letzteAchse = ax;
        var spanne = ax.bis - ax.von;
        function prozent(min) { return (min - ax.von) / spanne * 100; }

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
            return '<div class="pl-balken ' + (FARBE[a.arbeit] || "") + '" data-pfad="auftraege/' + h.esc(a.kennung) + '"' +
              ' data-spur="' + x.spur + '" title="' + h.esc(a.flug + " · " + a.arbeit + " · " + a.start + "–" + a.ende + " · Auftrag " + a.kennung) + '"' +
              ' style="left:' + prozent(s) + "%;width:" + (prozent(e) - prozent(s)) + "%;top:" + (x.spur * SPUR + 2) + 'px">' +
              "<span>" + h.esc(a.flug) + "</span></div>";
          }).join("");
          var frei = h.minuten(m.schichtStart) > ax.von
            ? '<i class="pl-vorschicht" style="width:' + prozent(h.minuten(m.schichtStart)) + '%"></i>' : "";
          var weg = "", marke = "";
          if (m.abwesend) {
            var ab = m.abwesendAb === null ? ax.von : h.minuten(m.abwesendAb);
            weg = '<i class="pl-abwesend" style="left:' + prozent(ab) + '%"></i>';
            marke = '<span class="pl-marke">' + h.esc(m.grund) + (m.abwesendAb ? " ab " + h.esc(m.abwesendAb) : "") + "</span>";
          }
          return '<div class="pl-zeile" data-pfad="mitarbeiter/' + h.esc(m.kennung) + '">' +
            '<div class="pl-name" title="' + h.esc(m.gruppe) + '"><b>' + h.esc(m.name) + "</b> " +
            '<small>' + h.esc(m.kennung) + "</small>" + marke + "</div>" +
            '<div class="pl-bahn" style="height:' + (anzahl * SPUR + 3) + 'px">' + frei + stunden + weg + balken + "</div></div>";
        }).join("");

        var legende = Object.keys(FARBE).map(function (name) {
          return '<span><i class="' + FARBE[name] + '"></i>' + h.esc(name) + "</span>";
        }).join("");

        el.innerHTML = '<div class="pl-kopf"><h2>Tagesplan</h2><div class="pl-legende">' + legende + "</div></div>" +
          '<div class="pl-rahmen" data-rollen="plan" data-von="' + ax.von + '" data-bis="' + ax.bis + '"><div class="pl-achse"><div class="pl-achsbahn">' + kopf + "</div></div>" + zeilen +
          '<i class="pl-jetzt" style="left:' + jetztLinks(h, ax) + '"></i></div>';
      }
    },
    abonniert: {
      "uhr/tag.tick": function (m, h) {
        var linie = document.querySelector(".pl-jetzt");
        if (linie && letzteAchse) linie.style.left = jetztLinks(h, letzteAchse);
      }
    },
    stil: [
      '[data-sicht="gantt"] { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }',
      ".pl-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }",
      ".pl-legende { display: flex; gap: 12px; flex-wrap: wrap; color: var(--dim); font-size: 11.5px; }",
      ".pl-legende i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }",
      ".pl-rahmen { position: relative; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }",
      ".pl-achse { position: sticky; top: 0; z-index: 7; height: 20px; padding-left: " + NAME + "px; background: #08232c; }",
      ".pl-achsbahn { position: relative; height: 100%; }",
      ".pl-stunde { position: absolute; transform: translateX(-50%); color: var(--dim); font-size: 11px; }",
      ".pl-stunde:first-child { transform: none; } .pl-stunde:last-child { transform: translateX(-100%); }",
      ".pl-zeile { display: flex; align-items: stretch; border-bottom: 1px solid var(--raster); border-radius: 4px; scroll-margin-top: 20px; }",
      ".pl-name { flex: 0 0 " + NAME + "px; width: " + NAME + "px; padding: 3px 6px 2px 0; font-size: 12px; line-height: 1.25; white-space: nowrap; overflow: hidden; }",
      ".pl-name b { font-weight: 600; } .pl-name small { color: var(--dim); font-size: 10.5px; }",
      ".pl-marke { margin-left: 5px; padding: 0 5px; border-radius: 6px; font-size: 10.5px; color: #ffd9d4; background: rgba(255,111,97,.28); }",
      ".pl-bahn { position: relative; flex: 1; min-width: 0; }",
      ".pl-linie { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--rasterStd); }",
      ".pl-vorschicht { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,.28); }",
      ".pl-abwesend { position: absolute; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, rgba(255,111,97,.20) 0 5px, transparent 5px 11px); }",
      ".pl-balken { position: absolute; height: 18px; min-width: 6px; border-radius: 4px; color: #fff; font-size: 10.5px; line-height: 18px; padding: 0 4px; white-space: nowrap; overflow: hidden; user-select: none; }",
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
