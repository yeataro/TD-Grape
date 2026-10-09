import type { CSSProperties, ReactNode } from 'react';
import { typeColor } from './core';

/** One output of a node or of a Sources card (Refactor.58.1, as the legacy cards): its name and type, in its type's colour,
 * then the port: React Flow's on a node, a dot on a card (it only shows; wires start on the canvas). Styles: style.css,
 * "port-row" and "port-dot". 節點或來源卡片的一個輸出（同舊產品卡片）：名稱與型別、用型別色，接著是接孔——節點上是 React Flow 的，
 * 卡片上是一個點（只顯示；拉線在畫布上）。 */
export const OutputRow = ({ label, type, children }: { label: ReactNode; type: string; children: ReactNode }) =>
  <div className="port-row output-row" style={{ '--port-color': typeColor(type) } as CSSProperties}>
    <span>{label} <small>{type}</small></span>{children}</div>;
