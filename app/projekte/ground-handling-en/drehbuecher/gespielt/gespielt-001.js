/* Drehbuch: von Hand gespielt und behalten. */
Huelle.drehbuch({
  "kennung": "gespielt-001",
  "titel": "By hand: XC 508 Fuelling now ends at 07:55",
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
      "erzaehlung": "Sick call AG-01 from 08:00"
    },
    {
      "zeit": "08:04",
      "objekt": "auftraege/XC810-ENTL-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-05"
      },
      "erzaehlung": "Dispatcher drags XC 810 unloading to V. Engström"
    },
    {
      "zeit": "08:08",
      "objekt": "auftraege/XC810-BELA-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-20"
      },
      "erzaehlung": "Dispatcher drags XC 810 loading to D. Mahler"
    },
    {
      "zeit": "08:12",
      "objekt": "auftraege/XC810-BELA-01",
      "aktion": "umplanen",
      "parameter": {
        "mitarbeiter": "MA-06"
      },
      "erzaehlung": "Dispatcher drags XC 810 loading to W. Fiedler"
    },
    {
      "zeit": "08:15",
      "objekt": "auftraege/XC508-TANK-01",
      "aktion": "zeitaendern",
      "parameter": {
        "kante": "ende",
        "zeit": "07:55"
      },
      "erzaehlung": "XC 508 Fuelling now ends at 07:55"
    }
  ],
  "erwartet": [
    {
      "text": "XC 508 Fuelling now ends at 07:55 instead of 07:45.",
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
      "text": "XC 810 Unloading is now with V. Engström instead of R. Aldinger.",
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
      "text": "XC 810 Loading is now with W. Fiedler instead of R. Aldinger.",
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
      "text": "There are now 7 conflicts instead of 6.",
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
      "text": "Everything else is also as it was when playing.",
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
              "art": "Overlap",
              "auftrag": "XA337-FAEK-01",
              "mit": "XA337-TANK-01"
            },
            {
              "art": "Overlap",
              "auftrag": "XC508-ENTL-01",
              "mit": "XC508-BELA-01"
            },
            {
              "art": "Overlap",
              "auftrag": "XC508-ENTL-02",
              "mit": "XC508-BELA-02"
            },
            {
              "art": "Overlap",
              "auftrag": "XC508-ENTL-03",
              "mit": "XC508-BELA-03"
            },
            {
              "art": "Overlap",
              "auftrag": "XC508-ENTL-04",
              "mit": "XC508-BELA-04"
            },
            {
              "art": "Overlap",
              "auftrag": "XA745-FAEK-01",
              "mit": "XA745-TANK-01"
            },
            {
              "art": "Overlap",
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
      "text": "Assignment refused: D. Mahler has no qualification for Loading",
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
