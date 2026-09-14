"""Compile handwritten multi-output functions in isolated TOP and MAT components."""
from pathlib import Path
import copy,json,uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/project1/TD_Sgrape/runtime').module
def snapshot():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
before=snapshot();checks=[]
assert not op('/grape_code_test')
root=op('/').create(baseCOMP,'grape_code_test')
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    for kind in ('top','mat'):
        graph=c.demo_graph('color',kind);n=c.node('glsl_code','code',96,120)
        n['params']['outputs']=[{'id':'c','name':'colour','type':'vec4'},{'id':'amount','name':'amount','type':'float'}]
        n['params']['code']='colour = vec4(a, b, 0.4, 1.0);\namount = 0.5;';n['inputValues']={'a':.2,'b':.3}
        graph['stages']['pixel']={'nodes':[n,c.node('multiply','mix',type='vec4'),c.node('pixel_out','pixel')],
            'edges':[c.edge('code','mix','a','c'),c.edge('code','mix','b','amount'),c.edge('mix','pixel','color')]}
        if kind=='mat':
            vertex=c.node('glsl_code','vertexCode');vertex['params']['inputs']=[];vertex['params']['outputs'][0]['type']='vec4'
            vertex['params']['code']='c = TDWorldToProj(TDDeform(TDPos()));'
            graph['stages']['vertex']={'nodes':[vertex,c.node('vertex_out','vertex')],'edges':[c.edge('vertexCode','vertex','position','c')]}
        shader=r.create_shader(root,'Test_'+kind,graph,kind)
        with r.shader_context(shader):
            compiled=c.compile_graph(r.state()['graph']);r.validate_material(shader,compiled)
            assert shader.op('pixel_shader').text.count('sg_code_code_add(')==2
            if kind=='top':
                shader.op('preview').cook(force=True);pixel=shader.op('preview').numpyArray(delayed=False)[0,0]
                assert max(abs(float(a)-b) for a,b in zip(pixel,(.1,.15,.2,.5)))<.002,pixel
            checks.append(kind+': one function call drives both connected outputs; native shader compiles')
            if kind=='mat':checks.append('MAT: handwritten Vertex body accepts TDDeform and TDWorldToProj')
            saved={name:shader.op(name).text for name in ('state','graph','manifest','pixel_shader')}
            bad=copy.deepcopy(r.state()['graph']);bad['stages']['pixel']['nodes'][0]['params']['code']='colour = unknownGrapeValue;\namount = 1.0;'
            try:r.deploy(bad,r.state()['revision']);raise AssertionError('Bad GLSL compiled')
            except RuntimeError as exc:
                assert exc.node=='code' and exc.stage=='pixel',str(exc)
                assert any(d.get('codeLine')==1 for d in exc.diagnostics),exc.diagnostics
            assert {name:shader.op(name).text for name in saved}==saved
            checks.append(kind+': native syntax/type error maps to body line and preserves last applied state and GLSL')
            # The same body survives standalone component save/load with its interface IDs.
            shader.save(str(w/(kind+'-code.tox')))
            restored=root.loadTox(str(w/(kind+'-code.tox')))
            try:
                assert restored.op('graph').text==shader.op('graph').text
                assert restored.op('pixel_shader').text==compiled['pixel'];r.validate_material(restored,compiled)
            finally:restored.destroy()
            checks.append(kind+': TOX save/load retains handwritten body, typed ports and compiled shader')
            texture=copy.deepcopy(r.state()['graph']);node=texture['stages']['pixel']['nodes'][0]
            node['params']['inputs']=[{'id':'tex','name':'tex','type':'sampler2D'},{'id':'uv','name':'uv','type':'vec2'}]
            node['params']['code']='colour = texture(tex, uv);\namount = 1.0;';node.pop('inputValues')
            outcome=r.deploy(texture,r.state()['revision']);assert outcome.get('ok'),outcome
            assert any(binding['source']=='builtin:black' for binding in c.compile_graph(texture)['bindings'])
            checks.append(kind+': unconnected sampler function input compiles with opaque-black fallback')
            texture['declarations']=[{'id':'image','name':'uImage','kind':'sampler','type':'sampler2D','source':'builtin:banana'}]
            texture['stages']['pixel']['nodes'].append(c.node('sampler','image',declarationId='image'))
            texture['stages']['pixel']['edges'].append(c.edge('image','code','tex'))
            outcome=r.deploy(texture,r.state()['revision']);assert outcome.get('ok'),outcome
            checks.append(kind+': connected sampler is passed as a resource, without copying an opaque local')
            # Leave a numeric output unassigned: the generated initializer defines it as zero.
            texture['stages']['pixel']['nodes'][0]['params']['code']='colour = texture(tex, uv);'
            outcome=r.deploy(texture,r.state()['revision']);assert outcome.get('ok'),outcome
            if kind=='top':
                shader.op('preview').cook(force=True)
                assert float(abs(shader.op('preview').numpyArray(delayed=False)).max())==0
            checks.append(kind+': unassigned output remains defined as zero')
    assert snapshot()==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'native-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:root.destroy()
