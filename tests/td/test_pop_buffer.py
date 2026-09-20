"""Isolated TOP/MAT POP Buffer access, bindings and failure protection."""
from pathlib import Path
import copy,json,uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before=saved();checks=[]
root=op('/').create(baseCOMP,'grape_pop_buffer_'+uuid.uuid4().hex[:8])
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    for dat,file in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();sources=manager.op('sources').module
    line=root.create(linePOP,'points');data=root.create(attributePOP,'data');data.inputConnectors[0].connect(line)
    data.par.attr0name='custom';data.par.attr0customname='Data';data.par.attr0type='float';data.par.attr0numcomps='1'
    data.par.attr0isarray=True;data.par.attr0arraysize=2;data.par.attr0value0=.375;data.cook(force=True)
    for kind in ('top','mat'):
        (w/'phase.txt').write_text(kind,encoding='utf-8')
        shader=r.create_shader(root,'Buffer_'+kind,c.normalize_top_sources(c.demo_graph('color',target=kind))[0],kind)
        with r.shader_context(shader):
            native=r.shader_operator(shader)
            native.par.buffer0name='Data';native.par.buffer0pop=data;native.par.buffer0attrclass='point';native.par.buffer0attr='Data'
            snap=sources.snapshot(r);decl=next(d for d in snap['declarations'] if d['name']=='Data')
            assert decl['kind']=='pop_buffer' and decl['type']=='float' and decl['value'] is None
            ident=decl['id'];g=copy.deepcopy(snap['graph'])
            g['stages']['pixel']={'nodes':[c.node('pop_buffer','read',declarationId=ident),c.node('pixel_out','out')],
                                   'edges':[c.edge('read','out','color')]}
            assert r.deploy(g,r.state()['revision'])['ok']
            if kind=='top':
                native.par.format='rgba32float';native.cook(force=True)
                pixel=float(native.numpyArray(delayed=False)[0,0,0]);assert abs(pixel-.375)<.00001,pixel
            checks.append(kind+': import, accessor compile and native TOP sample .375')
            for port,expected in [('arraySize',2),('length',None)]:
                query=copy.deepcopy(g);query['stages']['pixel']['edges'][0]['from'][1]=port
                assert r.deploy(query,r.state()['revision'])['ok']
                if kind=='top':
                    native.cook(force=True);value=float(native.numpyArray(delayed=False)[0,0,0])
                    assert value==expected if expected is not None else value>0,(port,value)
            checks.append(kind+': native length and Attribute Array Size')
            p=native.par.buffer0pop;p.expr="op('"+data.path+"')";saved_binding=(str(p.mode),p.expr)
            assert r.deploy(g,r.state()['revision'])['ok'];assert (str(p.mode),p.expr)==saved_binding
            assert not sources.buffer_binding(native,0)['writable']
            checks.append(kind+': Expression stays in original context')
            native.par.buffer0attr='Missing';last=shader.op('pixel_shader').text
            try:r.deploy(g,r.state()['revision']);raise AssertionError('Missing attribute applied')
            except sources.SourceError:pass
            assert shader.op('pixel_shader').text==last
            unused=copy.deepcopy(g);unused['stages']['pixel']={'nodes':[c.node('pixel_out','out')],'edges':[]}
            try:r.deploy(unused,r.state()['revision']);raise AssertionError('TD invalid native configuration was ignored')
            except sources.SourceError:pass
            native.par.buffer0attr='Data';assert r.deploy(g,r.state()['revision'])['ok']
            checks.append(kind+': missing attribute reported as source error, including unused but configured native rows; recovery retains identity')
            p.mode=ParMode.CONSTANT;p.val=''
            try:r.deploy(g,r.state()['revision']);raise AssertionError('Blank POP applied')
            except sources.SourceError:pass
            p.val=data.path
            native.seq.buffer.numBlocks=2;native.par.buffer1name='Positions';native.par.buffer1pop=data;native.par.buffer1attrclass='point';native.par.buffer1attr='P'
            snap=sources.snapshot(r);assert len([d for d in snap['declarations'] if d['kind']=='pop_buffer'])==2
            checks.append(kind+': blank path protected; same POP offers multiple attributes')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    assert saved()==before
    (w/'results.json').write_text(json.dumps(dict(passed=True,checks=checks,existingShadersPreserved=True),indent=2),encoding='utf-8')
finally:
    root.destroy();(w/'phase.txt').write_text('cleaned up',encoding='utf-8')
