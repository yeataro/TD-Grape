"""Native TOP/MAT pixels, UV round-trip, constant qualification and failed-deploy preservation."""
import copy,json
import numpy as np

r=op('/TD_Grape/runtime').module;c=r.core()
assert not op('/grape_vector_test')
def snapshot():
    return {s.path:{k:s.op(k).text for k in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(k)}
            for s in r._shaders.values() if s and s.valid and not s.path.startswith('/grape_vector_test/')}
before=snapshot();area=op('/').create(baseCOMP,'grape_vector_test');checks=[]

def make_graph(kind,nodes,edges,output='join'):
    graph=c.demo_graph('color',kind)
    if kind=='top':graph=c.normalize_top_sources(graph)[0];graph['topInputs']=[]
    graph['declarations']=[]
    graph['stages']['pixel']={'nodes':nodes+[c.node('pixel_out','result')],
                             'edges':edges+[c.edge(output,'result','color')]}
    return graph

def apply_graph(graph):
    state=r.state()
    graph['catalogSnapshot']=copy.deepcopy(state['graph']['catalogSnapshot'])
    outcome=r.deploy(graph,state['revision'])
    assert outcome.get('ok'),outcome
    return outcome

def pixels(shader):
    if r.shader_kind(shader)=='top':
        shader.op('shader').cook(force=True)
        return shader.op('shader').numpyArray(delayed=False).copy()
    with r.validation_scene(shader) as render:
        render.cook(force=True);data=render.numpyArray(delayed=False).copy()
        return data[data.shape[0]//2-8:data.shape[0]//2+8,data.shape[1]//2-8:data.shape[1]//2+8]

try:
    for kind in ('top','mat'):
        shader=None
        for layout in c.combine_layouts('vec4'):
            nodes=[];edges=[];expected=[.1,.2,.3,1]
            for port,ty in layout['inputs'].items():
                first='xyzw'.index(port);values=expected[first:first+c.type_components(ty)]
                nodes.append(c.node(ty,port,value=values[0] if ty=='float' else values))
                edges.append(c.edge(port,'join',port))
            nodes.append(c.node('combine','join',type='vec4',groups=layout['groups'],requireConstant=True))
            graph=make_graph(kind,nodes,edges)
            if shader is None:shader=r.create_shader(area,kind,graph,kind)
            with r.shader_context(shader):
                apply_graph(graph)
                data=pixels(shader)
                assert np.max(abs(data-np.array(expected)))<.006,(kind,layout,data[0,0])
                checks.append(kind+': '+str(layout['inputs']))
        with r.shader_context(shader):
            # Reorder and duplicate components; source -> Split -> Combine -> Swizzle.
            graph=make_graph(kind,[c.node('vec2','value',value=[.2,.7]),c.node('vector_split','split'),
                c.node('combine','pair'),c.node('swizzle','join',mask='yxxy',requireConstant=True)],
                [c.edge('value','split','value'),c.edge('split','pair','x','x'),c.edge('split','pair','y','y'),c.edge('pair','join','value')])
            apply_graph(graph);assert np.max(abs(pixels(shader)-[.7,.2,.2,.7]))<.006
            checks.append(kind+': Split/Combine/Swizzle preserves reordered values')
            # const is verified in an integral constant-expression context, not
            # merely by the driver accepting a read-only runtime local variable.
            dat=shader.op('pixel_shader');original=dat.text
            marker='    '+('vec4 sg_color' if kind=='top' else 'for (int sg_buffer')
            dat.text=original.replace(marker,'    const int sg_bound = int(sg_n_join.x * 10.0);\n    float sg_probe[sg_bound];\n'+marker,1)
            try:r.validate_material(shader)
            finally:dat.text=original;r.validate_material(shader)
            checks.append(kind+': constant vector chain accepted as an array bound')
            saved={key:shader.op(key).text for key in ('state','graph','manifest','pixel_shader')}
            bad=copy.deepcopy(graph);bad['declarations']=[dict(id='runtime_value',kind='uniform',name='uValue',type='vec2',value=[.2,.7])]
            bad['stages']['pixel']['nodes'][0]=c.node('uniform','value',declarationId='runtime_value')
            bad['catalogSnapshot']=copy.deepcopy(r.state()['graph']['catalogSnapshot'])
            rejected=r.deploy(bad,r.state()['revision'])
            assert rejected.get('upgradeReview',{}).get('blocked'),rejected
            assert any(issue.get('node')=='join' and 'Require Constant' in issue.get('message','') for issue in rejected['upgradeReview']['issues'])
            assert all(shader.op(key).text==text for key,text in saved.items())
            checks.append(kind+': rejected runtime source leaves last applied state intact')
            # Non-algebraic built-ins must remain valid in a constant-expression context.
            graph=make_graph(kind,[c.node('float','source',value=1.25),c.node('fract','fraction',type='float'),
                c.node('mix','mix',type='float'),c.node('smoothstep','smooth',type='float'),
                c.node('combine','join',type='vec4',components=[0,.2,.3,1],requireConstant=True)],
                [c.edge('source','fraction','value'),c.edge('fraction','mix','a'),c.edge('mix','smooth','value'),c.edge('smooth','join','x')])
            graph['stages']['pixel']['nodes'][2]['inputValues']={'b':.75,'factor':.5}
            apply_graph(graph);assert np.max(abs(pixels(shader)-[.5,.2,.3,1]))<.006
            checks.append(kind+': constant Fract/Mix/Smoothstep values preserved')
            original=dat.text
            dat.text=original.replace(marker,'    const int sg_bound = int(sg_n_join.x * 10.0);\n    float sg_probe[sg_bound];\n'+marker,1)
            try:r.validate_material(shader)
            finally:dat.text=original;r.validate_material(shader)
            checks.append(kind+': constant built-ins accepted as an array bound')
            if kind=='top':
                baseline=make_graph(kind,[c.node('uv','uv'),c.node('combine','join',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])],[c.edge('uv','join','x')])
                apply_graph(baseline);uv=pixels(shader)
                modified=make_graph(kind,[c.node('uv','uv'),c.node('vector_split','split'),c.node('add','offset',type='float'),c.node('combine','pair'),c.node('combine','join',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])],
                    [c.edge('uv','split','value'),c.edge('split','pair','x','x'),c.edge('split','offset','a','y'),c.edge('offset','pair','y'),c.edge('pair','join','x')])
                modified['stages']['pixel']['nodes'][2]['inputValues']={'b':-.125}
                apply_graph(modified);actual=pixels(shader)
                expected=uv.copy();expected[:,:,1]-=.125
                if 'float' not in str(shader.op('shader').par.format.eval()):expected=np.clip(expected,0,1)
                assert np.max(abs(actual-expected))<.006,{'difference':float(np.max(abs(actual-expected))),'minActual':float(actual[:,:,1].min()),'sample':actual[0,0].tolist(),'base':uv[0,0].tolist(),'format':str(shader.op('shader').par.format.eval())}
                checks.append('TOP: only UV V changed; U, other channels and resolution preserved')
finally:
    r._shaders={key:value for key,value in r._shaders.items() if value and value.valid and not value.path.startswith(area.path+'/')}
    area.destroy()
assert snapshot()==before
result={'passed':True,'checks':checks,'existingShadersPreserved':True}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
