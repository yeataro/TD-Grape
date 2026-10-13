/* Render-scaling benchmark (Refactor.106; 107 adds M10, M12, M13, the release boundary and the report's identity): the production
 * bundle in a real Chrome with a 248-node graph and a fake host, the same interactions every run, so a before and an after can be
 * compared on one table. Frontend numbers only: no TD, no GPU.
 * 畫面更新規模化的基準（R.106；R.107 加 M10、M12、M13、放開的切界與報告身分）：正式建置、真 Chrome、248 個節點的圖、假宿主，每次同樣的
 * 操作，前後可以放在同一張表比。只有前端數字。
 *
 *   node tests/browser/benchmark_scaling.cjs BUILD_FOLDER REPORT_FOLDER LABEL [--counts]
 *
 * BUILD_FOLDER is the editor build (build:editor's --out). With --counts the build must be the profiling one
 * (`node tools/build_editor.cjs --out FOLDER --jsx-shim tools/dev/jsx-shim.js`, globalThis.__prof; never shipped): component re-run
 * counts are taken instead of timings. The report goes to REPORT_FOLDER/scaling-LABEL[-counts].json and is printed as a table.
 * `summary.identity` names the product (build version, bundle hash), the script, the fixture, the shim and the browser, so a before
 * and an after can be told apart and a changed script cannot pass for the same one.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const { chromium } = require('playwright');
const args = process.argv.slice(2), counts = args.includes('--counts');
const plain = args.filter(a => !a.startsWith('--')), [built, reportFolder] = plain.slice(0, 2).map(x => x && path.resolve(x)), label = plain[2];
if (!built || !reportFolder || !label) throw Error('Usage: node tests/browser/benchmark_scaling.cjs BUILD REPORT LABEL [--counts]');
const bootstrap = JSON.parse(fs.readFileSync(path.join(built, 'editor-bootstrap.json')));
const buildInfo = JSON.parse(fs.readFileSync(path.join(built, 'build-info.json')));
if (counts && !buildInfo.profiling) throw Error('--counts needs the profiling build (build_editor.cjs --jsx-shim)');
if (!counts && buildInfo.profiling) throw Error('a timing run needs the product build, not the profiling one');
const target = '2'.repeat(32), COPIES = 24, STEP = 48, VIEWPORT = { width: 1600, height: 1100 };
const FIXTURE = path.join(__dirname, '../fixtures/scaling_base_graph.json'), SHIM = path.join(__dirname, '../../tools/dev/jsx-shim.js');
const sha = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 12);
const find = (folder, test) => fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(folder, e.name), test) : test(e.name) ? [path.join(folder, e.name)] : []);
const identity = {
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '../..') }).toString().trim(); } catch { return null; } })(),
  build: buildInfo.version, profiling: !!buildInfo.profiling, bundle: find(built, name => /^index-.*\.js$/.test(name)).map(file => sha(fs.readFileSync(file))).join(','),
  script: sha(fs.readFileSync(__filename)), fixture: sha(fs.readFileSync(FIXTURE)), shim: counts ? sha(fs.readFileSync(SHIM)) : null,
  viewport: VIEWPORT.width + 'x' + VIEWPORT.height, browser: null };

// The 9-node cluster that carries the conversion wires in the base graph, copied 24 times (as Ctrl+D did in the audit): 248
// nodes, 136 wires, 125 of them conversions. 基準圖裡帶轉換線的 9 個節點，複製 24 次（同排查時的 Ctrl＋D）：248 節點、136 線。
const CLUSTER = ['n14ad3a26b739', 'nd9052a8cfd8c', 'ndacfca70715a4188b4654c397a55c38a', 'ndf1a0d36e8bb43e78c2399e136288865',
  'nc75a3b96a9654918bff5ef13479a7c14', 'n722439006d09', 'nedfb0f9e6dd5', 'n718d19ab3cc3', 'ne852d6bf9732'];
const COPY_IDS = new Set();
const base = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
function fixture() {
  const graph = base();
  const pixel = graph.stages.pixel, byId = new Map(pixel.nodes.map(n => [n.id, n])), inside = new Set(CLUSTER);
  const inner = pixel.edges.filter(e => inside.has(e.from[0]) && inside.has(e.to[0]));
  const idOf = (base, k) => 'n' + crypto.createHash('md5').update(base + ':' + k).digest('hex');
  for (let k = 1; k <= COPIES; k++) {
    for (const id of CLUSTER) {
      const n = JSON.parse(JSON.stringify(byId.get(id)));
      // Stacked copies below the base graph (2400 down), so no base node is covered: with the selected node no longer raised
      // (Refactor.106), a covered node's fields could not be reached. 複本疊在基準圖下方（往下 2400），不蓋住基準節點：選中的節點不再抬高（R.106），
      // 被蓋住的節點的欄位會碰不到。
      n.id = idOf(id, k); n.name = (n.name ?? 'Node') + '_c' + k; n.ui.x += k * STEP; n.ui.y += 2400 + k * STEP; COPY_IDS.add(n.id);
      pixel.nodes.push(n);
    }
    for (const e of inner) pixel.edges.push({ id: 'e' + crypto.createHash('md5').update(e.id + ':' + k).digest('hex'),
      from: [idOf(e.from[0], k), e.from[1]], to: [idOf(e.to[0], k), e.to[1]] });
  }
  return graph;
}
// The long-GLSL graph for M13 (as test_render_scaling.cjs): the base graph with a chain of 200 Floor nodes from the uAbsTime Uniform
// into the output, one GLSL line per node (232 nodes), laid out as a grid below the base graph. M13 的長 GLSL 圖（同 test_render_scaling.cjs）：
// 基準圖加上從 uAbsTime Uniform 接到輸出的 200 個 Floor 鏈，每個節點一行 GLSL（232 節點），排成基準圖下方的格子。
const FLOORS = 200;
function longFixture() {
  const graph = base(), pixel = graph.stages.pixel, floor = pixel.nodes.find(n => n.id === 'n49284b53ac094698861f7f3770a8e591');
  let from = ['ncd61a81cad554c3f8f8d0d47998ecbb7', 'out'];
  for (let k = 1; k <= FLOORS; k++) {
    pixel.nodes.push({ ...JSON.parse(JSON.stringify(floor)), id: 'nfloor' + k, name: 'Floor_c' + k, ui: { x: (k % 20) * 180, y: 2400 + Math.floor(k / 20) * 120 } });
    pixel.edges.push({ id: 'efloor' + k, from, to: ['nfloor' + k, 'value'] }); from = ['nfloor' + k, 'out'];
  }
  pixel.edges.find(e => e.to[0] === 'n95a062f14f7d4138ba5e2d764b752351' && e.to[1] === 'x').from = from;
  return graph;
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? +(s[Math.floor(s.length / 2)]).toFixed(1) : null; };
const max = a => a.length ? +Math.max(...a).toFixed(1) : null;

(async () => {
  fs.mkdirSync(reportFolder, { recursive: true });
  let state = { graph: fixture(), revision: 1, targetId: target };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const action = req.url.split('?')[0].split('/').at(-1); let raw = ''; for await (const chunk of req) raw += chunk;
        const body = raw && JSON.parse(raw); res.setHeader('Content-Type', 'application/json');
        const wire = { document: JSON.stringify(state.graph), revision: state.revision, targetId: target };
        if (action === 'state') return res.end(JSON.stringify({ state: wire, format: 'grape-next-1', target: '/test/scaling', shaderKind: 'top',
          frontendCompiler: { protocol: 'grape.top.ts.1', catalogHash: bootstrap.catalogHash, required: true } }));
        if (action === 'save') return res.end(JSON.stringify({ saved: 'fixture.toe' }));
        if (action === 'identity') return res.end(JSON.stringify({ targetId: target }));
        if (req.method === 'GET' || !raw) return res.end('{}');
        if (!body || body.revision !== state.revision) { res.statusCode = 409; return res.end(JSON.stringify({ error: 'Conflict' })); }
        state = { graph: JSON.parse(body.document), revision: state.revision + 1, targetId: target };
        return res.end(JSON.stringify({ state: { document: body.document, revision: state.revision, targetId: target } }));
      }
      const asked = decodeURIComponent(req.url.split('?')[0]);
      const name = asked === '/' || /^\/shader\/[a-f0-9]{32}\/$/.test(asked) ? '/index.html' : asked;
      const file = path.resolve(built, '.' + name);
      if (!file.startsWith(built + path.sep)) throw Error('outside build');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch (e) { res.statusCode = 404; res.end(String(e)); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  identity.browser = browser.version();
  const url = `http://127.0.0.1:${server.address().port}/shader/${target}/`, errors = [];
  // A page on the graph the server holds now, with the in-page recorder installed. 開在伺服器現在持有的圖上的頁面，裝好頁內記錄器。
  const openPage = async (expectNodes) => {
    const page = await browser.newPage({ viewport: VIEWPORT });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.locator('.react-flow__node').nth(expectNodes - 1).waitFor();
    await page.waitForTimeout(1500);
    // In-page recorder: Event Timing, long animation frames (with their start, so the ones after a release can be told apart), rAF gaps,
    // pointerdown-to-paint latency, and the profiling counters. 頁內記錄器：Event Timing、長畫格（帶開始時刻，放開之後的才分得出來）、rAF 間隔、
    // 按下到畫出的時間、以及量測版的計數。
    await page.evaluate(copyIds => {
      const H = globalThis.__H = { on: false, copies: new Set(copyIds), marked: Infinity };
      H.reset = () => { H.events = []; H.loaf = []; H.gaps = []; H.latency = []; H.counts = {}; H.marked = Infinity; if (globalThis.__prof) { globalThis.__prof.data.clear(); globalThis.__prof.on = true; } };
      new PerformanceObserver(l => { if (H.on) for (const e of l.getEntries()) H.events.push([e.name, e.duration]); }).observe({ type: 'event', durationThreshold: 16 });
      new PerformanceObserver(l => { if (H.on) for (const e of l.getEntries()) H.loaf.push([Math.round(e.duration), Math.round(e.scripts.reduce((s, x) => s + x.forcedStyleAndLayoutDuration, 0)), Math.round(e.startTime)]); }).observe({ type: 'long-animation-frame' });
      let last = performance.now(); const loop = t => { if (H.on) H.gaps.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
      // pointerdown (capture) to the frame after the next paint. 按下（捕捉階段）到下一次畫出之後的那一格。
      addEventListener('pointerdown', () => { if (!H.on) return; const t = performance.now(); requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => H.latency.push(performance.now() - t); ch.port2.postMessage(0); }); }, true);
      H.start = () => { H.reset(); H.on = true; };
      // The release boundary: long frames that began at or after it belong to the release. 放開的切界：在它之後開始的長畫格屬於放開。
      H.mark = () => { H.marked = performance.now(); };
      H.stop = () => { H.on = false; if (globalThis.__prof) { globalThis.__prof.on = false; H.counts = Object.fromEntries([...globalThis.__prof.data].map(([k, v]) => [k, v.n])); }
        const gaps = H.gaps.slice(1); return { events: H.events, loaf: H.loaf, release: H.loaf.filter(l => l[2] >= H.marked), latency: H.latency, gaps, long: gaps.filter(g => g > 50).length, counts: H.counts }; };
      H.clean = () => [...document.querySelectorAll('.react-flow__node')].map(n => { const t = n.querySelector('.node-title'); if (!t) return null; const b = t.getBoundingClientRect(), x = b.x + 24, y = b.y + b.height / 2;
        const pane = document.querySelector('.react-flow').getBoundingClientRect();
        return document.elementFromPoint(x, y)?.closest('.react-flow__node') === n && x > pane.x + 40 && x < pane.right - 40 && y > pane.y + 60 && y < pane.bottom - 80 ? { id: n.dataset.id, x, y, copy: H.copies.has(n.dataset.id) } : null; }).filter(Boolean);
      H.empty = () => { const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
        for (let y = pane.bottom - 120; y > pane.y + 100; y -= 20) for (let x = pane.right - 80; x > pane.x + 80; x -= 20) if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y }; return null; };
    }, [...COPY_IDS]);
    return page;
  };
  const page = await openPage(248);
  const nodes = await page.locator('.react-flow__node').count(), edges = await page.locator('.react-flow__edge').count();
  if (nodes !== 248 || edges !== 136) throw Error(`graph is ${nodes} nodes, ${edges} edges`);

  const results = {}, summary = {};
  const runOn = async (pg, name, fn) => { await pg.evaluate(() => globalThis.__H.start()); await fn(); await pg.waitForTimeout(400); const r = await pg.evaluate(() => globalThis.__H.stop()); results[name] = r; return r; };
  const run = (name, fn) => runOn(page, name, fn);
  const clean = await page.evaluate(() => globalThis.__H.clean());
  const baseNodes = clean.filter(n => !n.copy);  // base-graph nodes that can be clicked 基準圖裡點得到的節點
  const tops = clean.filter(n => n.copy);        // the topmost copy of each stack 每疊最上面的那個複本
  if (baseNodes.length < 10 || tops.length < 1) throw Error(`not enough clickable nodes: ${baseNodes.length} base, ${tops.length} tops`);
  // The stacks' screen box, for the box selection. 複本疊的螢幕範圍，給框選用。
  const stacks = await page.evaluate(() => { const r = [...document.querySelectorAll('.react-flow__node')].filter(n => globalThis.__H.copies.has(n.dataset.id)).map(n => n.getBoundingClientRect());
    return { left: Math.min(...r.map(b => b.left)), top: Math.min(...r.map(b => b.top)), right: Math.max(...r.map(b => b.right)), bottom: Math.max(...r.map(b => b.bottom)) }; });
  const [A, B] = baseNodes, empty = await page.evaluate(() => globalThis.__H.empty());
  const click = async (p, shift) => { if (shift) await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); if (shift) await page.keyboard.up('Shift'); };
  // Keys go to the canvas as the editor's own tests send them (a real Delete press is lost when React Flow re-registers its key
  // listener between renders: deleteKeyCode is a new array each render, see the audit's D1). 按鍵送到畫布，同編輯器測試；真的按 Delete 會被
  // React Flow 每次重繪重掛監聽吃掉（D1）。
  const keyOn = (pg, k, ctrl = false) => pg.evaluate(([k, ctrl]) => { document.activeElement?.blur?.(); document.querySelector('.react-flow__pane').dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, ctrlKey: ctrl, bubbles: true, cancelable: true })); }, [k, ctrl]);
  const key = (k, ctrl) => keyOn(page, k, ctrl);
  // The release is marked just before the button goes up, so the frames after it can be told from the gesture's. 放開前先做記號，放開之後的
  // 畫格才分得出來。
  const dragOn = async (pg, from, dx, dy, steps, button = 'left', pause = 16) => { await pg.mouse.move(from.x, from.y); await pg.mouse.down({ button });
    for (let i = 1; i <= steps; i++) { await pg.mouse.move(from.x + dx * i / steps, from.y + dy * i / steps); await pg.waitForTimeout(pause); }
    await pg.evaluate(() => globalThis.__H.mark()); await pg.mouse.up({ button }); };
  const drag = (from, dx, dy, steps, button, pause) => dragOn(page, from, dx, dy, steps, button, pause);
  const undoOn = async (pg) => { await keyOn(pg, 'z', true); await pg.waitForTimeout(500); };
  const undo = () => undoOn(page);
  // Select nodes by events on their titles (robust to overlap and to covered nodes). 用事件直接選它們的標題（不怕重疊、不怕被蓋住）。
  const selectByTitle = (pg, ids) => pg.evaluate(ids => { ids.forEach((id, i) => { const t = document.querySelector(`.react-flow__node[data-id="${id}"] .node-title`); const b = t.getBoundingClientRect();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) t.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') ? 0 : 1, pointerId: 1, pointerType: 'mouse', shiftKey: i > 0, view: window }) : new MouseEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') || type === 'click' ? 0 : 1, shiftKey: i > 0, view: window })); }); }, ids);
  // Show a panel's tab; a collapsed pane is opened. 顯示某個面板的分頁；收起的窗格打開。
  const openTab = async (pg, id) => { await pg.locator(`button[role="tab"][data-panel="${id}"]`).first().click(); await pg.waitForTimeout(400);
    const fold = pg.locator('.tab-pane.collapsed button.pane-collapse'); if (await fold.count()) { await fold.first().click(); await pg.waitForTimeout(400); } };

  // M1 / M2: switch the selection between two nodes. 換點節點。
  await click(A); await page.waitForTimeout(300);
  let r = await run('M1 select switch', async () => { for (let i = 0; i < 10; i++) { await click(i % 2 ? A : B); await page.waitForTimeout(250); } });
  summary.M1_latency_ms = median(r.latency); summary.M1_eventTiming_ms = median(r.events.filter(e => e[0] === 'pointerdown').map(e => e[1]));
  summary.M1_long_frames = r.long; if (counts) summary.M2_renders_per_click = +(Object.values(r.counts).reduce((s, n) => s + n, 0) / 10).toFixed(0);
  if (counts) summary.M2_top = Object.entries(r.counts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // M3: drag 8 selected base nodes (spread out, never stacked). 拖 8 個已選的基準節點（分散、不疊）。
  // Selected by events on their titles, then dragged with the real mouse from the first, which is clickable.
  // 用事件直接選它們的標題，再用真滑鼠從第一個（點得到的）拖。
  const eight = baseNodes.slice(0, 8);
  await selectByTitle(page, eight.map(n => n.id));
  await page.waitForTimeout(300);
  const selected = await page.locator('.react-flow__node.selected').count();
  const posBefore = await page.evaluate(id => document.querySelector(`.react-flow__node[data-id="${id}"]`).style.transform, eight[0].id);
  r = await run('M3 drag 8', async () => { await drag(eight[0], 60, 40, 20); });
  summary.M3_moved = (await page.evaluate(id => document.querySelector(`.react-flow__node[data-id="${id}"]`).style.transform, eight[0].id)) !== posBefore;
  summary.M3_selected = selected; summary.M3_frame_ms_median = median(r.gaps); summary.M3_frame_ms_max = max(r.gaps);
  if (counts) { summary.M3_wrappers_per_frame = +((r.counts.NodeWrapper ?? 0) / 20).toFixed(0); summary.M3_toolbar_buttons = r.counts.IconButton ?? 0; }
  await undo();

  // M4: right-drag box select from past the stacks' lower-right corner up over them (clipped to the canvas). 右鍵框選：從複本疊右下角外往左上框過去（不出畫布）。
  // The whole gesture's longest frame and long frame, and the long frames that began after the release (Refactor.107: the earlier
  // `M4_release_loaf_ms` was the whole gesture's; the two are not the same column). 整段手勢最長的一格與長畫格，以及放開之後才開始的長畫格
  // （R.107：以前的 M4_release_loaf_ms 其實是整段的；兩者不是同一欄）。
  const pane = await page.locator('.react-flow__pane').boundingBox();
  const corner = { x: Math.min(stacks.right + 30, pane.x + pane.width - 20), y: Math.min(stacks.bottom + 30, pane.y + pane.height - 60) };
  const to = { x: Math.max(stacks.left - 30, pane.x + 20), y: Math.max(stacks.top - 30, pane.y + 80) };
  r = await run('M4 box select', async () => { await drag(corner, to.x - corner.x, to.y - corner.y, 15, 'right', 30); });
  summary.M4_frame_ms_max = max(r.gaps); summary.M4_gesture_loaf_ms = max(r.loaf.map(l => l[0])); summary.M4_after_release_loaf_ms = max(r.release.map(l => l[0]));
  summary.M4_selected_after = await page.locator('.react-flow__node.selected').count();
  if (counts) summary.M4_cards_total = r.counts.NodeCard ?? 0;
  await click(empty); await page.waitForTimeout(300);

  // M5: pan on empty canvas. 平移。
  r = await run('M5 pan', async () => { await drag(empty, -80, -60, 20); });
  summary.M5_long_frames = r.long; summary.M5_frame_ms_max = max(r.gaps);
  summary.M5_layer_left = await page.locator('.gesture-cursor').count(); // a cursor layer must not outlive the gesture 游標層不能留到手勢之後

  // M6 / M8 at 100% around the Color node: its value box and output port must be under the pointer, not under a stacked copy.
  // M6、M8 在 Color 節點對準到 100%：數值框與輸出接孔要真的在指標下，不被疊著的複本蓋住。
  // Selected by events on its title (it may sit under a stack), then framed with F. 用事件直接選它的標題（可能被疊住），再按 F 對準。
  await selectByTitle(page, ['color']);
  await page.waitForTimeout(200); await key('f'); await page.waitForTimeout(900);
  summary.M6_color_selected = await page.locator('.react-flow__node.selected').evaluateAll(l => l.map(n => n.dataset.id)).then(l => l.join(','));
  const fieldBox = await page.locator('.react-flow__node[data-id="color"] input.number').first().boundingBox();
  const fieldAt = { x: fieldBox.x + fieldBox.width / 2, y: fieldBox.y + fieldBox.height / 2 };
  const valueOf = () => page.locator('.react-flow__node[data-id="color"] input.number').first().inputValue();
  summary.M6_field_hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('input.number') ?? false, [fieldAt.x, fieldAt.y]);
  summary.M6_field_under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 40) + ' in ' + (e.closest('.react-flow__node')?.dataset.id ?? '-') : null; }, [fieldAt.x, fieldAt.y]);
  const valueBefore = await valueOf();
  r = await run('M6 scrub', async () => { await drag(fieldAt, 40, 0, 10); });
  summary.M6_value_changed = (await valueOf()) !== valueBefore; summary.M6_scrub_loaf_ms = max(r.loaf.map(l => l[0])); summary.M6_scrub_event_ms = max(r.events.map(e => e[1])); if (counts) summary.M6_scrub_cards = r.counts.NodeCard ?? 0;
  r = await run('M6 undo value', async () => { await undo(); });
  summary.M6_value_restored = (await valueOf()) === valueBefore; summary.M6_undo_loaf_ms = max(r.loaf.map(l => l[0])); summary.M6_undo_event_ms = max(r.events.map(e => e[1])); if (counts) summary.M6_undo_cards = r.counts.NodeCard ?? 0;

  // M8: drag a wire from the Color node's output to empty canvas, close the popup. 從輸出拉線到空白處。
  const handle = await page.locator('.react-flow__node[data-id="color"] .react-flow__handle.source').first().boundingBox();
  const emptyNear = await page.evaluate(() => globalThis.__H.empty());
  r = await run('M8 wire drag', async () => { await drag({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, emptyNear.x - handle.x, emptyNear.y - handle.y, 12); await page.waitForTimeout(300); await page.keyboard.press('Escape'); });
  summary.M8_long_frames = r.long; summary.M8_loaf_ms_max = max(r.loaf.map(l => l[0]));
  summary.M8_edges_after = await page.locator('.react-flow__edge').count();

  // M12: drag a wire from the Color node's vec4 output over the x input of Combine_2 (vec4: dropping there merges x, y, z, w into one
  // input, so the merging preview is on while the wire stays there), wiggle over it, release on empty canvas, close the popup.
  // What a non-empty merging preview costs while the wire is over the input (FR02). 從 Color 的 vec4 輸出拉線到 Combine_2 的 x 輸入上
  // （vec4：放在那裡會把 x、y、z、w 併成一個輸入，線停在那裡時合併預告就開著），在上面小幅移動，放到空白處，關掉視窗。合併預告開著時的成本（FR02）。
  const COMBINE = 'ne93b0b5fc1ae46b895da9e80f730b1c5';
  await selectByTitle(page, ['color', COMBINE]);
  await page.waitForTimeout(200); await key('f'); await page.waitForTimeout(900);
  const out12 = await page.locator('.react-flow__node[data-id="color"] .react-flow__handle.source').first().boundingBox();
  const in12 = await page.locator(`.react-flow__node[data-id="${COMBINE}"] .react-flow__handle.target[data-handleid="x"]`).first().boundingBox();
  const empty12 = await page.evaluate(() => globalThis.__H.empty());
  r = await run('M12 wire over merging input', async () => {
    const from = { x: out12.x + out12.width / 2, y: out12.y + out12.height / 2 }, over = { x: in12.x + in12.width / 2, y: in12.y + in12.height / 2 };
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(from.x + (over.x - from.x) * i / 10, from.y + (over.y - from.y) * i / 10); await page.waitForTimeout(16); }
    await page.waitForTimeout(100);
    summary.M12_merging_rows = await page.evaluate(() => document.querySelectorAll('[data-merging]').length);
    for (let i = 0; i < 8; i++) { await page.mouse.move(over.x + (i % 2 ? 2 : -2), over.y + (i % 2 ? 1 : -1)); await page.waitForTimeout(40); }
    await page.mouse.move(empty12.x, empty12.y); await page.waitForTimeout(100);
    await page.evaluate(() => globalThis.__H.mark()); await page.mouse.up(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); });
  summary.M12_long_frames = r.long; summary.M12_loaf_ms_max = max(r.loaf.map(l => l[0])); summary.M12_edges_after = await page.locator('.react-flow__edge').count();
  if (counts) summary.M12_cards = r.counts.NodeCard ?? 0;

  // Back to the whole graph for M7 and M9. 回到全圖。
  await key('h'); await page.waitForTimeout(900);
  const again = await page.evaluate(() => globalThis.__H.clean()), topsAgain = again.filter(n => n.copy), emptyAgain = await page.evaluate(() => globalThis.__H.empty());

  // M7: delete one copied node (a real Delete press; the canvas gets the key if the press was lost), then undo. 刪除一個複本、Undo。
  await click(topsAgain[3] ?? topsAgain[0]); await page.waitForTimeout(250);
  summary.M7_selected = await page.locator('.react-flow__node.selected').count();
  r = await run('M7 delete', async () => { await page.keyboard.press('Delete'); await page.waitForTimeout(600);
    if ((await page.locator('.react-flow__node').count()) === 248) { summary.M7_key_fallback = true; await key('Delete'); await page.waitForTimeout(600); } });
  summary.M7_delete_loaf_ms = max(r.loaf.map(l => l[0])); summary.M7_nodes_after_delete = await page.locator('.react-flow__node').count();
  r = await run('M7 undo delete', async () => { await undo(); });
  summary.M7_undo_loaf_ms = max(r.loaf.map(l => l[0])); summary.M7_nodes_after_undo = await page.locator('.react-flow__node').count();

  // M9: place a node with Tab, move the pointer. 放置節點。
  await click(emptyAgain); await page.waitForTimeout(200);
  await page.keyboard.press('Tab'); await page.waitForTimeout(300); await page.keyboard.type('float'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  summary.M9_placing = await page.locator('.react-flow__node.placing').count();
  r = await run('M9 placing moves', async () => { for (let i = 1; i <= 8; i++) { await page.mouse.move(emptyAgain.x - i * 20, emptyAgain.y - i * 15); await page.waitForTimeout(40); } });
  summary.M9_frame_ms_max = max(r.gaps); if (counts) summary.M9_wrappers_per_move = +((r.counts.NodeWrapper ?? 0) / 8).toFixed(0);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  summary.M9_nodes_after = await page.locator('.react-flow__node').count();

  // M11: wheel zoom with every stack node selected (216 selection rings on screen), then pan with them selected: what a selection
  // look costs while the view moves. 216 個被選節點在畫面上時滾輪縮放、再平移：視角移動時選取的樣子要花多少。
  await click(emptyAgain); await page.waitForTimeout(200);
  r = await run('M11 box all', async () => { await drag(corner, to.x - corner.x, to.y - corner.y, 10, 'right', 30); });
  summary.M11_selected = await page.locator('.react-flow__node.selected').count();
  r = await run('M11 wheel zoom selected', async () => { for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, i % 2 ? 120 : -120); await page.waitForTimeout(60); } });
  summary.M11_zoom_frame_ms_max = max(r.gaps); summary.M11_zoom_long_frames = r.long; summary.M11_zoom_layout_ms = +r.loaf.reduce((sum, l) => sum + l[1], 0).toFixed(0);
  r = await run('M11 pan selected', async () => { await drag(emptyAgain, -60, -40, 20); });
  summary.M11_pan_frame_ms_max = max(r.gaps); summary.M11_pan_long_frames = r.long;
  // The bar and the frame while the view moves: the bar's buttons must not be drawn again per frame (Refactor.107, Z11). 視角移動時的工具列
  // 與多選框：工具列的按鈕不該每格重畫（R.107，Z11）。
  if (counts) { summary.M11_pan_toolbar_reruns = r.counts.FloatingToolbar ?? 0; summary.M11_pan_toolbar_buttons = r.counts.IconButton ?? 0; summary.M11_pan_frame_reruns = r.counts.SelectionFrame ?? 0; }
  await click(emptyAgain); await page.waitForTimeout(200);

  // M10: switch the selection with the Graph JSON panel shown (its tab in the right pane; the pane is opened if collapsed). What an
  // auxiliary panel costs while it is open. 圖的 JSON 面板顯示時換點（右側窗格的分頁；收起就打開）。附加面板開著時的成本。
  await openTab(page, 'graphJsonView');
  summary.M10_json_shown = await page.locator('.panel-content').filter({ hasText: '"stages"' }).count() > 0;
  const list10 = (await page.evaluate(() => globalThis.__H.clean())).filter(n => !n.copy);
  if (list10.length < 2) throw Error('M10: not enough clickable base nodes');
  await click(list10[0]); await page.waitForTimeout(300);
  r = await run('M10 select switch with Graph JSON', async () => { for (let i = 0; i < 10; i++) { await click(list10[i % 2]); await page.waitForTimeout(250); } });
  summary.M10_latency_ms = median(r.latency); summary.M10_long_frames = r.long;
  if (counts) summary.M10_renders_per_click = +(Object.values(r.counts).reduce((s, n) => s + n, 0) / 10).toFixed(0);
  await openTab(page, 'params');

  // M13: on the long-GLSL graph (232 nodes, one GLSL line each), with the GLSL panel shown, drag one base node and release: what the
  // GLSL panel costs on a layout-only edit. 在長 GLSL 圖上（232 節點、每節點一行）顯示 GLSL 面板，拖一個基準節點並放開：純版面修改時 GLSL
  // 面板的成本。
  state = { graph: longFixture(), revision: 1, targetId: target };
  const page2 = await openPage(32 + FLOORS);
  await openTab(page2, 'glsl');
  summary.M13_glsl_lines = await page2.locator('.glsl-line').count();
  const list13 = (await page2.evaluate(() => globalThis.__H.clean())).filter(n => !n.copy && n.id !== 'color');
  if (!list13.length) throw Error('M13: no clickable base node');
  await page2.mouse.click(list13[0].x, list13[0].y); await page2.waitForTimeout(300);
  r = await runOn(page2, 'M13 drag with GLSL shown', async () => { await dragOn(page2, list13[0], 60, 40, 20); });
  summary.M13_frame_ms_max = max(r.gaps); summary.M13_long_frames = r.long; summary.M13_after_release_loaf_ms = max(r.release.map(l => l[0]));
  if (counts) { summary.M13_line_reruns = r.counts.Line ?? 0; summary.M13_panel_reruns = r.counts.GlslView ?? 0; }
  await undoOn(page2);

  summary.errors = errors; summary.build = built; summary.counts = counts; summary.identity = identity;
  const out = path.join(reportFolder, `scaling-${label}${counts ? '-counts' : ''}.json`);
  fs.writeFileSync(out, JSON.stringify({ summary, results }, null, 1));
  console.log('| metric | value |\n|---|---|\n' + Object.entries(summary).filter(([k]) => !['errors', 'build', 'counts', 'M2_top', 'identity'].includes(k)).map(([k, v]) => `| ${k} | ${v} |`).join('\n'));
  if (summary.M2_top) console.log('M2 top:', JSON.stringify(summary.M2_top));
  console.log('identity:', JSON.stringify(identity));
  if (errors.length) console.log('page errors:', errors);
  console.log('written', out);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
