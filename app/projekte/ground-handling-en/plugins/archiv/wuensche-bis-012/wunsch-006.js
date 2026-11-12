/* Plugin Gantt: eine Zeile je Mitarbeiter, Balken = Auftrag.
   Die Balken lassen sich an beiden Rändern mit der Maus ziehen: Beim Ziehen zeigt der
   Balken nur eine Vorschau, erst beim Loslassen geht eine Nachricht über den Bus.
   Am Balken selbst gefasst, lässt er sich auf einen anderen Mitarbeiter ziehen. Ein Tooltip
   sagt dabei, ob die Zuteilung geht. Entschieden wird beim Empfang der Nachricht „umplanen“:
   Ohne passende Qualifikation bleibt der Auftrag, wo er ist, und „verweigert“ geht über den Bus.
   Nachrichten aus der Maus gehen über den Zugang, den die Abonnenten bekommen; der Zugang der
   Ansicht dient nur als Rückfall, solange noch keine Nachricht angekommen ist. */
(function () {
  var FARBE = {
    "Unloading": "pl-entl", "Loading": "pl-bela", "Lavatory service": "pl-faek",
    "Fuelling": "pl-tank", "Cabin cleaning": "pl-clean"
  };
  var SPUR = 21;      // Höhe einer Balkenspur in px
  var NAME = 205;     // Breite der Namensspalte in px
  var RASTER = 5;     // Raster beim Ziehen in Minuten
  var KUERZESTE = 5;  // kürzeste Dauer eines Auftrags in Minuten
  var ACHSE = 20;     // Höhe der Zeitachse in px
  var SCHWELLE = 4;   // so viele px Weg, bevor aus einem Klick ein Ziehen wird
  var RAND = 24;      // Abstand zum Rahmenrand in px, ab dem der Plan mitrollt
  var ROLLEN = 12;    // Rollweg je Mausbewegung in px

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

  function uhrzeit(min) {
    return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
  }
  function aufRaster(min) { return Math.round(min / RASTER) * RASTER; }
  function hatQuali(m, arbeit) { return m.qualifikationen.indexOf(arbeit) !== -1; }

  var letzteAchse = null;
  var aktuellesH = null;
  var busH = null;    // Zugang aus dem letzten Abonnenten-Aufruf
  var zug = null;     // laufendes Ziehen an einem Balkenrand
  var schub = null;   // laufendes Ziehen eines Balkens auf einen anderen Mitarbeiter

  function sende(nachricht) { (busH || aktuellesH).sende(nachricht); }

  /* Zeigt den gezogenen Balken mit den Zeiten des laufenden Zugs. */
  function vorschau(el, z) {
    var b = el.querySelector('.pl-balken[data-pfad="' + z.pfad + '"]');
    if (!b || !letzteAchse) return;
    var spanne = letzteAchse.bis - letzteAchse.von;
    b.style.left = (z.s - letzteAchse.von) / spanne * 100 + "%";
    b.style.width = (z.e - z.s) / spanne * 100 + "%";
    b.classList.add("pl-gezogen");
    var text = b.querySelector("span");
    if (text) text.textContent = uhrzeit(z.s) + "–" + uhrzeit(z.e);
  }

  function loslassen(el, e, abbruch) {
    if (!zug || e.pointerId !== zug.zeiger) return;
    var z = zug, h = aktuellesH;
    zug = null;
    el.classList.remove("pl-zieht");
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

    var vorn = z.kante === "start";
    var neu = vorn ? z.s : z.e, alt = vorn ? z.s0 : z.e0;
    if (abbruch || neu === alt) { zeichne(el, h); return; }

    var a = h.lies(z.pfad);
    sende({
      objekt: z.pfad, aktion: "zeitaendern",
      parameter: { kante: z.kante, zeit: uhrzeit(neu) },
      erzaehlung: a.flug + " " + a.arbeit + (vorn ? " now starts at " : " now ends at ") + uhrzeit(neu)
    });
  }

  /* Die Mitarbeiterzeile unter dem Zeiger, nur innerhalb des sichtbaren Plans. */
  function zeileUnter(el, x, y) {
    var rahmen = el.querySelector(".pl-rahmen");
    if (!rahmen) return null;
    var r = rahmen.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top + ACHSE || y > r.bottom) return null;
    var zeilen = el.querySelectorAll(".pl-zeile");
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i].getBoundingClientRect();
      if (y >= z.top && y < z.bottom) return zeilen[i];
    }
    return null;
  }

  /* Was der Tooltip zur Zeile unter dem Zeiger sagt. */
  function beurteile(h, a, id) {
    var m = h.lies("mitarbeiter/" + id);
    if (!m) return { art: "leer", text: "Drag onto an agent" };
    if (id === a.mitarbeiter) return { art: "leer", text: "Stays with " + m.name };
    if (hatQuali(m, a.arbeit)) return { art: "ja", text: "✓ " + m.name + " kann " + a.arbeit + "" };
    return { art: "nein", text: "✕ " + m.name + " has no qualification for " + a.arbeit };
  }

  function teil(el, klasse) {
    var t = el.querySelector("." + klasse);
    if (!t) {
      t = document.createElement("div");
      t.className = klasse;
      el.appendChild(t);
    }
    return t;
  }

  /* Zeigt den mitlaufenden Balken, die Zielzeile und den Tooltip. Läuft auch nach einem
     Neuzeichnen während des Ziehens, deshalb entsteht alles bei Bedarf neu. */
  function schubZeigen(el, s) {
    var h = aktuellesH, a = h.lies(s.pfad);
    if (!a) return;

    var b = el.querySelector('.pl-balken[data-pfad="' + s.pfad + '"]');
    if (b) {
      b.classList.add("pl-quelle");
      b.removeAttribute("title");
    }

    var markiert = el.querySelectorAll(".pl-ziel-ja, .pl-ziel-nein");
    for (var i = 0; i < markiert.length; i++) markiert[i].classList.remove("pl-ziel-ja", "pl-ziel-nein");

    var zeile = zeileUnter(el, s.x, s.y);
    var urteil = zeile
      ? beurteile(h, a, zeile.getAttribute("data-pfad").split("/")[1])
      : { art: "leer", text: "Drag onto an agent" };
    if (zeile && urteil.art !== "leer") zeile.classList.add("pl-ziel-" + urteil.art);
    el.classList.toggle("pl-verboten", urteil.art === "nein");

    var r = el.getBoundingClientRect();
    var geist = teil(el, "pl-geist");
    geist.className = "pl-balken pl-geist " + (FARBE[a.arbeit] || "");
    geist.textContent = a.flug;
    geist.style.width = s.breite + "px";
    geist.style.left = s.x - r.left - s.greifX + "px";
    geist.style.top = s.y - r.top - 9 + "px";

    var tipp = teil(el, "pl-tipp");
    tipp.className = "pl-tipp pl-tipp-" + urteil.art;
    tipp.textContent = urteil.text;
    tipp.style.left = Math.max(0, Math.min(s.x - r.left + 12, r.width - tipp.offsetWidth)) + "px";
    tipp.style.top = Math.max(0, s.y - r.top - 36) + "px";
  }

  function schubBeginnen(el, e) {
    var balken = e.target.closest ? e.target.closest(".pl-balken") : null;
    if (!balken) return;
    var pfad = balken.getAttribute("data-pfad");
    if (!pfad || !aktuellesH.lies(pfad)) return;
    e.preventDefault();
    e.stopPropagation();
    var r = balken.getBoundingClientRect();
    schub = {
      zeiger: e.pointerId, pfad: pfad, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      greifX: e.clientX - r.left, breite: r.width, laeuft: false
    };
    el.setPointerCapture(e.pointerId);
  }

  /* Am oberen und unteren Rand rollt der Plan mit, damit jede Zeile erreichbar ist. */
  function randRollen(el, y) {
    var rahmen = el.querySelector(".pl-rahmen");
    if (!rahmen) return;
    var r = rahmen.getBoundingClientRect();
    if (y < r.top + ACHSE + RAND) rahmen.scrollTop -= ROLLEN;
    else if (y > r.bottom - RAND) rahmen.scrollTop += ROLLEN;
  }

  function schubBewegen(el, e) {
    var s = schub;
    s.x = e.clientX;
    s.y = e.clientY;
    if (!s.laeuft) {
      if (Math.abs(s.x - s.x0) + Math.abs(s.y - s.y0) < SCHWELLE) return;
      s.laeuft = true;
      el.classList.add("pl-schiebt");
    }
    randRollen(el, s.y);
    schubZeigen(el, s);
  }

  function schubEnde(el, e, abbruch) {
    if (!schub || e.pointerId !== schub.zeiger) return;
    var s = schub, h = aktuellesH;
    schub = null;
    el.classList.remove("pl-schiebt", "pl-verboten");
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!s.laeuft) return;

    var zeile = abbruch ? null : zeileUnter(el, e.clientX, e.clientY);
    var id = zeile ? zeile.getAttribute("data-pfad").split("/")[1] : null;
    zeichne(el, h);

    var a = h.lies(s.pfad), m = id ? h.lies("mitarbeiter/" + id) : null;
    if (!a || !m || id === a.mitarbeiter) return;
    sende({
      objekt: s.pfad, aktion: "umplanen",
      parameter: { mitarbeiter: id },
      erzaehlung: "Dispatcher drags " + a.flug + " " + a.arbeit + " to " + m.name
    });
  }

  /* Die Ansicht fängt den Zeiger selbst ein, so bleibt das Ziehen in der eigenen Ansicht
     und überlebt ein Neuzeichnen während des Zugs. Das Fassen läuft in der Einfangphase und
     endet hier, damit eine ältere Fassung auf demselben Element den Zug nicht mitbekommt. */
  function ziehenEinrichten(el) {
    el.addEventListener("dragstart", function (e) { e.preventDefault(); });
    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || zug || schub) return;
      var griff = e.target.closest ? e.target.closest(".pl-griff") : null;
      if (!griff) { schubBeginnen(el, e); return; }
      var balken = griff.parentNode, h = aktuellesH;
      var pfad = balken.getAttribute("data-pfad");
      var a = h.lies(pfad);
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      var s = h.minuten(a.start), en = h.minuten(a.ende);
      zug = {
        zeiger: e.pointerId, pfad: pfad, kante: griff.getAttribute("data-kante"),
        x: e.clientX, breite: balken.parentNode.getBoundingClientRect().width,
        s0: s, e0: en, s: s, e: en
      };
      el.setPointerCapture(e.pointerId);
      el.classList.add("pl-zieht");
      vorschau(el, zug);
    }, true);
    el.addEventListener("pointermove", function (e) {
      if (schub && e.pointerId === schub.zeiger) { schubBewegen(el, e); return; }
      if (!zug || e.pointerId !== zug.zeiger || !letzteAchse) return;
      var ax = letzteAchse;
      var versatz = (e.clientX - zug.x) / zug.breite * (ax.bis - ax.von);
      if (zug.kante === "start") {
        zug.s = Math.max(ax.von, Math.min(zug.e - KUERZESTE, aufRaster(zug.s0 + versatz)));
      } else {
        zug.e = Math.min(ax.bis, Math.max(zug.s + KUERZESTE, aufRaster(zug.e0 + versatz)));
      }
      vorschau(el, zug);
    });
    el.addEventListener("pointerup", function (e) {
      loslassen(el, e, false);
      schubEnde(el, e, false);
    });
    el.addEventListener("pointercancel", function (e) {
      loslassen(el, e, true);
      schubEnde(el, e, true);
    });
  }

  function zeichne(el, h) {
    aktuellesH = h;
    if (!el.plZiehenGefasst) {
      el.plZiehenGefasst = true;
      ziehenEinrichten(el);
    }

    var bisher = el.querySelector(".pl-rahmen");
    var rollstand = bisher ? bisher.scrollTop : 0;

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
          ' title="' + h.esc(a.flug + " · " + a.arbeit + " · " + a.start + "–" + a.ende + " · Task " + a.kennung) + '"' +
          ' style="left:' + prozent(s) + "%;width:" + (prozent(e) - prozent(s)) + "%;top:" + (x.spur * SPUR + 2) + 'px">' +
          "<span>" + h.esc(a.flug) + "</span>" +
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
        '<div class="pl-bahn" style="height:' + (anzahl * SPUR + 3) + 'px">' + frei + stunden + weg + balken + "</div></div>";
    }).join("");

    var legende = Object.keys(FARBE).map(function (name) {
      return '<span><i class="' + FARBE[name] + '"></i>' + h.esc(name) + "</span>";
    }).join("");

    el.innerHTML = '<div class="pl-kopf"><h2>Daily Plan</h2><div class="pl-legende">' + legende + "</div></div>" +
      '<div class="pl-rahmen"><div class="pl-achse"><div class="pl-achsbahn">' + kopf + "</div></div>" + zeilen +
      '<i class="pl-jetzt" style="left:' + jetztLinks(h, ax) + '"></i></div>';

    var rahmen = el.querySelector(".pl-rahmen");
    if (rahmen) rahmen.scrollTop = rollstand;

    if (zug) vorschau(el, zug);
    if (schub && schub.laeuft) schubZeigen(el, schub);
  }

  Huelle.plugin({
    kennung: "gantt",
    titel: "Gantt",
    ansicht: {
      ort: "haupt",
      neuBei: ["auftraege/*.geaendert", "mitarbeiter/*.geaendert"],
      zeichne: zeichne
    },
    abonniert: {
      "uhr/tag.tick": function (m, h) {
        busH = h;
        var linie = document.querySelector(".pl-jetzt");
        if (linie && letzteAchse) linie.style.left = jetztLinks(h, letzteAchse);
      },
      "bus/takt.ruhe": function (m, h) {
        busH = h;
      },
      "auftraege/*.zeitaendern": function (m, h) {
        var kante = m.parameter.kante, zeit = m.parameter.zeit;
        if (kante !== "start" && kante !== "ende") return;
        var start = kante === "start" ? zeit : h.lies(m.objekt + "/start");
        var ende = kante === "ende" ? zeit : h.lies(m.objekt + "/ende");
        if (h.minuten(ende) - h.minuten(start) < KUERZESTE) return;
        h.setze(m.objekt + "/" + kante, zeit);
      },
      "auftraege/*.umplanen": function (m, h) {
        var a = h.lies(m.objekt), id = m.parameter.mitarbeiter;
        var neu = h.lies("mitarbeiter/" + id);
        if (!a || !neu || a.mitarbeiter === id) return;
        if (hatQuali(neu, a.arbeit)) {
          h.setze(m.objekt + "/mitarbeiter", id);
          return;
        }
        var bisher = a.mitarbeiter ? h.lies("mitarbeiter/" + a.mitarbeiter) : null;
        h.sende({
          objekt: m.objekt, aktion: "verweigert",
          parameter: { mitarbeiter: id, grund: "qualifikation" },
          erzaehlung: "Assignment refused: " + neu.name + " has no qualification for " + a.arbeit +
            (bisher ? ", " + a.flug + " stays with " + bisher.name : "")
        });
      }
    },
    stil: [
      '[data-sicht="gantt"] { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }',
      ".pl-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }",
      ".pl-legende { display: flex; gap: 12px; flex-wrap: wrap; color: var(--dim); font-size: 11.5px; }",
      ".pl-legende i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }",
      ".pl-rahmen { position: relative; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }",
      ".pl-achse { position: sticky; top: 0; z-index: 7; height: " + ACHSE + "px; padding-left: " + NAME + "px; background: #08232c; }",
      ".pl-achsbahn { position: relative; height: 100%; }",
      ".pl-stunde { position: absolute; transform: translateX(-50%); color: var(--dim); font-size: 11px; }",
      ".pl-stunde:first-child { transform: none; } .pl-stunde:last-child { transform: translateX(-100%); }",
      ".pl-zeile { display: flex; align-items: stretch; border-bottom: 1px solid var(--raster); border-radius: 4px; }",
      ".pl-name { flex: 0 0 " + NAME + "px; width: " + NAME + "px; padding: 3px 6px 2px 0; font-size: 12px; line-height: 1.25; white-space: nowrap; overflow: hidden; }",
      ".pl-name b { font-weight: 600; } .pl-name small { color: var(--dim); font-size: 10.5px; }",
      ".pl-marke { margin-left: 5px; padding: 0 5px; border-radius: 6px; font-size: 10.5px; color: #ffd9d4; background: rgba(255,111,97,.28); }",
      ".pl-bahn { position: relative; flex: 1; min-width: 0; }",
      ".pl-linie { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--rasterStd); }",
      ".pl-vorschicht { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,.28); }",
      ".pl-abwesend { position: absolute; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, rgba(255,111,97,.20) 0 5px, transparent 5px 11px); }",
      ".pl-balken { position: absolute; height: 18px; min-width: 6px; border-radius: 4px; color: #fff; font-size: 10.5px; line-height: 18px; padding: 0 4px; white-space: nowrap; overflow: hidden; cursor: grab; touch-action: none; user-select: none; }",
      ".pl-griff { position: absolute; top: 0; bottom: 0; width: 5px; cursor: ew-resize; touch-action: none; }",
      ".pl-griff-start { left: 0; } .pl-griff-ende { right: 0; }",
      ".pl-griff:hover { background: rgba(255,255,255,.4); }",
      ".pl-balken.pl-gezogen { z-index: 5; box-shadow: 0 0 0 1px var(--gold); }",
      ".pl-zieht, .pl-zieht * { cursor: ew-resize !important; user-select: none; }",
      ".pl-schiebt, .pl-schiebt * { cursor: grabbing !important; user-select: none; }",
      ".pl-schiebt.pl-verboten, .pl-schiebt.pl-verboten * { cursor: not-allowed !important; }",
      ".pl-balken.pl-quelle { opacity: .35; }",
      ".pl-balken.pl-geist { z-index: 19; box-sizing: border-box; opacity: .92; pointer-events: none; box-shadow: 0 0 0 1px var(--gold), 0 3px 10px rgba(0,0,0,.45); }",
      ".pl-zeile.pl-ziel-ja { background: rgba(63,224,207,.12); box-shadow: inset 0 0 0 2px var(--akzent); }",
      ".pl-zeile.pl-ziel-nein { background: rgba(255,111,97,.14); box-shadow: inset 0 0 0 2px var(--koralle); }",
      ".pl-tipp { position: absolute; z-index: 20; padding: 4px 8px; border: 1px solid var(--kante); border-radius: 6px; background: #08232c; color: var(--text); font-size: 12px; line-height: 1.3; white-space: nowrap; pointer-events: none; }",
      ".pl-tipp-ja { border-color: var(--akzent); }",
      ".pl-tipp-nein { border-color: var(--koralle); color: #ffd9d4; }",
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
