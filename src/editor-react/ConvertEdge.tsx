import { useSyncExternalStore, type CSSProperties } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { appearanceSubscribe, currentGradientBlend, shadowOn, type GradientBlend } from './appearance';

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

export function ConvertEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, interactionWidth, data,
  label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const gradient = useSyncExternalStore(appearanceSubscribe, () => shadowOn('wireGradient'));
  const blend = useSyncExternalStore(appearanceSubscribe, currentGradientBlend);
  const to = (data as { to?: string } | undefined)?.to, key = 'wire-gradient-' + id.replace(/[^\w-]/g, '_');
  const on = gradient && !!to;
  return <>
    {/* In the wire's own coordinates, from its source end to its target end. 用線本身的座標，從上游端到下游端。 */}
    {on && <defs><linearGradient id={key} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
      {stops(`var(--wire-start, ${String(style?.color ?? style?.stroke)})`, to!, blend).map(stop =>
        <stop key={stop.offset + stop.color} offset={stop.offset} style={{ stopColor: stop.color }} />)}</linearGradient></defs>}
    <BaseEdge id={id} path={path} style={on ? { ...style, stroke: `url(#${key})`, '--wire-paint': `url(#${key})` } as CSSProperties : style} markerEnd={markerEnd} interactionWidth={interactionWidth}
      label={label} labelX={labelX} labelY={labelY} labelStyle={labelStyle} labelShowBg={labelShowBg} labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding} labelBgBorderRadius={labelBgBorderRadius} />
  </>;
}
