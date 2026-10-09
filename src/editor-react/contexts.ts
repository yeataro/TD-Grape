import { createContext, useContext } from 'react';
import type { Editor as EditorSession } from './editor';

// What the editing view hands down to everything drawn inside it (cards, panels): the session of the graph being
// edited, the text function and the Body drag preference. Provided once by the workspace (main.tsx).
// 編輯畫面往下交給裡面所有東西（卡片、面板）的：正在編輯那張圖的 session、文字函式、Body 拖曳偏好。由工作區提供一次。
export const SessionContext = createContext<EditorSession | null>(null);
export const TextContext = createContext<(key: string) => string>(key => key);
export const BodyDragContext = createContext(false);
/** While a wire is dragged over an input: the inputs of that node it would merge away (Refactor.57).
 * 拖線停在某個輸入上時：那個節點會被併掉的輸入。 */
export const MergingContext = createContext<{ node: string; merged: readonly string[] } | null>(null);
/** Nodes that wrote a line TD reported in the GLSL that failed (Refactor.63.6, a trial: canvas setting, off by default).
 * TD 回報的錯誤行是哪些節點寫的（試驗：畫布設定，預設關）。 */
export const ErrorNodesContext = createContext<ReadonlySet<string> | null>(null);
export const useSession = () => useContext(SessionContext)!;
