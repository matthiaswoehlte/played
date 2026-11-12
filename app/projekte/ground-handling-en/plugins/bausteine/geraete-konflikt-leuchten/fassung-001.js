Huelle.plugin({
  kennung: 'geraete-konflikt-leuchten',
  titel: 'Highlight conflict tasks in the plan',
  besitzt: ['geraeteanzeige/*/hervorgehoben', 'geraeteanzeige/*/hervorhebung'],
  anzeige: ['geraeteanzeige/*/hervorgehoben', 'geraeteanzeige/*/hervorhebung'],
  beimStart: function (h) {
    h.setze('geraeteanzeige/konfliktliste/hervorgehoben', []);
    h.setze('geraeteanzeige/konfliktliste/hervorhebung', 0);
  },
  abonniert: {
    // Every click on a conflict (open or close) highlights its equipment tasks once more.
    'geraeteanzeige/*.umschalten': function (m, h) {
      var teile = String((m.parameter && m.parameter.konflikt) || '').split('_');
      var auftraege = teile.filter(function (p) { return p && h.lies('geraeteauftraege/' + p); });
      h.setze(m.objekt + '/hervorgehoben', auftraege);
      h.setze(m.objekt + '/hervorhebung', (h.lies(m.objekt + '/hervorhebung') || 0) + 1);
    }
  },
  ergaenzt: (function () {
    var gescrollt = 0, fertig = 0;
    function rahmen(bars) {
      var r = null;
      bars.forEach(function (b) {
        var x = b.getBoundingClientRect();
        if (!r) r = { left: x.left, right: x.right, top: x.top, bottom: x.bottom };
        else {
          r.left = Math.min(r.left, x.left); r.right = Math.max(r.right, x.right);
          r.top = Math.min(r.top, x.top); r.bottom = Math.max(r.bottom, x.bottom);
        }
      });
      return r;
    }
    function insBild(el, bars) {
      var a = bars[0].parentElement;
      while (a) {
        var r = rahmen(bars), c = a.getBoundingClientRect();
        if (a.scrollWidth > a.clientWidth + 1 && (r.left < c.left || r.right > c.right)) {
          a.scrollLeft += (r.left + r.right) / 2 - (c.left + c.right) / 2;
        }
        r = rahmen(bars);
        if (a.scrollHeight > a.clientHeight + 1 && (r.top < c.top || r.bottom > c.bottom)) {
          a.scrollTop += (r.top + r.bottom) / 2 - (c.top + c.bottom) / 2;
        }
        if (a === el) break;
        a = a.parentElement;
      }
    }
    return {
      'geraete-gantt': {
        neuBei: ['geraeteanzeige/*.geaendert'],
        zeichne: function (el, h) {
          var nr = h.lies('geraeteanzeige/konfliktliste/hervorhebung') || 0;
          if (!nr) { gescrollt = 0; fertig = 0; return; }
          if (nr === fertig) return;
          var bars = [];
          (h.lies('geraeteanzeige/konfliktliste/hervorgehoben') || []).forEach(function (id) {
            var b = el.querySelector('[data-pfad="geraeteauftraege/' + id + '"]');
            if (b) bars.push(b);
          });
          if (!bars.length) return;
          // First bring the tasks into view, then let them glow.
          if (nr !== gescrollt) { gescrollt = nr; insBild(el, bars); }
          bars.forEach(function (b) {
            b.classList.add('pl-gkl-leuchten');
            b.addEventListener('animationend', function () {
              fertig = nr;
              b.classList.remove('pl-gkl-leuchten');
            });
          });
        }
      }
    };
  })(),
  beschreibe: {
    'geraeteanzeige/*/hervorgehoben': function () { return null; },
    'geraeteanzeige/*/hervorhebung': function () { return null; }
  },
  stil:
    '@keyframes pl-gkl-blinken {' +
    '  0%, 100% { box-shadow: 0 0 0 0 transparent; outline-color: transparent; }' +
    '  50% { box-shadow: 0 0 10px 4px var(--gold), 0 0 22px 8px var(--gold); outline-color: var(--gold); }' +
    '}' +
    '#nutzbereich[data-teilapp="geraete"] .pl-gkl-leuchten {' +
    '  outline: 2px solid transparent; outline-offset: 1px; z-index: 5;' +
    '  animation: pl-gkl-blinken 0.5s ease-in-out 5;' +
    '}'
});