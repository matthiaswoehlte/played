Huelle.plugin({
  kennung: "geraete-balken-schrift-schwarz",
  titel: "Schwarze Schrift auf Balken",
  stil:
    '#nutzbereich[data-teilapp="geraete"] [data-spur],\n' +
    '#nutzbereich[data-teilapp="geraete"] [data-spur] *,\n' +
    '#nutzbereich[data-teilapp="geraete"] .pl-balken,\n' +
    '#nutzbereich[data-teilapp="geraete"] .pl-balken * {\n' +
    '  color: #000 !important;\n' +
    '}\n'
});