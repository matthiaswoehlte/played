/* Feste Hülle, Teil 5: Wunsch in Prosa, Ändern und „Stimmt nicht“ an einem Plugin.
   Die innere KI arbeitet im Hintergrund; der Anforderer spielt weiter. Ein Wunsch legt ein
   neues kleines Plugin an oder ändert gezielt genau eines; eine Änderung und ein „Stimmt nicht“
   betreffen immer das Plugin, an dem sie gesagt wurden. Das Ergebnis wird erst unsichtbar
   probegespielt. Läuft das sauber, kommt es in die Seite, sonst bessert die KI einmal nach.
   Danach laufen alle Drehbücher nach wie nach jedem Einspielen. */
(function () {
  "use strict";
  var H = window.Huelle;
  var TAKT_MS = 1200;
  var el = {};
  var offen = 0;         // Aufträge, die noch nicht zu Ende sind; ein Neuladen würde sie verlieren

  var TEXTE = {
    wunsch: { start: "Your request is going to the AI …", arbeit: "Your request is being carried out", fertig: "Done: " },
    aendern: { start: "Your change is going to the AI …", arbeit: "Your change is being carried out", fertig: "Changed: " },
    "stimmt-nicht": { start: "Your report is going to the AI …", arbeit: "Your error is being corrected", fertig: "Corrected: " },
    prototyp: { start: "Your description is going to the AI …", arbeit: "Your prototype is being built", fertig: "Done: " }
  };

  function schicke(pfad, inhalt, methode) {
    return fetch(pfad, {
      method: methode || "POST",
      headers: { "Content-Type": "application/json" },
      body: inhalt === undefined ? undefined : JSON.stringify(inhalt)
    }).then(function (r) {
      /* Lehnt die Brücke ab (z. B. einen Anhang), kommt der Grund als Satz mit. */
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (x) {
        var f = new Error("Response " + r.status);
        f.grund = x && x.grund;
        throw f;
      });
      return r.json();
    });
  }

  /* Hinweis zum laufenden Auftrag; bleibt stehen, bis es ein Ergebnis gibt. */
  function zeige(zeile, text) { zeile.querySelector("span").textContent = text; }

  function beende(zeile, text, knoepfe, wie) {
    offen--;
    zeile.remove();
    H.player.melde(text, null, knoepfe, wie);
  }

  /* Anweisung 33: Der Satz zum Ergebnis, gleich ob gerade fertig oder nach dem Neuladen wieder gezeigt */
  function ergebnisText(a, ueberstimmt) {
    var t = TEXTE[a.art] || TEXTE.wunsch;
    /* Anweisung 57 (c): Was kein Szenario prüfen konnte, heißt nie „Fertig“. */
    var vorsatz = a.ungeprueft ? "Not tested by a scenario, please try it yourself: " : t.fertig;
    var text = a.antwort.art === "nur-regel" && !a.grunddaten ? "" : teilVorsatz(a) + vorsatz + a.antwort.kurz;
    /* Was sich im Prototyp nicht zeigen lässt, wird nicht nachgestellt, sondern vermerkt (Zähler neben dem Wunschfeld). */
    if (a.regel && a.regel.art === "nicht-zeigbar") text += (text ? " " : "") + "This cannot be shown here; it has been noted: " + a.regel.satz;
    else if (a.regel) text += (text ? " " : "") + "From now on this is a rule: " + a.regel.satz;
    /* Bewusst geänderte Erwartungen: je Szenario ein Satz; die alte steht in der Herkunft. */
    (a.erwartungen || []).forEach(function (e) {
      text += " Scenario “" + e.titel + "”: " + e.satz;
    });
    /* Anweisung 49 (d): Was der Wunsch in einer anderen Teil-App braucht, geht dort als Antrag hin. */
    if (a.antragSatz) text += " A proposal also goes to the other area: " + a.antragSatz + ".";
    if (ueberstimmt) {
      text += " Applied despite a rule; " + (ueberstimmt === 1 ? "the violation stays" : "the violations stay") +
        " visible as knowingly accepted.";
    }
    return text;
  }

  /* Vorspielen, Bestätigen, Zurücknehmen: Die Meldung bleibt, bis du bestätigst oder zurücknimmst. */
  function entscheidKnoepfe(a) {
    var ziel = a.antwort.zeigen;
    if (!H.drehbuecher.some(function (d) { return d.kennung === ziel; })) ziel = null;
    /* Eine reine Regel hat nichts vorzuspielen. */
    var liste = a.antwort.art === "nur-regel" ? [] : [{ text: "Play", tue: function () { H.player.spieleDrehbuch(ziel || H.player.drehbuch()); } }];
    function fehlgeschlagen(e) { H.player.melde(e && e.grund ? e.grund : "Play cannot be reached right now.", "fehler"); }
    return liste.concat([
      { text: "Confirm", tue: function (m) {
        schicke("/wunsch/" + a.id + "/bestaetigen", {}).then(function () { m.remove(); }).catch(fehlgeschlagen);
      } },
      { text: "Undo", tue: function () {
        schicke("/wunsch/" + a.id, undefined, "DELETE").then(function () { location.reload(); }).catch(fehlgeschlagen);
      } }
    ]);
  }

  /* Ein Teil eines aufgeteilten Wunsches: „Teil 2 von 3“ */
  function teilVorsatz(a) { return a && a.teil ? "Part " + a.teil.nr + " of " + a.teil.von + ": " : ""; }

  /* Nach einem eingespielten Teil kommt der nächste; die KI baut auf dem vorigen auf. */
  function weiterTeil(a) {
    if (!a.teil || a.teil.nr >= a.teil.von) return;
    offen++;
    var zeile = H.player.melde("Part " + (a.teil.nr + 1) + " of " + a.teil.von + " is going to the AI …", "arbeit");
    schicke("/wunsch/" + a.teil.wunsch + "/weiter", { stand: H.stand(), drehbuch: H.player.drehbuch() }).then(function (t) {
      if (t.fertig) { offen--; zeile.remove(); return; }
      verfolge(t.id, zeile, false);
    }).catch(function () {
      beende(zeile, "The next part did not arrive.");
    });
  }

  /* Wird ein Teil nicht eingespielt, beginnen die übrigen nicht. */
  function restSatz(a) {
    if (!a || !a.teil || a.teil.nr >= a.teil.von) return "";
    return a.teil.von - a.teil.nr === 1 ? " Part " + a.teil.von + " has therefore not been started."
      : " Parts " + (a.teil.nr + 1) + " to " + a.teil.von + " have therefore not been started.";
  }

  /* ueberstimmt: Verstöße, die der PO mit „Trotzdem einspielen“ bewusst in Kauf nimmt
     ungeprueft: kein Szenario hat geprüft, was der Wunsch tut (Anweisung 57 c) */
  function aufnehmen(a, zeile, ueberstimmt, ungeprueft) {
    var t = TEXTE[a.art] || TEXTE.wunsch;
    zeige(zeile, "Applying …");
    if (ungeprueft === undefined) ungeprueft = a.ungeprueft;
    a.ungeprueft = !!ungeprueft;
    var inhalt = { ueberstimmt: (ueberstimmt || []).map(function (v) { return { schluessel: v.schluessel, regel: v.regel, satz: v.satz }; }), ungeprueft: a.ungeprueft };
    schicke("/wunsch/" + a.id + "/behalten", inhalt).then(function () {
      if (inhalt.ueberstimmt.length) return H.waechter.ladeInKauf();
    }).then(function () {
      H.player.spieleEin(function () {
        /* Anweisung 57: Was der Wunsch neu bringt, gehört gleich zur offenen Teil-App, wie im Probelauf und nach dem Neuladen.
           Sonst böte die Seite seine Bedienungen und Ergänzungen bis zum Neuladen nicht an (Request 2: nichts ließ sich greifen). */
        var teilApp = H.teilApp.offen || H.teilApp.heimat;
        a.dateien.forEach(function (d) {
          var q = String(d.quelle || ""), re = /Huelle\.plugin\(\s*\{[\s\S]*?kennung:\s*["']([^"']+)["']/g, x;
          while ((x = re.exec(q))) if (!H.teilApp.plugins[x[1]]) H.teilApp.plugins[x[1]] = teilApp;
          if (/\.drehbuch\.js$/.test(d.name) && !H.teilApp.drehbuecher[a.id]) H.teilApp.drehbuecher[a.id] = teilApp;
        });
        a.dateien.forEach(function (d) { H.einspielen(d.name, d.quelle); });
        /* Ein Wunsch, der zugleich Regel ist: Sie gilt ab jetzt und der Wächter prüft sie. */
        if (a.regel) {
          H.regelEinspielen(a.regel.name, a.regel.quelle);
          H.waechter.neu();
        }
        beende(zeile, ergebnisText(a, inhalt.ueberstimmt.length), entscheidKnoepfe(a), { bleibt: true });
        /* Im Hintergrund: Tut das Plugin mehr oder weniger, als du gesagt hast? */
        if (H.abgleich) H.abgleich.verfolge(a.id);
        if (H.luecken) H.luecken.zeichne();
        weiterTeil(a);
      }, { ohneNeustart: !a.grunddaten });
    }).catch(function () {
      beende(zeile, "The result could not be saved." + restSatz(a));
    });
  }

  /* Für die KI: welche Regel ihr Plugin bricht, und wo */
  function regelBruch(v) {
    return "The plugin breaks a rule in force: " + v.satz + " (at the end of " +
      v.drehbuecher.map(function (t) { return "“" + t + "”"; }).join(", ") + "). A plugin must not break a rule in force.";
  }

  /* Der Mensch entscheidet, die Maschine meldet: Bricht der Wunsch eine Regel, wird er nicht
     verworfen. Der PO liest, welche Regel im Weg steht, und wählt. Bis dahin ändert sich nichts. */
  function entscheiden(a, zeile, verstoesse) {
    var saetze = verstoesse.map(function (v) { return v.satz; }).join(" · ");
    var regel = H.regeln[verstoesse[0].regel];
    var rest = restSatz(a).trim();
    beende(zeile, teilVorsatz(a) + "This would break a rule: " + saetze + " You decide.", [
      { text: "Apply anyway", tue: function (m) {
        m.remove();
        offen++;
        aufnehmen(a, H.player.melde("Applying despite the rule …", "arbeit"), verstoesse);
      } },
      { text: "Change rule", tue: function (m) {
        m.remove();
        schicke("/wunsch/" + a.id, undefined, "DELETE").catch(function () {});
        H.wunsch.regelAendern(verstoesse[0].regel, regel ? regel.satz : "");
        if (rest) H.player.melde(rest, "hinweis");
      } },
      { text: "Discard", tue: function (m) {
        m.remove();
        schicke("/wunsch/" + a.id, undefined, "DELETE").catch(function () {});
        if (rest) H.player.melde(rest, "hinweis");
      } }
    ]);
  }

  /* Anweisung 48 (a, c): Ein Wunsch ändert nur die offene Teil-App, und wer etwas Sichtbares verlangt, muss etwas Sichtbares
     bekommen. Vergleicht, wie die Szenarien vorher und nachher aussehen. Gibt { po, ki } oder null. */
  /* mausGeprueft (Anweisung 58): Eine neue Mausbedienung lief im Szenario mit der Maus; das ist eine sichtbare Wirkung. */
  function sichtPruefung(a, bilder, mausGeprueft) {
    if (!a.antwort || a.antwort.art === "nur-regel" || !bilder.length) return null;
    var t = H.teilApp, offen = t.offen || t.heimat;
    function name(k) { return t.namen[k] || k; }
    function liste(l) { return l.map(function (b) { return "“" + b.titel + "”"; }).join(", "); }
    var anderes = bilder.filter(function (b) { return b.teilApp !== offen && b.anders && !b.daten; });
    if (anderes.length) {
      var welche = anderes.map(function (b) { return name(b.teilApp); }).filter(function (n, i, l) { return l.indexOf(n) === i; });
      return {
        po: "The request would also have changed the look of " + welche.map(function (n) { return "“" + n + "”"; }).join(" and ") + ".",
        ki: "Your change also changes how " + welche.map(function (n) { return "“" + n + "”"; }).join(" and ") + " looks (scenarios " + liste(anderes) +
          "), although nothing changes in the data there. A request changes only the open sub-app “" + name(offen) + "”. Do not touch views of other sub-apps, and limit every rule in `stil` that goes beyond your own `pl-` classes to `#nutzbereich[data-teilapp=\"" + offen + "\"]`."
      };
    }
    var eigene = bilder.filter(function (b) { return b.teilApp === offen; });
    if (a.antwort.sichtbar === true && !mausGeprueft && eigene.length && !eigene.some(function (b) { return b.anders; })) {
      return {
        po: "In “" + name(offen) + "”, everything looks the same as before the request.",
        ki: "The request asks for something visible, but in the trial run “" + name(offen) + "” looks the same with your change as without it (scenarios " + liste(eigene) +
          "). Check whether your rules take effect at all: selector specificity, elements that do not exist in that form, style that the shell overrides. You style the frame of the sub-app (columns in the user area, `.orte` with `[data-ort=\"haupt\"]` and `[data-ort=\"seite\"]`) with `#nutzbereich[data-teilapp=\"" + offen + "\"] .orte`."
      };
    }
    return null;
  }

  /* „Probelauf: 7 von 14 Szenarien, noch etwa 2 s“. fertig und gesamt zählen beide Läufe (ohne und mit
     dem Neuen); ein Szenario ist durch, wenn es in beiden gelaufen ist. */
  function probeSatz(fertig, gesamt, beginn, betroffen) {
    var f = Math.floor(fertig / 2), g = Math.ceil(gesamt / 2), satz = "Trial run: " + f + " of " + g + " scenarios";
    if (betroffen) satz = betroffen + " · " + satz;
    if (fertig && fertig < gesamt) {
      var rest = Math.ceil((Date.now() - beginn) / fertig * (gesamt - fertig) / 1000);
      if (rest > 0) satz += ", about " + rest + " s";
    }
    return satz;
  }

  /* Anweisung 58 (b): Ein Probelauf scheitert nie ohne Grund. Höchstens zwei Sätze, welches Szenario was nicht geschafft hat. */
  function grundSatz(r) {
    var g = (r.gruende || []).filter(function (x, i, l) { return x && l.indexOf(x) === i; });
    if (!g.length) return "The trial run did not go through cleanly.";
    var satz = g.slice(0, 2).map(function (x) { return /[.!?“”]$/.test(x) ? x : x + "."; }).join(" ");
    if (g.length > 2) satz += " Plus " + (g.length - 2) + " more.";
    return satz;
  }

  /* Anweisung 58 (c): Die Bitte um ein Szenario mit der Maus ist keine Nachbesserung; danach bleibt die eine Nachbesserung für einen Fehler. */
  var umSzenarioGebeten = {};

  function probe(a, zeile, nachgebessert) {
    var beginn = Date.now();
    zeige(zeile, "Trial run starting …");
    var regeln = a.regel ? [{ name: a.regel.name, quelle: a.regel.quelle }] : [];
    /* Anweisung 18: nur die Szenarien, in deren Ketten das geänderte Plugin gearbeitet hat; bei einer neuen
       Regel, einem neuen Plugin oder einem, das nur zeichnet, alle. */
    var kennungen = [];
    (a.dateien || []).forEach(function (d) {
      var t = String(d.quelle || ""), re = /Huelle\.plugin\(\s*\{[\s\S]*?kennung:\s*["']([^"']+)["']/g, x;
      while ((x = re.exec(t))) if (kennungen.indexOf(x[1]) === -1) kennungen.push(x[1]);
    });
    var auswahl = regeln.length || a.grunddaten ? null : H.verwaltung.betroffene(kennungen);
    /* Anweisung 67 (b): nur die Szenarien der Teil-App des Wunsches und derer, die über eine Naht von ihr hören.
       Andere Teil-Apps kann ein Wunsch nach der Regel „Hoheit je Teil-App“ nicht berühren. */
    var eigene = H.nachspiel.szenarienDerTeilApp(H.teilApp.offen || H.teilApp.heimat);
    if (eigene) auswahl = (auswahl || eigene).filter(function (k) { return eigene.indexOf(k) !== -1; });
    var betroffen = auswahl ? auswahl.length + " of " + H.drehbuecher.length + " scenarios affected" : null;
    H.nachspiel.probe(a.dateien, regeln, function (r) {
      /* Anweisung 36: Hat ein Plugin mitgewirkt, das die KI nicht kannte, geht der Wunsch einmal mit ihm neu an sie. */
      var fremd = a.mitgegeben ? (r.beteiligt || []).filter(function (k) { return a.mitgegeben.indexOf(k) === -1 && kennungen.indexOf(k) === -1; }) : [];
      if (fremd.length) {
        var was = r.ausfaelle.concat(r.bedienHinweise || [], r.verstoesse.map(regelBruch), r.abweichungen || []);
        return schicke("/wunsch/" + a.id + "/nachreichen", { plugins: fremd, fehler: was.join("\n"), szenarien: r.szenarien || [] }).then(function () {
          /* Anweisung 38: Das Nachreichen ist zugleich die eine Nachbesserung; gelingt sie nicht, entscheidet der PO. */
          verfolge(a.id, zeile, true);
        }).catch(function () {
          beende(zeile, "This could not be done: the connection was lost.");
        });
      }
      /* Anweisung 57 (a): Bringt oder ändert das Neue eine Mausbedienung, muss ein Szenario sie mit der Maus ausführen. */
      var ungeprueft = (r.ungeprueft || []).filter(function () { return a.antwort && a.antwort.art !== "nur-regel"; });
      /* Anweisung 58: Fehlt das Szenario zu einer neuen Mausbedienung, ist „sieht aus wie vorher“ noch kein Befund; erst das Szenario zeigt es. */
      var sicht = sichtPruefung(a, r.bilder || [], r.mausGeprueft || (ungeprueft.length > 0 && !umSzenarioGebeten[a.id]));
      var bedienung = ungeprueft.length ? "Your result adds or changes this mouse action, but no scenario performs it with the mouse: " +
        ungeprueft.map(function (b) { return "“" + b.titel + "” (" + b.schluessel.replace("|", ", action ") + ", " + b.art + ")"; }).join("; ") +
        ". Provide a scenario that performs exactly this action with one `bedienung` step, with the expected end (see “Action in the scenario”). Your plugin stays as it is: return it unchanged (the same `art`, `kennung` and `plugin` or `aenderungen`), plus the scenario in `drehbuch`." : null;
      if (!r.ausfaelle.length && !r.verstoesse.length && !sicht) {
        if (bedienung && !nachgebessert && !umSzenarioGebeten[a.id]) {
          umSzenarioGebeten[a.id] = true;
          return schicke("/wunsch/" + a.id + "/nachbessern", { fehler: bedienung, szenarien: r.szenarien || [] }).then(function () {
            verfolge(a.id, zeile, false);
          }).catch(function () {
            beende(zeile, "This could not be done: the connection was lost.");
          });
        }
        return aufnehmen(a, zeile, null, !!bedienung || !!r.keinSzenario);
      }
      /* Anweisung 58 (c): Bei einem Ausfall oder einer Änderung am Aussehen bessert die KI höchstens zweimal nach, je mit dem neuen Grund; bei einem Regelverstoß einmal, dann entscheidet der PO. */
      var runden = nachgebessert === true ? 1 : nachgebessert || 0;
      if (runden >= 2 || (runden === 1 && !r.ausfaelle.length && !sicht)) {
        if (!r.ausfaelle.length && sicht) return beende(zeile, teilVorsatz(a) + "That could not be done: " + sicht.po + " Nothing on the page has changed." + restSatz(a));
        if (!r.ausfaelle.length) return entscheiden(a, zeile, r.verstoesse);
        return beende(zeile, teilVorsatz(a) + "This could not be done: " + grundSatz(r) + " Nothing on the page has changed." + restSatz(a));
      }
      var fehler = r.ausfaelle.concat(r.bedienHinweise || [], r.verstoesse.map(regelBruch), sicht ? [sicht.ki] : [], bedienung ? [bedienung] : []);
      schicke("/wunsch/" + a.id + "/nachbessern", { fehler: fehler.join("\n"), szenarien: r.szenarien || [] }).then(function () {
        verfolge(a.id, zeile, runden + 1);
      }).catch(function () {
        beende(zeile, "This could not be done: the connection was lost.");
      });
    }, function (fertig, gesamt) { zeige(zeile, probeSatz(fertig, gesamt, beginn, betroffen)); }, auswahl, a.id);
  }

  function verfolge(id, zeile, nachgebessert) {
    function frage() {
      fetch("/wunsch/" + id).then(function (r) { return r.json(); }).then(function (a) {
        var t = TEXTE[a.art] || TEXTE.wunsch;
        /* Der erste Prototyp ist schon gespeichert: Play öffnet die neue Teil-App. */
        if (a.art === "prototyp" && a.status === "behalten") { location.reload(); return; }
        /* Anweisung 46: Der Fortschritt steht auch auf der leeren Fläche der neuen Teil-App. */
        if (a.art === "prototyp" && H.leereFlaeche) {
          if (a.status === "rueckfrage") H.leereFlaeche.zeige("The AI has a question, see above.");
          else if (a.status === "fehlgeschlagen") H.leereFlaeche.zeige(null);
          else if (a.status !== "fertig") H.leereFlaeche.zeige(a.schritt ? a.schritt.charAt(0).toUpperCase() + a.schritt.slice(1) + " …" : "The AI is starting …");
        }
        if (a.status === "fertig") return probe(a, zeile, nachgebessert);
        if (a.status === "rueckfrage") return rueckfrage(a, zeile);
        if (a.status === "antrag") return beende(zeile, teilVorsatz(a) + "This belongs to another area. Play has made a proposal there: " + a.antragSatz + ". The other area decides on it." + restSatz(a));
        if (a.status === "an-play") return beende(zeile, teilVorsatz(a) + a.antwort.anPlay + restSatz(a));
        if (a.status === "fehlgeschlagen") return beende(zeile, teilVorsatz(a) + "That could not be done: " + a.grund + restSatz(a));
        zeige(zeile, (a.teil ? "Part " + a.teil.nr + " of " + a.teil.von + " is being built" : t.arbeit) + ", you can keep playing: AI " + a.schritt);
        setTimeout(frage, TAKT_MS);
      }).catch(function () {
        beende(zeile, "This could not be done: the connection was lost.");
      });
    }
    frage();
  }

  /* Ein Auftrag an die KI: art wunsch, aendern oder stimmt-nicht; ziel ist das Plugin. */
  /* anhaenge: [{ name, daten }] aus H.anhaenge; abgelehnt(grund): wenn die Brücke einen Anhang ablehnt */
  function beauftrage(art, text, ziel, regelZiel, anhaenge, abgelehnt) {
    var t = TEXTE[art];
    offen++;
    var zeile = H.player.melde(t.start, "arbeit");
    var inhalt = { text: text, stand: H.stand(), drehbuch: H.player.drehbuch(), flow: H.tag && H.tag.pfad };
    if (regelZiel) inhalt.regel = regelZiel;
    if (anhaenge && anhaenge.length) inhalt.anhaenge = anhaenge;
    if (art === "stimmt-nicht") inhalt.beobachtet = H.player.beobachtet();
    var pfad = art === "prototyp" ? "/prototyp/" + ziel : ziel ? "/plugin/" + ziel + "/" + art : "/wunsch";
    schicke(pfad, inhalt).then(function (a) {
      verfolge(a.id, zeile, false);
    }).catch(function (f) {
      if (f && f.grund && abgelehnt) { offen--; zeile.remove(); return abgelehnt(f.grund); }
      beende(zeile, (f && f.grund) || "That did not arrive.");
    });
  }

  /* Rückfrage der KI: Antwortfeld mit Anhängen und, wenn sie eine Aufteilung vorschlägt, „So machen“.
     Die Antwort geht mit Wunsch und Rückfrage an die KI zurück; alles steht im Wortlaut in der Herkunft. */
  function rueckfrage(a, zeile) {
    offen--;
    zeile.remove();
    var teile = (!a.teil && a.antwort.teile) || [];
    /* Anweisung 34 (b), 58: Eine Aufteilung in Schritte ist keine fachliche Frage. Schlägt die KI nur Teile vor, setzt Play sie
       von selbst nacheinander um; der PO bestätigt oder nimmt jeden Teil zurück wie jeden Wunsch. */
    if (teile.length > 1) {
      offen++;
      var z0 = H.player.melde("Your request needs " + teile.length + " steps. Part 1 of " + teile.length + " is going to the AI …", "arbeit");
      schicke("/wunsch/" + a.id + "/antwort", { text: "", soMachen: true, anhaenge: [], stand: H.stand(), drehbuch: H.player.drehbuch() }).then(function (x) {
        verfolge(x.id, z0, false);
      }).catch(function () {
        beende(z0, "This could not be done: the connection was lost.");
      });
      return;
    }
    var m = H.player.melde(teilVorsatz(a) + "Question: " + (a.antwort.rueckfrage || ""), "rueckfrage");
    m.dataset.wunsch = a.id;
    var form = document.createElement("form");
    form.className = "rueckfrage-antwort";
    if (teile.length) {
      var ol = document.createElement("ol");
      ol.className = "rueckfrage-teile";
      teile.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ol.appendChild(li); });
      form.appendChild(ol);
    }
    var feld = document.createElement("textarea");
    feld.rows = 2;
    feld.placeholder = teile.length ? "Your answer, or “Do it this way” for this order" : "Your answer";
    feld.setAttribute("aria-label", "Your answer to the question");
    form.appendChild(feld);
    var knoepfe = document.createElement("div");
    knoepfe.className = "knopfzeile";
    var los = document.createElement("button");
    los.type = "submit";
    los.textContent = "Answer";
    los.title = "Strg+Enter";
    knoepfe.appendChild(los);
    var so = null;
    if (teile.length) {
      so = document.createElement("button");
      so.type = "button";
      so.className = "so-machen";
      so.textContent = "Do it this way";
      so.title = "Build the parts one after another, one small plugin each";
      knoepfe.appendChild(so);
    }
    form.appendChild(knoepfe);
    var anh = H.anhaenge.an(feld, []);
    form.appendChild(anh.zeile);
    m.appendChild(form);
    strgEnter(feld, form);

    function antworten(soMachen) {
      var text = feld.value.trim();
      if (!text && !soMachen) return;
      los.disabled = true;
      if (so) so.disabled = true;
      anh.holen().then(function (anhaenge) {
        return schicke("/wunsch/" + a.id + "/antwort", { text: text, soMachen: soMachen, anhaenge: anhaenge, stand: H.stand(), drehbuch: H.player.drehbuch() });
      }).then(function (x) {
        m.remove();
        offen++;
        var z = H.player.melde(soMachen ? "Part 1 of " + teile.length + " is going to the AI …" : "Your answer is going to the AI …", "arbeit");
        verfolge(x.id, z, false);
      }).catch(function (f) {
        los.disabled = false;
        if (so) so.disabled = false;
        anh.sage((f && f.grund) || "The answer did not arrive.");
      });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); antworten(false); });
    if (so) so.addEventListener("click", function () { antworten(true); });
  }

  /* Enter macht eine neue Zeile, Strg+Enter schickt ab. */
  function strgEnter(feld, form) {
    feld.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
  }

  function absenden(e) {
    e.preventDefault();
    var text = el.feld.value.trim();
    if (!text) return;
    /* Nach „Regel ändern“ gilt der nächste Wunsch dieser Regel, solange der Anfang im Feld noch steht. */
    var ziel = regelZiel && text.indexOf(regelZiel.anfang.trim()) === 0 ? regelZiel.kennung : null;
    var gemerkt = regelZiel, proto = prototypZiel;
    el.feld.value = "";
    regelZiel = null;
    if (proto) { prototypZiel = null; el.feld.placeholder = feldTextNormal; }
    el.anhaenge.holen().then(function (anhaenge) {
      el.anhaenge.leeren();
      /* Lehnt die Brücke einen Anhang ab, steht der Wunsch wieder im Feld, mit dem Grund darunter. */
      beauftrage(proto ? "prototyp" : "wunsch", text, proto ? proto.bereich : null, proto ? null : ziel, anhaenge, function (grund) {
        el.feld.value = text;
        regelZiel = gemerkt;
        if (proto) H.wunsch.prototypBeginnen(proto);
        el.anhaenge.sage(grund);
      });
    });
  }

  var regelZiel = null;   // { kennung, anfang } nach „Regel ändern“
  var prototypWartet = null, prototypZiel = null, feldTextNormal = "";   // { bereich, name } nach „Prototyp beginnen“

  H.wunsch = {
    probeSatz: probeSatz,
    moeglich: function () { return location.protocol === "http:"; },
    offen: function () { return offen; },

    /* Aus der Leiste: „Ändern“ und „Stimmt nicht“ an einem Plugin */
    aendere: function (kennung, text, anhaenge) { beauftrage("aendern", text, kennung, null, anhaenge); },
    stimmtNicht: function (kennung, text, anhaenge) { beauftrage("stimmt-nicht", text, kennung, null, anhaenge); },
    strgEnter: strgEnter,

    /* Neue Fassung einer Regel ohne Umweg über das Wunschfeld (aus dem Abgleich: „Wie gesagt“) */
    regelNeu: function (kennung, text) { beauftrage("wunsch", text, null, kennung); },

    /* „Prototyp beginnen“: Das Wunschfeld nimmt die Beschreibung auf, Anhänge wie beim Wunsch. */
    prototypBeginnen: function (z) {
      /* Erst anbieten, wenn das Abschicken eingerichtet ist; sonst ginge der Text beim Abschicken verloren. */
      if (!el.form) { prototypWartet = z; return; }
      prototypZiel = z;
      if (!feldTextNormal) feldTextNormal = el.feld.placeholder;
      el.feld.placeholder = "Describe in your own words what should be created in “" + z.name + "”";
      el.feld.focus();
    },

    /* Anweisung 49 (d): Ein angenommener Antrag wird hier ein normaler Wunsch. */
    abschicken: function (text) {
      if (!el.form || !this.moeglich()) return;
      el.feld.value = text;
      el.form.requestSubmit();
    },

    /* Ein Satz als Anfang eines Wunsches im Feld (Fälle ohne Szenario) */
    vorbelegen: function (text) {
      el.feld.value = text;
      el.feld.focus();
      el.feld.setSelectionRange(text.length, text.length);
    },

    /* „Regel ändern“: Der Anfang steht im Wunschfeld, der PO schreibt, wie die Regel lauten soll. */
    regelAendern: function (kennung, satz) {
      var anfang = "The rule “" + satz + "” should read: ";
      regelZiel = { kennung: kennung, anfang: anfang };
      el.feld.value = anfang;
      el.feld.focus();
    },

    /* Was eingeschaltet ist, gehört zum Stand der Seite. */
    ladeGespeicherte: async function () {
      if (!this.moeglich()) return;
      var r = await fetch("/wuensche");
      var liste = await r.json();
      liste.forEach(function (w) {
        try { H.einspielen(w.name, w.quelle); }
        catch (e) { H.meldeFehler(w.name, e); }
      });
    },

    start: function () {
      el.form = document.getElementById("wunsch");
      el.feld = document.getElementById("wunschFeld");
      if (this.moeglich()) {
        /* Anweisung 33: Offene Wünsche stehen nach dem Neuladen wieder da (nicht in den unsichtbaren Kopien). */
        if (!new URLSearchParams(location.search).has("nachspielen")) {
          fetch("/unbestaetigt").then(function (r) { return r.ok ? r.json() : []; }).then(function (liste) {
            liste.forEach(function (a) { H.player.melde(ergebnisText(a, a.ueberstimmt), null, entscheidKnoepfe(a), { bleibt: true }); });
          }).catch(function () {});
        }
        el.form.addEventListener("submit", absenden);
        el.anhaenge = H.anhaenge.an(el.feld, []);
        el.form.appendChild(el.anhaenge.zeile);
        strgEnter(el.feld, el.form);
        if (prototypWartet) this.prototypBeginnen(prototypWartet);
      } else {
        el.feld.disabled = true;
        el.form.querySelector("button").disabled = true;
        el.feld.placeholder = "To make requests, open the page via “Start Play”";
      }
    }
  };
})();
