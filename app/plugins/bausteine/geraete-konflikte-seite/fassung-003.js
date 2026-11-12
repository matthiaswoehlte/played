Huelle.plugin({
  kennung: "geraete-konflikte-seite",
  titel: "Gerätekonflikte neben dem Plan",
  besitzt: ["kennzahlen/*/konfliktwahl"],
  anzeige: ["kennzahlen/*/konfliktwahl"],

  beimStart: function (h) {
    h.setze("kennzahlen/geraetekonfliktliste/konfliktwahl", null);
  },

  abonniert: {
    "kennzahlen/geraetekonfliktliste.zeigen": function (m, h) {
      var p = m.parameter || {};
      var jetzt = h.lies("kennzahlen/geraetekonfliktliste/konfliktwahl");
      if (!p.schluessel || (jetzt && jetzt.schluessel === p.schluessel)) {
        h.setze("kennzahlen/geraetekonfliktliste/konfliktwahl", null);
      } else {
        h.setze("kennzahlen/geraetekonfliktliste/konfliktwahl", { schluessel: p.schluessel, pfade: (p.pfade || []).slice() });
      }
    }
  },

  ergaenzt: {
    "geraete-plan": {
      neuBei: ["geraeteauftraege/*.geaendert", "geraete/*.geaendert", "kennzahlen/geraetekonfliktliste.geaendert"],
      zeichne: function (el, h) {
        function txt(o, felder) {
          for (var i = 0; i < felder.length; i++) { if (o && o[felder[i]]) return String(o[felder[i]]); }
          return "";
        }
        function nennung(a) {
          var flug = h.lies("fluege/" + txt(a, ["flug"]) + "/flug") || txt(a, ["flug"]);
          return (flug + " " + txt(a, ["taetigkeit", "arbeit", "bezeichnung", "name"])).trim() || "Geräteauftrag";
        }
        function geraetName(g) { return txt(g, ["name", "bezeichnung", "kennzeichen", "kennung"]) || "das Gerät"; }
        function minuten(t) { return t ? h.minuten(t) : null; }

        var geraete = {};
        (h.alle("geraete") || []).forEach(function (g) { geraete[g.kennung] = g; });
        var auftraege = (h.alle("geraeteauftraege") || []).filter(function (a) { return !!a.geraet; });
        auftraege.sort(function (a, b) {
          var d = (minuten(a.start) || 0) - (minuten(b.start) || 0);
          return d !== 0 ? d : (a.kennung < b.kennung ? -1 : a.kennung > b.kennung ? 1 : 0);
        });

        var konflikte = [];
        var jeGeraet = {};
        auftraege.forEach(function (a) { (jeGeraet[a.geraet] = jeGeraet[a.geraet] || []).push(a); });
        Object.keys(jeGeraet).sort().forEach(function (gid) {
          var liste = jeGeraet[gid];
          for (var i = 0; i < liste.length; i++) {
            for (var j = i + 1; j < liste.length; j++) {
              var a = liste[i], b = liste[j];
              var as = minuten(a.start), ae = minuten(a.ende), bs = minuten(b.start), be = minuten(b.ende);
              if (as === null || ae === null || bs === null || be === null) continue;
              if (as < be && bs < ae) {
                konflikte.push({
                  schluessel: "doppelt:" + a.kennung + "+" + b.kennung,
                  art: "Gerät doppelt belegt",
                  start: Math.max(as, bs),
                  pfade: ["geraeteauftraege/" + a.kennung, "geraeteauftraege/" + b.kennung],
                  satz: geraetName(geraete[gid]) + ": " + nennung(a) + " und " + nennung(b) +
                    " überschneiden sich ab " + h.zeit(Math.max(as, bs))
                });
              }
            }
          }
        });
        Object.keys(jeGeraet).sort().forEach(function (gid) {
          var liste = jeGeraet[gid];
          for (var i = 0; i + 1 < liste.length; i++) {
            var a = liste[i], b = liste[i + 1];
            var ae = minuten(a.ende), bs = minuten(b.start);
            if (ae === null || bs === null) continue;
            if (bs >= ae && bs - ae < 10) {
              konflikte.push({
                schluessel: "fahrzeit:" + a.kennung + "+" + b.kennung,
                art: "Zu wenig Fahrzeit",
                start: bs,
                pfade: ["geraeteauftraege/" + a.kennung, "geraeteauftraege/" + b.kennung],
                satz: geraetName(geraete[gid]) + ": zwischen " + nennung(a) + " und " + nennung(b) +
                  " bleiben nur " + (bs - ae) + " Minuten Fahrzeit"
              });
            }
          }
        });
        auftraege.forEach(function (a) {
          var g = geraete[a.geraet];
          var soll = txt(a, ["geraeteart", "geraetetyp", "typ"]);
          var ist = txt(g, ["art", "typ", "geraetetyp"]);
          var ws = g && g.wartungVon ? h.minuten(g.wartungVon) : null, we = g && g.wartungBis ? h.minuten(g.wartungBis) : null;
          var s0 = minuten(a.start), e0 = minuten(a.ende);
          if (ws !== null && we !== null && s0 !== null && e0 !== null && s0 < we && ws < e0) {
            konflikte.push({
              schluessel: "wartung:" + a.kennung,
              art: "Gerät in Wartung",
              start: Math.max(s0, ws),
              pfade: ["geraeteauftraege/" + a.kennung],
              satz: nennung(a) + ": " + geraetName(g) + " ist von " + g.wartungVon + " bis " + g.wartungBis + " in Wartung"
            });
          }
          if (g && soll && ist && soll !== ist) {
            konflikte.push({
              schluessel: "typ:" + a.kennung,
              art: "Falscher Gerätetyp",
              start: minuten(a.start) || 0,
              pfade: ["geraeteauftraege/" + a.kennung],
              satz: nennung(a) + " braucht " + soll + ", " + geraetName(g) + " ist " + ist
            });
          }
        });
        konflikte.sort(function (x, y) {
          return x.start !== y.start ? x.start - y.start : (x.schluessel < y.schluessel ? -1 : 1);
        });

        var gewaehlt = h.lies("kennzahlen/geraetekonfliktliste/konfliktwahl");
        var aktiv = null;
        konflikte.forEach(function (k) { if (gewaehlt && gewaehlt.schluessel === k.schluessel) aktiv = k; });

        var alt = el.querySelector(":scope > .pl-gks-seite");
        if (alt) alt.parentNode.removeChild(alt);
        el.classList.add("pl-gks-mit");

        var html = '<div class="pl-gks-kopf"><span class="pl-gks-titel">Konflikte</span>' +
          '<span class="pl-gks-zahl">' + konflikte.length + '</span></div>';
        if (!konflikte.length) {
          html += '<div class="pl-gks-leer">Keine Konflikte</div>';
        } else {
          html += '<ul class="pl-gks-liste" data-rollen="geraetekonflikte">';
          konflikte.forEach(function (k) {
            html += '<li class="pl-gks-eintrag' + (aktiv && aktiv.schluessel === k.schluessel ? ' pl-gks-aktiv' : '') +
              '" data-pfad="kennzahlen/geraetekonfliktliste" data-schluessel="' + h.esc(k.schluessel) +
              '" data-pfade="' + h.esc(k.pfade.join(" ")) + '" data-satz="' + h.esc(k.satz) +
              '" aria-label="' + h.esc(k.art + ": " + k.satz) + '">' +
              '<span class="pl-gks-art">' + h.esc(k.art) + '</span>' +
              '<span class="pl-gks-satz">' + h.esc(k.satz) + '</span></li>';
          });
          html += '</ul>';
        }
        var seite = document.createElement("aside");
        seite.className = "pl-gks-seite";
        seite.setAttribute("data-pfad", "kennzahlen/geraetekonfliktfeld");
        seite.setAttribute("aria-label", "die Liste der Gerätekonflikte");
        seite.innerHTML = html;
        el.appendChild(seite);

        var titelEl = el.querySelector(".pl-gd-titel");
        if (titelEl) {
          var altZahl = titelEl.querySelector(".pl-gks-imkonflikt");
          if (altZahl) altZahl.parentNode.removeChild(altZahl);
          var zahlEl = document.createElement("span");
          zahlEl.className = "pl-gks-imkonflikt";
          zahlEl.textContent = konflikte.length + " im Konflikt";
          titelEl.appendChild(zahlEl);
        }
        var imKonflikt = {};
        konflikte.forEach(function (k) { k.pfade.forEach(function (p) { imKonflikt[p] = true; }); });
        Array.prototype.forEach.call(el.querySelectorAll('[data-pfad^="geraeteauftraege/"]'), function (b) {
          if (seite.contains(b)) return;
          if (imKonflikt[b.getAttribute("data-pfad")]) b.classList.add("pl-gks-konflikt");
        });

        if (aktiv) {
          var treffer = {};
          aktiv.pfade.forEach(function (p) { treffer[p] = true; });
          Array.prototype.forEach.call(el.querySelectorAll('[data-pfad^="geraeteauftraege/"]'), function (b) {
            if (seite.contains(b)) return;
            if (treffer[b.getAttribute("data-pfad")]) b.classList.add("pl-gks-hervor");
            else b.classList.add("pl-gks-gedimmt");
          });
        }
      }
    }
  },

  bedienungen: [{
    kennung: "geraetekonflikt-im-plan-zeigen",
    titel: "Konflikt im Geräteplan zeigen",
    sicht: "geraete-plan",
    art: "klicken",
    fasst: ".pl-gks-eintrag",
    ereignis: function (g, h) {
      var d = g.daten || {};
      if (!d.schluessel) return null;
      var gewaehlt = h.lies("kennzahlen/geraetekonfliktliste/konfliktwahl");
      var weg = gewaehlt && gewaehlt.schluessel === d.schluessel;
      return {
        objekt: "kennzahlen/geraetekonfliktliste",
        aktion: "zeigen",
        parameter: { schluessel: d.schluessel, pfade: (d.pfade || "").split(" ").filter(Boolean) },
        erzaehlung: weg ? "Hervorhebung im Geräteplan aufgehoben" : "Im Geräteplan gezeigt: " + (d.satz || "Konflikt"),
        hinweis: weg ? "Hervorhebung aufheben" : "Im Geräteplan zeigen"
      };
    }
  }],

  stil:
    '#nutzbereich[data-teilapp="geraete"] .orte > [data-ort="seite"] { display: none; }' +
    '#nutzbereich[data-teilapp="geraete"] .orte > [data-ort="haupt"] { flex: 1 1 100%; width: 100%; max-width: none; grid-column: 1 / -1; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit { display: grid; grid-template-columns: minmax(0, 1fr) 20rem;' +
    ' grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr); gap: .6rem; height: calc(100vh - 8rem); min-height: 28rem; box-sizing: border-box; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit > .pl-gd { display: contents; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit > .pl-gd > .pl-gd-titel { grid-column: 1 / -1; grid-row: 1; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit > .pl-gd > .pl-gd-rahmen { grid-column: 1; grid-row: 2 / span 2; min-height: 0; display: flex; flex-direction: column; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit .pl-gd-kopf { flex: 0 0 auto; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit .pl-gd-zeilen { flex: 1 1 auto; max-height: none; min-height: 0; }' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gks-mit > :not(.pl-gd):not(.pl-gks-seite),' +
    ' #nutzbereich[data-teilapp="geraete"] .pl-gks-mit > .pl-gd > :not(.pl-gd-titel):not(.pl-gd-rahmen) { grid-column: 2; grid-row: 3; min-height: 0; overflow-y: auto; margin: 0; box-sizing: border-box; }' +
    '.pl-gks-seite { grid-column: 2; grid-row: 2; min-height: 0; display: flex; flex-direction: column;' +
    ' border: 1px solid var(--kante); border-radius: 6px; background: var(--glas); padding: .5rem .6rem; box-sizing: border-box; }' +
    '.pl-gks-kopf { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: .4rem; }' +
    '.pl-gks-titel { color: var(--dim); font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; }' +
    '.pl-gks-zahl { color: var(--koralle); font-size: 1.6rem; font-weight: 600; }' +
    '.pl-gks-leer { color: var(--dim); font-size: .85rem; }' +
    '.pl-gks-liste { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1 1 auto; }' +
    '.pl-gks-eintrag { cursor: pointer; padding: .35rem .45rem; margin-bottom: .3rem; border-left: 3px solid var(--koralle);' +
    ' border-radius: 3px; color: var(--text); font-size: .82rem; line-height: 1.3; }' +
    '.pl-gks-eintrag:hover { background: rgba(255,255,255,.06); }' +
    '.pl-gks-eintrag.pl-gks-aktiv { background: rgba(255,255,255,.1); outline: 1px solid var(--koralle); }' +
    '.pl-gks-art { display: block; color: var(--koralle); font-weight: 600; font-size: .75rem; }' +
    '.pl-gks-satz { display: block; }' +
    '.pl-gks-hervor { outline: 2px solid var(--koralle) !important; outline-offset: 1px; z-index: 5; }' +
    '.pl-gks-gedimmt { opacity: .35; }' +
    '.pl-gks-konflikt { box-shadow: inset 0 0 0 2px var(--koralle); }' +
    '.pl-gks-imkonflikt { color: var(--koralle); font-size: 13px; font-weight: 600; }'
});