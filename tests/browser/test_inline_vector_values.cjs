/* Isolated Chromium coverage for inline values and component vector composition.
 * node test_inline_vector_values.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 * Uses test_glsl_code.cjs's local fixture API; never connects to a running TD.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {harness} = require('./test_glsl_code.cjs');

const socket = (node, kind, port) => `[data-node="${node}"] .port[data-kind="${kind}"][data-port="${port}"]`;
const numeric = (node, port = '$value', component = 0) =>
  `input[data-inline-node="${node}"][data-inline-port="${port}"][data-component="${component}"]`;

async function run() {
  const [source, stateFile, folder] = process.argv.slice(2);
  assert.ok(source && stateFile && folder, 'Expected SOURCE_DIR STATE_JSON REPORT_DIR');
  const h = await harness(source, stateFile, folder, {touch: true});
  const {page, checks, errors, at, drag, settle} = h;
  try {
    const field = (node, port = '$value', component = 0) => page.locator(numeric(node, port, component));
    const graphJSON = () => page.evaluate(() => JSON.stringify(graph));
    const semanticJSON = () => page.evaluate(() => JSON.stringify(graph, (key, value) => key === 'ui' ? undefined : value));
    const history = () => page.evaluate(() => past.length);
    const value = (node = 'scalar') => page.evaluate(id => current().nodes.find(n => n.id === id).params.value, node);
    const position = (node = 'scalar') => page.evaluate(id => clone(current().nodes.find(n => n.id === id).ui), node);
    const connect = (from, to, port, output = 'out') => page.evaluate(([from, to, port, output]) => {
      const source = current().nodes.find(n => n.id === from), target = current().nodes.find(n => n.id === to);
      return connectPorts(
        {node: from, kind: 'outputs', port: output, type: ports(source, 'outputs')[output]},
        {node: to, kind: 'inputs', port, type: ports(target, 'inputs')[port]}
      );
    }, [from, to, port, output]);
    const reset = (expanded = true) => page.evaluate(expanded => {
      clearTimeout(autoTimer); connectionInterrupted = true; readonly = false;
      graphTrail = []; graph.functions = []; graph.declarations = []; stage = 'pixel';
      selected = selectedEdge = null; selection.clear(); past = []; future = [];
      clearCompileDiagnostics();
      graph.stages.pixel = {nodes: [
        testNode('scalar', 'float', 24, 48, {value: .3}),
        testNode('pair', 'vec2', 24, 230, {value: [.6, .7]}),
        testNode('base', 'vec4', 24, 415, {value: [.8, .9, 1, 1]}),
        testNode('vector', 'vector', 340, 95, {type: 'vec4', components: [.1, .2, .3, .4], groups: {}}),
        testNode('other', 'add', 655, 350, {type: 'float'}),
        testNode('pixel', 'pixel_out', 655, 95)
      ], edges: []};
      if (expanded) current().nodes.find(n => n.id === 'vector').ui.componentsExpanded = true;
      scale = .8; pan = {x: 22, y: 25}; render();
    }, expanded);
    const toggle = () => page.locator('[data-vector-expand="vector"]');
    const summary = () => page.locator('[data-vector-summary="vector"]');
    const socketVisible = (kind, port) => page.locator(socket('vector', kind, port)).isVisible();
    const paired = async (input, output) => {
      const left = await page.locator(socket('vector', 'inputs', input)).boundingBox();
      const right = await page.locator(socket('vector', 'outputs', output)).boundingBox();
      assert.ok(left && right, `${input}/${output} sockets must both be visible`);
      assert.ok(left.x < right.x, `${input}/${output} must read from left to right`);
      assert.ok(Math.abs(left.y + left.height / 2 - right.y - right.height / 2) <= 1, `${input}/${output} must share one row`);
    };
    const checkBounds = async () => {
      const layout = await page.evaluate(() => [...document.querySelectorAll('.node')].map(card => {
        const bounds = card.getBoundingClientRect();
        const controls = [...card.querySelectorAll('input[data-inline-node],.node-value,[data-vector-expand],.vector-components-summary,.port-label')]
          .filter(entry => entry.getClientRects().length)
          .map(entry => ({label: entry.getAttribute('aria-label') || entry.textContent, numeric: entry.matches('input'), bounds: entry.getBoundingClientRect().toJSON()}));
        const captions = [...card.querySelectorAll('.port-label,.port-type')]
          .filter(entry => entry.getClientRects().length)
          .map(entry => ({label: entry.textContent, bounds: entry.getBoundingClientRect().toJSON()}));
        return {node: card.dataset.node, bounds: bounds.toJSON(), controls, captions};
      }));
      for (const card of layout) for (const item of card.controls) {
        assert.ok(item.bounds.left >= card.bounds.left - 1 && item.bounds.right <= card.bounds.right + 1,
          `${card.node}: ${item.label} overflows its card horizontally`);
        assert.ok(item.bounds.top >= card.bounds.top - 1 && item.bounds.bottom <= card.bounds.bottom + 1,
          `${card.node}: ${item.label} overflows its card vertically`);
        if (item.numeric) for (const caption of card.captions) {
          const overlapX = Math.min(item.bounds.right, caption.bounds.right) - Math.max(item.bounds.left, caption.bounds.left);
          const overlapY = Math.min(item.bounds.bottom, caption.bounds.bottom) - Math.max(item.bounds.top, caption.bounds.top);
          assert.ok(overlapX <= 1 || overlapY <= 1, `${card.node}: numeric field overlaps ${caption.label}`);
        }
      }
    };

    const checkMainLabels = async () => {
      const labels = await page.locator('[data-node="vector"] .vector-whole .port-label').evaluateAll(entries =>
        entries.map(entry => ({text: entry.textContent, width: entry.clientWidth, content: entry.scrollWidth})));
      for (const label of labels) assert.ok(label.content <= label.width + 1, `whole-vector label is truncated: ${label.text}`);
    };
    await reset(false);
    assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => !!current().nodes.find(n => n.id === 'vector').ui.componentsExpanded), false);
    await paired('value', 'out'); await checkMainLabels();
    for (const port of 'xyzw') {
      assert.equal(await socketVisible('inputs', port), false);
      assert.equal(await socketVisible('outputs', port), false);
    }
    assert.equal(await summary().innerText(), '0.1 · 0.2 · 0.3 · 0.4');
    const compactBox = await page.locator('[data-node="vector"]').boundingBox();
    await checkBounds();
    await page.screenshot({path: path.join(folder, 'vector-compact.png')});
    checks.push('Vector starts compact with its whole input/output paired on one row and unused component rows hidden');

    const beforeExpand = await semanticJSON();
    await toggle().focus(); await page.keyboard.press('Enter'); await settle();
    assert.equal(await toggle().getAttribute('aria-expanded'), 'true');
    assert.equal(await summary().count(), 0);
    assert.equal(await toggle().evaluate(entry => entry === document.activeElement), true);
    assert.equal(await page.evaluate(() => current().nodes.find(n => n.id === 'vector').ui.componentsExpanded), true);
    assert.equal(await semanticJSON(), beforeExpand);

    for (const port of 'xyzw') await paired(port, port);
    await paired('value', 'out'); await checkMainLabels();
    const expandedBox = await page.locator('[data-node="vector"]').boundingBox();
    assert.ok(expandedBox.height > compactBox.height);
    assert.ok(Math.abs(expandedBox.width - compactBox.width) <= 1);
    await checkBounds();
    await page.screenshot({path: path.join(folder, 'vector-expanded.png')});
    await page.keyboard.press('Space'); await settle();
    assert.equal(await semanticJSON(), beforeExpand);
    assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle().evaluate(entry => entry === document.activeElement), true);
    await page.evaluate(() => render());
    assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
    checks.push('Components retains focus across keyboard Enter/Space toggles and survives redraw as UI state only; expanded pairs align without widening the card');

    assert.equal(await connect('scalar', 'vector', 'z'), true);
    await paired('z', 'z');
    for (const port of 'xyw') assert.equal(await socketVisible('outputs', port), false);
    assert.equal(await connect('vector', 'other', 'a', 'z'), true);
    await page.evaluate(() => change(() => {current().edges = current().edges.filter(e => e.to.join(':') !== 'vector:z');}));
    await paired('z', 'z');
    assert.equal(Number(await field('vector', 'z').inputValue()), .3);
    assert.equal(await connect('pair', 'vector', 'y'), true);
    assert.equal(await socketVisible('inputs', 'y'), true);
    assert.equal(await socketVisible('inputs', 'z'), false);
    assert.equal(await socketVisible('outputs', 'z'), true);
    assert.equal(await page.evaluate(() => current().edges.some(e => e.from.join(':') === 'vector:z' && e.to.join(':') === 'other:a')), true);
    for (const port of 'xw') assert.equal(await socketVisible('outputs', port), false);
    await checkBounds();
    await page.screenshot({path: path.join(folder, 'vector-compact-wired.png')});
    checks.push('collapsed Vector keeps rows connected on either side, including a distinct Z output beside a merged YZ input');

    assert.equal(await field('scalar').count(), 1);
    assert.equal(await field('other', 'b').count(), 1);
    for (const id of ['pair', 'base', 'pixel']) assert.equal(await page.locator(`[data-inline-node="${id}"]`).count(), 0);
    assert.match(await page.locator('[data-node="pair"] .node-value').innerText(), /0\.6.*0\.7/);
    assert.match(await page.locator('[data-node="base"] .node-value').innerText(), /0\.8.*0\.9/);
    await page.locator('[data-node="pair"] .node-title').click();
    assert.equal(await page.locator('#inspector input[type="number"]').count() >= 2, true);
    checks.push('only scalar graph values edit inline; fixed vector summaries stay readable and their full controls remain in Parameter');

    await page.locator('[data-node="base"] .vector-split-shortcut').click();
    const shortcut = await page.evaluate(() => ({id: selected, key: definition(current().nodes.find(n => n.id === selected))?.key,
      expanded: current().nodes.find(n => n.id === selected)?.ui.componentsExpanded}));
    assert.equal(shortcut.key, 'vector'); assert.equal(shortcut.expanded, true);
    assert.equal(await page.locator(socket(shortcut.id, 'outputs', 'z')).isVisible(), true);
    checks.push('the vector split shortcut opens an expanded Vector with component outputs immediately available');

    await reset(false);
    for (const size of [2, 3, 4]) {
      await page.evaluate(size => {
        const n = current().nodes.find(n => n.id === 'vector');
        n.params.type = 'vec' + size; n.params.components = [0, 0, 0, 1]; render();
      }, size);
      const expected = [0, 0, 0, 1].slice(0, size).join(' · ');
      assert.equal(await summary().innerText(), expected);
      const title = await summary().getAttribute('title');
      for (const [index, value] of [0, 0, 0, 1].slice(0, size).entries()) assert.ok(title.includes('XYZW'[index] + ' ' + String(value)));
      assert.equal(await summary().locator('input').count(), 0);
      const beforeRender = await graphJSON(), beforeHistory = await history();
      await page.evaluate(() => render());
      assert.equal(await graphJSON(), beforeRender); assert.equal(await history(), beforeHistory);
    }
    const precise = [0.123456789012345, 123456.7890123, -98765.432109, 0.000000123456789];
    await page.evaluate(values => {current().nodes.find(n => n.id === 'vector').params.components = values; render();}, precise);
    assert.equal(await summary().innerText(), precise.map(String).join(' · '));
    const fullTitle = await summary().getAttribute('title');
    for (const [index, value] of precise.entries()) assert.ok(fullTitle.includes('XYZW'[index] + ' ' + String(value)));
    const overflow = await summary().evaluate(entry => ({visible: entry.clientWidth, content: entry.scrollWidth, overflow: getComputedStyle(entry).textOverflow}));
    assert.equal(overflow.overflow, 'ellipsis'); assert.ok(overflow.content > overflow.visible);
    const toggleCaptionLines = await toggle().evaluate(button => {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT), lines = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim() || node.parentElement.closest('.vector-components-summary')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        lines.push({text: node.textContent, lines: range.getClientRects().length});
      }
      return lines;
    });
    for (const caption of toggleCaptionLines) assert.ok(caption.lines <= 1, `long summary wraps the Components caption: ${caption.text}`);
    await checkBounds();
    await page.screenshot({path: path.join(folder, 'vector-summary-long.png')});
    checks.push('collapsed Vector 2/3/4 summaries show raw manual values without graph/history writes; long values ellipsize with their full text in title');

    await reset(false);
    await page.locator('[data-node="vector"] .node-title').click();
    const parameterW = page.locator('#inspector .input-parameter[data-input="w"] input[type="number"]');
    const parameterHistory = await history();
    await parameterW.fill('0.875'); await parameterW.press('Enter'); await settle();
    assert.equal(await summary().innerText(), '0.1 · 0.2 · 0.3 · 0.875');
    assert.equal(await history(), parameterHistory + 1);
    assert.equal(await connect('pair', 'vector', 'x'), true);
    assert.equal(await summary().innerText(), 'Z 0.3 · W 0.875');
    assert.equal(await connect('vector', 'other', 'a', 'w'), true);
    assert.equal(await summary().innerText(), 'Z 0.3 · W 0.875');
    await page.evaluate(() => {current().nodes.find(n => n.id === 'vector').ui.componentNames = 'rgba'; render();});
    assert.equal(await summary().innerText(), 'B 0.3 · A 0.875');
    await checkBounds();
    await page.screenshot({path: path.join(folder, 'vector-summary-partial.png')});
    assert.equal(await connect('base', 'vector', 'value'), true);
    assert.equal(await summary().count(), 0);
    await page.evaluate(() => change(() => {current().edges = current().edges.filter(e => e.to.join(':') !== 'vector:value');}));
    assert.equal(await summary().innerText(), 'B 0.3 · A 0.875');
    await page.evaluate(() => change(() => {current().edges = current().edges.filter(e => e.to[0] !== 'vector');}));
    assert.equal(await summary().innerText(), '0.1 · 0.2 · 0.3 · 0.875');
    const inlineSummaryHistory = await history();
    await field('vector', 'w').fill('0.625'); await field('vector', 'w').press('Enter'); await settle();
    assert.equal(await history(), inlineSummaryHistory + 1);
    const summaryAfterEnter = await summary().innerText();
    assert.equal(await field('vector', 'w').evaluate(entry => entry === document.activeElement), true);
    const committedSummaryGraph = await graphJSON();
    await field('vector', 'w').fill('0.9375'); await field('vector', 'w').press('Escape');
    assert.equal(await graphJSON(), committedSummaryGraph); assert.equal(await history(), inlineSummaryHistory + 1);
    assert.equal(await summary().innerText(), summaryAfterEnter);
    assert.equal(await field('vector', 'w').inputValue(), '0.625');
    await field('vector', 'w').press('Tab'); await settle();
    const summaryAfterBlur = await summary().innerText();
    assert.equal(summaryAfterEnter, '0.1 · 0.2 · 0.3 · 0.625', JSON.stringify({summaryAfterEnter, summaryAfterBlur}));
    assert.equal(summaryAfterBlur, summaryAfterEnter);
    checks.push('Parameter and inline Enter commits refresh the collapsed summary; incoming groups exclude values, output wires retain them, and baseline disconnect restores the summary');

    await reset(false);
    await page.evaluate(() => {const n = current().nodes.find(n => n.id === 'vector'); n.params.type = 'vec2'; n.ui.componentNames = 'uv'; render();});
    assert.equal(await connect('scalar', 'vector', 'x'), true);
    assert.equal(await summary().innerText(), 'V 0.2');
    assert.equal(await connect('scalar', 'vector', 'y'), true);
    assert.equal(await summary().count(), 0);
    checks.push('partial summaries follow UV component names and disappear when every component is supplied by a wire');

    await reset();
    assert.equal(await page.locator('[data-inline-node="vector"]').count(), 4);
    for (const [index, port] of [...'xyzw'].entries()) {
      assert.equal(Number(await field('vector', port).inputValue()), [.1, .2, .3, .4][index]);
      assert.equal(await page.locator(socket('vector', 'outputs', port)).count(), 1);
    }
    assert.equal(await page.locator(socket('vector', 'inputs', 'value')).count(), 1);
    assert.equal(await page.locator(socket('vector', 'outputs', 'out')).count(), 1);
    checks.push('unconnected Vector shows four editable values plus a whole-value input/output and individual component outputs');

    assert.equal(await connect('scalar', 'vector', 'z'), true);
    assert.equal(await connect('scalar', 'other', 'a'), true);
    assert.equal(await field('vector', 'z').count(), 0);
    assert.equal(await field('vector', 'x').count(), 1);
    const beforeMerge = await graphJSON(), mergeHistory = await history();
    await drag(await at(socket('pair', 'outputs', 'out')), await at(socket('vector', 'inputs', 'y')));
    const merged = await page.evaluate(() => ({
      ports: ports(current().nodes.find(n => n.id === 'vector'), 'inputs'),
      graph: clone(graph), edges: clone(current().edges), scalar: clone(current().nodes.find(n => n.id === 'scalar'))
    }));
    assert.equal(merged.ports.y, 'vec2');
    assert.equal(Object.hasOwn(merged.ports, 'z'), false);
    assert.ok(merged.edges.some(e => e.from.join(':') === 'pair:out' && e.to.join(':') === 'vector:y'));
    assert.ok(!merged.edges.some(e => e.to.join(':') === 'vector:z'));
    assert.ok(merged.edges.some(e => e.from.join(':') === 'scalar:out' && e.to.join(':') === 'other:a'));
    assert.equal(merged.scalar.params.value, .3);
    assert.equal(await page.locator(socket('vector', 'inputs', 'z')).count(), 0);
    assert.equal(await field('vector', 'y').count(), 0);
    assert.equal(await field('vector', 'z').count(), 0);
    assert.equal(await field('vector', 'x').count(), 1);
    assert.equal(await field('vector', 'w').count(), 1);
    assert.equal(await history(), mergeHistory + 1);
    const afterMerge = await graphJSON();
    await page.locator('#undo').click(); assert.equal(await graphJSON(), beforeMerge);
    await page.locator('#redo').click(); assert.equal(await graphJSON(), afterMerge);
    await page.screenshot({path: path.join(folder, 'vector-merged-inputs.png')});
    checks.push('dropping vec2 at Y merges YZ and replaces the Z wire atomically; its Float source and other references survive one Undo/Redo');

    await reset();
    assert.equal(await connect('base', 'vector', 'value'), true);
    assert.equal(await page.locator('[data-inline-node="vector"]').count(), 0);
    assert.equal(await connect('scalar', 'vector', 'x'), true);
    assert.equal(await page.locator('[data-inline-node="vector"]').count(), 0);
    assert.equal(await page.locator(socket('vector', 'inputs', 'x')).count(), 1);
    await page.evaluate(() => change(() => {current().edges = current().edges.filter(e => e.to.join(':') !== 'vector:value');}));
    assert.equal(await field('vector', 'x').count(), 0);
    for (const [index, port] of [...'yzw'].entries()) assert.equal(Number(await field('vector', port).inputValue()), [.2, .3, .4][index]);
    checks.push('a baseline wire hides inherited manual values; explicit component overrides remain wired and disconnecting the baseline restores retained defaults');

    await reset();
    let before = await graphJSON(), count = await history();
    await field('scalar').fill('.75'); await field('scalar').press('Enter');
    assert.equal(await value(), .75); assert.equal(await history(), count + 1);
    const afterTyped = await graphJSON();
    await page.locator('#undo').click(); assert.equal(await graphJSON(), before);
    await page.locator('#redo').click(); assert.equal(await graphJSON(), afterTyped);
    count = await history();
    await field('vector', 'w').fill('.95'); await field('vector', 'w').press('Tab');
    assert.equal(await page.evaluate(() => current().nodes.find(n => n.id === 'vector').params.components[3]), .95);
    assert.equal(await history(), count + 1);
    checks.push('Enter and blur commit the addressed numeric value once; a typed edit is one graph Undo/Redo operation');

    await field('scalar').focus(); before = await graphJSON(); count = await history();
    await field('scalar').fill('2.375');
    await page.evaluate(() => render()); await settle();
    assert.equal(await field('scalar').inputValue(), '2.375');
    assert.equal(await field('scalar').evaluate(entry => entry === document.activeElement), true);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    await field('scalar').press('Escape');
    assert.equal(Number(await field('scalar').inputValue()), .75);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    checks.push('a focused uncommitted numeric draft survives render(); Escape restores the committed number without graph writes');

    for (const draft of ['', '1e']) {
      await field('scalar').focus(); await field('scalar').press('Control+A');
      if (draft) await page.keyboard.type(draft); else await page.keyboard.press('Backspace');
      await field('scalar').press('Enter');
      await field('scalar').press('Tab');
      assert.equal(await graphJSON(), before); assert.equal(await history(), count);
      assert.equal(await page.locator('[data-node="scalar"]').count(), 1);
    }
    checks.push('empty and incomplete-exponent drafts do not write graph/history; text Backspace never deletes the node');

    await reset();
    await field('vector', 'y').fill('9.25'); count = await history();
    assert.equal(await connect('pair', 'vector', 'y'), true);
    await settle();
    assert.equal(await field('vector', 'y').count(), 0);
    assert.deepEqual(await page.evaluate(() => current().nodes.find(n => n.id === 'vector').params.components), [.1, .2, .3, .4]);
    assert.equal(await history(), count + 1);
    await page.locator('#undo').click();
    assert.equal(Number(await field('vector', 'y').inputValue()), .2);
    checks.push('a topology change cancels a now-covered component draft and records only the wire edit');

    await reset(); before = await graphJSON(); count = await history();
    const origin = await position(); let p = await at(numeric('scalar'));
    await drag(p, {x: p.x + 26, y: p.y + 12});
    assert.deepEqual(await position(), origin); assert.equal(await graphJSON(), before);
    await field('scalar').dblclick();
    assert.deepEqual(await position(), origin); assert.equal(await history(), count);
    checks.push('selection and dragging within numeric text do not move the node or create graph history');

    const beginLadder = async () => {
      const p = await at(numeric('scalar'));
      await page.mouse.move(p.x, p.y); await page.mouse.down({button: 'middle'});
      await page.locator('#valueladder').waitFor(); return p;
    };
    const rung = async (step, x) => {
      const r = await page.locator(`#valueladder [data-step="${step}"]`).boundingBox();
      assert.ok(r); const y = r.y + r.height / 2;
      await page.mouse.move(x, y); return y;
    };
    before = await graphJSON(); count = await history(); p = await beginLadder();
    let y = await rung(.1, p.x); await page.mouse.move(p.x + 16, y); await settle();
    assert.equal(Number(await field('scalar').inputValue()), .5);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    await page.screenshot({path: path.join(folder, 'inline-value-ladder.png')});
    await page.mouse.up({button: 'middle'}); await settle();
    assert.equal(await value(), .5); assert.equal(await history(), count + 1);
    await page.locator('#undo').click(); assert.equal(await graphJSON(), before);
    await page.locator('#redo').click(); assert.equal(await value(), .5);
    checks.push('middle-mouse Ladder previews the inline field without graph writes and commits exactly once on release');

    before = await graphJSON(); count = await history(); p = await beginLadder();
    y = await rung(.01, p.x); await page.mouse.move(p.x + 24, y);
    await page.keyboard.press('Escape'); await page.mouse.up({button: 'middle'}); await settle();
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    assert.equal(Number(await field('scalar').inputValue()), .5);
    assert.equal(await page.locator('#valueladder').count(), 0);
    checks.push('Escape cancels an inline Ladder gesture without leaving a draft, history entry or popup');

    const cdp = await page.context().newCDPSession(page);
    const touch = async (type, p) => {
      await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: p ? [{id: 1, x: p.x, y: p.y, radiusX: 4, radiusY: 4}] : []});
      await settle();
    };
    await page.locator('#canvas').focus(); p = await at(numeric('scalar'));
    await touch('touchStart', p); await touch('touchEnd');
    assert.equal(await field('scalar').evaluate(entry => entry === document.activeElement), true);
    assert.equal(await graphJSON(), before); assert.deepEqual(await position(), origin);
    checks.push('a real Chromium touch tap focuses inline typing without selecting a canvas drag');

    const panBeforeSwipe = await page.evaluate(() => clone(pan));
    p = await at(numeric('scalar'));
    await touch('touchStart', p); await touch('touchMove', {x: p.x + 45, y: p.y + 30}); await touch('touchEnd');
    assert.notDeepEqual(await page.evaluate(() => pan), panBeforeSwipe);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    assert.deepEqual(await position(), origin);
    assert.equal(await page.locator('#valueladder').count(), 0);
    checks.push('a touch swipe starting on a numeric field pans the view without editing its value or moving its node');

    p = await at(numeric('scalar')); await touch('touchStart', p);
    await page.locator('#valueladder').waitFor({timeout: 2000});
    let r = await page.locator('#valueladder [data-step="0.01"]').boundingBox();
    y = r.y + r.height / 2;
    await touch('touchMove', {x: p.x, y}); await touch('touchMove', {x: p.x + 16, y});
    assert.equal(Number(await field('scalar').inputValue()), .52);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    await touch('touchEnd');
    assert.equal(await value(), .52); assert.equal(await history(), count + 1);
    assert.deepEqual(await position(), origin);
    checks.push('touch hold opens the same Ladder; scrubbing commits once and does not drag the node');

    before = await graphJSON(); count = await history(); p = await at(numeric('scalar'));
    await touch('touchStart', p); await page.locator('#valueladder').waitFor({timeout: 2000});
    r = await page.locator('#valueladder [data-step="0.1"]').boundingBox(); y = r.y + r.height / 2;
    await touch('touchMove', {x: p.x, y}); await touch('touchMove', {x: p.x + 24, y}); await touch('touchCancel');
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    assert.equal(Number(await field('scalar').inputValue()), .52);
    checks.push('touch cancellation restores the inline value without a graph edit');

    // End the previous editing session before installing a different fixture.
    await page.locator('#canvas').focus(); await settle();
    await page.evaluate(() => {
      graph.functions = [{id: 'inline_fn', name: 'Inline function', scope: 'local', stages: ['pixel'],
        inputs: [{id: 'gain', name: 'gain', type: 'float', default: .4}], outputs: [],
        graph: {nodes: [{id: 'in', definitionUuid: FunctionModel.INPUT, params: {}, ui: {x: 20, y: 20}}], edges: []}}];
      current().nodes.push({id: 'call', definitionUuid: FunctionModel.CALL, params: {functionId: 'inline_fn'}, ui: {x: 340, y: 420}});
      render();
    });
    before = await graphJSON(); count = await history();
    await field('call', 'gain').dblclick();
    assert.deepEqual(await page.evaluate(() => graphTrail), []);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    checks.push('double-clicking a Function call numeric input edits text without entering the Function');

    const committedBeforeReadonly = await value();
    before = await graphJSON(); count = await history();
    await field('scalar').fill('99.5');
    await page.evaluate(() => {readonly = true; render();});
    assert.equal(Number(await field('scalar').inputValue()), committedBeforeReadonly);
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    assert.equal(await field('scalar').evaluate(entry => entry.disabled || entry.readOnly), true);
    p = await at(numeric('scalar')); before = await graphJSON(); count = await history();
    await page.mouse.move(p.x, p.y); await page.mouse.down({button: 'middle'}); await settle();
    assert.equal(await page.locator('#valueladder').count(), 0); await page.mouse.up({button: 'middle'});
    assert.equal(await graphJSON(), before); assert.equal(await history(), count);
    assert.equal(await page.evaluate(() => document.body.classList.contains('scrubbing-value')), false);
    checks.push('read-only transition cancels an active draft, blocks Ladder editing and leaves no stuck gesture styling');

    fs.writeFileSync(path.join(folder, 'inline-vector-graph.json'), await graphJSON());
    assert.deepEqual(errors, []);
    await h.finish(); console.log(JSON.stringify({passed: true, count: checks.length}));
  } catch (error) {
    await h.finish(error); throw error;
  }
}

run().catch(error => {console.error(error.stack); process.exitCode = 1;});
