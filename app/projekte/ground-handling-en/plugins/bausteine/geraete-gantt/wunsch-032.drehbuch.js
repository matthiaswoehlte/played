Huelle.drehbuch({
  kennung: 'wunsch-032',
  titel: 'Expand a conflict in the equipment plan',
  von: '07:20',
  bis: '07:40',
  ereignisse: [
    { zeit: '07:30', bedienung: 'klicken', greift: 'geraetekonflikte/XC508-BTR_XA619-BTR', sicht: 'geraete-konflikte', erzaehlung: 'The dispatcher opens the conflict on BTR-02' }
  ],
  erwartet: [
    { text: 'The conflict on BTR-02 is open and shows XA 619 Baggage transport 07:31–07:44', pruefe: [{ sicht: 'geraete-konflikte', enthaelt: 'geraeteauftraege/XA619-BTR' }] },
    { text: 'XB 214 Catering is still in the list of unassigned equipment tasks', pruefe: [{ sicht: 'geraete-offen', enthaelt: 'geraeteauftraege/XB214-CAT' }] },
    { text: 'XA 337 Fuelling has no fuel truck yet', pruefe: [{ pfad: 'geraeteauftraege/XA337-FUEL/geraet', gleich: null }] }
  ]
});
