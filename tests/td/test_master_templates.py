"""MAT construction and explicit stale-template handling in the native runtime."""
import copy
import json

owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
runtime=owner.op('runtime').module
parent_comp=op('/grape_devbridge')
assert not parent_comp.op('master_template_test')
fixture=parent_comp.create(baseCOMP,'master_template_test')
previous_shaders=dict(runtime._shaders);previous_shader=runtime._shader
original_template=runtime.master_template
masters=[original_template(kind) for kind in ('mat','top')]
def snapshot():
    return {m.path:{key:m.op(key).text for key in ('graph','state','manifest','pixel_shader','vertex_shader') if m.op(key)} for m in masters}
before=snapshot()
try:
    mat=runtime.create_shader(fixture,'fresh',kind='mat')
    assert mat.op('compile_info').par.op.eval()==mat.op('material')
    assert not mat.op('material_info'), 'GLSL MAT must reuse its initial Info DAT'
    assert 'input:0' not in mat.storage['sgrapeTextureSources']
    images=[n for n in mat.children if n.opType=='moviefileinTOP']
    assert len(images)==1, 'The default sampler only needs one Banana image'
    runtime.validate_material(mat)
    # Reproduce an intact graph using an old shader shell, without relying on
    # private historical files. The product Master update must surface review.
    state=json.loads(mat.op('state').text)
    old=copy.deepcopy(state['graph']['catalogSnapshot'])
    old['targetShellVersion']-=1
    old['hash']=runtime.core().digest({k:v for k,v in old.items() if k!='hash'})
    state['graph']['catalogSnapshot']=old
    mat.op('state').text=json.dumps(state)
    mat.op('graph').text=json.dumps(state['graph'])
    manifest=json.loads(mat.op('manifest').text);manifest['catalogSnapshot']=old
    mat.op('manifest').text=json.dumps(manifest)
    saved={key:mat.op(key).text for key in ('state','graph','manifest','pixel_shader','vertex_shader')}
    family=mat.create(baseCOMP,'FamManifest')
    metadata=family.create(textDAT,'OpInfo');metadata.text='{"op_version":"old-fixture"}'
    runtime.master_template=lambda kind:mat if kind=='mat' else original_template(kind)
    try:
        runtime.prepare_masters()
    except RuntimeError as exc:
        assert 'template needs a graph upgrade review' in str(exc), str(exc)
    else:raise AssertionError('A stale template was reported as current')
    assert {key:mat.op(key).text for key in saved}==saved, 'Unaccepted graph upgrade changed saved evidence'
    assert json.loads(metadata.text)['op_version']=='old-fixture'
    assert mat.storage['sgrapeMaster'] and 'sgrapeShader' not in mat.tags
    assert mat.storage['sgrapeShaderId'] not in runtime._shaders
    assert snapshot()==before, 'A real Master changed during the fixture test'
finally:
    runtime.master_template=original_template
    runtime._shaders=previous_shaders;runtime._shader=previous_shader
    fixture.destroy()
result={'freshMatCompilePassed':True,'singleSamplerImage':True,'singleCompileInfo':True,
        'staleTemplateExplicitlyRejected':True,'unacceptedGraphPreserved':True,'mastersUnchanged':True}
(GRAPE_TEST_OUTPUT/'validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
