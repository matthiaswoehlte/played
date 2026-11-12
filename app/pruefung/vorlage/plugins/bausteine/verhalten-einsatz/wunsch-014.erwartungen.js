/* Erwartungen, die wunsch-014 bewusst ändert. Die alte steht unter „alt“. */
Huelle.erwartung({
  "drehbuch": "wunsch-005",
  "nr": 2,
  "satz": "XC 810 Betanken auf I. Reindl ist jetzt ein Konflikt statt verweigert.",
  "alt": {
    "text": "XC 810 Betanken bleibt bei D. Mahler, weil I. Reindl nicht betanken darf.",
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
    "text": "XC 810 Betanken liegt jetzt bei I. Reindl, obwohl sie nicht betanken darf; das ist ein Konflikt „Qualifikation fehlt“.",
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
  "satz": "XC 810 Innenraum-Cleaning auf D. Mahler ist jetzt ein Konflikt statt verweigert.",
  "alt": {
    "text": "XC 810 Innenraum-Cleaning bleibt bei I. Reindl, weil D. Mahler kein Cleaning machen darf.",
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
    "text": "XC 810 Innenraum-Cleaning liegt jetzt bei D. Mahler, obwohl er kein Cleaning machen darf; das ist ein Konflikt „Qualifikation fehlt“.",
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
  "satz": "Am Ende stehen 7 statt 5 Konflikte, weil die beiden Zuweisungen ohne Qualifikation jetzt als Konflikt zählen.",
  "alt": {
    "text": "Der Konfliktzähler steht auf 5, weil sich bei F. Ohlsen XA 745 Betanken und Fäkalien entleeren nicht mehr überschneiden.",
    "pruefe": [
      {
        "pfad": "kennzahlen/konflikte/wert",
        "gleich": 5
      }
    ]
  },
  "neu": {
    "text": "Der Konfliktzähler steht auf 7: Bei F. Ohlsen überschneiden sich XA 745 Betanken und Fäkalien entleeren nicht mehr, dafür fehlt bei XC 810 Betanken und bei XC 810 Innenraum-Cleaning die Qualifikation.",
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
  "satz": "XC 810 Beladen auf D. Mahler wird jetzt zugewiesen (vorübergehend ein Konflikt) statt verweigert.",
  "alt": {
    "text": "D. Mahler bekommt XC 810 Beladen nicht, weil er nicht beladen darf.",
    "pruefe": [
      {
        "nachricht": "auftraege/XC810-BELA-01.verweigert"
      }
    ]
  },
  "neu": {
    "text": "D. Mahler bekommt XC 810 Beladen zunächst, obwohl er nicht beladen darf; danach zieht der Disponent es weiter auf W. Fiedler.",
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
