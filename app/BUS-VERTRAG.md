# Bus-Vertrag

Gilt für die Hülle und für jedes Plugin in Play (Auftrag 005, Stufe 1, 2026-11-08). Zweck: Ein Szenario
endet jedes Mal gleich, zwei Plugins setzen nie denselben Wert verschieden, und eine Schleife oder ein
Absturz richtet keinen Schaden an. Umgesetzt in `huelle/huelle.js`, geprüft in `pruefung/bus-vertrag.mjs`.

1. **Ein Ereignis nach dem anderen.** Ein Ereignis wird vollständig abgearbeitet, bevor das nächste
   beginnt. Folgeereignisse kommen hinten in die Warteschlange.
2. **Feste Reihenfolge nach Pfad.** Zu einer Nachricht ruft der Bus zuerst die Hülle, dann die Plugins
   nach ihrem Pfad (`plugins/<kennung>`, alphabetisch). Dasselbe gilt für Prüfungen (`prueft`), für
   Bedienungen, die dasselbe Element fassen, und für `beimStart`. Die Reihenfolge des Einspielens zählt nie.
   Wollen mehrere Plugins dieselbe Bedienung übernehmen (geben sie zum selben Zug alle eine Nachricht
   zurück), sucht die Hülle das auf dem gezeichneten Stand ab und sagt es an jedem beteiligten Plugin in der
   Leiste in einem Satz. Der PO wählt, welches übernimmt; die Wahl steht mit Datum in
   `entscheidungen/bedienungen.json` und in der Herkunft beider Plugins. Bis er wählt, gilt die Reihenfolge
   nach Pfad (Anweisung 15 des PO, 2026-11-08).
3. **Kein Warten im Plugin.** Was auf dem Bus läuft (`beimStart`, `abonniert`, `prueft`), wartet nie:
   kein `async`/`await`, kein Promise, kein Timer. Animationen und Hervorhebungen laufen außerhalb des
   Busses auf dem fertigen Zustand (Bühne, `ansicht`, `ergaenzt`, `vorschau`); KI-Arbeit ohnehin außerhalb.
4. **Uhr und Zufall stellt nur die Hülle.** Plugins benutzen `h.uhr()`, `h.minuten()`, `h.zeit()`; keine
   eigene Uhr (`Date`, `performance.now`), keinen eigenen Zufall, kein Netz, keinen Speicher.
   Ein Plugin, das 3. oder 4. bricht, wird nicht eingehängt; die Hülle sagt es in einem Satz.
5. **Kennzeichnung jedes Ereignisses.** `nr` (laufend), `ausloeser` (die Nachricht, in deren Verarbeitung
   es entstand), `ursprung` (die erste Nachricht der Kette), `tiefe`, `zeit` (fachlich), `objekt` (Pfad).
   Eine Änderung `<objekt>.geaendert` trägt dazu `durch` (das Plugin, das gesetzt hat). Drehbuch und Hand
   beginnen immer eine neue Kette.
6. **Ein Wert, ein Besitzer.** Jedes Plugin meldet in `besitzt` an, welche Werte es ändert
   (`"auftraege/*/mitarbeiter"`). Jeden Wert darf genau ein Plugin ändern. Befehl und Tatsache sind
   getrennt: Ein Befehl („Krankmeldung kommt“, „lösen“, „zurücklegen“) geht an das Plugin, dem der Wert
   gehört, und genau dieses entscheidet; alle anderen reagieren nur auf die Tatsache (`geaendert`).
   Setzt ein Plugin einen fremden Wert, bleibt er, wie er war, und die Hülle
   meldet es: kein stiller Gewinner. Melden zwei Plugins denselben Wert an, sagt die Hülle es bei jedem
   Tagesbeginn; es gilt das erste nach Pfad. Ein Wert ohne angemeldeten Besitzer (etwa aus einer älteren
   Fassung von vor dem Vertrag) gehört dem ersten Plugin, das ihn an diesem Tag ändert; ein zweites wird
   ebenso gemeldet.
7. **Ändern nur mit Nachricht.** Ein Wert ändert sich nur in einem Abonnenten, der gerade eine Nachricht
   verarbeitet, oder beim Einrichten (`beimStart`). Auf `bus/takt.ruhe` und `uhr/tag.tick` wird nur
   gesendet, nie gesetzt.
8. **Schleifenschutz.** Höchsttiefe 40 und höchstens 1000 Nachrichten je Ursprungsereignis; dieselbe
   Nachricht (Absender, Objekt, Aktion, bei Änderungen Feld und Plugin) zum dritten Mal in ihrer eigenen
   Auslöserkette ist ein Kreis. Gemeldet als ein Satz: „„Krankmeldung …“ löst eine Endlosschleife aus
   zwischen „A“ und „B“.“
9. **Alles oder nichts.** Scheitert ein Plugin innerhalb einer Kette (Absturz, Warten) oder läuft sie im
   Kreis, gilt wieder der Stand vor dem Ursprungsereignis; was von der Kette noch wartet, verfällt. Die
   Meldung nennt das Ereignis und das Plugin; in den Ketten steht die Kette als „zurückgenommen“.
10. **Sichtbar.** Meldungen zum Vertrag stehen in der Hostapp unter den Meldungen und zählen im Probelauf
    wie ein Ausfall, damit die innere KI sie zurückbekommt. „Ketten“ zeigt je Ereignis, was es ausgelöst
    hat, mit dem Plugin je Glied und den neu gezeichneten Ansichten.
11. **Hoheit je Teil-App** (Anweisung 49 des PO, 2026-11-10). Jedes Plugin, Szenario und jede Regel gehört genau einer Teil-App
    (`herkunft.json` bzw. `entscheidungen/teilapps.json`). Jede Nachricht trägt ihre Teil-App (`teilApp`, im Maschinenraum vorn im
    Pfad): die des sendenden Plugins oder Szenarios, bei einer Bedienung die, in der sie geschieht, bei einer Änderung die des Plugins,
    das gesetzt hat. Es arbeiten nur die Plugins der laufenden Teil-App (des gespielten Szenarios, sonst der offenen). Ein Plugin hört
    nur Nachrichten seiner Teil-App, Uhr und Takt und was eine andere Teil-App in `projekt.json` unter `veroeffentlicht` weitergibt
    (Naht). Bedienungen gehen nie über eine Naht. Bedienungen und `ergaenzt` wirken nur an Ansichten derselben Teil-App.
