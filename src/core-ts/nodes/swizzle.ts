import { typedNode, input, output, payload, values, storedOr, componentLetters } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "swizzle",
    "label": "Swizzle",
    "inputs": {
      "value": "vec2"
    },
    "outputs": {
      "out": "vec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec2",
      "mask": "xy"
    },
    "descriptionKey": "help.swizzle",
    "definitionUuid": "sgrape.builtin.swizzle"
  },
  "emitter": {
    "id": "swizzle",
    "version": 1
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "component mask",
      "reorder",
      "shuffle",
      "分量",
      "重排",
      "取分量"
    ],
    "glslName": "swizzle",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
};

const axes = 'xyzw';
const NONE = ''; // the empty menu, "—" 空的選單「—」
function mask(type: string, value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 4 || [...value].some(p => !axes.slice(0,values.count(type)).includes(p)))
    throw Error('Choose existing vector components');
  return value;
}
export default typedNode(catalog, {
  types: values.vectors,
  creations: wire => {
    if (wire && !values.types.includes(wire.type)) return undefined;
    const size = wire ? values.count(wire.type) : 2;
    return values.vectors.filter(t => values.count(t) >= size).map(type => ({type,mask:axes.slice(0,size)}));
  },
  ports: (t, n) => [input('value',t),output('out',values.shaped(values.family(t),mask(t,n.params.mask ?? 'xy').length))],
  inheritsComponentNames: true,
  presentation: n => {
    const t = String(n.params.type), selected = mask(t,n.params.mask ?? 'xy');
    const letters = componentLetters(storedOr(n, 'xyzw'), values.count(t)), letter = (axis: string) => letters[axes.indexOf(axis)] ?? axis.toUpperCase();
    const places = componentLetters(storedOr(n, 'xyzw'), 4); // the output's places, up to four 輸出的位置，最多四個
    return {selectorLabel: 'vector.inputType',
      // The output reads as the mask in the node's letters, e.g. "RG" (legacy graph_ui.js:1299). 輸出照遮罩、用節點的字母。
      portLabels: {outputs: {out: [...selected].map(letter).join('')}},
      components: {outputs: {out: [...selected].map(axis => axes.indexOf(axis))}},
      // Each menu is named by the output component it fills, in the node's letters and that component's colour (Refactor.80.3,
      // human 2026-10-11: not 1, 2…). One more empty menu follows (while there are fewer than four): choosing a component there
      // adds it; choosing "—" in a menu takes that component out and the rest move up (Refactor.81, human 2026-10-11: no plus
      // or minus, what matters is the components). The last one cannot be taken out. 每個選單以它填的輸出分量命名，用節點的字母
      // 與分量色（R.80.3，人類：不要 1、2…）。後面多一格空的選單（不到四個時）：在那裡選分量就加一個；在選單選「—」就拿掉那個分量，
      // 後面的往前補（R.81，人類：不要加減，重要的是分量）。最後一個不能拿掉。
      controls: [{
      kind: 'row', key: 'mask', label: 'vector.componentOrder', children:
        [...selected, ...(selected.length < 4 ? [NONE] : [])].map((value,index) => ({kind:'select' as const,key:'component'+index,
          label:places[index] ?? String(index+1),literal:true,component:index,command:'mask',args:{index},value,
          options:[...(selected.length > 1 || index === selected.length ? [{value:NONE,label:'—',literal:true}] : []),
            ...[...axes.slice(0,values.count(t))].map(value=>({value,label:letter(value),literal:true}))]}))
    }]};
  },
  edit: (n, command, data) => {
    const t = String(n.params.type), previous = mask(t,n.params.mask ?? 'xy');
    if (command === 'mask' && data && typeof data === 'object' && !Array.isArray(data)) {
      // A component at index i: set it, add it at the end (the empty menu), or take it out ("—"). 第 i 個分量：設定、在最後加上、或拿掉。
      const i = Number(data.index), value = String(payload(data));
      if (!Number.isInteger(i) || i<0 || i>previous.length || i>=4) throw Error('Invalid swizzle component');
      if (value === NONE) {
        if (i === previous.length) return n;
        if (previous.length === 1) throw Error('Keep at least one component');
        n.params.mask = previous.slice(0,i)+previous.slice(i+1);
      } else {
        if (value.length!==1) throw Error('Invalid swizzle component');
        n.params.mask = mask(t,previous.slice(0,i)+value+previous.slice(i+1));
      }
    } else throw Error('Invalid swizzle command');
    return n;
  },
  emit: (n,c) => ({outputs:{out:'('+c.input('value')+').'+mask(String(n.params.type),n.params.mask ?? 'xy')}})
});
