import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession, EditorState } from './editor';
import { BrandMark, Icon, type IconName } from './icons';
import type { MenuItem } from './DropdownMenu';
import { IconButton, MenuButton, Placeholder, Popover, PopoverButton, Segmented, Select, ToolGroup, notYet } from './controls';
import { appearance, appearanceSubscribe, componentTintOn, setComponentTint, currentMode, currentPorts, currentSize, currentStyle, hasMode, modes, portStyles, setMode, setPorts, setSize, setStyle, sizes, styles } from './appearance';
import { LayoutMenu, type Layout } from './layout';
import type { Report } from './reports';
import { language, setLanguage, say, tr, type Message } from './text';
import { frameNodes } from './viewport';

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

/** How many of a bar's parts to fold away so the rest fits (Refactor.69, human 2026-10-10). Parts are marked `data-fold`
 * (hidden from that count on; 1 folds first) or `data-appear` (shown from that count on: a shorter stand-in for what folded);
 * each keeps its own size, so the bar measures them and takes the fewest folds that fit. A hidden part counts with the width
 * it had when it last showed; a part marked `data-shrink` gives way first, down to its minimum (69.1). Unfolding asks for a
 * little room to spare, so the bar never flickers between two counts.
 * 一列要收起幾個部分才放得下（R.69，人類 10-10）。部分標 data-fold（從那個數起收起，1 先收）或 data-appear（從那個數起出現：收起的
 * 東西的簡短替身）；每個部分大小固定，所以量它們、取放得下的最少收起數。看不見的部分用它最後一次顯示時的寬度算；標 data-shrink 的
 * 部分先讓、讓到最小寬度（69.1）。展開時要多留一點空間，所以不會在兩個數之間閃。 */
export const SPARE = 8;
/** `measured` hears, after each fit, how many parts folded and the width the bar's content takes now with every part shown
 * at its own size (its natural width when nothing had to give way). measured：每次量完，聽到收了幾個，以及每個部分照自己的
 * 寬度全部顯示時要多寬（沒有東西需要讓位時，就是它的自然寬度）。 */
function useFolding(bar: RefObject<HTMLElement | null>, measured?: (count: number, full: number) => void): number {
  const [folded, setFolded] = useState(0), widths = useRef(new Map<Element, number>()), now = useRef(0);
  now.current = folded;
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const showing = (part: Element) => getComputedStyle(part).display !== 'none';
    // A popover opened from the bar floats over it and takes no room. 從列上打開的浮動面板浮在上面、不佔位置。
    const inFlow = (child: Element) => !['absolute', 'fixed'].includes(getComputedStyle(child).position);
    const outer = (part: Element) => {
      const style = getComputedStyle(part), width = (part as HTMLElement).dataset.shrink !== undefined ? parseFloat(style.minWidth) || 0 : part.getBoundingClientRect().width;
      return width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    };
    const gap = (part: Element) => parseFloat(getComputedStyle(part.parentElement!).columnGap) || 0;
    const order = (part: HTMLElement, name: 'fold' | 'appear') => Number(part.dataset[name] ?? 0);
    const shownAt = (part: HTMLElement, count: number) => order(part, 'appear') <= count && (!order(part, 'fold') || order(part, 'fold') > count);
    const fit = () => {
      const parts = [...element.querySelectorAll<HTMLElement>('[data-fold], [data-appear]')];
      for (const part of parts) if (showing(part)) widths.current.set(part, outer(part) + gap(part));
      // What the bar needs apart from its parts; then each count adds the parts it shows. 除了這些部分之外需要的寬；每個數再加上它顯示的部分。
      const children = [...element.children].filter(child => showing(child) && inFlow(child) && !child.classList.contains('spacer'));
      const style = getComputedStyle(element);
      let fixed = children.reduce((sum, child) => sum + outer(child), 0) + gap(children[0]!) * (children.length - 1)
        + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      for (const part of parts) if (showing(part)) fixed -= widths.current.get(part) ?? 0;
      const need = (count: number) => parts.reduce((sum, part) => sum + (shownAt(part, count) ? widths.current.get(part) ?? 0 : 0), fixed);
      const levels = Math.max(0, ...parts.map(part => Math.max(order(part, 'fold'), order(part, 'appear'))));
      let count = 0;
      while (count < levels && need(count) > element.clientWidth + .5 - (count < now.current ? SPARE : 0)) count++;
      setFolded(count);
      if (measured) {
        const full = children.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap(children[0]!) * (children.length - 1)
          + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parts.reduce((sum, part) => sum + (showing(part) ? 0 : widths.current.get(part) ?? 0), 0);
        measured(count, full);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  });
  return folded;
}

/** The title bar, as the legacy editor (human 2026-10-09): mark, name, tagline, version, About; then the common
 * actions. As it narrows, parts fold away in the human's order (2026-10-10): About, the version, the tagline, the language
 * (also in the foot bar's "AA"), import and export, Save, Apply (all in the foot bar's menu); the mark and the name never.
 * 標題列照舊產品：圖標、名稱、副標題、版本、About；右邊是常用動作。變窄時照人類的順序收起：About、版號、副標題、語言（底列 AA 也有）、
 * 匯入與匯出、儲存、套用（都在底列選單裡）；圖標與名稱永遠不收。 */
export function TitleBar({ session, version }: { session: EditorSession | null; version: string }) {
  const state = useEditorState(session), bar = useRef<HTMLElement>(null), folded = useFolding(bar);
  const fold = (order: number, className = '') => ({ 'data-fold': order, className: (className + (folded >= order ? ' folded' : '')).trim() || undefined });
  return <header className="title-bar" ref={bar}>
    <BrandMark /><strong className="brand-name">TD-Grape</strong>
    <small className="brand-line">
      <span {...fold(3)}>{say(tr('editor.tagline', 'A Shader Editor for TouchDesigner'))}</span>
      <span {...fold(2)}><span aria-hidden="true">·</span>{version}</span>
      <span {...fold(1)}><span aria-hidden="true">·</span><Placeholder label={tr('action.about', 'About')} className="link-button" /></span></small>
    <span className="spacer" />
    {/* Switches in place, keeping the work and its history (legacy). Same key as the legacy editor.
        當場切換，作品與歷史都保留（照舊產品）。鍵與舊產品相同。 */}
    <span {...fold(4)}><Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
      options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} /></span>
    <span {...fold(5)}><Placeholder label={tr('action.importGraph', 'Import graph')} /></span>
    <span {...fold(5)}><Placeholder label={tr('action.exportGraph', 'Export graph')} /></span>
    <button type="button" {...fold(6)} aria-disabled={!session || state?.phase === 'sending' || undefined}
      onClick={() => { if (session && state?.phase !== 'sending') void session.save(); }}>{say(tr('toolbar.saveProject', 'Save TD project'))}</button>
    <button type="button" {...fold(7, 'primary')} aria-disabled={!canApply(state) || undefined}
      onClick={() => { if (session && canApply(state)) void session.flush(); }}>{say(tr('action.applyShader', 'Apply Shader'))}</button>
  </header>;
}

/** The location bar, over the network only (human 2026-10-09; the legacy one spanned the whole width): the side
 * toggles at its ends, what is being edited in between. It belongs to the canvas, which is never closed, so they are
 * always there (human 2026-10-10). A side with nothing to show greys its toggle out.
 * 網址列只在網路區上方（人類；舊產品跨整個寬度）：兩端是左右開關，中間是正在編輯的東西。它跟著永遠不會關的畫布，所以開關一直都在
 * （人類 10-10）。那一側沒東西可顯示時開關變灰。 */
export function LocationBar({ layout, file, target, onCramped, onWidth }: {
  layout: Layout; file: ReactNode; target: ReactNode;
  /** Over the canvas: told when the file or the path would be cut (69.5). 在畫布上方時：檔名或路徑會被截斷時通知（69.5）。 */
  onCramped?(): void;
  /** In its own row: told the width its whole content takes (69.5). 獨立一列時：告知全部內容要多寬（69.5）。 */
  onWidth?(width: number): void;
}) {
  // As it narrows (69.4, human 2026-10-10): the file and then the Grape OP path give way to an ellipsis, and fold away
  // altogether once even that does not fit (a part shrunk to nothing still kept its gaps and padding); the toggles and the
  // Layout menu never. 變窄時（人類 10-10）：檔名、再來 Grape OP 路徑先縮成省略號，連那樣都放不下就整個收起（縮到 0 的東西還佔著間距與內距）；
  // 開關與 Layout 選單永遠不收。
  const bar = useRef<HTMLDivElement>(null), folded = useFolding(bar, (count, full) => {
    // How much the file and the path miss of their whole text (nothing when they show whole). 檔名與路徑比完整文字少了多少（完整顯示時為 0）。
    const missing = [...bar.current!.querySelectorAll<HTMLElement>('.location-part')]
      .reduce((sum, part) => sum + (getComputedStyle(part).display === 'none' ? 0 : Math.max(0, (part.firstElementChild?.scrollWidth ?? 0) - part.clientWidth)), 0);
    if (count > 0 || missing > 1) onCramped?.();
    onWidth?.(full + missing);
  });
  const fold = (order: number) => ({ 'data-fold': order, 'data-shrink': '', className: 'location-part' + (folded >= order ? ' folded' : '') });
  const toggle = (side: 'left' | 'right') => {
    const empty = !layout.hasPanels(side);
    return <IconButton icon={side === 'left' ? 'leftPanel' : 'rightPanel'} label={side === 'left' ? tr('layout.leftZone', 'Left panels') : tr('layout.rightZone', 'Right panels')}
      expanded={!empty && !layout.closed[side]} disabled={empty} title={empty ? tr('layout.sideEmpty', 'No panels on this side') : undefined}
      onClick={() => layout.toggleSide(side)} />;
  };
  return <div className="location-bar" ref={bar}>
    {toggle('left')}
    {file && <span {...fold(1)}>{file}</span>}
    <span {...fold(2)}>{target}</span>
    <span className="spacer" />
    <IconButton icon="titleBar" label={tr('layout.titleBar', 'Title bar')} expanded={layout.titleBar} onClick={layout.toggleTitleBar} />
    <LayoutMenu layout={layout} />
    {toggle('right')}
  </div>;
}

export type CanvasPrefs = { bodyDrag: boolean; snap: boolean; boxSelect: boolean; damping: boolean; frameGlide: boolean; errorNodes: boolean; set(patch: Partial<Omit<CanvasPrefs, 'set'>>): void };

/** The network's own toolbar, floating over its top edge (human 2026-10-09): stages on the left; on the right
 * history, the selection's actions (until the floating selection toolbar exists), box select, canvas
 * preferences and the GLSL panel. Only what exists is shown. 網路區自己的功能列，浮在上緣：左邊 Stage；右邊歷史、
 * 選取的動作（浮動選取工具列做好之前放這裡）、框選、畫布偏好、GLSL 面板。只放現在有的。
 * As it narrows, whole groups move into a "more" menu, as the legacy toolbar did (legacy selection_ui.js:463): GLSL first,
 * then Snap, the selection's actions, box select, and Undo / Redo last (human 2026-10-10); the stages never. In the menu a
 * tool is the same action, a toggle shown ticked. 變窄時整組搬進「更多」選單，照舊產品：先 GLSL，再 Snap、選取的動作、框選，
 * Undo／Redo 最後（人類 10-10）；Stage 永遠不收。選單裡是同樣的動作，開關會打勾。 */
type Tool = { key: string; icon?: IconName; label: Message; hint?: Message; disabled?: boolean; pressed?: boolean; mode?: boolean; danger?: boolean; select(): void };
export function NetworkBar({ session, prefs, onGlsl }: {
  session: EditorSession | null; prefs: CanvasPrefs; onGlsl(): void;
}) {
  const state = useEditorState(session), flow = useReactFlow(), bar = useRef<HTMLDivElement>(null), folded = useFolding(bar);
  const nodes = state?.projection.nodes.filter(node => node.selected) ?? [], edges = state?.projection.edges.filter(edge => edge.selected) ?? [];
  const stages = session?.stageNames() ?? [];
  // Left to right as shown; `order` is when the group folds (1 first). 由左到右照顯示；order＝這組第幾個收（1 先收）。
  const groups: { order: number; tools: Tool[] }[] = [
    { order: 5, tools: [
      { key: 'undo', icon: 'undo', label: tr('toolbar.undo', 'Undo'), disabled: !state?.undo, select: () => session!.history(false) },
      { key: 'redo', icon: 'redo', label: tr('toolbar.redo', 'Redo'), disabled: !state?.redo, select: () => session!.history(true) }] },
    // React Flow's own delete path, so the same rules as the Delete key apply. 走 RF 的刪除，與 Delete 鍵同一套規則。
    { order: 3, tools: [
      { key: 'delete', icon: 'delete', danger: true, label: tr('selection.delete', 'Delete selected'), disabled: !nodes.length && !edges.length,
        select: () => void flow.deleteElements({ nodes, edges }) },
      { key: 'frame', icon: 'fitSelection', label: tr('selection.fit', 'Frame selected'), disabled: !nodes.length, select: () => frameNodes(flow, nodes.map(node => node.id)) }] },
    { order: 4, tools: [{ key: 'boxSelect', icon: 'boxSelect', mode: true, label: tr('toolbar.boxSelectName', 'Box select'),
      hint: tr('toolbar.boxSelect', 'Box select (drag selects instead of panning)'),
      pressed: prefs.boxSelect, select: () => prefs.set({ boxSelect: !prefs.boxSelect }) }] },
    // Snap is a tool toggle with a magnet icon (Blender; human 2026-10-09). Body drag moved to the settings panel (Q64).
    // Snap 是磁鐵圖示的工具開關（Blender）；Body 拖曳搬到設定面板（Q64）。
    { order: 2, tools: [{ key: 'snap', icon: 'snap', label: tr('toolbar.snap', 'Snap'), pressed: prefs.snap, select: () => prefs.set({ snap: !prefs.snap }) }] },
    { order: 1, tools: [{ key: 'glsl', label: tr('toolbar.glsl', 'GLSL'), select: onGlsl }] },
  ];
  const fold = (order: number) => ({ 'data-fold': order, className: 'tool-group' + (folded >= order ? ' folded' : '') });
  const more: MenuItem[] = groups.filter(group => folded >= group.order).flatMap((group, index) => group.tools.map((tool, at) => ({
    key: tool.key, divider: index > 0 && at === 0, disabled: tool.disabled, danger: tool.danger,
    ...(tool.pressed === undefined ? {} : { checkbox: true, checked: tool.pressed }),
    // A toggle shows its tick instead of its icon (legacy). 開關用勾勾代替圖示（照舊產品）。
    title: tool.hint && say(tool.hint), label: <>{tool.icon && tool.pressed === undefined && <Icon name={tool.icon} />}{say(tool.label)}</>, select: tool.select })));
  return <div className="network-bar" ref={bar}>
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
      {groups.map(group => <div key={group.order} {...fold(group.order)}>{group.tools.map(tool => tool.icon
        ? <IconButton key={tool.key} icon={tool.icon} label={tool.hint ?? tool.label} disabled={tool.disabled} pressed={tool.pressed} mode={tool.mode} danger={tool.danger} onClick={tool.select} />
        : <button key={tool.key} type="button" onClick={tool.select}>{say(tool.label)}</button>)}</div>)}
      <div data-appear={1} className={'tool-group tool-more' + (folded >= 1 ? ' appeared' : '')}>
        <MenuButton icon="more" label={tr('toolbar.more', 'More tools')} items={more} /></div>
    </div>
  </div>;
}

const away = ['offline', 'uncertain'], alarm = ['offline', 'uncertain', 'conflict', 'error'];
const recoveryHelp = tr('status.recoveryHelp', 'On the computer running TD, check that TD is still open (restore its window if minimized), global cooking is on, and TD is not busy with a long task; on a remote device, check the network. After TD restarts, open the editor again from the Grape OP.');

/** The sync light (Refactor.70, human 2026-10-10): our grape is the light. Its colour is the state — the grape's own purple when
 * the graph is in TD, yellow for changes not yet sent, red when TD cannot be reached, answered unclearly, conflicts or stopped,
 * grey with no graph; it ripples (the waiting animation) while something is on its way: sending, or checking the connection.
 * 同步燈號（人類 10-10）：我們的葡萄就是燈號。顏色是狀態——圖已在 TD 時是葡萄原本的紫、有修改還沒送出是黃、連不上 TD／回應不確定／
 * 版本衝突／停止時是紅、沒有圖是灰；有東西在路上（送出中、檢查連線中）時輪流亮（等待動畫）。 */
type Tone = 'normal' | 'unsent' | 'alarm' | 'none';
const lightOf = (state: EditorState | null): { tone: Tone; busy: boolean } => !state ? { tone: 'none', busy: false }
  : { tone: alarm.includes(state.phase) ? 'alarm' : state.dirty ? 'unsent' : 'normal', busy: state.phase === 'sending' || !!state.checking };

/** The foot bar: every notice of the editor (human 2026-10-09). The menu, the sync light and revision, the latest message,
 * settings, full screen. The light and the message open one status panel: the state now, what to do when TD is away, the
 * history (Refactor.70). 底列：編輯器所有的提示（人類）。功能表、同步燈號與版號、最新訊息、設定、全螢幕。燈號與訊息打開同一個狀態面板：
 * 現在的狀態、TD 不在時怎麼辦、歷史（R.70）。 */
export function FootBar({ session, waiting, onDownload, onReset, prefs, onAppearance }: {
  session: EditorSession | null; waiting: Message | string; onDownload(): void; onReset(): void; prefs: CanvasPrefs; onAppearance?(): void;
}) {
  const state = useEditorState(session), fullscreen = useFullscreen(), bar = useRef<HTMLElement>(null), folded = useFolding(bar);
  // As it narrows (human 2026-10-10): the latest message gives way first, down to its "…"; the icons basically stay, but if
  // they must, they fold from the left; the sync light, which matters more, folds after them; the ⋮ menu never.
  // 變窄時（人類 10-10）：最新訊息先讓，讓到剩「…」；圖示原則上留著，非收不可時從左邊收；比它們重要的同步燈號在它們之後才收；⋮ 選單永遠不收。
  const fold = (order: number, className = '') => ({ 'data-fold': order, className: (className + (folded >= order ? ' folded' : '')).trim() || undefined });
  const log = useSyncExternalStore(session?.log.subscribe ?? noSubscribe, session?.log.entries ?? (() => noLog));
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const open = (event: { currentTarget: HTMLElement }) => setPanel(panel ? null : event.currentTarget);
  const sync = !state ? tr('status.noGraph', 'No graph open') : state.phase === 'sending' ? tr('status.sending', 'Sending to TD')
    : state.dirty ? tr('status.unsent', 'Changes not yet sent to TD') : tr('status.synced', 'Synced with TD');
  const now = state ? say(tr('status.line', '{state} · revision {revision}', { state: sync, revision: state.revision })) : say(sync);
  const { tone, busy } = lightOf(state);
  const message = state ? state.message : waiting, full = say(message), first = full.split('\n')[0];
  return <footer ref={bar} className={'foot-bar' + (state ? ` ${state.phase} ${state.level}` : '')} role="status">
    <MenuButton icon="menu" narrow label={tr('foot.menu', 'Editor menu')} items={[
      { key: 'reload', label: say(tr('foot.reloadPage', 'Reload editor page')), select: () => location.reload() },
      { key: 'reloadTd', label: say(tr('foot.reloadApplied', 'Reload applied graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'reset', label: say(tr('foot.resetSettings', 'Reset browser settings…')), select: onReset },
      { key: 'import', label: say(tr('action.importGraph', 'Import graph')), disabled: true, title: say(notYet), divider: true, select: () => {} },
      { key: 'export', label: say(tr('action.exportGraph', 'Export graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'draft', label: say(tr('toolbar.downloadDraft', 'Download draft')), disabled: !session, select: onDownload },
      { key: 'save', label: say(tr('toolbar.saveProject', 'Save TD project')), disabled: !session || state?.phase === 'sending', divider: true, select: () => void session?.save() },
      { key: 'apply', label: say(tr('action.applyShader', 'Apply Shader')), disabled: !canApply(state), select: () => void session?.flush() },
    ]} />
    <button type="button" {...fold(5, 'sync-light tone-' + tone)} title={now} aria-label={now} aria-haspopup="dialog" aria-expanded={!!panel} onClick={open}>
      <BrandMark loading={busy} />{state?.revision ?? '–'}</button>
    {/* The latest message; its whole text (e.g. TD's compile log) on hover; the status panel on click (Q35).
        最新訊息；完整內容（例如 TD 的編譯紀錄）在提示裡；點開是狀態面板。 */}
    <button type="button" className="foot-message" data-shrink="" title={full === first ? undefined : full} aria-haspopup="dialog" aria-expanded={!!panel}
      disabled={!session} onClick={open}>{first}{full === first ? '' : ' …'}</button>
    <span className="spacer" />
    {/* Settings of how editing behaves (legacy gear). Body drag is a real setting here (Q64). 編輯行為的設定（舊產品齒輪）。 */}
    <span {...fold(1)}><PopoverButton icon="settings" label={tr('foot.settings', 'Settings')} className="settings-panel">
      <label className="check"><input type="checkbox" checked={prefs.bodyDrag} onChange={event => prefs.set({ bodyDrag: event.target.checked })} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
      {/* Trial (Refactor.58.2): the wheel glides; off gives the wheel back to React Flow. 試驗：滾輪平滑；關掉就還給 React Flow。 */}
      <label className="check"><input type="checkbox" checked={prefs.damping} onChange={event => prefs.set({ damping: event.target.checked })} />{say(tr('toolbar.damping', 'Canvas damping'))}</label>
      {/* Framing glides or jumps; times are fixed (legacy 150 / 333 ms; human: on/off only). 對準時滑動或直接跳；時間固定（人類：只要開關）。 */}
      <label className="check"><input type="checkbox" checked={prefs.frameGlide} onChange={event => prefs.set({ frameGlide: event.target.checked })} />{say(tr('toolbar.frameGlide', 'Frame transition (F)'))}</label>
      {/* Trial (Refactor.63.6, human 2026-10-10): outline the nodes that wrote a line TD reported, as the legacy editor did; only
          while the GLSL is the one that failed. 試驗：TD 回報的錯誤行是哪個節點寫的，就框起來（照舊產品）；只在 GLSL 就是失敗的那份時。 */}
      <label className="check"><input type="checkbox" checked={prefs.errorNodes} onChange={event => prefs.set({ errorNodes: event.target.checked })} />{say(tr('toolbar.errorNodes', 'Mark nodes on TD error lines (trial)'))}</label>
      <ComponentTint />
    </PopoverButton></span>
    <AppearancePanels onPanel={onAppearance} fold={fold} />
    <span {...fold(4)}><IconButton icon="fullscreen" label={tr('foot.fullscreen', 'Full screen')} pressed={fullscreen}
      onClick={() => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen())} /></span>
    {panel && <StatusPanel anchor={panel} state={state} now={now} tone={tone} entries={log} onRetry={() => void session?.check()} onClose={() => setPanel(null)} />}
  </footer>;
}

/** The status panel (Refactor.70): the state now in the light's colour; while TD is away, the automatic retry (its countdown
 * and Retry now, which was the countdown pie) and how to recover; then the history (Q35), the latest at the bottom.
 * 狀態面板（R.70）：現在的狀態（燈號的顏色）；TD 不在時，自動重試（倒數與「立即重試」，原本的倒數圓餅）與如何恢復；下面是歷史，最新的在最下面。 */
function StatusPanel({ anchor, state, now, tone, entries, onRetry, onClose }: {
  anchor: HTMLElement; state: EditorState | null; now: string; tone: Tone; entries: readonly Report[]; onRetry(): void; onClose(): void;
}) {
  const list = useRef<HTMLDivElement>(null), [, tick] = useState(0);
  useLayoutEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [entries]);
  // The countdown moves on by itself. 倒數自己往下走。
  useEffect(() => {
    if (state?.retryAt === undefined) return;
    const timer = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(timer);
  }, [state?.retryAt]);
  const seconds = state?.retryAt === undefined ? 0 : Math.ceil(Math.max(0, state.retryAt - Date.now()) / 1000);
  const shown = entries.slice(-HISTORY), reason = state && alarm.includes(state.phase) ? say(state.message).split('\n')[0] : '';
  return <Popover anchor={anchor} label={tr('foot.status', 'Status')} className="log-history status-panel" onClose={onClose}>
    <div className={'status-now tone-' + tone}>
      <strong>{now}</strong>
      {reason && <p>{reason}</p>}
      {state && away.includes(state.phase) && <div className="status-retry">
        <span>{say(state.checking ? tr('status.checking', 'Checking the connection…') : tr('status.retryIn', 'Trying again by itself in {seconds} s', { seconds }))}</span>
        <button type="button" disabled={!!state.checking} onClick={onRetry}>{say(tr('status.retry', 'Retry now'))}</button></div>}
      {state?.phase === 'offline' && <p className="status-help"><strong>{say(tr('status.howToRecover', 'How to recover'))}</strong> {say(recoveryHelp)}</p>}
    </div>
    <div ref={list} className="log-list">{shown.length ? shown.map((entry, i) => <div key={i} className={'log-entry ' + entry.level}>
      <time>{new Date(entry.time).toLocaleTimeString()}</time><span>{say(entry.message)}</span></div>)
      : <p className="hint">{say(tr('foot.historyEmpty', 'No messages yet.'))}</p>}</div>
  </Popover>;
}

// The browser's own full screen (legacy foot bar, bottom-right). 瀏覽器自己的全螢幕（舊產品底列右下）。
function useFullscreen() {
  return useSyncExternalStore(listener => { document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener); },
    () => !!document.fullscreenElement);
}

const HISTORY = 100; // tentative (human 2026-10-09: "within some number of past entries"). 暫定筆數。
/** The recent reports, opening upward from the foot bar, newest at the bottom, scrollable (human 2026-10-09).
 * 最近的回報紀錄，從底列往上開，最新的在最下面，可捲動（人類）。 */

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
// Component tint (Refactor.59; Q67): ports, labels and wires of one component take its colour. 分量染色：單一分量的接孔、標籤、接線用分量色。

function ComponentTint() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  return <label className="check"><input type="checkbox" checked={componentTintOn()} onChange={event => setComponentTint(event.target.checked)} />
    {say(tr('toolbar.componentTint', 'Component colours'))}</label>;
}

function AppearancePanels({ onPanel, fold }: { onPanel?(): void; fold(order: number): { 'data-fold': number; className?: string } }) {
  useSyncExternalStore(appearanceSubscribe, appearance);
  const style = currentStyle();
  return <>
    <span {...fold(2)}><PopoverButton icon="theme" label={tr('appearance.title', 'Appearance')} className="settings-panel">
      <SettingsRow label={tr('appearance.title', 'Appearance')}>
        <Select label={tr('appearance.title', 'Appearance')} value={style} onChange={setStyle}
          options={styles.map(item => ({ value: item.value, label: say(item.label) }))} /></SettingsRow>
      {/* TD has no light version yet. TD 還沒有淺色版。 */}
      <Segmented label={tr('appearance.mode', 'Dark or light')} value={currentMode()} onChange={setMode}
        options={modes.map(item => ({ ...item, disabled: !hasMode(style, item.value), title: hasMode(style, item.value) ? undefined : notYet }))} />
      <SliderPlaceholder label={tr('appearance.brightness', 'Brightness')} />
      {/* Under A/B test until the tuning phase (Q64). A／B 測試，調整期決定。 */}
      <Segmented label={tr('appearance.ports', 'Port style')} value={currentPorts()} options={portStyles} onChange={setPorts} />
      {/* Looks being tried and values being tuned are in the Appearance panel (Refactor.58.2). 試驗與可調的數值在外觀面板。 */}
      {onPanel && <button className="link-button" onClick={onPanel}>{say(tr('appearance.openPanel', 'More in the Appearance panel…'))}</button>}
    </PopoverButton></span>
    <span {...fold(3)}><PopoverButton icon="textSize" label={tr('appearance.sizeTitle', 'Language and size')} className="settings-panel">
      <SettingsRow label={tr('action.language', 'Language')}>
        <Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
          options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} /></SettingsRow>
      <Segmented label={tr('appearance.sizeTitle', 'Language and size')} value={currentSize()} options={sizes} onChange={setSize} />
      <SliderPlaceholder label={tr('appearance.scale', 'Interface scale')} />
    </PopoverButton></span>
  </>;
}

