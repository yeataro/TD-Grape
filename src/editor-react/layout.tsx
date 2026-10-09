import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { say, tr, type Message } from './text';
import { PANELS } from './panels';
import { readPreference, writePreference } from './preferences';

// The editor's layout (Refactor.53; work/in-place-refactor-design/floating-panels.md): a title bar, a left and a
// right panel zone around the network, panels in groups shown as tabs. The layout is a personal preference: kept
// in this browser, never in the project or the graph. A panel is only content; the zones, groups and tabs are
// this file's (design-interview Q47 5a: the shell changes, the content does not). Content comes from whoever
// renders the zone (the view being edited, Q47 4), never from globals.
// 編輯器的版面：標題列、網路區左右兩個面板區、面板分組成分頁。版面是個人偏好，只存在這個瀏覽器，不進專案或圖。
// 面板只是內容；區、組、分頁歸這個檔管（Q47 5a：換殼不換內容）。內容由畫出這一區的畫面提供，不讀全域。

export type Side = 'left' | 'right';
/** Panels shown together as tabs; `size` shares the zone's height with the other groups. 一組分頁；size 分配高度。 */
type Group = { panels: string[]; active: string; size: number };
type Zone = { open: boolean; width: number; groups: Group[] };
export type LayoutData = { version: 1; titleBar: boolean; left: Zone; right: Zone };
/** What a zone shows for one panel. 一個面板在區裡顯示什麼。 */
export type PanelView = { title: Message; content: ReactNode };

// Default arrangement from the panel table (panels.tsx): each side one group of its panels, in table order. The
// widths are tentative (human 2026-10-09: to be tuned). 預設配置由面板表決定：每一側一組、照表的順序。寬度暫定。
const rows = Object.entries(PANELS) as [string, { side: Side; first?: true }][];
const defaultZone = (side: Side, open: boolean): Zone => {
  const panels = rows.filter(([, row]) => row.side === side).map(([id]) => id);
  const active = panels.find(id => rows.find(([other]) => other === id)![1].first) ?? panels[0];
  return { open, width: 380, groups: active ? [{ panels, active, size: 1 }] : [] };
};
const defaults = (): LayoutData => ({ version: 1, titleBar: true, left: defaultZone('left', true), right: defaultZone('right', false) });
// A side is at least 300px wide (human 2026-10-09: 220 was too small; legacy: left 180, right 300).
// 一側至少 300px（人類：220 太小；舊產品左 180、右 300）。
export const ZONE_MIN = 300, ZONE_MAX = 900;

// A stored layout is used only if it reads cleanly; unknown panels are dropped and new ones go to their default
// side, so a later version never breaks it. Anything unreadable falls back to the defaults (no damage, no loss).
// 存的版面讀得懂才用：不認得的面板丟掉、新面板放到預設那一側；讀不懂就回到預設，不會壞也不丟資料。
function readLayout(): LayoutData {
  try {
    const stored = JSON.parse(readPreference('layout') ?? 'null') as LayoutData | null;
    if (!stored || stored.version !== 1) return defaults();
    const seen = new Set<string>(), zone = (side: Side): Zone => {
      const value = stored[side];
      const groups = (Array.isArray(value?.groups) ? value.groups : []).map(group => {
        const panels = (Array.isArray(group?.panels) ? group.panels : []).filter(id => id in PANELS && !seen.has(id) && seen.add(id));
        return { panels, active: panels.includes(group.active) ? group.active : panels[0]!, size: Number(group.size) > 0 ? Number(group.size) : 1 };
      }).filter(group => group.panels.length);
      return { open: value?.open !== false, groups,
        width: Math.min(ZONE_MAX, Math.max(ZONE_MIN, Number(value?.width) || defaults()[side].width)) };
    };
    const layout: LayoutData = { version: 1, titleBar: stored.titleBar !== false, left: zone('left'), right: zone('right') };
    for (const [id, { side }] of rows) if (!seen.has(id)) {
      const groups = layout[side].groups;
      if (groups[0]) groups[0].panels.push(id); else groups.push({ panels: [id], active: id, size: 1 });
    }
    return layout;
  } catch { return defaults(); }
}

export type Layout = LayoutData & {
  toggleTitleBar(): void; toggleZone(side: Side): void; setWidth(side: Side, width: number): void;
  /** Bring a panel forward: open its zone and its tab. 把面板叫到前面：打開它所在的區與分頁。 */
  show(id: string): void; activate(side: Side, group: number, id: string): void; resizeGroups(side: Side, sizes: number[]): void;
};
export function useLayout(): Layout {
  const [data, setData] = useState(readLayout);
  // Written shortly after the last change, so dragging a handle does not write on every move.
  // 停止變動後才寫入，拖把手時不會每一步都寫。
  useEffect(() => {
    const timer = setTimeout(() => writePreference('layout', JSON.stringify(data)), 250);
    return () => clearTimeout(timer);
  }, [data]);
  return useMemo(() => {
    const zone = (side: Side, change: (zone: Zone) => Zone) => setData(old => ({ ...old, [side]: change(old[side]) }));
    return { ...data,
      toggleTitleBar: () => setData(old => ({ ...old, titleBar: !old.titleBar })),
      toggleZone: side => zone(side, value => ({ ...value, open: !value.open })),
      setWidth: (side, width) => zone(side, value => ({ ...value, width: Math.min(ZONE_MAX, Math.max(ZONE_MIN, Math.round(width))) })),
      show: id => setData(old => {
        for (const side of ['left', 'right'] as const) {
          const index = old[side].groups.findIndex(group => group.panels.includes(id));
          if (index >= 0) return { ...old, [side]: { ...old[side], open: true,
            groups: old[side].groups.map((group, i) => i === index ? { ...group, active: id } : group) } };
        }
        return old;
      }),
      activate: (side, index, id) => zone(side, value => ({ ...value, groups: value.groups.map((group, i) => i === index ? { ...group, active: id } : group) })),
      resizeGroups: (side, sizes) => zone(side, value => ({ ...value, groups: value.groups.map((group, i) => ({ ...group, size: sizes[i] ?? group.size })) })),
    };
  }, [data]);
}

/** A drag handle: drawn thin, grabbed by a wider area (human 2026-10-09). Reports the distance moved.
 * 把手：畫得細、可抓範圍寬（人類）。回報拖了多遠。 */
export function ResizeHandle({ axis, label, onStart, onMove }: {
  axis: 'x' | 'y'; label: Message; onStart(): void; onMove(delta: number): void;
}) {
  const start = useRef<number | null>(null);
  const down = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    start.current = axis === 'x' ? event.clientX : event.clientY; onStart();
  };
  const move = (event: ReactPointerEvent) => {
    if (start.current === null) return;
    onMove((axis === 'x' ? event.clientX : event.clientY) - start.current);
  };
  const up = () => { start.current = null; };
  return <div className={'resize-handle resize-' + axis} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-label={say(label)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}

/** One side zone: its groups stacked, tabs on top of each, handles between groups and on the inner edge.
 * 一個側邊區：各組上下排，每組上面是分頁，組之間與內側邊緣有把手。 */
export function PanelZone({ side, layout, panels }: { side: Side; layout: Layout; panels: Record<string, PanelView> }) {
  const zone = layout[side], body = useRef<HTMLDivElement>(null);
  const width = useRef(zone.width), sizes = useRef<number[]>([]);
  if (!zone.open || !zone.groups.length) return null;
  const total = zone.groups.reduce((sum, group) => sum + group.size, 0);
  const edge = <ResizeHandle axis="x" label={tr('layout.resizeZone', 'Resize the panel zone')}
    onStart={() => { width.current = zone.width; }} onMove={delta => layout.setWidth(side, width.current + (side === 'left' ? delta : -delta))} />;
  return <aside className={'panel-zone panel-zone-' + side} style={{ width: zone.width }}>
    {side === 'right' && edge}
    <div className="panel-zone-body" ref={body}>{zone.groups.map((group, index) => <div key={group.panels.join(',')} className="panel-group-slot" style={{ flexGrow: group.size / total }}>
      {index > 0 && <ResizeHandle axis="y" label={tr('layout.resizeGroups', 'Resize the panels above and below')}
        onStart={() => { sizes.current = zone.groups.map(item => item.size); }}
        onMove={delta => {
          // Move height between this group and the one above, in shares of the zone's height. 在上下兩組之間移動高度。
          const height = body.current?.clientHeight || 1, share = delta / height * total, next = [...sizes.current];
          const above = next[index - 1]!, here = next[index]!, limit = total * .12;
          const moved = Math.max(limit - above, Math.min(here - limit, share));
          next[index - 1] = above + moved; next[index] = here - moved; layout.resizeGroups(side, next);
        }} />}
      <section className="panel-group" aria-label={say(panels[group.active]?.title ?? '')}>
        <div className="panel-tabs" role="tablist">{group.panels.map(id => <button key={id} role="tab" aria-selected={id === group.active}
          className="panel-tab" onClick={() => layout.activate(side, index, id)}>{say(panels[id]?.title ?? id)}</button>)}</div>
        <div className="panel-content" role="tabpanel">{panels[group.active]?.content}</div>
      </section></div>)}</div>
    {side === 'left' && edge}
  </aside>;
}
