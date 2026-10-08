import { createContext, memo, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { core, typeColor, type Value, type NodeControl, type NodePresentation } from './core';
import { NumberField } from './NumberField';
import type { FlowNode } from './projection';
import { spareHandle, type Editor as EditorSession } from './editor';
import { measureHandles, needsHandleUpdate, type Geometry } from './geometry';
import { tr, say } from './text';

export const SessionContext = createContext<EditorSession | null>(null);
export const TextContext = createContext<(key: string) => string>(key => key);
export const BodyDragContext = createContext(false);
export const useSession = () => useContext(SessionContext)!;

// Native input previews are local; native change commits the chosen colour.
// React 的 onChange 也會接到連續 input；改以原生 change 作提交，避免每次預覽一筆 Undo。
function ColorField({ value, label, commit, preview }: { value: string; label: string; commit: (value: string) => void; preview?: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const element = input.current!;
    const accept = () => { if (element.value !== value) commit(element.value); };
    element.addEventListener('change', accept);
    return () => element.removeEventListener('change', accept);
  }, [value, commit]);
  return <input ref={input} className="color-swatch nodrag" type="color" aria-label={label}
    value={draft} onInput={event => { setDraft(event.currentTarget.value); preview?.(event.currentTarget.value); }} onChange={() => {}} />;
}

export function ValueFields({ value, type, label, names = 'XYZW', color = false, commit, preview }: {
  value: Value; type: string; label: string; names?: string; color?: boolean; commit: (value: Value) => void;
  /** While dragging or picking, before the value is committed (Uniform C). 拖曳或點選中、提交之前。 */
  preview?: (value: Value) => void;
}) {
  const count = core.values.count(type), family = core.values.family(type);
  const list = Array.from({ length: count }, (_, i) => Array.isArray(value) ? value[i] ?? 0 : value);
  const hex = '#' + list.slice(0, 3).map(item => Math.round(Math.max(0, Math.min(1, Number(item))) * 255).toString(16).padStart(2, '0')).join('');
  const fromHex = (next: string): Value => [...([1, 3, 5].map(i => parseInt(next.slice(i, i + 2), 16) / 255)), ...list.slice(3)];
  return <div className="value-group nodrag nopan">
    {color && count >= 3 && <ColorField label={`${label} color`} value={hex}
      commit={next => commit(fromHex(next))} preview={preview && (next => preview(fromHex(next)))} />}
    <div className={`value-fields ${count > 1 ? 'vector-fields' : ''}`}>
      {list.map((item, i) => {
        const withComponent = (next: Value) => { const values = [...list]; values[i] = next; return count === 1 ? next : values; };
        const change = (next: Value) => commit(withComponent(next));
        return <label key={i}>
          {count > 1 && <span style={color ? { color: ['#ef8990', '#98d393', '#85bafa', '#ddd9e5'][i] } : undefined}>{names[i]}</span>}
          {family === 'bool' ? <select className="nodrag" aria-label={`${label} ${i}`} value={String(!!item)}
            onChange={event => change(event.target.value === 'true')}><option>false</option><option>true</option></select> :
            <NumberField label={`${label} ${i}`} value={Number(item)} integer={family === 'int' || family === 'uint'} unsigned={family === 'uint'} commit={change}
              preview={preview && (next => preview(withComponent(next)))} />}
        </label>;
      })}
    </div>
  </div>;
}
function Control({ id, control }: { id: string; control: NodeControl }) {
  const session = useSession(), text = useContext(TextContext);
  const label = control.literal ? control.label : text(control.label);
  if (control.kind === 'row') return <div className="control-row">{control.children?.map(child => <Control key={child.key} id={id} control={child} />)}</div>;
  if (control.kind === 'hint') return <div className="hint">{label}</div>;
  if (control.kind === 'button') return <button className="nodrag" disabled={control.disabled}
    onClick={() => session.edit(id, control.command!, control.args ?? {})}>{label}</button>;
  return <label className="control-field nodrag"><span>{label}</span><select aria-label={`${id} ${control.key}`}
    value={control.value} disabled={control.disabled} onChange={event => session.edit(id, control.command!, {
      ...control.args, value: control.numeric ? Number(event.target.value) : event.target.value })}>
    {control.options?.map(option => <option key={option.value} value={option.value}>{option.literal ? option.label : text(option.label)}</option>)}
  </select></label>;
}

// Drawn from the module's spare declaration only; no node-specific branch here.
// 只依模組宣告的 spare 繪製；接線後由 session 執行模組命令，renderer 不認節點。
function SpareInput({ id, spare }: { id: string; spare: NonNullable<NodePresentation['spare']> }) {
  const text = useContext(TextContext), open = spare.count < spare.limit;
  return <div className={`port-row input-row spare-row ${open ? '' : 'full'}`} style={{ '--port-color': typeColor(spare.type) } as CSSProperties}>
    <Handle type="target" position={Position.Left} id={spareHandle} isConnectable={open} aria-label={`${id} ${text(spare.label)}`} />
    <span>{open ? '＋ ' + text(spare.label) : text(spare.limitLabel)}</span>
  </div>;
}

export const NodeCard = memo(function NodeCard({ id, data, selected }: NodeProps<FlowNode>) {
  const session = useSession(), text = useContext(TextContext), bodyDrag = useContext(BodyDragContext);
  const card = useRef<HTMLElement>(null), measured = useRef<Geometry>(undefined);
  const updateInternals = useUpdateNodeInternals();
  const { authored, view, inputs, outputs } = data;
  const inspect = () => {
    if (!card.current) return;
    const next = measureHandles(card.current);
    if (needsHandleUpdate(measured.current, next)) updateInternals(id);
    measured.current = next;
  };
  // Read actual committed layout, never serialize control values as a geometry key.
  // 僅在該卡片 commit 後檢查實際接孔；非逐幀掃描，外框變大由 RF 量測。
  useLayoutEffect(inspect);
  useEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(inspect);
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [id, updateInternals]);
  // Ghost (Q37 1-1): kept as stored, shown with the ports its wires use, no controls, not compiled.
  // Ghost：原樣保留，只畫它的線用到的接孔，沒有控制項，不參與產碼。
  if (data.ghost) return <article ref={card} className={`grape-node ghost ${selected ? 'selected' : ''}`}
    style={{ '--group-color': 'var(--group-ghost)' } as CSSProperties}>
    <div className="node-title node-drag-surface"><strong>{authored.name || text(data.label)}</strong><small>Ghost</small></div>
    <div className="node-body node-drag-surface">
      <div className="ghost-note">{say(data.ghost === 'misplaced'
        ? tr('ghost.misplaced', '{type} cannot be used here. Kept as it is, left out of the shader.', { type: authored.nodeType })
        : data.ghost === 'missing'
        ? tr('ghost.missing', 'The shared source it points to no longer exists. Kept as it is, left out of the shader.')
        : tr('ghost.unknown', 'This version does not understand {type}. Kept as it is, left out of the shader.', { type: authored.nodeType }))}</div>
      {inputs.map(port => <div className="port-row input-row" key={port.key}>
        <Handle type="target" position={Position.Left} id={port.key} isConnectable={false} aria-label={`${id} input ${port.key}`} />
        <span>{port.key}</span></div>)}
      {outputs.map(port => <div className="port-row output-row" key={port.key}>
        <span>{port.key}</span>
        <Handle type="source" position={Position.Right} id={port.key} isConnectable={false} aria-label={`${id} output ${port.key}`} />
      </div>)}
    </div>
  </article>;
  return <article ref={card} className={`grape-node ${selected ? 'selected' : ''}`}
    style={{ '--group-color': `var(--group-${data.colorGroup})` } as CSSProperties}>
    <div className="node-title node-drag-surface"><strong>{text(view.label ?? data.label)}</strong>
      {view.selector ? <select className="nodrag" aria-label={`${id} type`} value={view.selector.value}
        onChange={event => session.edit(id, view.selector!.command, { value: event.target.value })}>
        {view.selector.options.map(type => <option key={type}>{type}</option>)}</select> :
        data.types.length > 1 ? <select className="nodrag" aria-label={`${id} type`} value={String(authored.params.type)}
          onChange={event => session.configure(id, event.target.value)}>{data.types.map(type => <option key={type}>{type}</option>)}</select> :
          <small>{outputs[0]?.type}</small>}
    </div>
    <div className={`node-body ${bodyDrag ? 'node-drag-surface' : ''}`}>
      {view.inlineControls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {view.value && <ValueFields {...view.value} label={`${id} value`} commit={value => session.edit(id, view.value!.valueCommand, { value })} />}
      {inputs.map(port => <div className="port-row input-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
        <Handle type="target" position={Position.Left} id={port.key} aria-label={`${id} input ${port.key}`} />
        <span>{view.portLabels?.inputs?.[port.key] ?? port.key} <small>{port.type}</small></span>
        {/* Unconnected: a fixed expression (e.g. vUV.st) is shown, not edited; a texture has no value.
            沒接線：固定式子只顯示不編輯；貼圖沒有值。 */}
        {!data.connected.includes(port.key) && (port.fallback !== undefined ? <code className="port-fallback">{port.fallback}</code>
          : core.values.types.includes(port.type) && <ValueFields label={`${id} ${port.key}`} type={port.type}
          value={authored.inputValues?.[port.key] ?? port.default ?? core.values.fill(0, port.type)} commit={value => session.setInput(id, port.key, value)} />)}
      </div>)}
      {view.spare?.direction === 'input' && <SpareInput id={id} spare={view.spare} />}
      {view.controls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {view.note && <div className="hint">{view.note.text}</div>}
      {outputs.map(port => <div className="port-row output-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
        <span>{view.portLabels?.outputs?.[port.key] ?? port.key}</span><small>{port.type}</small>
        <Handle type="source" position={Position.Right} id={port.key} aria-label={`${id} output ${port.key}`} />
      </div>)}
    </div>
  </article>;
});
