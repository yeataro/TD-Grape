"""Personal snapshot filenames through the TD runtime, in an isolated folder."""
import copy
import json
import uuid
from pathlib import Path

owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1
live=owners[0].op('runtime').module
def user_snapshot():
    return {s.path:{name:s.op(name).text for name in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(name)}
            for s in live._shaders.values() if s and s.valid}
before=user_snapshot()
area=op('/').create(baseCOMP,'grape_personal_names_'+uuid.uuid4().hex[:8])
checks=[]
folder=GRAPE_TEST_OUTPUT/('library-'+uuid.uuid4().hex)
folder.mkdir()
try:
    manager=area.create(baseCOMP,'manager')
    manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(folder)
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    runtime=manager.op('runtime').module;runtime._owner=manager
    core=runtime.core();library=manager.op('personal_library').module
    graph=core.normalize_top_sources(core.demo_graph('color','top'))[0]
    fn=copy.deepcopy(core.function_library()[0]);fn['name']='My Color Tint';fn['scope']='local';fn.pop('source')
    graph['functions']=[fn]
    shader=runtime.create_shader(area,'Shader',graph,'top')
    with runtime.shader_context(shader):
        source_before={name:shader.op(name).text for name in ('state','graph','manifest','pixel_shader')}
        body=dict(graph=copy.deepcopy(runtime.state()['graph']),functionId=fn['id'])
        body_before=copy.deepcopy(body)
        first=runtime.save_personal(body)
        assert first['created'] and first['file']=='My_Color_Tint'+library.SUFFIX
        path=Path(folder)/first['file'];saved=path.read_bytes()
        assert json.loads(saved)['functions'][0]['name']=='My Color Tint'
        assert first['library']['items']==[first['entry']]
        assert body==body_before
        checks.append('Readable filename and unchanged display name through runtime save')

        changed=copy.deepcopy(body)
        changed['graph']['functions'][0]['inputs'][0]['default']=[.2,.3,.4,1.]
        second=runtime.save_personal(changed)
        assert second['created'] and second['file']=='My_Color_Tint_2'+library.SUFFIX
        assert path.read_bytes()==saved and len(second['library']['items'])==2
        assert second['entry']['source']!=first['entry']['source']
        reused=runtime.save_personal(changed)
        assert not reused['created'] and reused['file']==second['file']
        checks.append('Changed content gets numbered filename; repeated save reuses it')

        renamed=path.with_name('My_Organized_Tint'+library.SUFFIX)
        assert renamed.resolve().parent==Path(folder).resolve()
        path.rename(renamed)
        reloaded=runtime.personal_library(refresh=True)
        assert not reloaded['issues'] and first['entry'] in reloaded['items']
        reused=runtime.save_personal(body)
        assert not reused['created'] and reused['file']==renamed.name
        assert reused['entry']==first['entry'] and len(reused['library']['items'])==2
        checks.append('Manual filename change preserves source identity, reload and reuse')

        restored=core.demo_graph('color','top')
        restored['functions']=[first['entry']]
        restored['stages']['pixel']={'nodes':[
            dict(id='tint',definitionUuid=core.CALL,params={'functionId':first['entry']['id']}),
            core.node('pixel_out','pixel')], 'edges':[core.edge('tint','pixel','color','color')]}
        core.compile_graph(restored)
        assert {name:shader.op(name).text for name in source_before}==source_before
        assert len(list(Path(folder).iterdir()))==2
        checks.append('Reloaded Subgraph compiles; saving does not edit its source Shader')
finally:
    area.destroy()
assert user_snapshot()==before,'A user Shader changed'
result=dict(passed=True,checks=checks,build=str(app.build),userShadersPreserved=len(before))
(GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
