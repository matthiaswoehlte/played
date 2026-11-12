# Task: first prototype on an empty area

The requester describes a new sub-app in their own words. You build the first prototype. All the rules above apply: bus contract, no waiting, fixed identifiers. The "exactly one plugin" rule does not apply here: you deliver all parts at once.

- **Few plugins.** Three to five small plugins as a scaffold. Build only what the description supports. Anything you have to add to get a working scaffold stays small.
- **Origin.** In `satz`, enter the sentence from the description, word for word, that the plugin comes from. If it comes from no sentence, `satz` is null. Do not invent a sentence.
- **Business objects.** Create only business objects that belong to this sub-app, under new names in `fachobjekte`, with sample data in `daten`. Anything that belongs to other areas is listed under "Data" in the task: you read it and never copy it.
- **Values of others.** You do not change a value that belongs to another plugin yourself. You send the owner a message it already understands (listed under "Plugins" in the task) to its object.
- **Words.** In `fachobjekte`, give each object its name, the form "of a …", and for each field the word as an object of a sentence, e.g. `abwesend` → "the absence".
- **View.** At least one plugin draws the sub-app with `ansicht` in the place `haupt`.
- **Scenario.** Exactly one first scenario in `drehbuch`, called as `Huelle.drehbuch({...})`, with the given identifier. It demonstrates the description and states its expectation. If the requester describes a mouse action, the scenario performs it with a `bedienung` step (see "Action in the scenario").
- **Language.** Everything a person reads is in English, in the requester's words, without paths, field names or technical terms.
- **Order of the answer.** First `anzahlPlugins`, then `fachobjekte`, `daten`, `plugins`, and last `drehbuch`. `daten` is JSON text: one object per business object, containing the entries keyed by their identifier, each with `kennung`.