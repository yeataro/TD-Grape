/* Render-scaling benchmark (Refactor.106): the production bundle in a real Chrome with a 248-node graph and a fake host, the
 * same interactions every run, so a before and an after can be compared on one table. Frontend numbers only: no TD, no GPU.
 * 畫面更新規模化的基準（R.106）：正式建置、真 Chrome、248 個節點的圖、假宿主，每次同樣的操作，前後可以放在同一張表比。只有前端數字。
 *
 *   node tests/browser/benchmark_scaling.cjs BUILD_FOLDER REPORT_FOLDER LABEL [--counts]
 *
 * BUILD_FOLDER is the editor build (build:editor's --out). With --counts the build must be the profiling one (globalThis.__prof
 * from the scratchpad shim, never shipped): component re-run counts are taken instead of timings. The report goes to
 * REPORT_FOLDER/scaling-LABEL[-counts].json and is printed as a table.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const args = process.argv.slice(2), counts = args.includes('--counts');
const plain = args.filter(a => !a.startsWith('--')), [built, reportFolder] = plain.slice(0, 2).map(x => x && path.resolve(x)), label = plain[2];
if (!built || !reportFolder || !label) throw Error('Usage: node tests/browser/benchmark_scaling.cjs BUILD REPORT LABEL [--counts]');
const bootstrap = JSON.parse(fs.readFileSync(path.join(built, 'editor-bootstrap.json')));
const target = '2'.repeat(32), COPIES = 24, STEP = 48;

// The 9-node cluster that carries the conversion wires in the base graph, copied 24 times (as Ctrl+D did in the audit): 248
// nodes, 136 wires, 125 of them conversions. 基準圖裡帶轉換線的 9 個節點，複製 24 次（同排查時的 Ctrl＋D）：248 節點、136 線。
const CLUSTER = ['n14ad3a26b739', 'nd9052a8cfd8c', 'ndacfca70715a4188b4654c397a55c38a', 'ndf1a0d36e8bb43e78c2399e136288865',
  'nc75a3b96a9654918bff5ef13479a7c14', 'n722439006d09', 'nedfb0f9e6dd5', 'n718d19ab3cc3', 'ne852d6bf9732'];
const COPY_IDS = new Set();
function fixture() {
  const graph = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/scaling_base_graph.json'), 'utf8'));
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/shader/${target}/`);
  await page.locator('.react-flow__node').nth(247).waitFor();
  await page.waitForTimeout(1500);
  const nodes = await page.locator('.react-flow__node').count(), edges = await page.locator('.react-flow__edge').count();
  if (nodes !== 248 || edges !== 136) throw Error(`graph is ${nodes} nodes, ${edges} edges`);

  // In-page recorder: Event Timing, long animation frames, rAF gaps, pointerdown-to-paint latency, and the profiling counters.
  // 頁內記錄器：Event Timing、長畫格、rAF 間隔、按下到畫出的時間、以及量測版的計數。
  await page.evaluate(copyIds => {
    const H = globalThis.__H = { on: false, copies: new Set(copyIds) };
    H.reset = () => { H.events = []; H.loaf = []; H.gaps = []; H.latency = []; H.counts = {}; if (globalThis.__prof) { globalThis.__prof.data.clear(); globalThis.__prof.on = true; } };
    new PerformanceObserver(l => { if (H.on) for (const e of l.getEntries()) H.events.push([e.name, e.duration]); }).observe({ type: 'event', durationThreshold: 16 });
    new PerformanceObserver(l => { if (H.on) for (const e of l.getEntries()) H.loaf.push([Math.round(e.duration), Math.round(e.scripts.reduce((s, x) => s + x.forcedStyleAndLayoutDuration, 0))]); }).observe({ type: 'long-animation-frame' });
    let last = performance.now(); const loop = t => { if (H.on) H.gaps.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    // pointerdown (capture) to the frame after the next paint. 按下（捕捉階段）到下一次畫出之後的那一格。
    addEventListener('pointerdown', () => { if (!H.on) return; const t = performance.now(); requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => H.latency.push(performance.now() - t); ch.port2.postMessage(0); }); }, true);
    H.start = () => { H.reset(); H.on = true; };
    H.stop = () => { H.on = false; if (globalThis.__prof) { globalThis.__prof.on = false; H.counts = Object.fromEntries([...globalThis.__prof.data].map(([k, v]) => [k, v.n])); }
      const gaps = H.gaps.slice(1); return { events: H.events, loaf: H.loaf, latency: H.latency, gaps, long: gaps.filter(g => g > 50).length, counts: H.counts }; };
    H.clean = () => [...document.querySelectorAll('.react-flow__node')].map(n => { const t = n.querySelector('.node-title'); if (!t) return null; const b = t.getBoundingClientRect(), x = b.x + 24, y = b.y + b.height / 2;
      const pane = document.querySelector('.react-flow').getBoundingClientRect();
      return document.elementFromPoint(x, y)?.closest('.react-flow__node') === n && x > pane.x + 40 && x < pane.right - 40 && y > pane.y + 60 && y < pane.bottom - 80 ? { id: n.dataset.id, x, y, copy: H.copies.has(n.dataset.id) } : null; }).filter(Boolean);
    H.empty = () => { const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
      for (let y = pane.bottom - 120; y > pane.y + 100; y -= 20) for (let x = pane.right - 80; x > pane.x + 80; x -= 20) if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y }; return null; };
  }, [...COPY_IDS]);
  const run = async (name, fn) => { await page.evaluate(() => globalThis.__H.start()); await fn(); await page.waitForTimeout(400); const r = await page.evaluate(() => globalThis.__H.stop()); results[name] = r; return r; };
  const results = {}, summary = {};
  const clean = await page.evaluate(() => globalThis.__H.clean());
  const base = clean.filter(n => !n.copy);     // base-graph nodes that can be clicked 基準圖裡點得到的節點
  const tops = clean.filter(n => n.copy);      // the topmost copy of each stack 每疊最上面的那個複本
  if (base.length < 10 || tops.length < 1) throw Error(`not enough clickable nodes: ${base.length} base, ${tops.length} tops`);
  // The stacks' screen box, for the box selection. 複本疊的螢幕範圍，給框選用。
  const stacks = await page.evaluate(() => { const r = [...document.querySelectorAll('.react-flow__node')].filter(n => globalThis.__H.copies.has(n.dataset.id)).map(n => n.getBoundingClientRect());
    return { left: Math.min(...r.map(b => b.left)), top: Math.min(...r.map(b => b.top)), right: Math.max(...r.map(b => b.right)), bottom: Math.max(...r.map(b => b.bottom)) }; });
  const [A, B] = base, empty = await page.evaluate(() => globalThis.__H.empty());
  const click = async (p, shift) => { if (shift) await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); if (shift) await page.keyboard.up('Shift'); };
  // Keys go to the canvas as the editor's own tests send them (a real Delete press is lost when React Flow re-registers its key
  // listener between renders: deleteKeyCode is a new array each render, see the audit's D1). 按鍵送到畫布，同編輯器測試；真的按 Delete 會被
  // React Flow 每次重繪重掛監聽吃掉（D1）。
  const key = (k, ctrl = false) => page.evaluate(([k, ctrl]) => { document.activeElement?.blur?.(); document.querySelector('.react-flow__pane').dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, ctrlKey: ctrl, bubbles: true, cancelable: true })); }, [k, ctrl]);
  const drag = async (from, dx, dy, steps, button = 'left', pause = 16) => { await page.mouse.move(from.x, from.y); await page.mouse.down({ button });
    for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + dx * i / steps, from.y + dy * i / steps); await page.waitForTimeout(pause); } await page.mouse.up({ button }); };
  const undo = async () => { await key('z', true); await page.waitForTimeout(500); };

  // M1 / M2: switch the selection between two nodes. 換點節點。
  await click(A); await page.waitForTimeout(300);
  let r = await run('M1 select switch', async () => { for (let i = 0; i < 10; i++) { await click(i % 2 ? A : B); await page.waitForTimeout(250); } });
  summary.M1_latency_ms = median(r.latency); summary.M1_eventTiming_ms = median(r.events.filter(e => e[0] === 'pointerdown').map(e => e[1]));
  summary.M1_long_frames = r.long; if (counts) summary.M2_renders_per_click = +(Object.values(r.counts).reduce((s, n) => s + n, 0) / 10).toFixed(0);
  if (counts) summary.M2_top = Object.entries(r.counts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // M3: drag 8 selected base nodes (spread out, never stacked). 拖 8 個已選的基準節點（分散、不疊）。
  // Selected by events on their titles (robust to overlap), then dragged with the real mouse from the first, which is clickable.
  // 用事件直接選它們的標題（不怕重疊），再用真滑鼠從第一個（點得到的）拖。
  const eight = base.slice(0, 8);
  await page.evaluate(ids => { ids.forEach((id, i) => { const t = document.querySelector(`.react-flow__node[data-id="${id}"] .node-title`); const b = t.getBoundingClientRect();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) t.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') ? 0 : 1, pointerId: 1, pointerType: 'mouse', shiftKey: i > 0, view: window }) : new MouseEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') || type === 'click' ? 0 : 1, shiftKey: i > 0, view: window })); }); }, eight.map(n => n.id));
  await page.waitForTimeout(300);
  const selected = await page.locator('.react-flow__node.selected').count();
  const posBefore = await page.evaluate(id => document.querySelector(`.react-flow__node[data-id="${id}"]`).style.transform, eight[0].id);
  r = await run('M3 drag 8', async () => { await drag(eight[0], 60, 40, 20); });
  summary.M3_moved = (await page.evaluate(id => document.querySelector(`.react-flow__node[data-id="${id}"]`).style.transform, eight[0].id)) !== posBefore;
  summary.M3_selected = selected; summary.M3_frame_ms_median = median(r.gaps); summary.M3_frame_ms_max = max(r.gaps);
  if (counts) summary.M3_wrappers_per_frame = +((r.counts.NodeWrapper ?? 0) / 20).toFixed(0);
  await undo();

  // M4: right-drag box select from past the stacks' lower-right corner up over them (clipped to the canvas). 右鍵框選：從複本疊右下角外往左上框過去（不出畫布）。
  const pane = await page.locator('.react-flow__pane').boundingBox();
  const corner = { x: Math.min(stacks.right + 30, pane.x + pane.width - 20), y: Math.min(stacks.bottom + 30, pane.y + pane.height - 60) };
  const to = { x: Math.max(stacks.left - 30, pane.x + 20), y: Math.max(stacks.top - 30, pane.y + 80) };
  r = await run('M4 box select', async () => { await drag(corner, to.x - corner.x, to.y - corner.y, 15, 'right', 30); });
  summary.M4_frame_ms_max = max(r.gaps); summary.M4_release_loaf_ms = max(r.loaf.map(l => l[0])); summary.M4_selected_after = await page.locator('.react-flow__node.selected').count();
  if (counts) summary.M4_cards_total = r.counts.NodeCard ?? 0;
  await click(empty); await page.waitForTimeout(300);

  // M5: pan on empty canvas. 平移。
  r = await run('M5 pan', async () => { await drag(empty, -80, -60, 20); });
  summary.M5_long_frames = r.long; summary.M5_frame_ms_max = max(r.gaps);
  summary.M5_layer_left = await page.locator('.gesture-cursor').count(); // a cursor layer must not outlive the gesture 游標層不能留到手勢之後

  // M6 / M8 at 100% around the Color node: its value box and output port must be under the pointer, not under a stacked copy.
  // M6、M8 在 Color 節點對準到 100%：數值框與輸出接孔要真的在指標下，不被疊著的複本蓋住。
  // Selected by events on its title (it may sit under a stack), then framed with F. 用事件直接選它的標題（可能被疊住），再按 F 對準。
  await page.evaluate(() => { const t = document.querySelector('.react-flow__node[data-id="color"] .node-title'); const b = t.getBoundingClientRect();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) t.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') ? 0 : 1, pointerId: 1, pointerType: 'mouse', view: window }) : new MouseEvent(type, { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 8, button: 0, buttons: type.endsWith('up') || type === 'click' ? 0 : 1, view: window })); });
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
  // M10 (the Graph JSON panel open) is measured by hand: the panel sits in the closed right pane and its tab cannot be reached the same way in every layout.
  // M10（圖的 JSON 面板）手動量：面板在關著的右側窗格裡，各版面下沒有一致的打開路徑。

  summary.errors = errors; summary.build = built; summary.counts = counts;
  const out = path.join(reportFolder, `scaling-${label}${counts ? '-counts' : ''}.json`);
  fs.writeFileSync(out, JSON.stringify({ summary, results }, null, 1));
  console.log('| metric | value |\n|---|---|\n' + Object.entries(summary).filter(([k]) => !['errors', 'build', 'counts', 'M2_top'].includes(k)).map(([k, v]) => `| ${k} | ${v} |`).join('\n'));
  if (summary.M2_top) console.log('M2 top:', JSON.stringify(summary.M2_top));
  if (errors.length) console.log('page errors:', errors);
  console.log('written', out);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
