import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchChoices, sourceLabel, wireOrder, type AddChoice } from './add_entries';
import type { Editor as EditorSession, WireEnd } from './editor';
import { Icon } from './icons';
import { say, tr } from './text';

// The floating Create node (Refactor.54; floating-panels.md 23, legacy graph_ui.js:2285–2350): search, the list,
// a description column (a placeholder for now). Opened where it is called up; from a dropped wire it lists only
// what fits that wire, says which port takes it, and puts the usual choices first. The category column waits for
// the human (still thinking how to keep it from crowding).
// 浮動的新增節點：搜尋、清單、說明欄（先佔位）。在叫出的位置打開；從放開的線叫出時只列接得上的、標出接哪個接孔、
// 常用的排前面。分類欄等人類想好（選項多會擠）。
export type CreateRequest = { screen: { x: number; y: number }; wire?: { end: WireEnd; type: string } };
type Match = { choice: AddChoice; port?: { port: string; type: string } };

export function CreateNode({ request, choices, session, onPick, onClose }: {
  request: CreateRequest; choices: readonly AddChoice[]; session: EditorSession;
  onPick(choice: AddChoice, port?: string): void; onClose(): void;
}) {
  const box = useRef<HTMLDivElement>(null), [query, setQuery] = useState(''), [index, setIndex] = useState(0);
  const [place, setPlace] = useState({ left: request.screen.x, top: request.screen.y });
  const wire = request.wire;
  // What fits the wire, asked once per opening (each answer is a rehearsal on a discarded candidate).
  // 接得上的，每次打開只問一次（每個答案都是在丟棄的候選文件上預演）。
  const fitting = useMemo((): Match[] => {
    if (!wire) return choices.map(choice => ({ choice }));
    // Measured 2026-10-09: about 90 choices in 13 ms. 實測約 90 個選項 13 ms。
    return choices.flatMap(choice => { const port = session.portFor(choice.spec, wire.end); return port ? [{ choice, port }] : []; });
  }, [choices, wire, session]);
  const matches = useMemo(() => {
    const found = searchChoices(fitting.map(match => match.choice), query).map(choice => fitting.find(match => match.choice === choice)!);
    if (query.trim() || !wire) return found;
    const order = wireOrder(wire.type, wire.end.side), rank = (match: Match) => {
      const at = order.indexOf(match.choice.key);
      return (at < 0 ? 99 : at) + (match.port?.type === wire.type ? 0 : .5);
    };
    return found.sort((a, b) => rank(a) - rank(b));
  }, [fitting, query, wire]);
  const active = matches[Math.min(index, matches.length - 1)];
  useLayoutEffect(() => {
    const width = box.current?.offsetWidth ?? 0, height = box.current?.offsetHeight ?? 0;
    setPlace({ left: Math.max(8, Math.min(request.screen.x, innerWidth - width - 8)), top: Math.max(8, Math.min(request.screen.y, innerHeight - height - 8)) });
  }, [request]);
  useEffect(() => {
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) onClose(); };
    addEventListener('pointerdown', away, true);
    return () => removeEventListener('pointerdown', away, true);
  }, [onClose]);
  useEffect(() => { box.current?.querySelector<HTMLElement>('.create-active')?.scrollIntoView({ block: 'nearest' }); }, [index, matches]);
  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex(at => Math.max(0, Math.min(matches.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' && active) { event.preventDefault(); onPick(active.choice, active.port?.port); }
  };
  const title = wire ? `${wire.type} · ${wire.end.side === 'output' ? '→' : '←'}` : say(tr('create.title', 'Create node'));
  return <div ref={box} className="create-node" role="dialog" aria-label={say(tr('create.title', 'Create node'))} style={place} onKeyDown={keys}>
    <header className="create-head"><strong>{title}</strong>
      <button type="button" className="icon-button" aria-label={say(tr('create.close', 'Close'))} onClick={onClose}><Icon name="close" /></button></header>
    <input className="create-search" autoFocus value={query} placeholder={say(tr('create.search', 'Search nodes…'))}
      onChange={event => { setQuery(event.target.value); setIndex(0); }} />
    <div className="create-columns">
      <div className="create-list" role="listbox" aria-label={say(tr('create.results', 'Nodes'))}>
        {matches.length ? matches.map((match, i) => <button key={match.choice.id} type="button" role="option" aria-selected={i === index}
          className={'create-entry' + (i === index ? ' create-active' : '')} onMouseEnter={() => setIndex(i)}
          onClick={() => onPick(match.choice, match.port?.port)}>
          <span className="create-name">{match.choice.label}</span>
          {match.port && <small className="create-port">{match.port.port} · {match.port.type}</small>}
          <small className="create-source">{say(sourceLabel[match.choice.source])}</small></button>)
          : <p className="hint">{say(tr('create.empty', 'Nothing matches.'))}</p>}
      </div>
      {/* The description column waits for the node texts (human 2026-10-09: a placeholder for now). 說明欄等節點說明。 */}
      <aside className="create-details">{active && <><strong>{active.choice.label}</strong>
        <small>{say(sourceLabel[active.choice.source])}</small>
        <p className="hint">{say(tr('create.noDescription', 'Descriptions are not available yet.'))}</p></>}</aside>
    </div>
  </div>;
}
