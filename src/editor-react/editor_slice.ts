import { useRef, useSyncExternalStore } from 'react';
import type { Editor as EditorSession, EditorState } from './editor';

// Reading the session's state in React (Refactor.106, block D): each part subscribes to the slice it shows, so a publish re-renders
// only what reads a value that changed — a drag frame (a new projection) reaches the canvas alone. Only the canvas subscribes to
// `projection`; a part that needs nodes' data (the Parameter panel, the upgrade notice) reads it once per `version`, as data changes
// only with an edit. The rule for a selector: return a value that stays the same (===) while what it reads is unchanged — a
// primitive, or an object the state holds; never build a new object or array inside a selector (React would re-render on every
// publish, or warn of a loop). To read several fields at once, use useEditorFields, which keeps the same object while they are
// unchanged.
// 在 React 裡讀 session 的狀態（R.106，D 區塊）：每個部分訂閱自己顯示的切片，發布時只有讀到變了的值的部分重繪——拖曳的一格（新的投影）
// 只到畫布。只有畫布訂閱 projection；需要節點資料的部分（參數面板、升級提示）每個 version 讀一次，因為資料只在修改時變。選擇器的規則：
// 讀的東西沒變時回傳同一個值（===）——基本型別，或狀態本來就持有的物件；不要在選擇器裡建立新的物件或陣列（React 會每次發布都重繪，
// 或警告無限迴圈）。一次要讀幾個欄位，用 useEditorFields，欄位沒變就給同一個物件。

// The bars' useEditorState (the whole state) is gone: no part needs every field. bars.tsx 的 useEditorState（整份狀態）已拿掉：沒有哪個部分需要
// 全部欄位。
const noSubscribe = () => () => {};

/** One slice of the state, chosen by `select` (see the rule above). 狀態的一個切片，由 select 選（規則見上）。 */
export function useEditorSlice<T>(session: EditorSession, select: (state: EditorState) => T): T {
  return useSyncExternalStore(session.subscribe, () => select(session.snapshot()));
}

/** These fields of the state as one object, the same object until one of them changes; null without a session. 狀態的這幾個欄位做成
 * 一個物件，任一個變了才換新的；沒有 session 時為 null。 */
export function useEditorFields<K extends keyof EditorState>(session: EditorSession | null, keys: readonly K[]): Pick<EditorState, K> | null {
  const last = useRef<Pick<EditorState, K> | null>(null);
  return useSyncExternalStore(session?.subscribe ?? noSubscribe, () => {
    if (!session) return null;
    const state = session.snapshot(), kept = last.current;
    if (kept && keys.every(key => kept[key] === state[key])) return kept;
    return last.current = Object.fromEntries(keys.map(key => [key, state[key]])) as Pick<EditorState, K>;
  });
}
