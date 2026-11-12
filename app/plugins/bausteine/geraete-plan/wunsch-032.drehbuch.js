Huelle.drehbuch({
  kennung: 'wunsch-032',
  titel: 'Offene Geräteaufträge auf Geräte ziehen',
  von: '06:30',
  bis: '06:50',
  ereignisse: [
    { zeit: '06:32', objekt: 'geraeteauftraege/XB214-BEL-GSL', aktion: 'zuteilen', parameter: { geraet: 'GSL-05' },
      erzaehlung: 'XB 214 Beladen geht auf den Gepäckschlepper GSL-05' },
    { zeit: '06:38', objekt: 'geraeteauftraege/XA337-TANK', aktion: 'zuteilen', parameter: { geraet: 'TANK-01' },
      erzaehlung: 'XA 337 Tanken geht auf TANK-01, denn TANK-02 ist ab 07:00 in Wartung' },
    { zeit: '06:44', objekt: 'geraeteauftraege/XA337-FW', aktion: 'zuteilen', parameter: { geraet: 'FW-01' },
      erzaehlung: 'XA 337 Frischwasser geht auf FW-01' }
  ],
  erwartet: [
    { text: 'XB 214 Beladen liegt auf dem Gepäckschlepper GSL-05.',
      pruefe: [{ pfad: 'geraeteauftraege/XB214-BEL-GSL/geraet', gleich: 'GSL-05' }] },
    { text: 'XA 337 Tanken liegt auf dem Tankwagen TANK-01.',
      pruefe: [{ pfad: 'geraeteauftraege/XA337-TANK/geraet', gleich: 'TANK-01' }, { nachricht: 'geraeteauftraege/XA337-TANK.zuteilen' }] },
    { text: 'XA 337 Frischwasser liegt auf dem Frischwasserwagen FW-01.',
      pruefe: [{ pfad: 'geraeteauftraege/XA337-FW/geraet', gleich: 'FW-01' }] },
    { text: 'Die Gerätedisposition zeigt den Tankwagen TANK-01.',
      pruefe: [{ sicht: 'geraete-plan', enthaelt: 'geraete/TANK-01' }] }
  ]
});
