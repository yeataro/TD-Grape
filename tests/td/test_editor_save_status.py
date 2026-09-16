"""A position save must not configure or replace the native Shader program."""
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
            graph['stages']['pixel']['nodes'][0]['ui']['label']='Native save status check'
            applied=r.deploy(graph,saved['state']['revision'])
            assert applied['shaderUpdated'] is True and len(calls)==2,calls
            checks.append({'kind':kind,'positionSaveConfiguredShader':False,'shaderEditConfiguredShader':True})
            r.configure=configure
finally:
    r.configure=configure
    r._shaders={k:v for k,v in r._shaders.items() if v and v.valid and not v.path.startswith(area.path+'/')}
    area.destroy()
assert snapshot()==before
result={'checks':checks,'existingShadersPreserved':True}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
