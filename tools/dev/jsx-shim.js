// Profiling JSX runtime (Refactor.107; development only, never shipped): every function component is wrapped so its own re-runs
// and render time are counted in globalThis.__prof while `on`. Used by `tools/build_editor.cjs --jsx-shim tools/dev/jsx-shim.js`
// for the counting runs of tests/browser/benchmark_scaling.cjs (--counts) and by the performance probe's "component re-runs".
// 量測用的 JSX runtime（R.107；只給開發用，不進產品）：每個函式元件都包一層，`on` 時把重跑次數與時間記在 globalThis.__prof。
// 由 `tools/build_editor.cjs --jsx-shim tools/dev/jsx-shim.js` 使用，供 benchmark_scaling.cjs 的計數版（--counts）與探針的「元件叫醒」。
import * as R from 'REAL_JSX_RUNTIME';
export const Fragment = R.Fragment;
const stats = globalThis.__prof = globalThis.__prof || { on: false, data: new Map() };
const cache = new WeakMap();
const MEMO = Symbol.for('react.memo'), FWD = Symbol.for('react.forward_ref');
const nameOf = f => (f && (f.displayName || f.name)) || 'anon';
function wrapFn(f, label) {
  if (cache.has(f)) return cache.get(f);
  const name = label || nameOf(f);
  const w = function (props, ref) {
    if (!stats.on) return f(props, ref);
    const t = performance.now();
    try { return f(props, ref); } finally {
      const d = performance.now() - t; let s = stats.data.get(name);
      if (!s) { s = { n: 0, t: 0 }; stats.data.set(name, s); } s.n++; s.t += d;
    }
  };
  Object.assign(w, f); w.displayName = name;
  cache.set(f, w); return w;
}
function wrapType(type) {
  if (typeof type === 'function') return type.prototype && type.prototype.isReactComponent ? type : wrapFn(type);
  if (type && typeof type === 'object') {
    if (cache.has(type)) return cache.get(type);
    let out = type;
    if (type.$$typeof === MEMO) out = { ...type, type: typeof type.type === 'function' ? wrapFn(type.type, type.displayName || nameOf(type.type)) : wrapType(type.type) };
    else if (type.$$typeof === FWD) out = { ...type, render: wrapFn(type.render, type.displayName || nameOf(type.render)) };
    cache.set(type, out); return out;
  }
  return type;
}
export function jsx(type, props, key) { return R.jsx(wrapType(type), props, key); }
export function jsxs(type, props, key) { return R.jsxs(wrapType(type), props, key); }
