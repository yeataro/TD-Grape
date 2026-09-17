"""Native scoped Subgraph identifiers preserve rendered TOP/MAT results."""
import copy
import json
import numpy as np

r=op('/TD_Grape/runtime').module;c=r.core()
root_path='/grape_subgraph_names_test'
assert not op(root_path)
def snapshot():
    return {s.path:{key:s.op(key).text for key in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(key)}
            for s in r._shaders.values() if s and s.valid and not s.path.startswith(root_path+'/')}
before=snapshot();area=op('/').create(baseCOMP,root_path[1:]);checks=[]

def call(ident,name,function):
    return {'id':ident,'name':name,'definitionUuid':c.CALL,'params':{'functionId':function},
            'inputValues':{'color':[.2,.4,.4,1],'tint':[.5,.25,.5,.5]},'ui':{'x':0,'y':0}}
def make_graph(kind,nested=False):
    graph=c.demo_graph('color',kind)
    if kind=='top':graph=c.normalize_top_sources(graph)[0];graph['topInputs']=[]
    graph['declarations']=[]
    tint=copy.deepcopy(next(fn for fn in c.function_library() if fn['name']=='Tint'))
    graph['functions']=[tint]
    if nested:
        inner=call('inner','Tint',tint['id']);inner.pop('inputValues')
        outer={'id':'outer','name':'Outer','scope':'local','stages':['pixel'],
               'inputs':copy.deepcopy(tint['inputs']),'outputs':copy.deepcopy(tint['outputs']),
               'graph':{'nodes':[{'id':'input','name':'Input','definitionUuid':c.FUNCTION_INPUT,'params':{},'ui':{'x':0,'y':0}},inner,
                                  {'id':'output','name':'Output','definitionUuid':c.FUNCTION_OUTPUT,'params':{},'ui':{'x':600,'y':0}}],
                        'edges':[c.edge('input','inner','color','color'),c.edge('input','inner','tint','tint'),c.edge('inner','output','color','color')]}}
        graph['functions'].append(outer)
        nodes=[call('one','Outer','outer')];edges=[c.edge('one','result','color','color')]
        expected=[.1,.1,.2,.5];symbols=['sg_n_Outer_Tint_Apply_Tint']
    else:
        nodes=[call('one','Tint',tint['id']),call('two','Tint_Copy',tint['id']),c.node('add','sum',type='vec4')]
        edges=[c.edge('one','sum','a','color'),c.edge('two','sum','b','color'),c.edge('sum','result','color')]
        expected=[.2,.2,.4,1];symbols=['sg_n_Tint_Apply_Tint','sg_n_Tint_Copy_Apply_Tint']
    graph['stages']['pixel']={'nodes':nodes+[c.node('pixel_out','result')],'edges':edges}
    return graph,expected,symbols

def pixels(shader):
    if r.shader_kind(shader)=='top':
        shader.op('shader').cook(force=True);return shader.op('shader').numpyArray(delayed=False).copy()
    with r.validation_scene(shader) as render:
        render.cook(force=True);data=render.numpyArray(delayed=False).copy()
        return data[data.shape[0]//2-8:data.shape[0]//2+8,data.shape[1]//2-8:data.shape[1]//2+8]

try:
    for kind in ('top','mat'):
        for nested in (False,True):
            graph,expected,symbols=make_graph(kind,nested)
            source=copy.deepcopy(graph);compiled=c.compile_graph(graph);assert graph==source
            review=r._owner.op('document').module.inspect_upgrade(graph,c,kind,require_baseline=False)
            assert not review['required'] and not review['blocked'],(kind,nested,review)
            shader=r.create_shader(area,kind+('_nested' if nested else '_repeated'),graph,kind)
            with r.shader_context(shader):
                text=shader.op('pixel_shader').text
                for symbol in symbols:assert symbol+' =' in text,(symbol,text)
                assert r.compiled_is_current(shader,compiled,graph)
                delta=float(np.max(abs(pixels(shader)-np.array(expected))))
                assert delta<.006,(kind,nested,delta)
                assert not r.upgrade_review()['required']
                checks.append({'kind':kind,'nested':nested,'symbols':symbols,'pixelError':delta})
finally:
    r._shaders={key:s for key,s in r._shaders.items() if s and s.valid and not s.path.startswith(root_path+'/')}
    area.destroy()
assert snapshot()==before
result={'checks':checks,'existingShadersPreserved':True}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
