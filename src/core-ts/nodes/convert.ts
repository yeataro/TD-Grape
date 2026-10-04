import { input, output, payload, values, reshapeInputs, type NodeModule } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "convert",
    "label": "Convert",
    "inputs": {
      "value": "float"
    },
    "outputs": {
      "out": "int"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "fromType": "float",
      "toType": "int"
    },
    "descriptionKey": "help.convert",
    "definitionUuid": "sgrape.builtin.convert"
  },
  "emitter": {
    "id": "convert",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "cast",
      "constructor",
      "convert type",
      "float to int",
      "int to float"
    ],
    "glslName": "convert",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

const conversion: NodeModule = {
  catalog, role: 'value',
  creations: wire => {
    if (wire && !values.types.includes(wire.type)) return undefined;
    const from = wire?.direction === 'output' ? wire.type : 'float';
    const to = wire?.direction === 'input' ? wire.type : 'int';
    const pairs = wire ? values.types.map(t => wire.direction === 'output' ? [from,t] : [t,to]) : [[from,to]];
    const rows = pairs.filter(([a,b]) => values.explicit(a!,b!)).map(([a,b]) => ({fromType:a!,toType:b!}));
    if (wire?.direction === 'output') rows.sort((a,b) => Number(values.count(b.toType) === values.count(from)) - Number(values.count(a.toType) === values.count(from)));
    return rows;
  },
  supports: n => values.types.includes(String(n.params.fromType)) && values.types.includes(String(n.params.toType)),
  ports: n => {
    const from = String(n.params.fromType), to = String(n.params.toType);
    if (!values.explicit(from,to)) throw Error('Source cannot construct the requested output');
    return [input('value',from),output('out',to)];
  },
  validate: () => {},
  presentation: n => ({
    selector: {value:String(n.params.toType),options:values.types.filter(t=>values.explicit(String(n.params.fromType),t)),command:'toType',label:'convert.toType'},
    controls: [{kind:'select',key:'fromType',label:'convert.fromType',command:'fromType',value:String(n.params.fromType),
      options:values.types.filter(t=>values.explicit(t,String(n.params.toType))).map(value=>({value,label:value,literal:true}))}]
  }),
  edit: (n, command, data) => {
    if (!['fromType','toType'].includes(command)) throw Error('Invalid conversion selection');
    const before = conversion.ports(n,{declaration:()=>undefined}); n.params[command] = String(payload(data));
    return reshapeInputs(n,before,conversion.ports(n,{declaration:()=>undefined}));
  },
  emit: (n,c) => ({outputs:{out:String(n.params.toType)+'('+c.input('value')+')'}})
};
export default conversion;
