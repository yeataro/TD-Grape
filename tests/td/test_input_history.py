"""Exercise browser history against real native rows in isolated TOP/MAT fixtures."""
from pathlib import Path
import copy, json, uuid

w = Path(GRAPE_TEST_OUTPUT)
w.mkdir(parents=True, exist_ok=True)
original = op('/TD_Grape/runtime').module
def saved():
    return {s.path: {n: s.op(n).text for n in ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before_user = saved()
assert not op('/grape_history_test')
root = op('/').create(baseCOMP, 'grape_history_test')
checks = []
try:
    manager = root.create(baseCOMP, 'manager')
    manager.store('sgrapeManager', True)
    manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test')
    page.appendStr('Updatestatus')
    page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(w / 'empty_personal')
    mapping = json.loads((GRAPE_ROOT / 'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat, file in mapping.items():
        manager.create(textDAT, dat).text = source_path(file).read_text(encoding='utf-8')
    r = manager.op('runtime').module
    r._owner = manager
    c = r.core()
    m = manager.op('sources').module
    links = manager.op('parameter_links').module

    def api(method, name, body=None):
        # The fixture must not add disposable source-value callbacks to the
        # user's separate TD global history. Its browser receipts remain real.
        with r.history_native_writes():
            return r.process_shader_request(method, '/api/' + name, body or {})
    def snapshot():
        return api('GET', 'sources')
    def row(data, ident):
        return next(x for x in data['uniforms'] if x['id'] == ident)
    def par(ident, component=0):
        item = row(snapshot(), ident)
        return getattr(r.shader_operator(r.target()).par, item['components'][component]['parameter'])
    def value(ident, number):
        data = snapshot()
        return api('POST', 'source-value', {'revision': data['revision'], 'id': ident, 'component': 0,
                                          'value': number, 'expected': row(data, ident)['components'][0]})
    def edit(ident, action, **extra):
        data = snapshot()
        return api('POST', 'source-edit', {'revision': data['revision'], 'id': ident, 'action': action,
                                         'expected': row(data, ident)['expected'], **extra})
    last_restore_request = None
    def restore(current, target, ids, graph=None, request_id=None, delta=None, value_ids=None):
        global last_restore_request
        last_restore_request = {'requestId': request_id or uuid.uuid4().hex,
            'revision': r.state()['revision'], 'fromToken': current['history']['token'],
            'toToken': target['history']['token'], 'sourceIds': ids,
            'currentGraph': copy.deepcopy(current.get('workingGraph', current['graph'])),
            'graph': copy.deepcopy(graph if graph is not None else target['graph'])}
        if delta:
            last_restore_request.update(deltaFromToken=delta[0]['history']['token'], deltaToToken=delta[1]['history']['token'])
        if value_ids:
            last_restore_request['valueIds'] = value_ids
        return api('POST', 'history-restore', last_restore_request)

    for kind in ('mat', 'top'):
        graph = c.normalize_top_sources(c.demo_graph('color', target=kind))[0]
        graph['declarations'] = [
            {'id': 'gain', 'kind': 'uniform', 'name': 'uGain', 'type': 'float', 'value': .25},
            {'id': 'other', 'kind': 'uniform', 'name': 'uOther', 'type': 'vec4', 'value': [.1, .2, .3, .4]}]
        shader = r.create_shader(root, 'History_' + kind, graph, kind)
        with r.shader_context(shader):
            data = snapshot()
            assert data['history']['token'] == snapshot()['history']['token']
            old_pixel = shader.op('pixel_shader').text
            gain_par = par('gain')
            changed = value('gain', .64)
            assert changed['history']['token'] != data['history']['token']
            par('gain', 2).val = .52
            undone = restore(changed, data, ['gain'])
            assert abs(par('gain').eval() - .25) < 1e-6
            assert gain_par.isSamePar(par('gain'))
            redone = restore(undone, changed, ['gain'], delta=(data, changed))
            assert abs(par('gain').eval() - .64) < 1e-6
            assert abs(par('gain', 2).eval() - .52) < 1e-6
            assert shader.op('pixel_shader').text == old_pixel
            checks.append(kind + ': native value Undo/Redo preserves the Par, shader code and externally changed untouched Z')

            # A different source changed externally must survive a scoped replay.
            par('other').val = .91
            undone = restore(redone, data, ['gain'], delta=(changed, data))
            assert abs(par('gain').eval() - .25) < 1e-6 and abs(par('other').eval() - .91) < 1e-6
            checks.append(kind + ': unrelated external source changes survive Undo')
            par('gain').val = .88
            conflict_before = (shader.op('state').text, par('gain').eval(), par('other').eval())
            try:
                restore(undone, changed, ['gain'])
                raise AssertionError('A touched external value was overwritten')
            except RuntimeError:
                pass
            assert conflict_before == (shader.op('state').text, par('gain').eval(), par('other').eval())
            checks.append(kind + ': touched external edits reject replay without mutation')

            # All native components, including dormant Z/W, survive physical deletion.
            par('gain', 2).val = .73
            before_remove = snapshot()
            removed = edit('gain', 'remove')
            assert all(x['id'] != 'gain' for x in removed['uniforms'])
            restored = restore(removed, before_remove, ['gain'])
            assert [x['id'] for x in restored['uniforms']] == ['gain', 'other']
            assert abs(par('gain').eval() - .88) < 1e-6 and abs(par('gain', 2).eval() - .73) < 1e-6
            assert abs(par('other').eval() - .91) < 1e-6
            assert shader.fetch(m.STORE)['gain']['name'] == 'uGain'
            checks.append(kind + ': deletion restores source identity, row order and dormant components')

            # A driver's evaluation is not a new configuration or history step.
            driver = shader.appendCustomPage('Driver Test').appendFloat('Historydriver')[0]
            driver.val = .21
            native = snapshot()
            driven = api('POST', 'source-edit', {'revision': native['revision'], 'action': 'driver', 'id': 'gain',
                'component': 0, 'expression': 'parent().par.Historydriver',
                'expected': row(native, 'gain')['components'][0]['modeExpected']})
            driver.val = .79
            assert snapshot()['history']['token'] == driven['history']['token']
            undone_driver = restore(driven, native, ['gain'])
            assert str(par('gain').mode).endswith('CONSTANT')
            redone_driver = restore(undone_driver, driven, ['gain'], delta=(native, driven))
            assert par('gain').expr == 'parent().par.Historydriver' and abs(par('gain').eval() - .79) < 1e-6
            restore(redone_driver, native, ['gain'], delta=(driven, native))
            checks.append(kind + ': Expression Undo/Redo preserves its driver; changing evaluation does not create a token')

            # Bind writes restore the actual master instead of detaching the native row.
            shader.appendCustomPage('History Controls')
            value('gain', .36)
            custom = api('GET', 'custom-parameters')
            native = snapshot()
            custom = api('POST', 'custom-parameters', {'action': 'bind', 'id': 'gain', 'page': 'History Controls',
                'revision': native['revision'], 'expectedPages': custom['expectedPages'], 'sourceExpected': row(native, 'gain')['expected']})
            control = next(x for x in custom['controls'] if 'gain' in x['sources'])
            master = getattr(shader.parGroup, control['name'])[0]
            before_bind = snapshot()
            bind_expr = par('gain').bindExpr
            changed_bind = value('gain', .62)
            undone_bind = restore(changed_bind, before_bind, ['gain'])
            assert abs(master.eval() - .36) < 1e-6
            assert par('gain').bindExpr == bind_expr and str(par('gain').mode).endswith('BIND')
            removed_bind = edit('gain', 'remove')
            restored_bind = restore(removed_bind, undone_bind, ['gain'])
            assert par('gain').bindExpr == bind_expr and str(par('gain').mode).endswith('BIND')
            assert abs(master.eval() - .36) < 1e-6
            checks.append(kind + ': bound value and deleted bound source restore their existing master')

            before_replacement = snapshot()
            changed_master = value('gain', .44)
            group_name = master.parGroup.name
            master.parGroup.destroy()
            new_master = shader.appendCustomPage('History Controls').appendFloat(group_name)[0]
            new_master.val = .44
            replacement_state = snapshot()
            try:
                restore(changed_master, before_replacement, ['gain'])
                raise AssertionError('A replacement custom control was overwritten')
            except RuntimeError:
                pass
            assert abs(new_master.eval() - .44) < 1e-6
            checks.append(kind + ': a same-name replacement custom master is not overwritten by old history')

            # One Apply may create two declarations. Each browser action remains separate.
            base = snapshot()
            a = copy.deepcopy(base['graph'])
            a['declarations'].append({'id': 'batchA', 'kind': 'uniform', 'name': 'uBatchA', 'type': 'float', 'value': .2})
            ab = copy.deepcopy(a)
            ab['declarations'].append({'id': 'batchB', 'kind': 'uniform', 'name': 'uBatchB', 'type': 'float', 'value': .4})
            applied = api('POST', 'apply', {'revision': base['revision'], 'graph': ab})
            assert applied.get('ok', True), applied
            both = snapshot()
            only_a = restore(both, base, ['batchB'], a)
            assert any(x['id'] == 'batchA' for x in only_a['uniforms'])
            assert all(x['id'] != 'batchB' for x in only_a['uniforms'])
            neither = restore(only_a, base, ['batchA'], base['graph'])
            assert all(x['id'] not in ('batchA', 'batchB') for x in neither['uniforms'])
            a_again = restore(neither, both, ['batchA'], a)
            both_again = restore(a_again, both, ['batchB'], ab)
            assert {'batchA', 'batchB'} <= {x['id'] for x in both_again['uniforms']}
            checks.append(kind + ': a batched Apply can Undo and Redo A/B as separate steps')

            # Requests can be retried after a lost response without applying twice.
            request_id = uuid.uuid4().hex
            once = restore(both_again, a_again, ['batchB'], a, request_id)
            revision_once = once['revision']
            twice = api('POST', 'history-restore', copy.deepcopy(last_restore_request))
            assert twice['revision'] == revision_once == r.state()['revision']
            checks.append(kind + ': duplicate requestId returns the prior result without another mutation')

            # Source creation followed by a rename can also share one Apply.
            before_pending = snapshot()
            pending_a = copy.deepcopy(before_pending['graph'])
            pending_a['declarations'].append({'id': 'pending', 'kind': 'uniform', 'name': 'uPendingA', 'type': 'float', 'value': .17})
            pending_b = copy.deepcopy(pending_a)
            pending_b['declarations'][-1]['name'] = 'uPendingB'
            assert api('POST', 'apply', {'graph': pending_b, 'revision': before_pending['revision']}).get('ok', True)
            renamed = snapshot()
            pending_a_again = restore(renamed, before_pending, ['pending'], pending_a)
            assert row(pending_a_again, 'pending')['name'] == 'uPendingA'
            gone = restore(pending_a_again, before_pending, ['pending'], before_pending['graph'])
            assert all(x['id'] != 'pending' for x in gone['uniforms'])
            checks.append(kind + ': batched create/rename restores the intermediate declaration with the same ID')

            assert api('GET', 'state')['savedStateIssue'] is None
        r._shaders.pop(shader.fetch('sgrapeShaderId'), None)
        shader.destroy()
    texture_graph = c.demo_graph('banana', target='mat')
    texture_graph['declarations'][0]['expose'] = True
    sampler_id = texture_graph['declarations'][0]['id']
    texture_shader = r.create_shader(root, 'History_Texture', texture_graph, 'mat')
    texture_top = root.create(constantTOP, 'texture_source')
    with r.shader_context(texture_shader):
        initial_texture = snapshot()
        visible = api('GET', 'uniforms')
        component = visible['textures'][sampler_id]['components'][0]
        result = api('POST', 'uniform-value', {'revision': visible['revision'], 'declarationId': sampler_id,
            'component': 0, 'value': texture_top.path, 'expected': component})
        assert result['history']['beforeToken'] == initial_texture['history']['token']
        after_texture = snapshot()
        texture_parameter = getattr(texture_shader.par, component['parameter'])
        assert str(texture_parameter.val) == texture_top.path
        undone_texture = restore(after_texture, initial_texture, [], value_ids=[sampler_id])
        assert str(texture_parameter.val) == component['value']
        redone_texture = restore(undone_texture, after_texture, [], delta=(initial_texture, after_texture), value_ids=[sampler_id])
        assert str(texture_parameter.val) == texture_top.path
        undone_texture = restore(redone_texture, initial_texture, [], delta=(after_texture, initial_texture), value_ids=[sampler_id])
        texture_top.destroy()
        replacement = root.create(constantTOP, 'texture_source')
        try:
            restore(undone_texture, after_texture, [], delta=(initial_texture, after_texture), value_ids=[sampler_id])
            raise AssertionError('A replacement TOP was accepted by path alone')
        except RuntimeError:
            pass
        assert str(texture_parameter.val) == component['value']
        checks.append('MAT: exposed Sampler source Undo/Redo restores its live Par and rejects a same-path replacement TOP')
    r._shaders.pop(texture_shader.fetch('sgrapeShaderId'), None)
    texture_shader.destroy()
    assert saved() == before_user
    result = {'passed': True, 'checks': checks, 'existingShadersPreserved': True}
    (w / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
finally:
    root.destroy()
