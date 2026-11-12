## Diese Nutzapp: der Netz-Navigator

Alles Obige gilt auch hier. Beispiele zu Tagesplan, Balken, Flügen und Disponenten beziehen sich aber auf eine andere Nutzapp; dort gibt es sie nicht.

Der Navigator zeigt dem Anforderer, woher jedes Stück seiner App kommt. Er arbeitet nur auf den Daten, die beim Laden aus einem anderen Projekt eingesammelt werden. Diese Daten sind eine Abschrift: **Der Navigator ändert das gelesene Projekt nie**, und kein Plugin tut so, als könne es das. Ein Plugin ändert nur die Stelle, an der der Anforderer gerade ist, und was es selbst anzeigt.

Die Objekte:

- `bereiche/<kennung>`: die Kästen der Karte, ein Baum (`eltern`, `tiefe`, `ordner`, `baustand` „leer“, „daten“ oder „prototyp“, `zahl`, Name, Verantwortlicher, Fachobjekte).
- `faeden/<von>--<nach>`: berechnete Bündel zwischen zwei Bereichen, mit `zustand` und `straenge` (je `wer` „plugin“ oder „regel“, `kennung`, `satz`, `zustand`). Bündel werden nie gepflegt.
- `bausteine/<kennung>`: die Plugins des gelesenen Projekts mit Fassungen, Wünschen im Wortlaut und Szenarien, in denen sie arbeiten.
- `fachregeln/<kennung>`: die Regeln des gelesenen Projekts.
- `grundfunktionen/<kennung>`: nachträglich erfasster Grundstock mit Quelle. Er bleibt sichtbar anders als echte Herkunft; was keine Quelle hat, bekommt keine erfundene.
- `navi/jetzt/pfad`: wo der Anforderer gerade steht. `navi/faden`: sein Weg (Ariadnefaden).

Anklickbares trägt `data-pfad` und `data-name`; zum Hingehen sendet ein Plugin `navi/jetzt.gehen` mit `ziel`. Die Karte zeichnet die Fäden als Linien, ihre Zahl als `.nv-zahl` mit `data-pfad`. Was mit `data-punkte` und `data-titel` markiert ist, bittet Play über `navi/jetzt.punktezeigen` um die Liste der offenen Punkte; der Navigator entscheidet nichts selbst. Das Aussehen steht in den Klassen `nv-…`; nutze sie weiter.

Zeige nur, was in den Daten steht. Was fehlt, erscheint nicht. Keine Kennungen im Lesefluss, nur Namen und Sätze.
