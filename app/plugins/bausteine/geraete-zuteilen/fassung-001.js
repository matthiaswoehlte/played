Huelle.plugin({
  kennung: 'geraete-zuteilen',
  titel: 'Geräteauftrag zuteilen',
  besitzt: ['geraeteauftraege/*/geraet'],
  abonniert: {
    'geraeteauftraege/*.zuteilen': function (m, h) {
      var geraet = m.parameter && m.parameter.geraet;
      if (!geraet || !h.lies('geraete/' + geraet)) return;
      if (h.lies(m.objekt + '/geraet') === geraet) return;
      h.setze(m.objekt + '/geraet', geraet);
    }
  },
  bedienungen: [{
    kennung: 'geraet-zuteilen',
    titel: 'Auf ein Gerät ziehen',
    sicht: 'geraete-plan',
    art: 'ziehen',
    fasst: '.pl-gd-offen-eintrag, .pl-gd-balken',
    ziel: '.pl-gd-zeile',
    rollt: '.pl-gd-zeilen',
    leer: 'Auf ein Gerät ziehen',
    ereignis: function (g, h) {
      var a = h.lies(g.pfad);
      if (!a || String(g.pfad).indexOf('geraeteauftraege/') !== 0) return null;
      if (!g.ziel || String(g.ziel.pfad).indexOf('geraete/') !== 0) return { hinweis: 'Auf ein Gerät ziehen' };
      var geraet = g.ziel.pfad.split('/')[1];
      if (a.geraet === geraet) return { hinweis: 'Liegt schon auf ' + geraet };
      var name = (h.lies('fluege/' + a.flug + '/flug') || a.flug) + ' ' + a.taetigkeit;
      return {
        objekt: g.pfad,
        aktion: 'zuteilen',
        parameter: { geraet: geraet },
        erzaehlung: a.geraet ? name + ' wechselt von ' + a.geraet + ' auf ' + geraet : name + ' geht auf ' + geraet,
        hinweis: 'Auf ' + geraet + ' legen'
      };
    }
  }],
  beschreibeObjekt: {
    'geraeteauftraege/*': function (o, h) {
      var f = o.felder && o.felder.geraet;
      if (!f) return null;
      var a = h.lies(o.pfad) || {};
      var name = (h.lies('fluege/' + a.flug + '/flug') || a.flug) + ' ' + a.taetigkeit;
      if (!f.neu) return name + ' ist keinem Gerät mehr zugeteilt';
      if (!f.alt) return name + ' ist jetzt ' + f.neu + ' zugeteilt';
      return name + ' wechselt von ' + f.alt + ' auf ' + f.neu;
    }
  }
});
