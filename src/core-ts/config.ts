/** Core configuration: values fixed by developers, never by users (user preferences are the
 * page's settings, not this file).
 *
 * Conventions (human, 2026-10-08):
 * 1. Only values shared by at least two places in the core. A value used in one place stays
 *    there (e.g. Math's 32 inputs in nodes/math.ts).
 * 2. Read-only. Nothing changes these at run time.
 * 3. One number, many checks: editing, code generation and the host may each check a limit,
 *    but they read the same number from here instead of copying it.
 * 4. A component that tests need to vary receives its configuration when created
 *    (createCompiler(registry, config)); omitted means CORE_CONFIG. Tests pass their own
 *    values; never edit this file for a test.
 * 5. Limits crossing the editor-host boundary belong to the host (TD); the value here is only
 *    the core's own default until the host reports it.
 * 6. Every value says why it is what it is; a value without a basis says so.
 *
 * 核心設定：開發者定死、使用者不能改（使用者偏好屬頁面的 settings，不在這裡）。約定：
 * 1. 只放核心裡至少兩處共用的值；只有一處用的留原地（如 nodes/math.ts 的 32）。
 * 2. 唯讀，執行中沒有人改。
 * 3. 一個數字、多個檢查點：編輯、產碼、宿主可以各自檢查，但都讀這裡的同一個數字，不抄一份。
 * 4. 測試需要改的元件，在建立時接收設定；沒給就用 CORE_CONFIG。測試傳自己的值，不為測試改這個檔案。
 * 5. 跨編輯器與宿主邊界的上限屬宿主（TD）；這裡只是宿主告知前的核心預設。
 * 6. 每個值寫明為什麼是這個數字；沒有依據的也要寫明。
 */
export interface CoreConfig {
  /** Nodes in one network (a stage, or the inside of one subgraph). */
  readonly nodesPerNetwork:number;
  readonly edgesPerNetwork:number;
  /** Nodes after subgraphs are expanded for code generation. */
  readonly expandedNodes:number;
  readonly expandedEdges:number;
  /** Serialized graph size. */
  readonly documentBytes:number;
  readonly subgraphDefinitions:number;
}

export const CORE_CONFIG:CoreConfig = Object.freeze({
  // No basis in the new architecture: inherited from the legacy Python core, which processed the
  // whole graph on TD's main thread. TD no longer reads the graph (Refactor.19). Temporary safety
  // net until measured limits exist (editing feel, GPU compile time, GLSL size); see CURRENT.
  // 新架構下沒有依據：繼承自舊 Python 核心（TD 主執行緒處理整張圖）。暫時的安全網，待實測後再訂。
  nodesPerNetwork:256,
  edgesPerNetwork:1024, // same legacy origin; four edges per node
  expandedNodes:2048,   // legacy-era choice for flattened subgraphs; same status as above
  expandedEdges:8192,   // four edges per expanded node, as before
  // UTF-8 bytes of the graph text. The host's limit (our TD-side code, next_family.MAX_GRAPH_BYTES), not
  // TD's: TD itself has none. The number is inherited; the reason to keep a limit is TD main-thread
  // time per edit (about 3.3 ms per MB, measured 2026-10-09; see next_family.py). See convention 5.
  // 圖文字的 UTF-8 位元組數。是宿主（我們在 TD 裡的程式）的上限，不是 TD 的；同樣沒有實測依據。
  documentBytes:512000,
  subgraphDefinitions:64, // legacy-era choice
});
