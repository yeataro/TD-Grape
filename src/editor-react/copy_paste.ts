import { useEffect, useMemo, useRef } from 'react';
import { useReactFlow, type XYPosition } from '@xyflow/react';
import { core } from './core';
import { tr } from './text';
import type { Editor as EditorSession } from './editor';
import type { FlowNode } from './projection';

// Copy, paste and duplicate on the page (Refactor.96; the copy itself is the core's, clipboard.ts). What is copied goes to the
// system clipboard as text (the save format, Q37 1-4), and is also kept in the page in case the browser refuses the clipboard
// (legacy graph_ui.js:2789-2810). Where a paste lands, as legacy (graph_ui.js:2811-2823): from the right-click menu where it was
// opened; Ctrl+V where the pointer last was over the canvas (else the upper middle); the toolbar's button a third into the canvas.
// Each paste after a copy moves one grid step further right and down; from the button it wraps after five, so it stays in view.
// 頁面上的複製、貼上、複製副本（R.96；複製本身是核心的 clipboard.ts）。複製的內容以文字放進系統剪貼簿（存檔格式，Q37 1-4），也留一份在
// 頁面裡，瀏覽器不讓用剪貼簿時用（照舊產品）。貼在哪裡照舊產品：右鍵選單貼在打開它的地方；Ctrl＋V 貼在游標最後在畫布上的位置（沒有就中間
// 偏上）；工具列的按鈕貼在畫布三分之一處。複製之後每貼一次往右下多一格；從按鈕貼時五次後回頭，才不會跑出畫面。

export type CopyPaste = {
  /** Whether some of these nodes can be copied (the Color Output cannot). 這些節點裡有沒有能複製的（Color Output 不能）。 */
  canCopy(nodes: readonly FlowNode[]): boolean;
  copy(): void;
  /** `at`: a screen point (the right-click menu's); none for the toolbar's button. at：螢幕上的點（右鍵選單的）；工具列按鈕不給。 */
  paste(at?: XYPosition): void;
  duplicate(): void;
};

export function useCopyPaste(session: EditorSession | null, snap: boolean, grid: number, draft: boolean): CopyPaste {
  const flow = useReactFlow(), kept = useRef<string | null>(null), count = useRef(0), pointer = useRef<XYPosition | null>(null);
  const settings = useRef({ snap, grid }); settings.current = { snap, grid };
  const tools = useMemo(() => {
    const canvas = (across: number) => { const box = document.querySelector('.canvas')!.getBoundingClientRect(); return { x: box.x + box.width * across, y: box.y + box.height / 3 }; };
    // The copy as text, kept in the page too; a new copy starts the steps again. 複製成文字，頁面裡也留一份；新的複製重新開始錯開。
    const copyText = () => {
      const clip = session?.copyNodes(session.snapshot().projection.nodes.filter(node => node.selected).map(node => node.id));
      if (!clip) return null;
      count.current = 0;
      return kept.current = JSON.stringify(clip);
    };
    // The one paste: what the text holds (else the page's copy), at a screen point, a step further each time. 唯一的貼上：文字裡的
    // （沒有就用頁面裡的那份），貼在螢幕上的點，每次多錯開一格。
    const pasteText = (text: string | null | undefined, screen: XYPosition, wrap: boolean) => {
      if (!session) return;
      const source = text || kept.current, clip = source ? core.readClip(source) : null;
      if (!clip) { if (source) session.warn(tr('edit.pasteNothing', 'The clipboard holds no copied nodes.')); return; }
      const { snap, grid } = settings.current, step = (wrap ? count.current % 5 : count.current) * grid, point = flow.screenToFlowPosition(screen);
      const place = (value: number) => snap ? Math.round(value / grid) * grid : value;
      if (session.paste(clip, { x: place(point.x + step), y: place(point.y + step) })) count.current++;
    };
    const actions: CopyPaste = {
      canCopy: nodes => nodes.some(node => core.removable(core.registry.get(node.data.authored.nodeType))),
      copy: () => { const text = copyText(); if (text) void navigator.clipboard?.writeText(text).catch(() => { /* kept in the page 留在頁面裡 */ }); },
      // The system clipboard first (it may hold a copy from another tab of this Grape OP), else the page's own copy. 先讀系統剪貼簿
      // （可能是同一個 Grape OP 另一個分頁複製的），讀不到用頁面裡的那份。
      paste: at => void (navigator.clipboard?.readText() ?? Promise.reject()).catch(() => '').then(text => pasteText(text, at ?? canvas(1 / 3), !at)),
      duplicate: () => void session?.duplicate(session.snapshot().projection.nodes.filter(node => node.selected).map(node => node.id)),
    };
    return { actions, copyText, pasteText, canvas };
  }, [session, flow]);
  // Ctrl+C and Ctrl+V come as the browser's own copy and paste events (their keys in shortcuts.ts, as the platform has them; no
  // permission asked). Only on the network or with nothing focused, not over text being selected or typed (legacy graph_ui.js:3060).
  // Ctrl＋C、Ctrl＋V 走瀏覽器自己的複製、貼上事件（鍵見 shortcuts.ts，依平台；不用問權限）。只在網路區或沒有焦點時，選了文字或在打字時不算
  // （照舊產品）。
  useEffect(() => {
    if (!session || draft) return;
    const ours = (event: Event) => {
      const element = event.target as HTMLElement;
      if (element.closest?.('input,select,textarea,[contenteditable="true"]') || document.getSelection()?.toString()) return false;
      return element === document.body || element === document.documentElement || !!element.closest?.('.react-flow');
    };
    const copied = (event: ClipboardEvent) => {
      if (!ours(event) || !event.clipboardData) return;
      const text = tools.copyText();
      if (!text) return;
      event.preventDefault(); event.clipboardData.setData('text/plain', text);
    };
    const pasted = (event: ClipboardEvent) => {
      if (!ours(event)) return;
      event.preventDefault();
      tools.pasteText(event.clipboardData?.getData('text/plain'), pointer.current ?? tools.canvas(1 / 2), false);
    };
    // Where the pointer last was over the canvas (legacy pastePoint, graph_ui.js:3059). 游標最後在畫布上的位置（照舊產品）。
    const moved = (event: PointerEvent) => { if ((event.target as Element).closest?.('.react-flow__pane')) pointer.current = { x: event.clientX, y: event.clientY }; };
    addEventListener('copy', copied); addEventListener('paste', pasted); addEventListener('pointermove', moved, { passive: true });
    return () => { removeEventListener('copy', copied); removeEventListener('paste', pasted); removeEventListener('pointermove', moved); };
  }, [tools, draft]);
  return tools.actions;
}
