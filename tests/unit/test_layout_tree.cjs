// The layout as a tree of panes (Refactor.68, work/in-place-refactor-design/layout-tree.md). 版面是一棵窗格樹。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const file = path.resolve(__dirname, '../../src/editor-react/layout_tree.ts');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const tree = loaded.exports;

const panels = [['sources', 'left'], ['addNode', 'left', true], ['glsl', 'left'], ['appearance', 'right']];
const fresh = () => tree.defaultLayout(panels);
const shape = pane => pane.kind === 'canvas' ? 'canvas' : pane.kind === 'tabs' ? pane.panels.join('|')
  : `${pane.direction}(${pane.children.map(shape).join(', ')})`;
const where = (layout, panel) => tree.paneOf(layout.root, panel).path;
// Plain objects, so values made inside the loaded module compare by content. 換成一般物件，模組裡產生的值才能照內容比。
const plain = value => JSON.parse(JSON.stringify(value));

// Refactor.76: the Parameter panel lives on the right, so it starts open (as legacy). R.76：參數面板住在右邊，一開始打開（照舊產品）。
test('the default is the legacy arrangement: one tab pane on each side, both open', () => {
  const layout = fresh();
  assert.equal(shape(layout.root), 'row(sources|addNode|glsl, canvas, appearance)');
  assert.equal(tree.paneOf(layout.root, 'sources').pane.active, 'addNode');
  assert.deepEqual(plain(layout.closed), { left: false, right: false });
  assert.deepEqual(plain(layout.root.sizes), [tree.SIDE_WIDTH, 1, tree.SIDE_WIDTH]);
  assert.ok(tree.sideHasPanels(layout, 'left') && tree.sideHasPanels(layout, 'right'));
});

test('a panel moves within its tab pane, into another, or into a new pane on an edge', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'tab', pane: where(fresh(), 'glsl'), index: 0 });
  assert.equal(shape(layout.root), 'row(glsl|sources|addNode, canvas, appearance)');
  assert.equal(tree.movePanel(layout, 'glsl', { kind: 'tab', pane: where(layout, 'glsl'), index: 1 }), layout, 'its own place: nothing changes');
  layout = tree.movePanel(layout, 'glsl', { kind: 'beside', pane: where(layout, 'sources'), edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(column(sources|addNode, glsl), canvas, appearance)', 'a whole side becomes a column of two');
  assert.deepEqual(plain(layout.root.children[0].sizes), [1, 1]);
  layout = tree.movePanel(layout, 'sources', { kind: 'beside', pane: where(layout, 'glsl'), edge: 'top' });
  assert.equal(shape(layout.root), 'row(column(addNode, sources, glsl), canvas, appearance)', 'between two panes it halves the target');
  assert.deepEqual(plain(layout.root.children[0].sizes), [1, .5, .5]);
  layout = tree.movePanel(layout, 'sources', { kind: 'tab', pane: where(layout, 'addNode'), index: 1 });
  assert.equal(shape(layout.root), 'row(column(addNode|sources, glsl), canvas, appearance)', 'an emptied pane goes away');
  assert.equal(tree.paneOf(layout.root, 'sources').pane.active, 'sources', 'a moved panel is the shown tab');
});

// Where the canvas is in the tree. 畫布在樹裡的位置。
const canvasPath = (pane, path = []) => pane.kind === 'canvas' ? path
  : pane.kind === 'split' ? pane.children.map((child, index) => canvasPath(child, [...path, index])).find(Boolean) : undefined;

test('panes on any edge of the canvas take pixels from it; splits of one part are put back as that part', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'beside', pane: canvasPath(fresh().root), edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(sources|addNode, column(canvas, glsl), appearance)', 'the canvas becomes a column of two');
  assert.deepEqual(plain(layout.root.children[1].sizes), [1, tree.PANE_HEIGHT]);
  layout = tree.movePanel(layout, 'sources', { kind: 'beside', pane: canvasPath(layout.root), edge: 'top' });
  assert.equal(shape(layout.root), 'row(addNode, column(sources, canvas, glsl), appearance)', 'into the column it is in');
  layout = tree.movePanel(layout, 'addNode', { kind: 'beside', pane: canvasPath(layout.root), edge: 'right' });
  assert.equal(shape(layout.root), 'row(column(sources, row(canvas, addNode), glsl), appearance)', 'beside the canvas only, not the full height');
  assert.deepEqual(plain(layout.root.children[0].children[1].sizes), [1, tree.SIDE_WIDTH]);
  layout = tree.movePanel(layout, 'addNode', { kind: 'tab', pane: where(layout, 'glsl'), index: 0 });
  assert.equal(shape(layout.root), 'row(column(sources, canvas, addNode|glsl), appearance)', 'a row of one is put back as the canvas');
  layout = tree.movePanel(layout, 'sources', { kind: 'tab', pane: where(layout, 'glsl'), index: 9 });
  layout = tree.movePanel(layout, 'glsl', { kind: 'tab', pane: where(layout, 'appearance'), index: 0 });
  layout = tree.movePanel(layout, 'addNode', { kind: 'tab', pane: where(layout, 'glsl'), index: 9 });
  layout = tree.movePanel(layout, 'sources', { kind: 'tab', pane: where(layout, 'glsl'), index: 9 });
  assert.equal(shape(layout.root), 'row(canvas, glsl|appearance|addNode|sources)', 'the outermost row stays, even round the canvas alone');
});

test('two full-height columns on one side: a pane beside a side pane (human 2026-10-10)', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'beside', pane: where(fresh(), 'glsl'), edge: 'right' });
  assert.equal(shape(layout.root), 'row(sources|addNode, glsl, canvas, appearance)');
  assert.deepEqual(plain(layout.root.sizes), [tree.SIDE_WIDTH, tree.SIDE_WIDTH, 1, tree.SIDE_WIDTH]);
  assert.deepEqual([0, 1, 2, 3].map(index => tree.sideOf(layout.root, index)), ['left', 'left', null, 'right'], 'both are the left side');
  layout = tree.movePanel(layout, 'sources', { kind: 'beside', pane: where(layout, 'glsl'), edge: 'bottom' });
  layout = tree.movePanel(layout, 'appearance', { kind: 'beside', pane: where(layout, 'glsl'), edge: 'left' });
  assert.equal(shape(layout.root), 'row(addNode, column(row(appearance, glsl), sources), canvas)', 'side by side inside a side shares its width');
  assert.deepEqual(plain(layout.root.children[1].children[0].sizes), [1, 1]);
});

test('the outer edges of the whole layout: full height or full width, from any shape (Refactor.87)', () => {
  let layout = tree.movePanel(fresh(), 'appearance', { kind: 'outer', edge: 'left' });
  assert.equal(shape(layout.root), 'row(appearance, sources|addNode|glsl, canvas)', 'the far left, beside the side that was there');
  assert.equal(tree.sideHasPanels(layout, 'right'), false, 'the right toggle greys out');
  // The human's case (2026-10-12): a bottom row across the whole width leaves no side; the far left is still a way in.
  // 人類的情況（10-12）：下面一整行橫跨全寬，沒有左右側了；最左邊仍然進得去。
  layout = tree.movePanel(fresh(), 'sources', { kind: 'outer', edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(column(row(addNode|glsl, canvas, appearance), sources))');
  assert.equal(tree.sideHasPanels(layout, 'left'), false);
  layout = tree.movePanel(layout, 'glsl', { kind: 'outer', edge: 'left' });
  assert.equal(shape(layout.root), 'row(glsl, column(row(addNode, canvas, appearance), sources))');
  assert.equal(tree.sideHasPanels(layout, 'left'), true, 'a left side again, full height');
  layout = tree.movePanel(layout, 'appearance', { kind: 'outer', edge: 'top' });
  assert.equal(shape(layout.root), 'row(column(appearance, row(glsl, column(row(addNode, canvas), sources))))', 'along the top, over everything');
  layout = tree.movePanel(layout, 'glsl', { kind: 'outer', edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(column(appearance, column(row(addNode, canvas), sources), glsl))', 'into the column already spanning the width');
  assert.equal(tree.movePanel(layout, 'glsl', { kind: 'outer', edge: 'bottom' }), layout, 'already alone there: nothing changes');
});

test('the sides read the tree; moving a panel to a closed side opens it', () => {
  let layout = { ...fresh(), closed: { left: false, right: true } };
  layout = tree.movePanel(layout, 'glsl', { kind: 'outer', edge: 'right' });
  assert.equal(shape(layout.root), 'row(sources|addNode, canvas, appearance, glsl)');
  assert.equal(layout.closed.right, false, 'moving a panel to a closed side opens it');
  layout = tree.movePanel(layout, 'appearance', { kind: 'tab', pane: where(layout, 'sources'), index: 2 });
  assert.equal(shape(layout.root), 'row(sources|addNode|appearance, canvas, glsl)');
  layout = { ...layout, closed: { left: true, right: false } };
  assert.equal(tree.sideOf(layout.root, 0), 'left'); assert.equal(tree.sideOf(layout.root, 1), null); assert.equal(tree.sideOf(layout.root, 2), 'right');
  layout = tree.showPanel(layout, 'sources');
  assert.equal(layout.closed.left, false, 'showing a panel opens its side');
});

test('hidden panels keep their place and come back to it', () => {
  let layout = tree.hidePanel(fresh(), 'addNode');
  assert.equal(shape(layout.root), shape(fresh().root), 'the tree does not change');
  layout = tree.hidePanel(tree.hidePanel(layout, 'sources'), 'glsl');
  assert.equal(tree.sideHasPanels(layout, 'left'), false);
  assert.equal(tree.shown(layout.root.children[0], layout.hidden), false);
  layout = tree.showPanel(layout, 'glsl');
  assert.deepEqual(plain(layout.hidden), ['addNode', 'sources']);
  assert.equal(tree.paneOf(layout.root, 'glsl').pane.active, 'glsl');
});

test('a stored layout: R.53 carried over, unknown panels dropped, new ones added, anything odd gives the defaults', () => {
  const v1 = { version: 1, titleBar: false, left: { open: false, width: 450, groups: [{ panels: ['sources', 'gone'], active: 'sources', size: 2 }, { panels: ['glsl'], active: 'glsl', size: 1 }] },
    right: { open: false, width: 380, groups: [] } };
  let layout = tree.readLayout(v1, panels);
  assert.equal(shape(layout.root), 'row(column(sources|addNode, glsl), canvas, appearance)', 'a new panel joins its side as a tab');
  assert.deepEqual(plain(layout.root.sizes), [450, 1, tree.SIDE_WIDTH]);
  assert.deepEqual(plain(layout.root.children[0].sizes), [2, 1]);
  assert.equal(layout.titleBar, false); assert.equal(layout.closed.left, true);
  const saved = plain(layout);
  assert.deepEqual(plain(tree.readLayout(saved, panels)), saved, 'a version 2 layout reads back the same');
  assert.equal(shape(tree.readLayout({ ...saved, root: { kind: 'tabs', panels: ['glsl'], active: 'glsl' } }, panels).root), shape(fresh().root), 'not our shape');
  assert.equal(shape(tree.readLayout({ version: 9 }, panels).root), shape(fresh().root));
  assert.equal(shape(tree.readLayout(null, panels).root), shape(fresh().root));
  const twice = plain(fresh()); twice.root.children[2].panels.push('glsl');
  assert.equal(shape(tree.readLayout(twice, panels).root), shape(fresh().root), 'a panel listed twice is kept once');
});

test('resizing and choosing a tab change only that pane', () => {
  let layout = tree.resize(fresh(), [], [420, 1, 300]);
  assert.deepEqual(plain(layout.root.sizes), [420, 1, 300]);
  layout = tree.activate(layout, [0], 'glsl');
  assert.equal(layout.root.children[0].active, 'glsl');
  assert.equal(tree.activate(layout, [0], 'appearance').root.children[0].active, 'glsl', 'not a panel of that pane');
});

test('the canvas keeps its minimum: with both sides open and too little room, the side already open closes (legacy)', () => {
  const both = { ...fresh(), closed: { left: false, right: false } };   // 380 | canvas | 380
  const leftOnly = { ...fresh(), closed: { left: false, right: true } };
  assert.equal(tree.canvasWidth(both, 1400), 1400 - 2 * tree.SIDE_WIDTH);
  assert.equal(tree.canvasWidth(leftOnly, 1400), 1400 - tree.SIDE_WIDTH, 'a closed side takes nothing');
  assert.equal(tree.sideToClose(both, 1400, 'right'), null, 'room enough');
  const narrow = 2 * tree.SIDE_WIDTH + tree.CANVAS_MIN_WIDTH - 1;
  assert.equal(tree.sideToClose(both, narrow, 'right'), 'left', 'opening the right closes the left');
  assert.equal(tree.sideToClose(both, narrow, 'left'), 'right');
  assert.equal(tree.sideToClose(both, narrow, null), 'right', 'the window narrowed: the right closes');
  assert.equal(tree.sideToClose(leftOnly, 300, null), null, 'one side open: nothing to close, it narrows on screen');
  const beside = tree.movePanel(both, 'glsl', { kind: 'beside', pane: canvasPath(both.root), edge: 'right' });
  assert.equal(tree.canvasWidth(beside, 1400), 1400 - 3 * tree.SIDE_WIDTH, 'a pane beside the canvas takes its pixels too');
});

// Refactor.80 (human 2026-10-11): a pane stacked in a column split collapses to its tab bar; a tab, a move or show opens it;
// out of a column split it cannot stay collapsed; a stored layout keeps it. R.80（人類）：疊在上下分割裡的窗格收成分頁列；
// 點分頁、搬進來或叫出來就打開；離開上下分割不能維持收起；存起來的版面保留它。
test('a stacked pane collapses to its tab bar and opens again', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'beside', pane: where(fresh(), 'sources'), edge: 'bottom' });
  const glsl = () => tree.paneOf(layout.root, 'glsl'), sources = () => tree.paneOf(layout.root, 'sources');
  assert.ok(tree.stacked(layout.root, glsl().path) && tree.stacked(layout.root, sources().path));
  assert.ok(!tree.stacked(layout.root, where(layout, 'appearance')), 'alone on its side: nothing to give its height to');
  assert.equal(tree.setCollapsed(layout, where(layout, 'appearance'), true), layout, 'a pane not stacked does not collapse');
  layout = tree.setCollapsed(layout, glsl().path, true);
  assert.equal(glsl().pane.collapsed, true);
  assert.equal(plain(tree.readLayout(plain(layout), panels)).root.children[0].children[1].collapsed, true, 'kept when stored');
  assert.equal(tree.activate(layout, glsl().path, 'glsl').root.children[0].children[1].collapsed, undefined, 'its tab opens it');
  assert.equal(tree.setCollapsed(layout, glsl().path, false).root.children[0].children[1].collapsed, undefined);
  const added = tree.movePanel(layout, 'sources', { kind: 'tab', pane: glsl().path, index: 1 });
  assert.equal(tree.paneOf(added.root, 'sources').pane.collapsed, undefined, 'a panel moved in is seen: the pane opens');
  // Its neighbour leaves: the column is gone, so the pane opens. 鄰居搬走：上下分割不在了，窗格打開。
  const alone = tree.movePanel(layout, 'addNode', { kind: 'tab', pane: where(layout, 'appearance'), index: 1 });
  const moved = tree.movePanel(alone, 'sources', { kind: 'tab', pane: where(alone, 'appearance'), index: 1 });
  assert.equal(shape(moved.root), 'row(glsl, canvas, appearance|sources|addNode)');
  assert.equal(tree.paneOf(moved.root, 'glsl').pane.collapsed, undefined, 'no longer stacked: open');
});

// Floating panels (Refactor.84; work/refactor/floating-panels-scope-2026-10-11.md). 浮動面板（R.84）。
test('a floating panel stays a member of its pane, and goes back there or to closed', () => {
  let layout = tree.popOut(fresh(), 'glsl', ['bottom-left', 'top-left']);
  assert.equal(layout.floating.glsl, 'docked');
  assert.equal(layout.floats.glsl.corner, 'bottom-left');
  assert.ok(tree.paneOf(layout.root, 'glsl'), 'still in the tree');
  assert.ok(tree.away(layout).includes('glsl'), 'the tree does not draw it');
  layout = tree.backToA(layout, 'glsl');
  assert.equal(layout.floating.glsl, undefined);
  assert.equal(tree.paneOf(layout.root, 'glsl').pane.active, 'glsl', 'back as the shown tab');
  assert.equal(layout.floats.glsl.corner, 'bottom-left', 'its corner is remembered');
  let closed = tree.popOut(tree.hidePanel(fresh(), 'sources'), 'sources');
  assert.equal(closed.floating.sources, 'closed');
  assert.ok(!closed.hidden.includes('sources'), 'shown while it floats');
  closed = tree.toggleFloat(closed, 'sources');
  assert.ok(closed.hidden.includes('sources'), 'closed before, closed again (human 2026-10-11)');
});

test('its pane is kept while only a floating panel is left in it, and it lands back there', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'outer', edge: 'right' });
  layout = tree.popOut(layout, 'glsl');
  layout = tree.movePanel(layout, 'appearance', { kind: 'outer', edge: 'left' });
  const home = tree.paneOf(layout.root, 'glsl');
  assert.deepEqual(home.pane.panels, ['glsl'], 'the pane holds only the floating panel');
  assert.equal(tree.sideHasPanels(layout, 'right'), false, 'and is not drawn');
  layout = tree.backToA(layout, 'glsl');
  assert.equal(tree.sideHasPanels(layout, 'right'), true, 'back on the right');
});

test('a corner holds one panel: moving there swaps, popping out takes a free one', () => {
  let layout = tree.popOut(fresh(), 'glsl', ['top-left']);
  layout = tree.popOut(layout, 'sources', ['top-left', 'bottom-left']);
  assert.equal(layout.floats.sources.corner, 'bottom-left', 'the nearest free corner');
  layout = tree.moveFloat(layout, 'sources', 'top-left');
  assert.equal(layout.floats.sources.corner, 'top-left');
  assert.equal(layout.floats.glsl.corner, 'bottom-left', 'swapped (human 2026-10-11)');
  for (const id of ['addNode', 'appearance']) layout = tree.popOut(layout, id);
  layout = tree.backToA(tree.popOut(tree.backToA(layout, 'appearance'), 'appearance', ['top-right']), 'appearance');
  assert.equal(Object.keys(layout.floating).length, 3);
});

test('closing and dragging into the tree end floating', () => {
  let layout = tree.popOut(fresh(), 'glsl');
  assert.equal(tree.hidePanel(layout, 'glsl').floating.glsl, undefined, 'closing is closing');
  const into = tree.movePanel(layout, 'glsl', { kind: 'tab', pane: tree.paneOf(layout.root, 'glsl').path, index: 0 });
  assert.equal(into.floating.glsl, undefined, 'dropped into its own pane, it lands');
  assert.equal(tree.showPanel(layout, 'glsl').floating.glsl, 'docked', 'called up while floating, it stays floating');
});

test('stored floating panels are read back; anything malformed is dropped', () => {
  const layout = tree.popOut(tree.popOut(fresh(), 'glsl', ['top-right']), 'sources', ['bottom-left']);
  const read = tree.readLayout(JSON.parse(JSON.stringify(layout)), panels);
  assert.deepEqual(read.floating, { glsl: 'docked', sources: 'docked' });
  const bad = JSON.parse(JSON.stringify(layout));
  bad.floats.glsl.corner = 'middle'; bad.floating.unknown = 'docked';
  assert.deepEqual(tree.readLayout(bad, panels).floating, { sources: 'docked' }, 'a bad corner and an unknown panel are dropped');
  const twice = JSON.parse(JSON.stringify(layout)); twice.floats.sources.corner = 'top-right';
  assert.deepEqual(tree.readLayout(twice, panels).floating, { glsl: 'docked' }, 'one panel per corner: the second goes back');
  const old = { ...JSON.parse(JSON.stringify(fresh())) }; delete old.floating; delete old.floats;
  assert.deepEqual(tree.readLayout(old, panels).floating, {}, 'a layout from before reads with nothing floating');
});

test('where floating panels are drawn: own heights, rows share their width', () => {
  let layout = tree.popOut(fresh(), 'glsl', ['top-left']);
  let rects = tree.floatRects(layout, 1000, 600, 8, 28);
  assert.deepEqual(rects.glsl, { x: 0, y: 0, width: 320, height: 360, collapsed: false });
  layout = tree.popOut(layout, 'sources', ['bottom-left']);
  rects = tree.floatRects(layout, 1000, 600, 8, 28);
  assert.equal(rects.glsl.height, 360, 'each keeps its own height');
  assert.equal(rects.sources.height, 600 - 8 - 360, 'the lower one fits in what is left');
  rects = tree.floatRects(layout, 1000, 900, 8, 28);
  assert.equal(rects.sources.height, 360, 'with room, they do not stick together (human 2026-10-11)');
  assert.equal(rects.sources.y, 900 - 360);
  layout = tree.setFloat(layout, 'glsl', { collapsed: true });
  rects = tree.floatRects(layout, 1000, 600, 8, 28);
  assert.equal(rects.glsl.height, 28, 'collapsed: the title only');
  layout = tree.setFloat(tree.popOut(layout, 'addNode', ['top-right']), 'addNode', { width: 900 });
  rects = tree.floatRects(layout, 1000, 600, 8, 28);
  assert.equal(rects.addNode.width, 1000 - 8 - 320, 'across the row it takes at most what the left one leaves');
  assert.equal(rects.addNode.x, 1000 - rects.addNode.width);
  rects = tree.floatRects(layout, 600, 600, 8, 28);
  assert.equal(rects.glsl.width, 600 - 8 - tree.FLOAT_MIN_WIDTH, 'a smaller area: the left one leaves the right one its least');
  assert.equal(rects.addNode.width, tree.FLOAT_MIN_WIDTH, 'the right one takes what is left');
  let pushed = tree.pushFloat(layout, 'glsl', 'width', 700, 1000, 8, 28);
  assert.equal(pushed.floats.addNode.width, 1000 - 8 - 700, 'growing across the row pushes the other narrower');
  assert.equal(tree.pushFloat(pushed, 'glsl', 'width', 300, 1000, 8, 28).floats.addNode.width, 292, 'and it does not grow back');
  const narrow = tree.pushFloat(layout, 'glsl', 'width', 999, 428, 8, 28);
  assert.equal(narrow.floats.glsl.width, tree.FLOAT_MIN_WIDTH, 'too narrow for two minimums: one still gets its minimum');
  assert.equal(narrow.floats.addNode.width, 428 - 8 - tree.FLOAT_MIN_WIDTH, 'by pushing the other to what is left, above the floor');
  assert.equal(tree.floatRects(layout, 1000, 100, 8, 28).sources.collapsed, true, 'no room: titles only');
});

test('panels on one side push each other; one pushed smaller stays so (human 2026-10-11)', () => {
  let layout = tree.popOut(tree.popOut(fresh(), 'glsl', ['top-left']), 'sources', ['bottom-left']);
  layout = tree.pushFloat(layout, 'glsl', 'height', 300, 800, 8, 28);
  assert.equal(layout.floats.glsl.height, 300);
  assert.equal(layout.floats.sources.height, 360, 'shrinking leaves a space; the other does not move');
  layout = tree.pushFloat(layout, 'glsl', 'height', 500, 800, 8, 28);
  assert.equal(layout.floats.sources.height, 800 - 8 - 500, 'growing into it pushes it smaller');
  layout = tree.pushFloat(layout, 'glsl', 'height', 400, 800, 8, 28);
  assert.equal(layout.floats.sources.height, 292, 'and it does not grow back');
  layout = tree.pushFloat(layout, 'glsl', 'height', 9999, 800, 8, 28);
  assert.equal(layout.floats.sources.height, tree.FLOAT_MIN_HEIGHT, 'pushed down to its least');
  assert.equal(layout.floats.glsl.height, 800 - 8 - tree.FLOAT_MIN_HEIGHT, 'then the pushing stops');
  layout = tree.pushFloat(layout, 'sources', 'height', 9999, 800, 8, 28);
  assert.equal(layout.floats.glsl.height, tree.FLOAT_MIN_HEIGHT, 'from below it pushes the upper one the same way');
});

test('a panel with a home floats only there, and nobody else takes it (human 2026-10-11)', () => {
  const homes = { appearance: 'top-right' };
  let layout = tree.popOut(fresh(), 'appearance', ['bottom-left'], homes);
  assert.equal(layout.floats.appearance.corner, 'top-right', 'home, whatever is nearest');
  layout = tree.popOut(layout, 'glsl', ['top-right', 'bottom-right'], homes);
  assert.equal(layout.floats.glsl.corner, 'bottom-right', 'another one skips that corner');
  assert.equal(tree.moveFloat(layout, 'glsl', 'top-right', homes), layout, 'and cannot be moved into it');
  assert.equal(tree.moveFloat(layout, 'appearance', 'top-left', homes), layout, 'the owner does not leave it');
  const old = tree.popOut(tree.popOut(fresh(), 'glsl', ['top-right']), 'appearance', ['bottom-left']);
  const kept = tree.keepHomes(old, homes);
  assert.equal(kept.floating.glsl, undefined, 'a stored layout: whoever sat in the home goes back');
  assert.equal(kept.floats.appearance.corner, 'top-right', 'and the owner moves home');
});

test('floating again: its last corner and size, opened', () => {
  let layout = tree.setFloat(tree.popOut(fresh(), 'glsl', ['bottom-right']), 'glsl', { width: 400, collapsed: true });
  layout = tree.popOut(tree.backToA(layout, 'glsl'), 'glsl');
  assert.deepEqual(layout.floats.glsl, { corner: 'bottom-right', width: 400, height: tree.FLOAT_HEIGHT });
});

test('going back from floating leaves the sides as they are (Refactor.86)', () => {
  let layout = { ...fresh(), closed: { left: false, right: true } };
  layout = tree.backToA(tree.popOut(layout, 'appearance'), 'appearance');
  assert.deepEqual(layout.closed, { left: false, right: true }, 'the right side stays closed, as before it floated');
  assert.equal(tree.paneOf(layout.root, 'appearance').pane.active, 'appearance');
});

test('the GLSL button: in view it does what the triangle does there; otherwise it brings the panel forward (Refactor.86.4)', () => {
  // A tab behind another: brought forward, nothing folds. 在別的分頁後面：叫到前面，什麼都不收。
  let layout = tree.showOrFold(fresh(), 'glsl');
  assert.equal(tree.paneOf(layout.root, 'glsl').pane.active, 'glsl');
  // In view, alone on its side (no triangle): stays as it is. 看得到、單獨一格（沒有三角形）：維持原樣。
  assert.equal(tree.showOrFold(layout, 'glsl'), layout);
  // Its side closed: opened. 所在那一側收起：打開。
  assert.equal(tree.showOrFold({ ...layout, closed: { left: true, right: false } }, 'glsl').closed.left, false);
  // Stacked under another pane: folds to its tab bar, then opens again. 疊在另一格下面：收成分頁列，再按打開。
  layout = tree.movePanel(fresh(), 'glsl', { kind: 'beside', pane: where(fresh(), 'sources'), edge: 'bottom' });
  layout = tree.showOrFold(layout, 'glsl');
  assert.equal(tree.paneOf(layout.root, 'glsl').pane.collapsed, true);
  assert.equal(tree.paneOf(tree.showOrFold(layout, 'glsl').root, 'glsl').pane.collapsed, undefined);
  // Floating: folds, then opens. 浮動：收起，再按打開。
  layout = tree.popOut(fresh(), 'glsl');
  layout = tree.showOrFold(layout, 'glsl');
  assert.equal(layout.floats.glsl.collapsed, true);
  assert.ok(!tree.showOrFold(layout, 'glsl').floats.glsl.collapsed);
});
