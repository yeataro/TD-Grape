import { Segmented } from './controls';
import { NumberField } from './NumberField';
import { say, tr } from './text';

// Text appearance (Refactor.101; human 2026-10-12): how a whole text is shown — its size, its alignment and, for a group, whether it sits
// above or below (R.105.16) — kept apart from the text
// itself (not Markdown). Shared: a group's text now, Notes later (legacy noteFontScale, noteTextAlign, inspector.js:638-649).
// 文字外觀（R.101；人類 10-12）：整段文字怎麼顯示——大小與對齊——和文字本身分開（不是 Markdown）。共用：現在是群組內文，之後是 Note
// （照舊產品的 noteFontScale、noteTextAlign）。

export type TextAlign = 'left' | 'center' | 'right';
export type TextPlace = 'top' | 'bottom';
/** The size in whole percent, 50 to 1000 (legacy: up to 10 times; smaller than half cannot be read). 大小用整數百分比，50 到 1000（舊產品：
 * 最多 10 倍；小於一半就看不清）。 */
const SIZE_MIN = 50, SIZE_MAX = 1000;
const percent = (value: number) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value)));
/** Sizes offered on the field's right-click list; 100 is the default (Refactor.101.3). 欄位右鍵列出的大小；100 是預設（R.101.3）。 */
const SIZES = [50, 75, 100, 125, 150, 200, 300];

/** `onPreview`: the size while it is dragged, null when let go (Refactor.101.1: seen at once, stored once). onPreview：拖曳中的大小，放開時
 * 為 null（R.101.1：立刻看得到，只存一次）。 */
export function TextStyle({ scale, align, place, onScale, onAlign, onPlace, onPreview }: {
  scale: number; align: TextAlign; place: TextPlace; onScale(scale: number): void; onAlign(align: TextAlign): void; onPlace(place: TextPlace): void;
  onPreview?(scale: number | null): void;
}) {
  // A name on the left, our value field on the right — typed, dragged or set from its ladder (Refactor.101.1, human 2026-10-12: typing
  // a percentage beats stepping). 左邊名字、右邊我們的數值欄位——可以打字、拖曳或用梯尺（R.101.1，人類：能直接輸入百分比比一級一級按好）。
  // Pressing the panel does not take the focus, except in a field: the text being written stays focused (a label, a gap, or a
  // button that Safari does not focus used to end the writing; deep clean 2026-10-12). 按面板不搶焦點（欄位除外）：正在寫的內文保持焦點
  // （以前按標籤、空隙，或 Safari 不給焦點的按鈕會結束編輯；10-12 深度清潔）。
  return <div className="text-style" onMouseDown={event => { if (!(event.target as Element).closest('input, textarea')) event.preventDefault(); }}>
    <label className="text-style-row">
      <span>{say(tr('textStyle.size', 'Text size'))}</span>
      {/* The % inside the box, as a value field's component letter (Refactor.101.2, human 2026-10-12). % 放在框裡，同數值欄位的分量字母
          （R.101.2，人類）。 */}
      <span className="value-field with-unit text-style-field">
        <NumberField label={say(tr('textStyle.size', 'Text size'))} value={Math.round(scale * 100)} integer unsigned commonValues={SIZES} defaultValue={100}
          // A preview back at the stored size is none: a cancelled drag ends there (deep clean 2026-10-12). 預覽回到存著的大小就是沒有預覽：
          // 取消的拖曳停在那裡（10-12 深度清潔）。
          preview={value => { const next = percent(value) / 100; onPreview?.(next === scale ? null : next); }}
          commit={value => { onPreview?.(null); onScale(percent(value) / 100); }} />
        <span className="field-unit">%</span>
      </span>
    </label>
    <Segmented label={tr('textStyle.align', 'Alignment')} value={align} onChange={onAlign} options={[
      { value: 'left', label: tr('textStyle.left', 'Left') }, { value: 'center', label: tr('textStyle.center', 'Center') },
      { value: 'right', label: tr('textStyle.right', 'Right') }]} />
    {/* Above or below, a two-way switch under the alignment (Refactor.105.16, human 2026-10-13). 靠上或置底，對齊下面的兩段切換（R.105.16，人類 10-13）。 */}
    <Segmented label={tr('textStyle.place', 'Position')} value={place} onChange={onPlace} options={[
      { value: 'top', label: tr('textStyle.top', 'Top') }, { value: 'bottom', label: tr('textStyle.bottom', 'Bottom') }]} />
  </div>;
}
