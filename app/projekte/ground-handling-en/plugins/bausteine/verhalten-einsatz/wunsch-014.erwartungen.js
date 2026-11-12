/* Erwartungen, die wunsch-014 bewusst ändert. Die alte steht unter „alt“. */
Huelle.erwartung({
  "drehbuch": "wunsch-005",
  "nr": 2,
  "satz": "XC 810 Fuelling to I. Reindl is now a conflict instead of refused.",
  "alt": {
    "text": "XC 810 Fuelling stays with D. Mahler, because I. Reindl is not allowed to fuel.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-TANK-01.verweigert"
      },
      {
        "pfad": "auftraege/XC810-TANK-01/mitarbeiter",
        "gleich": "MA-20"
      },
      {
        "sicht": "gantt",
        "enthaelt": "auftraege/XC810-TANK-01"
      }
    ]
  },
  "neu": {
    "text": "XC 810 Fuelling is now with I. Reindl, although she is not allowed to fuel; that is a “Missing qualification” conflict.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-TANK-01.umplanen"
      },
      {
        "pfad": "auftraege/XC810-TANK-01/mitarbeiter",
        "gleich": "MA-40"
      },
      {
        "sicht": "gantt",
        "enthaelt": "auftraege/XC810-TANK-01"
      }
    ]
  }
});
Huelle.erwartung({
  "drehbuch": "wunsch-005",
  "nr": 3,
  "satz": "XC 810 Cabin cleaning to D. Mahler is now a conflict instead of refused.",
  "alt": {
    "text": "XC 810 Cabin cleaning stays with I. Reindl, because D. Mahler is not allowed to do cleaning.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-CLEAN-01.verweigert"
      },
      {
        "pfad": "auftraege/XC810-CLEAN-01/mitarbeiter",
        "gleich": "MA-40"
      },
      {
        "sicht": "gantt",
        "enthaelt": "auftraege/XC810-CLEAN-01"
      }
    ]
  },
  "neu": {
    "text": "XC 810 Cabin cleaning is now with D. Mahler, although he is not allowed to do cleaning; that is a “Missing qualification” conflict.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-CLEAN-01.umplanen"
      },
      {
        "pfad": "auftraege/XC810-CLEAN-01/mitarbeiter",
        "gleich": "MA-20"
      },
      {
        "sicht": "gantt",
        "enthaelt": "auftraege/XC810-CLEAN-01"
      }
    ]
  }
});
Huelle.erwartung({
  "drehbuch": "wunsch-005",
  "nr": 6,
  "satz": "At the end there are 7 conflicts instead of 5, because the two assignments without qualification now count as conflicts.",
  "alt": {
    "text": "The conflict counter is at 5, because XA 745 Fuelling and Lavatory service no longer overlap for F. Ohlsen.",
    "pruefe": [
      {
        "pfad": "kennzahlen/konflikte/wert",
        "gleich": 5
      }
    ]
  },
  "neu": {
    "text": "The conflict counter is at 7: XA 745 Fuelling and Lavatory service no longer overlap for F. Ohlsen, but the qualification is missing for XC 810 Fuelling and XC 810 Cabin cleaning.",
    "pruefe": [
      {
        "pfad": "kennzahlen/konflikte/wert",
        "gleich": 7
      }
    ]
  }
});
Huelle.erwartung({
  "drehbuch": "wunsch-009",
  "nr": 4,
  "satz": "XC 810 Loading to D. Mahler is now assigned (temporarily a conflict) instead of refused.",
  "alt": {
    "text": "D. Mahler does not get XC 810 Loading, because he is not qualified for loading.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-BELA-01.verweigert"
      }
    ]
  },
  "neu": {
    "text": "D. Mahler gets XC 810 Loading at first, although he is not qualified for loading; then the dispatcher drags it on to W. Fiedler.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-BELA-01.umplanen"
      },
      {
        "pfad": "auftraege/XC810-BELA-01/mitarbeiter",
        "gleich": "MA-06"
      }
    ]
  }
});
