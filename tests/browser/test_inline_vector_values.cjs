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
    const reset = () => page.evaluate(() => {
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
      scale = .8; pan = {x: 22, y: 25}; render();
    });
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
