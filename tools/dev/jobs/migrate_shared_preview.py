"""Retire the old per-MAT preview scene after validating its shared replacement.

Explicit development migration; shader data and all retained OP positions survive.
"""
import json
owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1
owner=owners[0];runtime=owner.op('runtime').module
shaders=runtime.shaders()
before={s.path:{'id':s.id,'data':{name:s.op(name).text for name in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(name)},'positions':{c.id:(c.nodeX,c.nodeY) for c in s.children}} for s in shaders}
remove=set()
for shader in shaders:
    if runtime.shader_kind(shader)!='mat':continue
    runtime.validate_material(shader)
    render=shader.op('preview');geo=shader.op('preview_geometry');camera=shader.op('preview_camera')
    if any((render,geo,camera)):
        assert render and geo and camera,'Partial old preview scene requires review: '+shader.path
        assert render.type=='render' and geo.type=='geo' and camera.type=='cam'
        assert geo.par.material.eval()==shader.op('material')
        assert render.par.camera.eval()==camera
        assert str(render.par.geometry.eval())==geo.path
        remove.update((render,geo,camera))
    capture=shader.op('grape_material_preview')
    if capture:
        assert capture.type=='opview' and capture.fetch('grapeMatViewerV1',False)
        assert capture.par.opviewer.eval()==shader.op('material')
        remove.add(capture)
# Refuse to remove a helper which another operator still references.
references=[]
for node in op('/').findChildren():
    if node in remove or any(node.path.startswith(n.path+'/') for n in remove):continue
    for parameter in node.pars():
        if parameter.style in ('OP','COMP','TOP','MAT','SOP','DAT','Object'):
            try:
                if parameter.eval() in remove:references.append(node.path+'.par.'+parameter.name)
            except (TypeError,AttributeError):pass
assert not references,references
owner.save(str(GRAPE_TEST_OUTPUT/'before.tox'))
removed=sorted(n.path for n in remove)
for node in remove:node.destroy()
for shader in shaders:
    runtime.validate_material(shader)
    baseline=before[shader.path]
    assert shader.id==baseline['id']
    assert baseline['data']=={name:shader.op(name).text for name in baseline['data']}
    assert all((n.nodeX,n.nodeY)==baseline['positions'][n.id] for n in shader.children)
assert not owner.op('compiler_validation/geometry').par.material.eval()
result={'removed':removed,'shadersPreserved':len(shaders),'sharedValidation':owner.op('compiler_validation').path,'errors':owner.errors(recurse=True)}
