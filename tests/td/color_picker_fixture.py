"""Disposable TD/browser colour fixture. Never edits registered user shaders."""
from pathlib import Path
import json, uuid

fixture_path = '/grape_color_editor_test'
original = op('/TD_Grape/runtime').module
def saved(shaders):
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in shaders if s and s.valid}

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
        graph['declarations'] = [dict(id='tint', name='uTint', kind='uniform', type='vec4', nativeSequence='color', value=[.1,.2,.3,.4]),
                                 dict(id='rgb', name='uRGB', kind='uniform', type='vec3', nativeSequence='color', value=[.6,.5,.4])]
        shader = r.create_shader(root, 'Color', graph, 'top')
        with r.shader_context(shader):
            sources = r.process_shader_request('GET','/api/sources',{})
            q = manager.op('parameters').module
            with r.history_native_writes():
                seen=q.snapshot(r);q.edit(r,dict(action='page-create',name='Colors',revision=r.state()['revision'],expectedPages=seen['expectedPages']))
                seen=q.snapshot(r);source=next(row for row in sources['uniforms'] if row['id']=='tint')
                q.edit(r,dict(action='bind',id='tint',page='Colors',revision=r.state()['revision'],expectedPages=seen['expectedPages'],sourceExpected=source['expected']))
        root.store('fixtureShader', saved([shader]))
        root.store('undoCount',0)
        real_record=r.record_parameter_undo
        def record(*args,**kwargs):
            root.store('undoCount',root.fetch('undoCount')+1)
            return real_record(*args,**kwargs)
        r.record_parameter_undo=record
        r.ensure_network_controls(manager)
        r.start(manager,session={'port':0,'token':uuid.uuid4().hex,'rebind':True,'lan':False})
        lifecycle=manager.create(executeDAT,'test_tick')
        lifecycle.text="def onFrameStart(frame):\n    parent().op('runtime').module.tick()\n"
        lifecycle.par.framestart=True
        Path(GRAPE_TEST_OUTPUT).mkdir(parents=True,exist_ok=True)
        (Path(GRAPE_TEST_OUTPUT)/'connection.json').write_text(json.dumps({'url':r.url(shader)}))
        result={'ready':True,'userShadersPreserved':len(root.fetch('originalShaders'))}
    except Exception:
        r=root.op('manager/runtime').module if root.op('manager/runtime') else None
        if r and r._server:r.stop()
        root.destroy();raise
else:
    root=op(fixture_path);assert root is not None
    r=root.op('manager/runtime').module;shader=root.op('Color')
    with r.shader_context(shader):
        rows=r.source_module().snapshot(r)['uniforms']
        tint=next(row for row in rows if row['id']=='tint')
        if action=='external':
            native=getattr(r.shader_operator(shader).par,tint['components'][1]['parameter'])
            r.source_module().editable_parameter(native).val=.731
            rows=r.source_module().snapshot(r)['uniforms']
        controls = root.op('manager/parameters').module.snapshot(r)['controls']
        result={'values':{row['id']:[c['value'] for c in row['components']] for row in rows},'undoCount':root.fetch('undoCount'),
                'receiptCount':len(r._live.receipts) if r._live else 0,
                'boundControls':{row['name']:[c['value'] for c in row['components']] for row in controls if 'tint' in row.get('sources',[])},
                'graphUnchanged':saved([shader])==root.fetch('fixtureShader'),
                'userShadersPreserved':saved(original._shaders.values())==root.fetch('originalShaders')}
    if action=='cleanup':
        r.stop();root.destroy();result['fixtureRemoved']=not bool(op(fixture_path))
