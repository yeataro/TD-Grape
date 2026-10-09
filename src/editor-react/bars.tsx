import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import { creatableEntries } from './core';
import type { Editor as EditorSession, EditorState } from './editor';
import { BrandMark } from './icons';
import { IconButton, MenuButton, Placeholder, Select, ToolGroup, notYet } from './controls';
import type { Layout } from './layout';
import type { Report } from './reports';
import { language, setLanguage, say, tr, type Message } from './text';

// The editor's bars (Refactor.53; work/in-place-refactor-design/floating-panels.md): the title bar, the location
// bar over the network, the network's own toolbar and the foot bar. Each is a row of the shared controls
// (controls.tsx); what a control does is passed in or read from the session being edited.
// 編輯器的各列：標題列、網路區上方的網址列、網路區自己的功能列、底列。每一列都由共用控制項組成；
// 控制項做什麼由外面傳入，或從正在編輯的 session 讀。

const noLog: readonly Report[] = [];
const noSubscribe = () => () => {};
/** The status of the graph being edited, or nothing. 正在編輯的圖的狀態，沒有圖時為 null。 */
const useEditorState = (session: EditorSession | null): EditorState | null =>
  useSyncExternalStore(session?.subscribe ?? noSubscribe, session?.snapshot ?? (() => null));
const canApply = (state: EditorState | null) => !!state?.dirty && !['sending', 'offline', 'uncertain', 'conflict'].includes(state.phase);

/** The title bar, as the legacy editor (human 2026-10-09): mark, name, tagline, version, About; then the common
 * actions. 標題列照舊產品：圖標、名稱、副標題、版本、About；右邊是常用動作。 */
export function TitleBar({ session, version }: { session: EditorSession | null; version: string }) {
  const state = useEditorState(session);
  return <header className="title-bar">
    <BrandMark /><strong className="brand-name">TD-Grape</strong>
    <small className="brand-line">{say(tr('editor.tagline', 'A Shader Editor for TouchDesigner'))}<span aria-hidden="true">·</span>{version}
      <span aria-hidden="true">·</span><Placeholder label={tr('action.about', 'About')} className="link-button" /></small>
    <span className="spacer" />
    {/* Switches in place, keeping the work and its history (legacy). Same key as the legacy editor.
        當場切換，作品與歷史都保留（照舊產品）。鍵與舊產品相同。 */}
    <Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
      options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} />
    <Placeholder label={tr('action.importGraph', 'Import graph')} />
    <Placeholder label={tr('action.exportGraph', 'Export graph')} />
    <button type="button" aria-disabled={!session || state?.phase === 'sending' || undefined}
      onClick={() => { if (session && state?.phase !== 'sending') void session.save(); }}>{say(tr('toolbar.saveProject', 'Save TD project'))}</button>
    <button type="button" className="primary" aria-disabled={!canApply(state) || undefined}
      onClick={() => { if (session && canApply(state)) void session.flush(); }}>{say(tr('action.applyShader', 'Apply Shader'))}</button>
  </header>;
}

/** The location bar, over the network only (human 2026-10-09; the legacy one spanned the whole width): the zone
 * toggles at its ends, what is being edited in between. 網址列只在網路區上方（人類；舊產品跨整個寬度）：兩端是面板區開關，
 * 中間是正在編輯的東西。 */
export function LocationBar({ layout, rightEmpty, children }: { layout: Layout; rightEmpty: boolean; children: ReactNode }) {
  return <div className="location-bar">
    <IconButton icon="leftPanel" label={tr('layout.leftZone', 'Left panels')} pressed={layout.left.open} onClick={() => layout.toggleZone('left')} />
    {children}
    <span className="spacer" />
    <IconButton icon="titleBar" label={tr('layout.titleBar', 'Title bar')} pressed={layout.titleBar} onClick={layout.toggleTitleBar} />
    <Placeholder label={tr('layout.menu', 'Layout')} />
    {/* No panel lives on the right yet (the Parameter panel comes later): a placeholder until then.
        右邊還沒有面板（參數面板之後才有），先是佔位。 */}
    <IconButton icon="rightPanel" label={tr('layout.rightZone', 'Right panels')} pressed={!rightEmpty && layout.right.open}
      disabled={rightEmpty} title={rightEmpty ? tr('layout.rightEmpty', 'No panels here yet') : undefined} onClick={() => layout.toggleZone('right')} />
  </div>;
}

export type CanvasPrefs = { bodyDrag: boolean; snap: boolean; boxSelect: boolean; set(patch: Partial<Omit<CanvasPrefs, 'set'>>): void };

/** The network's own toolbar, floating over its top edge (human 2026-10-09): stages on the left; on the right
 * history, the selection's actions (until the floating selection toolbar exists), box select, canvas
 * preferences and the GLSL panel. Only what exists is shown. 網路區自己的功能列，浮在上緣：左邊 Stage；右邊歷史、
 * 選取的動作（浮動選取工具列做好之前放這裡）、框選、畫布偏好、GLSL 面板。只放現在有的。 */
export function NetworkBar({ session, prefs, onGlsl, text }: {
  session: EditorSession | null; prefs: CanvasPrefs; onGlsl(): void; text: (key: string) => string;
}) {
  const state = useEditorState(session), flow = useReactFlow();
  const nodes = state?.projection.nodes.filter(node => node.selected) ?? [], edges = state?.projection.edges.filter(edge => edge.selected) ?? [];
  const stages = session?.stageNames() ?? [];
  return <div className="network-bar">
    <div className="network-bar-group">
      {/* Only the stages this graph has (human 2026-10-09); only Pixel can be edited so far.
          只顯示這張圖有的 Stage（人類）；目前只能編輯 Pixel。 */}
      {stages.length > 0 && <div className="segmented" role="tablist" aria-label={say(tr('stage.label', 'Stage'))}>
        {stages.map(stage => <button key={stage} type="button" role="tab" aria-selected={stage === 'pixel'}
          aria-disabled={stage !== 'pixel' || undefined} title={stage === 'pixel' ? undefined : say(notYet)}>
          {stage === 'pixel' ? 'Pixel' : stage === 'vertex' ? 'Vertex' : stage}</button>)}</div>}
      {/* The browser's native list until the Add Node panels (round 2). 新增節點的面板做好前（第 2 輪）暫用。 */}
      <Select label={tr('toolbar.addNode', 'Add node')} value="" disabled={!session} onChange={index => {
        const box = document.querySelector('.canvas')!.getBoundingClientRect(), entry = creatableEntries[Number(index)]!;
        session!.add(entry.uuid, flow.screenToFlowPosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 }), entry.params);
      }} options={creatableEntries.map((entry, i) => ({ value: String(i), label: entry.literal ? entry.label : text(entry.label) }))}>
        {say(tr('toolbar.addNodePrompt', '+ Add node'))}</Select>
    </div>
    <div className="network-bar-group">
      <ToolGroup>
        <IconButton icon="undo" label={tr('toolbar.undo', 'Undo')} disabled={!state?.undo} onClick={() => session!.history(false)} />
        <IconButton icon="redo" label={tr('toolbar.redo', 'Redo')} disabled={!state?.redo} onClick={() => session!.history(true)} />
      </ToolGroup>
      <ToolGroup>
        {/* React Flow's own delete path, so the same rules as the Delete key apply. 走 RF 的刪除，與 Delete 鍵同一套規則。 */}
        <IconButton icon="delete" label={tr('selection.delete', 'Delete selected')} disabled={!nodes.length && !edges.length}
          onClick={() => void flow.deleteElements({ nodes, edges })} />
        <IconButton icon="fitSelection" label={tr('selection.fit', 'Frame selected')} disabled={!nodes.length}
          onClick={() => void flow.fitView({ nodes: nodes.map(node => ({ id: node.id })), duration: 333, padding: .2, maxZoom: 1 })} />
      </ToolGroup>
      <ToolGroup>
        <IconButton icon="boxSelect" label={tr('toolbar.boxSelect', 'Box select (drag selects instead of panning)')}
          pressed={prefs.boxSelect} onClick={() => prefs.set({ boxSelect: !prefs.boxSelect })} />
      </ToolGroup>
      {/* Canvas preferences; icons later (human 2026-10-09). 畫布偏好，之後換成圖示（人類）。 */}
      <ToolGroup>
        <label className="check"><input type="checkbox" checked={prefs.bodyDrag} onChange={event => prefs.set({ bodyDrag: event.target.checked })} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
        <label className="check"><input type="checkbox" checked={prefs.snap} onChange={event => prefs.set({ snap: event.target.checked })} />{say(tr('toolbar.snap', 'Snap'))}</label>
      </ToolGroup>
      <ToolGroup><button type="button" onClick={onGlsl}>{say(tr('toolbar.glsl', 'GLSL'))}</button></ToolGroup>
    </div>
  </div>;
}

const offline = ['offline', 'uncertain'];
const recoveryHelp = tr('status.recoveryHelp', 'On the computer running TD, check that TD is still open (restore its window if minimized), global cooking is on, and TD is not busy with a long task; on a remote device, check the network. After TD restarts, open the editor again from the Grape OP.');

/** The foot bar: every notice of the editor (human 2026-10-09). The menu, the sync state, the latest message
 * (its history above it), what to do when TD is away, full screen. 底列：編輯器所有的提示（人類）。功能表、同步狀態、
 * 最新訊息（點開往上看歷史）、TD 不在時能做的事、全螢幕。 */
export function FootBar({ session, waiting, onDownload }: { session: EditorSession | null; waiting: Message | string; onDownload(): void }) {
  const state = useEditorState(session), fullscreen = useFullscreen();
  const log = useSyncExternalStore(session?.log.subscribe ?? noSubscribe, session?.log.entries ?? (() => noLog));
  const [history, setHistory] = useState<HTMLElement | null>(null);
  const sync = !state ? tr('status.noGraph', 'No graph open') : state.phase === 'sending' ? tr('status.sending', 'Sending to TD')
    : state.dirty ? tr('status.unsent', 'Changes not yet sent to TD') : tr('status.synced', 'Synced with TD');
  const message = state ? state.message : waiting, full = say(message), first = full.split('\n')[0];
  return <footer className={'foot-bar' + (state ? ` ${state.phase} ${state.level}` : '')} role="status">
    <MenuButton icon="menu" label={tr('foot.menu', 'Editor menu')} items={[
      { key: 'reload', label: say(tr('foot.reloadPage', 'Reload editor page')), select: () => location.reload() },
      { key: 'reloadTd', label: say(tr('foot.reloadApplied', 'Reload applied graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'reset', label: say(tr('foot.resetSettings', 'Reset browser settings…')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'import', label: say(tr('action.importGraph', 'Import graph')), disabled: true, title: say(notYet), divider: true, select: () => {} },
      { key: 'export', label: say(tr('action.exportGraph', 'Export graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'draft', label: say(tr('toolbar.downloadDraft', 'Download draft')), disabled: !session, select: onDownload },
      { key: 'save', label: say(tr('toolbar.saveProject', 'Save TD project')), disabled: !session || state?.phase === 'sending', divider: true, select: () => void session?.save() },
      { key: 'apply', label: say(tr('action.applyShader', 'Apply Shader')), disabled: !canApply(state), select: () => void session?.flush() },
    ]} />
    <span className="foot-sync">{say(state ? tr('status.line', '{state} · revision {revision}', { state: sync, revision: state.revision }) : sync)}</span>
    {/* The latest message; its whole text (e.g. TD's compile log) on hover, the history on click (Q35).
        最新訊息；完整內容（例如 TD 的編譯紀錄）在提示裡，點開看歷史。 */}
    <button type="button" className="foot-message" title={full === first ? undefined : full} aria-haspopup="dialog" aria-expanded={!!history}
      disabled={!session} onClick={event => setHistory(history ? null : event.currentTarget)}>{first}{full === first ? '' : ' …'}</button>
    {session && state && offline.includes(state.phase) && <button type="button" onClick={() => void session.check()}>{say(tr('status.retry', 'Retry connection'))}</button>}
    {session && state?.phase === 'offline' && <details className="recovery-help"><summary>{say(tr('status.howToRecover', 'How to recover'))}</summary>
      <p>{say(recoveryHelp)}</p></details>}
    <span className="spacer" />
    <IconButton icon="fullscreen" label={tr('foot.fullscreen', 'Full screen')} pressed={fullscreen}
      onClick={() => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen())} />
    {history && <LogHistory anchor={history} entries={log} onClose={() => setHistory(null)} />}
  </footer>;
}

// The browser's own full screen (legacy foot bar, bottom-right). 瀏覽器自己的全螢幕（舊產品底列右下）。
function useFullscreen() {
  return useSyncExternalStore(listener => { document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener); },
    () => !!document.fullscreenElement);
}

const HISTORY = 100; // tentative (human 2026-10-09: "within some number of past entries"). 暫定筆數。
/** The recent reports, opening upward from the foot bar, newest at the bottom, scrollable (human 2026-10-09).
 * 最近的回報紀錄，從底列往上開，最新的在最下面，可捲動（人類）。 */
function LogHistory({ anchor, entries, onClose }: { anchor: HTMLElement; entries: readonly Report[]; onClose(): void }) {
  const box = useRef<HTMLDivElement>(null), [place, setPlace] = useState({ left: 0, bottom: 0 });
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    setPlace({ left: Math.max(8, Math.min(rect.left, innerWidth - (box.current?.offsetWidth ?? 0) - 8)), bottom: innerHeight - rect.top + 4 });
  }, [anchor]);
  useLayoutEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [entries]);
  useEffect(() => {
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    addEventListener('pointerdown', away, true); addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', away, true); removeEventListener('keydown', key); };
  }, [anchor, onClose]);
  const shown = entries.slice(-HISTORY);
  return <div ref={box} className="log-history" role="dialog" aria-label={say(tr('foot.history', 'Message history'))} style={place}>
    {shown.length ? shown.map((entry, i) => <div key={i} className={'log-entry ' + entry.level}>
      <time>{new Date(entry.time).toLocaleTimeString()}</time><span>{say(entry.message)}</span></div>)
      : <p className="hint">{say(tr('foot.historyEmpty', 'No messages yet.'))}</p>}
  </div>;
}

