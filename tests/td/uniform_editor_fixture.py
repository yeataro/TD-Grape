"""Disposable full HTTP editor + native WebSocket fixture for the browser test.

The private bridge wrapper supplies action; no test endpoints enter the product.
"""
from pathlib import Path
import json, uuid

fixture_path = '/grape_uniform_editor_test'
original = op('/TD_Grape/runtime').module

def saved(shaders):
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in shaders if s and s.valid}

action = globals().get('GRAPE_TEST_ACTION', 'start')
if action == 'start':
    assert not op(fixture_path)
    root = op('/').create(baseCOMP, fixture_path[1:])
    root.store('originalShaders', saved(original._shaders.values()))
    try:
        manager = root.create(baseCOMP, 'manager')
        manager.store('sgrapeManager', True); manager.store('sgrapeManagerId', uuid.uuid4().hex)
        page = manager.appendCustomPage('Test'); page.appendStr('Updatestatus'); page.appendFolder('Personalfolder')
        manager.par.Personalfolder = str(Path(GRAPE_TEST_OUTPUT) / 'empty')
        for dat, name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
            manager.create(textDAT, dat).text = source_path(name).read_text(encoding='utf-8')
        r = manager.op('runtime').module; r._owner = manager
        graph = r.core().normalize_top_sources(r.core().demo_graph('color', target='top'))[0]
        graph['declarations'] = [dict(id='live', name='uLive', kind='uniform', type='float', value=.25)]
        shader = r.create_shader(root, 'Live', graph, 'top')
        with r.shader_context(shader): r.process_shader_request('GET','/api/sources',{})
        root.store('fixtureShader', saved([shader]))
        root.store('undoCount', 0)
        real_record = r.record_parameter_undo
        def record(*args, **kwargs):
            root.store('undoCount', root.fetch('undoCount') + 1)
            return real_record(*args, **kwargs)
        r.record_parameter_undo = record
        r.ensure_network_controls(manager); manager.par.Allowlan = True
        r.start(manager, session={'port':0,'token':uuid.uuid4().hex,'rebind':True,'lan':True})
        lifecycle = manager.create(executeDAT, 'test_tick')
        lifecycle.text = "def onFrameStart(frame):\n    parent().op('runtime').module.tick()\n"
        lifecycle.par.framestart = True
        connection = {'url':r.url(shader), 'addresses':r.network_addresses()}
        Path(GRAPE_TEST_OUTPUT).mkdir(parents=True, exist_ok=True)
        (Path(GRAPE_TEST_OUTPUT)/'connection.json').write_text(json.dumps(connection))
        result = {'ready':True}
    except Exception:
        r = root.op('manager/runtime').module if root.op('manager/runtime') else None
        if r and r._server: r.stop()
        root.destroy()
        raise
else:
    root = op(fixture_path); assert root is not None
    r = root.op('manager/runtime').module
    shader = root.op('Live')
    p = r.shader_operator(shader).par.vec0valuex
    if action == 'external': p.val = .731
    assert saved(original._shaders.values()) == root.fetch('originalShaders'), 'User shaders changed'
    if action == 'layout':
        previous=root.fetch('fixtureShader')[shader.path];current=saved([shader])[shader.path]
        assert all(current[n]==text for n,text in previous.items() if n not in ('state','graph')), 'Layout changed generated code'
        def without_geometry(text):
            document=json.loads(text)
            for data in document['stages'].values():
                for node in data['nodes']:
                    for field in ('x','y','width','height'):node.get('ui',{}).pop(field,None)
            return document
        assert without_geometry(previous['graph'])==without_geometry(current['graph']), 'Layout changed graph content'
        root.store('fixtureShader',saved([shader]))
    assert saved([shader]) == root.fetch('fixtureShader'), 'Value editing changed graph or generated code'
    result = {'value':p.eval(), 'undoCount':root.fetch('undoCount'), 'clients':len(r._live.clients),
              'errors':root.op('manager/uniform_socket').errors(), 'shadersPreserved':True}
    if action == 'cleanup':
        root.op('manager/test_tick').par.active = False
        r.stop(); root.destroy()
