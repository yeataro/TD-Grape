"""Shader-local formal-output recovery; also usable as an Execute DAT.

The marker contains formal output only. Recovery never needs the manager,
compiler, HTTP server, or Preview graph, and never restores live Uniform values.
"""
import json

STORE = 'grapePixelPreviewRecoveryV1'
_MODES = ('CONSTANT', 'EXPRESSION', 'BIND')


def _parameter_state(parameter):
    state = {'val': parameter.val, 'expr': str(parameter.expr or ''),
             'bindExpr': str(parameter.bindExpr or ''),
             'mode': str(parameter.mode).split('.')[-1].upper()}
    _validate_parameter(state)
    return state


def _validate_parameter(state):
    if not isinstance(state, dict) or set(state) != {'val', 'expr', 'bindExpr', 'mode'}:
        raise RuntimeError('Invalid Preview recovery parameter state')
    if state['mode'] not in _MODES:
        raise RuntimeError('Preview recovery cannot capture an exported native output parameter')
    if not isinstance(state['expr'], str) or not isinstance(state['bindExpr'], str):
        raise RuntimeError('Invalid Preview recovery expression')
    if state['val'] is not None and type(state['val']) not in (str, int, float, bool):
        raise RuntimeError('Preview recovery parameter must contain a JSON scalar')
    json.dumps(state, allow_nan=False)


def _operator(comp):
    native = comp.op('shader') or comp.op('material')
    if native is None or not native.valid:
        raise RuntimeError('Preview recovery shader operator is missing')
    return native


def _reference(comp, source):
    # A shader copied/saved as a TOX must resolve its own children locally.
    prefix = comp.path.rstrip('/') + '/'
    return source.path[len(prefix):] if source.path.startswith(prefix) else source.path


def _tops_state(comp, parameter):
    state = _parameter_state(parameter)
    if state['mode'] == 'CONSTANT' and isinstance(state['val'], str):
        # configure() supplies absolute generated TOP paths. Unlike actual TD
        # parameters, strings nested in the recovery marker do not rebase on a
        # component copy/TOX load. Keep internal references sibling-relative.
        prefix = comp.path.rstrip('/') + '/'
        state['val'] = ' '.join(path[len(prefix):] if path.startswith(prefix) else path
                                for path in state['val'].split())
    return state


def capture(comp):
    """Read formal generated output/configuration without sampling live values."""
    native = _operator(comp)
    pixel, manifest = comp.op('pixel_shader'), comp.op('manifest')
    if pixel is None or manifest is None:
        raise RuntimeError('Preview recovery requires pixel_shader and manifest DATs')
    result = {'version': 1, 'operator': native.name,
              'pixel': pixel.text, 'manifest': manifest.text,
              'vertex': comp.op('vertex_shader').text if comp.op('vertex_shader') else None}
    if native.name == 'material':
        count = int(native.seq.sampler.numBlocks)
        result['samplers'] = {'count': count, 'rows': [
            {suffix: _parameter_state(getattr(native.par, 'sampler' + str(index) + suffix))
             for suffix in ('name', 'top')} for index in range(count)]}
    elif native.name == 'shader':
        result['tops'] = _tops_state(comp, native.par.tops)
        inputs = []
        for index, connector in enumerate(native.inputConnectors):
            if len(connector.connections) > 1:
                raise RuntimeError('Unexpected multiple connections on a shader input')
            if connector.connections:
                connection = connector.connections[0]
                source = connection.owner
                output = next((i for i, item in enumerate(source.outputConnectors) if item == connection), None)
                if output is None:
                    raise RuntimeError('Preview recovery cannot identify source output connector')
                inputs.append({'input': index, 'source': _reference(comp, source), 'output': output})
        result['inputs'] = inputs
    else:
        raise RuntimeError('Unsupported Preview recovery output operator')
    # Reject invalid/nonportable data before the caller writes a recovery marker.
    return json.loads(json.dumps(result, allow_nan=False))


def _plan(comp, snapshot):
    if not isinstance(snapshot, dict) or snapshot.get('version') != 1:
        raise RuntimeError('Unsupported Preview recovery version')
    native = _operator(comp)
    if snapshot.get('operator') != native.name:
        raise RuntimeError('Preview recovery output kind changed')
    for key in ('pixel', 'manifest'):
        if not isinstance(snapshot.get(key), str):
            raise RuntimeError('Invalid Preview recovery ' + key)
    if snapshot.get('vertex') is not None and not isinstance(snapshot['vertex'], str):
        raise RuntimeError('Invalid Preview recovery vertex')
    dats = {'pixel_shader': snapshot['pixel'], 'manifest': snapshot['manifest']}
    if snapshot['vertex'] is not None:
        dats['vertex_shader'] = snapshot['vertex']
    for name in dats:
        if comp.op(name) is None:
            raise RuntimeError('Preview recovery DAT is missing: ' + name)
    inputs = []
    if native.name == 'material':
        sampler = snapshot.get('samplers')
        if (not isinstance(sampler, dict) or type(sampler.get('count')) is not int or
                sampler['count'] < 0 or not isinstance(sampler.get('rows'), list) or
                sampler['count'] != len(sampler['rows'])):
            raise RuntimeError('Invalid Preview recovery sampler rows')
        for index, row in enumerate(sampler['rows']):
            if not isinstance(row, dict) or set(row) != {'name', 'top'}:
                raise RuntimeError('Invalid Preview recovery sampler row')
            for suffix, state in row.items():
                _validate_parameter(state)
                if index < native.seq.sampler.numBlocks and getattr(native.par, 'sampler' + str(index) + suffix, None) is None:
                    raise RuntimeError('Preview recovery sampler parameter is missing')
    else:
        _validate_parameter(snapshot.get('tops'))
        if getattr(native.par, 'tops', None) is None or not isinstance(snapshot.get('inputs'), list):
            raise RuntimeError('Preview recovery TOP routing is missing')
        seen = set()
        for item in snapshot['inputs']:
            if (not isinstance(item, dict) or set(item) != {'input', 'source', 'output'} or
                    type(item['input']) is not int or item['input'] < 0 or item['input'] in seen or
                    type(item['output']) is not int or item['output'] < 0 or not isinstance(item['source'], str)):
                raise RuntimeError('Invalid Preview recovery TOP connection')
            source = comp.op(item['source'])
            if (source is None or not source.valid or source.family != 'TOP' or source == native or
                    item['output'] >= len(source.outputConnectors)):
                raise RuntimeError('Preview recovery TOP source is unavailable: ' + item['source'])
            seen.add(item['input'])
            inputs.append((item['input'], source.outputConnectors[item['output']]))
    return native, dats, inputs


def _apply_parameter(parameter, state):
    mode_type = globals().get('ParMode')
    parameter.mode = getattr(mode_type, 'CONSTANT', 'CONSTANT')
    parameter.val = state['val']
    parameter.expr = state['expr']
    parameter.bindExpr = state['bindExpr']
    parameter.mode = getattr(mode_type, state['mode'], state['mode'])


def _apply(comp, snapshot, plan):
    native, dats, inputs = plan
    if native.name == 'material':
        native.seq.sampler.numBlocks = snapshot['samplers']['count']
        for index, row in enumerate(snapshot['samplers']['rows']):
            for suffix, state in row.items():
                _apply_parameter(getattr(native.par, 'sampler' + str(index) + suffix), state)
    else:
        _apply_parameter(native.par.tops, snapshot['tops'])
        for connector in list(native.inputConnectors):
            connector.disconnect()
        for index, source in inputs:
            if index >= len(native.inputConnectors):
                raise RuntimeError('Preview recovery TOP input connector is unavailable')
            native.inputConnectors[index].connect(source)
    for name, text in dats.items():
        comp.op(name).text = text


def restore(comp):
    """Restore and clear a formal marker; retain it on any recovery failure."""
    marker = comp.fetch(STORE, None, search=False)
    if marker is None:
        return False
    if not isinstance(marker, dict) or set(marker) != {'output'}:
        raise RuntimeError('Invalid Preview recovery marker')
    snapshot = marker['output']
    plan = _plan(comp, snapshot)
    before = capture(comp)
    rollback = _plan(comp, before)
    try:
        _apply(comp, snapshot, plan)
    except Exception as original:
        try:
            _apply(comp, before, rollback)
        except Exception as failure:
            raise RuntimeError('Preview recovery and rollback failed; recovery marker retained: ' + str(failure)) from original
        raise
    comp.unstore(STORE)
    return True


def onStart():
    restore(parent())


def onCreate():
    restore(parent())
