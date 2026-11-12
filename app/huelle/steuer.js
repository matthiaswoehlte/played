/* Steuerbereich: das Werkzeug des PO, getrennt vom Nutzbereich (der Anwendung).
   Drei Zustände: „auf“ (alles), „zu“ (nur, was man beim Zuschauen braucht: Spielzeit, Play,
   Von vorn, Erzählzeile, Zähler) und „weg“ (nur die Anwendung, ein kleiner Griff holt ihn zurück).
   Der Zustand bleibt nach dem Neuladen; gespeichert wird erst, wenn der PO umschaltet. */
(function () {
  "use strict";
  var H = window.Huelle;
  var SCHLUESSEL = "play/steuer/1";
  var ZUSTAENDE = ["auf", "zu", "weg"];
  var zustand = "auf";
  var el = {};

  function lade() {
    try {
      var z = JSON.parse(localStorage.getItem(SCHLUESSEL));
      if (z && ZUSTAENDE.indexOf(z.zustand) >= 0) zustand = z.zustand;
    } catch (e) { /* ohne Speicher: aufgeklappt */ }
  }
  function merke() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ zustand: zustand })); }
    catch (e) { /* gilt dann bis zum Neuladen */ }
  }

  function zeige() {
    document.body.setAttribute("data-steuer", zustand);
    el.bereich.hidden = zustand === "weg";
    el.mehr.hidden = zustand !== "auf";
    el.griff.hidden = zustand !== "weg";
    el.auf.textContent = zustand === "auf" ? "Weniger" : "Mehr";
    el.auf.setAttribute("aria-expanded", String(zustand === "auf"));
    el.auf.title = zustand === "auf"
      ? "Nur zeigen, was man beim Zuschauen braucht"
      : "Wunschfeld, Szenarien, Plugins, Abweichungen und Regelverstöße zeigen";
    zaehleMeldungen();
    passeEin();
  }

  /* Zwei Zeilen, nie drei (Anweisung 25 des PO, 09.11.): Reicht die Breite nicht, rücken die Knöpfe rechts in die zweite Zeile.
     Es rückt nur so viel, wie sein muss, von links nach rechts. Gemessen wird in voller Breite, aber ohne die Statuszeile:
     Ihr wechselnder Text darf die Knöpfe nicht hin und her schieben. */
  function passeEin() {
    el.knoepfe.forEach(function (k) { el.rechts.appendChild(k); });
    if (zustand !== "auf") return;
    el.zeile1.classList.add("messen");
    for (var i = 0; i < el.knoepfe.length && el.zeile1.scrollWidth > el.zeile1.clientWidth + 1; i++) el.rechts2.appendChild(el.knoepfe[i]);
    el.zeile1.classList.remove("messen");
  }

  function setze(neu) {
    if (ZUSTAENDE.indexOf(neu) < 0 || neu === zustand) return;
    zustand = neu;
    merke();
    zeige();
  }

  /* Meldungen stehen im aufgeklappten Teil; eingeklappt zeigt ein Zähler, dass welche da sind. */
  function zaehleMeldungen() {
    var n = el.meldungen.querySelectorAll(".meldung").length;
    el.meldungZaehler.hidden = zustand === "auf" || !n;
    el.meldungZaehler.textContent = n === 1 ? "1 Meldung" : n + " Meldungen";
  }

  el.bereich = document.getElementById("steuerbereich");
  el.mehr = document.getElementById("steuerMehr");
  el.auf = document.getElementById("steuerAuf");
  el.weg = document.getElementById("steuerWeg");
  el.griff = document.getElementById("steuerGriff");
  el.meldungen = document.getElementById("meldungen");
  el.meldungZaehler = document.getElementById("meldungZaehler");
  el.zeile1 = el.bereich.querySelector(".steuer-immer");
  el.rechts = document.getElementById("steuerRechts");
  el.rechts2 = document.getElementById("steuerRechts2");
  el.knoepfe = Array.prototype.slice.call(el.rechts.children);

  el.auf.addEventListener("click", function () { setze(zustand === "auf" ? "zu" : "auf"); });
  el.weg.addEventListener("click", function () { setze("weg"); });
  el.griff.addEventListener("click", function () { setze("zu"); });
  el.meldungZaehler.addEventListener("click", function () { setze("auf"); });
  /* Ein Zähler im eingeklappten Band klappt auf; sein eigener Klick öffnet dann die Liste dazu. */
  el.bereich.querySelector(".steuer-zaehler").addEventListener("click", function () {
    if (zustand === "zu") setze("auf");
  }, true);
  new MutationObserver(zaehleMeldungen).observe(el.meldungen, { childList: true });
  var breiten = new MutationObserver(passeEin);
  [document.getElementById("steuerBedienung"), el.bereich.querySelector(".steuer-zaehler"), document.getElementById("projektWahl")].forEach(function (k) {
    breiten.observe(k, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  });
  window.addEventListener("resize", passeEin);

  lade();
  zeige();

  H.steuer = {
    zustand: function () { return zustand; },
    setze: setze
  };
})();
