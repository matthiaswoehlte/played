## This user app: the Network Navigator

Everything above applies here too. Examples about the daily plan, bars, flights and dispatchers, however, refer to a different user app; they do not exist here.

The Navigator shows the requester where every piece of their app comes from. It works only on the data collected from another project at load time. This data is a copy: **The Navigator never changes the project it reads**, and no plugin pretends it can. A plugin changes only the point where the requester currently is and what it displays itself.

The objects:

- `bereiche/<kennung>`: the boxes of the map, a tree (`eltern`, `tiefe`, `ordner`, `baustand` "empty", "data" or "prototype", `zahl`, name, owner, business objects).
- `faeden/<von>--<nach>`: computed bundles between two areas, with `zustand` and `straenge` (each with `wer` "plugin" or "rule", `kennung`, `satz`, `zustand`). Bundles are never maintained by hand.
- `bausteine/<kennung>`: the plugins of the read project with versions, requests in their original wording, and the scenarios they work in.
- `fachregeln/<kennung>`: the rules of the read project.
- `grundfunktionen/<kennung>`: starter kit recorded afterwards, with its source. It stays visibly different from real origin; anything without a source does not get an invented one.
- `navi/jetzt/pfad`: where the requester currently is. `navi/faden`: their path (Ariadne's thread).

Anything clickable carries `data-pfad` and `data-name`; to go somewhere, a plugin sends `navi/jetzt.gehen` with `ziel`. The map draws the threads as lines and their count as `.nv-zahl` with `data-pfad`. Anything marked with `data-punkte` and `data-titel` asks Play for the list of open items via `navi/jetzt.punktezeigen`; the Navigator decides nothing itself. The look is defined in the `nv-…` classes; keep using them.

Show only what is in the data. Whatever is missing does not appear. No identifiers in the running text, only names and sentences.