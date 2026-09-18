"""Opening either editor entry preserves an existing OP's Viewer flag."""
import uuid

manager=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
runtime=manager.op('runtime').module
previous=runtime._shader
registry={key:value.path for key,value in runtime._shaders.items() if value and value.valid}
before={s.path:{name:s.op(name).text for name in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(name)} for s in runtime._shaders.values() if s and s.valid}
area=op('/').create(baseCOMP,'editor_viewer_test_'+uuid.uuid4().hex[:8])
checks=[]
try:
    # Test a private runtime module using the current source against the real
    # host parameters. Preserve the running service and all user registrations.
    code=area.create(textDAT,'runtime');code.text=source_path('sgrape_runtime.py').read_text(encoding='utf-8')
    candidate=code.module;candidate._owner=manager;candidate._shaders={};candidate._shader=previous
    for kind in ('top','mat'):
        shader=runtime.create_shader(area,'Probe_'+kind,kind=kind)
        candidate.register_shader(shader,fresh=True)
        assert shader.viewer,kind+' new OP default'
        for enabled in (False,True,False):
            shader.viewer=enabled
            candidate.register_shader(shader)
            assert shader.viewer==enabled,kind+' existing Viewer changed during registration'
            checks.append(kind+': Viewer '+str(enabled)+' preserved')
        runtime._shaders.pop(shader.fetch('sgrapeShaderId'),None)
        # fresh registration above generated a second identity; remove this
        # fixture by object identity too, never by a user-facing OP name.
        for key,value in list(runtime._shaders.items()):
            if value==shader:runtime._shaders.pop(key)
        shader.destroy()
finally:
    for key,value in list(runtime._shaders.items()):
        if value and value.valid and value.parent()==area:runtime._shaders.pop(key)
    area.destroy()
    assert runtime._shader==previous
    assert registry=={key:value.path for key,value in runtime._shaders.items() if value and value.valid}
    after={s.path:{name:s.op(name).text for name in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(name)} for s in runtime._shaders.values() if s and s.valid}
    assert before==after
result=dict(passed=True,checks=checks,existingShadersPreserved=True)
