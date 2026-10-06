export type Geometry = { width: number; height: number; handles: { id: string; x: number; y: number; width: number; height: number }[] };

// RF observes outer size already. Explicit invalidation covers internal handle movement.
// RF 已監控卡片尺寸；只補同尺寸下的接孔增刪／內部位移，不把值當幾何。
export function needsHandleUpdate(before: Geometry | undefined, after: Geometry) {
  if (!before || before.width !== after.width || before.height !== after.height) return false;
  return before.handles.length !== after.handles.length || before.handles.some((item, i) => {
    const next = after.handles[i];
    return item.id !== next.id || item.x !== next.x || item.y !== next.y || item.width !== next.width || item.height !== next.height;
  });
}
export function measureHandles(card: HTMLElement): Geometry {
  return { width: card.offsetWidth, height: card.offsetHeight,
    handles: Array.from(card.querySelectorAll<HTMLElement>('.react-flow__handle')).map(handle => {
      let x = 0, y = 0, element: HTMLElement | null = handle;
      while (element && element !== card) { x += element.offsetLeft; y += element.offsetTop; element = element.offsetParent as HTMLElement | null; }
      return { id: `${handle.classList.contains('source') ? 'source' : 'target'}:${handle.dataset.handleid}`,
        x, y, width: handle.offsetWidth, height: handle.offsetHeight };
    }) };
}
