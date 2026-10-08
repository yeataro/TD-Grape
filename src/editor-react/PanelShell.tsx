import type { ReactNode } from 'react';
import { say, type Message } from './text';

// The frame around a panel's content. For now it is fixed to one side; the floating frame
// (design-interview Q47 5: place anywhere, several at once, remembered, snapping to edges) will
// replace only this shell, never the content (human 2026-10-09, Refactor.40).
// 面板外框：目前固定在一側；之後的浮動框架只換這層殼，內容不動。
export function PanelShell({ title, onClose, children }: { title: Message; onClose: () => void; children: ReactNode }) {
  return <aside className="panel" aria-label={say(title)}>
    <header className="panel-title"><strong>{say(title)}</strong>
      <button className="panel-close" aria-label="×" onClick={onClose}>×</button></header>
    <div className="panel-body">{children}</div>
  </aside>;
}
