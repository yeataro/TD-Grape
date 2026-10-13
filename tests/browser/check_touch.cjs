/* Touch checks (Refactor.108; Codex ISSUE TOUCH-2026-10-13): real Chrome with touch emulation and CDP touch events on the fake host,
 * plus the mouse paths they must not break. Exit code 1 when a case fails.
 * 觸控檢查（R.108；Codex ISSUE TOUCH-2026-10-13）：真 Chrome 觸控模擬、CDP 觸控事件、假宿主，加上不能被弄壞的滑鼠路徑。有案例失敗時結束碼 1。
 *
 *   node tests/browser/check_touch.cjs BUILD_FOLDER
 *
 * T04 a finger box-selects after the toolbar's Box select is tapped; T02 a second finger gives the box up and keeps the selection;
 * T01 a finger scrubs a number in the Parameter panel; mouse: Shift+drag, right-drag and Box select+drag still select.
 */
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('./fake_host.cjs');
const built = process.argv[2];
if (!built) throw Error('Usage: node tests/browser/check_touch.cjs BUILD');
const VIEWPORT = { width: 1500, height: 1000 };

// Three nodes in a row, as the issue's reproduction: a Color feeding the output, and a Vector to scrub. 一排三個節點，同 issue 的重現：Color 接到輸出，加一個可拖數值的 Vector。
function fixture() {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/scaling_base_graph.json'), 'utf8'));
  const pick = (id, x, y) => { const n = JSON.parse(JSON.stringify(base.stages.pixel.nodes.find(n => n.id === id))); n.ui = { ...n.ui, x, y }; return n; };
  const nodes = [pick('color', 0, 100), pick('n60b239b5ace24854a9607d66e77c1537', 350, 100), pick('pixel_out', 700, 100)];
  const edges = [{ id: 'e1', from: ['color', 'out'], to: ['pixel_out', 'color'] }];
  return { ...base, stages: { pixel: { ...base.stages.pixel, nodes, edges } } };
}
const SCRUB = 'n60b239b5ace24854a9607d66e77c1537';

(async () => {
  const host = await serve(built, fixture());
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = {}; let failed = 0;
  const check = (name, ok, detail) => { results[name] = { ok: !!ok, ...detail }; if (!ok) failed++; };
  const open = async (touch) => {
    const context = await browser.newContext({ viewport: VIEWPORT, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // INJECT: a script run in every page before the editor loads, to try a listener or a rule against these same cases without
    // touching the product (Refactor.108.1 used it to show a global pointerdown listener changes nothing). INJECT：每個頁面載入編輯器前
    // 先跑的程式，用來拿同一組案例試一個監聽或規則、不動產品（R.108.1 用它證明全域 pointerdown 監聽什麼都不改變）。
    if (process.env.INJECT) await page.addInitScript(process.env.INJECT);
    await page.goto(host.url); await page.locator('.react-flow__node').nth(2).waitFor(); await page.waitForTimeout(800);
    const cdp = touch ? await context.newCDPSession(page) : null;
    const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    const touchAt = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const selected = () => page.locator('.react-flow__node.selected').evaluateAll(l => l.map(n => n.dataset.id).sort());
    const boxShown = () => page.locator('.right-select-box').count();
    const transform = () => page.locator('.react-flow__viewport').evaluate(e => e.style.transform);
    const title = id => page.locator(`.react-flow__node[data-id="${id}"] .node-title`).boundingBox();
    const boxSwitch = page.locator('button[aria-label^="Box select"], button[aria-label^="框選"]').first();
    const empty = async () => page.evaluate(() => { const p = document.querySelector('.react-flow__pane').getBoundingClientRect();
      for (let y = p.bottom - 120; y > p.y + 100; y -= 20) for (let x = p.right - 80; x > p.x + 80; x -= 20) if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y }; return null; });
    // The box's screen rectangle that covers all three nodes. 蓋住三個節點的螢幕矩形。
    const around = async () => { const r = await page.locator('.react-flow__node').evaluateAll(l => l.map(n => n.getBoundingClientRect()));
      return { x0: Math.min(...r.map(b => b.left)) - 40, y0: Math.min(...r.map(b => b.top)) - 40, x1: Math.max(...r.map(b => b.right)) + 40, y1: Math.max(...r.map(b => b.bottom)) + 40 }; };
    return { context, page, errors, tap, touchAt, selected, boxShown, transform, title, boxSwitch, empty, around };
  };

  // T04: Box select tapped, one finger drags a box over the three nodes: the box lasts to the release, all three are selected.
  // T04：點了框選，單指框過三個節點：框一直到放開，三個都選到。
  {
    const p = await open(true);
    const b = await p.boxSwitch.boundingBox(); await p.tap(b.x + b.width / 2, b.y + b.height / 2); await page_wait(p.page, 300);
    const pressed = await p.boxSwitch.getAttribute('aria-pressed');
    const a = await p.around(), steps = 8, shown = [];
    await p.touchAt('touchStart', [{ x: a.x0, y: a.y0 }]);
    for (let i = 1; i <= steps; i++) { await p.touchAt('touchMove', [{ x: a.x0 + (a.x1 - a.x0) * i / steps, y: a.y0 + (a.y1 - a.y0) * i / steps }]); await page_wait(p.page, 40); shown.push(await p.boxShown()); }
    await p.touchAt('touchEnd', []); await page_wait(p.page, 400);
    const after = await p.selected();
    check('T04 one-finger box select', pressed === 'true' && shown.every(n => n === 1) && after.length === 3, { pressed, boxShownPerMove: shown, selected: after, errors: p.errors });
    await p.context.close();
  }
  // T02: one node selected, Box select on, a second finger lands: the box is given up, the fingers zoom, the selection stays.
  // T02：選了一個節點、框選開著，第二指落下：框放棄、雙指縮放、選取不變。
  {
    const p = await open(true);
    const t = await p.title('color'); await p.tap(t.x + 20, t.y + 8); await page_wait(p.page, 300);
    const b = await p.boxSwitch.boundingBox(); await p.tap(b.x + b.width / 2, b.y + b.height / 2); await page_wait(p.page, 300);
    const before = await p.selected(), zoomBefore = await p.transform(), e = await p.empty();
    const first = { x: e.x - 300, y: e.y - 200 }, second = { x: e.x, y: e.y };
    await p.touchAt('touchStart', [first]); await page_wait(p.page, 60);
    await p.touchAt('touchStart', [first, second]); await page_wait(p.page, 60);
    for (let i = 1; i <= 6; i++) { await p.touchAt('touchMove', [{ x: first.x + 12 * i, y: first.y + 10 * i }, second]); await page_wait(p.page, 40); }
    const boxMid = await p.boxShown();
    await p.touchAt('touchEnd', [second]); await page_wait(p.page, 100);   // first finger up 第一指抬起
    await p.touchAt('touchEnd', []); await page_wait(p.page, 400);
    const after = await p.selected(), zoomAfter = await p.transform();
    check('T02 second finger keeps the selection', before.length === 1 && boxMid === 0 && after.join() === before.join() && zoomAfter !== zoomBefore,
      { before, after, boxMid, zoomed: zoomAfter !== zoomBefore, errors: p.errors });
    await p.context.close();
  }
  // T01: a finger scrubs a number in the Parameter panel: the value changes and the gesture ends with pointerup, not pointercancel.
  // T01：手指在參數面板拖數值：值改變，手勢以 pointerup 結束、不是 pointercancel。
  {
    const p = await open(true);
    const t = await p.title(SCRUB); await p.tap(t.x + 20, t.y + 8); await page_wait(p.page, 400);
    await p.page.evaluate(() => { globalThis.__ends = []; for (const type of ['pointerup', 'pointercancel']) addEventListener(type, e => { if (e.target.matches?.('input.number')) globalThis.__ends.push(type); }, true); });
    const field = p.page.locator('.params-card input.number').first(), box = await field.boundingBox(), before = await field.inputValue();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await p.touchAt('touchStart', [{ x, y }]);
    for (let i = 1; i <= 7; i++) { await p.touchAt('touchMove', [{ x: x + i * 10, y }]); await page_wait(p.page, 30); }
    await p.touchAt('touchEnd', []); await page_wait(p.page, 300);
    const after = await field.inputValue(), ends = await p.page.evaluate(() => globalThis.__ends);
    check('T01 finger scrubs a Parameter panel value', after !== before && ends.join() === 'pointerup', { before, after, ends, errors: p.errors });
    await p.context.close();
  }
  // Mouse: Shift+left drag, right drag, and Box select + left drag each select the three nodes. 滑鼠：Shift＋左鍵、右鍵、框選開關＋左鍵各選到三個。
  {
    const p = await open(false), a = await p.around();
    const drag = async (button, shift) => { if (shift) await p.page.keyboard.down('Shift'); await p.page.mouse.move(a.x0, a.y0); await p.page.mouse.down({ button });
      for (let i = 1; i <= 8; i++) { await p.page.mouse.move(a.x0 + (a.x1 - a.x0) * i / 8, a.y0 + (a.y1 - a.y0) * i / 8); await page_wait(p.page, 20); }
      await p.page.mouse.up({ button }); if (shift) await p.page.keyboard.up('Shift'); await page_wait(p.page, 300); };
    const clear = async () => { const e = await p.empty(); await p.page.mouse.click(e.x, e.y); await page_wait(p.page, 200); };
    await drag('left', true); const shift = await p.selected(); await clear();
    await drag('right', false); await p.page.keyboard.press('Escape'); const right = await p.selected(); await clear();
    await p.boxSwitch.click(); await page_wait(p.page, 200); await drag('left', false); const switched = await p.selected();
    check('mouse box selects still work', shift.length === 3 && right.length === 3 && switched.length === 3, { shift, right, switched, errors: p.errors });
    await p.context.close();
  }
  console.log(JSON.stringify(results, null, 1));
  console.log(failed ? `FAILED ${failed}` : 'all passed');
  await browser.close(); host.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
function page_wait(page, ms) { return page.waitForTimeout(ms); }
