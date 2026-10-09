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
    return {selectorLabel: 'vector.inputType',
      // The output reads as the mask in the node's letters, e.g. "RG" (legacy graph_ui.js:1299). 輸出照遮罩、用節點的字母。
      portLabels: {outputs: {out: [...selected].map(letter).join('')}},
      components: {outputs: {out: [...selected].map(axis => axes.indexOf(axis))}},
      controls: [{
      kind: 'row', key: 'mask', label: 'vector.componentOrder', children: [
        ...[...selected].map((value,index) => ({kind:'select' as const,key:'component'+index,label:String(index+1),literal:true,command:'mask',args:{index},value,
          options:[...axes.slice(0,values.count(t))].map(value=>({value,label:letter(value),literal:true}))})),
        {kind:'button',key:'remove',label:'−',literal:true,command:'remove',disabled:selected.length===1},
        {kind:'button',key:'add',label:'+',literal:true,command:'add',disabled:selected.length===4}
      ]
    }]};
  },
  edit: (n, command, data) => {
    const t = String(n.params.type), previous = mask(t,n.params.mask ?? 'xy');
    if (command === 'add' && previous.length < 4) n.params.mask = previous + axes[Math.min(previous.length,values.count(t)-1)];
    else if (command === 'remove' && previous.length > 1) n.params.mask = previous.slice(0,-1);
    else if (command === 'mask' && data && typeof data === 'object' && !Array.isArray(data)) {
      const i = Number(data.index), value = String(payload(data));
      if (!Number.isInteger(i) || i<0 || i>=previous.length || value.length!==1) throw Error('Invalid swizzle component');
      n.params.mask = mask(t,previous.slice(0,i)+value+previous.slice(i+1));
    } else throw Error('Invalid swizzle command');
    return n;
  },
  emit: (n,c) => ({outputs:{out:'('+c.input('value')+').'+mask(String(n.params.type),n.params.mask ?? 'xy')}})
});
