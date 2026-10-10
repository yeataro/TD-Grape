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

test('the default is the legacy arrangement: one tab pane on each side, the right closed', () => {
  const layout = fresh();
  assert.equal(shape(layout.root), 'row(sources|addNode|glsl, column(canvas), appearance)');
  assert.equal(tree.paneOf(layout.root, 'sources').pane.active, 'addNode');
  assert.deepEqual(plain(layout.closed), { left: false, right: true });
  assert.deepEqual(plain(layout.root.sizes), [tree.SIDE_WIDTH, 1, tree.SIDE_WIDTH]);
  assert.ok(tree.sideHasPanels(layout, 'left') && tree.sideHasPanels(layout, 'right'));
});

test('a panel moves within its tab pane, into another, or into a new pane on an edge', () => {
  let layout = tree.movePanel(fresh(), 'glsl', { kind: 'tab', pane: where(fresh(), 'glsl'), index: 0 });
  assert.equal(shape(layout.root), 'row(glsl|sources|addNode, column(canvas), appearance)');
  assert.equal(tree.movePanel(layout, 'glsl', { kind: 'tab', pane: where(layout, 'glsl'), index: 1 }), layout, 'its own place: nothing changes');
  layout = tree.movePanel(layout, 'glsl', { kind: 'beside', pane: where(layout, 'sources'), edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(column(sources|addNode, glsl), column(canvas), appearance)', 'a whole side becomes a column of two');
  assert.deepEqual(plain(layout.root.children[0].sizes), [1, 1]);
  layout = tree.movePanel(layout, 'sources', { kind: 'beside', pane: where(layout, 'glsl'), edge: 'top' });
  assert.equal(shape(layout.root), 'row(column(addNode, sources, glsl), column(canvas), appearance)', 'between two panes it halves the target');
  assert.deepEqual(plain(layout.root.children[0].sizes), [1, .5, .5]);
  layout = tree.movePanel(layout, 'sources', { kind: 'tab', pane: where(layout, 'addNode'), index: 1 });
  assert.equal(shape(layout.root), 'row(column(addNode|sources, glsl), column(canvas), appearance)', 'an emptied pane goes away');
  assert.equal(tree.paneOf(layout.root, 'sources').pane.active, 'sources', 'a moved panel is the shown tab');
});

test('panes above and below the canvas take pixels; the canvas keeps its place in the tree', () => {
  const canvasAt = layout => { const centre = layout.root.children.findIndex(tree.hasCanvas); return [centre, layout.root.children[centre].children.findIndex(c => c.kind === 'canvas')]; };
  let layout = fresh();
  const canvas = canvasAt(layout);
  layout = tree.movePanel(layout, 'glsl', { kind: 'beside', pane: canvas, edge: 'bottom' });
  assert.equal(shape(layout.root), 'row(sources|addNode, column(canvas, glsl), appearance)');
  assert.deepEqual(plain(layout.root.children[1].sizes), [1, tree.PANE_HEIGHT]);
  layout = tree.movePanel(layout, 'sources', { kind: 'beside', pane: canvasAt(layout), edge: 'top' });
  assert.equal(shape(layout.root), 'row(addNode, column(sources, canvas, glsl), appearance)');
  layout = tree.movePanel(layout, 'addNode', { kind: 'tab', pane: where(layout, 'glsl'), index: 0 });
  assert.equal(shape(layout.root), 'row(column(sources, canvas, addNode|glsl), appearance)', 'the left side is gone; the centre column stays');
  layout = tree.movePanel(layout, 'sources', { kind: 'tab', pane: where(layout, 'glsl'), index: 9 });
  layout = tree.movePanel(layout, 'glsl', { kind: 'tab', pane: where(layout, 'appearance'), index: 0 });
  assert.equal(shape(layout.root), 'row(column(canvas, addNode|sources), glsl|appearance)', 'a column holding only the canvas is never flattened');
});

test('a side: made when empty, opened when closed, joined as a tab otherwise; its toggles read the tree', () => {
  let layout = tree.movePanel(fresh(), 'appearance', { kind: 'side', side: 'left' });
  assert.equal(shape(layout.root), 'row(sources|addNode|glsl|appearance, column(canvas))', 'a tab by default (human 2026-10-10)');
  assert.equal(tree.sideHasPanels(layout, 'right'), false, 'the right toggle greys out');
  layout = tree.movePanel(layout, 'glsl', { kind: 'side', side: 'right' });
  assert.equal(shape(layout.root), 'row(sources|addNode|appearance, column(canvas), glsl)');
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
  assert.equal(shape(layout.root), 'row(column(sources|addNode, glsl), column(canvas), appearance)', 'a new panel joins its side as a tab');
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
