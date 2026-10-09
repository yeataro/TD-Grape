import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession, EditorState } from './editor';
import { BrandMark } from './icons';
import { IconButton, MenuButton, Placeholder, Popover, PopoverButton, Segmented, Select, ToolGroup, notYet } from './controls';
import { appearance, appearanceSubscribe, currentMode, currentPorts, currentSize, currentStyle, hasMode, modes, portStyles, setMode, setPorts, setSize, setStyle, sizes, styles } from './appearance';
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
    <IconButton icon="leftPanel" label={tr('layout.leftZone', 'Left panels')} expanded={layout.left.open} onClick={() => layout.toggleZone('left')} />
    {children}
    <span className="spacer" />
    <IconButton icon="titleBar" label={tr('layout.titleBar', 'Title bar')} expanded={layout.titleBar} onClick={layout.toggleTitleBar} />
    <Placeholder label={tr('layout.menu', 'Layout')} />
    {/* No panel lives on the right yet (the Parameter panel comes later): a placeholder until then.
        右邊還沒有面板（參數面板之後才有），先是佔位。 */}
    <IconButton icon="rightPanel" label={tr('layout.rightZone', 'Right panels')} expanded={!rightEmpty && layout.right.open}
      disabled={rightEmpty} title={rightEmpty ? tr('layout.rightEmpty', 'No panels here yet') : undefined} onClick={() => layout.toggleZone('right')} />
  </div>;
}

export type CanvasPrefs = { bodyDrag: boolean; snap: boolean; boxSelect: boolean; set(patch: Partial<Omit<CanvasPrefs, 'set'>>): void };

/** The network's own toolbar, floating over its top edge (human 2026-10-09): stages on the left; on the right
 * history, the selection's actions (until the floating selection toolbar exists), box select, canvas
 * preferences and the GLSL panel. Only what exists is shown. 網路區自己的功能列，浮在上緣：左邊 Stage；右邊歷史、
 * 選取的動作（浮動選取工具列做好之前放這裡）、框選、畫布偏好、GLSL 面板。只放現在有的。 */
export function NetworkBar({ session, prefs, onGlsl }: {
  session: EditorSession | null; prefs: CanvasPrefs; onGlsl(): void;
}) {
  const state = useEditorState(session), flow = useReactFlow();
  const nodes = state?.projection.nodes.filter(node => node.selected) ?? [], edges = state?.projection.edges.filter(edge => edge.selected) ?? [];
  const stages = session?.stageNames() ?? [];
  return <div className="network-bar">
    {/* The stages float on the canvas by themselves, with no toolbar box (legacy; human 2026-10-09).
        Stage 切換直接浮在畫布上，沒有工具列外框（照舊產品，人類）。 */}
    <div className="network-bar-stages">
      {/* Only the stages this graph has (human 2026-10-09); only Pixel can be edited so far.
          只顯示這張圖有的 Stage（人類）；目前只能編輯 Pixel。 */}
      {stages.length > 0 && <Segmented label={tr('stage.label', 'Stage')} value="pixel" onChange={() => {}}
        options={stages.map(stage => ({ value: stage, label: stage === 'pixel' ? 'Pixel' : stage === 'vertex' ? 'Vertex' : stage,
          disabled: stage !== 'pixel', title: stage === 'pixel' ? undefined : notYet }))} />}
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
        <IconButton icon="boxSelect" label={tr('toolbar.boxSelect', 'Box select (drag selects instead of panning)')} mode
          pressed={prefs.boxSelect} onClick={() => prefs.set({ boxSelect: !prefs.boxSelect })} />
      </ToolGroup>
      {/* Snap is a tool toggle with a magnet icon (Blender; human 2026-10-09). Body drag moved to the settings panel (Q64).
          Snap 是磁鐵圖示的工具開關（Blender）；Body 拖曳搬到設定面板（Q64）。 */}
      <ToolGroup>
        <IconButton icon="snap" label={tr('toolbar.snap', 'Snap')} pressed={prefs.snap} onClick={() => prefs.set({ snap: !prefs.snap })} />
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
export function FootBar({ session, waiting, onDownload, prefs }: { session: EditorSession | null; waiting: Message | string; onDownload(): void; prefs: CanvasPrefs }) {
  const state = useEditorState(session), fullscreen = useFullscreen();
  const log = useSyncExternalStore(session?.log.subscribe ?? noSubscribe, session?.log.entries ?? (() => noLog));
  const [history, setHistory] = useState<HTMLElement | null>(null);
  const states = [tr('status.sending', 'Sending to TD'), tr('status.unsent', 'Changes not yet sent to TD'), tr('status.synced', 'Synced with TD')];
  const sync = !state ? tr('status.noGraph', 'No graph open') : state.phase === 'sending' ? states[0]! : state.dirty ? states[1]! : states[2]!;
  const line = (text: typeof sync, revision: number | string) => say(tr('status.line', '{state} · revision {revision}', { state: text, revision }));
  // The sync state keeps the width of its longest wording (every state, at least five revision digits, plus some room), so the message
  // after it never jumps (human 2026-10-09). Invisible copies size the box; it follows the language by itself.
  // 同步狀態保持最長那句的寬度（每一種狀態、至少五位數版本號，再多留一點空間），後面的訊息就不會跳（人類）。看不見的副本撐出寬度，換語言也自動跟上。
  const digits = '0'.repeat(Math.max(5, String(state?.revision ?? '').length));
  const sizes = [say(tr('status.noGraph', 'No graph open')), ...states.map(text => line(text, digits))];
  const message = state ? state.message : waiting, full = say(message), first = full.split('\n')[0];
  return <footer className={'foot-bar' + (state ? ` ${state.phase} ${state.level}` : '')} role="status">
    <MenuButton icon="menu" narrow label={tr('foot.menu', 'Editor menu')} items={[
      { key: 'reload', label: say(tr('foot.reloadPage', 'Reload editor page')), select: () => location.reload() },
      { key: 'reloadTd', label: say(tr('foot.reloadApplied', 'Reload applied graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'reset', label: say(tr('foot.resetSettings', 'Reset browser settings…')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'import', label: say(tr('action.importGraph', 'Import graph')), disabled: true, title: say(notYet), divider: true, select: () => {} },
      { key: 'export', label: say(tr('action.exportGraph', 'Export graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'draft', label: say(tr('toolbar.downloadDraft', 'Download draft')), disabled: !session, select: onDownload },
      { key: 'save', label: say(tr('toolbar.saveProject', 'Save TD project')), disabled: !session || state?.phase === 'sending', divider: true, select: () => void session?.save() },
      { key: 'apply', label: say(tr('action.applyShader', 'Apply Shader')), disabled: !canApply(state), select: () => void session?.flush() },
    ]} />
    <span className="foot-sync">{sizes.map(text => <span key={text} className="foot-sync-size" aria-hidden="true">{text}</span>)}
      <span>{state ? line(sync, state.revision) : say(sync)}</span></span>
    {/* The latest message; its whole text (e.g. TD's compile log) on hover, the history on click (Q35).
        最新訊息；完整內容（例如 TD 的編譯紀錄）在提示裡，點開看歷史。 */}
    <button type="button" className="foot-message" title={full === first ? undefined : full} aria-haspopup="dialog" aria-expanded={!!history}
      disabled={!session} onClick={event => setHistory(history ? null : event.currentTarget)}>{first}{full === first ? '' : ' …'}</button>
    {session && state && offline.includes(state.phase) && <button type="button" onClick={() => void session.check()}>{say(tr('status.retry', 'Retry connection'))}</button>}
    {session && state?.phase === 'offline' && <details className="recovery-help"><summary>{say(tr('status.howToRecover', 'How to recover'))}</summary>
      <p>{say(recoveryHelp)}</p></details>}
    <span className="spacer" />
    {/* Settings of how editing behaves (legacy gear). Body drag is a real setting here (Q64). 編輯行為的設定（舊產品齒輪）。 */}
    <PopoverButton icon="settings" label={tr('foot.settings', 'Settings')} className="settings-panel">
      <label className="check"><input type="checkbox" checked={prefs.bodyDrag} onChange={event => prefs.set({ bodyDrag: event.target.checked })} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
    </PopoverButton>
    <AppearancePanels />
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
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [entries]);
  const shown = entries.slice(-HISTORY);
  return <Popover anchor={anchor} label={tr('foot.history', 'Message history')} className="log-history" onClose={onClose}>
    <div ref={list} className="log-list">{shown.length ? shown.map((entry, i) => <div key={i} className={'log-entry ' + entry.level}>
      <time>{new Date(entry.time).toLocaleTimeString()}</time><span>{say(entry.message)}</span></div>)
      : <p className="hint">{say(tr('foot.historyEmpty', 'No messages yet.'))}</p>}</div>
  </Popover>;
}

// The appearance and size panels of the foot bar (legacy moon and "AA"; floating-panels.md 32, 33). Both only change
// CSS (human 2026-10-09). The sliders (brightness, overall scale) are placeholders: they touch more (canvas coordinates,
// what the brightness leaves alone) and are discussed first.
// 底列的外觀與大小面板（舊產品的月亮與 AA）；都只換 CSS（人類）。拉桿（亮暗、整體縮放）先佔位：牽涉較多，先討論。
// As the legacy panels: no title, the slider shows only − and + at its ends (human 2026-10-09: people see what it does);
// its name is the tooltip. 照舊產品：沒有標題，拉桿兩端只有 − 與 ＋（人類：一看就知道）；名稱放在提示裡。
const SliderPlaceholder = ({ label }: { label: Message }) =>
  <div className="slider-placeholder" role="group" aria-label={say(label)} aria-disabled="true" title={say(label) + ' · ' + say(notYet)}>
    <span aria-hidden="true">−</span><span className="slider-track" /><span aria-hidden="true">+</span></div>;
// A titled row: the name centred in the left half, its control filling the right half (human 2026-10-09).
// 有名稱的一行：名稱在左半邊置中，控制項填滿右半邊（人類）。
const SettingsRow = ({ label, children }: { label: Message; children: ReactNode }) =>
  <div className="settings-row"><span>{say(label)}</span>{children}</div>;
function AppearancePanels() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  const style = currentStyle();
  return <>
    <PopoverButton icon="theme" label={tr('appearance.title', 'Appearance')} className="settings-panel">
      <SettingsRow label={tr('appearance.title', 'Appearance')}>
        <Select label={tr('appearance.title', 'Appearance')} value={style} onChange={setStyle}
          options={styles.map(item => ({ value: item.value, label: say(item.label) }))} /></SettingsRow>
      {/* TD has no light version yet. TD 還沒有淺色版。 */}
      <Segmented label={tr('appearance.mode', 'Dark or light')} value={currentMode()} onChange={setMode}
        options={modes.map(item => ({ ...item, disabled: !hasMode(style, item.value), title: hasMode(style, item.value) ? undefined : notYet }))} />
      <SliderPlaceholder label={tr('appearance.brightness', 'Brightness')} />
      {/* Under A/B test until the tuning phase (Q64). A／B 測試，調整期決定。 */}
      <Segmented label={tr('appearance.ports', 'Port style')} value={currentPorts()} options={portStyles} onChange={setPorts} />
    </PopoverButton>
    <PopoverButton icon="textSize" label={tr('appearance.sizeTitle', 'Language and size')} className="settings-panel">
      <SettingsRow label={tr('action.language', 'Language')}>
        <Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
          options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} /></SettingsRow>
      <Segmented label={tr('appearance.sizeTitle', 'Language and size')} value={currentSize()} options={sizes} onChange={setSize} />
      <SliderPlaceholder label={tr('appearance.scale', 'Interface scale')} />
    </PopoverButton>
  </>;
}

