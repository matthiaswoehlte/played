/* Equipment chart: change start/end by dragging an edge, move the whole bar in time by dragging its middle.
   Dropping a bar on the unassigned list stays with geraet-ablage-ziehen. */
/* Pixels per minute of the equipment chart's time axis. */
function plGProMinute(sicht, h) {
  var r = sicht ? sicht.querySelector(".pl-rahmen") : null;
  if (!r || r.getAttribute("data-von") == null || r.getAttribute("data-bis") == null) return 0;
  var v = String(r.getAttribute("data-von")), b = String(r.getAttribute("data-bis"));
  var von = v.indexOf(":") >= 0 ? h.minuten(v) : Number(v);
  var bis = b.indexOf(":") >= 0 ? h.minuten(b) : Number(b);
  var w = r.scrollWidth || r.getBoundingClientRect().width;
  return (bis > von && w > 0) ? w / (bis - von) : 0;
}

/* Live preview: the bar itself follows the mouse while dragging (move or stretch). */
function plGVorschau(g, n, el, h) {
  var b = el ? el.querySelector('[data-pfad="' + g.pfad + '"]') : null;
  if (!b) return;
  if (b.getAttribute("data-pl-breite") == null) {
    b.setAttribute("data-pl-breite", String(b.offsetWidth));
    b.setAttribute("data-pl-stilbreite", b.style.width || "");
    b.setAttribute("data-pl-stiltrans", b.style.transform || "");
  }
  var a = h.lies(g.pfad);
  if (!n || !n.parameter || !a || n.objekt !== g.pfad) {
    b.style.transform = b.getAttribute("data-pl-stiltrans") || "";
    b.style.width = b.getAttribute("data-pl-stilbreite") || "";
    b.classList.remove("pl-gzieht");
    return;
  }
  var ppm = plGProMinute(el, h);
  if (!ppm) return;
  var w0 = Number(b.getAttribute("data-pl-breite")) || b.offsetWidth;
  var ds = (h.minuten(n.parameter.start) - h.minuten(a.start)) * ppm;
  var de = (h.minuten(n.parameter.ende) - h.minuten(a.ende)) * ppm;
  var t0 = b.getAttribute("data-pl-stiltrans") || "";
  b.style.transform = (t0 ? t0 + " " : "") + "translateX(" + ds + "px)";
  b.style.width = (ds !== de) ? Math.max(4, w0 + de - ds) + "px" : (b.getAttribute("data-pl-stilbreite") || "");
  b.classList.add("pl-gzieht");
}

Huelle.plugin({
  kennung: "geraet-balken-zeit",
  titel: "Move and stretch equipment bars",
  besitzt: ["geraeteauftraege/*/start", "geraeteauftraege/*/ende"],

  abonniert: {
    "geraeteauftraege/*.verschieben": function (m, h) {
      var p = m.parameter || {};
      var a = h.lies(m.objekt);
      if (!a) return;
      if (p.start && p.start !== a.start) h.setze(m.objekt + "/start", p.start);
      if (p.ende && p.ende !== a.ende) h.setze(m.objekt + "/ende", p.ende);
    }
  },

  bedienungen: [
    {
      kennung: "geraet-kante-ziehen",
      titel: "Change start or end by dragging an edge",
      sicht: "geraete-gantt",
      art: "ziehen",
      fasst: ".pl-gkante",
      zeiger: "ew-resize",
      ereignis: function (g, h) {
        var a = h.lies(g.pfad);
        if (!a || !a.geraet) return null;
        var ppm = 0, r = g.sicht ? g.sicht.querySelector(".pl-rahmen") : null;
        if (r && r.getAttribute("data-von") != null && r.getAttribute("data-bis") != null) {
          var v = String(r.getAttribute("data-von")), b = String(r.getAttribute("data-bis"));
          var von = v.indexOf(":") >= 0 ? h.minuten(v) : Number(v);
          var bis = b.indexOf(":") >= 0 ? h.minuten(b) : Number(b);
          var w = r.scrollWidth || r.getBoundingClientRect().width;
          if (bis > von && w > 0) ppm = w / (bis - von);
        }
        var d = ppm ? Math.round((g.dx || 0) / ppm) : 0;
        var kante = g.daten && g.daten.kante;
        var name = a.flug + " " + a.arbeit;
        if (!d) return { hinweis: "Drag sideways to change the " + (kante === "links" ? "start" : "end") + " of " + name };
        var s = h.minuten(a.start), e = h.minuten(a.ende);
        if (kante === "links") {
          var neuStart = h.zeit(Math.min(s + d, e - 5));
          return {
            objekt: g.pfad, aktion: "verschieben",
            parameter: { start: neuStart, ende: a.ende },
            erzaehlung: name + " now starts at " + neuStart,
            hinweis: name + " starts at " + neuStart
          };
        }
        var neuEnde = h.zeit(Math.max(e + d, s + 5));
        return {
          objekt: g.pfad, aktion: "verschieben",
          parameter: { start: a.start, ende: neuEnde },
          erzaehlung: name + " now ends at " + neuEnde,
          hinweis: name + " ends at " + neuEnde
        };
      },
      vorschau: function (g, n, el, h) { plGVorschau(g, n, el, h); }
    },
    {
      kennung: "geraet-balken-verschieben",
      titel: "Move a bar in time on its unit",
      sicht: "geraete-gantt",
      art: "ziehen",
      fasst: '[data-pfad^="geraeteauftraege/"]',
      ziel: '[data-pfad^="geraete/"]',
      rollt: "[data-rollen]",
      ereignis: function (g, h) {
        if (g.ziel && g.ziel.pfad && g.ziel.pfad.indexOf("geraete/") !== 0) return null;
        var a = h.lies(g.pfad);
        if (!a || !a.geraet) return null;
        var ppm = 0, r = g.sicht ? g.sicht.querySelector(".pl-rahmen") : null;
        if (r && r.getAttribute("data-von") != null && r.getAttribute("data-bis") != null) {
          var v = String(r.getAttribute("data-von")), b = String(r.getAttribute("data-bis"));
          var von = v.indexOf(":") >= 0 ? h.minuten(v) : Number(v);
          var bis = b.indexOf(":") >= 0 ? h.minuten(b) : Number(b);
          var w = r.scrollWidth || r.getBoundingClientRect().width;
          if (bis > von && w > 0) ppm = w / (bis - von);
        }
        var d = ppm ? Math.round((g.dx || 0) / ppm) : 0;
        var name = a.flug + " " + a.arbeit;
        if (!d) return { hinweis: "Drag sideways to move " + name + " in time" };
        var s = h.zeit(h.minuten(a.start) + d), e = h.zeit(h.minuten(a.ende) + d);
        return {
          objekt: g.pfad, aktion: "verschieben",
          parameter: { start: s, ende: e },
          erzaehlung: name + " is moved to " + s + "–" + e + " on " + a.geraet,
          hinweis: name + " " + s + "–" + e + ", stays on " + a.geraet
        };
      },
      vorschau: function (g, n, el, h) { plGVorschau(g, n, el, h); }
    }
  ],

  ergaenzt: {
    "geraete-gantt": {
      neuBei: ["geraeteauftraege/*.geaendert"],
      zeichne: function (el, h) {
        var balken = el.querySelectorAll('[data-pfad^="geraeteauftraege/"]');
        for (var i = 0; i < balken.length; i++) {
          var b = balken[i];
          if (b.classList.contains("pl-gbalken")) continue;
          var a = h.lies(b.getAttribute("data-pfad"));
          if (!a || !a.geraet) continue;
          b.classList.add("pl-gbalken");
          var l = document.createElement("span");
          l.className = "pl-gkante pl-gkante-links";
          l.setAttribute("data-kante", "links");
          b.appendChild(l);
          var re = document.createElement("span");
          re.className = "pl-gkante pl-gkante-rechts";
          re.setAttribute("data-kante", "rechts");
          b.appendChild(re);
        }
      }
    }
  },

  beschreibe: {
    "geraeteauftraege/*/start": function (u, h) {
      var a = h.lies(u.pfad.replace(/\/start$/, "")) || {};
      return (a.flug || "") + " " + (a.arbeit || "") + " now starts at " + u.neu + " instead of " + u.alt;
    },
    "geraeteauftraege/*/ende": function (u, h) {
      var a = h.lies(u.pfad.replace(/\/ende$/, "")) || {};
      return (a.flug || "") + " " + (a.arbeit || "") + " now ends at " + u.neu + " instead of " + u.alt;
    }
  },

  beschreibeObjekt: {
    "geraeteauftraege/*": function (o, h) {
      var f = o.felder || {};
      if (!f.start || !f.ende || f.geraet) return null;
      var a = h.lies(o.pfad) || {};
      return (a.flug || "") + " " + (a.arbeit || "") + " now runs " + f.start.neu + "–" + f.ende.neu + " instead of " + f.start.alt + "–" + f.ende.alt;
    }
  },

  stil: ".pl-gkante { position: absolute; top: 0; bottom: 0; width: 6px; cursor: ew-resize; z-index: 2; }\n" +
        ".pl-gkante-links { left: 0; }\n" +
        ".pl-gkante-rechts { right: 0; }\n" +
        ".pl-gbalken:hover > .pl-gkante { background: var(--akzent); opacity: 0.5; }\n" +
        ".pl-gbalken { cursor: grab; }\n" +
        ".pl-gbalken.pl-gzieht { opacity: 0.85; outline: 1px dashed var(--akzent); z-index: 3; }"
});
