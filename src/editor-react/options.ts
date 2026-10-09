import { createContext, useContext } from 'react';

// Behaviour switches of the editor (Refactor.54; human 2026-10-09: these behaviours should be switchable by flags,
// i.e. settable). One named switch per behaviour, all here, on by default. A personal preference of this browser,
// never in the project or the graph. The settings screen comes later (with the settings / experimental-features
// panel, legacy footer gear); code that uses a behaviour only asks whether its switch is on.
// 編輯器的行為開關（人類：這些行為之後要能用旗標開關、可以設定）。每個行為一個有名字的開關、集中在這裡、預設開；
// 屬於這個瀏覽器的個人偏好，不進專案或圖。設定畫面之後跟設定／實驗功能面板一起做；用到的地方只問「開著嗎」。
// Every switch here is temporary (design-interview Q64): in the multi-round tuning phase each one either becomes a real
// setting (both paths kept and tested, shown in the settings screen) or is flattened (the switch and the unused path
// are deleted). No hidden switch stays forever. Decide by: the tuning phase after the standard features.
// 這裡的每個開關都是暫時的（Q64）：多輪調整期逐一決定，變成正式設定（兩條路都保留、都測、放進設定畫面），或攤平
// （刪掉開關與沒選的那條路）。不留永遠藏著的開關。決定時間：標準功能做完後的調整期。
export type EditorOptions = {
  /** Releasing a wire on blank canvas opens Create node with what fits (legacy). 拉線放到空白處就跳出新增節點（照舊）。 */
  wireDropCreates: boolean;
  /** A "+" at the wire's end over blank canvas (Blender). 拉線停在空白處時線頭顯示「＋」。 */
  wireEndPlus: boolean;
  /** Dragging from a connected input picks its wire up (Blender). 從接了線的輸入拉，是把那條線拿起來。 */
  wirePickUp: boolean;
};
export const defaultOptions: EditorOptions = { wireDropCreates: true, wireEndPlus: true, wirePickUp: true };
export const OptionsContext = createContext<EditorOptions>(defaultOptions);
export const useOptions = () => useContext(OptionsContext);
