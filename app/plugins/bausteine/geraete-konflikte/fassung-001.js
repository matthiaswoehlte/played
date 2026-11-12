Huelle.plugin({
  kennung: 'geraete-konflikte',
  titel: 'Gerätekonflikte',
  ergaenzt: {
    'geraete-plan': {
      neuBei: ['geraeteauftraege/*.geaendert', 'geraete/*.geaendert'],
      zeichne: function (el, h) {
        var FAHRZEIT = 10;
        var geraete = {}, gruende = {}, jeGeraet = {};
        (h.alle('geraete') || []).forEach(function (g) { geraete[g.kennung] = g; });
        function name(a) { return (h.lies('fluege/' + a.flug + '/flug') || a.flug) + ' ' + a.taetigkeit; }
        function merke(a, satz) { (gruende[a.kennung] = gruende[a.kennung] || []).push(satz); }
        (h.alle('geraeteauftraege') || []).forEach(function (a) {
          if (!a.geraet) return;
          (jeGeraet[a.geraet] = jeGeraet[a.geraet] || []).push(a);
          var g = geraete[a.geraet];
          if (!g) return;
          if (a.geraeteart && g.art !== a.geraeteart) merke(a, a.geraet + ' ist kein Gerät der Art ' + a.geraeteart);
          if (g.wartungVon && g.wartungBis && h.minuten(a.start) < h.minuten(g.wartungBis) && h.minuten(a.ende) > h.minuten(g.wartungVon)) {
            merke(a, a.geraet + ' ist von ' + g.wartungVon + ' bis ' + g.wartungBis + ' in Wartung');
          }
        });
        Object.keys(jeGeraet).forEach(function (k) {
          var liste = jeGeraet[k].slice().sort(function (x, y) { return h.minuten(x.start) - h.minuten(y.start); });
          for (var i = 0; i < liste.length; i++) {
            for (var j = i + 1; j < liste.length; j++) {
              var a = liste[i], b = liste[j];
              var luecke = h.minuten(b.start) - h.minuten(a.ende);
              if (luecke < 0) {
                merke(a, 'überschneidet sich auf ' + k + ' mit ' + name(b));
                merke(b, 'überschneidet sich auf ' + k + ' mit ' + name(a));
              } else if (a.flug !== b.flug && luecke < FAHRZEIT) {
                merke(a, 'auf ' + k + ' nur ' + luecke + ' Minuten Fahrzeit bis ' + name(b));
                merke(b, 'auf ' + k + ' nur ' + luecke + ' Minuten Fahrzeit nach ' + name(a));
              }
            }
          }
        });
        var zahl = 0;
        Object.keys(gruende).forEach(function (kennung) {
          var b = el.querySelector('.pl-gd-balken[data-pfad="geraeteauftraege/' + kennung + '"]');
          if (!b) return;
          zahl++;
          b.classList.add('pl-gd-konflikt');
          b.setAttribute('title', (b.getAttribute('title') || '') + ' – ' + gruende[kennung].join(' · '));
        });
        var titel = el.querySelector('.pl-gd-titel');
        if (titel && zahl) {
          titel.insertAdjacentHTML('beforeend', '<span class="pl-gdk-zahl">' + zahl + (zahl === 1 ? ' Geräteauftrag im Konflikt' : ' Geräteaufträge im Konflikt') + '</span>');
        }
      }
    }
  },
  stil: '.pl-gd-balken.pl-gd-konflikt{outline:2px solid var(--koralle);outline-offset:-1px}' +
    '.pl-gdk-zahl{font-size:12px;font-weight:400;color:var(--koralle)}'
});
