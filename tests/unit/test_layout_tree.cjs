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
// Floating (Refactor.84, 88). In these tests `appearance` stands in for the Parameter panel: the panel with a home.
// 浮動（R.84、88）。這些測試裡 appearance 代替參數面板：有家的面板。
const homes = { appearance: 'top-right' };
const at = (x, y, corner = 'top-left', width = 320, height = 360) => ({ corner, width, height, x, y });

test('a panel with a home floats in it, and goes back to its pane or to closed', () => {
  let layout = tree.popOut(fresh(), 'appearance', homes);
  assert.equal(layout.floating.appearance, 'docked');
  assert.equal(layout.floats.appearance.corner, 'top-right', 'its home');
  assert.ok(tree.paneOf(layout.root, 'appearance'), 'still in the tree');
  assert.ok(tree.away(layout).includes('appearance'), 'the tree does not draw it');
  layout = tree.backToA(layout, 'appearance');
  assert.equal(layout.floating.appearance, undefined);
  assert.equal(tree.paneOf(layout.root, 'appearance').pane.active, 'appearance', 'back as the shown tab');
  let closed = tree.popOut(tree.hidePanel(fresh(), 'appearance'), 'appearance', homes);
  assert.equal(closed.floating.appearance, 'closed');
  assert.ok(!closed.hidden.includes('appearance'), 'shown while it floats');
  closed = tree.toggleFloat(closed, 'appearance', homes);
  assert.ok(closed.hidden.includes('appearance'), 'closed before, closed again (human 2026-10-11)');
  const base = fresh();
  assert.equal(tree.popOut(base, 'glsl', homes), base, 'a panel without a home does not float this way');
});

test('going back from floating leaves the sides as they are (Refactor.86)', () => {
  let layout = { ...fresh(), closed: { left: false, right: true } };
  layout = tree.backToA(tree.popOut(layout, 'appearance', homes), 'appearance');
  assert.deepEqual(layout.closed, { left: false, right: true }, 'the right side stays closed, as before it floated');
  assert.equal(tree.paneOf(layout.root, 'appearance').pane.active, 'appearance');
});

test('a panel without a home floats free: out of the tree, docked again only by dragging (Refactor.88)', () => {
  let layout = tree.floatOut(fresh(), 'glsl', at(20, 30));
  assert.equal(layout.floating.glsl, 'free');
  assert.equal(tree.paneOf(layout.root, 'glsl'), undefined, 'it leaves the tree (human 2026-10-12: no springing back)');
  assert.equal(shape(layout.root), 'row(sources|addNode, canvas, appearance)');
  const docked = tree.movePanel(layout, 'glsl', { kind: 'tab', pane: where(layout, 'sources'), index: 0 });
  assert.equal(shape(docked.root), 'row(glsl|sources|addNode, canvas, appearance)', 'dragged into a pane: a tab there');
  assert.equal(docked.floating.glsl, undefined);
  assert.equal(shape(tree.movePanel(layout, 'glsl', { kind: 'beside', pane: where(layout, 'appearance'), edge: 'bottom' }).root),
    'row(sources|addNode, canvas, column(appearance, glsl))', 'or a new pane');
  assert.equal(shape(tree.movePanel(layout, 'glsl', { kind: 'outer', edge: 'left' }).root), 'row(glsl, sources|addNode, canvas, appearance)', 'or an outer edge');
  // Closed, it keeps where it floated, and floats there again when shown, opened. 關掉時記著浮動的位置，再顯示時回到那裡、打開。
  layout = tree.setFloat(layout, 'glsl', { collapsed: true });
  const hidden = tree.hidePanel(layout, 'glsl');
  assert.equal(hidden.floating.glsl, undefined); assert.ok(hidden.hidden.includes('glsl'));
  assert.equal(tree.paneOf(hidden.root, 'glsl'), undefined, 'closed, it is still not in the tree');
  const shown = tree.showPanel(hidden, 'glsl');
  assert.equal(shown.floating.glsl, 'free');
  assert.deepEqual(plain(shown.floats.glsl), at(20, 30), 'where it floated last, opened');
  assert.equal(tree.showOrFold(shown, 'glsl').floats.glsl.collapsed, true, 'the GLSL button folds it');
});

test('stored floating panels are read back; anything malformed is dropped; old corner layouts float free', () => {
  const layout = tree.floatOut(tree.popOut(fresh(), 'appearance', homes), 'glsl', at(10, 10, 'bottom-left'));
  const read = tree.readLayout(JSON.parse(JSON.stringify(layout)), panels);
  assert.deepEqual(plain(read.floating), { appearance: 'docked', glsl: 'free' });
  assert.equal(tree.paneOf(read.root, 'glsl'), undefined, 'a free panel is not put back into the tree');
  const bad = JSON.parse(JSON.stringify(layout)); delete bad.floats.glsl.x;
  const fixed = tree.readLayout(bad, panels);
  assert.equal(fixed.floating.glsl, undefined, 'free without a place is not free');
  assert.ok(tree.paneOf(fixed.root, 'glsl'), 'and goes back to its side');
  const closed = tree.readLayout(JSON.parse(JSON.stringify(tree.hidePanel(layout, 'glsl'))), panels);
  assert.equal(tree.paneOf(closed.root, 'glsl'), undefined, 'a closed free panel stays out of the tree');
  // Before R.88 any panel floated in a corner, still in the tree. R.88 之前任何面板都浮在角落、仍在樹裡。
  const old = JSON.parse(JSON.stringify(fresh()));
  old.floating = { glsl: 'docked' }; old.floats = { glsl: { corner: 'bottom-right', width: 300, height: 200 } };
  const kept = tree.keepHomes(tree.readLayout(old, panels), homes);
  assert.equal(kept.floating.glsl, 'free');
  assert.deepEqual(plain(kept.floats.glsl), { corner: 'bottom-right', width: 300, height: 200, x: 0, y: 0 }, 'from its corner');
  assert.equal(tree.paneOf(kept.root, 'glsl'), undefined);
  const noFloats = JSON.parse(JSON.stringify(fresh())); delete noFloats.floating; delete noFloats.floats;
  assert.deepEqual(plain(tree.readLayout(noFloats, panels).floating), {}, 'a layout from before reads with nothing floating');
});

test('where floating panels are drawn: the home corner, free places kept, the nearest free spot when taken (Refactor.88)', () => {
  let layout = tree.popOut(fresh(), 'appearance', homes);
  layout = tree.floatOut(layout, 'glsl', at(0, 0));
  let rects = tree.floatRects(layout, 1000, 600, 8, 28);
  assert.deepEqual(plain(rects.appearance), { x: 680, y: 0, width: 320, height: 360, collapsed: false }, 'home: its corner');
  assert.deepEqual(plain(rects.glsl), { x: 0, y: 0, width: 320, height: 360, collapsed: false }, 'free: where it is kept');
  // Kept on the right, under the home panel: it moves to the nearest free spot. 記在右上、壓到有家的面板：去最近的空位。
  layout = tree.placeFloats(layout, { glsl: at(0, 0, 'top-right') });
  rects = tree.floatRects(layout, 1000, 800, 8, 28);
  assert.deepEqual(plain(rects.glsl), { x: 352, y: 0, width: 320, height: 360, collapsed: false }, 'the nearest: beside it, the gap apart');
  assert.deepEqual(plain(layout.floats.glsl), at(0, 0, 'top-right'), 'what is kept does not change, so it comes back with room');
  // A smaller area: it follows its corner. 範圍變小：跟著它的角走。
  layout = tree.floatOut(tree.popOut(fresh(), 'appearance', homes), 'glsl', at(10, 20, 'bottom-left', 300, 200));
  assert.deepEqual(plain(tree.floatRects(layout, 1000, 600, 8, 28).glsl), { x: 10, y: 380, width: 300, height: 200, collapsed: false });
  assert.deepEqual(plain(tree.floatRects(layout, 700, 400, 8, 28).glsl), { x: 10, y: 180, width: 300, height: 200, collapsed: false });
  // No free spot at its size: at its least; still none: where it is kept. 原大小沒有空位：用最小尺寸；還是沒有：留在記的位置。
  layout = tree.floatOut(tree.floatOut(fresh(), 'glsl', at(0, 0, 'top-left', 600, 400)), 'sources', at(0, 0, 'top-left', 600, 400));
  rects = tree.floatRects(layout, 900, 400, 8, 28);
  assert.deepEqual(plain(rects.sources), { x: 608, y: 0, width: 280, height: 160, collapsed: false }, 'at its least, beside');
  rects = tree.floatRects(layout, 700, 400, 8, 28);
  assert.equal(rects.sources.x, 0, 'no room even so: where it is kept');
  assert.equal(tree.floatRects(layout, 1000, 100, 8, 28).glsl.height, 28, 'too low: the title only');
});

test('a free place follows its nearest corner; collapsed, it keeps its open height', () => {
  const place = tree.placeAt({ x: 700, y: 400, width: 200, height: 100 }, 1000, 600);
  assert.deepEqual(plain(place), { corner: 'bottom-right', width: 200, height: 100, x: 100, y: 100 });
  assert.deepEqual(plain(tree.boxOf(place, 1000, 600, 28)), { x: 700, y: 400, width: 200, height: 100, collapsed: false });
  const folded = tree.placeAt({ x: 10, y: 10, width: 200, height: 28 }, 1000, 600, { ...at(0, 0), collapsed: true });
  assert.deepEqual(plain(folded), { corner: 'top-left', width: 200, height: 360, x: 10, y: 10, collapsed: true });
});

test('moving a free panel: solid, it stops a gap short of another and slides along it; it snaps near edges', () => {
  const other = { x: 400, y: 0, width: 200, height: 300 };
  const from = { x: 0, y: 0, width: 200, height: 200 };
  assert.deepEqual(tree.slide(from, { x: 500, y: 50 }, [other], 1000, 600, 8), { x: 192, y: 50, width: 200, height: 200 }, 'stops 8 short, slides down');
  assert.deepEqual(tree.slide(from, { x: 900, y: 0 }, [other], 1000, 600, 8), { x: 192, y: 0, width: 200, height: 200 }, 'never through it');
  assert.deepEqual(tree.slide({ ...from, y: 320 }, { x: 500, y: 320 }, [other], 1000, 600, 8), { x: 500, y: 320, width: 200, height: 200 }, 'below it, free to pass');
  assert.deepEqual(tree.slide(from, { x: -50, y: 900 }, [], 1000, 600, 8), { x: 0, y: 400, width: 200, height: 200 }, 'inside the area');
  assert.deepEqual(tree.snap({ x: 185, y: 5, width: 200, height: 200 }, [other], 1000, 600, 8, 12), { x: 192, y: 0, width: 200, height: 200 }, 'beside it, and to the top');
  assert.deepEqual(tree.snap({ x: 300, y: 300, width: 200, height: 200 }, [], 1000, 600, 8, 12), { x: 300, y: 300, width: 200, height: 200 }, 'far from edges: stays');
  assert.equal(tree.freeSpot({ x: 400, y: 0, width: 200, height: 200 }, [other], 1000, 600, 8).x, 608, 'the nearest free spot');
  assert.equal(tree.freeSpot({ x: 0, y: 0, width: 900, height: 200 }, [other], 1000, 600, 8).y, 308);
  assert.equal(tree.freeSpot({ x: 0, y: 0, width: 1100, height: 200 }, [], 1000, 600, 8), null, 'too big: nowhere');
});

test('sizing free panels: an edge stops at another; a seam moves both until one is dragged away (human 2026-10-12)', () => {
  const rects = { a: { x: 0, y: 0, width: 300, height: 300 }, b: { x: 308, y: 0, width: 400, height: 200 }, c: { x: 308, y: 208, width: 400, height: 180 },
    d: { x: 0, y: 400, width: 300, height: 180 } };
  assert.deepEqual(plain(tree.seamOf(rects, 'a', { x: 'end' }, 1000, 600, 8)), { near: ['a'], far: ['b', 'c'] }, 'the seam, found when a hand reaches it (R.88.1)');
  assert.deepEqual(plain(tree.seamOf(rects, 'a', { y: 'end' }, 1000, 600, 8)), { near: ['a'], far: [] }, 'not a seam');
  // The seam between a and b, c: dragging it right grows a, shrinks both. a 和 b、c 之間的縫：往右拉，a 變寬、兩個一起變窄。
  let sized = tree.sizeFloats(rects, 'a', { x: 'end' }, 50, 0, 1000, 600, 8);
  assert.equal(sized.a.width, 350); assert.equal(sized.b.x, 358); assert.equal(sized.b.width, 350); assert.equal(sized.c.width, 350);
  assert.deepEqual(sized.d, rects.d, 'a panel not on the seam stays');
  sized = tree.sizeFloats(rects, 'a', { x: 'end' }, 500, 0, 1000, 600, 8);
  assert.equal(sized.b.width, tree.FLOAT_MIN_WIDTH, 'down to the least');
  sized = tree.sizeFloats(rects, 'b', { x: 'start' }, 100, 0, 1000, 600, 8);
  assert.equal(sized.b.x, 408); assert.equal(sized.c.x, 408); assert.equal(sized.a.width, 400, 'from the other side, the same seam');
  // Not a seam (b moved away): the edge stops a gap short. 不是縫（b 拖開了）：邊停在隔一個間隙的地方。
  const apart = { a: rects.a, b: { ...rects.b, x: 400, width: 300 } };
  sized = tree.sizeFloats(apart, 'a', { x: 'end' }, 500, 0, 1000, 600, 8);
  assert.equal(sized.a.width, 392); assert.equal(sized.b.x, 400, 'it does not push');
  // a's bottom edge with d below: stops a gap short (not a seam: d does not sit right under it). a 的下緣、下面有 d：停在隔一個間隙的地方。
  sized = tree.sizeFloats(rects, 'a', { y: 'end' }, 500, 0, 1000, 600, 8);
  assert.equal(sized.a.height, 300, 'dy is 0');
  sized = tree.sizeFloats(rects, 'a', { y: 'end' }, 0, 500, 1000, 600, 8);
  assert.equal(sized.a.height, 392); assert.equal(sized.d.y, 400);
  // A corner sizes only itself. 角只動自己。
  sized = tree.sizeFloats(rects, 'a', { x: 'end', y: 'end' }, 50, 50, 1000, 600, 8);
  assert.equal(sized.a.width, 300, 'b is in the way: no wider'); assert.equal(sized.b.x, 308); assert.equal(sized.a.height, 350, 'taller, up to d');
  // Sizing one panel: within reach of another's edge line, it lines up (R.88.2). 調單一個面板：離別人的邊線 reach 以內就對齊（R.88.2）。
  const pair = { a: { x: 0, y: 0, width: 300, height: 200 }, e: { x: 0, y: 208, width: 340, height: 200 } };
  assert.equal(tree.sizeFloats(pair, 'a', { x: 'end' }, 30, 0, 1000, 600, 8, [], 16).a.width, 340, 'the same width as the one below');
  assert.equal(tree.sizeFloats(pair, 'a', { x: 'end' }, 10, 0, 1000, 600, 8, [], 16).a.width, 310, 'no line near: as dragged (its own edge is no line)');
  assert.equal(tree.sizeFloats(pair, 'a', { x: 'end' }, 70, 0, 1000, 600, 8, [], 16).a.width, 370, 'past reach: as dragged');
  const lined = { ...rects, d: { ...rects.d, width: 340 } };
  sized = tree.sizeFloats(lined, 'a', { x: 'end' }, 30, 0, 1000, 600, 8, [], 16);
  assert.equal(sized.a.width, 340, 'a seam lines up too (R.88.3)'); assert.equal(sized.b.x, 348); assert.equal(sized.c.width, 360);
  // Fixed ones are only in the way. 固定的只是擋路。
  sized = tree.sizeFloats(rects, 'a', { x: 'end' }, 50, 0, 1000, 600, 8, ['b', 'c']);
  assert.equal(sized.a.width, 300);
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
  layout = tree.floatOut(fresh(), 'glsl', { corner: 'top-left', width: 320, height: 360, x: 0, y: 0 });
  layout = tree.showOrFold(layout, 'glsl');
  assert.equal(layout.floats.glsl.collapsed, true);
  assert.ok(!tree.showOrFold(layout, 'glsl').floats.glsl.collapsed);
});
