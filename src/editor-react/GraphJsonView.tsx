import { memo, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useReactFlow } from '@xyflow/react';
import { highlightJson } from './code_highlight';
import { changedLines, layJson, type JsonLine } from './json_format';
import { tr, say, useLanguage } from './text';
import { frameNodes } from './viewport';
import { ScrollFade } from './controls';
import type { Editor as EditorSession } from './editor';
import type { MenuItem } from './DropdownMenu';
import { readPreference, writePreference } from './preferences';

// Live trace (Refactor.102.1, human 2026-10-12; new): the primary node's lines are lit as the GLSL panel's traced lines, and the lines
// an edit changed flash from the brightest text colour back to their own. One switch for both, this panel's own (not the GLSL
// panel's); the flash follows only it, not the gear's animation setting (human: whoever does not want it turns tracing off). On by
// default, a personal preference. 即時追蹤（R.102.1，人類 10-12；新行為）：主要選取節點的那幾行像 GLSL 面板被追蹤的行一樣亮起，修改改到
// 的行從最亮的字色退回原本的顏色。兩件事一個開關，是這個面板自己的（不是 GLSL 面板的）；亮一下只跟這個開關，不跟齒輪的動畫設定
// （人類：不想要的人關掉追蹤）。預設開；個人偏好。
const TRACE = 'graphJson.liveTrace';
let tracing = readPreference(TRACE) !== 'off';
const traceListeners = new Set<() => void>();
const traceSubscribe = (listener: () => void) => { traceListeners.add(listener); return () => { traceListeners.delete(listener); }; };
const traceSnapshot = () => tracing;
/** The Graph JSON View's menu (Refactor.102.1). Graph JSON View 的選單（R.102.1）。 */
export const graphJsonMenu = (): readonly MenuItem[] => [{ key: 'liveTrace', checkbox: true, checked: tracing,
  label: say(tr('graphJson.liveTrace', 'Live trace')),
  title: say(tr('graphJson.liveTraceHint', "Light the selected node's lines, and the lines an edit changes")),
  select: () => { tracing = !tracing; writePreference(TRACE, tracing ? 'on' : 'off'); traceListeners.forEach(listener => listener()); } }];

/** The graph document as JSON, read only (Refactor.102, human 2026-10-12; new, legacy only exported it): laid out for reading,
 * coloured as the GLSL panel, no line numbers (the saved document is one line, so they would point at nothing). Worked out again
 * only when the graph changes (`version`) and while shown; a drag or a pan does nothing here. A node's id and name lead to the node
 * (Refactor.102.1). 圖文件的 JSON，唯讀（R.102，人類 10-12；新行為，舊產品只有匯出）：排成好讀的樣子、用 GLSL 面板的顏色、沒有行號（存的
 * 文件是一行，行號對不到東西）。只在圖改變（version）而且顯示中才重算；拖曳、平移不會跑這裡。節點的 id 與名字帶回節點（R.102.1）。 */
export const GraphJsonView = memo(function GraphJsonView({ session, version }: { session: EditorSession; version: number }) {
  useLanguage();
  const flow = useReactFlow();
  // `version` is what says the graph changed. 圖改了沒有，看 version。
  const lines = useMemo(() => layJson(session.graph()), [session, version]);
  const pieces = useMemo(() => highlightJson(lines.map(line => line.text).join('\n')), [lines]);
  // What changed since the lines shown before; nothing on the first showing (opening the panel is not an edit). Kept by the lines
  // it was worked out for, so working it out twice (React's strict mode) gives the same answer.
  // 和上次顯示的行比，改了哪些；第一次顯示什麼都不算（打開面板不是修改）。照算出它的那份行保存，算兩次（React 嚴格模式）答案一樣。
  const shown = useRef<{ lines: readonly JsonLine[]; before: readonly JsonLine[] | null; changed: Set<number> } | null>(null);
  if (shown.current?.lines !== lines) {
    const before = shown.current?.lines ?? null;
    shown.current = { lines, before, changed: before ? changedLines(before, lines) : new Set() };
  }
  const changed = shown.current.changed;
  // Re-drawn only when the primary node changes, as the GLSL panel. 只在主要選取換人時重畫，同 GLSL 面板。
  const primary = useSyncExternalStore(session.selectionSubscribe, session.primarySnapshot);
  const on = useSyncExternalStore(traceSubscribe, traceSnapshot), traced = on ? primary : null;
  const box = useRef<HTMLPreElement>(null);
  // The traced node's lines come into view when it is chosen, unless they already are. 選到的節點那幾行捲進畫面，已經看得到就不動。
  useEffect(() => {
    const first = traced && box.current?.querySelector<HTMLElement>('.graph-json-line.traced');
    const area = first && first.closest('.scroll-fade-area');
    if (!first || !area) return;
    const top = first.getBoundingClientRect().top, view = area.getBoundingClientRect();
    if (top < view.top || top > view.bottom - first.offsetHeight) first.scrollIntoView({ block: 'center' });
  }, [traced]);
  const goToNode = (id: string) => { session.selectNode(id); frameNodes(flow, [id]); };
  // Each line: its indent, then its text; a long line wraps under its own start, a little further in. A line that changed is keyed
  // anew, so its flash starts again at every edit. 每一行：縮排，再來是內容；長的一行換行時，接在自己開頭的下面、再往內一點。改到的
  // 行換一個 key，每次修改都重新亮一次。
  return <ScrollFade className="graph-json-scroll"><pre ref={box} className="code-view graph-json" aria-label={say(tr('graphJson.label', 'The graph document as JSON'))}>
    {lines.map((line, index) => {
      const row = pieces[index] ?? [];
      const lead = row[0] && !row[0].kind ? /^ */.exec(row[0].text)![0] : '';
      const rest = lead ? [{ ...row[0]!, text: row[0]!.text.slice(lead.length) }, ...row.slice(1)] : row;
      const flash = on && changed.has(index);
      return <div key={flash ? index + ':' + version : index}
        className={'graph-json-line' + (line.node !== undefined && line.node === traced ? ' traced' : '') + (flash ? ' changed' : '')}>
        {lead && <span className="graph-json-indent">{lead}</span>}
        <span className="graph-json-text">{rest.map((piece, i) => piece.kind === 'string' && line.link !== undefined
          ? <button key={i} type="button" className="glsl-link" onClick={() => goToNode(line.link!)}
            title={say(tr('graphJson.goToNode', 'Select the node {node}', { node: line.link }))}>{piece.text}</button>
          : piece.kind ? <span key={i} className={'glsl-' + piece.kind}>{piece.text}</span> : piece.text)}</span>
      </div>;
    })}
  </pre></ScrollFade>;
});
