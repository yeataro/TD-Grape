import { memo, useMemo, type ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from './markdown_parse';
import { highlightGlsl, type Piece } from './code_highlight';

// The Markdown engine's drawing half (Refactor.100): draws what markdown_parse.ts read, only as text elements — never HTML. A code block
// has line numbers; a glsl one is coloured as the GLSL panel (code_highlight.ts, the same colours and gutter). Read again only when
// the text changes. Used by group text; Notes later. Markdown 引擎的「畫」那一半（R.100）：把 markdown_parse.ts 讀出的結構畫成文字元素，
// 永遠不是 HTML。程式碼塊有行號；glsl 的照 GLSL 面板上色（同一份上色、同樣的行號欄）。只在文字改變時重讀。群組內文在用；之後的 Note 也用。

const inline = (pieces: readonly Inline[]): ReactNode[] => pieces.map((piece, i) => {
  switch (piece.kind) {
    case 'code': return <code key={i}>{piece.text}</code>;
    case 'strong': return <strong key={i}>{piece.text}</strong>;
    case 'em': return <em key={i}>{piece.text}</em>;
    // Opened in a new tab, telling it nothing about this page. 開新分頁，不讓它知道這一頁。
    case 'link': return <a key={i} href={piece.href} target="_blank" rel="noopener noreferrer">{piece.text}</a>;
    default: return piece.text;
  }
});

function CodeBlock({ language, source }: { language: string; source: string }) {
  const lines = useMemo(() => language === 'glsl' ? highlightGlsl(source) : source.split('\n').map((text): Piece[] => text ? [{ text }] : []), [language, source]);
  return <pre className="code-view md-code">{lines.map((pieces, index) => <div key={index} className="md-code-line">
    <span className="glsl-gutter">{index + 1}</span>
    <span className="glsl-text">{pieces.map((piece, i) => piece.kind ? <span key={i} className={'glsl-' + piece.kind}>{piece.text}</span> : piece.text)}{pieces.length ? null : ' '}</span>
  </div>)}</pre>;
}

const block = (item: Block, key: number): ReactNode => {
  switch (item.kind) {
    case 'heading': { const Tag = `h${Math.min(6, item.level)}` as 'h1'; return <Tag key={key}>{inline(item.content)}</Tag>; }
    case 'list': return item.ordered
      ? <ol key={key} start={item.start}>{item.items.map((content, i) => <li key={i}>{inline(content)}</li>)}</ol>
      : <ul key={key}>{item.items.map((content, i) => <li key={i}>{inline(content)}</li>)}</ul>;
    case 'code': return <CodeBlock key={key} language={item.language} source={item.source} />;
    default: return <p key={key}>{item.lines.map((content, i) => <span key={i}>{i ? <br /> : null}{inline(content)}</span>)}</p>;
  }
};

/** Text written in basic Markdown, drawn. 用基本 Markdown 寫的文字，畫出來。 */
export const Markdown = memo(function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return <div className={'markdown' + (className ? ' ' + className : '')}>{blocks.map(block)}</div>;
});
