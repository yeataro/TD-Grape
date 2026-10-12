import { tr, type Message } from './text';

/** Legacy's twelve group colours (frames_ui.js:3-7; Refactor.98). A group's colour is data kept in the graph, as legacy stored it, so
 * it is the same in every theme and is not a theme colour: this file is named as an exception in the colour rule
 * (tests/unit/test_themes.cjs), as the brand mark is. 舊產品的十二個群組顏色（R.98）。群組顏色是存在圖裡的資料（舊產品就這樣存），每個主題
 * 都一樣、不是主題色：這個檔在顏色規則裡列為例外（同葡萄標誌）。 */
export const GROUP_COLORS: readonly { value: string; name: Message }[] = [
  { value: '#7f8797', name: tr('group.colorSlate', 'Slate') }, { value: '#9a9390', name: tr('group.colorWarmGray', 'Warm gray') },
  { value: '#aa7a79', name: tr('group.colorRed', 'Muted red') }, { value: '#bb8c69', name: tr('group.colorTerracotta', 'Terracotta') },
  { value: '#b6a270', name: tr('group.colorSand', 'Sand') }, { value: '#94a574', name: tr('group.colorOlive', 'Olive') },
  { value: '#75a28a', name: tr('group.colorSage', 'Sage') }, { value: '#72a6a5', name: tr('group.colorTeal', 'Teal') },
  { value: '#759bb5', name: tr('group.colorBlueGray', 'Blue gray') }, { value: '#485f8d', name: tr('group.colorNavy', 'Navy') },
  { value: '#9285ad', name: tr('group.colorLavender', 'Lavender') }, { value: '#ad83a2', name: tr('group.colorRose', 'Dusty rose') },
];
/** A group without a colour of its own (legacy GROUP_FRAME_COLOR). 沒有自己顏色的群組（照舊產品）。 */
export const DEFAULT_GROUP_COLOR = GROUP_COLORS[0]!.value;
