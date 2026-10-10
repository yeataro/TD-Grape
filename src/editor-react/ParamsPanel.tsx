import { useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { core, typeColor } from './core';
import type { EditorState } from './editor';
import type { FlowNode } from './projection';
import { tr, say } from './text';
import { Select } from './controls';
import { ValueColumns, ValueFields } from './ValueFields';
import { useSession, TextContext } from './contexts';
import { Control, DeclarationValue, PortLabel, listed, single, sourceKinds } from './NodeCard';

// The Parameter panel (Refactor.76, human 2026-10-11; work/refactor/parameter-panel-scope-2026-10-11.md): the current node,
// drawn like a node card from the same declarations — the head in the node's group colour with its type and its name; every
// control with its label (the card leaves the labels out, Q67); each input's value, or where its wire comes from with
// Disconnect; then the node's note. Nothing selected: one line, the place kept for the Grape OP's own parameters later. The
// panel knows no node by kind. 參數面板（R.76，人類）：目前的節點，照同一份宣告畫成像節點卡片——標頭用節點的群組顏色、寫類型與名稱；
// 每個控制項帶標籤（卡片不帶，Q67）；每個輸入的值，或線從哪來＋斷開；最後是節點的註記。沒選：一行提示，位置留給之後的 Grape OP 自訂參數。
// 面板不認節點種類。

/** The name, as people see it: underscores as spaces; spaces typed become underscores (Refactor.76). Enter or leaving the
 * field renames; Esc puts it back. 名稱，給人看的樣子：底線顯示成空白，輸入的空白存成底線（R.76）。Enter 或離開欄位就改名；Esc 還原。 */
function NodeName({ id, name }: { id: string; name: string }) {
  const session = useSession(), shown = core.shownName(name), [value, setValue] = useState(shown), composing = useRef(false);
  useEffect(() => setValue(shown), [shown]);
  const commit = () => { if (value !== shown) session.rename(id, value); setValue(shown); };
  return <input className="params-name" value={value} maxLength={core.NAME_LIMIT} spellCheck={false} autoComplete="off"
    aria-label={say(tr('params.name', 'Name'))}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => { composing.current = false; setValue(core.typedName(event.currentTarget.value)); }}
    onChange={event => setValue(composing.current ? event.target.value : core.typedName(event.target.value))}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      else if (event.key === 'Escape') { event.preventDefault(); setValue(shown); requestAnimationFrame(() => (event.target as HTMLInputElement).blur()); }
    }} />;
}

/** The node's note, kept in the graph (its comment); saved when leaving the field. 節點的註記，存在圖裡（comment）；離開欄位時存。 */
function NodeNote({ id, note }: { id: string; note: string }) {
  const session = useSession(), [value, setValue] = useState(note);
  useEffect(() => setValue(note), [note]);
  return <label className="params-note">
    <span>{say(tr('params.notes', 'Notes'))}</span>
    <textarea value={value} rows={3} onChange={event => setValue(event.target.value)} onBlur={() => session.setNote(id, value)} />
  </label>;
}

function NodeParameters({ node, state }: { node: FlowNode; state: EditorState }) {
  const session = useSession(), text = useContext(TextContext);
  const { id, data } = node, { authored, view, inputs } = data;
  const valued = data.declaration?.kind === 'uniform' || data.declaration?.kind === 'constant' ? data.declaration : undefined;
  // Where a wired input's value comes from: the other node's name (or its type) and port. 接線的輸入：另一端節點的名稱（或類型）與接孔。
  const sourceOf = (port: string) => {
    const edge = state.projection.edges.find(e => e.target === id && e.targetHandle === port);
    if (!edge) return undefined;
    const from = state.projection.nodes.find(n => n.id === edge.source);
    const label = from?.data.authored.name ? core.shownName(from.data.authored.name) : from ? text(from.data.view.label ?? from.data.label) : edge.source;
    return label + ' · ' + edge.sourceHandle;
  };
  // A node standing for a shared source says which kind (Uniform, Global, TOP Input) where others say their type, as its card
  // does (human 2026-10-11: "Shared Source" alone said nothing). 代表共用來源的節點在類型的位置寫是哪一種（Uniform、Global、TOP
  // Input），同它的卡片（人類：只寫 Shared Source 什麼都沒說）。
  const kind = data.declaration && sourceKinds[data.declaration.kind];
  return <article className={`grape-node params-card${data.ghost ? ' ghost' : ''}`}
    style={{ '--group-color': `var(--group-${data.ghost ? 'ghost' : data.colorGroup})` } as CSSProperties}>
    <div className="node-title params-title">
      <strong>{kind ? say(kind) : text(data.label)}</strong>
      {/* A node standing for a shared source shows that source's name instead of its own, with its type (legacy
          inspector.js:858). 代表共用來源的節點顯示來源的名字（不是自己的）與型別（照舊產品）。 */}
      {core.takesName(core.registry, authored.nodeType)
        ? <NodeName id={id} name={authored.name ?? ''} />
        : <span className="params-source">{view.literalLabel ? view.label : text(view.label ?? data.label)} <small>{data.outputs[0]?.type}</small></span>}
    </div>
    {/* One grid for the whole body, as TD's parameter dialog (Refactor.76.2): names flush right | types | fields; every row
        lines up with the others (subgrid). 整個本體一張格線，照 TD 參數視窗（R.76.2）：名稱靠右｜型別｜欄位；每一列都和其他列對齊。 */}
    {!data.ghost && <div className="node-body params-grid"><ValueColumns.Provider value={true}>
      {!view.typeLocked && (view.selector
        ? <label className="control-field"><span>{say(tr('params.operationType', 'Operation type'))}</span>
          <Select label={`${id} type`} value={view.selector.value} onChange={value => session.edit(id, view.selector!.command, { value })} options={listed(view.selector.options)} /></label>
        : data.types.length > 1 && <label className="control-field"><span>{say(tr('params.operationType', 'Operation type'))}</span>
          <Select label={`${id} type`} value={String(authored.params.type)} onChange={value => session.configure(id, value)} options={listed(data.types)} /></label>)}
      {view.inlineControls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {valued && <DeclarationValue declaration={valued} />}
      {view.value && <ValueFields {...view.value} label={`${id} value`} commit={value => session.edit(id, view.value!.valueCommand, { value })} />}
      {inputs.map(port => {
        const source = sourceOf(port.key), label = <PortLabel text={view.portLabels?.inputs?.[port.key] ?? port.key}
          components={view.components?.inputs?.[port.key]} />;
        const head = <><span className="value-caption">{label}</span><span className="value-type">{port.type}</span></>;
        // The whole row takes a wire dragged from a node's output (Refactor.76.1); the socket shows where, filled when wired.
        // 整列都接得住從節點輸出拉來的線（R.76.1）；接孔標出位置，接了線就實心。
        return <div className="port-row input-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}
          data-component={single(view.components?.inputs?.[port.key])} data-panel-port={port.key} data-node={id}>
          <span className="params-port" data-connected={source !== undefined} aria-hidden="true" />
          {source !== undefined ? <>{head}<span className="params-wired"><span>{source}</span>
            <button type="button" onClick={() => session.disconnectInput(id, port.key)}>{say(tr('params.disconnect', 'Disconnect'))}</button></span></>
            : port.fallback !== undefined ? <>{head}<code className="port-fallback">{port.fallback}</code></>
            : core.values.types.includes(port.type) ? <ValueFields label={`${id} ${port.key}`} type={port.type} defaults={port.default} caption={label}
              value={authored.inputValues?.[port.key] ?? port.default ?? core.values.fill(0, port.type)} commit={value => session.setInput(id, port.key, value)} />
            : head}
        </div>;
      })}
      {view.controls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {view.note && <div className="hint">{view.note.text}</div>}
    </ValueColumns.Provider></div>}
    <NodeNote id={id} note={typeof authored.comment === 'string' ? authored.comment : ''} />
  </article>;
}

export function ParamsPanel({ state }: { state: EditorState }) {
  const session = useSession();
  const primary = useSyncExternalStore(session.selectionSubscribe, session.primarySnapshot);
  const node = primary === undefined || primary === null ? undefined : state.projection.nodes.find(n => n.id === primary);
  if (!node) return <p className="hint">{say(tr('params.empty', 'Select a node to edit its parameters.'))}</p>;
  // Keyed by node: moving to another node starts its fields afresh. 依節點分開：換節點時欄位重新開始。
  return <NodeParameters key={node.id} node={node} state={state} />;
}
