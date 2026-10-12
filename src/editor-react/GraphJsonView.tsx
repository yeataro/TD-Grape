import { memo, useMemo } from 'react';
import { highlightJson } from './code_highlight';
import { formatJson } from './json_format';
import { tr, say, useLanguage } from './text';
import { ScrollFade } from './controls';
import type { Editor as EditorSession } from './editor';

/** The graph document as JSON, read only (Refactor.102, human 2026-10-12; new, legacy only exported it): laid out for reading,
 * coloured as the GLSL panel, no line numbers (the saved document is one line, so they would point at nothing). Worked out again
 * only when the graph changes (`version`) and while shown; a drag or a pan does nothing here. 圖文件的 JSON，唯讀（R.102，人類 10-12；
 * 新行為，舊產品只有匯出）：排成好讀的樣子、用 GLSL 面板的顏色、沒有行號（存的文件是一行，行號對不到東西）。只在圖改變（version）
 * 而且顯示中才重算；拖曳、平移不會跑這裡。 */
export const GraphJsonView = memo(function GraphJsonView({ session, version }: { session: EditorSession; version: number }) {
  useLanguage();
  // `version` is what says the graph changed. 圖改了沒有，看 version。
  const lines = useMemo(() => highlightJson(formatJson(session.graph())), [session, version]);
  // Each line: its indent, then its text; a long line wraps under its own start, a little further in.
  // 每一行：縮排，再來是內容；長的一行換行時，接在自己開頭的下面、再往內一點。
  return <ScrollFade className="graph-json-scroll"><pre className="code-view graph-json" aria-label={say(tr('graphJson.label', 'The graph document as JSON'))}>
    {lines.map((pieces, index) => {
      const lead = pieces[0] && !pieces[0].kind ? /^ */.exec(pieces[0].text)![0] : '';
      const rest = lead ? [{ ...pieces[0]!, text: pieces[0]!.text.slice(lead.length) }, ...pieces.slice(1)] : pieces;
      return <div key={index} className="graph-json-line">
        {lead && <span className="graph-json-indent">{lead}</span>}
        <span className="graph-json-text">{rest.map((piece, i) => piece.kind ? <span key={i} className={'glsl-' + piece.kind}>{piece.text}</span> : piece.text)}</span>
      </div>;
    })}
  </pre></ScrollFade>;
});
