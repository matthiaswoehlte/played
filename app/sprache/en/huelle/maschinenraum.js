/* Maschinenraum (Anweisung 32): Für Entwickler und technische Zuschauer zeigt ein schwebendes Fenster live jede festgehaltene
   Nachricht auf dem Bus: Uhrzeit, Absender, Nachricht mit Pfad, welche Plugins reagiert haben. Es liest nur. Hier ist
   Maschinenraum-Sprache ausdrücklich erlaubt. Ist der Schalter aus, hängt nichts am Bus. Der Takt der Uhr und das Ruhesignal
   werden nicht festgehalten und erscheinen darum nicht. */
(function () {
  "use strict";
  var H = window.Huelle;
  if (location.protocol !== "http:" || new URLSearchParams(location.search).has("nachspielen")) return;

  var HOECHSTENS = 500;   // so viele Zeilen bleiben stehen, damit das Fenster bei langen Läufen nicht wächst
  var knopf = document.getElementById("maschinenraumKnopf");
  var fenster = document.getElementById("maschinenraumFenster");
  var filter, liste, urZustellen = null;

  function knoten(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function passt(zeile) { return zeile.dataset.pfad.indexOf(filter.value.trim()) === 0; }

  /* Auftrag 011, Stufe 2: Plays eigene Absender, Pfade und Aktionen bleiben innen deutsch (Entscheidung des PO vom 10.11.2026);
     in einem englischen Projekt zeigt das Fenster sie englisch. Alles andere kommt aus dem Projekt und ist schon englisch. */
  var PLAY_EN = { huelle: "play", zustand: "state", uhr: "clock", tag: "day", bus: "bus", takt: "beat", ruhe: "idle",
    geaendert: "changed", drehbuecher: "scenarios", bedienung: "action", aufzeichnung: "recording", kette: "chain",
    projekte: "projects", pruefung: "check", punkte: "items", sicht: "view", waechter: "guard", befehl: "command" };
  var ENGLISCH = (window.PLAY_TEILAPP || {}).sprache === "Englisch";
  /* Anweisung 54: Wörter aus Pfaden, Angaben und Kennungen über das Glossar englisch anzeigen (nur Anzeige) */
  var NAMEN = (window.PLAY_TEILAPP || {}).anzeigeNamen || {};
  function anzeige(s) {
    if (!ENGLISCH || !s) return s;
    return String(s).replace(/^(huelle|drehbuecher|uhr|bus)(\/[a-z]+)?/, function (ganz) {
      return ganz.split("/").map(function (w) { return PLAY_EN[w] || w; }).join("/");
    }).replace(/\.(geaendert|ruhe)$/, function (x, a) { return "." + PLAY_EN[a]; })
      .replace(/[A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß]*/g, function (w) { return NAMEN.hasOwnProperty(w) ? NAMEN[w] : w; });
  }

  function leuchte(pfad) {
    document.querySelectorAll("#nutzbereich [data-pfad]").forEach(function (e) {
      if (e.getAttribute("data-pfad") !== pfad) return;
      e.classList.add("leuchtet");
      if (e.scrollIntoView) e.scrollIntoView({ block: "nearest", inline: "nearest" });
      setTimeout(function () { e.classList.remove("leuchtet"); }, 2000);
    });
  }

  // Anweisung 41: sichtbare Zeilen wechseln hell und dunkel; fest vergeben, damit nichts flackert, wenn oben alte Zeilen gehen.
  function letzteSichtbare() {
    for (var z = liste.lastElementChild; z; z = z.previousElementSibling) if (!z.hidden) return z;
    return null;
  }

  function zeile(m) {
    /* Anweisung 49 (e): nur Nachrichten der offenen Teil-App, Uhr und Takt, außer bei „alle Bereiche“ */
    if (!H.nachrichtImBlick(m)) return;
    var z = knoten("div", "mr-zeile");
    /* Anweisung 49 (b): Der Pfad trägt den Namen seiner Teil-App. */
    var voll = (m.teilApp ? m.teilApp + "/" : "") + m.objekt;
    z.dataset.pfad = anzeige(voll);
    z.appendChild(knoten("span", "mr-zeit", String(m.zeit == null ? "" : m.zeit)));
    z.appendChild(knoten("span", "mr-absender", /^hand\//.test(m.absender || "") ? "Dispatcher · " + m.absender : (anzeige(m.absender) || "–")));
    var pfad = knoten("button", "mr-pfad", anzeige(voll + "." + m.aktion));
    pfad.type = "button";
    pfad.title = "Highlight in the app";
    pfad.addEventListener("click", function () { leuchte(m.objekt); });
    z.appendChild(pfad);
    z.appendChild(knoten("span", "mr-reagiert", (m.gerufen || []).length ? "→ " + m.gerufen.map(anzeige).join(", ") : "→ nobody"));
    z.hidden = !passt(z);
    if (!z.hidden) { var vor = letzteSichtbare(); z.classList.toggle("zeile-b", !!vor && !vor.classList.contains("zeile-b")); }
    var unten = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 30;
    liste.appendChild(z);
    while (liste.children.length > HOECHSTENS) liste.removeChild(liste.firstChild);
    if (unten) liste.scrollTop = liste.scrollHeight;
  }

  function baue() {
    var kopf = knoten("div", "punkte-kopf");
    kopf.appendChild(knoten("h2", "", "Engine room"));
    var zu = knoten("button", "", "×");
    zu.type = "button";
    zu.title = "Switch off";
    zu.addEventListener("click", aus);
    kopf.appendChild(zu);
    filter = knoten("input", "mr-filter");
    filter.placeholder = "Filter: start of the path, e.g. disposition/auftraege/";
    filter.setAttribute("aria-label", "Filter by the start of the path");
    filter.addEventListener("input", function () {
      var b = false;
      Array.prototype.forEach.call(liste.children, function (z) { z.hidden = !passt(z); if (!z.hidden) { z.classList.toggle("zeile-b", b); b = !b; } });
    });
    liste = knoten("div", "mr-liste");
    fenster.replaceChildren(kopf, filter, liste);
    kopf.addEventListener("pointerdown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      var r = fenster.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      function zieh(v) {
        fenster.style.left = Math.max(0, v.clientX - dx) + "px";
        fenster.style.top = Math.max(0, v.clientY - dy) + "px";
        fenster.style.right = "auto";
        fenster.style.bottom = "auto";
      }
      function los() { document.removeEventListener("pointermove", zieh); document.removeEventListener("pointerup", los); }
      document.addEventListener("pointermove", zieh);
      document.addEventListener("pointerup", los);
    });
  }

  function an() {
    baue();
    fenster.hidden = false;
    knopf.setAttribute("aria-pressed", "true");
    knopf.classList.add("an");
    urZustellen = H.bus.zustellen;
    /* Erst nach dem Zustellen steht fest, welche Plugins reagiert haben. */
    H.bus.zustellen = function (m) {
      urZustellen.call(this, m);
      if (m.nr) zeile(m);
    };
  }
  function aus() {
    if (urZustellen) H.bus.zustellen = urZustellen;
    urZustellen = null;
    fenster.hidden = true;
    fenster.replaceChildren();
    knopf.setAttribute("aria-pressed", "false");
    knopf.classList.remove("an");
  }

  knopf.addEventListener("click", function () { if (urZustellen) aus(); else an(); });
})();
