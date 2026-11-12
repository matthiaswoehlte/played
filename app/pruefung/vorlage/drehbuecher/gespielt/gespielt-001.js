/* Drehbuch: von Hand gespielt und behalten. */
Huelle.drehbuch({
  "kennung": "gespielt-001",
  "titel": "Von Hand: XC 508 Betanken endet jetzt um 07:55",
  "von": "07:55",
  "bis": "08:15",
  "gespielt": true,
  "ereignisse": [
    {
      "zeit": "08:00",
      "objekt": "mitarbeiter/MA-01",
      "aktion": "krankmeldung",
      "parameter": {
        "ab": "08:00"
      },
      "erzaehlung": "Krankmeldung MA-01 ab 08:00"
    },
    {
      "zeit": "08:04",
      "objekt": "auftraege/XC810-ENTL-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-05"
      },
      "erzaehlung": "Disponent zieht XC 810 Entladen auf V. Engström"
    },
    {
      "zeit": "08:08",
      "objekt": "auftraege/XC810-BELA-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-20"
      },
      "erzaehlung": "Disponent zieht XC 810 Beladen auf D. Mahler"
    },
    {
      "zeit": "08:12",
      "objekt": "auftraege/XC810-BELA-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-06"
      },
      "erzaehlung": "Disponent zieht XC 810 Beladen auf W. Fiedler"
    },
    {
      "zeit": "08:15",
      "objekt": "auftraege/XC508-TANK-01",
      "aktion": "zeitaendern",
      "parameter": {
        "kante": "ende",
        "zeit": "07:55"
      },
      "erzaehlung": "XC 508 Betanken endet jetzt um 07:55"
    }
  ],
  "erwartet": [
    {
      "text": "XC 508 Betanken endet jetzt um 07:55 statt um 07:45.",
      "pruefe": [
        {
          "pfad": "auftraege/XC508-TANK-01/ende",
          "gleich": "07:55"
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    },
    {
      "text": "XC 810 Entladen liegt jetzt bei V. Engström statt bei R. Aldinger.",
      "pruefe": [
        {
          "pfad": "auftraege/XC810-ENTL-01/mitarbeiter",
          "gleich": "MA-05"
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    },
    {
      "text": "XC 810 Beladen liegt jetzt bei W. Fiedler statt bei R. Aldinger.",
      "pruefe": [
        {
          "pfad": "auftraege/XC810-BELA-01/mitarbeiter",
          "gleich": "MA-06"
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    },
    {
      "text": "Es sind jetzt 7 statt 6 Konflikte.",
      "pruefe": [
        {
          "pfad": "kennzahlen/konflikte/wert",
          "gleich": 7
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    },
    {
      "text": "Auch alles Übrige steht wie beim Spielen.",
      "pruefe": [
        {
          "pfad": "mitarbeiter/MA-01/abwesend",
          "gleich": true
        },
        {
          "pfad": "mitarbeiter/MA-01/grund",
          "gleich": "krank"
        },
        {
          "pfad": "mitarbeiter/MA-01/abwesendAb",
          "gleich": "08:00"
        },
        {
          "pfad": "kennzahlen/konflikte/liste",
          "gleich": [
            {
              "art": "Überlappung",
              "auftrag": "XA337-FAEK-01",
              "mit": "XA337-TANK-01"
            },
            {
              "art": "Überlappung",
              "auftrag": "XC508-ENTL-01",
              "mit": "XC508-BELA-01"
            },
            {
              "art": "Überlappung",
              "auftrag": "XC508-ENTL-02",
              "mit": "XC508-BELA-02"
            },
            {
              "art": "Überlappung",
              "auftrag": "XC508-ENTL-03",
              "mit": "XC508-BELA-03"
            },
            {
              "art": "Überlappung",
              "auftrag": "XC508-ENTL-04",
              "mit": "XC508-BELA-04"
            },
            {
              "art": "Überlappung",
              "auftrag": "XA745-FAEK-01",
              "mit": "XA745-TANK-01"
            },
            {
              "art": "Überlappung",
              "auftrag": "XC810-BELA-01",
              "mit": "XB933-ENTL-02"
            }
          ]
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    },
    {
      "text": "Zuteilung verweigert: D. Mahler hat keine Qualifikation für Beladen",
      "pruefe": [
        {
          "nachricht": "auftraege/XC810-BELA-01.verweigert"
        }
      ],
      "bei": {
        "krankmeldung": "verhalten-krankmeldung"
      }
    }
  ]
});
