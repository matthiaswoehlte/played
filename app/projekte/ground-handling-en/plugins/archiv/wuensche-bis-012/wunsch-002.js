/* Plugin Flugverspätung: Verspätet sich ein Flug, rücken seine Block-Zeiten und alle
   seine Aufträge um dieselbe Zeit mit. Die Zuweisungen bleiben unverändert; was dadurch
   kollidiert, zeigt der Konfliktzähler. Die Zugehörigkeit steckt in der Auftragskennung. */
(function () {
  function zeit(min) {
    return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
  }
  function spaeter(h, wert, min) { return zeit(h.minuten(wert) + min); }
  function flugVon(u, h) { return h.lies(u.pfad.split("/").slice(0, 2).join("/")); }

  Huelle.plugin({
    kennung: "wunsch-001",
    titel: "Flight delay",
    abonniert: {
      "fluege/*.verspaetung": function (m, h) {
        var id = m.objekt.split("/")[1], min = m.parameter.minuten;
        h.setze(m.objekt + "/onBlock", spaeter(h, h.lies(m.objekt + "/onBlock"), min));
        h.setze(m.objekt + "/offBlock", spaeter(h, h.lies(m.objekt + "/offBlock"), min));
        h.alle("auftraege")
          .filter(function (a) { return a.kennung.indexOf(id + "-") === 0; })
          .forEach(function (a) {
            h.sende({
              objekt: "auftraege/" + a.kennung, aktion: "verschieben",
              parameter: { minuten: min, grund: "verspaetung" },
              erzaehlung: "Delay " + a.flug + " → " + a.arbeit + " now " +
                spaeter(h, a.start, min) + "–" + spaeter(h, a.ende, min)
            });
          });
      },
      "auftraege/*.verschieben": function (m, h) {
        var min = m.parameter.minuten;
        h.setze(m.objekt + "/start", spaeter(h, h.lies(m.objekt + "/start"), min));
        h.setze(m.objekt + "/ende", spaeter(h, h.lies(m.objekt + "/ende"), min));
      }
    },
    beschreibe: {
      "fluege/*/onBlock": function (u, h) {
        var f = flugVon(u, h);
        return f ? f.flug + " is now " + u.neu + " instead of " + u.alt + " on block" : null;
      },
      "fluege/*/offBlock": function (u, h) {
        var f = flugVon(u, h);
        return f ? f.flug + " is now " + u.neu + " instead of " + u.alt + " off block" : null;
      }
    }
  });
})();
