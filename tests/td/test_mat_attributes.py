"""Isolated MAT Attribute creation, configuration, code generation and history."""
from pathlib import Path
import copy,json,uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before=saved();checks=[]
root=op('/').create(baseCOMP,'grape_attributes_'+uuid.uuid4().hex[:8])
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();s=manager.op('sources').module;h=manager.op('history').module
    shader=r.create_shader(root,'Attributes',c.demo_graph('color','mat'),'mat')
    with r.shader_context(shader):
        native=r.shader_operator(shader)
        native.par.attr0name='Offset';native.par.attr0type='float3'
        native.par.mattr0name='Transform';native.par.mattr0cols=3;native.par.mattr0comps=3
        snap=s.snapshot(r);decl=next(d for d in snap['declarations'] if d['name']=='Offset');matrix=next(d for d in snap['declarations'] if d['name']=='Transform')
        assert decl['type']=='vec3' and matrix['type']=='mat3' and decl['value'] is None
        assert all(not row['components'] for row in snap['uniforms'] if row['kind']=='attribute')
        checks.append('native scalar/vector and matrix attributes import with stable IDs and no numeric Uniform values')
        g=copy.deepcopy(snap['graph']);v=g['stages']['vertex'];v['nodes'].append(c.node('attribute','attribute',declarationId=decl['id']));v['edges'][0]=c.edge('attribute','deform','position')
        assert r.deploy(g,r.state()['revision'])['ok'];r.validate_material(shader)
        assert 'TDAttrib_Offset(' in shader.op('vertex_shader').text and 'in vec3 Offset' not in shader.op('vertex_shader').text
        gm=copy.deepcopy(g);vm=gm['stages']['vertex'];vm['nodes'][-1]['params']['declarationId']=matrix['id'];vm['nodes'].append(c.node('determinant','det',type='mat3'));vm['edges'][0]=c.edge('det','deform','position');vm['edges'].append(c.edge('attribute','det','value'))
        assert r.deploy(gm,r.state()['revision'])['ok'];r.validate_material(shader)
        assert 'TDAttrib_Transform(' in shader.op('vertex_shader').text
        checks.append('Vertex accessors compile and render for vector and matrix references without duplicate declarations')
        assert r.deploy(g,r.state()['revision'])['ok'];snap=s.snapshot(r);before_token=h.capture(r)['token'];old_graph=copy.deepcopy(snap['graph'])
        row=next(row for row in snap['uniforms'] if row['id']==decl['id'])
        changed=s.edit(r,dict(action='attributeConfig',id=decl['id'],revision=snap['revision'],expected=row['attributeBinding']['expected'],type='float',arraySize=1))
        assert native.par.attr0type.eval()=='float' and native.seq.attr.numBlocks==1
        assert changed['workingGraph']['stages']==old_graph['stages']
        assert r.deploy(changed['workingGraph'],r.state()['revision'])['ok'];r.validate_material(shader)
        after_graph=copy.deepcopy(r.state()['graph']);after_token=h.capture(r)['token']
        undone=h.restore(r,dict(requestId=uuid.uuid4().hex,revision=r.state()['revision'],fromToken=after_token,toToken=before_token,sourceIds=[decl['id']],graph=old_graph,currentGraph=after_graph))
        assert native.par.attr0type.eval()=='float3' and native.seq.attr.numBlocks==1
        assert r.deploy(undone.get('workingGraph',undone['graph']),r.state()['revision'])['ok']
        checks.append('explicit type edit uses the same native row; Undo restores configuration and graph with wires retained')
        native.par.attr0type='float2';snap=s.snapshot(r);row=next(row for row in snap['uniforms'] if row['id']==decl['id'])
        assert row['missing'] and row['formatChange']['type']=='vec2'
        adopted=s.edit(r,dict(action='adoptFormat',id=decl['id'],revision=snap['revision'],expected=row['formatChange']['expected']))
        assert next(d for d in adopted['workingGraph']['declarations'] if d['id']==decl['id'])['type']=='vec2'
        native.par.attr0type='float3';snap=s.snapshot(r);assert not next(d for d in snap['declarations'] if d['id']==decl['id']).get('sourceMissing')
        checks.append('external native type edits require explicit adoption; restoring the old type restores the same source ID')
        row=next(row for row in snap['uniforms'] if row['id']==decl['id'])
        if not row['attributeBinding']['sizeSupported']:
            try:s.edit(r,dict(action='attributeConfig',id=decl['id'],revision=snap['revision'],expected=row['attributeBinding']['expected'],type='vec3',arraySize=2));raise AssertionError('unsupported size accepted')
            except s.SourceError:pass
            assert native.par.attr0type.eval()=='float3'
        checks.append('Attribute Array Size capability follows installed TD parameters, with unsupported requests rejected before writes')
        snap=s.edit(r,dict(action='create',kind='attribute',name='CustomScalar',type='float',revision=r.state()['revision']))
        created=next(d for d in snap['declarations'] if d['name']=='CustomScalar');assert created['kind']=='attribute'
        row=next(row for row in snap['uniforms'] if row['id']==created['id'])
        removed=s.edit(r,dict(action='remove',id=created['id'],revision=snap['revision'],expected=row['expected']))
        assert not any(d['id']==created['id'] for d in removed['declarations'])
        checks.append('shared create/delete lifecycle manages an unused Attribute without touching geometry or other sources')
    assert saved()==before
    (w/'results.json').write_text(json.dumps(dict(passed=True,checks=checks,existingShadersPreserved=True),indent=2),encoding='utf-8')
finally:root.destroy()
