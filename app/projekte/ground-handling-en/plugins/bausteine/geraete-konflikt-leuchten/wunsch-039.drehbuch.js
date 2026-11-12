Huelle.drehbuch({
  kennung: 'wunsch-039',
  titel: 'Clicking a conflict highlights its tasks in the equipment plan',
  von: '07:20',
  bis: '07:40',
  ereignisse: [
    { zeit: '07:30', bedienung: 'klicken', greift: 'geraetekonflikte/XC508-BTR_XA619-BTR', sicht: 'geraete-konflikte', erzaehlung: 'The dispatcher clicks the conflict on BTR-02' }
  ],
  erwartet: [
    { text: 'The conflict on BTR-02 is open and shows XA 619 Baggage transport', pruefe: [{ sicht: 'geraete-konflikte', enthaelt: 'geraeteauftraege/XA619-BTR' }] },
    { text: 'XC 508 and XA 619 Baggage transport are highlighted in the plan', pruefe: [{ pfad: 'geraeteanzeige/konfliktliste/hervorgehoben', gleich: ['XC508-BTR', 'XA619-BTR'] }, { sicht: 'geraete-gantt', enthaelt: 'geraeteauftraege/XA619-BTR' }] },
    { text: 'The bars stay where they were: XA 619 Baggage transport is still on BTR-02', pruefe: [{ pfad: 'geraeteauftraege/XA619-BTR/geraet', gleich: 'BTR-02' }] }
  ]
});