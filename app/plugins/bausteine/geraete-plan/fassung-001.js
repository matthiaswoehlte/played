Huelle.plugin({
  kennung: 'geraete-plan',
  titel: 'Gerätedisposition',
  ansicht: {
    ort: 'haupt',
    rang: 20,
    neuBei: ['geraeteauftraege/*.geaendert', 'geraete/*.geaendert', 'fluege/*.geaendert', 'uhr/tag.tick'],
    zeichne: function (el, h) {
      var VON = h.minuten('05:00'), BIS = h.minuten('11:00'), SPANNE = BIS - VON, ZEILE = 22;
      var ARTEN = ['Bodenstromgerät (GPU)', 'Passagiertreppe', 'Gepäckband', 'Container-Hublader', 'Gepäckschlepper mit Wagen',
        'Tankwagen', 'Fäkalienwagen', 'Frischwasserwagen', 'Catering-Hubwagen', 'Flugzeugschlepper (Pushback)'];
      function links(min) { return (Math.max(0, Math.min(SPANNE, min - VON)) / SPANNE * 100).toFixed(3) + '%'; }
      function breite(a, b) { var x = Math.max(VON, a), y = Math.min(BIS, b); return (Math.max(0, y - x) / SPANNE * 100).toFixed(3) + '%'; }
      function attr(t) { return h.esc(String(t)); }
      var geraete = h.alle('geraete') || [];
      var auftraege = h.alle('geraeteauftraege') || [];
      var jeGeraet = {};
      auftraege.forEach(function (a) {
        if (a.geraet) (jeGeraet[a.geraet] = jeGeraet[a.geraet] || []).push(a);
      });
      var arten = ARTEN.slice();
      geraete.forEach(function (g) { if (arten.indexOf(g.art) === -1) arten.push(g.art); });
      var u = h.uhr(), jetzt = typeof u === 'number' ? u : (u ? h.minuten(u) : null);
      var linie = (jetzt !== null && jetzt >= VON && jetzt <= BIS) ? '<i class="pl-gd-jetzt" style="left:' + links(jetzt) + '"></i>' : '';
      var kopf = '';
      for (var s = VON; s <= BIS; s += 60) kopf += '<span class="pl-gd-stunde" style="left:' + links(s) + '">' + h.zeit(s) + '</span>';
      var html = '<div class="pl-gd"><h2 class="pl-gd-titel">Gerätedisposition</h2>' +
        '<div class="pl-gd-rahmen" data-von="' + VON + '" data-bis="' + BIS + '">' +
        '<div class="pl-gd-kopf"><span class="pl-gd-name"></span><span class="pl-gd-achse">' + kopf + '</span></div>' +
        '<div class="pl-gd-zeilen" data-rollen="geraete">';
      arten.forEach(function (art) {
        var liste = geraete.filter(function (g) { return g.art === art; })
          .sort(function (x, y) { return x.kennung < y.kennung ? -1 : 1; });
        if (!liste.length) return;
        html += '<div class="pl-gd-gruppe">' + h.esc(art) + '</div>';
        liste.forEach(function (g) {
          var balken = (jeGeraet[g.kennung] || []).slice().sort(function (x, y) {
            return h.minuten(x.start) - h.minuten(y.start) || (x.kennung < y.kennung ? -1 : 1);
          });
          var spurEnde = [], inhalt = '';
          if (g.wartungVon && g.wartungBis) {
            inhalt += '<div class="pl-gd-wartung" style="left:' + links(h.minuten(g.wartungVon)) + ';width:' +
              breite(h.minuten(g.wartungVon), h.minuten(g.wartungBis)) + '" title="' +
              attr('In Wartung ' + g.wartungVon + '–' + g.wartungBis) + '">Wartung</div>';
          }
          balken.forEach(function (a) {
            var s = h.minuten(a.start), e = h.minuten(a.ende), spur = 0;
            while (spurEnde[spur] !== undefined && spurEnde[spur] > s) spur++;
            spurEnde[spur] = e;
            var flug = h.lies('fluege/' + a.flug + '/flug') || a.flug;
            inhalt += '<div class="pl-gd-balken" data-pfad="geraeteauftraege/' + attr(a.kennung) + '" data-spur="' + spur +
              '" style="left:' + links(s) + ';width:' + breite(s, e) + ';top:' + (3 + spur * ZEILE) + 'px" title="' +
              attr(flug + ' · ' + a.taetigkeit + ' · ' + a.start + '–' + a.ende) + '"><span>' + h.esc(flug) + '</span></div>';
          });
          var hoehe = Math.max(1, spurEnde.length) * ZEILE + 6;
          html += '<div class="pl-gd-zeile" data-pfad="geraete/' + attr(g.kennung) + '" aria-label="' + attr('das Gerät ' + g.kennung) + '">' +
            '<span class="pl-gd-name">' + h.esc(g.kennung) + '</span>' +
            '<span class="pl-gd-spur" style="height:' + hoehe + 'px">' + inhalt + linie + '</span></div>';
        });
      });
      html += '</div></div></div>';
      el.innerHTML = html;
    }
  },
  stil: '.pl-gd{display:flex;flex-direction:column;gap:8px;color:var(--text)}' +
    '.pl-gd-titel{margin:0;font-size:15px;font-weight:600;display:flex;gap:10px;align-items:baseline}' +
    '.pl-gd-rahmen{border:1px solid var(--kante);border-radius:6px;background:var(--glas);overflow:hidden}' +
    '.pl-gd-kopf{display:flex;height:22px;border-bottom:1px solid var(--kante)}' +
    '.pl-gd-name{flex:0 0 80px;padding:0 8px;font-size:12px;color:var(--dim);display:flex;align-items:center}' +
    '.pl-gd-achse{position:relative;flex:1}' +
    '.pl-gd-stunde{position:absolute;top:4px;transform:translateX(-50%);font-size:11px;color:var(--dim)}' +
    '.pl-gd-zeilen{max-height:560px;overflow-y:auto}' +
    '.pl-gd-gruppe{padding:4px 8px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--gold);border-top:1px solid var(--kante)}' +
    '.pl-gd-zeile{display:flex;border-top:1px solid var(--kante)}' +
    '.pl-gd-spur{position:relative;flex:1;display:block}' +
    '.pl-gd-balken{position:absolute;height:18px;line-height:18px;padding:0 4px;box-sizing:border-box;border-radius:4px;background:var(--akzent);color:var(--text);font-size:11px;white-space:nowrap;overflow:hidden;cursor:grab}' +
    '.pl-gd-wartung{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dim);background:repeating-linear-gradient(45deg,rgba(128,128,128,.35) 0 6px,rgba(128,128,128,.15) 6px 12px)}' +
    '.pl-gd-jetzt{position:absolute;top:0;bottom:0;width:2px;background:var(--gold)}'
});
