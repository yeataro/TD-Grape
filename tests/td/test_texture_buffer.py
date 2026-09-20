"""Compile and read CHOP Texture Buffers in isolated TOP / MAT instances."""
from pathlib import Path
import copy,json,uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before=saved();checks=[]
root=op('/').create(baseCOMP,'grape_texture_buffer_'+uuid.uuid4().hex[:8])
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    for dat,file in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();sources=manager.op('sources').module
    callbacks=root.create(textDAT,'samples_callbacks')
    callbacks.text="import numpy as np\ndef onCook(chop):\n    chop.copyNumpyArray(np.full((1,8), .375, dtype=np.float32))\n"
    samples=root.create(scriptCHOP,'samples');samples.par.callbacks=callbacks;samples.cook(force=True)
    for kind in ('top','mat'):
        (w/'phase.txt').write_text(kind,encoding='utf-8')
        shader=r.create_shader(root,'Buffer_'+kind,c.normalize_top_sources(c.demo_graph('color',target=kind))[0],kind)
        with r.shader_context(shader):
            native=r.shader_operator(shader)
            native.par.array0name='uBuffer';native.par.array0type='float';native.par.array0arraytype='texturebuffer';native.par.array0chop=samples
            snap=sources.snapshot(r);decl=next(d for d in snap['declarations'] if d['name']=='uBuffer')
            ident=decl['id'];assert decl['type']=='samplerBuffer' and decl['value'] is None
            assert r.uniform_snapshot()['uniforms'][ident]['components']==[]
            g=copy.deepcopy(snap['graph']);g['stages']['pixel']={'nodes':[c.node('uniform','source',declarationId=ident),c.node('buffer_fetch','read'),c.node('pixel_out','out')],
                'edges':[c.edge('source','read','buffer'),c.edge('read','out','color')]}
            assert r.deploy(g,r.state()['revision'])['ok']
            code=shader.op('pixel_shader').text
            assert 'uniform samplerBuffer uBuffer;' in code and 'texelFetch(uBuffer,' in code and 'samplerBuffer sg_' not in code
            if kind=='top':
                native.cook(force=True);pixel=native.numpyArray(delayed=False)[0,0]
                assert abs(float(pixel[0])-.375)<.01,pixel
            checks.append(kind+': imports resource and compiles texelFetch; TOP reads native .375 sample')
            # Length comes from GLSL textureSize; the graph carries no sampled count.
            length=copy.deepcopy(g);length['stages']['pixel']['nodes'][1]=c.node('buffer_length','read')
            assert r.deploy(length,r.state()['revision'])['ok']
            assert 'textureSize(uBuffer)' in shader.op('pixel_shader').text
            if kind=='top':
                native.par.format='rgba32float';native.cook(force=True)
                assert float(native.numpyArray(delayed=False)[0,0,0])==8
            # Native driver stays in its original context through candidate compilation.
            p=native.par.array0chop;p.expr="op('"+samples.path+"')"
            saved_driver=(str(p.mode),p.expr)
            assert r.deploy(g,r.state()['revision'])['ok'];assert (str(p.mode),p.expr)==saved_driver
            checks.append(kind+': length query and expression binding survive reapply')
            p.mode=ParMode.CONSTANT;p.val=''
            assert r.deploy(g,r.state()['revision'])['ok']
            native.cook(force=True);assert not native.errors(),native.errors()
            checks.append(kind+': unspecified CHOP uses native warning, without creating substitute data')
            native.par.array0arraytype='uniformarray';mismatch=sources.snapshot(r)
            assert next(d for d in mismatch['declarations'] if d['id']==ident)['sourceMissing']
            previous=shader.op('pixel_shader').text
            try:r.deploy(mismatch['graph'],r.state()['revision']);raise AssertionError('Storage mismatch was applied')
            except sources.SourceError:pass
            assert shader.op('pixel_shader').text==previous
            native.par.array0arraytype='texturebuffer';native.par.array0chop=samples
            assert not next(d for d in sources.snapshot(r)['declarations'] if d['id']==ident).get('sourceMissing')
            checks.append(kind+': storage mismatch blocks used source, keeps last Shader and restores stable identity')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    assert saved()==before
    (w/'results.json').write_text(json.dumps(dict(passed=True,checks=checks,existingShadersPreserved=True),indent=2),encoding='utf-8')
finally:
    root.destroy();(w/'phase.txt').write_text('cleaned up',encoding='utf-8')
