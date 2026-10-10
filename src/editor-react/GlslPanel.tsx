import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useReactFlow } from '@xyflow/react';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-glsl';
import { tr, say } from './text';
import { useSession } from './contexts';
import { frameNodes } from './viewport';
import { glslErrors } from './glsl_errors';
import { ScrollFade } from './controls';
import type { EditorState } from './editor';

// Prism's token kinds, shown in the legacy GLSL colours (legacy style.css:480; Refactor.63, human 2026-10-10: a light
// library, not our own highlighter). Prism counts types as keywords; a keyword that is a type by the legacy list
// (legacy app.js:1624) takes the type colour again (Refactor.63.5, human: layout and vec4 looked the same).
// Prism 的 token 種類，用舊產品的 GLSL 顏色（人類：用輕量的程式庫，不自己維護上色）。Prism 把型別算進關鍵字；照舊產品的
// 型別清單是型別的關鍵字，改回型別色（63.5，人類：layout 和 vec4 同色看起來怪）。
const KINDS: Record<string, string> = { comment: 'comment', macro: 'directive', directive: 'directive', string: 'string',
  char: 'string', number: 'number', boolean: 'number', keyword: 'keyword', function: 'function', constant: 'builtin',
  'class-name': 'type' };
const TYPES = /^(?:void|bool|int|uint|float|double|atomic_uint|[biud]?vec[234]|d?mat[234](?:x[234])?|[iu]?(?:sampler|image)(?:1D|2D|3D|Cube|2DRect|Buffer)(?:MS)?(?:Array)?(?:Shadow)?)$/;
const kindOf = (token: Prism.Token, outer?: string) => token.type === 'keyword' && typeof token.content === 'string' && TYPES.test(token.content)
  ? 'type' : KINDS[token.type] ?? outer;
type Piece = { text: string; kind?: string };

/** The GLSL split into lines of coloured pieces; a token running over lines (a block comment) is cut at each line.
 * GLSL 切成一行行有顏色的片段；跨行的 token（區塊註解）在換行處切開。 */
function highlight(source: string): Piece[][] {
  const pieces: Piece[] = [];
  const walk = (stream: Prism.TokenStream, kind?: string) => {
    if (typeof stream === 'string') pieces.push({ text: stream, kind });
    else if (Array.isArray(stream)) stream.forEach(item => walk(item, kind));
    else walk(stream.content, kindOf(stream, kind));
  };
  walk(Prism.tokenize(source, Prism.languages.glsl!));
  const lines: Piece[][] = [[]];
  for (const piece of pieces) {
    piece.text.split('\n').forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines[lines.length - 1]!.push({ text, kind: piece.kind });
    });
  }
  return lines;
}

/** The generated GLSL, read only (legacy GLSL tab), with line numbers (Refactor.63). A line number leads to the node that
 * wrote that line; lines TD reported in a compile failure are marked, but only while this is the GLSL that failed (an
 * edit since makes the numbers point elsewhere). Nodes themselves are never marked: the line where TD stops is not
 * always where the mistake is (human 2026-10-10). 產生的 GLSL（唯讀），有行號。行號帶回產生那一行的節點；TD 編譯失敗回報的
 * 行會標出來，但只在目前就是失敗的那份 GLSL 時（改過之後行號會指錯）。節點本身不標錯：TD 停下的那一行不一定是錯的源頭（人類）。 */
export function GlslPanel({ state }: { state: EditorState }) {
  const session = useSession(), flow = useReactFlow();
  const { glsl, glslMap, glslVariables, glslDeclarations, stuck } = state;
  const lines = useMemo(() => highlight(glsl), [glsl]);
  const nodeOf = useMemo(() => new Map(glslMap.map(row => [row.line, row.node])), [glslMap]);
  const failure = stuck?.failure;
  const errors = useMemo(() => failure && failure.pixel === glsl ? glslErrors(failure.log) : [], [failure, glsl]);
  const marked = useMemo(() => new Map(errors.map(error => [error.line, error.text])), [errors]);
  const box = useRef<HTMLDivElement>(null);
  const focus = useSyncExternalStore(session.glslFocusSubscribe, session.glslFocusSnapshot);
  const scrollTo = (line: number) => box.current?.querySelector<HTMLElement>(`[data-line="${line}"]`)?.scrollIntoView({ block: 'center' });
  useEffect(() => { if (focus.line) scrollTo(focus.line); }, [focus]);
  const goToNode = (id: string) => { session.selectNode(id); frameNodes(flow, [id]); };
  // A node's variable is a link to that node, found in the core's table, never guessed from the text (human 2026-10-10);
  // so is the Shader's output (Refactor.63.4). A Uniform's or constant's name selects every node using it, like Shared
  // Sources' "Select references" (63.4). 節點的變數是連到那個節點的超連結，照核心的表找，不從文字猜（人類）；Shader 的輸出也是。
  // Uniform 或常數的名字選取所有引用它的節點，同 Shared Sources 的「選取引用」。
  const goToReferences = (id: string) => { const nodes = session.selectReferences(id); if (nodes.length) frameNodes(flow, nodes); };
  const names = useMemo(() => [...Object.keys(glslVariables), ...Object.keys(glslDeclarations)].sort((a, b) => b.length - a.length),
    [glslVariables, glslDeclarations]);
  const pattern = useMemo(() => names.length ? new RegExp('\\b(' + names.join('|') + ')\\b', 'g') : null, [names]);
  const link = (name: string, key: number) => {
    const node = glslVariables[name], declaration = glslDeclarations[name];
    return node !== undefined
      ? <button key={key} type="button" className="glsl-link" onClick={() => goToNode(node)}
        title={say(tr('glsl.goToVariable', 'Select the node {node}', { node }))}>{name}</button>
      : <button key={key} type="button" className="glsl-link" onClick={() => goToReferences(declaration!)}
        title={say(tr('glsl.selectReferences', 'Select every node using {name}', { name }))}>{name}</button>;
  };
  const linked = (text: string, key: number) => {
    if (!pattern) return text;
    const parts = text.split(pattern);
    return parts.length === 1 ? text : <span key={key}>{parts.map((part, i) => i % 2 ? link(part, i) : part)}</span>;
  };
  if (!glsl) return <pre className="code-view">{say(tr('glsl.empty', 'The generated GLSL appears after the first apply.'))}</pre>;
  return <div className="glsl-view" ref={box} aria-label={say(tr('glsl.label', 'Generated GLSL'))}>
    {failure && <div className={'glsl-failure ' + (errors.length ? 'current' : 'earlier')}>
      <p>{say(failure.kind === 'internal'
        ? tr('glsl.internalError', 'TD-Grape ran into an internal error while applying this Shader; TD keeps running revision {revision}.', { revision: state.stuck?.lastKnownGood?.revision ?? '' })
        : errors.length ? tr('glsl.compileFailed', 'TD could not compile this GLSL; the lines TD reported are marked in red.')
          : tr('glsl.compileFailedEarlier', 'TD could not compile an earlier version of this GLSL; it has changed since, so the line numbers below may not match.'))}</p>
      {failure.kind !== 'internal' && errors.length > 0 && <p>{say(tr('glsl.clickError', 'Click an error to scroll to its line.'))}</p>}
      {errors.length > 0 ? <ul>{errors.map((error, index) => <li key={index}>
        <button type="button" className="glsl-error-link" onClick={() => scrollTo(error.line)}>
          {say(tr('glsl.lineError', 'Line {line}: {message}', { line: error.line, message: error.text }))}</button></li>)}</ul>
        : <pre className="glsl-log">{failure.log}</pre>}
    </div>}
    <ScrollFade className="glsl-scroll"><pre className="code-view glsl-code">{lines.map((pieces, index) => {
      const line = index + 1, node = nodeOf.get(line), error = marked.get(line);
      return <div key={line} data-line={line} className={'glsl-line' + (error !== undefined ? ' error' : '') + (focus.line === line ? ' focused' : '')}
        title={error}>
        {node ? <button type="button" className="glsl-gutter" onClick={() => goToNode(node)}
          title={say(tr('glsl.goToNode', 'Select the node that wrote this line ({node})', { node }))}>{line}</button>
          : <span className="glsl-gutter">{line}</span>}
        <span className="glsl-text">{pieces.map((piece, i) => piece.kind
          ? <span key={i} className={'glsl-' + piece.kind}>{piece.text}</span> : linked(piece.text, i))}{pieces.length ? null : ' '}</span>
      </div>;
    })}</pre></ScrollFade>
  </div>;
}
