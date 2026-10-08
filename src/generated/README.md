# src/generated — files produced by `npm run build:core`

Do not edit by hand. `build:core` writes them from `src/core-ts/` and `src/library/`; `check:core` fails if they are stale. The new editor, TD's Manager and the tests read them; `build:editor` publishes them at the web root (`/wire_planning.js`, `/editor-bootstrap.json`).

不要手改。由 `build:core` 從 `src/core-ts/`、`src/library/` 產生；過期時 `check:core` 會失敗。新編輯器、TD 的 Manager 與測試都讀這裡；`build:editor` 把它們放在網址根目錄。

| File | What |
| --- | --- |
| `wire_planning.js` | The core bundle (`GrapeGraph`, `GrapeTopCompiler`). The Manager checks its hash against `editor-bootstrap.json`. |
| `editor-bootstrap.json` | Node definitions, type contract, default graph, `catalogHash`. |

`editor-library.json` (a copy of `src/library/builtin_subgraphs.json`) is no longer produced: nothing read it after cleanup 2 (2026-10-08, design-interview Q48). The source data stays for the subgraph round.
