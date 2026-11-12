Huelle.plugin({
  kennung: 'geraete-gantt',
  titel: 'Equipment plan',
  ansicht: {
    ort: 'haupt',
    rang: 1,
    neuBei: ['uhr/tag.tick', 'geraeteauftraege/*.geaendert', 'wartungen/*.geaendert'],
    zeichne: function (el, h) {
      var PX = 2, VON = 300, BIS = 1380, TAG = BIS - VON, NAMEN = 180;
      var typen = h.alle('geraetetypen').slice().sort(function (a, b) { return a.reihenfolge - b.reihenfolge; });
      var geraete = h.alle('geraete').slice().sort(function (a, b) { return a.kennung < b.kennung ? -1 : 1; });
      var auftraege = h.alle('geraeteauftraege').slice().sort(function (a, b) {
        var x = a.tag + ' ' + a.start, y = b.tag + ' ' + b.start;
        return x < y ? -1 : x > y ? 1 : (a.kennung < b.kennung ? -1 : 1);
      });
      var wartungen = h.alle('wartungen');
      var tage = [];
      auftraege.concat(wartungen).forEach(function (o) { if (tage.indexOf(o.tag) === -1) tage.push(o.tag); });
      tage.sort();
      var breite = tage.length * TAG * PX;
      var farbe = {};
      typen.forEach(function (t) { farbe[t.kennung] = t.farbe; });
      function x(tag, zeit) { return (tage.indexOf(tag) * TAG + h.minuten(zeit) - VON) * PX; }
      function datum(tag) { var t = tag.split('-'); return t[1] + '/' + t[2] + '/' + t[0]; }
      function lage(o) { return 'left:' + x(o.tag, o.start) + 'px;width:' + Math.max(4, x(o.tag, o.ende) - x(o.tag, o.start)) + 'px'; }

      var kopf = '<div class="pl-gd-kopf"><div class="pl-gd-ecke">Equipment</div>';
      tage.forEach(function (tag) {
        kopf += '<div class="pl-gd-tag" style="width:' + TAG * PX + 'px"><div class="pl-gd-datumzeile"><span class="pl-gd-datum">Date: ' + datum(tag) + '</span></div><div class="pl-gd-stunden">';
        for (var s = VON / 60; s < BIS / 60; s++) {
          kopf += '<span style="left:' + (s * 60 - VON) * PX + 'px">' + (s < 10 ? '0' : '') + s + ':00</span>';
        }
        kopf += '</div></div>';
      });
      kopf += '</div>';

      var zeilen = '';
      typen.forEach(function (t) {
        zeilen += '<div class="pl-gd-gruppe" style="--pl-farbe:' + t.farbe + '"><div class="pl-gd-gname">' + h.esc(t.name) + '</div><div class="pl-gd-gband" style="width:' + breite + 'px"></div></div>';
        geraete.filter(function (g) { return g.typ === t.kennung; }).forEach(function (g) {
          var inhalt = '';
          wartungen.filter(function (w) { return w.geraet === g.kennung; }).forEach(function (w) {
            inhalt += '<div class="pl-gd-wartung" data-pfad="wartungen/' + w.kennung + '" aria-label="' + h.esc(g.name + ' blocked for maintenance ' + w.start + '–' + w.ende) + '" style="' + lage(w) + '">Maintenance</div>';
          });
          auftraege.filter(function (a) { return a.geraet === g.kennung; }).forEach(function (a) {
            inhalt += '<div class="pl-gd-balken" data-pfad="geraeteauftraege/' + a.kennung + '" data-spur="0" title="' + h.esc(a.flug + ' ' + a.arbeit + ' ' + a.start + '–' + a.ende) + '" style="' + lage(a) + ';background:' + farbe[a.typ] + '"><span>' + h.esc(a.flug) + '</span></div>';
          });
          zeilen += '<div class="pl-gd-zeile" data-pfad="geraete/' + g.kennung + '"><div class="pl-gd-name">' + h.esc(g.name) + '</div><div class="pl-gd-bahn" style="width:' + breite + 'px">' + inhalt + '</div></div>';
        });
      });

      var linien = '';
      for (var i = 1; i < tage.length; i++) linien += '<div class="pl-gd-tagwechsel" style="left:' + (NAMEN + i * TAG * PX) + 'px"></div>';
      var u = h.uhr(), jetzt = typeof u === 'number' ? u : h.minuten(String(u));
      if (jetzt >= VON && jetzt <= BIS) linien += '<div class="pl-gd-jetzt" style="left:' + (NAMEN + (jetzt - VON) * PX) + 'px"></div>';

      el.innerHTML = '<div class="pl-gd"><div class="pl-gd-rollen" data-rollen="geraete-gantt"><div class="pl-gd-innen" style="width:' + (NAMEN + breite) + 'px">' + kopf +
        '<div class="pl-rahmen pl-gd-rahmen" data-von="' + VON + '" data-bis="' + (VON + tage.length * TAG) + '">' + zeilen + linien + '</div></div></div></div>';
    }
  },
  stil:
    '.pl-gd { padding: 8px; box-sizing: border-box; }' +
    '.pl-gd-rollen { overflow: auto; height: calc(100vh - 210px); min-height: 360px; border-radius: 8px; }' +
    '.pl-gd-innen { position: relative; }' +
    '.pl-gd-kopf { position: sticky; top: 0; z-index: 6; display: flex; background: #101316; border-bottom: 1px solid var(--kante); }' +
    '.pl-gd-ecke { position: sticky; left: 0; z-index: 7; flex: none; width: 180px; box-sizing: border-box; padding: 0 10px 4px; display: flex; align-items: flex-end; background: #101316; color: var(--dim); font-size: 11px; border-right: 1px solid var(--kante); }' +
    '.pl-gd-tag { position: relative; flex: none; border-left: 1px solid rgba(255,255,255,0.12); }' +
    '.pl-gd-datumzeile { height: 20px; }' +
    '.pl-gd-datum { position: sticky; left: 180px; display: inline-block; padding: 0 8px; line-height: 20px; color: #ff9a3c; font-size: 12px; font-weight: 600; white-space: nowrap; }' +
    '.pl-gd-stunden { position: relative; height: 18px; }' +
    '.pl-gd-stunden span { position: absolute; top: 0; padding-left: 3px; border-left: 1px solid rgba(255,255,255,0.12); font-size: 10px; line-height: 18px; color: var(--dim); }' +
    '.pl-gd-rahmen { position: relative; }' +
    '.pl-gd-gruppe { display: flex; height: 22px; margin-top: 4px; }' +
    '.pl-gd-gname { position: sticky; left: 0; z-index: 4; flex: none; width: 180px; box-sizing: border-box; padding: 0 8px; border-left: 3px solid var(--pl-farbe); background: #14171b; color: var(--pl-farbe); font-size: 12px; font-weight: 700; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.pl-gd-gband { flex: none; background: linear-gradient(90deg, color-mix(in srgb, var(--pl-farbe) 24%, transparent), color-mix(in srgb, var(--pl-farbe) 6%, transparent) 40%); border-bottom: 1px solid color-mix(in srgb, var(--pl-farbe) 35%, transparent); }' +
    '.pl-gd-zeile { display: flex; height: 24px; border-bottom: 1px solid rgba(255,255,255,0.04); }' +
    '.pl-gd-name { position: sticky; left: 0; z-index: 4; flex: none; width: 180px; box-sizing: border-box; padding-left: 16px; background: #121519; border-right: 1px solid var(--kante); color: var(--text); font-size: 12px; line-height: 24px; }' +
    '.pl-gd-bahn { position: relative; flex: none; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 120px); }' +
    '.pl-gd-balken { position: absolute; top: 3px; height: 18px; box-sizing: border-box; padding: 0 4px; border-radius: 4px; overflow: hidden; white-space: nowrap; color: #0b0d10; font-size: 10.5px; font-weight: 600; line-height: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.45); }' +
    '.pl-gd-wartung { position: absolute; top: 3px; height: 18px; box-sizing: border-box; padding: 0 6px; border-radius: 4px; overflow: hidden; white-space: nowrap; background: repeating-linear-gradient(135deg, #6a6f75 0, #6a6f75 6px, #5b6066 6px, #5b6066 12px); color: #eceef0; font-size: 10px; line-height: 18px; }' +
    '.pl-gd-tagwechsel { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.16); z-index: 2; pointer-events: none; }' +
    '.pl-gd-jetzt { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--koralle); box-shadow: 0 0 6px var(--koralle); z-index: 3; pointer-events: none; }'
});
