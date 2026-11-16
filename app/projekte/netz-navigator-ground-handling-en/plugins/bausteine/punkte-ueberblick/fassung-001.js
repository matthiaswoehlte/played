Huelle.plugin({
  kennung: "punkte-ueberblick",
  titel: "Open items on hover",

  /* Adds an overlay to every area box on the map that carries a yellow or red marker.
     It is shown only by CSS while the mouse is over the box: no state, no events. */
  ergaenzt: {
    "karte": {
      neuBei: ["navi/*.geaendert"],
      zeichne: function (el, h) {
        var arten = [
          { feld: "verstoesse", eins: "rule violation", viele: "rule violations", klasse: "pl-pu-rot" },
          { feld: "faelle", eins: "case without a rule", viele: "cases without a rule", klasse: "pl-pu-gelb" },
          { feld: "abweichend", eins: "deviating scenario", viele: "deviating scenarios", klasse: "pl-pu-gelb" },
          { feld: "stimmtnicht", eins: "marked “Not right”", viele: "marked “Not right”", klasse: "pl-pu-rot" }
        ];
        var kaesten = el.querySelectorAll('.nv-kasten[data-pfad^="bereiche/"]');
        for (var i = 0; i < kaesten.length; i++) {
          var kasten = kaesten[i];
          if (!kasten.querySelector(".nv-merk")) continue;
          if (kasten.querySelector(".pl-pu-overlay")) continue;
          var pfad = kasten.getAttribute("data-pfad");
          var zahl = h.lies(pfad + "/zahl");
          if (!zahl) continue;
          var zeilen = [];
          for (var j = 0; j < arten.length; j++) {
            var a = arten[j], n = zahl[a.feld] || 0;
            if (n > 0) zeilen.push('<span class="pl-pu-zeile ' + a.klasse + '"><b>' + n + '</b> ' + h.esc(n === 1 ? a.eins : a.viele) + '</span>');
          }
          if (!zeilen.length) continue;
          var box = document.createElement("span");
          box.className = "pl-pu-overlay";
          box.innerHTML = '<span class="pl-pu-titel">' + h.esc(h.lies(pfad + "/name") || "") + '</span>' + zeilen.join("");
          kasten.classList.add("pl-pu-hat");
          kasten.appendChild(box);
        }
      }
    }
  },

  stil: [
    ".nv-kasten.pl-pu-hat { overflow: visible; }",
    ".nv-kasten.pl-pu-hat:hover { z-index: 40; }",
    ".pl-pu-overlay { display: none; position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);",
    "  z-index: 50; min-width: 200px; padding: 8px 10px; text-align: left; white-space: nowrap;",
    "  background: var(--glas); border: 1px solid var(--kante); border-radius: 8px; color: var(--text);",
    "  font-size: 12px; font-weight: normal; line-height: 1.5; box-shadow: 0 6px 18px rgba(0,0,0,.35); pointer-events: none; }",
    ".nv-kasten.pl-pu-hat:hover > .pl-pu-overlay { display: block; }",
    ".pl-pu-titel { display: block; font-weight: 600; margin-bottom: 4px; }",
    ".pl-pu-zeile { display: block; position: relative; padding-left: 14px; }",
    ".pl-pu-zeile::before { content: ''; position: absolute; left: 0; top: 6px; width: 8px; height: 8px; border-radius: 50%; }",
    ".pl-pu-zeile.pl-pu-rot::before { background: var(--koralle); }",
    ".pl-pu-zeile.pl-pu-gelb::before { background: var(--gold); }"
  ].join("\n")
});