/* Plugin: Ist ein Flug zur geplanten Onblock-Zeit noch nicht am Block, rücken seine offenen Aufträge
   mit der Uhr nach hinten, bis er am Block ist. Der Rückstand wird aus der Uhr gerechnet: Aufträge
   stehen immer so viele Minuten später, wie der Flug über seine Zeit ist. So ist das Ergebnis gleich,
   ob in einer Minute zuerst die Uhr oder zuerst die Meldung vom Vorfeld kommt. Die geplante
   Onblock-Zeit bleibt stehen. Das Verschieben selbst steht im Verhalten „Einsatz ändern“. */
(function () {
  function kennungVon(f) { return f.flug.replace(/\s/g, ""); }

  function nachziehen(h, id) {
    var pfad = "fluege/" + id, f = h.lies(pfad);
    var min = h.minuten(h.uhr()) - h.minuten(f.onBlock) - (f.nachgerueckt || 0);
    if (min <= 0) return;
    h.setze(pfad + "/nachgerueckt", (f.nachgerueckt || 0) + min);
    h.alle("auftraege")
      .filter(function (a) { return a.kennung.indexOf(id + "-") === 0 && a.status === "offen"; })
      .forEach(function (a) {
        h.sende({
          objekt: "auftraege/" + a.kennung, aktion: "verschieben",
          parameter: { minuten: min, grund: "kein-onblock" },
          erzaehlung: null
        });
      });
  }

  Huelle.plugin({
    kennung: "nachruecken-ohne-onblock",
    titel: "Aufträge rücken ohne On-Block",
    besitzt: ["fluege/*/ueberfaellig", "fluege/*/nachgerueckt"],
    beimStart: function (h) {
      h.alle("fluege").forEach(function (f) {
        var pfad = "fluege/" + kennungVon(f);
        h.setze(pfad + "/ueberfaellig", false);
        h.setze(pfad + "/nachgerueckt", 0);
      });
    },
    abonniert: {
      "fluege/*.ohneOnblock": function (m, h) {
        h.setze(m.objekt + "/ueberfaellig", true);
      },
      "uhr/tag.minute": function (m, h) {
        h.alle("fluege").forEach(function (f) {
          if (f.ueberfaellig && f.status === "erwartet") nachziehen(h, kennungVon(f));
        });
      },
      /* Die Minute, in der die Meldung kommt, zählt noch mit. */
      "fluege/*.onblock": function (m, h) {
        if (!h.lies(m.objekt + "/ueberfaellig")) return;
        nachziehen(h, m.objekt.split("/")[1]);
        h.setze(m.objekt + "/ueberfaellig", false);
      }
    },
    erzaehle: {
      "fluege/*.ohneOnblock": function (m, h) {
        var f = h.lies(m.objekt);
        return f ? f.flug + " ist um " + f.onBlock + " noch nicht am Block: Die offenen Aufträge rücken mit der Uhr nach hinten" : null;
      }
    },
    beschreibe: {
      "fluege/*/ueberfaellig": function () { return null; },
      "fluege/*/nachgerueckt": function () { return null; }
    }
  });
})();
