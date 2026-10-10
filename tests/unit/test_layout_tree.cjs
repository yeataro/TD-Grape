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

test('a side: made when empty, opened when closed, joined as a tab otherwise; its toggles read the tree', () => {
  let layout = tree.movePanel(fresh(), 'appearance', { kind: 'side', side: 'left' });
  assert.equal(shape(layout.root), 'row(sources|addNode|glsl|appearance, canvas)', 'a tab by default (human 2026-10-10)');
  assert.equal(tree.sideHasPanels(layout, 'right'), false, 'the right toggle greys out');
  layout = tree.movePanel(layout, 'glsl', { kind: 'side', side: 'right' });
  assert.equal(shape(layout.root), 'row(sources|addNode|appearance, canvas, glsl)');
  assert.equal(layout.closed.right, false, 'moving a panel to a closed side opens it');
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
