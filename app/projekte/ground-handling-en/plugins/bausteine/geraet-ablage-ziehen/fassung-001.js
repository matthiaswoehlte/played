Huelle.plugin({
  kennung: "geraet-ablage-ziehen",
  titel: "Drag equipment tasks to and from the list",
  besitzt: ["geraeteauftraege/*/geraet"],

  abonniert: {
    "geraeteauftraege/*.loesen": function (m, h) {
      h.setze(m.objekt + "/geraet", null);
    },
    "geraeteauftraege/*.umplanen": function (m, h) {
      var ziel = m.parameter && m.parameter.geraet;
      if (ziel) h.setze(m.objekt + "/geraet", ziel);
    }
  },

  bedienungen: [
    {
      kennung: "geraet-in-ablage",
      titel: "Unassign by dragging into the list",
      sicht: "geraete-gantt",
      art: "ziehen",
      fasst: '[data-pfad^="geraeteauftraege/"]',
      ziel: '[data-pfad="ablagen/geraete-offen"]',
      rollt: '[data-rollen]',
      ereignis: function (g, h) {
        if (!g.ziel || g.ziel.pfad !== "ablagen/geraete-offen") return null;
        var a = h.lies(g.pfad);
        if (!a || !a.geraet) return null;
        return {
          objekt: g.pfad,
          aktion: "loesen",
          parameter: {},
          erzaehlung: a.flug + " " + a.arbeit + " is taken off " + a.geraet,
          hinweis: "Release to unassign " + a.flug + " " + a.arbeit
        };
      }
    },
    {
      kennung: "geraet-aus-ablage",
      titel: "Assign by dragging onto a unit",
      sicht: "geraete-offen",
      art: "ziehen",
      fasst: '[data-pfad^="geraeteauftraege/"]',
      ziel: '[data-pfad^="geraete/"]',
      rollt: '[data-rollen]',
      leer: "Drop on a unit in the chart",
      ereignis: function (g, h) {
        if (!g.ziel || g.ziel.pfad.indexOf("geraete/") !== 0) return null;
        var a = h.lies(g.pfad);
        var gid = g.ziel.pfad.split("/")[1];
        var geraet = h.lies("geraete/" + gid);
        if (!a || !geraet) return null;
        var hinweis = a.flug + " " + a.arbeit + " goes to " + geraet.name + " at " + a.start;
        if (geraet.typ !== a.typ) hinweis = geraet.name + " is a " + geraet.typ + " unit, not " + a.typ + " – this becomes a conflict";
        return {
          objekt: g.pfad,
          aktion: "umplanen",
          parameter: { geraet: gid },
          erzaehlung: a.flug + " " + a.arbeit + " is assigned to " + geraet.name,
          hinweis: hinweis
        };
      }
    }
  ],

  ergaenzt: {
    "geraete-offen": {
      neuBei: [],
      zeichne: function (el, h) {
        el.setAttribute("data-pfad", "ablagen/geraete-offen");
        el.setAttribute("aria-label", "the list of unassigned equipment tasks");
        el.classList.add("pl-ablage");
      }
    },
    "geraete-gantt": {
      neuBei: ["geraeteauftraege/*.geaendert"],
      zeichne: function (el, h) {
        h.alle("geraeteauftraege").forEach(function (a) {
          if (!a.geraet) return;
          var typ = h.lies("geraete/" + a.geraet + "/typ");
          if (!typ || typ === a.typ) return;
          var balken = el.querySelectorAll('[data-pfad="geraeteauftraege/' + a.kennung + '"]');
          Array.prototype.forEach.call(balken, function (b) {
            b.classList.add("pl-falscher-typ");
            b.setAttribute("title", a.flug + " " + a.arbeit + " needs " + a.typ + ", " + a.geraet + " is " + typ);
          });
        });
      }
    },
    "geraete-konflikte": {
      neuBei: ["geraeteauftraege/*.geaendert"],
      zeichne: function (el, h) {
        h.alle("geraeteauftraege").forEach(function (a) {
          if (!a.geraet) return;
          var typ = h.lies("geraete/" + a.geraet + "/typ");
          if (!typ || typ === a.typ) return;
          var z = document.createElement("div");
          z.className = "pl-typ-konflikt";
          z.setAttribute("data-pfad", "geraeteauftraege/" + a.kennung);
          z.textContent = "Wrong equipment type: " + a.flug + " " + a.arbeit + " is on " + a.geraet + " (" + typ + ")";
          el.appendChild(z);
        });
      }
    }
  },

  beschreibe: {
    "geraeteauftraege/*/geraet": function (u, h) {
      var a = h.lies(u.pfad.replace(/\/geraet$/, "")) || {};
      var name = (a.flug || "") + " " + (a.arbeit || "");
      if (!u.neu) return name + " is now unassigned";
      var typ = h.lies("geraete/" + u.neu + "/typ");
      if (typ && a.typ && typ !== a.typ) return name + " is now on " + u.neu + ", a " + typ + " unit – conflict";
      return name + " is now on " + u.neu;
    }
  },

  stil: ".pl-falscher-typ { outline: 2px solid var(--koralle); outline-offset: 1px; }\n" +
        ".pl-typ-konflikt { color: var(--koralle); padding: 4px 0; border-top: 1px solid var(--kante); }\n" +
        ".pl-ablage { min-height: 120px; }"
});