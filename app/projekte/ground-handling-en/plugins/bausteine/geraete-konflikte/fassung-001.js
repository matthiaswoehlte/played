Huelle.plugin({
  kennung: 'geraete-konflikte',
  titel: 'Equipment conflicts',
  besitzt: ['geraeteanzeige/*/offen'],
  anzeige: ['geraeteanzeige/*/offen'],
  abonniert: {
    'geraeteanzeige/*.umschalten': function (m, h) {
      var pfad = m.objekt + '/offen';
      var offen = (h.lies(pfad) || []).slice();
      var i = offen.indexOf(m.parameter.konflikt);
      if (i === -1) offen.push(m.parameter.konflikt); else offen.splice(i, 1);
      h.setze(pfad, offen);
    }
  },
  ansicht: {
    ort: 'seite',
    rang: 1,
    neuBei: ['geraeteanzeige/*.geaendert', 'geraeteauftraege/*.geaendert', 'wartungen/*.geaendert'],
    zeichne: function (el, h) {
      var geraete = {};
      h.alle('geraete').forEach(function (g) { geraete[g.kennung] = g; });
      var offen = h.lies('geraeteanzeige/konfliktliste/offen') || [];
      function von(o) { return o.tag + ' ' + o.start; }
      function ueber(a, b) { return a.tag === b.tag && h.minuten(a.start) < h.minuten(b.ende) && h.minuten(b.start) < h.minuten(a.ende); }
      function datum(tag) { var t = tag.split('-'); return t[1] + '/' + t[2]; }
      var auftraege = h.alle('geraeteauftraege').filter(function (a) { return a.geraet; }).sort(function (a, b) {
        return von(a) < von(b) ? -1 : von(a) > von(b) ? 1 : (a.kennung < b.kennung ? -1 : 1);
      });
      var liste = [];
      auftraege.forEach(function (a, i) {
        auftraege.slice(i + 1).forEach(function (b) {
          if (b.geraet === a.geraet && ueber(a, b)) {
            liste.push({ kennung: a.kennung + '_' + b.kennung, geraet: a.geraet, tag: a.tag, beginn: von(b), auftraege: [a, b], titel: a.flug + ' and ' + b.flug + ' overlap' });
          }
        });
      });
      h.alle('wartungen').forEach(function (w) {
        auftraege.forEach(function (a) {
          if (a.geraet === w.geraet && ueber(a, w)) {
            liste.push({ kennung: w.kennung + '_' + a.kennung, geraet: w.geraet, tag: a.tag, beginn: von(a) > von(w) ? von(a) : von(w), wartung: w, auftraege: [a], titel: a.flug + ' ' + a.arbeit + ' during maintenance' });
          }
        });
      });
      liste.sort(function (a, b) { return a.beginn < b.beginn ? -1 : a.beginn > b.beginn ? 1 : (a.kennung < b.kennung ? -1 : 1); });

      var html = '<div class="pl-gk"><div class="pl-gk-kopfzeile"><span class="pl-gk-zahl">' + liste.length + '</span> Conflicts</div><div class="pl-gk-liste" data-rollen="geraete-konflikte">';
      liste.forEach(function (k) {
        var auf = offen.indexOf(k.kennung) !== -1;
        var name = geraete[k.geraet] ? geraete[k.geraet].name : k.geraet;
        var titel = name + ' · ' + k.titel;
        html += '<div class="pl-gk-eintrag' + (auf ? ' pl-gk-auf' : '') + '"><div class="pl-gk-kopf" data-pfad="geraetekonflikte/' + k.kennung + '" data-titel="' + h.esc(titel) + '" aria-label="' + h.esc('the conflict ' + titel) + '"><span class="pl-gk-pfeil">' + (auf ? '▾' : '▸') + '</span><span class="pl-gk-tag">' + datum(k.tag) + '</span> ' + h.esc(titel) + '</div>';
        if (auf) {
          html += '<div class="pl-gk-details">';
          if (k.wartung) {
            html += '<div class="pl-gk-zeile" data-pfad="wartungen/' + k.wartung.kennung + '" aria-label="' + h.esc(name + ' blocked for maintenance ' + k.wartung.start + '–' + k.wartung.ende) + '">Maintenance ' + k.wartung.start + '–' + k.wartung.ende + '</div>';
          }
          k.auftraege.forEach(function (a) {
            html += '<div class="pl-gk-zeile" data-pfad="geraeteauftraege/' + a.kennung + '">' + h.esc(a.flug + ' ' + a.arbeit + ' ' + a.start + '–' + a.ende) + '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      if (!liste.length) html += '<div class="pl-gk-leer">No conflicts</div>';
      el.innerHTML = html + '</div></div>';
    }
  },
  bedienungen: [{
    kennung: 'konflikt-aufklappen',
    titel: 'Expand or collapse a conflict',
    art: 'klicken',
    fasst: '.pl-gk-kopf',
    ereignis: function (g, h) {
      var konflikt = String(g.pfad).split('/')[1];
      var auf = (h.lies('geraeteanzeige/konfliktliste/offen') || []).indexOf(konflikt) !== -1;
      var titel = (g.daten && g.daten.titel) || 'conflict';
      return {
        objekt: 'geraeteanzeige/konfliktliste',
        aktion: 'umschalten',
        parameter: { konflikt: konflikt },
        erzaehlung: (auf ? 'Collapsed: ' : 'Expanded: ') + titel
      };
    }
  }],
  beschreibe: {
    'geraeteanzeige/*/offen': function () { return null; }
  },
  stil:
    '.pl-gk { padding: 10px 12px; margin-bottom: 12px; }' +
    '.pl-gk-kopfzeile { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; color: var(--text); font-weight: 600; }' +
    '.pl-gk-zahl { font-size: 22px; color: var(--koralle); }' +
    '.pl-gk-liste { max-height: 40vh; overflow: auto; }' +
    '.pl-gk-eintrag { border-top: 1px solid var(--kante); }' +
    '.pl-gk-kopf { padding: 6px 2px; cursor: pointer; font-size: 12px; color: var(--text); }' +
    '.pl-gk-pfeil { display: inline-block; width: 14px; color: var(--dim); }' +
    '.pl-gk-tag { margin-right: 4px; color: var(--dim); }' +
    '.pl-gk-details { padding: 0 0 8px 18px; }' +
    '.pl-gk-zeile { padding: 2px 0; font-size: 12px; color: var(--dim); }' +
    '.pl-gk-leer { font-size: 12px; color: var(--dim); }'
});
