(function () {
  /* Je neuer Flug: Tanken, Frischwasser, Beladen mit Gepäckschlepper, mit Gerät. */
  var PLAN = [
    { id: 'XC402', tank: ['05:15', '05:40', 'TANK-02'], fw: ['05:10', '05:25', 'FW-01'], bel: ['05:20', '05:40', 'GSL-05'] },
    { id: 'XA219', tank: ['06:05', '06:30', 'TANK-02'], fw: ['06:00', '06:15', 'FW-01'], bel: ['06:15', '06:35', 'GSL-05'] },
    { id: 'XC615', tank: ['07:35', '08:00', 'TANK-01'], fw: ['07:30', '07:45', 'FW-01'], bel: ['07:40', '08:00', 'GSL-05'] },
    { id: 'XA483', tank: ['08:10', '08:35', 'TANK-01'], fw: ['08:05', '08:20', 'FW-01'], bel: ['08:25', '08:45', 'GSL-05'] },
    { id: 'XC871', tank: ['09:15', '09:40', 'TANK-01'], fw: ['09:10', '09:25', 'FW-01'], bel: ['09:20', '09:40', 'GSL-05'] },
    { id: 'XB956', tank: ['10:00', '10:25', 'TANK-01'], fw: ['09:55', '10:10', 'FW-01'], bel: ['10:05', '10:25', 'GSL-05'] },
    { id: 'XA990', tank: ['10:25', '10:50', 'TANK-01'], fw: ['10:20', '10:35', 'FW-01'], bel: ['10:25', '10:45', 'GSL-05'] }
  ];
  var ARTEN = [
    { feld: 'tank', endung: 'TANK', taetigkeit: 'Tanken' },
    { feld: 'fw', endung: 'FW', taetigkeit: 'Frischwasser' },
    { feld: 'bel', endung: 'BEL-GSL', taetigkeit: 'Beladen' }
  ];
  var AUFTRAEGE = [];
  PLAN.forEach(function (p) {
    ARTEN.forEach(function (a) {
      var w = p[a.feld];
      AUFTRAEGE.push({ kennung: p.id + '-' + a.endung, flug: p.id, taetigkeit: a.taetigkeit, start: w[0], ende: w[1], geraet: w[2] });
    });
  });
  var BESITZT = [];
  AUFTRAEGE.forEach(function (a) {
    ['kennung', 'flug', 'taetigkeit', 'start', 'ende'].forEach(function (f) {
      BESITZT.push('geraeteauftraege/' + a.kennung + '/' + f);
    });
  });

  Huelle.plugin({
    kennung: 'geraete-neue-fluege',
    titel: 'Geräteaufträge der neuen Flüge',
    besitzt: BESITZT,
    beimStart: function (h) {
      AUFTRAEGE.forEach(function (a) {
        h.setze('geraeteauftraege/' + a.kennung, {
          kennung: a.kennung, flug: a.flug, taetigkeit: a.taetigkeit,
          start: a.start, ende: a.ende, geraet: a.geraet
        });
      });
    }
  });
})();