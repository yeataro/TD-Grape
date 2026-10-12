import { useEffect, useRef, type RefObject } from 'react';
import type { MenuItem } from './DropdownMenu';
import { readPreference, writePreference } from './preferences';
import { scrollToMiddle } from './scroll_glide';
import { say, type Message } from './text';

// Live trace, shared by the panels that follow the selection (the GLSL panel, Refactor.83; the Graph JSON View, Refactor.102.1):
// each has its own switch (human 2026-10-12: each its own setting), a personal preference, on by default, in the panel's menu; and the
// traced node's lines come into view as it is chosen. One way of doing it, two switches (deep clean 2026-10-12: the two panels had
// the same code twice).
// 即時追蹤，跟著選取的面板共用（GLSL 面板 R.83；Graph JSON View R.102.1）：每個面板自己一個開關（人類 10-12：各自的設定）、個人偏好、
// 預設開、在面板選單裡；選到的節點那幾行捲進畫面。做法一份、開關兩個（10-12 深度清潔：兩個面板原本各寫了一份一樣的程式）。

/** A panel's Live trace switch, kept under `preference`. 一個面板的即時追蹤開關，存在 preference。 */
export function traceSwitch(preference: string, label: Message, hint: Message) {
  let on = readPreference(preference) !== 'off';
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => on,
    /** The panel's menu entry. 面板選單裡的這一項。 */
    menu: (): readonly MenuItem[] => [{ key: 'liveTrace', checkbox: true, checked: on, label: say(label), title: say(hint),
      select: () => { on = !on; writePreference(preference, on ? 'on' : 'off'); listeners.forEach(listener => listener()); } }],
  };
}

/** Brings the traced node's first line (`selector`, inside `box`) into view when the traced node changes, unless it is already in
 * view, or the panel itself chose that node (a link or line number pressed there: the panel stays where it was pressed). Returns
 * what the panel calls when it chooses a node. 被追蹤的節點換人時，把它的第一行（box 裡的 selector）捲進畫面；已經看得到、或是面板自己
 * 選的（在面板裡按了連結或行號：面板留在按的地方）就不捲。回傳面板自己選節點時要呼叫的。 */
export function useFollowTrace(box: RefObject<HTMLElement | null>, selector: string, traced: string | null) {
  const chosenHere = useRef<string | null>(null);
  useEffect(() => {
    const own = chosenHere.current === traced; chosenHere.current = null;
    const first = !own && traced !== null ? box.current?.querySelector<HTMLElement>(selector) : null;
    if (first) scrollToMiddle(first, true);
  }, [traced]); // box and selector stay the same box 與 selector 不會變
  return (id: string) => { chosenHere.current = id; };
}
