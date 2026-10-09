import { memo, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { core, typeColor, type NodeControl, type NodePresentation } from './core';
import type { FlowNode } from './projection';
import { spareHandle } from './editor';
import { measureHandles, needsHandleUpdate, type Geometry } from './geometry';
import { BoxPreviewContext } from './RightDragSelect';
import { tr, say } from './text';
import { Select } from './controls';
import { ValueFields } from './ValueFields';
import { useSession, TextContext, BodyDragContext } from './contexts';

/** Choices shown as they are written (type names). 照原樣顯示的選項（型別名）。 */
const listed = (values: readonly string[]) => values.map(value => ({ value, label: value }));


function Control({ id, control }: { id: string; control: NodeControl }) {
  const session = useSession(), text = useContext(TextContext);
  const label = control.literal ? control.label : text(control.label);
  if (control.kind === 'row') return <div className="control-row">{control.children?.map(child => <Control key={child.key} id={id} control={child} />)}</div>;
  if (control.kind === 'hint') return <div className="hint">{label}</div>;
  if (control.kind === 'button') return <button className="nodrag" disabled={control.disabled}
    onClick={() => session.edit(id, control.command!, control.args ?? {})}>{label}</button>;
  return <label className="control-field nodrag"><span>{label}</span><Select label={`${id} ${control.key}`}
    value={String(control.value)} disabled={control.disabled} onChange={value => session.edit(id, control.command!, {
      ...control.args, value: control.numeric ? Number(value) : value })}
    options={control.options?.map(option => ({ value: String(option.value), label: option.literal ? option.label : text(option.label) })) ?? []} /></label>;
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
  // The primary selection is told from above, never known by the node module (Q33). 主要選取由上往下得知，節點模組不知道。
  const primary = useSyncExternalStore(session.selectionSubscribe, session.primarySnapshot) === id;
  // While a box is dragged: dashed = will be selected on release (Refactor.50.1). The current selection
  // stays as it is until release (50.2, human: no fading; the legacy editor kept it, with a frame around it).
  // 框選拖曳中：虛線＝放開會被選。目前的選取維持原樣到放開（50.2，人類：不淡化；舊產品保留它，外面還有多選框）。
  const preview = useContext(BoxPreviewContext);
  const selection = (selected ? (primary ? 'selected primary' : 'selected') : '') + (preview?.has(id) && !selected ? ' box-in' : '');
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
  if (data.ghost) return <article ref={card} className={`grape-node ghost ${selection}`}
    style={{ '--group-color': 'var(--group-ghost)' } as CSSProperties}>
    <div className="node-title node-drag-surface"><strong>{authored.name || text(data.label)}</strong><small>Ghost</small></div>
    <div className="node-body node-drag-surface">
      <div className="ghost-note">{say(data.ghost === 'misplaced'
        ? tr('ghost.misplaced', '{type} cannot be used here. Kept as it is, left out of the shader.', { type: authored.nodeType })
        : data.ghost === 'missing'
        ? tr('ghost.missing', 'The shared source it points to no longer exists. Kept as it is, left out of the shader.')
        : tr('ghost.unknown', 'This version does not understand {type}. Kept as it is, left out of the shader.', { type: authored.nodeType }))}</div>
      {inputs.map(port => <div className="port-row input-row" key={port.key}>
        <Handle type="target" position={Position.Left} id={port.key} isConnectable={false} aria-label={`${id} input ${port.key}`} data-connected="true" />
        <span>{port.key}</span></div>)}
      {outputs.map(port => <div className="port-row output-row" key={port.key}>
        <span>{port.key}</span>
        <Handle type="source" position={Position.Right} id={port.key} isConnectable={false} aria-label={`${id} output ${port.key}`} data-connected="true" />
      </div>)}
    </div>
  </article>;
  return <article ref={card} className={`grape-node ${selection}`}
    style={{ '--group-color': `var(--group-${data.colorGroup})` } as CSSProperties}>
    <div className="node-title node-drag-surface"><strong>{view.literalLabel ? view.label : text(view.label ?? data.label)}</strong>
      {view.typeLocked ? <small>{outputs[0]?.type}</small> : view.selector ? <Select className="nodrag" label={`${id} type`} value={view.selector.value}
        onChange={value => session.edit(id, view.selector!.command, { value })} options={listed(view.selector.options)} /> :
        data.types.length > 1 ? <Select className="nodrag" label={`${id} type`} value={String(authored.params.type)}
          onChange={value => session.configure(id, value)} options={listed(data.types)} /> :
          <small>{outputs[0]?.type}</small>}
    </div>
    <div className={`node-body ${bodyDrag ? 'node-drag-surface' : ''}`}>
      {view.inlineControls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {view.value && <ValueFields {...view.value} label={`${id} value`} commit={value => session.edit(id, view.value!.valueCommand, { value })} />}
      {inputs.map(port => { const wired = data.connected.includes(port.key);
        return <div className="port-row input-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
        <Handle type="target" position={Position.Left} id={port.key} aria-label={`${id} input ${port.key}`} data-connected={wired} />
        <span>{view.portLabels?.inputs?.[port.key] ?? port.key} <small>{port.type}</small></span>
        {/* A fixed expression (e.g. vUV.st) is shown, not edited; a texture has no value. A wire hides the value but keeps
            its place (wiring never changes the height, EDITOR_UI_RULES.md 六). 固定式子只顯示不編輯；貼圖沒有值。接線只藏起值、位置留著。 */}
        {port.fallback !== undefined ? <code className={'port-fallback' + (wired ? ' wired' : '')}>{port.fallback}</code>
          : core.values.types.includes(port.type) && <ValueFields label={`${id} ${port.key}`} type={port.type} wired={wired}
          value={authored.inputValues?.[port.key] ?? port.default ?? core.values.fill(0, port.type)} commit={value => session.setInput(id, port.key, value)} />}
      </div>; })}
      {view.spare?.direction === 'input' && <SpareInput id={id} spare={view.spare} />}
      {view.controls?.map(control => <Control key={control.key} id={id} control={control} />)}
      {view.note && <div className="hint">{view.note.text}</div>}
      {outputs.map(port => <div className="port-row output-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
        <span>{view.portLabels?.outputs?.[port.key] ?? port.key}</span><small>{port.type}</small>
        {/* Whether a port has a wire is data; how it looks is the theme's (port styles A/B, Refactor.54.2).
            接孔有沒有接線是資料；長什麼樣子由主題決定（接孔樣式 A／B）。 */}
        <Handle type="source" position={Position.Right} id={port.key} aria-label={`${id} output ${port.key}`} data-connected={data.wired.includes(port.key)} />
      </div>)}
    </div>
  </article>;
});
