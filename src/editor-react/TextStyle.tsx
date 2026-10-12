import { Segmented } from './controls';
import { say, tr } from './text';

// Text appearance (Refactor.101; human 2026-10-12): how a whole text is shown — its size factor and its alignment — kept apart from the
// text itself (not Markdown). Shared: a group's text now, Notes later (legacy noteFontScale, noteTextAlign, inspector.js:638-649).
// 文字外觀（R.101；人類 10-12）：整段文字怎麼顯示——字體倍率與對齊——和文字本身分開（不是 Markdown）。共用：現在是群組內文，之後是 Note
// （照舊產品的 noteFontScale、noteTextAlign）。

export type TextAlign = 'left' | 'center' | 'right';
/** The sizes A− and A+ step through (legacy took any number up to 10). A−／A+ 走過的大小（舊產品可填任何數，最大 10）。 */
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 10];

export function TextStyle({ scale, align, onScale, onAlign }: {
  scale: number; align: TextAlign; onScale(scale: number): void; onAlign(align: TextAlign): void;
}) {
  const at = SCALES.findIndex(step => step >= scale - 1e-9), smaller = SCALES[(at < 0 ? SCALES.length : at) - 1], larger = SCALES.find(step => step > scale + 1e-9);
  return <div className="text-style">
    <div className="text-style-row" role="group" aria-label={say(tr('textStyle.size', 'Text size'))}>
      <button type="button" aria-label={say(tr('textStyle.smaller', 'Smaller'))} title={say(tr('textStyle.smaller', 'Smaller'))}
        aria-disabled={smaller === undefined || undefined} onClick={() => { if (smaller !== undefined) onScale(smaller); }}>A−</button>
      <span className="text-style-value">{Math.round(scale * 100)}%</span>
      <button type="button" aria-label={say(tr('textStyle.larger', 'Larger'))} title={say(tr('textStyle.larger', 'Larger'))}
        aria-disabled={larger === undefined || undefined} onClick={() => { if (larger !== undefined) onScale(larger); }}>A+</button>
    </div>
    <Segmented label={tr('textStyle.align', 'Alignment')} value={align} onChange={onAlign} options={[
      { value: 'left', label: tr('textStyle.left', 'Left') }, { value: 'center', label: tr('textStyle.center', 'Center') },
      { value: 'right', label: tr('textStyle.right', 'Right') }]} />
  </div>;
}
