import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties, type RefObject, type UIEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession, EditorState } from './editor';
import { BrandMark, Icon, type IconName } from './icons';
import type { MenuItem } from './DropdownMenu';
import type { SyncRecord } from './sync_record';
import type { Link } from './host_sync';
import { IconButton, MenuButton, Placeholder, Popover, PopoverButton, Segmented, Select, ToolGroup, notYet } from './controls';
import { appearance, appearanceSubscribe, componentTintOn, setComponentTint, componentLettersOn, setComponentLetters, shadowOn, setShadow, currentGradientBlend, gradientBlends, setGradientBlend, effectOf, follows, setEffect, currentMode, currentPorts, currentSize, currentStyle, hasMode, modes, portStyles, setMode, setPorts, setSize, setStyle, sizes, styles } from './appearance';
import { LayoutMenu, type Layout } from './layout';
import type { Report } from './reports';
import { clockOf, clockTime, language, setLanguage, say, tr, type Message } from './text';
import { frameNodes } from './viewport';
import { CalmGate } from './calm';

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
 * actions. As it narrows, parts fold away in the human's order (2026-10-10; R.75.6 swapped import/export and the language,
 * human 2026-10-11: on a phone the short language select was hidden behind the long import/export): About, the version, the
 * tagline, import and export (in the foot bar's menu), the language (also in the foot bar's "AA"), Save (also in the menu;
 * Apply Shader was removed in R.75.5); the mark and the name never.
 * 標題列照舊產品：圖標、名稱、副標題、版本、About；右邊是常用動作。變窄時照人類的順序收起：About、版號、副標題、匯入與匯出（底列選單裡有）、
 * 語言（底列 AA 也有）、儲存（選單裡也有；套用 Shader 在 R.75.5 拿掉）；圖標與名稱永遠不收（R.75.6 對調匯入匯出與語言，人類：手機上短的語言被長的匯入匯出拖著藏起來）。 */
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
    <span {...fold(5)}><Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
      options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} /></span>
    <span {...fold(4)}><Placeholder label={tr('action.importGraph', 'Import graph')} /></span>
    <span {...fold(4)}><Placeholder label={tr('action.exportGraph', 'Export graph')} /></span>
    {/* Saving the TD project takes the main button's look and place (Refactor.75.5, human 2026-10-11): the editor never saves
        it by itself. 儲存 TD 專案接手主要按鈕的樣式與位置（R.75.5，人類）：編輯器不會自己存。 */}
    <button type="button" {...fold(6, 'primary')} aria-disabled={!session || !canSave(state) || undefined}
      onClick={() => { if (session && canSave(state)) void session.save(); }}>{say(tr('toolbar.saveProject', 'Save TD project'))}</button>
    {/* No "Apply Shader" (Refactor.75.5, human 2026-10-11): sending is automatic with no delay, so it only ever lit for an
        instant; it comes back with a manual-apply mode, if that is ever made (CURRENT, later releases).
        沒有「套用 Shader」（R.75.5，人類）：送出是自動、零延遲的，它只會亮一下；若哪天做「手動套用模式」再跟著回來（CURRENT 後續版本）。 */}
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
/** Whether TD can save the project now (Refactor.75.7, human 2026-10-11): not while TD is away, conflicting or unsure; while
 * sending it can — the save waits for the send — so the button no longer greys for an instant at every edit.
 * TD 現在能不能存專案（R.75.7，人類）：TD 不在、衝突、結果不確定時不行；送出中可以（存檔會等送完），按鈕不再每次修改都灰一下。
 * Nor while this page's save has no answer yet (Refactor.75.13, human: people press again and again); a long save goes on
 * greyed by the heartbeat (TD not responding). 這一頁的存檔還沒回覆時也不行（R.75.13，人類：使用者會一直按）；存很久時接著由
 * 心跳（TD 沒有回應）讓它繼續灰著。 */
/** Whether the TD project holds this revision (Refactor.75.15, human 2026-10-11): saved green, not saved yellow; unknown
 * (TD-Grape has not seen this project saved) says nothing. Both revisions are TD's own. TD 專案存的是不是這一版（R.75.15，人類）：
 * 已存檔綠、未存檔黃；不知道（TD-Grape 還沒看過這個專案存檔）就不說。兩個版號都是 TD 說的。 */
const savedMark = (state: EditorState | null): { kind: 'saved' | 'unsaved'; word: Message } | null => {
  const saved = state?.saved?.revision;
  if (state == null || saved == null) return null;
  // How many revisions the file is behind (R.75.16, human). 檔案落後幾版（R.75.16，人類）。
  return saved >= state.revision ? { kind: 'saved', word: tr('status.markSaved', 'saved') }
    : { kind: 'unsaved', word: tr('status.markUnsaved', 'not saved ({count})', { count: state.revision - saved }) };
};
const canSave = (state: EditorState | null) => !!state && !state.saving && !['offline', 'uncertain', 'conflict'].includes(state.phase);
// How to recover, by what the editor can see (Refactor.71): it cannot tell which cause it is, so each lists the possible ones
// and what to check. 如何恢復，照編輯器看得到的症狀分（R.71）：分不出是哪個原因，所以各自列出可能的原因與要檢查的地方。
const recoveryHelp: Record<Link, Message> = {
  closed: tr('status.recoveryClosed', 'TD was closed. Open TD again, then open the editor from the Grape OP; this page keeps your changes (or keep them with Download draft).'),
  stopped: tr('status.recoveryStopped', "TD-Grape's editor service was stopped in TD. Turn it on again (GrapeEditor's Active); this page reconnects and sends your changes."),
  reloading: tr('status.recoveryReloading', 'The editor service is reloading; this page reconnects by itself within a few seconds.'),
  deleted: tr('status.recoveryDeleted', 'This Grape OP was deleted in TD. If by mistake, undo it in TD (Ctrl+Z) and this page reconnects; otherwise keep your changes with Download draft.'),
  device: tr('status.recoveryDevice', 'This device has no network. Once it is back, this page reconnects by itself.'),
  busy: tr('status.recoveryBusy', "TD is still running but is not handling requests. It may be minimized, busy with a long task, paused (its timeline or global cooking), or TD-Grape's component may be stopped. On the computer running TD: restore its window, wait for the task, press play or turn cooking back on."),
  unreachable: tr('status.recoveryUnreachable', 'TD cannot be reached at all. It may have been closed or crashed, or the network is down. Check that TD is still open; after TD restarts, open the editor again from the Grape OP. On a remote device, check the network.'),
};

/** The sync light (Refactor.70, 70.1; human 2026-10-10): a dot, the revision and a short word. The dot's colour is the state —
 * green when the graph is in TD, yellow for changes not yet sent, red when TD cannot be reached, answered unclearly, conflicts
 * or stopped, grey with no graph — and it pulses while something is on its way (sending, checking the connection). The word
 * folds first as the bar narrows. 同步燈號（人類 10-10）：圓點、版號、簡短的字。圓點的顏色是狀態——圖已在 TD 是綠、有修改還沒送出是黃、
 * 連不上 TD／回應不確定／版本衝突／停止是紅、沒有圖是灰；有東西在路上（送出中、檢查連線中）時會閃。列變窄時字先收起。 */
type Tone = 'normal' | 'unsent' | 'alarm' | 'none';
// Every word the light can show; all of them, unseen, keep its width that of the longest in the language shown, so the message
// after it never moves (R.70.4, human 2026-10-10, as the sync state of 10-09). 燈號可能出現的每個字；全部看不見地疊在一起，
// 讓寬度等於目前語言最長的那個，後面的訊息就不會跳（R.70.4，人類，同 10-09 的同步狀態）。
const words = {
  none: tr('light.none', 'No graph'), applied: tr('light.applied', 'Graph applied'), saved: tr('light.saved', 'Saved'), unsent: tr('light.unsent', 'Graph not sent'),
  sending: tr('light.sending', 'Sending'), checking: tr('light.checking', 'Checking…'), offline: tr('light.offline', 'TD unreachable'),
  busy: tr('light.busy', 'TD not responding'), closed: tr('light.closed', 'TD closed'), serviceStopped: tr('light.serviceStopped', 'Service stopped'),
  reloading: tr('light.reloading', 'Reloading'), deleted: tr('light.deleted', 'OP deleted'), device: tr('light.device', 'Device offline'),
  uncertain: tr('light.uncertain', 'Unsure'), conflict: tr('light.conflict', 'Conflict'), stopped: tr('light.stopped', 'Stopped'),
};
/** What the light says for why TD is away (Refactor.75); nothing said is "TD unreachable". TD 為什麼不在的字；沒說就是連不到。 */
const awayWords: Record<Exclude<Link, 'unreachable'>, Message> = { busy: words.busy, closed: words.closed, stopped: words.serviceStopped,
  reloading: words.reloading, deleted: words.deleted, device: words.device };
const awayWord = (link?: Link) => !link || link === 'unreachable' ? words.offline : awayWords[link];
const lightOf = (state: EditorState | null): { tone: Tone; busy: boolean; word: Message } => {
  if (!state) return { tone: 'none', busy: false, word: words.none };
  const busy = state.phase === 'sending' || !!state.checking;
  // Checking the connection is said on the bar itself, with the dot pulsing, so it shows it is at work (R.70.2, human).
  // 檢查連線中直接寫在列上，圓點同時閃，看得出在工作（R.70.2，人類）。
  const word = state.checking ? words.checking : state.phase === 'offline' ? awayWord(state.link)
    : state.phase === 'uncertain' ? words.uncertain
    : state.phase === 'conflict' ? words.conflict : state.phase === 'error' ? words.stopped
    : state.phase === 'sending' ? words.sending : state.dirty ? words.unsent : words.applied;
  // A deleted Grape OP or a reloading service is a warning, not TD failing (Refactor.75, human 2026-10-10); reloading also
  // pulses, as it is on its way back. Grape OP 被刪、服務重新載入是警告（黃），不是 TD 壞了（人類）；重新載入也會閃，表示正在回來。
  const warn = state.phase === 'offline' && (state.link === 'deleted' || state.link === 'reloading');
  return { tone: warn ? 'unsent' : alarm.includes(state.phase) ? 'alarm' : state.dirty ? 'unsent' : 'normal', busy: busy || (state.phase === 'offline' && state.link === 'reloading'), word };
};
/** While waiting for the next automatic check, the dot is a pie that empties over the wait (R.70.4, human: as the usage ring);
 * otherwise a dot. 等待下一次自動檢查時，圓點是隨等待變空的圓餅（R.70.4，人類：像用量的圓環）；其他時候是圓點。 */
function LightDot({ state }: { state: EditorState | null }) {
  const waiting = !!state && state.retryAt !== undefined && !state.checking;
  if (!waiting) return <span className="sync-dot" />;
  const left = Math.max(0, state.retryAt! - Date.now());
  return <svg className="sync-pie" viewBox="0 0 20 20" aria-hidden="true"><circle className="sync-pie-ring" cx="10" cy="10" r="8.5" />
    <circle key={state.retryAt} className="sync-pie-sweep" cx="10" cy="10" r="4"
      style={{ animationDuration: left + 'ms', animationDelay: (left - (state.retryMs ?? left)) + 'ms' } as CSSProperties} /></svg>;
}

const passing = (state: EditorState | null) => !!state && (state.phase === 'sending' || (state.phase === 'ready' && state.dirty));
/** What the foot bar shows (Refactor.73.2, human 2026-10-10: the bar jumped at every edit, three states within ~20 ms). Sending
 * is not delayed; only the showing is. A result (applied, an error, TD away) shows at once; "on its way" (not sent yet,
 * sending) shows only if it is still so after CALM_MS, read then from the latest state, so it never covers a newer result.
 * 底列顯示什麼（R.73.2，人類：每次修改底列都在約 20 ms 內跳三個狀態）。送出不延後，只有顯示延後。結果（已套用、錯誤、
 * TD 不在）立刻顯示；「途中」（還沒送、送出中）要過了 CALM_MS 仍是如此才顯示，而且那時讀的是最新的狀態，所以不會蓋掉較新的結果。 */
function useCalm(state: EditorState | null): EditorState | null {
  const [, changed] = useReducer((n: number) => n + 1, 0), gate = useRef<CalmGate<EditorState | null> | null>(null);
  gate.current ??= new CalmGate(state, passing, changed);
  useEffect(() => { gate.current!.feed(state); }, [state]);
  useEffect(() => () => gate.current!.dispose(), []);
  return gate.current.view(state);
}

/** The foot bar: every notice of the editor (human 2026-10-09). The menu, the sync light, the latest message, settings, full
 * screen. The light opens the status (the state now, what to do when TD is away, the state's own record); the message opens
 * the message history (Refactor.70.1: two separate things). 底列：編輯器所有的提示（人類）。功能表、同步燈號、最新訊息、設定、
 * 全螢幕。燈號打開狀態（現在的狀態、TD 不在時怎麼辦、狀態自己的紀錄）；訊息打開訊息歷史（R.70.1：兩件不同的事）。 */
export function FootBar({ session, waiting, onDownload, onReset, prefs, project, onAppearance }: {
  session: EditorSession | null; waiting: Message | string; onDownload(): void; onReset(): void; prefs: CanvasPrefs;
  /** The TD project's file name, as TD last said it (Refactor.75.2). TD 專案的檔名（TD 最後說的）。 */
  project?: string; onAppearance?(): void;
}) {
  // The light and the message show the calm state; the status panel, opened on purpose, the state as it is (R.73.2).
  // 燈號與訊息顯示平穩後的狀態；刻意打開的狀態面板顯示當下的狀態。
  const live = useEditorState(session), state = useCalm(live), fullscreen = useFullscreen(), bar = useRef<HTMLElement>(null), folded = useFolding(bar);
  // As it narrows (human 2026-10-10): the latest message gives way first, down to its "…"; then the light's word folds; the
  // icons basically stay, but if they must, they fold from the left; the light (dot and revision), which matters more, folds
  // after them; the ⋮ menu never. 變窄時（人類 10-10）：最新訊息先讓，讓到剩「…」；接著燈號的字收起；圖示原則上留著，非收不可時從左邊收；
  // 比它們重要的燈號（圓點與版號）在它們之後才收；⋮ 選單永遠不收。
  const fold = (order: number, className = '') => ({ 'data-fold': order, className: (className + (folded >= order ? ' folded' : '')).trim() || undefined });
  const log = useSyncExternalStore(session?.log.subscribe ?? noSubscribe, session?.log.entries ?? (() => noLog));
  const [status, setStatus] = useState<HTMLElement | null>(null), [history, setHistory] = useState<HTMLElement | null>(null);
  const { tone, busy, word } = lightOf(state);
  // The status line says what the light says, in every state (R.75; Refactor.75.15, human 2026-10-11: one set of words, not a
  // second one for the panel), and never "checking": that is the pulsing dot beside Retry (R.75.4).
  // 狀態那一行一律和燈號說的一樣（R.75；R.75.15，人類：一套說法，面板不另一套），也不說「檢查中」：那是「立即重試」旁閃動的圓點（R.75.4）。
  const cause = state ? lightOf({ ...state, checking: false }).word : tr('status.noGraph', 'No graph open');
  const mark = savedMark(state);
  // Saved, said in green on the light itself (Refactor.75.18, human 2026-10-11: the feedback that a save worked matters): only
  // while nothing is on its way and TD's file holds this revision; the status line keeps "Graph applied · … · saved".
  // 已存檔，用綠字直接寫在燈號上（R.75.18，人類：這是存檔的視覺回饋，很重要）：只在沒有東西在路上、TD 的檔存的就是這一版時；
  // 狀態那一行仍是「圖已套用 · … · 已存檔」。
  const savedNow = !!state && !busy && state.phase === 'ready' && !state.dirty && mark?.kind === 'saved';
  const line = state ? say(tr('status.line', '{state} · revision {revision}', { state: cause, revision: state.revision })) : say(cause);
  const now = line + (mark ? ' · ' + say(mark.word) : '');
  const message = state ? state.message : waiting, full = say(message), first = full.split('\n')[0];
  return <footer ref={bar} className={'foot-bar' + (state ? ` ${state.phase} ${state.level}` : '')} role="status">
    <MenuButton icon="menu" narrow label={tr('foot.menu', 'Editor menu')} items={[
      { key: 'reload', label: say(tr('foot.reloadPage', 'Reload editor page')), select: () => location.reload() },
      { key: 'reloadTd', label: say(tr('foot.reloadApplied', 'Reload applied graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'reset', label: say(tr('foot.resetSettings', 'Reset browser settings…')), select: onReset },
      { key: 'import', label: say(tr('action.importGraph', 'Import graph')), disabled: true, title: say(notYet), divider: true, select: () => {} },
      { key: 'export', label: say(tr('action.exportGraph', 'Export graph')), disabled: true, title: say(notYet), select: () => {} },
      { key: 'draft', label: say(tr('toolbar.downloadDraft', 'Download draft')), disabled: !session, select: onDownload },
      { key: 'save', label: say(tr('toolbar.saveProject', 'Save TD project')), disabled: !session || !canSave(state), divider: true, select: () => void session?.save() },
    ]} />
    <button type="button" {...fold(6, 'sync-light tone-' + tone + (busy ? ' busy' : ''))} title={now} aria-label={now} aria-haspopup="dialog"
      aria-expanded={!!status} onClick={event => setStatus(status ? null : event.currentTarget)}>
      {/* The revision with an r, the head of "revision" as the tooltip and the record say it (R.70.3, human 2026-10-10).
          版號前加 r，即提示與紀錄裡「revision」的字頭（R.70.3，人類）。 */}
      <LightDot state={state} />
      <span className="sync-slot">
        <span className="sync-size" aria-hidden="true">{say(tr('light.revision', 'r{revision}', { revision: '0000' }))}</span>
        <span>{state ? say(tr('light.revision', 'r{revision}', { revision: state.revision })) : '–'}</span></span>
      <span {...fold(1, 'sync-slot sync-word')}>{Object.values(words).map((each, index) => <span key={index} className="sync-size" aria-hidden="true">{say(each)}</span>)}
        <span key={say(savedNow ? words.saved : word)} className={(savedNow ? 'saved' : '') + (tone === 'alarm' ? '' : ' fade-in')}>
          {say(savedNow ? words.saved : word)}</span></span></button>
    {/* The latest message; its whole text (e.g. TD's compile log) on hover, the message history on click (Q35).
        最新訊息；完整內容（例如 TD 的編譯紀錄）在提示裡，點開看訊息歷史。 */}
    <button type="button" className="foot-message" data-shrink="" title={full === first ? undefined : full} aria-haspopup="dialog" aria-expanded={!!history}
      disabled={!session} onClick={event => setHistory(history ? null : event.currentTarget)}>
      {/* Routine news fades in; a warning or an error is there at once, so it still catches the eye (Refactor.75.20, human
          2026-10-11: text that changes often should pull less attention). 例行的消息淡入；警告與錯誤立刻出現，才拉得到注意
          （R.75.20，人類：頻繁更新的文字要少干擾注意力）。 */}
      <span key={full} className={state && state.level !== 'info' ? undefined : 'fade-in'}>{first}{full === first ? '' : ' …'}</span></button>
    <span className="spacer" />
    {/* Settings of how editing behaves (legacy gear). Body drag is a real setting here (Q64). 編輯行為的設定（舊產品齒輪）。 */}
    <span {...fold(2)}><PopoverButton icon="settings" label={tr('foot.settings', 'Settings')} className="settings-panel">
      <label className="check"><input type="checkbox" checked={prefs.bodyDrag} onChange={event => prefs.set({ bodyDrag: event.target.checked })} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
      {/* Trial (Refactor.58.2): the wheel glides; off gives the wheel back to React Flow. 試驗：滾輪平滑；關掉就還給 React Flow。 */}
      <label className="check"><input type="checkbox" checked={prefs.damping} onChange={event => prefs.set({ damping: event.target.checked })} />{say(tr('toolbar.damping', 'Canvas damping'))}</label>
      {/* Framing glides or jumps; times are fixed (legacy 150 / 333 ms; human: on/off only). 對準時滑動或直接跳；時間固定（人類：只要開關）。 */}
      <label className="check"><input type="checkbox" checked={prefs.frameGlide} onChange={event => prefs.set({ frameGlide: event.target.checked })} />{say(tr('toolbar.frameGlide', 'Frame transition (F)'))}</label>
      {/* Trial (Refactor.63.6, human 2026-10-10): outline the nodes that wrote a line TD reported, as the legacy editor did; only
          while the GLSL is the one that failed. 試驗：TD 回報的錯誤行是哪個節點寫的，就框起來（照舊產品）；只在 GLSL 就是失敗的那份時。 */}
      <label className="check"><input type="checkbox" checked={prefs.errorNodes} onChange={event => prefs.set({ errorNodes: event.target.checked })} />{say(tr('toolbar.errorNodes', 'Mark nodes on TD error lines (trial)'))}</label>
      <ComponentTint />
      <WireGradient />
      <ComponentLetters />
      <Effects />
    </PopoverButton></span>
    <AppearancePanels onPanel={onAppearance} fold={fold} />
    <span {...fold(5)}><IconButton icon="fullscreen" label={tr('foot.fullscreen', 'Full screen')} pressed={fullscreen}
      onClick={() => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen())} /></span>
    {status && <StatusPanel anchor={status} state={live} project={project} line={line} tone={tone} onRetry={() => void session?.check()} onClose={() => setStatus(null)} />}
    {history && <LogHistory anchor={history} entries={log} onClose={() => setHistory(null)} />}
  </footer>;
}

/** The status panel (Refactor.70, 70.1): the state now in the light's colour; while TD is away, the automatic retry (its
 * countdown and Retry now, which was the countdown pie) and how to recover; then the state's own record (sync_record.ts),
 * the latest at the bottom. 狀態面板：現在的狀態（燈號的顏色）；TD 不在時，自動重試（倒數與「立即重試」，原本的倒數圓餅）與如何恢復；
 * 下面是狀態自己的紀錄，最新的在最下面。 */
/** A history list that starts at its latest line; while there is more above, its top fades (Refactor.75.1, human 2026-10-11).
 * 從最新一行開始顯示的歷史清單；上面還有內容時頂端淡出（R.75.1，人類）。 */
function useHistoryList(lines: unknown) {
  const list = useRef<HTMLDivElement>(null), [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    setAbove(element.scrollTop > 1);
  }, [lines]);
  return { ref: list, className: 'log-list' + (above ? ' more-above' : ''), onScroll: (event: UIEvent<HTMLDivElement>) => setAbove(event.currentTarget.scrollTop > 1) };
}

// The status panel (Refactor.75.1, human 2026-10-11): the state now sits at the bottom, next to the light that opened it
// (what matters is nearest the entry), the record above it; while the panel is open the state part only grows, so the
// record does not jump when TD comes back. 狀態面板（R.75.1，人類）：現在的狀態放在下方、貼著打開它的燈號（重要的離入口最近），
// 紀錄在上方；面板開著時狀態區只長不縮，TD 回來時紀錄不會跳。
function StatusPanel({ anchor, state, project, line, tone, onRetry, onClose }: {
  anchor: HTMLElement; state: EditorState | null; project?: string; line: string; tone: Tone; onRetry(): void; onClose(): void;
}) {
  const [, tick] = useState(0), records = state?.syncRecords ?? [], list = useHistoryList(records), mark = savedMark(state);
  const box = useRef<HTMLDivElement>(null), [floor, setFloor] = useState(0);
  useLayoutEffect(() => { const height = box.current?.offsetHeight ?? 0; if (height > floor) setFloor(height); });
  // Back to normal, it fits its content again (Refactor.75.9, human 2026-10-11): only while TD is away does it not shrink.
  // 恢復正常時重新貼合內容（R.75.9，人類）：只有 TD 不在的期間不縮。
  const calm = !!state && !alarm.includes(state.phase);
  useLayoutEffect(() => { if (calm) setFloor(0); }, [calm]);
  // The countdown moves on by itself. 倒數自己往下走。
  useEffect(() => {
    if (state?.retryAt === undefined) return;
    const timer = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(timer);
  }, [state?.retryAt]);
  const seconds = state?.retryAt === undefined ? 0 : Math.ceil(Math.max(0, state.retryAt - Date.now()) / 1000);
  const reason = state && alarm.includes(state.phase) ? say(state.message).split('\n')[0] : '';
  // Which file and which Grape OP (Refactor.75.2), and the last save (R.73), said briefly (R.75.16, human 2026-10-11:
  // "file : OP path", then "Last saved: r873 (08:06)"; how far behind is on the line above). The editor never saves by itself.
  // 哪個檔、哪個 Grape OP（R.75.2）與上次儲存（R.73），精簡（R.75.16，人類：「檔名 : OP 路徑」，下一行「上次儲存：r873（08:06）」；
  // 落後幾版在上面那行）。編輯器不會自己存。
  const last = state?.saved, where = [project, state?.targetPath].filter(Boolean).join(' : ');
  const saved = last?.time == null ? null : last.revision == null ? tr('status.lastSavedAt', 'Last saved: {time}', { time: clockOf(last.time) })
    : tr('status.lastSaved', 'Last saved: r{revision} ({time})', { revision: last.revision, time: clockOf(last.time) });
  const clock = clockTime;
  return <Popover anchor={anchor} label={tr('foot.status', 'Status')} className="log-history status-panel" onClose={onClose}>
    {/* Being in touch with TD (opened, back again) is green, trouble red (R.70.2, human). 連上 TD（打開、重新連上）是綠，異常是紅（人類）。 */}
    <div {...list}>{records.map((record, i) => <div key={i}
      className={'log-entry' + (record.kind === 'offline' && (record.link === 'deleted' || record.link === 'reloading') ? ' warning'
        : alarm.includes(record.kind) ? ' error' : record.kind === 'opened' || record.kind === 'recovered' ? ' ok' : '')}
      title={record.reason === undefined ? undefined : say(record.reason)}>
      <time>{clock(record.time)}{record.until === undefined ? '' : '–' + clock(record.until)}</time><span>{say(recordWords(record))}</span></div>)}</div>
    {/* The state (R.75.4, human 2026-10-11: less repeated, less wordy): the countdown pie, the cause, and Retry now on its
        right; how to recover, its title on its own line; which Grape OP and which project file always last.
        狀態（R.75.4，人類：少重複、少囉嗦）：倒數圓餅、原因，右邊是「立即重試」；如何恢復，標題自己一行；哪個 Grape OP、哪個專案檔永遠在最後。 */}
    <div ref={box} className={'status-now tone-' + tone} style={{ minHeight: floor || undefined }}>
      <div className="status-head">
        {state && away.includes(state.phase) && <span className={'status-pie' + (state.checking ? ' checking' : '')}
          title={say(state.checking ? tr('status.checking', 'Checking the connection…') : tr('status.retryIn', 'Trying again by itself in {seconds} s', { seconds }))}>
          <LightDot state={state} /></span>}
        <strong>{line}{mark && <> · <span className={'status-mark ' + mark.kind}>{say(mark.word)}</span></>}</strong>
        {state && away.includes(state.phase) && <button type="button" disabled={!!state.checking} onClick={onRetry}>{say(tr('status.retry', 'Retry now'))}</button>}
      </div>
      {/* Away, the recovery text says it; other trouble (a conflict, a refusal) keeps TD's own words. 不在時由如何恢復說；
          其他狀況（衝突、拒絕）保留 TD 自己的話。 */}
      {reason && state?.phase !== 'offline' && <p>{reason}</p>}
      {state?.phase === 'offline' && <div className="status-help">
        <span className="status-help-title">{say(tr('status.howToRecover', 'How to recover'))}</span>
        <p>{say(recoveryHelp[state.link ?? 'unreachable'])}</p></div>}
      <div className="status-where">
        {where && <p>{where}</p>}
        {saved && <p>{say(saved)}</p>}
      </div>
    </div>
  </Popover>;
}
/** One line of the state's record in words. 狀態紀錄的一行，寫成字。 */
const recordWords = ({ kind, revision, from, link }: SyncRecord): Message => kind === 'offline' && link && link !== 'unreachable'
  ? tr('record.away', '{cause} at revision {revision}', { cause: awayWord(link), revision })
  : kind === 'opened' ? tr('record.opened', 'Opened the graph at revision {revision}', { revision })
  : kind === 'applied' ? from !== undefined && from !== revision ? tr('record.appliedRange', 'Applied revisions {from} to {revision}', { from, revision })
    : tr('record.applied', 'Applied revision {revision}', { revision })
  : kind === 'recovered' ? tr('record.recovered', 'In touch with TD again at revision {revision}', { revision })
  : kind === 'offline' ? tr('record.offline', 'Lost TD at revision {revision}', { revision })
  : kind === 'uncertain' ? tr('record.uncertain', 'Not sure TD received revision {revision}', { revision })
  : kind === 'conflict' ? tr('record.conflict', 'TD and the editor differ at revision {revision}', { revision })
  : tr('record.stopped', 'Stopped at revision {revision}', { revision });

// The browser's own full screen (legacy foot bar, bottom-right). 瀏覽器自己的全螢幕（舊產品底列右下）。
function useFullscreen() {
  return useSyncExternalStore(listener => { document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener); },
    () => !!document.fullscreenElement);
}

const HISTORY = 100; // tentative (human 2026-10-09: "within some number of past entries"). 暫定筆數。
/** The recent reports, opening upward from the foot bar, newest at the bottom, scrollable (human 2026-10-09).
 * 最近的回報紀錄，從底列往上開，最新的在最下面，可捲動（人類）。 */
function LogHistory({ anchor, entries, onClose }: { anchor: HTMLElement; entries: readonly Report[]; onClose(): void }) {
  const list = useHistoryList(entries);
  const shown = entries.slice(-HISTORY);
  return <Popover anchor={anchor} label={tr('foot.history', 'Message history')} className="log-history" onClose={onClose}>
    <div {...list}>{shown.length ? shown.map((entry, i) => <div key={i} className={'log-entry ' + entry.level}>
      <time>{clockTime(entry.time)}</time><span>{say(entry.message)}</span></div>)
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
// Component tint (Refactor.59; Q67): ports, labels and wires of one component take its colour. 分量染色：單一分量的接孔、標籤、接線用分量色。

/** Fades and the glass: follow the system, always on or always off (Refactor.75.21, 75.22, human 2026-10-11; in the gear while it
 * is not yet decided where such settings go). 淡入與玻璃：跟隨系統、一律開、一律關（R.75.21、75.22，人類；還沒定放哪的設定先放齒輪）。 */
function Effects() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  const options = follows.map(item => ({ value: item.value, label: say(item.label) }));
  return <>
    {/* Animation effects, named as the system setting (R.75.25, human 2026-10-11): fades, sliding choices, and any animation
        added later. 動畫效果，和系統設定同名（R.75.25，人類）：淡入、滑動的選取，以及之後加的動畫。 */}
    <SettingsRow label={tr('appearance.motion', 'Animation effects')}>
      <Select label={tr('appearance.motion', 'Animation effects')} value={effectOf('motion')} onChange={next => setEffect('motion', next)} options={options} /></SettingsRow>
    <SettingsRow label={tr('appearance.glass', 'Glass')}>
      <Select label={tr('appearance.glass', 'Glass')} value={effectOf('glass')} onChange={next => setEffect('glass', next)} options={options} /></SettingsRow>
  </>;
}

function ComponentTint() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  return <label className="check"><input type="checkbox" checked={componentTintOn()} onChange={event => setComponentTint(event.target.checked)} />
    {say(tr('toolbar.componentTint', 'Component colours'))}</label>;
}

// Trial (Refactor.77.1): wires that convert types drawn as a gradient between the two type colours; in the gear, next to
// component tint, as a setting whose home is not decided yet (human 2026-10-11). 試驗：轉型的線用兩端型別色漸層；放在齒輪、
// 分量染色旁邊，還沒決定歸屬的設定先放這裡（人類）。
function WireGradient() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  return <>
    <label className="check"><input type="checkbox" checked={shadowOn('wireGradient')} onChange={event => setShadow('wireGradient', event.target.checked)} />
      {say(tr('appearance.wireGradient', 'Type conversion wires: gradient between the two type colours'))}</label>
    {/* How it blends (Refactor.77.4); the choices are named as the human named them. 怎麼混色（R.77.4）；選項照人類給的名字。 */}
    <SettingsRow label={tr('appearance.wireGradientBlend', 'Gradient blend')}>
      <Select label={tr('appearance.wireGradientBlend', 'Gradient blend')} value={currentGradientBlend()} onChange={setGradientBlend}
        options={gradientBlends.map(value => ({ value, label: value }))} /></SettingsRow>
  </>;
}

function ComponentLetters() {
  useSyncExternalStore(appearanceSubscribe, appearance);
  return <label className="check"><input type="checkbox" checked={componentLettersOn()} onChange={event => setComponentLetters(event.target.checked)} />
    {say(tr('toolbar.componentLetters', 'Component letters in value boxes'))}</label>;
}

function AppearancePanels({ onPanel, fold }: { onPanel?(): void; fold(order: number): { 'data-fold': number; className?: string } }) {
  useSyncExternalStore(appearanceSubscribe, appearance);
  const style = currentStyle();
  return <>
    <span {...fold(3)}><PopoverButton icon="theme" label={tr('appearance.title', 'Appearance')} className="settings-panel">
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
    <span {...fold(4)}><PopoverButton icon="textSize" label={tr('appearance.sizeTitle', 'Language and size')} className="settings-panel">
      <SettingsRow label={tr('action.language', 'Language')}>
        <Select label={tr('action.language', 'Language')} value={language()} onChange={setLanguage}
          options={[{ value: 'en', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]} /></SettingsRow>
      <Segmented label={tr('appearance.sizeTitle', 'Language and size')} value={currentSize()} options={sizes} onChange={setSize} />
      <SliderPlaceholder label={tr('appearance.scale', 'Interface scale')} />
    </PopoverButton></span>
  </>;
}

