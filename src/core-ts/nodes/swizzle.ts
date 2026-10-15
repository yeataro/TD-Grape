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
    "nodeType": "sgrape.builtin.swizzle"
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
  // Wired, the input takes the wire's size (Refactor.81.2, design-interview Q73): what you choose is the output (its components),
  // the input is whatever comes in. The components stay, so the output stays; a chosen component the new size lacks refuses the
  // wire (say W on a vec3). int and float stay as they are: the wire converts, and changing them would change the output (Q71).
  // 接上線時，輸入改成線的大小（R.81.2，Q73）：選的是輸出（分量），輸入接什麼就是什麼。分量不變，輸出也不變；選到的分量新大小沒有時
  // 擋下（例如 vec3 沒有 W）。int、float 不換：線上會轉，換了會改輸出（Q71）。
  wire: (n, key, source) => {
    if (key === 'value' && values.vectors.includes(source)) {
      const t = values.shaped(values.family(String(n.params.type)), values.count(source));
      mask(t, n.params.mask ?? 'xy');
      n.params.type = t;
    }
    return {node: n, replaceInputs: ['value']};
  },
  presentation: n => {
    const t = String(n.params.type), selected = mask(t,n.params.mask ?? 'xy');
    const letters = componentLetters(storedOr(n, 'xyzw'), values.count(t)), letter = (axis: string) => letters[axes.indexOf(axis)] ?? axis.toUpperCase();
    const places = componentLetters(storedOr(n, 'xyzw'), 4); // the output's places, up to four 輸出的位置，最多四個
    return {typeOf: 'input',
      // The output reads as the mask in the node's letters, e.g. "RG" (legacy graph_ui.js:1299). 輸出照遮罩、用節點的字母。
      portLabels: {outputs: {out: [...selected].map(letter).join('')}},
      components: {outputs: {out: [...selected].map(axis => axes.indexOf(axis))}},
      // The output and the input are two things (Refactor.81.3, human 2026-10-11: "output 跟 input 不是一件事"): the title chooses
      // the output, how many components it has; the input type is a row of its own (typeOf 'input') and follows a wire (81.2).
      // 輸出和輸入是兩件事（R.81.3，人類）：標題列選輸出、也就是有幾個分量；輸入型別是自己的一列（typeOf 'input'），接線時跟著線（81.2）。
      selector: {value: values.shaped(values.family(t), selected.length), command: 'output',
        options: [1, 2, 3, 4].map(count => values.shaped(values.family(t), count))},
      // Each menu is named by the output component it fills, in the node's letters and that component's colour (Refactor.80.3,
      // human 2026-10-11: not 1, 2…); it only picks which input component goes there, the title says how many (Refactor.81.3).
      // 每個選單以它填的輸出分量命名，用節點的字母與分量色（R.80.3，人類：不要 1、2…）；它只挑放哪個輸入分量，幾個由標題列決定（R.81.3）。
      controls: [{
      kind: 'row', key: 'mask', label: 'vector.componentOrder', children:
        [...selected].map((value,index) => ({kind:'select' as const,key:'component'+index,
          label:places[index] ?? String(index+1),literal:true,component:index,command:'mask',args:{index},value,
          options:[...axes.slice(0,values.count(t))].map(value=>({value,label:letter(value),literal:true}))}))
    }]};
  },
  edit: (n, command, data) => {
    const t = String(n.params.type), previous = mask(t,n.params.mask ?? 'xy');
    if (command === 'output') {
      // How many components the output has: more are filled with the next components in turn, fewer drop from the end.
      // 輸出有幾個分量：變多時依序補上下一個分量，變少時從後面拿掉。
      const count = values.count(String(payload(data)));
      if (!Number.isInteger(count) || count < 1 || count > 4) throw Error('Invalid swizzle output');
      let next = previous.slice(0, count);
      while (next.length < count) next += axes[Math.min(next.length, values.count(t) - 1)];
      n.params.mask = mask(t, next);
    } else if (command === 'mask' && data && typeof data === 'object' && !Array.isArray(data)) {
      const i = Number(data.index), value = String(payload(data));
      if (!Number.isInteger(i) || i<0 || i>=previous.length || value.length!==1) throw Error('Invalid swizzle component');
      n.params.mask = mask(t,previous.slice(0,i)+value+previous.slice(i+1));
    } else throw Error('Invalid swizzle command');
    return n;
  },
  emit: (n,c) => ({outputs:{out:'('+c.input('value')+').'+mask(String(n.params.type),n.params.mask ?? 'xy')}})
});
