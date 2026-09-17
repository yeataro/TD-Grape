"""Node layout and collapse saves must not replace the native Shader."""
import copy,json
r=op('/TD_Grape/runtime').module;c=r.core()
def snapshot():
    return {s.path:{k:s.op(k).text for k in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(k)} for s in r._shaders.values() if s and s.valid and not s.path.startswith('/grape_save_status_test/')}
before=snapshot();assert not op('/grape_save_status_test')
area=op('/').create(baseCOMP,'grape_save_status_test');checks=[]
configure=r.configure
try:
    for kind in ('top','mat'):
        initial=c.demo_graph('color',target=kind)
        if kind=='top':initial=c.normalize_top_sources(initial)[0]
        initial['stages']['pixel']['nodes'].append(c.node('vector','compactVector',360,300,type='vec4'))
        shader=r.create_shader(area,kind,initial,kind)
        with r.shader_context(shader):
            graph=copy.deepcopy(r.state()['graph']);previous_revision=r.state()['revision']
            texts={k:shader.op(k).text for k in ('manifest','pixel_shader','vertex_shader') if shader.op(k)}
            calls=[]
            def record_configure(*args,**kwargs):
                calls.append(args[0].path)
                return configure(*args,**kwargs)
            r.configure=record_configure
            graph['stages']['pixel']['nodes'][0]['ui']['x']+=24
            saved=r.deploy(graph,previous_revision)
            assert saved['shaderUpdated'] is False and saved['state']['revision']==previous_revision+1
            assert not calls, calls
            assert all(shader.op(k).text==v for k,v in texts.items())
            for expanded in (True,False):
                vector=next(n for n in graph['stages']['pixel']['nodes'] if n['id']=='compactVector')
                vector['ui']['componentsExpanded']=expanded
                previous_revision=saved['state']['revision']
                saved=r.deploy(graph,previous_revision)
                assert saved['shaderUpdated'] is False and saved['state']['revision']==previous_revision+1
                assert not calls,calls
                assert all(shader.op(k).text==v for k,v in texts.items())
                stored=json.loads(shader.op('graph').text)
                assert next(n for n in stored['stages']['pixel']['nodes'] if n['id']=='compactVector')['ui']['componentsExpanded'] is expanded
                assert next(n for n in saved['state']['graph']['stages']['pixel']['nodes'] if n['id']=='compactVector')['ui']['componentsExpanded'] is expanded
            vector['ui']['width']=460
            saved=r.deploy(graph,saved['state']['revision'])
            assert saved['shaderUpdated'] is False and not calls,calls
            assert all(shader.op(k).text==v for k,v in texts.items())
            stored=json.loads(shader.op('graph').text)
            assert next(n for n in stored['stages']['pixel']['nodes'] if n['id']=='compactVector')['ui']['width']==460
            # Exercise a connected node as well as the manual vector. Collapse
            # must persist without configuring either native Shader stage.
            collapse_ids={graph['stages']['pixel']['nodes'][0]['id'],'compactVector'}
            original_edges=copy.deepcopy(graph['stages']['pixel']['edges'])
            for collapsed in (True,False):
                for node in graph['stages']['pixel']['nodes']:
                    if node['id'] in collapse_ids:node.setdefault('ui',{})['collapsed']=collapsed
                expected_ui={node['id']:copy.deepcopy(node['ui']) for node in graph['stages']['pixel']['nodes'] if node['id'] in collapse_ids}
                previous_revision=saved['state']['revision']
                saved=r.deploy(graph,previous_revision)
                assert saved['shaderUpdated'] is False and saved['state']['revision']==previous_revision+1
                assert not calls,calls
                assert all(shader.op(k).text==v for k,v in texts.items())
                stored=json.loads(shader.op('graph').text)
                for persisted in (stored,saved['state']['graph'],r.state()['graph']):
                    assert persisted['stages']['pixel']['edges']==original_edges
                    for node in persisted['stages']['pixel']['nodes']:
                        if node['id'] in collapse_ids:assert node['ui']==expected_ui[node['id']],node
                    persisted_vector=next(n for n in persisted['stages']['pixel']['nodes'] if n['id']=='compactVector')
                    assert persisted_vector['ui']['collapsed'] is collapsed
                    assert persisted_vector['ui']['width']==460 and persisted_vector['ui']['componentsExpanded'] is False
            graph['stages']['pixel']['nodes'][0]['ui']['label']='Native save status check'
            applied=r.deploy(graph,saved['state']['revision'])
            assert applied['shaderUpdated'] is True and len(calls)==2,calls
            checks.append({'kind':kind,'positionSaveConfiguredShader':False,'componentVisibilityConfiguredShader':False,
                           'componentVisibilityPersisted':[True,False],'widthPersistedWithoutShaderUpdate':460,
                           'nodeCollapsePersisted':[True,False],'nodeCollapseConfiguredShader':False,'nodeCollapsePreservedWiresAndExpandedWidth':True,
                           'shaderEditConfiguredShader':True})
            r.configure=configure
finally:
    r.configure=configure
    r._shaders={k:v for k,v in r._shaders.items() if v and v.valid and not v.path.startswith(area.path+'/')}
    area.destroy()
assert snapshot()==before
result={'checks':checks,'existingShadersPreserved':True}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
