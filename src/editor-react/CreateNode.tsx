import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { searchChoices, sourceLabel, wireOrder, type AddChoice } from './add_entries';
import { dragToAdd } from './drag_to_add';
import type { Editor as EditorSession, WireEnd, WireFit } from './editor';
import { Icon } from './icons';
import { language, languageSubscribe, say, tr } from './text';

// The floating Create node (Refactor.54; floating-panels.md 23, legacy graph_ui.js:2285–2350): search, the list,
// a description column (a placeholder for now). Opened where it is called up; from a dropped wire it lists only
// what fits that wire, says which port takes it, and puts the usual choices first. The category column waits for
// the human (still thinking how to keep it from crowding).
// 浮動的新增節點：搜尋、清單、說明欄（先佔位）。在叫出的位置打開；從放開的線叫出時只列接得上的、標出接哪個接孔、
// 常用的排前面。分類欄等人類想好（選項多會擠）。
/** place: what is picked is placed, not added at once (a right-click on a port, Refactor.105; Tab, a double-click, the menu, R.105.1).
 * place：選好的先放置，不馬上新增（接孔右鍵，R.105；Tab、雙擊、選單，R.105.1）。 */
/** whole: the whole panel is centred on the point, not its search box (Tab, R.105.12). whole：整個視窗置中在那一點，不是搜尋框（Tab，R.105.12）。 */
export type CreateRequest = { screen: { x: number; y: number }; wire?: { end: WireEnd; type: string }; place?: boolean; whole?: boolean };
type Match = { choice: AddChoice; port?: WireFit };

export function CreateNode({ request, choices, session, onPick, onClose }: {
  request: CreateRequest; choices: readonly AddChoice[]; session: EditorSession;
  onPick(choice: AddChoice, port?: WireFit): void; onClose(): void;
}) {
  const box = useRef<HTMLDivElement>(null), [query, setQuery] = useState(''), [index, setIndex] = useState(0);
  const [place, setPlace] = useState({ left: request.screen.x, top: request.screen.y });
  const wire = request.wire;
  // What fits the wire, asked once per opening (each answer is a rehearsal on a discarded candidate).
  // 接得上的，每次打開只問一次（每個答案都是在丟棄的候選文件上預演）。
  const fitting = useMemo((): Match[] => {
    if (!wire) return choices.map(choice => ({ choice }));
    // Measured 2026-10-09: about 90 choices in 13 ms. 實測約 90 個選項 13 ms。
    return choices.flatMap(choice => { const port = session.wireFit(choice.id, choice.spec, wire.end); return port ? [{ choice, port }] : []; });
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
  // Kept inside the window, 8px from its edges, for a panel of this size. 這個大小的面板留在視窗裡、離邊 8px。
  const inside = (left: number, top: number, width: number, height: number) =>
    ({ left: Math.max(8, Math.min(left, innerWidth - width - 8)), top: Math.max(8, Math.min(top, innerHeight - height - 8)) });
  // Its search box is centred on the point it was called up at (Refactor.105.11, human 2026-10-13: try the text box's middle on the
  // pointer; legacy centred the panel across it with its title bar's middle on it; ours had its top left there). 搜尋框的中心對準叫出的
  // 那一點（R.105.11，人類 10-13：試試看文字輸入框的中間對齊滑鼠；舊產品是整個面板水平置中、標題列中間對著它；我們原本是左上角）。
  // Tab centres the whole panel instead (R.105.12, human 2026-10-13). Tab 改成整個視窗置中（R.105.12，人類 10-13）。
  useLayoutEffect(() => {
    // What is centred on the point, and where it sits in the panel. 置中在那一點的是什麼，它在視窗裡的哪裡。
    const panel = box.current, aim = request.whole ? panel : panel?.querySelector<HTMLElement>('.create-search');
    const x = aim ? (request.whole ? 0 : aim.offsetLeft) + aim.offsetWidth / 2 : 0, y = aim ? (request.whole ? 0 : aim.offsetTop) + aim.offsetHeight / 2 : 0;
    setPlace(inside(request.screen.x - x, request.screen.y - y, panel?.offsetWidth ?? 0, panel?.offsetHeight ?? 0));
  }, [request]);
  // Moved by its title bar, as the legacy editor (graph_ui.js:2255–2282): a move of 3px or more starts it, so a click does not
  // nudge it; each opening starts where it was called up. Escape closes the panel as always (Refactor.79.1: legacy cancelled the
  // move instead; one meaning per key); only an interruption the person did not choose (a cancel, a lost pointer) puts it back.
  // 抓標題列移動，照舊產品：移動 3px 以上才開始，點一下不會讓它抖；每次打開都從叫出的位置開始。Esc 照常關閉面板（R.79.1：
  // 舊產品是取消移動；一個鍵一個意思）；只有不是人選的中斷（取消、指標遺失）才放回原位。
  // Only the place changes while moving: the size is measured once, and the list (below) is not rebuilt (Refactor.79.2, human
  // 2026-10-11: it trailed the mouse). 移動時只改位置：大小量一次，清單（下面）不重建（R.79.2，人類：有跟隨感）。
  const moveBy = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('button') || !box.current) return;
    const head: HTMLElement = event.currentTarget, id = event.pointerId, from = { x: event.clientX, y: event.clientY };
    const rect = box.current.getBoundingClientRect(), start = { left: rect.left, top: rect.top };
    const inBox = (left: number, top: number) => inside(left, top, rect.width, rect.height);
    let moved = false;
    const stop = new AbortController(), options = { signal: stop.signal };
    const end = (keep: boolean) => { stop.abort(); if (!keep) setPlace(start); if (head.hasPointerCapture(id)) head.releasePointerCapture(id); };
    head.addEventListener('pointermove', move => {
      if (move.pointerId !== id) return;
      if (!moved && Math.hypot(move.clientX - from.x, move.clientY - from.y) < 3) return;
      moved = true; setPlace(inBox(start.left + move.clientX - from.x, start.top + move.clientY - from.y));
    }, options);
    head.addEventListener('pointerup', up => { if (up.pointerId === id) end(true); }, options);
    head.addEventListener('pointercancel', () => end(false), options);
    head.addEventListener('lostpointercapture', () => end(false), options);
    event.preventDefault();
    try { head.setPointerCapture(id); } catch { end(false); } // a pointer already gone 指標已經不在
  };
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
    } else if (event.key === 'Enter' && active) { event.preventDefault(); onPick(active.choice, active.port); }
  };
  const title = wire ? `${wire.type} · ${wire.end.side === 'output' ? '→' : '←'}` : say(tr('create.title', 'Create node'));
  // On a touch screen the search is not focused at once: the keyboard would cover half the screen, and most picks are from the
  // list; a tap on the box brings it (Refactor.75.10, human 2026-10-11). With a mouse it is focused as before.
  // 觸控螢幕上不馬上聚焦搜尋框：鍵盤會蓋掉半個畫面，而且多半是從清單挑；點一下搜尋框才出現（R.75.10，人類）。滑鼠照舊聚焦。
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const shownIn = useSyncExternalStore(languageSubscribe, language); // the texts below follow the language 下面的文字跟著語言
  // The list and details, rebuilt only when what they show changes, not when the panel moves. 清單與說明，內容變了才重建，移動面板時不重建。
  const columns = useMemo(() =>
    <div className="create-columns">
      <div className="create-list" role="listbox" aria-label={say(tr('create.results', 'Nodes'))}>
        {matches.length ? matches.map((match, i) => <button key={match.choice.id} type="button" role="option" aria-selected={i === index}
          className={'create-entry' + (i === index ? ' create-active' : '')} onMouseEnter={() => setIndex(i)}
          onClick={() => onPick(match.choice, match.port)}
          // Dragged onto the canvas with a mouse; not when opened from a wire, whose point is to connect it (Refactor.104, human
          // 2026-10-12: A). 用滑鼠拖到畫布；從線打開時不行，那時的意思是接上那條線（R.104，人類 10-12：A）。
          {...(wire ? {} : { ...dragToAdd(match.choice.id, { touch: 'none' }), 'data-drag-handle': '' })}>
          <span className="create-name">{match.choice.label}</span>
          {match.port && <small className="create-port">{match.port.port} · {match.port.type}</small>}
          <small className="create-source">{say(sourceLabel[match.choice.source])}</small></button>)
          : <p className="hint">{say(tr('create.empty', 'Nothing matches.'))}</p>}
      </div>
      {/* The description column waits for the node texts (human 2026-10-09: a placeholder for now). 說明欄等節點說明。 */}
      <aside className="create-details">{active && <><strong>{active.choice.label}</strong>
        <small>{say(sourceLabel[active.choice.source])}</small>
        <p className="hint">{say(tr('create.noDescription', 'Descriptions are not available yet.'))}</p></>}</aside>
    </div>, [matches, index, active, onPick, shownIn]);
  return <div ref={box} className="create-node" role="dialog" aria-label={say(tr('create.title', 'Create node'))} style={place} onKeyDown={keys}>
    <header className="create-head" data-movable="" onPointerDown={moveBy}><strong>{title}</strong>
      <button type="button" className="icon-button" aria-label={say(tr('create.close', 'Close'))} onClick={onClose}><Icon name="close" /></button></header>
    <input className="create-search" autoFocus={!touch} value={query} placeholder={say(tr('create.search', 'Search nodes…'))}
      onChange={event => { setQuery(event.target.value); setIndex(0); }} />
    {columns}
  </div>;
}
