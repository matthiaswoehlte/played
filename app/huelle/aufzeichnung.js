/* Feste Hülle, Teil 7: Von Hand gespielt wird zum Drehbuch.
   Mitgezeichnet ist schon alles: Das Protokoll des Busses hält jede Nachricht seit Tagesbeginn
   fest. Hier wird daraus ein Drehbuch mit allen Anstößen des Tages, auch denen eines vorher
   abgelaufenen Drehbuchs, denn nur so läuft es für sich allein genauso ab.
   Der Endstand wird zur Erwartung im Drehbuch selbst und ist damit eine Datei, kein
   Browserspeicher. Weicht er später ab, ist das eine Abweichung und kein Ausfall: Ein Wunsch
   darf ein gespieltes Ergebnis ändern, der Anforderer erfährt es nur. */
(function () {
  "use strict";
  var H = window.Huelle;
  var ANSTOSS = /^(hand|drehbuecher)\//;
  var el = {};
  var behaltenBis = 0;    // Nummer der letzten Nachricht, die schon in einem Drehbuch steckt

  function handSchritte() {
    return H.bus.protokoll.filter(function (m) { return m.absender && m.absender.indexOf("hand/") === 0; });
  }
  function neueSchritte() {
    return handSchritte().filter(function (m) { return m.nr > behaltenBis; });
  }

  /* Eine Erwartung je Änderung mit eigenem Satz, der Rest gemeinsam, dazu jede Verweigerung. */
  function erwartungen() {
    var bei = H.stand(), out = [], rest = [];
    H.soll.vergleiche({ zustand: H.anfang, sichten: {} }, H.soll.endstand()).forEach(function (u) {
      var pruefung = { pfad: u.pfad, gleich: u.neu === undefined ? null : u.neu };
      var text = H.soll.satz([u], null);
      if (text) out.push({ text: text + ".", pruefe: [pruefung], bei: bei });
      else rest.push(pruefung);
    });
    if (rest.length) out.push({ text: "Auch alles Übrige steht wie beim Spielen.", pruefe: rest, bei: bei });
    H.bus.protokoll.forEach(function (m) {
      if (m.aktion !== "verweigert") return;
      out.push({ text: m.erzaehlung || "Das wird verweigert.", pruefe: [{ nachricht: m.objekt + ".verweigert" }], bei: bei });
    });
    return out;
  }

  function titel(schritte) {
    var erster = schritte.filter(function (m) { return m.erzaehlung; })[0];
    var rest = schritte.length - 1;
    return "Von Hand: " + (erster ? erster.erzaehlung : "gespielte Folge") +
      (rest === 1 ? " und ein weiterer Schritt" : rest > 1 ? " und " + rest + " weitere Schritte" : "");
  }

  function alsDrehbuch() {
    return {
      titel: titel(handSchritte()),
      von: H.startzeit,
      bis: H.uhr.zeit,
      gespielt: true,
      ereignisse: H.bus.protokoll.filter(function (m) { return m.absender && ANSTOSS.test(m.absender); }).map(function (m) {
        return { zeit: m.zeit, objekt: m.objekt, aktion: m.aktion, parameter: m.parameter, erzaehlung: m.erzaehlung };
      }),
      erwartet: erwartungen()
    };
  }

  function zeigeKnopf() {
    var n = neueSchritte().length;
    el.knopf.hidden = !n || !H.wunsch.moeglich();
    el.knopf.textContent = "Als Szenario behalten (" + n + ")";
  }

  function schicke(pfad, methode, inhalt) {
    return fetch(pfad, {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: inhalt === undefined ? undefined : JSON.stringify(inhalt)
    }).then(function (r) {
      if (!r.ok) throw new Error("Antwort " + r.status);
      return r.json();
    });
  }

  function behalten() {
    var d = alsDrehbuch(), endstand = H.soll.endstand(), bis = H.bus.nr;
    el.knopf.disabled = true;
    schicke("/gespielt", "POST", { drehbuch: d }).then(function (a) {
      H.player.spieleEin(function () {
        H.einspielen(a.name, a.quelle);
        H.soll.merke(a.kennung, endstand);
        behaltenBis = bis;
        zeigeKnopf();
        H.player.melde("Behalten: " + d.titel, null, [
          { text: "Vorspielen", tue: function (m) { m.remove(); H.player.spieleDrehbuch(a.kennung); } },
          { text: "Zurücknehmen", tue: function () {
            schicke("/gespielt/" + a.kennung, "DELETE").then(function () { location.reload(); });
          } }
        ]);
      }, { ohneNeustart: true });
    }).catch(function () {
      H.player.melde("Das Szenario ließ sich nicht speichern.");
    }).then(function () {
      el.knopf.disabled = false;
    });
  }

  H.aufzeichnung = {
    alsDrehbuch: alsDrehbuch,
    start: function () {
      el.knopf = document.getElementById("behalten");
      el.knopf.addEventListener("click", behalten);
      H.bus.abonniere("bus/takt.ruhe", zeigeKnopf, "huelle/aufzeichnung");
      H.bus.abonniere("huelle/tag.neu", function () { behaltenBis = 0; zeigeKnopf(); }, "huelle/aufzeichnung");
      zeigeKnopf();
    }
  };
})();
