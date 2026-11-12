/* Drehbuch: von Hand gespielt und behalten. */
Huelle.drehbuch({
  "kennung": "gespielt-001",
  "titel": "By hand: Jumps to Dispatch and 5 more steps",
  "von": "08:00",
  "bis": "08:00",
  "gespielt": true,
  "ereignisse": [
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/disposition-ordner"
      },
      "erzaehlung": "Jumps to Dispatch"
    },
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/geraete"
      },
      "erzaehlung": "Opens Equipment Dispatch"
    },
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/disposition-ordner"
      },
      "erzaehlung": "Goes back to Dispatch"
    },
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/flugplan"
      },
      "erzaehlung": "Opens Flight Schedule"
    },
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/geraete"
      },
      "erzaehlung": "Goes back to Equipment Dispatch"
    },
    {
      "zeit": "08:00",
      "objekt": "navi/jetzt",
      "aktion": "gehen",
      "parameter": {
        "ziel": "bereiche/disposition-ordner"
      },
      "erzaehlung": "Goes back to Dispatch"
    }
  ],
  "erwartet": [
    {
      "text": "Everything else is also as it was when playing.",
      "pruefe": [
        {
          "pfad": "navi/jetzt/pfad",
          "gleich": "bereiche/disposition-ordner"
        },
        {
          "pfad": "navi/faden/stationen",
          "gleich": [
            "karte",
            "bereiche/disposition-ordner",
            "bereiche/geraete",
            "bereiche/flugplan"
          ]
        },
        {
          "pfad": "navi/faden/hier",
          "gleich": 1
        }
      ],
      "bei": {}
    }
  ]
});
