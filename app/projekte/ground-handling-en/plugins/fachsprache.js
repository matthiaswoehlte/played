/* Plugin Fachsprache: sagt je Änderung am Endstand einen Satz, mit Flug, Arbeit und Person.
   Die Hülle kennt nur Pfade; die Worte für dieses Fachgebiet stehen hier.
   Keine Zähler („14 Einträge mehr“): Wer entscheiden soll, muss sehen, was genau anders ist. */
(function () {
  function auftrag(u, h) { return h.lies(u.pfad.split("/").slice(0, 2).join("/")); }
  function was(a) { return a.flug + " " + a.arbeit; }
  function person(id, h) {
    var m = id ? h.lies("mitarbeiter/" + id) : null;
    return m ? m.name : null;
  }
  function wo(id, h) {
    if (!id) return "in the list ”Unassigned tasks”";
    return "with " + (person(id, h) || id);
  }
  /* Ein Auftrag mit Person: „XC 810 Entladen (V. Engström)“ */
  function auftragText(a, h) {
    return was(a) + " (" + (person(a.mitarbeiter, h) || "unassigned") + ")";
  }
  /* Ein Konflikt: „Überlappung bei F. Ohlsen: XA 337 Fäkalien entleeren und XA 337 Betanken“ */
  function konfliktText(k, h) {
    var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
    if (!a) return "“" + k.art + "”";
    var wer = person(a.mitarbeiter, h);
    return "“" + k.art + "”" + (wer ? " with " + wer : "") + ": " + was(a) + (b ? " and " + (b.flug === a.flug ? b.arbeit : was(b)) : "");
  }
  /* Was ein Pfad in einer Ansicht ist, in Fachsprache; null, wenn er nichts Fachliches ist. */
  function nameVon(pfad, h) {
    var teile = pfad.split("/");
    if (teile[0] === "auftraege") { var a = h.lies(pfad); return a ? auftragText(a, h) : null; }
    if (teile[0] === "konflikte") {
      var k = (h.lies("kennzahlen/konflikte/liste") || []).filter(function (x) { return x.pfad === pfad; })[0];
      return k ? "the conflict " + konfliktText(k, h) : "a conflict that no longer exists in the plan";
    }
    if (teile[0] === "mitarbeiter") return person(teile[1], h);
    if (teile[0] === "fluege") { var f = h.lies(pfad); return f ? f.flug : null; }
    if (pfad === "kennzahlen/konflikte") return "the conflict counter";
    /* Objekte anderer Arten so, wie ihre Teil-App sie nennt: „XC 615 Tanken auf TANK-01“ (Anweisung 53) */
    return h.nenne ? h.nenne(pfad) : null;
  }
  function sicht(u) {
    if (u.pfad === "sichten/gantt") return "In the daily plan";
    if (u.pfad === "sichten/nicht-zugewiesen") return "Under ”Unassigned tasks”";
    return u.titel ? "In ”" + u.titel + "”" : "In the view";
  }
  function gross(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* Eine Ansicht: je Eintrag, der dazukommt, wegfällt oder öfter bzw. seltener markiert ist, ein Satz.
     Gesagt wird, was der Disponent sieht: ein Fachobjekt mit Flug, Arbeit, Person, sonst das, was an
     dem Element steht (Beschriftung, Suchfeld, Ablagefläche; die Hülle liefert es in u.namen). */
  function ansicht(u, h) {
    var wo = sicht(u), out = [], namen = u.namen || {};
    function je(liste, form, formBild, ohneNamen) {
      var fremd = 0;
      liste.forEach(function (p) {
        var n = nameVon(p, h);
        if (n) out.push(form(n));
        else if (namen[p] && formBild) out.push(formBild(namen[p]));
        else fremd++;
      });
      if (fremd && ohneNamen) out.push(wo + " " + (fremd === 1 ? ohneNamen[0] : ohneNamen[1].replace("#", fremd)));
    }
    je(u.weg || [], function (n) { return wo + " there is no longer " + n; }, function (n) { return wo + " there is no longer " + n; },
      ["something without a label that was there before is now missing", "# things without a label that were there before are now missing"]);
    je(u.dazu || [], function (n) { return wo + " there is now also " + n; }, function (n) { return wo + " there is now " + n; },
      ["something without a label has now been added", "# things without a label have now been added"]);
    je(u.mehr || [], function (n) { return wo + " " + n + " is now also marked"; });
    je(u.weniger || [], function (n) { return wo + " " + n + " is now marked less"; });
    return out;
  }

  /* Eine Bedienung, die mehrere Plugins übernehmen wollen, als Satzanfang:
     „Ziehst du einen Balken im Tagesplan auf einen Mitarbeiter (z. B. XC 810 Betanken auf I. Reindl)“ */
  var QUELLE = { "gantt": "a bar in the daily plan", "nicht-zugewiesen": "a task from ”Unassigned tasks”" };
  function bedienungSatz(z, h) {
    var a = z.quelle && z.quelle.indexOf("auftraege/") === 0 ? h.lies(z.quelle) : null;
    if (z.art === "ziehen") {
      var m = z.ziel && z.ziel.indexOf("mitarbeiter/") === 0 ? h.lies(z.ziel) : null;
      if (!a || !m || !QUELLE[z.sicht]) return null;
      return "If you drag " + QUELLE[z.sicht] + " onto an agent (e.g. " + was(a) + " onto " + m.name + ")";
    }
    var n = z.quelle ? nameVon(z.quelle, h) : null;
    if (!n) return null;
    return z.art === "klicken" ? "If you click " + n : "If you type something in " + n + "";
  }

  /* Ein Konflikt kurz: „Überlappung XC 810 Beladen mit XB 933 Entladen“, „Kapazitätslücke bei XC 810 Beladen“.
     Ohne Person: In einer Kette von früher wäre die Person von jetzt falsch. */
  function konfliktKurz(k, h) {
    var a = h.lies("auftraege/" + k.auftrag), b = k.mit ? h.lies("auftraege/" + k.mit) : null;
    if (!a) return k.art;
    return b ? k.art + " " + was(a) + " with " + (b.flug === a.flug ? b.arbeit : was(b)) : k.art + " at " + was(a);
  }
  function liste(xs) { return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]; }

  Huelle.plugin({
    kennung: "fachsprache",
    titel: "Trade language",
    bedienungSatz: bedienungSatz,
    /* Nachrichten in Worten des Fachs, für die Ketten: Namen statt Kennungen */
    erzaehle: {
      "mitarbeiter/*.krankmeldung": function (m, h) {
        var n = person(m.objekt.split("/")[1], h);
        return n ? n + " reports sick from " + m.parameter.ab + " krank" : null;
      },
    },
    /* Mehrere Felder eines Objekts als ein Satz */
    beschreibeObjekt: {
      /* Beginn und Ende zugleich: „XC 810 Entladen (R. Aldinger) läuft jetzt 09:15–09:35 statt 08:55–09:15“ */
      "auftraege/*": function (o, h) {
        var f = o.felder, a = h.lies(o.pfad);
        if (!a || !f.start || !f.ende || Object.keys(f).length !== 2) return null;
        return auftragText(a, h) + " now runs " + f.start.neu + "–" + f.ende.neu + " instead of " + f.start.alt + "–" + f.ende.alt;
      },
      /* „XC 810 ist jetzt von 09:10 bis 10:00 am Boden statt von 08:50 bis 09:40“ */
      "fluege/*": function (o, h) {
        var f = o.felder, fl = h.lies(o.pfad);
        if (!fl || !f.onBlock || !f.offBlock || Object.keys(f).length !== 2) return null;
        return fl.flug + " is now on the ground from " + f.onBlock.neu + " to " + f.offBlock.neu + " instead of " + f.onBlock.alt + " to " + f.offBlock.alt;
      },
      "mitarbeiter/*": function (o, h) {
        var f = o.felder, n = person(o.pfad.split("/")[1], h);
        if (!n || !f.abwesend) return null;
        if (!f.abwesend.neu) return n + " is back";
        var grund = f.grund ? f.grund.neu : h.lies(o.pfad + "/grund");
        var ab = f.abwesendAb ? f.abwesendAb.neu : h.lies(o.pfad + "/abwesendAb");
        return n + " is " + (ab ? "from " + ab + " " : "") + (grund === "krank" ? "reported sick" : "abwesend" + (grund ? " (" + grund + ")" : ""));
      },
      /* „Konflikte steigen von 6 auf 7: Kapazitätslücke bei XC 810 Beladen ist neu“ */
      "kennzahlen/konflikte": function (o, h) {
        var f = o.felder;
        if (!f.wert && !f.liste) return null;
        var altL = f.liste ? f.liste.alt || [] : h.lies(o.pfad + "/liste") || [];
        var neuL = f.liste ? f.liste.neu || [] : altL;
        var von = f.wert ? f.wert.alt : altL.length, auf = f.wert ? f.wert.neu : neuL.length;
        function pfade(l) { return l.map(function (k) { return k.pfad; }); }
        var neu = neuL.filter(function (k) { return pfade(altL).indexOf(k.pfad) === -1; }).map(function (k) { return konfliktKurz(k, h); });
        var weg = altL.filter(function (k) { return pfade(neuL).indexOf(k.pfad) === -1; }).map(function (k) { return konfliktKurz(k, h); });
        var kopf = auf > von ? "Conflicts rise from " + von + " to " + auf : auf < von ? "Conflicts fall from " + von + " to " + auf : "Conflicts stay at " + auf;
        var teile = [];
        if (neu.length) teile.push(liste(neu) + (neu.length === 1 ? " is new" : " are new"));
        if (weg.length) teile.push(liste(weg) + (weg.length === 1 ? " is gone" : " are gone"));
        return kopf + (teile.length ? ": " + teile.join(", ") : "");
      }
    },
    /* Werte im Zustand, die nur der Anzeige dienen: offen/zu, gerade gewähltes Menü */
    anzeige: ["kennzahlen/konflikte/offen", "kennzahlen/statusmenue/*"],
    beschreibe: {
      "auftraege/*/mitarbeiter": function (u, h) {
        var a = auftrag(u, h);
        return a ? was(a) + " is now at " + wo(u.neu, h) + " instead of " + wo(u.alt, h) : null;
      },
      "auftraege/*/start": function (u, h) {
        var a = auftrag(u, h);
        return a ? auftragText(a, h) + " now starts at " + u.neu + " instead of " + u.alt : null;
      },
      "auftraege/*/ende": function (u, h) {
        var a = auftrag(u, h);
        return a ? auftragText(a, h) + " now ends at " + u.neu + " instead of " + u.alt : null;
      },
      /* Die Zahl folgt aus der Liste; gesagt wird, welcher Konflikt kommt oder geht. */
      "kennzahlen/konflikte/wert": function () { return null; },
      "kennzahlen/konflikte/liste": function (u, h) {
        var alt = u.alt || [], neu = u.neu || [], out = [];
        function pfade(l) { return l.map(function (k) { return k.pfad; }); }
        neu.forEach(function (k) { if (pfade(alt).indexOf(k.pfad) === -1) out.push("New conflict " + konfliktText(k, h)); });
        alt.forEach(function (k) { if (pfade(neu).indexOf(k.pfad) === -1) out.push("No more conflict " + konfliktText(k, h)); });
        return out;
      },
      "sichten/*": function (u, h) { return ansicht(u, h).map(gross); }
    }
  });
})();
