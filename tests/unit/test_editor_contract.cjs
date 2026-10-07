const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createHash}=require('node:crypto');
const graph=require('../../src/generated/wire_planning.js');
const bootstrap=require('../../src/generated/editor-bootstrap.json');

test('editor bootstrap comes from registered modules and identifies its actual bundle',()=>{
  const ordinary=graph.registry.modules.filter(m=>!m.structural);
  assert.deepEqual(bootstrap.catalog.map(d=>d.definitionUuid),ordinary.map(m=>m.catalog.definition.definitionUuid));
  const {sources,...nodeContract}=bootstrap.typeContract;
  assert.deepEqual(nodeContract,graph.createEditorContract(graph.registry));
  const sourceCatalog=require('../../src/library/source_catalog.json');
  assert.deepEqual(sources,Object.fromEntries(['version','uniformPresets','menuGroups','nodeSources'].map(key=>[key,sourceCatalog[key]])));
  const source=fs.readFileSync(path.join(__dirname,'../../src/generated/wire_planning.js'));
  assert.equal(bootstrap.catalogHash,createHash('sha256').update(source).digest('hex'));
  assert.equal(bootstrap.producer,'frontend-modules');
});

test('default and native tuple ports retain the real module interfaces',()=>{
  for(const module of graph.registry.modules.filter(m=>!m.structural)){
    const d=module.catalog.definition,decl={id:'source',kind:'uniform',name:'uSource',type:'float',value:0};
    const node={id:'node',definitionUuid:d.definitionUuid,params:{...structuredClone(d.defaults)}};
    if(Object.values(d.outputs).includes('D'))node.params.declarationId=decl.id;
    const context={target:'top',declaration:()=>decl};
    assert.equal(module.supports(node,context),true,d.key);
    module.validate(node,context);
    const actual=graph.resolvePorts(module,node,context).types();
    const variants=bootstrap.typeContract.definitions[d.definitionUuid].variants;
    assert.ok(variants.some(v=>JSON.stringify(v.inputs)===JSON.stringify(actual.inputs)&&JSON.stringify(v.outputs)===JSON.stringify(actual.outputs)),d.key);
  }
  const mix=bootstrap.typeContract.definitions['sgrape.builtin.mix'].variants.filter(v=>v.type==='vec3');
  assert.deepEqual(mix.map(v=>v.inputs.factor),['float','vec3']);
  assert.ok(mix.every(v=>v.outputs.out==='vec3'));
  const predicate=bootstrap.typeContract.definitions['sgrape.builtin.isnan'].variants.find(v=>v.type==='vec3');
  assert.equal(predicate.outputs.out,'bvec3');
});

test('a developer module adds its palette contract without another node dispatch',()=>{
  const source=graph.registry.get('sgrape.builtin.abs'),catalog=structuredClone(source.catalog);
  catalog.definition.key='developerAbs';catalog.definition.definitionUuid='developer.abs';
  const registry=graph.createRegistry([{...source,catalog}]);
  const contract=graph.createEditorContract(registry);
  assert.deepEqual(Object.keys(contract.definitions),['developer.abs']);
  assert.ok(contract.definitions['developer.abs'].variants.some(v=>v.type==='vec4'&&v.outputs.out==='vec4'));
});

test('a broken advertised selection fails the build with its module and type',()=>{
  const source=graph.registry.get('sgrape.builtin.abs');
  for(const type of ['float','vec3']){
    const registry=graph.createRegistry([{...source,configure:(node,selection,context)=>{
      if(selection.type===type)throw new TypeError('Injected module bug');
      return source.configure(node,selection,context);
    }}]);
    assert.throws(()=>graph.createEditorContract(registry),new RegExp('abs / '+type+': TypeError: Injected module bug'));
  }
  const registry=graph.createRegistry([{...source,supports:(node,context)=>node.params.type!=='float'&&source.supports(node,context)}]);
  assert.throws(()=>graph.createEditorContract(registry),/Unsupported default type.*abs/);
});

test('omitted developer UUIDs use the same registry and catalog identity without collisions',()=>{
  const source=graph.registry.get('sgrape.builtin.abs');
  const modules=['firstCustom','secondCustom'].map(key=>{
    const catalog=structuredClone(source.catalog);delete catalog.definition.definitionUuid;
    catalog.definition.key=key;return {...source,catalog};
  });
  const registry=graph.createRegistry(modules),contract=graph.createEditorContract(registry);
  for(const key of ['firstCustom','secondCustom']){
    const id='sgrape.builtin.'+key;
    assert.equal(registry.get(id).catalog.definition.definitionUuid,id);
    assert.ok(contract.definitions[id].variants.length);
  }
  assert.equal(Object.keys(contract.definitions).length,2);
});
