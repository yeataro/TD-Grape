import { Segmented } from './controls';
import { NumberField } from './NumberField';
import { say, tr } from './text';

// Text appearance (Refactor.101; human 2026-10-12): how a whole text is shown — its size and its alignment — kept apart from the text
// itself (not Markdown). Shared: a group's text now, Notes later (legacy noteFontScale, noteTextAlign, inspector.js:638-649).
// 文字外觀（R.101；人類 10-12）：整段文字怎麼顯示——大小與對齊——和文字本身分開（不是 Markdown）。共用：現在是群組內文，之後是 Note
// （照舊產品的 noteFontScale、noteTextAlign）。

export type TextAlign = 'left' | 'center' | 'right';
/** The size in whole percent, 50 to 1000 (legacy: up to 10 times; smaller than half cannot be read). 大小用整數百分比，50 到 1000（舊產品：
 * 最多 10 倍；小於一半就看不清）。 */
const SIZE_MIN = 50, SIZE_MAX = 1000;
const percent = (value: number) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value)));

/** `onPreview`: the size while it is dragged, null when let go (Refactor.101.1: seen at once, stored once). onPreview：拖曳中的大小，放開時
 * 為 null（R.101.1：立刻看得到，只存一次）。 */
export function TextStyle({ scale, align, onScale, onAlign, onPreview }: {
  scale: number; align: TextAlign; onScale(scale: number): void; onAlign(align: TextAlign): void; onPreview?(scale: number | null): void;
}) {
  // A name on the left, our value field on the right — typed, dragged or set from its ladder (Refactor.101.1, human 2026-10-12: typing
  // a percentage beats stepping). 左邊名字、右邊我們的數值欄位——可以打字、拖曳或用梯尺（R.101.1，人類：能直接輸入百分比比一級一級按好）。
  return <div className="text-style">
    <label className="text-style-row">
      <span>{say(tr('textStyle.size', 'Text size'))}</span>
      <span className="text-style-field">
        <NumberField label={say(tr('textStyle.size', 'Text size'))} value={Math.round(scale * 100)} integer unsigned
          preview={value => onPreview?.(percent(value) / 100)} commit={value => { onPreview?.(null); onScale(percent(value) / 100); }} />
        <span className="text-style-unit">%</span>
      </span>
    </label>
    <Segmented label={tr('textStyle.align', 'Alignment')} value={align} onChange={onAlign} options={[
      { value: 'left', label: tr('textStyle.left', 'Left') }, { value: 'center', label: tr('textStyle.center', 'Center') },
      { value: 'right', label: tr('textStyle.right', 'Right') }]} />
  </div>;
}
