import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { core, type Declaration } from './core';
import { tr, say } from './text';
import { ValueFields, useSession } from './NodeCard';

// Shared Sources panel content (design-interview Q41 naming, Q45: the panel is an index — it keeps
// no list of its own, it reads the graph's declarations). This round: global constants only.
// 共用來源面板的內容：面板只是索引，讀圖的宣告、不另存清單。本輪只有全域常數。
function NameField({ declaration }: { declaration: Declaration }) {
  const session = useSession(), [draft, setDraft] = useState(declaration.name);
  useEffect(() => setDraft(declaration.name), [declaration.name]);
  const commit = () => { if (draft !== declaration.name && !session.renameDeclaration(declaration.id, draft)) setDraft(declaration.name); };
  return <input className="source-name" aria-label={say(tr('sources.name', 'Name'))} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(declaration.name); event.currentTarget.blur(); } }} />;
}

export function SourcesPanel({ declarations, references }: { declarations: readonly Declaration[]; references: Readonly<Record<string, number>> }) {
  const session = useSession(), flow = useReactFlow();
  const constants = declarations.filter(d => d.kind === 'constant');
  const center = () => {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 });
  };
  const types = core.declarationKinds.get('constant')!.types;
  return <section className="sources">
    <header className="sources-section"><span>{say(tr('sources.constants', 'Global constants'))}</span>
      <button onClick={() => session.addConstant()}>{say(tr('sources.addConstant', '+ Add constant'))}</button></header>
    {!constants.length && <p className="hint">{say(tr('sources.noConstants', 'No global constants yet. A constant is written into the shader as const and can be used by many nodes.'))}</p>}
    {constants.map(declaration => <div className="source-row" key={declaration.id}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <select aria-label={say(tr('sources.type', 'Type'))} value={declaration.type}
          onChange={event => session.setDeclarationType(declaration.id, event.target.value)}>
          {types.map(type => <option key={type}>{type}</option>)}</select>
      </div>
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value}
        commit={value => session.setDeclarationValue(declaration.id, value)} />
      <div className="source-actions">
        <small>{say(tr('sources.usedBy', 'Used by {count} nodes', { count: references[declaration.id] ?? 0 }))}</small>
        <button onClick={() => session.placeDeclaration(declaration.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
        <button onClick={() => session.removeDeclaration(declaration.id)}>{say(tr('sources.remove', 'Delete'))}</button>
      </div>
    </div>)}
  </section>;
}
