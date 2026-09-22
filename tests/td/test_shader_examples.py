"""Examples use their own target and compile via normal native construction."""
import json,uuid
from pathlib import Path
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)).op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_example_test')
root=op('/').create(baseCOMP,'grape_example_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    for kind,names in [('top',['banana','color','tint']),('mat',['phong','pbr'])]:
        examples=r.shader_examples(kind);assert list(examples)==names
        for name,graph in examples.items():
            assert graph['target']==kind and ('vertex' in graph['stages'])==(kind=='mat')
            shader=r.create_shader(root,kind+'_'+name,graph,kind)
            with r.shader_context(shader):
                data=r.process_shader_request('GET','/api/state',{})
                assert list(data['examples'])==names
                (w/(kind+'-'+name+'-state.json')).write_text(json.dumps(data),encoding='utf-8')
            checks.append(kind+': '+name+' compiles through native construction and exposes only matching templates')
    assert before=={s.path:{n:s.op(n).text for n in before[s.path]} for s in original.shaders()}
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
finally:root.destroy()
