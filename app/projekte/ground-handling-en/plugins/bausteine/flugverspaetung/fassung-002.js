/* Plugin Flugverspätung: Verspätet sich ein Flug, rücken seine Block-Zeiten und alle seine
   Aufträge um dieselbe Zeit mit. Die Zuweisungen bleiben; was dadurch kollidiert, zeigt der
   Konfliktzähler. Die Zugehörigkeit steckt in der Auftragskennung. Das Verschieben eines
   Auftrags selbst steht im Verhalten „Einsatz ändern“. */
(function () {
  function spaeter(h, wert, min) { return h.zeit(h.minuten(wert) + min); }
  function flugVon(u, h) { return h.lies(u.pfad.split("/").slice(0, 2).join("/")); }

  Huelle.plugin({
    kennung: "flugverspaetung",
    titel: "Flight delay",
    besitzt: ["fluege/*/onBlock", "fluege/*/offBlock"],
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
