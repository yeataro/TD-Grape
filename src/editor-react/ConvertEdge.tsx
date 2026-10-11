import { useSyncExternalStore, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { crossedFingersOutline, crossedFingersPath, crossedFingersViewBox } from './crossed_fingers';
import { appearanceSubscribe, componentTintOn, currentConvertLabel, currentGradientBlend, shadowOn, type GradientBlend } from './appearance';

/** A wire whose two ends have different types, the conversion done on it (design-interview Q11: the wire carries the
 * conversion). Drawn as React Flow's own wire; under the trial switch (Refactor.77.1, human 2026-10-11: some editors show a
 * conversion as a gradient; Q11 left gradient or split colours to be compared) its colour runs from the source port's type
 * colour to the target port's. Hover and selection still take over; under component tint it starts at the component's
 * colour (--wire-start), and the tint rule uses the wire's own paint (--wire-paint) first (Refactor.77.3).
 * 兩端型別不同、在線上做轉換的線（Q11：轉換由線負責）。照 React Flow 原本的線畫；試驗開關打開時（R.77.1，人類：有些框架用漸層線表示
 * 型別轉換；Q11 留待比較漸層或分色）線色從上游接孔的型別色漸變到下游接孔的型別色。滑過、選取照常蓋過；分量染色時從分量色開始
 * （--wire-start），染色規則優先用線自帶的顏色（--wire-paint）（R.77.3）。 */

/** The gradient's stops from one colour to the other (Refactor.77.4, 77.5): linear is the two ends; step cuts at the middle,
 * one colour each side; smoothstep places nine stops along the smoothstep curve, mixed in sRGB as linear is; oklab and oklch
 * place nine even stops mixed in that space. CSS mixes them, so theme colours and --wire-start stay variables.
 * 漸層從一色到另一色的色標（R.77.4、77.5）：linear 只有兩端；step 從中間截斷、兩邊各一色；smoothstep 沿 smoothstep 曲線放九個色標、
 * 和 linear 一樣在 sRGB 混；oklab、oklch 等距放九個色標、在該色彩空間混。由 CSS 混色，主題色與 --wire-start 仍是變數。 */
function stops(from: string, to: string, blend: GradientBlend): { offset: number; color: string }[] {
  if (blend === 'linear') return [{ offset: 0, color: from }, { offset: 1, color: to }];
  if (blend === 'step') return [{ offset: 0.5, color: from }, { offset: 0.5, color: to }];
  const space = blend === 'oklch' || blend === 'oklab' ? blend : 'srgb';
  return Array.from({ length: 9 }, (_, i) => {
    const t = i / 8, share = blend === 'smoothstep' ? t * t * (3 - 2 * t) : t;
    return { offset: t, color: `color-mix(in ${space}, ${to} ${(share * 100).toFixed(1)}%, ${from})` };
  });
}

/** The hand with crossed fingers (Refactor.77.8–77.10, human 2026-10-11: the lines carry the colours, on a white hand): Fluent
 * UI Emoji's line drawing (MIT, crossed_fingers.ts) filled with the two ends' colours, blending across the hand from its middle
 * out to its sides, over its own outer edge in white. 交叉手指（R.77.8–77.10，人類：漸層在線條上、手的底是白色）：Fluent UI Emoji 的
 * 線稿（MIT）填兩端顏色，在手的範圍內從中間往兩邊漸變；底下是它自己的外輪廓，填白色。 */
function CrossedFingers({ id }: { id: string }) {
  return <svg viewBox={crossedFingersViewBox} aria-hidden="true">
    <defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1="4" y1="16" x2="28" y2="16">
      <stop offset="0.3" style={{ stopColor: 'var(--convert-from)' }} /><stop offset="0.7" style={{ stopColor: 'var(--convert-to)' }} /></linearGradient></defs>
    <path d={crossedFingersOutline()} fill="var(--wire-convert-paper)" />
    <path d={crossedFingersPath} fill={`url(#${id})`} />
  </svg>;
}

export function ConvertEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, interactionWidth, data }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const gradient = useSyncExternalStore(appearanceSubscribe, () => shadowOn('wireGradient'));
  const blend = useSyncExternalStore(appearanceSubscribe, currentGradientBlend);
  const shown = useSyncExternalStore(appearanceSubscribe, currentConvertLabel);
  const tint = useSyncExternalStore(appearanceSubscribe, componentTintOn);
  const facts = (data ?? {}) as { to?: string; fromType?: string; toType?: string; component?: number };
  const to = facts.to, key = 'wire-gradient-' + id.replace(/[^\w-]/g, '_'), from = String(style?.color ?? style?.stroke);
  const on = gradient && !!to;
  // The two ends' colours for the label; under component tint the start takes the component's colour (style.css).
  // 標籤用的兩端顏色；分量染色時起點用分量色（style.css）。
  const start = tint && facts.component !== undefined ? `var(--component-${'xyzw'[facts.component]})` : from;
  const ends = { '--convert-from': start, '--convert-to': to, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` } as CSSProperties;
  return <>
    {/* In the wire's own coordinates, from its source end to its target end. 用線本身的座標，從上游端到下游端。 */}
    {on && <defs><linearGradient id={key} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
      {stops(`var(--wire-start, ${from})`, to!, blend).map(stop =>
        <stop key={stop.offset + stop.color} offset={stop.offset} style={{ stopColor: stop.color }} />)}</linearGradient></defs>}
    <BaseEdge id={id} path={path} style={on ? { ...style, stroke: `url(#${key})`, '--wire-paint': `url(#${key})` } as CSSProperties : style}
      markerEnd={markerEnd} interactionWidth={interactionWidth} />
    {/* The label (Refactor.77.6, a trial in the gear): none, the two type names in the two ends' colours, or the hand.
        標籤（R.77.6，齒輪裡的試驗）：不顯示、兩個型別名稱用兩端顏色、或手勢圖示。 */}
    {shown !== 'none' && to && <EdgeLabelRenderer>
      <span className={'wire-convert ' + shown} style={ends}>
        {shown === 'text' ? <><span className="from">{facts.fromType}</span><span className="arrow" aria-hidden="true">→</span><span className="to">{facts.toType}</span></>
          : <CrossedFingers id={key + '-hand'} />}
      </span>
    </EdgeLabelRenderer>}
  </>;
}
