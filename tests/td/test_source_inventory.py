"""Source import, large-array access and recoverable missing bindings in TD."""
from pathlib import Path
import copy, json, uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before=saved();checks=[]
root=op('/').create(baseCOMP,'grape_source_inventory_'+uuid.uuid4().hex[:8])
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    for dat,file in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();sources=manager.op('sources').module
    def snap():return sources.snapshot(r)
    callbacks=root.create(textDAT,'samples_callbacks')
    callbacks.text="import numpy as np\ndef onCook(chop):\n    chop.copyNumpyArray(np.full((1,10000), .375, dtype=np.float32))\n"
    samples=root.create(scriptCHOP,'samples');samples.par.callbacks=callbacks;samples.cook(force=True)
    for kind in ('top','mat'):
        (w/'phase.txt').write_text(kind,encoding='utf-8')
        shader=r.create_shader(root,'Sources_'+kind,c.normalize_top_sources(c.demo_graph('color',target=kind))[0],kind)
        with r.shader_context(shader):
            native=r.shader_operator(shader)
            native.par.array0name='uSamples';native.par.array0type='float';native.par.array0arraytype='uniformarray';native.par.array0chop=samples
            imported=snap();decl=next(d for d in imported['declarations'] if d['name']=='uSamples')
            ident=decl['id'];assert decl['type']=='float[10000]' and decl['value'] is None
            g=copy.deepcopy(imported['graph']);g['stages']['pixel']={'nodes':[c.node('uniform','samples',declarationId=ident),c.node('array_get','read'),c.node('pixel_out','out')],
                'edges':[c.edge('samples','read','Array'),c.edge('read','out','color')]}
            assert r.deploy(g,r.state()['revision'])['ok'];code=shader.op('pixel_shader').text
            assert 'uSamples[10000]' in code and len(code)<10000
            checks.append(kind+': imports and compiles 10000-element native array without graph sample values')
            native.par.array0arraytype='texturebuffer';unsupported=snap()
            assert next(d for d in unsupported['declarations'] if d['id']==ident)['sourceMissing']
            assert any(i.get('id')==ident for i in unsupported['issues'])
            try:r.deploy(unsupported['graph'],r.state()['revision']);raise AssertionError('Missing source was applied')
            except sources.SourceError:pass
            assert shader.op('pixel_shader').text==code
            native.par.array0arraytype='uniformarray';assert not next(d for d in snap()['declarations'] if d['id']==ident).get('sourceMissing')
            native.par.array0name='';missing=snap()
            assert next(d for d in missing['declarations'] if d['id']==ident)['sourceMissing']
            unused=copy.deepcopy(missing['graph']);unused['stages']['pixel']={'nodes':[c.node('pixel_out','out')],'edges':[]}
            assert r.deploy(unused,r.state()['revision'])['ok']
            native.par.array0name='uSamples';restored=snap()
            assert not next(d for d in restored['declarations'] if d['id']==ident).get('sourceMissing')
            checks.append(kind+': storage mismatch/missing blocks used source; unused missing source does not block; restore keeps identity')
            native.par.const0name='sAmount';native.par.const0value=.625
            imported=snap();spec=next(d for d in imported['declarations'] if d['name']=='sAmount')
            assert spec['type']=='float' and spec['value']==.625
            g=copy.deepcopy(imported['graph']);g['stages']['pixel']={'nodes':[c.node('spec_constant','amount',declarationId=spec['id']),c.node('pixel_out','out')],
                'edges':[c.edge('amount','out','color')]}
            assert r.deploy(g,r.state()['revision'])['ok'];code=shader.op('pixel_shader').text
            assert 'const float sAmount' in code and native.par.const0value.eval()==.625
            bad=copy.deepcopy(g);next(d for d in bad['declarations'] if d['id']==spec['id']).update(type='int',value=0)
            try:r.deploy(bad,r.state()['revision']);raise AssertionError('Fractional int source was applied')
            except sources.SourceError as exc:assert exc.phase=='source'
            assert shader.op('pixel_shader').text==code
            checks.append(kind+': decimal Spec import is float; changing used declaration to int reports source validation and preserves Shader')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    assert saved()==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
    root.destroy();(w/'phase.txt').write_text('cleaned up',encoding='utf-8')
