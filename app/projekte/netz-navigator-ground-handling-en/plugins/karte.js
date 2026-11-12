/* Karte: die Kinder einer Ebene als Kästen, ganz oben die obersten Bereiche, im Ordner seine Kinder.
   Die Form eines Kastens zeigt den Baustand. Bündel sind berechnet und tragen Zahl und schlechtesten Zustand ihrer Stränge. */
(function () {
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Kästen im Kreis, der erste oben; so bleibt die Lage ohne Zufall jedes Mal gleich. */
  function lage(i, n) {
    if (n === 1) return { x: 500, y: 270 };
    var winkel = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: Math.round(500 + 330 * Math.cos(winkel)), y: Math.round(275 + 175 * Math.sin(winkel)) };
  }

  function zahlText(z) {
    var t = [];
    if (z.verstoesse) t.push(z.verstoesse === 1 ? "1 rule violation" : z.verstoesse + " rule violations");
    if (z.faelle) t.push(z.faelle === 1 ? "1 case without a rule" : z.faelle + " cases without a rule");
    if (z.abweichend) t.push(z.abweichend === 1 ? "1 deviating scenario" : z.abweichend + " deviating scenarios");
    if (z.stimmtnicht) t.push(z.stimmtnicht + " × ”Not right”");
    return t.join(", ");
  }

  /* Bereiche außerhalb des Ordners, die mit einem seiner Kinder verbunden sind: dieselbe Höhe wie der Ordner oder darüber. */
  function aussen(h, kennungen, ordner) {
    if (!ordner) return [];
    var hoehen = [], vorfahren = [];
    for (var k = ordner.kennung; k; k = h.lies("bereiche/" + k + "/eltern")) { vorfahren.push(k); hoehen.push(h.lies("bereiche/" + k + "/eltern") || null); }
    var out = [];
    h.alle("faeden").forEach(function (f) {
      var drin = kennungen.indexOf(f.von) !== -1 ? f.von : kennungen.indexOf(f.nach) !== -1 ? f.nach : null;
      if (!drin) return;
      var anderer = drin === f.von ? f.nach : f.von;
      if (kennungen.indexOf(anderer) !== -1 || vorfahren.indexOf(anderer) !== -1 || out.indexOf(anderer) !== -1) return;
      if (hoehen.indexOf(h.lies("bereiche/" + anderer + "/eltern") || null) !== -1) out.push(anderer);
    });
    return out.sort();
  }

  function legende(h) {
    return '<details class="nv-legende"><summary>Legend</summary><div>' +
      "<p>Red means rule violation or contradiction. Yellow means a decision is waiting or one was withdrawn. Pale means settled.</p>" +
      '<span><i class="nv-mass nv-b-leer"></i>empty</span><span><i class="nv-mass nv-b-daten"></i>data only</span><span><i class="nv-mass"></i>Prototype exists</span>' +
      '<span><i class="nv-linie nv-z-widerspruch"></i>Contradiction</span><span><i class="nv-linie nv-z-instabil"></i>Decision withdrawn or reversed</span>' +
      "</div></details>";
  }

  /* Anweisung 45 (e): die Sicherungen des Projekts, neueste zuerst, je mit „Zurückholen“ */
  function sicherungen(h) {
    var liste = h.alle("sicherungen").sort(function (a, b) { return a.reihe - b.reihe; });
    if (!liste.length) return "";
    return '<details class="nv-legende nv-sicherungen"><summary>Backups (' + liste.length + ")</summary><ul>" + liste.map(function (s) {
      return '<li><time>' + esc(s.zeit) + "</time> " + esc(s.satz) + ' <button class="nv-klick" data-zurueckholen="' + esc(s.kennung) + '" data-zeit="' + esc(s.zeit) + '">Restore</button></li>';
    }).join("") + "</ul></details>";
  }

  Huelle.plugin({
    kennung: "karte",
    titel: "Map of areas",
    bedienungen: [{
      kennung: "punkte", titel: "Show open items", art: "klicken", fasst: "[data-punkte]",
      ereignis: function (g) { return { objekt: "navi/jetzt", aktion: "punktezeigen", parameter: { umfang: g.daten.punkte, titel: g.daten.titel }, erzaehlung: "Shows open items" }; }
    }, {
      kennung: "prototyp", titel: "Start prototype", art: "klicken", fasst: "[data-prototyp]",
      ereignis: function (g) { return { objekt: "bereiche/" + g.daten.prototyp, aktion: "prototypbeginnen", parameter: {}, erzaehlung: "Asks for a prototype" }; }
    }, {
      /* Anweisung 44: Bereich leeren; Play fragt vorher nach und legt eine Sicherung ab. */
      kennung: "leeren", titel: "Clear area", art: "klicken", fasst: "[data-leeren]",
      ereignis: function (g) { return { objekt: "bereiche/" + g.daten.leeren, aktion: "bereichleeren", parameter: {}, erzaehlung: "Asks to clear the area" }; }
    }, {
      /* Anweisung 45 (e): Sicherung zurückholen; Play fragt vorher nach und sichert den jetzigen Stand. */
      kennung: "zurueckholen", titel: "Restore backup", art: "klicken", fasst: "[data-zurueckholen]",
      ereignis: function (g) { return { objekt: "sicherungen/" + g.daten.zurueckholen, aktion: "zurueckholen", parameter: { zeit: g.daten.zeit }, erzaehlung: "Asks to restore the backup" }; }
    }, {
      kennung: "oeffnen", titel: "Open area or bundle", art: "klicken", fasst: "[data-pfad]",
      ereignis: function (g) {
        return { objekt: "navi/jetzt", aktion: "gehen", parameter: { ziel: g.pfad }, erzaehlung: "Opens " + g.daten.name };
      }
    }],
    ansicht: {
      ort: "haupt",
      rang: 2,
      neuBei: ["navi/*.geaendert"],
      zeichne: function (el, h) {
        var pfad = h.lies("navi/jetzt/pfad"), ordner = null;
        if (pfad !== "karte") {
          ordner = pfad.indexOf("bereiche/") === 0 ? h.lies(pfad) : null;
          if (!ordner || !ordner.ordner) { el.innerHTML = ""; return; }
        }
        var eltern = ordner ? ordner.kennung : null;
        var bereiche = h.alle("bereiche").filter(function (b) { return (b.eltern || null) === eltern; });
        var kennungen = bereiche.map(function (b) { return b.kennung; });
        var draussen = aussen(h, kennungen, ordner);
        var sichtbar = kennungen.concat(draussen), orte = {};
        sichtbar.forEach(function (k, i) { orte[k] = lage(i, sichtbar.length); });

        var linien = "", zahlen = "";
        h.alle("faeden").forEach(function (f) {
          var a = orte[f.von], b = orte[f.nach], n = f.straenge.length;
          if (!a || !b) return;
          if (kennungen.indexOf(f.von) === -1 && kennungen.indexOf(f.nach) === -1) return;
          var name = "the bundle between " + h.lies("bereiche/" + f.von + "/name") + " and " + h.lies("bereiche/" + f.nach + "/name");
          var pfadF = "faeden/" + f.kennung;
          linien += '<line class="nv-fadenlinie nv-z-' + f.zustand + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>' +
            '<line class="nv-treffer" data-pfad="' + pfadF + '" data-name="' + esc(name) + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
          zahlen += '<button class="nv-zahl nv-klick nv-z-' + f.zustand + '" data-pfad="' + pfadF + '" data-punkte="' + pfadF + '" data-titel="' + esc(name.replace(/^das /, "The ")) + '" data-name="' + esc(name) + '" title="' + (n === 1 ? "1 thread" : n + " threads") + '" style="left:' +
            ((a.x + b.x) / 20) + "%;top:" + ((a.y + b.y) / 11) + '%">' + n + "</button>";
        });

        var kaesten = sichtbar.map(function (k) {
          var b = h.lies("bereiche/" + k), o = orte[k], z = b.zahl, summe = z.verstoesse + z.faelle + z.abweichend + z.stimmtnicht;
          var unten = b.ordner ? "" : b.baustand === "leer" ? "still empty" : (b.baustand === "daten" ? "data only: " : "") + b.fachobjekte.join(", ");
          return '<button class="nv-kasten nv-klick nv-b-' + b.baustand + (kennungen.indexOf(k) === -1 ? " nv-aussen" : "") + '" data-pfad="bereiche/' + k + '" data-name="' + esc(b.name) +
            '" style="left:' + o.x / 10 + "%;top:" + o.y / 5.5 + '%"><strong>' + esc(b.name) + "</strong>" +
            (b.eltern ? "" : "<span>" + esc(b.verantwortlich || "nobody yet") + "</span>") + (unten ? "<small>" + esc(unten) + "</small>" : "") +
            (summe ? '<em class="nv-merk ' + (z.verstoesse ? "nv-rot" : "nv-gelb") + '" data-punkte="bereiche/' + k + '" data-titel="' + esc(b.name) + '" title="' + esc(zahlText(z)) + '">' + summe + "</em>" : "") + "</button>" +
            (!b.ordner && b.baustand === "leer" ? '<button class="nv-beginnen nv-klick" data-prototyp="' + k + '" style="left:' + o.x / 10 + "%;top:calc(" + o.y / 5.5 + '% + 58px)">Start prototype</button>' :
             !b.ordner && b.prototyp ? '<button class="nv-beginnen nv-leeren nv-klick" data-leeren="' + k + '" style="left:' + o.x / 10 + "%;top:calc(" + o.y / 5.5 + '% + 58px)">Clear area</button>' : "");
        }).join("");

        el.innerHTML = '<div class="nv-flaeche"><svg viewBox="0 0 1000 550" preserveAspectRatio="none">' + linien + "</svg>" + zahlen + kaesten + "</div>" + legende(h) + (ordner ? "" : sicherungen(h));
      }
    }
  });
})();
