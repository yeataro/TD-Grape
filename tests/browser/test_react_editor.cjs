/* Production bundle + real browser. HTTP responses here are controlled fault fixtures,
 * not evidence of TD/GPU execution. Live verification uses the same UI separately.
 * 正式建置與真實 RF；此檔的宿主回覆是故障測試替身，不冒充 TD 驗證。
 * node tests/browser/test_react_editor.cjs BUILD_FOLDER REPORT_FOLDER
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const [buildFolder, reportFolder] = process.argv.slice(2).map(x => path.resolve(x));
const bootstrap = JSON.parse(fs.readFileSync(path.join(buildFolder, 'editor-bootstrap.json')));
const target = '1'.repeat(32), clone = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.privateMetadata = { retained: true };
  graph.stages.pixel.nodes[0].ui = { x: 40, y: 40 };
  graph.stages.pixel.nodes[1].ui = { x: 730, y: 40 };
  graph.stages.pixel.nodes.push({ id: 'a', definitionUuid: 'sgrape.builtin.float', params: { value: 2 }, ui: { x: 40, y: 380 } },
    { id: 'sum', definitionUuid: 'sgrape.builtin.add', params: { type: 'float' }, ui: { x: 390, y: 330 } },
    { id: 'mx', definitionUuid: 'sgrape.builtin.math', params: { type: 'float' }, ui: { x: 1050, y: 330 } },
    { id: 'v3', definitionUuid: 'sgrape.builtin.vector', params: { type: 'vec3', components: [0, 0, 0, 0] }, ui: { x: 40, y: 760 } },
    { id: 'cb', definitionUuid: 'sgrape.builtin.combine', params: { type: 'vec4', groups: {}, components: [0, 0, 0, 0] }, ui: { x: 390, y: 760 } },
    { id: 'sw', definitionUuid: 'sgrape.builtin.swizzle', params: { type: 'vec2', mask: 'xy' }, ui: { x: 760, y: 760 } });
  return graph;
}
(async () => {
  fs.mkdirSync(reportFolder, { recursive: true });
  let state = { graph: fixture(), revision: 1, targetId: target }, fail = false, down = false;
  const writes = [], checks = [], errors = [];
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const action = req.url.split('/').at(-1); let raw = ''; for await (const chunk of req) raw += chunk;
        const body = raw && JSON.parse(raw); res.setHeader('Content-Type', 'application/json');
        // As measured on live TD while minimized: the queue answers, nothing is processed.
        if (down) { res.statusCode = 503; return res.end(JSON.stringify({ code: 'manager_not_responding', error: 'TD did not process this request.' })); }
        if (action === 'state') return res.end(JSON.stringify({ state, target: '/test/formal_top', shaderKind: 'top',
          frontendCompiler: { protocol: 'grape.top.ts.1', catalogHash: bootstrap.catalogHash, required: true } }));
        if (action === 'save') return res.end(JSON.stringify({ saved: 'fixture.toe' }));
        writes.push(body);
        if (fail) { res.statusCode = 422; return res.end(JSON.stringify({ error: 'fixture GPU refused', layer: 'gpu', code: 'shader_compile' })); }
        if (body.revision !== state.revision) { res.statusCode = 409; return res.end(JSON.stringify({ error: 'Conflict: document revision conflict' })); }
        assert.deepEqual(JSON.parse(body.frontendArtifact.snapshot), body.graph);
        state = { graph: body.graph, revision: state.revision + 1, targetId: target };
        return res.end(JSON.stringify({ state }));
      }
      const name = decodeURIComponent(req.url.split('?')[0]);
      const file = path.resolve(buildFolder, '.' + name);
      assert.ok(file.startsWith(buildFolder + path.sep));
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch (e) { res.statusCode = 500; res.end(String(e)); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  const url = `http://127.0.0.1:${server.address().port}/react-editor.html?target=${target}`;
  const field = label => page.getByRole('textbox', { name: label, exact: true });
  const settle = () => page.waitForTimeout(1100);
  const count = () => state.graph.stages.pixel.edges.length;
  async function wire(from, to) {
    const a = await page.getByLabel(from, { exact: true }).boundingBox(), b = await page.getByLabel(to, { exact: true }).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 }); await page.mouse.up(); await settle();
  }
  try {
    await page.goto(url); await field('a value 0').waitFor(); await settle();
    await page.evaluate(() => { window.keptInput = document.querySelector('[aria-label="a value 0"]'); window.keptCard = window.keptInput.closest('.grape-node'); });
    await field('a value 0').fill('2.');
    await page.evaluate(() => { const select = document.querySelector('[aria-label="sum type"]'); select.value = 'vec4'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal(await field('a value 0').inputValue(), '2.');
    assert.equal(await page.evaluate(() => document.activeElement === window.keptInput && window.keptCard === window.keptInput.closest('.grape-node')), true);
    await field('a value 0').press('Escape'); await settle();
    assert.equal(state.graph.stages.pixel.nodes.find(n => n.id === 'a').params.value, 2);
    checks.push('unrelated type update retains focused DOM and unfinished number; Escape cancels');
    await page.getByLabel('sum type', { exact: true }).selectOption('float'); await settle();
    await wire('a output out', 'sum input a'); assert.equal(count(), 2);
    assert.equal(await field('sum a 0').count(), 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.equal(count(), 1);
    assert.equal(await field('sum a 0').count(), 1);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(); assert.equal(count(), 2);
    await wire('color output out', 'sum input a'); assert.equal(count(), 2); // vec4 -> float is refused
    assert.equal(state.graph.stages.pixel.edges.find(e => e.to[0] === 'sum').from[0], 'a');
    await wire('sum output out', 'sum input b'); assert.equal(count(), 2); // cycle refused
    await wire('sum output out', 'pixel_out input color'); assert.equal(count(), 2); // replacement + scalar expansion
    assert.equal(state.graph.stages.pixel.edges.find(e => e.to[0] === 'pixel_out').from[0], 'sum');
    checks.push('RF hit testing uses Grape rules; replace, scalar expansion, reject vec4 narrowing/cycle, Undo/Redo');
    // Module-declared spare input: one drop adds the port and the edge; the edge lands on
    // the new handle's measured position; one Undo removes both.
    const mathOf = () => state.graph.stages.pixel.nodes.find(n => n.id === 'mx');
    await wire('a output out', 'mx Add input');
    assert.equal(mathOf().params.inputCount, 4);
    assert.ok(state.graph.stages.pixel.edges.some(e => e.from[0] === 'a' && e.to[0] === 'mx' && e.to[1] === 'input3'));
    const gap = await page.evaluate(() => {
      const paths = [...document.querySelectorAll('.react-flow__edge path.react-flow__edge-path')];
      const handle = document.querySelector('[aria-label="mx input input3"]').getBoundingClientRect();
      const hx = handle.x + handle.width / 2, hy = handle.y + handle.height / 2;
      return Math.min(...paths.map(path => { const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()); return Math.hypot(end.x - hx, end.y - hy); }));
    });
    assert.ok(gap < 8, 'edge end is ' + gap.toFixed(1) + 'px from the new handle');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle();
    assert.equal(mathOf().params.inputCount ?? 3, 3);
    assert.ok(!state.graph.stages.pixel.edges.some(e => e.to[0] === 'mx'));
    checks.push('spare input from module declaration: one drop adds port + edge at measured handle; one Undo');
    // Right-drag on blank canvas box-selects (legacy parity, 17.1); selection is runtime only.
    const boxOf = id => page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
    const [ba, bs] = [await boxOf('a'), await boxOf('sum')], beforeBox = writes.length;
    const x0 = Math.min(ba.x, bs.x) - 25, y0 = Math.min(ba.y, bs.y) - 25;
    const x1 = Math.max(ba.x + ba.width, bs.x + bs.width) + 25, y1 = Math.max(ba.y + ba.height, bs.y + bs.height) + 25;
    await page.mouse.click(x0, y0); // plain click on blank canvas clears selection
    await page.mouse.move(x0, y0); await page.mouse.down({ button: 'right' });
    await page.mouse.move(x1, y1, { steps: 12 }); await page.mouse.up({ button: 'right' }); await settle();
    const selected = await page.locator('.react-flow__node.selected').evaluateAll(nodes => nodes.map(n => n.dataset.id).sort());
    assert.deepEqual(selected, ['a', 'sum']); assert.equal(writes.length, beforeBox, 'selection never writes the document');
    await page.mouse.click(x0, y0); await settle();
    assert.equal(await page.locator('.react-flow__node.selected').count(), 0);
    checks.push('right-drag on blank canvas box-selects nodes without writing the document');
    // Released over the toolbar: the browser menu after a right-drag is still suppressed.
    await page.evaluate(() => { window.menus = []; window.addEventListener('contextmenu', e => window.menus.push({ prevented: e.defaultPrevented, inPane: !!e.target.closest('.react-flow__pane') })); });
    const nav = await page.locator('nav').boundingBox();
    await page.mouse.move(x0, y0); await page.mouse.down({ button: 'right' });
    await page.mouse.move(nav.x + nav.width / 2, nav.y + nav.height / 2, { steps: 12 }); await page.mouse.up({ button: 'right' }); await settle();
    const menus = await page.evaluate(() => window.menus);
    assert.ok(menus.length >= 1, 'the browser raised a context menu event'); assert.ok(menus.every(m => m.prevented), JSON.stringify(menus));
    await page.mouse.click(x0, y0); await settle();
    checks.push('right-drag released outside the canvas does not open the browser menu');
    // 17.2: Combine groups a wired vec3 over X/Y/Z (core planner); Swizzle's module controls edit it.
    const nodeOf = id => state.graph.stages.pixel.nodes.find(n => n.id === id);
    await page.locator('.react-flow__node[data-id="cb"]').scrollIntoViewIfNeeded();
    await wire('v3 output out', 'cb input x');
    assert.deepEqual(nodeOf('cb').params.groups, { x: 'vec3' });
    assert.equal(await page.getByLabel('cb input y', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('cb input w', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle();
    assert.deepEqual(nodeOf('cb').params.groups ?? {}, {});
    await page.getByLabel('sw component0', { exact: true }).selectOption('y'); await settle();
    assert.equal(nodeOf('sw').params.mask, 'yy');
    await page.locator('.react-flow__node[data-id="sw"] button', { hasText: '+' }).click(); await settle();
    assert.equal(nodeOf('sw').params.mask.length, 3);
    const menuOptions = await page.getByLabel('新增節點', { exact: true }).locator('option').evaluateAll(list => list.map(o => o.value));
    assert.ok(menuOptions.includes('sgrape.builtin.vector') && !menuOptions.includes('sgrape.builtin.vec2') && !menuOptions.includes('sgrape.builtin.float'));
    checks.push('Combine groups a vec3 over X/Y/Z with one Undo; Swizzle controls edit the mask; add menu omits retired definitions');
    await field('sum b 0').fill('3'); await field('sum b 0').press('Enter'); await settle();
    assert.equal(state.graph.stages.pixel.nodes.find(n => n.id === 'sum').inputValues.b, 3);
    assert.deepEqual(state.graph.privateMetadata, { retained: true });
    const beforeLadder = writes.length;
    await field('a value 0').focus(); await field('a value 0').press('Alt+l');
    await page.getByRole('tooltip').waitFor(); const box = await page.getByRole('tooltip').boundingBox();
    await page.keyboard.press('ArrowDown'); assert.equal((await page.getByRole('tooltip').boundingBox()).width, box.width);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    assert.equal(writes.length, beforeLadder); await page.keyboard.press('Escape'); await settle();
    assert.equal(writes.length, beforeLadder);
    await field('a value 0').press('Alt+l'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await settle();
    assert.equal(writes.length, beforeLadder + 1);
    checks.push('Value Ladder fixed width, transient draft, cancel and one gesture/commit');
    // Drag in small steps; no graph write until release, no unrelated card replacement.
    const card = page.locator('.react-flow__node[data-id="a"]'), title = card.locator('.node-title');
    const pos = await title.boundingBox(), prior = clone(state.graph.stages.pixel.nodes.find(n => n.id === 'a').ui), beforeDrag = writes.length;
    await page.mouse.move(pos.x + 45, pos.y + 15); await page.mouse.down(); await page.mouse.move(pos.x + 110, pos.y + 80, { steps: 20 });
    await settle(); assert.equal(writes.length, beforeDrag); await page.mouse.up(); await settle();
    assert.equal(writes.length, beforeDrag + 1); assert.notDeepEqual(state.graph.stages.pixel.nodes.find(n => n.id === 'a').ui, prior);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.deepEqual(state.graph.stages.pixel.nodes.find(n => n.id === 'a').ui, prior);
    checks.push('drag remains RF runtime until release; one history transaction; undo restores position');
    await field('a value 0').fill('bad'); await field('a value 0').press('Enter');
    assert.equal(await field('a value 0').getAttribute('aria-invalid'), 'true');
    fail = true; await field('a value 0').fill('4'); await field('a value 0').press('Enter'); await settle();
    assert.match(await page.getByRole('status').innerText(), /gpu.*shader_compile/);
    await page.reload(); await page.getByText('找到此頁先前的草稿', { exact: false }).waitFor();
    assert.ok(await page.locator('nav').getAttribute('inert') !== null);
    fail = false; await page.getByRole('button', { name: '還原草稿', exact: true }).click(); await settle();
    assert.equal(state.graph.stages.pixel.nodes.find(n => n.id === 'a').params.value, 4);
    checks.push('invalid numeric input rejected; GPU fault keeps draft; reload requires explicit recovery');
    await page.getByRole('button', { name: '保存 TD 專案', exact: true }).click(); await settle();
    assert.match(await page.getByRole('status').innerText(), /fixture.toe/);
    await page.reload(); await field('a value 0').waitFor(); assert.equal(await field('a value 0').inputValue(), '4');
    const beforeColor = writes.length;
    await page.getByLabel('color value color', { exact: true }).evaluate(input => {
      input.value = '#778899'; input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = '#224466'; input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle(); assert.equal(writes.length, beforeColor);
    await page.getByLabel('color value color', { exact: true }).evaluate(input => input.dispatchEvent(new Event('change', { bubbles: true })));
    await settle(); assert.equal(writes.length, beforeColor + 1);
    checks.push('native colour preview remains local until change commits');
    const beforeAdd = state.graph.stages.pixel.nodes.length;
    await page.getByLabel('新增節點', { exact: true }).selectOption('sgrape.builtin.scalar'); await settle();
    assert.equal(state.graph.stages.pixel.nodes.length, beforeAdd + 1);
    const newId = state.graph.stages.pixel.nodes.at(-1).id;
    await page.locator(`.react-flow__node[data-id="${newId}"] .node-title`).click();
    await page.keyboard.press('Delete'); await settle();
    assert.equal(state.graph.stages.pixel.nodes.length, beforeAdd);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle();
    assert.equal(state.graph.stages.pixel.nodes.at(-1).id, newId);
    checks.push('add, delete selection and Undo preserve stable node identity');
    // TD away (Q28): editing continues, recovery resends; a conflict floats without blocking.
    const aValue = () => state.graph.stages.pixel.nodes.find(n => n.id === 'a').params.value;
    const statusText = () => page.getByRole('status').innerText();
    down = true; await field('a value 0').fill('7'); await field('a value 0').press('Enter'); await settle();
    assert.match(await statusText(), /TD 沒有回應（可能最小化）/);
    await page.getByText('如何恢復', { exact: true }).waitFor();
    await field('a value 0').fill('8'); await field('a value 0').press('Enter'); await settle();
    assert.equal(await field('a value 0').inputValue(), '8'); assert.equal(aValue(), 4);
    down = false;
    for (let i = 0; i < 40 && aValue() !== 8; i++) await page.waitForTimeout(250);
    assert.equal(aValue(), 8); assert.match(await statusText(), /已同步到 TD/);
    checks.push('TD not responding: hint + recovery help, editing continues, automatic resend on return');
    const theirs = clone(state.graph); theirs.stages.pixel.nodes.find(n => n.id === 'a').params.value = 1;
    state = { graph: theirs, revision: state.revision + 1, targetId: target };
    await field('a value 0').fill('9'); await field('a value 0').press('Enter'); await settle();
    await page.getByText('TD 端的圖似乎有被修改', { exact: false }).first().waitFor();
    assert.equal(await page.locator('.canvas').getAttribute('inert'), null);
    await field('a value 0').fill('10'); await field('a value 0').press('Enter'); await settle();
    assert.equal(await field('a value 0').inputValue(), '10');
    await page.getByRole('button', { name: 'TD 端', exact: true }).click(); await settle();
    assert.equal(await field('a value 0').inputValue(), '1'); assert.equal(aValue(), 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle();
    assert.equal(await field('a value 0').inputValue(), '10'); assert.equal(aValue(), 10);
    checks.push('conflict floats without blocking; TD side adopted; one Undo recalls and resends the editor version');
    await page.screenshot({ path: path.join(reportFolder, 'browser.png') });
    assert.deepEqual(errors, []); checks.push('save and reopen use host document; runtime fields excluded');
    fs.writeFileSync(path.join(reportFolder, 'browser.json'), JSON.stringify({ passed: true, browser: browser.version(), checks, writes: writes.length }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }));
  } catch (error) {
    await page.screenshot({ path: path.join(reportFolder, 'failure.png') });
    fs.writeFileSync(path.join(reportFolder, 'browser.json'), JSON.stringify({ passed: false, checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
