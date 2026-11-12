Huelle.plugin({
  kennung: 'geraete-offen',
  titel: 'Unassigned equipment tasks',
  ansicht: {
    ort: 'seite',
    rang: 2,
    neuBei: ['geraeteauftraege/*.geaendert'],
    zeichne: function (el, h) {
      var typen = {};
      h.alle('geraetetypen').forEach(function (t) { typen[t.kennung] = t; });
      var offen = h.alle('geraeteauftraege').filter(function (a) { return !a.geraet; }).sort(function (a, b) {
        var x = a.tag + ' ' + a.start, y = b.tag + ' ' + b.start;
        return x < y ? -1 : x > y ? 1 : (a.kennung < b.kennung ? -1 : 1);
      });
      function datum(tag) { var t = tag.split('-'); return t[1] + '/' + t[2] + '/' + t[0]; }
      var html = '<div class="pl-go"><div class="pl-go-kopfzeile"><span class="pl-go-zahl">' + offen.length + '</span> Unassigned equipment tasks</div><div class="pl-go-liste" data-rollen="geraete-offen">';
      var tag = null;
      offen.forEach(function (a) {
        if (a.tag !== tag) { tag = a.tag; html += '<div class="pl-go-tag">' + datum(tag) + '</div>'; }
        var t = typen[a.typ] || {};
        html += '<div class="pl-go-eintrag" data-pfad="geraeteauftraege/' + a.kennung + '" style="--pl-farbe:' + (t.farbe || 'var(--dim)') + '">' + h.esc(a.flug + ' ' + a.arbeit + ' ' + a.start + '–' + a.ende) + '<span class="pl-go-typ"> · ' + h.esc(t.einzeln || '') + '</span></div>';
      });
      if (!offen.length) html += '<div class="pl-go-leer">All equipment tasks have a unit</div>';
      el.innerHTML = html + '</div></div>';
    }
  },
  stil:
    '.pl-go { padding: 10px 12px; }' +
    '.pl-go-kopfzeile { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; color: var(--text); font-weight: 600; }' +
    '.pl-go-zahl { font-size: 22px; color: var(--gold); }' +
    '.pl-go-liste { max-height: 40vh; overflow: auto; }' +
    '.pl-go-tag { margin: 8px 0 4px; color: #ff9a3c; font-size: 11px; font-weight: 600; }' +
    '.pl-go-eintrag { margin-bottom: 4px; padding: 5px 8px; border-left: 3px solid var(--pl-farbe); border-radius: 4px; background: rgba(255,255,255,0.03); font-size: 12px; color: var(--text); }' +
    '.pl-go-typ { color: var(--dim); }' +
    '.pl-go-leer { font-size: 12px; color: var(--dim); }'
});
