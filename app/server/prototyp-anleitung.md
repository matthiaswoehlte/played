

# Auftrag: erster Prototyp auf leerer Fläche

Der Anforderer beschreibt in eigenen Worten eine neue Teil-App. Du baust den ersten Prototyp. Für alles gelten die Regeln oben: Bus-Vertrag, kein Warten, feste Kennungen. Die Regel „genau ein Plugin“ gilt hier nicht: Du lieferst alle Teile auf einmal.

- **Wenig Plugins.** Drei bis fünf kleine Plugins als Gerüst. Baue nur, was die Beschreibung trägt. Was du für ein lauffähiges Gerüst ergänzen musst, bleibt klein.
- **Herkunft.** Trage in `satz` den Satz aus der Beschreibung im Wortlaut ein, auf den das Plugin zurückgeht. Geht es auf keinen Satz zurück, ist `satz` null. Erfinde keinen Satz.
- **Fachobjekte.** Lege nur Fachobjekte an, die dieser Teil-App gehören, unter neuen Namen in `fachobjekte`, mit Beispieldaten in `daten`. Was anderen Bereichen gehört, steht unter „Daten“ im Auftrag: Das liest du und kopierst es nie.
- **Fremde Werte.** Einen Wert, der einem anderen Plugin gehört, änderst du nicht selbst. Du schickst dem Besitzer die Nachricht, die er schon versteht (unter „Plugins“ im Auftrag), an dessen Objekt.
- **Worte.** In `fachobjekte` steht zu jedem Objekt sein Name, die Form „eines …“ und zu jeder Angabe das Wort im Akkusativ, z. B. `abwesend` → „die Abwesenheit“.
- **Ansicht.** Mindestens ein Plugin zeichnet die Teil-App mit `ansicht` im Ort `haupt`.
- **Szenario.** Genau ein erstes Szenario in `drehbuch`, Aufruf `Huelle.drehbuch({...})`, mit der vorgegebenen Kennung, das die Beschreibung vorführt und seine Erwartung nennt. Beschreibt der Anforderer eine Bedienung mit der Maus, führt das Szenario sie mit einem Schritt `bedienung` aus (siehe „Bedienung im Szenario“).
- **Sprache.** Alles, was ein Mensch liest, steht in der Sprache des Projekts, in den Worten des Anforderers, ohne Pfade, Feldnamen oder Technik.
- **Reihenfolge der Antwort.** Erst `anzahlPlugins`, dann `fachobjekte`, `daten`, `plugins`, zuletzt `drehbuch`. `daten` ist JSON-Text: ein Objekt je Fachobjekt, darin die Einträge nach ihrer Kennung, jeder mit `kennung`.
