import { tr, say } from './text';

// The performance probe (Refactor.106.1, human 2026-10-13): a small overlay that shows, for the last interaction, what a person
// can feel but not see — how long the page took to paint after the press, the slowest frame, how many frames were long, how
// much layout the scripts forced, and how many canvas elements changed. Counters alone are for programs; this puts the numbers
// where the person is working, so a fault in "who gets woken" shows up without reading the code (docs/development/TESTING.md).
// Plain DOM, outside React and outside the canvas, so the probe itself makes no React work and is not counted as a change.
// 效能探針（R.106.1，人類 10-13）：一小塊疊層，顯示最近一次操作裡人感覺得到、看不到的事——按下到畫出多久、最慢的一格、長畫格幾個、腳本
// 逼了多少排版、畫布改了幾個元素。計數器是給程式看的；這裡把數字放在人操作的地方，「叫醒了誰」出錯時不用讀程式就看得到
// （docs/development/TESTING.md）。純 DOM，不在 React 裡、不在畫布裡，所以探針自己不製造 React 工作、也不被算進改動。

const LONG_FRAME = 50; // ms, as the browser's long-animation-frame threshold 同瀏覽器的長畫格門檻
const SETTLE = 500;    // ms after the last input before the numbers are final 最後一次輸入後多久定稿
const KEEP = 50;       // readings kept for the totals and for dumping 留幾筆給累計與倒出

type Reading = { latency: number | null; slowest: number; long: number; layout: number; changes: number; reruns: number | null };

/** Counts in the profiling build's shim, when present (never shipped). 量測版的計數（不隨產品出貨），有的話。 */
const reruns = (): number | null => {
  const prof = (globalThis as { __prof?: { data: Map<string, { n: number }> } }).__prof;
  return prof ? [...prof.data.values()].reduce((sum, entry) => sum + entry.n, 0) : null;
};

/** Show the probe until the returned function is called. 顯示探針，直到呼叫回傳的函式。 */
export function showPerfOverlay(): () => void {
  const box = document.createElement('div');
  box.className = 'perf-overlay';
  box.setAttribute('aria-live', 'off');
  const title = document.createElement('div'), line = document.createElement('div'), totals = document.createElement('div');
  title.className = 'perf-overlay-title'; line.className = 'perf-overlay-line'; totals.className = 'perf-overlay-totals';
  title.textContent = say(tr('perf.title', 'Performance probe (dev) · how to read: docs/development/TESTING.md · click to clear'));
  line.textContent = say(tr('perf.waiting', 'Waiting for an interaction…'));
  box.append(title, line, totals);
  document.body.append(box);
  // One reading per interaction; the last KEEP are kept for the totals and can be read from globalThis.__perfReadings (no clipboard).
  // 一次操作一筆；留最近 KEEP 筆給累計，可從 globalThis.__perfReadings 讀出（不寫剪貼簿）。
  const kept: Reading[] = (globalThis as { __perfReadings?: Reading[] }).__perfReadings = [];
  const sum = () => {
    if (!kept.length) { totals.textContent = ''; return; }
    totals.textContent = say(tr('perf.totals', 'since clear: {count} interactions · slowest frame {slowest} ms · long frames {long} · worst input→paint {latency} ms',
      { count: kept.length, slowest: Math.round(Math.max(...kept.map(r => r.slowest))), long: kept.reduce((n, r) => n + r.long, 0),
        latency: Math.round(Math.max(0, ...kept.map(r => r.latency ?? 0))) }));
  };
  const clear = () => { kept.length = 0; sum(); line.textContent = say(tr('perf.waiting', 'Waiting for an interaction…')); };
  box.addEventListener('click', clear);

  let active: { start: number; reading: Reading; rerunsAt: number | null; timer: number } | null = null;
  const canvas = () => document.querySelector('.react-flow');
  // Each reading covers one interaction: from the first input to half a second after the last one. 每次讀數涵蓋一次操作：第一個輸入到最後一個輸入後半秒。
  const begin = (now: number) => {
    active = { start: now, reading: { latency: null, slowest: 0, long: 0, layout: 0, changes: 0, reruns: null }, rerunsAt: reruns(), timer: 0 };
    // The frame after the next paint: what the person waited for. 下一次畫出之後的那一格：人等的就是這個。
    requestAnimationFrame(() => { const channel = new MessageChannel(); channel.port1.onmessage = () => { if (active && active.reading.latency === null) active.reading.latency = performance.now() - now; }; channel.port2.postMessage(0); });
  };
  const show = () => {
    if (!active) return;
    const r = active.reading, before = active.rerunsAt, after = reruns();
    r.reruns = before !== null && after !== null ? after - before : null;
    line.textContent = say(tr('perf.reading', 'input→paint {latency} ms · slowest frame {slowest} ms · long frames {long} · forced layout {layout} ms · canvas changes {changes}{reruns}',
      { latency: r.latency === null ? '–' : Math.round(r.latency), slowest: Math.round(r.slowest), long: r.long, layout: Math.round(r.layout), changes: r.changes,
        reruns: r.reruns === null ? '' : say(tr('perf.reruns', ' · component re-runs {count}', { count: r.reruns })) }));
    kept.push({ ...r }); if (kept.length > KEEP) kept.shift(); sum();
    active = null;
  };
  const input = (event: Event) => {
    if (event.target instanceof Node && box.contains(event.target)) return;
    const now = performance.now();
    if (!active) begin(now); else clearTimeout(active.timer);
    active!.timer = window.setTimeout(show, SETTLE);
  };
  const types: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'wheel'];
  for (const type of types) addEventListener(type, input, { capture: true, passive: true });

  // Frames while an interaction is open: the slowest, and how many were long. 操作期間的畫格：最慢的一格、長畫格幾個。
  let last = performance.now(), frame = 0;
  const tick = (time: number) => {
    const gap = time - last; last = time;
    if (active) { if (gap > active.reading.slowest) active.reading.slowest = gap; if (gap > LONG_FRAME) active.reading.long++; }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  // Layout the scripts forced during long frames (the browser only reports it there). 長畫格裡腳本逼出的排版（瀏覽器只在那裡回報）。
  let frames: PerformanceObserver | null = null;
  try {
    frames = new PerformanceObserver(list => { if (!active) return; for (const entry of list.getEntries() as (PerformanceEntry & { scripts?: { forcedStyleAndLayoutDuration: number }[] })[])
      for (const script of entry.scripts ?? []) active.reading.layout += script.forcedStyleAndLayoutDuration; });
    frames.observe({ type: 'long-animation-frame', buffered: false });
  } catch { frames = null; /* not every browser has it 不是每個瀏覽器都有 */ }
  // Elements changed inside the canvas (attributes, children, text). 畫布裡改了幾個元素（屬性、子元素、文字）。
  const changes = new MutationObserver(records => { if (active) active.reading.changes += records.length; });
  const watch = () => { const element = canvas(); if (element) changes.observe(element, { subtree: true, attributes: true, childList: true, characterData: true }); };
  watch();

  return () => {
    for (const type of types) removeEventListener(type, input, { capture: true });
    cancelAnimationFrame(frame); frames?.disconnect(); changes.disconnect();
    delete (globalThis as { __perfReadings?: Reading[] }).__perfReadings;
    if (active) clearTimeout(active.timer);
    box.remove();
  };
}
