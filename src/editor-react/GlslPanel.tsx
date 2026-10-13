import { memo, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useReactFlow } from '@xyflow/react';
import { highlightGlsl } from './code_highlight';
import { tr, say, useLanguage } from './text';
import { useSession } from './contexts';
import { frameNodes } from './viewport';
import { glslErrors } from './glsl_errors';
import { ScrollFade } from './controls';
import { scrollToMiddle } from './scroll_glide';
import type { EditorState } from './editor';
import { traceSwitch, useFollowTrace } from './live_trace';
import { glslRows, type GlslName, type GlslRow } from './glsl_lines';

// Live trace (Refactor.83, human 2026-10-11; new, legacy's GLSL tab did not follow the selection, app.js:1663): the primary
// node's names are marked and its lines lit as when hovered. On by default; a personal preference, switched from the panel's
// menu. 即時追蹤（R.83，人類；新行為，舊產品的 GLSL 分頁不跟選取）：主要選取節點的名字標出來、它的行像滑過時亮起。預設開；個人偏好，
// 在面板選單切換。
const trace = traceSwitch('glsl.liveTrace', tr('glsl.liveTrace', 'Live trace'), tr('glsl.liveTraceHint', "Mark the selected node's names and light its lines"));
/** The GLSL panel's menu (Refactor.83). GLSL 面板的選單（R.83）。 */
export const glslMenu = trace.menu;

/** The generated GLSL, read only (legacy GLSL tab), with line numbers (Refactor.63). A line number leads to the node that
 * wrote that line; lines TD reported in a compile failure are marked, but only while this is the GLSL that failed (an
 * edit since makes the numbers point elsewhere). Nodes themselves are never marked: the line where TD stops is not
 * always where the mistake is (human 2026-10-10). 產生的 GLSL（唯讀），有行號。行號帶回產生那一行的節點；TD 編譯失敗回報的
 * 行會標出來，但只在目前就是失敗的那份 GLSL 時（改過之後行號會指錯）。節點本身不標錯：TD 停下的那一行不一定是錯的源頭（人類）。 */
// Memoised: a node drag re-renders the workspace every move, and this panel only follows its own props (Refactor.79.4; EDITOR_UI_RULES, continuous interactions). It takes only the GLSL's own fields. 只拿 GLSL 自己的欄位。
// memo：拖節點時工作區每動一下都重繪，這個面板只跟著自己的 props（R.79.4；畫面規則「連續互動」）。
type GlslInput = Pick<EditorState, 'glsl' | 'glslMap' | 'glslVariables' | 'glslDeclarations' | 'stuck'>;
export const GlslPanel = memo(GlslView);
function GlslView({ glsl, glslMap, glslVariables, glslDeclarations, stuck }: GlslInput) {
  const language = useLanguage();
  const session = useSession(), flow = useReactFlow();
  const lines = useMemo(() => highlightGlsl(glsl), [glsl]);
  const failure = stuck?.failure;
  const errors = useMemo(() => failure && failure.pixel === glsl ? glslErrors(failure.log) : [], [failure, glsl]);
  const marked = useMemo(() => new Map(errors.map(error => [error.line, error.text])), [errors]);
  const box = useRef<HTMLDivElement>(null);
  const focus = useSyncExternalStore(session.glslFocusSubscribe, session.glslFocusSnapshot);
  // Re-drawn only when the primary node changes (a box selection settles once on release, a node drag keeps it), so nothing
  // here runs on every move (EDITOR_UI_RULES, continuous interactions). 只在主要選取換人時重畫（框選放開時才定、拖節點不改），
  // 連續互動時不會每一下都跑（畫面規則「連續互動」）。
  const primary = useSyncExternalStore(session.primarySubscribe, session.primarySnapshot);
  const traced = useSyncExternalStore(trace.subscribe, trace.snapshot) ? primary : null;
  // Glides or jumps by the gear's animation effects (Refactor.102.2). 照齒輪的動畫效果滑過去或直接跳（R.102.2）。
  const scrollTo = (line: number) => { const row = box.current?.querySelector<HTMLElement>(`[data-line="${line}"]`); if (row) scrollToMiddle(row); };
  useEffect(() => { if (focus.line) scrollTo(focus.line); }, [focus]);
  // The traced node's first line comes into view when it is chosen (Refactor.102.2, human 2026-10-12: the two panels trace alike).
  // 選到的節點第一行捲進畫面（R.102.2，人類：兩個面板追蹤的能力對齊）。
  const chooseHere = useFollowTrace(box, '.glsl-line.traced', traced);
  // The lines' handlers stay the same function for the panel's life (a memoised line keeps them); what changes per render is read
  // when they run. 行的處理函式在面板存在期間都是同一個（memo 的行留著它們）；每次重繪會變的東西在執行時才讀。
  const latest = useRef({ session, flow, chooseHere });
  latest.current = { session, flow, chooseHere };
  const go = useMemo((): GlslGo => ({
    node: id => { const { session, flow, chooseHere } = latest.current; chooseHere(id); session.selectNode(id); frameNodes(flow, [id]); },
    // A node's variable is a link to that node, found in the core's table, never guessed from the text (human 2026-10-10);
    // so is the Shader's output (Refactor.63.4). A Uniform's or constant's name selects every node using it, like Shared
    // Sources' "Select references" (63.4). 節點的變數是連到那個節點的超連結，照核心的表找，不從文字猜（人類）；Shader 的輸出也是。
    // Uniform 或常數的名字選取所有引用它的節點，同 Shared Sources 的「選取引用」。
    references: id => { const { session, flow } = latest.current; const nodes = session.selectReferences(id); if (nodes.length) frameNodes(flow, nodes); },
  }), []);
  // Split and coloured once per GLSL (Refactor.106 H); a primary change re-draws only the lines of the old and the new traced node.
  // 每份 GLSL 只切割上色一次（R.106 H）；換主要選取只重畫舊的與新的被追蹤節點那幾行。
  const { rows, touching } = useMemo(() => glslRows(lines, glslMap, glslVariables, glslDeclarations), [lines, glslMap, glslVariables, glslDeclarations]);
  const tracedLines = useMemo(() => new Set(traced === null ? [] : touching.get(traced) ?? []), [touching, traced]);
  if (!glsl) return <pre className="code-view">{say(tr('glsl.empty', 'The generated GLSL appears after the first apply.'))}</pre>;
  return <div className="glsl-view" ref={box} aria-label={say(tr('glsl.label', 'Generated GLSL'))}>
    {failure && <div className={'glsl-failure ' + (errors.length ? 'current' : 'earlier')}>
      <p>{say(failure.kind === 'internal'
        ? tr('glsl.internalError', 'TD-Grape ran into an internal error while applying this Shader; TD keeps running revision {revision}.', { revision: stuck?.lastKnownGood?.revision ?? '' })
        : errors.length ? tr('glsl.compileFailed', 'TD could not compile this GLSL; the lines TD reported are marked in red.')
          : tr('glsl.compileFailedEarlier', 'TD could not compile an earlier version of this GLSL; it has changed since, so the line numbers below may not match.'))}</p>
      {failure.kind !== 'internal' && errors.length > 0 && <p>{say(tr('glsl.clickError', 'Click an error to scroll to its line.'))}</p>}
      {errors.length > 0 ? <ul>{errors.map((error, index) => <li key={index}>
        <button type="button" className="glsl-error-link" onClick={() => scrollTo(error.line)}>
          {say(tr('glsl.lineError', 'Line {line}: {message}', { line: error.line, message: error.text }))}</button></li>)}</ul>
        : <pre className="glsl-log">{failure.log}</pre>}
    </div>}
    <ScrollFade className="glsl-scroll"><pre className="code-view glsl-code">{rows.map((row, index) => {
      const line = index + 1;
      return <Line key={line} line={line} row={row} error={marked.get(line)} focused={focus.line === line}
        traced={tracedLines.has(index) ? traced : null} language={language} go={go} />;
    })}</pre></ScrollFade>
  </div>;
}

type GlslGo = { node: (id: string) => void; references: (id: string) => void };
/** One line of the GLSL (Refactor.106 H). Memoised: it takes its pieces and what decides its look — `traced` is the traced node only
 * when this line shows it (its own node or one of its variables), else null, so a primary change leaves the other lines alone;
 * `language` re-draws the titles. GLSL 的一行（R.106 H）。memo：只拿自己的片段與決定外觀的值——traced 只在這一行有顯示它（自己的節點
 * 或它的變數）時才是被追蹤的節點、否則是 null，換主要選取時其他行不動；language 讓提示文字跟著換語言。 */
const Line = memo(function Line({ line, row, error, focused, traced, go }: { line: number; row: GlslRow; error: string | undefined;
  focused: boolean; traced: string | null; language: string; go: GlslGo }) {
  const node = row.node;
  const link = (name: GlslName, key: number) => 'node' in name
    ? <button key={key} type="button" className={'glsl-link' + (name.node === traced ? ' traced' : '')} onClick={() => go.node(name.node)}
      title={say(tr('glsl.goToVariable', 'Select the node {node}', { node: name.node }))}>{name.text}</button>
    : <button key={key} type="button" className="glsl-link" onClick={() => go.references(name.declaration)}
      title={say(tr('glsl.selectReferences', 'Select every node using {name}', { name: name.text }))}>{name.text}</button>;
  return <div data-line={line} className={'glsl-line' + (error !== undefined ? ' error' : '') + (focused ? ' focused' : '') + (node !== undefined && node === traced ? ' traced' : '')}
    title={error}>
    {node ? <button type="button" className="glsl-gutter" onClick={() => go.node(node)}
      title={say(tr('glsl.goToNode', 'Select the node that wrote this line ({node})', { node }))}>{line}</button>
      : <span className="glsl-gutter">{line}</span>}
    <span className="glsl-text">{row.pieces.map((piece, i) => 'linked' in piece
      ? <span key={i}>{piece.linked.map((part, j) => typeof part === 'string' ? part : link(part, j))}</span>
      : piece.kind ? <span key={i} className={'glsl-' + piece.kind}>{piece.text}</span> : piece.text)}{row.pieces.length ? null : ' '}</span>
  </div>;
});
