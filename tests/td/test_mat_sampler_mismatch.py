"""A native sampler-type warning must not replace the last working shader."""
from pathlib import Path
import copy,json,uuid
area=op('/').create(baseCOMP,'grape_sampler_mismatch_'+uuid.uuid4().hex[:8])
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'Material',c.demo_graph('banana','mat'),'mat')
    image=area.create(constantTOP,'image');image.par.resolutionw=8;image.par.resolutionh=8
    volume=area.create(texture3dTOP,'volume');volume.inputConnectors[0].connect(image);volume.par.cachesize=2;volume.cook(force=True)
    before={name:shader.op(name).text for name in ('graph','manifest','pixel_shader','vertex_shader')}
    with r.shader_context(shader):
        original=copy.deepcopy(r.state());graph=copy.deepcopy(original['graph']);graph['declarations'][0]['source']='op:'+volume.path
        try:r.deploy(document.stamp_catalog(graph,c),original['revision'])
        except RuntimeError as exc:assert 'Sampler type of uniform' in str(exc),str(exc)
        else:raise AssertionError('Native sampler mismatch was accepted as successful')
        assert before=={name:shader.op(name).text for name in before},'Working shader changed'
        assert r.state()['graph']==original['graph'] and r.state()['revision']==original['revision']
        assert manager.op('candidate') is None
        r.validate_material(shader)
    result={'passed':True,'typeMismatchRejected':True,'workingShaderPreserved':True,'candidateRemoved':True}
finally:area.destroy()
