"""Native TOP/MAT value-only Vector, Replace, readable names and restoration.

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


before=snapshot();area=op('/').create(baseCOMP,'grape_unified_vector_test');checks=[];invalid_draft_replies=[]


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


def material_state(shader):
    sources=r.source_module();operator=r.shader_operator(shader)
    def identities(parent):
        children=getattr(parent,'children',())
        return [(child.path,child.id) for child in children]+[
            row for child in children for row in identities(child)]
    return {
        'data':{name:shader.op(name).text for name in ('state','graph','manifest','pixel_shader','vertex_shader') if shader.op(name)},
        'operators':sorted(identities(shader)),
        'registry':copy.deepcopy(shader.fetch(sources.STORE,None)),
        'rows':copy.deepcopy(sources.native_rows(operator)),
        'sequenceLengths':{name:getattr(operator.seq,name).numBlocks for name in sources.CHANNELS if getattr(operator.seq,name,None) is not None},
    }


def reject_type_draft(shader,kind,valid,edit,values,label,reason):
    expect(shader,valid,values,kind+': '+label+' valid baseline')
    r.source_module().sync(r)
    saved=material_state(shader);draft=copy.deepcopy(r.state()['graph']);edit(draft)
    original=copy.deepcopy(draft)
    try:c.compile_graph(draft)
    except c.GraphError as exc:assert reason in str(exc),(label,str(exc))
    else:raise AssertionError('Invalid type draft compiled: '+label)
    response=r.deploy(draft,r.state()['revision'])
    invalid_draft_replies.append({'target':kind,'case':label,'reply':copy.deepcopy(response)})
    review=response.get('upgradeReview',{})
    assert not response.get('ok') and review.get('blocked') and review.get('issues'),response
    assert not review.get('required') and not review.get('changes'),response
    assert draft==original,'A rejected draft or its retained wires were changed'
    assert material_state(shader)==saved,'Rejected type draft changed native operators, sources, revision or shader data'
    assert float(np.max(abs(pixels(shader)-np.array(values))))<.006
    checks.append(kind+': '+label+' retains successful pixels, native source identity, operators, graph, revision and GLSL')
    # The failed draft must not poison a subsequent valid Apply.
    repaired=copy.deepcopy(valid)
    repaired['stages']['pixel']['nodes'][0]['ui']['x']+=24
    expect(shader,repaired,values,kind+': '+label+' corrected graph applies normally')


try:
    for kind in ('top','mat'):
        initial=make_graph(kind,[c.node('vector','vector',type='vec4',components=[.1,.2,.3,1])])
        initial['stages']['pixel']['nodes'][0]['name']='Base_Color_1'
        shader=r.create_shader(area,kind,initial,kind)
        with r.shader_context(shader):
            expect(shader,initial,[.1,.2,.3,1],kind+': value-only Vector manual components')
            assert 'const vec4 sg_n_Base_Color_1 = ' in shader.op('pixel_shader').text
            checks.append(kind+': readable custom node identifier compiles natively')
            held=dict(id='held',kind='uniform',name='uHeld',type='float',value=.625)
            valid=make_graph(kind,[c.node('vector','vector',type='vec4',components=[.1,.2,.3,1])],declarations=[held])
            reject_type_draft(shader,kind,valid,
                lambda draft:draft['stages']['pixel']['nodes'][0]['params'].update(type='vec3'),
                [.1,.2,.3,1],'fixed output type conflict','cannot connect')
            valid=make_graph(kind,[c.node('vector_split','split',type='vec4'),
                c.node('combine','vector',type='vec4',components=[.1,.2,.3,1])],
                [c.edge('split','vector','x','z')],declarations=[held])
            reject_type_draft(shader,kind,valid,
                lambda draft:draft['stages']['pixel']['nodes'][0]['params'].update(type='vec2'),
                [0,.2,.3,1],'missing Z output port','endpoint')
            for layout in c.combine_layouts('vec4'):
                nodes=[c.node('replace','vector',type='vec4',groups=layout['groups'],requireConstant=True)]
                edges=[];expected=[.1,.2,.3,1]
                for port,ty in layout['inputs'].items():
                    first='xyzw'.index(port);values=expected[first:first+c.type_components(ty)]
                    nodes.append(c.node(ty,port,value=values[0] if ty=='float' else values))
                    edges.append(c.edge(port,'vector',port))
                expect(shader,make_graph(kind,nodes,edges),expected,kind+': exact group '+str(layout['inputs']))
            base=c.node('vec4','baseline',value=[.1,.2,.3,1])
            vector=c.node('replace','vector',type='vec4',components=[.3,.4,.5,1],groups={'y':'vec2'})
            pair=c.node('vec2','pair',value=[.6,.7])
            graph=make_graph(kind,[vector,base,pair],[c.edge('baseline','vector','value'),c.edge('pair','vector','y')])
            expect(shader,graph,[.1,.6,.7,1],kind+': full baseline with YZ override')
            # Splitting is an explicit node, separate from Replace's whole result.
            channels=make_graph(kind,[vector,base,pair,c.node('vector_split','split',type='vec4'),c.node('combine','channels',type='vec4')],
                [c.edge('baseline','vector','value'),c.edge('pair','vector','y'),c.edge('vector','split','value')]+
                [c.edge('split','channels',p,p) for p in 'xyzw'],output='channels')
            expect(shader,channels,[.1,.6,.7,1],kind+': explicit Split reflects every Replace component')
            # Disconnect changes grouped interface and restores inherited data.
            graph['stages']['pixel']['edges'].remove(c.edge('pair','vector','y'))
            graph['stages']['pixel']['nodes'][0]['params']['groups']={}
            expect(shader,graph,[.1,.2,.3,1],kind+': disconnect override restores baseline')
            graph['stages']['pixel']['edges'].remove(c.edge('baseline','vector','value'))
            expect(shader,graph,[.3,.4,.5,1],kind+': disconnect baseline restores saved manual values')
            # Replacing ZW by YZ removes its whole wire; W returns to its default.
            old=c.node('vec2','old',value=[.6,.7]);new=c.node('vec2','new',value=[.4,.5])
            vector=c.node('replace','vector',type='vec4',components=[.1,.2,.3,1],groups={'z':'vec2'})
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
                c.node('replace','vector',type='vec4',groups={'x':'vec4'},requireConstant=True),
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
            # Replace exposes one whole result. A partially runtime value
            # cannot masquerade as a compile-time constant via a scalar outlet.
            invalid=make_graph(kind,[c.node('uniform','base',declarationId='base'),c.node('float','fixed',value=.4),
                c.node('replace','vector',type='vec4',requireConstant=True)],
                [c.edge('base','vector','value'),c.edge('fixed','vector','x')],declarations=[declaration])
            try:c.compile_graph(invalid)
            except c.GraphError as exc:assert 'Require Constant' in str(exc)
            else:raise AssertionError('Partially runtime Replace was treated as a constant')
            checks.append(kind+': Replace whole-result constant constraint')
            if kind=='top':
                # Outputs carry final values, so arithmetic uses an upstream
                # component view and a downstream override, never a self-cycle.
                baseline=make_graph(kind,[c.node('uv','uv'),c.node('replace','vector',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])],
                    [c.edge('uv','vector','x')])
                apply_graph(baseline);uv=pixels(shader)
                nodes=[c.node('uv','uv'),c.node('vector_split','split',type='vec2'),c.node('add','offset'),
                    c.node('replace','modified',type='vec2'),c.node('replace','vector',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])]
                nodes[2]['inputValues']={'b':-.125}
                edited=make_graph(kind,nodes,[c.edge('uv','split','value'),c.edge('split','offset','a','y'),
                    c.edge('uv','modified','value'),c.edge('offset','modified','y'),c.edge('modified','vector','x')])
                apply_graph(edited);actual=pixels(shader);expected=uv.copy();expected[:,:,1]-=.125
                if 'float' not in str(shader.op('shader').par.format.eval()):expected=np.clip(expected,0,1)
                assert np.max(abs(actual-expected))<.006
                checks.append('TOP: only UV V changes through explicit Split and Replace')
finally:
    r._shaders={key:value for key,value in r._shaders.items() if value and value.valid and not value.path.startswith(area.path+'/')}
    area.destroy()
assert snapshot()==before
result={'passed':True,'checks':checks,'existingShadersPreserved':True,'invalidDraftReplies':invalid_draft_replies}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
