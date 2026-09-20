"""Graph-owned struct construction, arrays, native compilation and failure isolation."""
from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
root=op('/').create(baseCOMP,'grape_structures_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    definition={'id':'particle','name':'Particle','description':'Saved notes','fields':[{'id':'age','name':'age','type':'float'},{'id':'uv','name':'uv','type':'vec2'}]}
    for target in ('top','mat'):
        shader=r.create_shader(root,'Structures_'+target,c.normalize_top_sources(c.demo_graph('color',target))[0],target)
        with r.shader_context(shader):
            g=copy.deepcopy(r.state()['graph']);g['typeDefinitions']=[copy.deepcopy(definition)]
            make=c.node('struct_create','make',type='struct:particle');make['inputValues']={'f_age':.375,'f_uv':[1,2]}
            g['stages']['pixel']={'nodes':[make,c.node('array_create','array',elementType='struct:particle',length=3),c.node('array_get','get'),c.node('struct_field','field',type='struct:particle',field='age'),c.node('pixel_out','result')],
                'edges':[c.edge('make','array','value'),c.edge('array','get','Array'),c.edge('get','field','value'),c.edge('field','result','color')]}
            result=r.deploy(g,r.state()['revision']);assert result['ok'],result
            if target=='mat':r.validate_material(shader)
            else:
                native=r.shader_operator(shader);native.cook(force=True);assert not native.errors(),native.errors()
                pixels=native.numpyArray(delayed=False);assert abs(float(pixels[0,0,0])-.375)<.01
            checks.append(target+': constructor -> Array Create -> Array Get -> field compiles'+(' and reads .375' if target=='top' else ' in native validation scene'))
            good={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if shader.op(n)}
            invalid=copy.deepcopy(g);invalid['typeDefinitions'][0]['fields'].pop(0)
            try:assert not r.deploy(invalid,r.state()['revision'])['ok'],'missing field accepted'
            except c.GraphError:pass
            assert all(shader.op(n).text==value for n,value in good.items())
            checks.append(target+': removed used field rejects before applied shader/state mutation')
            notes=copy.deepcopy(g);notes['typeDefinitions'][0].update(name='Renamed',description='Updated notes')
            result=r.deploy(notes,r.state()['revision']);assert result['ok'] and not result['shaderUpdated']
            assert json.loads(shader.op('graph').text)['typeDefinitions'][0]['description']=='Updated notes'
            assert shader.op('pixel_shader').text==good['pixel_shader']
            assert c.compile_graph(json.loads(shader.op('graph').text))['pixel']==good['pixel_shader']
            checks.append(target+': names/notes persist and reload without changing applied GLSL')
            if target=='mat':
                nested=copy.deepcopy(notes);nested['typeDefinitions'].append({'id':'container','name':'Container','fields':[{'id':'item','name':'item','type':'struct:particle'}]})
                nested['stages']['vertex']={'nodes':[c.node('struct_create','child',type='struct:particle'),c.node('struct_create','parent',type='struct:container'),c.node('struct_field','split',type='struct:particle',field='age'),c.node('vertex_out','result')],
                    'edges':[c.edge('child','parent','f_item'),c.edge('parent','split','value','f_item'),c.edge('split','result','position')]}
                result=r.deploy(nested,r.state()['revision']);assert result['ok'],result;r.validate_material(shader);checks.append('MAT vertex nested constructor and direct nested field output compile')
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
    assert before==after
    result=dict(passed=True,checks=checks,userShadersPreserved=len(before))
    (w/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:root.destroy()
