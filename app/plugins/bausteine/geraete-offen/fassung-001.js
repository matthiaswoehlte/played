Huelle.plugin({
  kennung: 'geraete-offen',
  titel: 'Nicht zugeteilte Geräteaufträge',
  ergaenzt: {
    'geraete-plan': {
      neuBei: ['geraeteauftraege/*.geaendert'],
      zeichne: function (el, h) {
        var ziel = el.querySelector('.pl-gd') || el;
        var offen = (h.alle('geraeteauftraege') || []).filter(function (a) { return !a.geraet; })
          .sort(function (x, y) { return h.minuten(x.start) - h.minuten(y.start) || (x.kennung < y.kennung ? -1 : 1); });
        var html = '<section class="pl-gdo"><h3 class="pl-gdo-titel">Nicht zugeteilte Geräteaufträge</h3>';
        if (!offen.length) {
          html += '<p class="pl-gdo-leer">Alle Geräteaufträge sind zugeteilt.</p>';
        } else {
          html += '<div class="pl-gdo-liste">';
          offen.forEach(function (a) {
            var flug = h.lies('fluege/' + a.flug + '/flug') || a.flug;
            html += '<div class="pl-gdo-eintrag pl-gd-offen-eintrag" data-pfad="geraeteauftraege/' + h.esc(a.kennung) + '">' +
              '<b>' + h.esc(flug) + '</b> ' + h.esc(a.taetigkeit) + ' <span>' + h.esc(a.start + '–' + a.ende) + '</span>' +
              ' <em>' + h.esc(a.geraeteart || '') + '</em></div>';
          });
          html += '</div>';
        }
        ziel.insertAdjacentHTML('beforeend', html + '</section>');
      }
    }
  },
  stil: '.pl-gdo{border:1px solid var(--kante);border-radius:6px;background:var(--glas);padding:8px}' +
    '.pl-gdo-titel{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--text)}' +
    '.pl-gdo-leer{margin:0;font-size:12px;color:var(--dim)}' +
    '.pl-gdo-liste{display:flex;flex-wrap:wrap;gap:6px}' +
    '.pl-gdo-eintrag{padding:4px 8px;border:1px dashed var(--akzent);border-radius:4px;font-size:12px;color:var(--text);cursor:grab}' +
    '.pl-gdo-eintrag span{color:var(--dim)}' +
    '.pl-gdo-eintrag em{color:var(--gold);font-style:normal}'
});
