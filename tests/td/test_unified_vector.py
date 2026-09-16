"""Native TOP/MAT unified Vector values, effective constants and restoration.

Run with tools/dev/submit_job.py after reloading the current source modules.
All shaders live in a disposable area; existing user shaders are snapshotted.
"""
import copy
import json
import numpy as np

r=op('/TD_Grape/runtime').module;c=r.core()
assert not op('/grape_unified_vector_test')


def snapshot():
    return {s.path:{k:s.op(k).text for k in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(k)}
            for s in r._shaders.values() if s and s.valid and not s.path.startswith('/grape_unified_vector_test/')}


before=snapshot();area=op('/').create(baseCOMP,'grape_unified_vector_test');checks=[]


def make_graph(kind,nodes,edges=(),output='vector',port='out',declarations=()):
    graph=c.demo_graph('color',kind)
    if kind=='top':graph=c.normalize_top_sources(graph)[0];graph['topInputs']=[]
    graph['declarations']=copy.deepcopy(list(declarations))
    graph['stages']['pixel']={'nodes':copy.deepcopy(nodes)+[c.node('pixel_out','result')],
                             'edges':copy.deepcopy(list(edges))+[c.edge(output,'result','color',port)]}
    return graph


def apply_graph(graph):
    # Earlier cases intentionally add then stop referencing native Uniforms.
    # Those rows survive graph replacement and source reconciliation may adopt
    # them again. Match the editor's source refresh before capturing the CAS
    # revision, rather than treating that expected refresh as another writer.
    sources=r.source_module()
    if sources:sources.sync(r)
    state=r.state();graph['catalogSnapshot']=copy.deepcopy(state['graph']['catalogSnapshot'])
    outcome=r.deploy(graph,state['revision'])
    assert outcome.get('ok'),outcome


def pixels(shader):
    if r.shader_kind(shader)=='top':
        shader.op('shader').cook(force=True)
        return shader.op('shader').numpyArray(delayed=False).copy()
    with r.validation_scene(shader) as render:
        render.cook(force=True);data=render.numpyArray(delayed=False).copy()
        return data[data.shape[0]//2-8:data.shape[0]//2+8,data.shape[1]//2-8:data.shape[1]//2+8]


def expect(shader,graph,values,label):
    apply_graph(graph);actual=pixels(shader)
    delta=float(np.max(abs(actual-np.array(values))))
    assert delta<.006,(label,delta,actual[0,0].tolist(),values)
    checks.append(label)


try:
    for kind in ('top','mat'):
        initial=make_graph(kind,[c.node('vector','vector',type='vec4',components=[.1,.2,.3,1])])
        shader=r.create_shader(area,kind,initial,kind)
        with r.shader_context(shader):
            expect(shader,initial,[.1,.2,.3,1],kind+': manual components')
            for layout in c.combine_layouts('vec4'):
                nodes=[c.node('vector','vector',type='vec4',groups=layout['groups'],requireConstant=True)]
                edges=[];expected=[.1,.2,.3,1]
                for port,ty in layout['inputs'].items():
                    first='xyzw'.index(port);values=expected[first:first+c.type_components(ty)]
                    nodes.append(c.node(ty,port,value=values[0] if ty=='float' else values))
                    edges.append(c.edge(port,'vector',port))
                expect(shader,make_graph(kind,nodes,edges),expected,kind+': exact group '+str(layout['inputs']))
            base=c.node('vec4','baseline',value=[.1,.2,.3,1])
            vector=c.node('vector','vector',type='vec4',components=[.3,.4,.5,1],groups={'y':'vec2'})
            pair=c.node('vec2','pair',value=[.6,.7])
            graph=make_graph(kind,[vector,base,pair],[c.edge('baseline','vector','value'),c.edge('pair','vector','y')])
            expect(shader,graph,[.1,.6,.7,1],kind+': full baseline with YZ override')
            # Individual outputs are final values, not the original baseline.
            channels=make_graph(kind,[vector,base,pair,c.node('combine','channels',type='vec4')],
                [c.edge('baseline','vector','value'),c.edge('pair','vector','y')]+
                [c.edge('vector','channels',p,p) for p in 'xyzw'],output='channels')
            expect(shader,channels,[.1,.6,.7,1],kind+': scalar outputs reflect every final component')
            # Disconnect changes grouped interface and restores inherited data.
            graph['stages']['pixel']['edges'].remove(c.edge('pair','vector','y'))
            graph['stages']['pixel']['nodes'][0]['params']['groups']={}
            expect(shader,graph,[.1,.2,.3,1],kind+': disconnect override restores baseline')
            graph['stages']['pixel']['edges'].remove(c.edge('baseline','vector','value'))
            expect(shader,graph,[.3,.4,.5,1],kind+': disconnect baseline restores saved manual values')
            # Replacing ZW by YZ removes its whole wire; W returns to its default.
            old=c.node('vec2','old',value=[.6,.7]);new=c.node('vec2','new',value=[.4,.5])
            vector=c.node('vector','vector',type='vec4',components=[.1,.2,.3,1],groups={'z':'vec2'})
            original=make_graph(kind,[vector,old,new],[c.edge('old','vector','z')])
            expect(shader,original,[.1,.2,.6,.7],kind+': ZW group before replacement')
            updated=copy.deepcopy(original);updated['stages']['pixel']['nodes'][0]['params']['groups']={'y':'vec2'}
            updated['stages']['pixel']['edges'][0]=c.edge('new','vector','y')
            expect(shader,updated,[.1,.4,.5,1],kind+': YZ replacement restores W and keeps old node')
            expect(shader,original,[.1,.2,.6,.7],kind+': restoring prior graph restores grouped wire')
            # Runtime baseline is connected but fully replaced: generated code
            # must truly be a constant expression, without unused Uniforms.
            declaration=dict(id='base',kind='uniform',name='uDormantBase',type='vec4',value=[.9,.8,.7,.6])
            constant=make_graph(kind,[c.node('uniform','base',declarationId='base'),
                c.node('vector','vector',type='vec4',groups={'x':'vec4'},requireConstant=True),
                c.node('vec4','replacement',value=[.2,.4,.6,1])],
                [c.edge('base','vector','value'),c.edge('replacement','vector','x')],declarations=[declaration])
            expect(shader,constant,[.2,.4,.6,1],kind+': runtime baseline fully replaced by constant')
            dat=shader.op('pixel_shader');original=dat.text
            assert 'uDormantBase' not in original
            marker='    '+('vec4 sg_color' if kind=='top' else 'for (int sg_buffer')
            dat.text=original.replace(marker,'    const int sg_bound = int(sg_n_vector.y * 10.0);\n    float sg_probe[sg_bound];\n'+marker,1)
            try:r.validate_material(shader)
            finally:dat.text=original;r.validate_material(shader)
            checks.append(kind+': effective vector accepted as a constant array bound')
            # A constant component may be consumed while the whole vector still
            # depends on runtime data; only that component should be evaluated.
            selected=make_graph(kind,[c.node('uniform','base',declarationId='base'),c.node('float','fixed',value=.4),
                c.node('vector','vector',type='vec4'),c.node('combine','channels',type='vec4',components=[0,.2,.3,1],requireConstant=True)],
                [c.edge('base','vector','value'),c.edge('fixed','vector','x'),c.edge('vector','channels','x','x')],output='channels',declarations=[declaration])
            expect(shader,selected,[.4,.2,.3,1],kind+': selected constant component ignores unused runtime components')
            assert 'uDormantBase' not in shader.op('pixel_shader').text
            if kind=='top':
                # Outputs carry final values, so arithmetic uses an upstream
                # component view and a downstream override, never a self-cycle.
                baseline=make_graph(kind,[c.node('uv','uv'),c.node('vector','vector',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])],
                    [c.edge('uv','vector','x')])
                apply_graph(baseline);uv=pixels(shader)
                nodes=[c.node('uv','uv'),c.node('vector','split',type='vec2'),c.node('add','offset'),
                    c.node('vector','modified',type='vec2'),c.node('vector','vector',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])]
                nodes[2]['inputValues']={'b':-.125}
                edited=make_graph(kind,nodes,[c.edge('uv','split','value'),c.edge('split','offset','a','y'),
                    c.edge('uv','modified','value'),c.edge('offset','modified','y'),c.edge('modified','vector','x')])
                apply_graph(edited);actual=pixels(shader);expected=uv.copy();expected[:,:,1]-=.125
                if 'float' not in str(shader.op('shader').par.format.eval()):expected=np.clip(expected,0,1)
                assert np.max(abs(actual-expected))<.006
                checks.append('TOP: only UV V changes through final-component output and override')
finally:
    r._shaders={key:value for key,value in r._shaders.items() if value and value.valid and not value.path.startswith(area.path+'/')}
    area.destroy()
assert snapshot()==before
result={'passed':True,'checks':checks,'existingShadersPreserved':True}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
