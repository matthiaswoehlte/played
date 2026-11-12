/* Feste Hülle: Anhänge an einem Textfeld für die KI (Wunsch, Ändern, Stimmt nicht, Antwort auf eine Rückfrage).
   Drei Wege: Bild aus der Zwischenablage (Strg+V), Datei ins Feld ziehen, Knopf „Anhängen…“.
   Vor dem Abschicken steht jeder Anhang als Vorschaubild oder Dateiname unter dem Feld und lässt sich
   mit einem Klick entfernen. Eine Datei, die aufs Feld fällt, ist immer ein Anhang, auch eine .js;
   das Einspielen eines Plugins durch Ziehen gilt nur außerhalb der Felder. */
(function () {
  "use strict";
  var H = window.Huelle;

  /* Dieselbe Liste und dieselben Grenzen prüft die Brücke (server/start.mjs). */
  var ARTEN = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "csv", "xlsx", "js"];
  var BILD = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1 };
  var JE_DATEI = 10 * 1024 * 1024, JE_WUNSCH = 25 * 1024 * 1024, HOECHSTENS = 10;
  var ARTEN_SATZ = "Anhängen lassen sich Bilder (png, jpg, gif, webp), PDF, Text, Markdown, CSV und Excel (.xlsx).";

  function endung(name) { var m = /\.([^.]+)$/.exec(name || ""); return m ? m[1].toLowerCase() : ""; }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " MB" : Math.ceil(n / 1024) + " KB"; }
  function zweistellig(n) { return (n < 10 ? "0" : "") + n; }

  function lese(datei) {
    return new Promise(function (fertig, fehler) {
      var r = new FileReader();
      r.onload = function () { fertig(String(r.result).replace(/^data:[^,]*,/, "")); };
      r.onerror = function () { fehler(r.error); };
      r.readAsDataURL(datei);
    });
  }

  /* feld: textarea; liste: Array, das der Aufrufer behält (überlebt ein Neuzeichnen der Leiste).
     Hängt unter das Feld eine Zeile „Anhängen…“ und die Vorschau. Rückgabe: { holen(), leeren(), zeile } */
  function an(feld, liste) {
    liste = liste || [];
    var zeile = document.createElement("div");
    zeile.className = "anhaenge";
    var knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "anhang-knopf";
    knopf.textContent = "Anhängen…";
    knopf.title = "Bildschirmfoto mit Strg+V einfügen, Datei hierher ziehen oder auswählen";
    var wahl = document.createElement("input");
    wahl.type = "file";
    wahl.multiple = true;
    wahl.hidden = true;
    wahl.accept = ARTEN.map(function (a) { return "." + a; }).join(",");
    var vorschau = document.createElement("div");
    vorschau.className = "anhang-vorschau";
    var hinweis = document.createElement("div");
    hinweis.className = "anhang-hinweis";
    hinweis.hidden = true;
    zeile.appendChild(knopf);
    zeile.appendChild(wahl);
    zeile.appendChild(vorschau);
    zeile.appendChild(hinweis);

    function sage(text) { hinweis.textContent = text || ""; hinweis.hidden = !text; }

    function zeichne() {
      vorschau.textContent = "";
      liste.forEach(function (x, i) {
        var c = document.createElement("span");
        c.className = "anhang";
        c.title = x.name + " · " + mb(x.groesse);
        if (x.bild) {
          var img = document.createElement("img");
          img.src = x.bild;
          img.alt = x.name;
          c.appendChild(img);
        }
        var n = document.createElement("span");
        n.className = "anhang-name";
        n.textContent = x.name;
        c.appendChild(n);
        var weg = document.createElement("button");
        weg.type = "button";
        weg.className = "anhang-weg";
        weg.textContent = "×";
        weg.title = "Entfernen";
        weg.setAttribute("aria-label", x.name + " entfernen");
        weg.addEventListener("click", function () {
          if (x.bild) URL.revokeObjectURL(x.bild);
          liste.splice(i, 1);
          sage("");
          zeichne();
        });
        c.appendChild(weg);
        vorschau.appendChild(c);
      });
    }

    function nimm(dateien, ausZwischenablage) {
      sage("");
      Array.prototype.forEach.call(dateien, function (d) {
        var name = d.name || "anhang";
        /* Ein Bild aus der Zwischenablage heißt im Browser nur „image.png“. */
        if (ausZwischenablage) {
          var t = new Date();
          name = "Bildschirmfoto " + zweistellig(t.getHours()) + "-" + zweistellig(t.getMinutes()) + "-" + zweistellig(t.getSeconds()) + "." + (endung(name) || "png");
        }
        var art = endung(name);
        var summe = liste.reduce(function (s, x) { return s + x.groesse; }, 0);
        if (ARTEN.indexOf(art) < 0) return sage("„" + name + "“ lässt sich nicht anhängen. " + ARTEN_SATZ);
        if (liste.length >= HOECHSTENS) return sage("Höchstens " + HOECHSTENS + " Anhänge je Wunsch.");
        if (d.size > JE_DATEI) return sage("„" + name + "“ ist zu groß (" + mb(d.size) + "); je Datei gehen höchstens " + mb(JE_DATEI) + ".");
        if (summe + d.size > JE_WUNSCH) return sage("Zusammen wären die Anhänge zu groß; je Wunsch gehen höchstens " + mb(JE_WUNSCH) + ".");
        liste.push({ name: name, groesse: d.size, bild: BILD[art] ? URL.createObjectURL(d) : null, daten: lese(d) });
      });
      zeichne();
    }

    knopf.addEventListener("click", function () { wahl.value = ""; wahl.click(); });
    wahl.addEventListener("change", function () { nimm(wahl.files); });
    /* Strg+V: Ein Bild wird Anhang. Steht auch Text in der Zwischenablage (z. B. aus Excel kopierte
       Zellen, die zugleich als Bild kommen), bleibt es beim Text im Feld. */
    feld.addEventListener("paste", function (e) {
      var cd = e.clipboardData;
      if (!cd || !cd.files || !cd.files.length) return;
      if (Array.prototype.indexOf.call(cd.types || [], "text/plain") >= 0 && cd.getData("text/plain")) return;
      e.preventDefault();
      nimm(cd.files, true);
    });
    /* Ziehen aufs Feld oder auf die Vorschau: Anhang, nie Einspielen */
    [feld, zeile].forEach(function (ort) {
      ort.addEventListener("dragover", function (e) {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        feld.classList.add("anhang-ziel");
        document.body.classList.remove("ziehen");
      });
      ort.addEventListener("dragleave", function () { feld.classList.remove("anhang-ziel"); });
      ort.addEventListener("drop", function (e) {
        feld.classList.remove("anhang-ziel");
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove("ziehen");
        nimm(e.dataTransfer.files);
      });
    });
    zeichne();

    return {
      zeile: zeile,
      anzahl: function () { return liste.length; },
      /* [{ name, daten }] für die Brücke */
      holen: function () {
        return Promise.all(liste.map(function (x) {
          return x.daten.then(function (d) { return { name: x.name, daten: d }; });
        }));
      },
      leeren: function () {
        liste.forEach(function (x) { if (x.bild) URL.revokeObjectURL(x.bild); });
        liste.splice(0, liste.length);
        sage("");
        zeichne();
      },
      sage: sage
    };
  }

  /* Anhänge aus der Herkunft eines Plugins, zum Öffnen (Leiste) */
  function verweise(kennung, anhaenge) {
    var d = document.createElement("div");
    d.className = "anhang-vorschau herkunft-anhaenge";
    (anhaenge || []).forEach(function (x) {
      var a = document.createElement("a");
      a.className = "anhang";
      a.href = "/anhang/" + kennung + "/" + x.pfad.split("/").map(encodeURIComponent).join("/");
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Öffnen: " + x.name;
      if (BILD[endung(x.name)]) {
        var img = document.createElement("img");
        img.src = a.href;
        img.alt = x.name;
        img.loading = "lazy";
        a.appendChild(img);
      }
      var n = document.createElement("span");
      n.className = "anhang-name";
      n.textContent = x.name;
      a.appendChild(n);
      d.appendChild(a);
    });
    return d;
  }

  H.anhaenge = { an: an, verweise: verweise, ARTEN_SATZ: ARTEN_SATZ };
})();
