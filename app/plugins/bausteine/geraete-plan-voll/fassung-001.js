Huelle.plugin({
  kennung: 'geraete-plan-voll',
  titel: 'Gerätedisposition füllt den Platz',
  ergaenzt: {
    'geraete-plan': {
      neuBei: [],
      zeichne: function (el, h) {
        if (!el || !el.classList) return;
        el.classList.add('pl-gv-voll');
        function obersterTeil(knoten) {
          var k = knoten;
          while (k && k.parentNode && k.parentNode !== el) k = k.parentNode;
          return k && k.parentNode === el ? k : null;
        }
        var zeilen = el.querySelector('.pl-gd-zeilen');
        var mitte = zeilen ? obersterTeil(zeilen) : null;
        if (mitte) mitte.classList.add('pl-gv-mitte');
        if (zeilen) zeilen.classList.add('pl-gv-rollt');
        var offen = el.querySelector('.pl-gd-offen-eintrag');
        var unten = offen ? obersterTeil(offen) : null;
        if (unten && unten !== mitte) unten.classList.add('pl-gv-unten');
      }
    }
  },
  stil:
    '.pl-gv-voll { display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: none; height: 100%; min-height: 100%; }' +
    '.pl-gv-voll > * { flex: 0 0 auto; width: 100%; max-width: none; box-sizing: border-box; }' +
    '.pl-gv-voll > .pl-gv-mitte { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }' +
    '.pl-gv-voll .pl-gv-rollt { flex: 1 1 auto; min-height: 0; max-height: none; height: auto; width: 100%; max-width: none; overflow-y: auto; }' +
    '.pl-gv-voll .pl-gd-zeile { width: 100%; max-width: none; box-sizing: border-box; }' +
    '.pl-gv-voll > .pl-gv-unten { flex: 0 0 auto; margin-top: auto; border-top: 1px solid var(--kante); }'
});