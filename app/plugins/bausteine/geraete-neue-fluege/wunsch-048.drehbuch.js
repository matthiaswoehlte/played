Huelle.drehbuch({
  kennung: 'wunsch-048',
  titel: 'Geräteaufträge der neuen Flüge XC 615 und XA 483',
  von: '07:25',
  bis: '07:50',
  ereignisse: [],
  erwartet: [
    { text: 'XC 615 Tanken liegt auf dem Tankwagen TANK-01.',
      pruefe: [{ pfad: 'geraeteauftraege/XC615-TANK/geraet', gleich: 'TANK-01' },
               { sicht: 'geraete-plan', enthaelt: 'geraeteauftraege/XC615-TANK' }] },
    { text: 'XC 615 Frischwasser liegt auf dem Frischwasserwagen FW-01.',
      pruefe: [{ pfad: 'geraeteauftraege/XC615-FW/geraet', gleich: 'FW-01' },
               { sicht: 'geraete-plan', enthaelt: 'geraeteauftraege/XC615-FW' }] },
    { text: 'XC 615 Beladen liegt auf dem Gepäckschlepper GSL-05.',
      pruefe: [{ pfad: 'geraeteauftraege/XC615-BEL-GSL/geraet', gleich: 'GSL-05' },
               { sicht: 'geraete-plan', enthaelt: 'geraeteauftraege/XC615-BEL-GSL' }] },
    { text: 'Auch XA 483 Tanken steht in der Gerätedisposition.',
      pruefe: [{ sicht: 'geraete-plan', enthaelt: 'geraeteauftraege/XA483-TANK' }] }
  ]
});