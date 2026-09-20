"""Session-only, source-scoped native checkpoints for editor Undo/Redo.

Checkpoints are immutable configuration, not evaluated animation samples. They
never enter COMP storage/TOE and never invoke TD's global Undo or compile a TOP.
"""
import copy
import hashlib
import json
import re
import secrets
from collections import OrderedDict

MAX_CHECKPOINTS = 256
MAX_BYTES = 8 * 1024 * 1024
MAX_REQUESTS = 128
LINKS = 'grapeControlLinksV1'
_checkpoints = OrderedDict()
_requests = OrderedDict()
_sentinels = OrderedDict()


def _json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def _identity(runtime):
    comp = runtime.target(); operator = runtime.shader_operator(comp)
    return (comp.id, comp.fetch('sgrapeShaderId', None), operator.id)


def _mode(par):
    return str(par.mode).split('.')[-1].upper()


def _par_state(par):
    value = par.val
    # Numeric/name sequence Pars and owned numeric controls are JSON scalars.
    if not isinstance(value, (str, int, float, bool)) and value is not None:
        raise RuntimeError('This native parameter cannot be recorded in editor history.')
    return {'val': value, 'expr': str(par.expr or ''), 'bindExpr': str(par.bindExpr or ''), 'mode': _mode(par)}


def _semantic_par(state):
    result = dict(state)
    # Bound values belong to their master. Reading a Bind must not snapshot its
    # animated evaluation or overwrite a master during structural restoration.
    if result.get('mode') == 'BIND': result.pop('val', None)
    return result


def _row_pars(runtime, sequence, index):
    operator = runtime.shader_operator(runtime.target()); prefix = sequence + str(index)
    if hasattr(operator, 'pars'):
        pars = {p.name[len(prefix):]: p for p in operator.pars(prefix + '*')
                if re.fullmatch(re.escape(prefix) + r'[A-Za-z][A-Za-z0-9_]*', p.name)}
        if pars: return pars
    sources = runtime.source_module()
    return {suffix: sources.parameter(operator, sequence, index, suffix)
            for suffix in ('name',) + sources.SEQUENCE_CHANNELS[sequence]}


def _row(runtime, sequence, index):
    return {'sequence': sequence, 'index': index,
            'params': {suffix: _par_state(p) for suffix, p in _row_pars(runtime, sequence, index).items()}}


def _same_par(left, right):
    return left is not None and right is not None and bool(getattr(left, 'valid', True)) and bool(getattr(right, 'valid', True)) and left.isSamePar(right)


def _live(runtime):
    sources = runtime.source_module(); comp = runtime.target(); operator = runtime.shader_operator(comp)
    registry = comp.fetch(sources.STORE, {}) or {}; links = comp.fetch(LINKS, {})
    declarations = {d['id']: d for d in runtime.state()['graph']['declarations'] if d.get('kind') in sources.SOURCE_KINDS}
    entries = {}; handles = {}; native_index = sources.native_index(operator)
    for ident in set(declarations) | set(registry):
        record = copy.deepcopy(registry.get(ident)); native = sources.locate(operator, record, native_index)
        link = copy.deepcopy(links.get(ident)); controls = {}
        if link:
            for item in link.get('components', []):
                item.pop('last', None)
                p = getattr(comp.par, item['control'], None)
                if p is not None:
                    controls[item['control']] = {'owner': p.owner.id, 'name': p.name, 'index': p.index, 'parameter': _par_state(p)}
                    handles[(ident, item['control'])] = p
        entries[ident] = {'record': record, 'native': _row(runtime, native['sequence'], native['index']) if native else None,
                          'link': link, 'controls': controls}
    values = {}
    for declaration in runtime.state()['graph']['declarations']:
        ident = declaration['id']; kind = declaration.get('kind'); names = []
        if kind == 'sampler' and declaration.get('expose') and hasattr(runtime, 'texture_key'):
            binding = comp.fetch('sgrapePublicTextures', {}).get(runtime.texture_key(declaration))
            if binding: names = [binding['parameter']]
        elif kind == 'uniform' and declaration.get('expose'):
            names = comp.fetch('sgrapePublicUniforms', {}).get(ident, {}).get('parameters', [])
        fields = {}
        for name in names:
            par = getattr(comp.par, name, None)
            if par is None: continue
            fields[name] = {'parameter': _par_state(par), 'owner': par.owner.id, 'index': par.index}
            handles[('value', ident, name)] = par
            if kind == 'sampler' and str(par.val):
                source = comp.parent().op(str(par.val))
                fields[name]['topId'] = source.id if source else None
        if fields: values[ident] = {'kind': kind, 'fields': fields}
    return {'identity': _identity(runtime), 'entries': entries, 'values': values, 'sequenceCounts': {name: getattr(operator.seq, name).numBlocks for name in sources.SEQUENCE_CHANNELS if getattr(operator.seq, name, None) is not None}}, handles


def _signature(data):
    data = copy.deepcopy(data)
    for entry in data['entries'].values():
        if entry['native']:
            entry['native']['params'] = {k: _semantic_par(v) for k, v in entry['native']['params'].items()}
    return _json(data)


def capture(runtime):
    data, handles = _live(runtime); signature = _signature(data)
    for token, item in reversed(_checkpoints.items()):
        if item['signature'] == signature and all(_same_par(p, item['handles'].get(key)) for key, p in handles.items()):
            return {'token': token}
    token = secrets.token_urlsafe(24)
    _checkpoints[token] = {'data': copy.deepcopy(data), 'handles': handles, 'signature': signature, 'size': len(signature.encode('utf-8'))}
    while len(_checkpoints) > MAX_CHECKPOINTS or sum(item['size'] for item in _checkpoints.values()) > MAX_BYTES:
        _checkpoints.popitem(last=False)
    return {'token': token}


def attach(runtime, result):
    result = dict(result); result['history'] = capture(runtime)
    return result


def _checkpoint(runtime, token):
    item = _checkpoints.get(token)
    if item is None: raise RuntimeError('Editor history expired. Reload the current graph before starting a new history.')
    if tuple(item['data']['identity']) != _identity(runtime):
        raise RuntimeError('This editor history belongs to another Shader.')
    return item


def _declarations(graph):
    return {d['id']: d for d in graph['declarations'] if d.get('kind') in ('uniform','spec_constant','pop_buffer')}


def _validate_graph(graph):
    if not isinstance(graph, dict) or len(_json(graph).encode('utf-8')) > 512000:
        raise RuntimeError('Invalid history graph document.')
    if not isinstance(graph.get('declarations'), list) or not isinstance(graph.get('stages'), dict) or not isinstance(graph.get('functions', []), list):
        raise RuntimeError('Invalid history graph structure.')
    ids = set()
    for declaration in graph['declarations']:
        if not isinstance(declaration, dict) or not isinstance(declaration.get('id'), str) or declaration['id'] in ids:
            raise RuntimeError('Invalid or duplicate history declaration.')
        ids.add(declaration['id'])
    for part in list(graph['stages'].values()) + [f.get('graph') for f in graph.get('functions', []) if isinstance(f, dict)]:
        if not isinstance(part, dict) or not isinstance(part.get('nodes'), list) or not isinstance(part.get('edges'), list):
            raise RuntimeError('Invalid history graph structure.')


def _project(runtime, entry, declaration):
    """A coalesced Apply may not have captured this intermediate declaration."""
    sources = runtime.source_module(); entry = copy.deepcopy(entry)
    if declaration is None: return None
    types = sources.SPEC_TYPES if declaration.get('kind')=='spec_constant' else sources.TYPES
    is_buffer=declaration.get('kind')=='uniform' and declaration.get('type')=='samplerBuffer'
    is_pop=declaration.get('kind')=='pop_buffer'
    is_array = declaration.get('kind') == 'uniform' and bool(sources.array_shape(declaration.get('type')) or is_buffer)
    if (declaration.get('type') not in types and not is_array) or not sources.valid_name(declaration.get('name')):
        raise RuntimeError('Invalid native source declaration in editor history.')
    if entry and entry['native']:
        entry['native']['params']['name']['val'] = declaration['name']
        entry['record']['name'] = declaration['name']
        return entry
    if entry and entry['record'] and entry['record'].get('missing'):
        entry['record']['name'] = declaration['name']
        return entry
    if declaration.get('sourceMissing'):
        return {'record': {'name': declaration['name'], 'sequence': sources.source_sequence(declaration), 'index': 0, 'missing': True},
                'native': None, 'link': None, 'controls': {}}
    sequence = sources.source_sequence(declaration)
    if sequence not in sources.SEQUENCE_CHANNELS: raise RuntimeError('Unsupported native Uniform sequence.')
    value = declaration.get('value'); count = sources.source_components(declaration); values = [value] if count == 1 else value
    if is_pop:values=[declaration.get('popSource',''),declaration.get('attributeClass','point'),declaration.get('attribute','')]
    if is_array: values = [declaration.get('elementType','float') if is_buffer else sources.array_shape(declaration['type'])[0], declaration.get('arraySource', ''), 'texturebuffer' if is_buffer else 'uniformarray']
    if not isinstance(values, list) or (not is_array and not is_pop and len(values) != count):
        raise RuntimeError('Invalid Uniform defaults in editor history.')
    if not is_array and not is_pop: runtime.core().literal(value,declaration['type'])
    operator = runtime.shader_operator(runtime.target()); index = getattr(operator.seq, sequence).numBlocks
    params = {'name': {'val': declaration['name'], 'mode': 'CONSTANT', 'expr': '', 'bindExpr': ''}}
    for i, suffix in enumerate(sources.SEQUENCE_CHANNELS[sequence]):
        params[suffix] = {'val': values[i] if i < len(values) else 0, 'mode': 'CONSTANT', 'expr': '', 'bindExpr': ''}
        if sequence == 'matrix':
            params[suffix] = {'val':'', 'mode':'EXPRESSION', 'expr':sources.matrix_expression(declaration,values), 'bindExpr':''}
        if i == 0 and declaration.get('initialDriver') in sources.PRESETS:
            params[suffix].update(mode='EXPRESSION', expr=sources.PRESETS[declaration['initialDriver']])
    return {'record': {'name': declaration['name'], 'sequence': sequence, 'index': index},
            'native': {'sequence': sequence, 'index': index, 'params': params}, 'link': None, 'controls': {}}


def _entry_semantic(entry):
    if not entry: return None
    entry = copy.deepcopy(entry)
    if entry['record']: entry['record'].pop('index', None)
    if entry['native']:
        entry['native'].pop('index', None)
        entry['native']['params'] = {k: _semantic_par(v) for k, v in entry['native']['params'].items()}
    return entry


def _conflict():
    raise RuntimeError('Conflict: this source or its native control changed outside this history. Its current state was preserved.')


def _structural(before, after):
    left = before and before['native']; right = after and after['native']
    return bool(left) != bool(right) or bool(left and right and left['sequence'] != right['sequence'])


def _plan(before, after, current):
    """CAS only changed native fields; row reindex and other fields can change."""
    if _structural(before, after):
        old_sem = _entry_semantic(before); live_sem = _entry_semantic(current)
        if old_sem: old_sem.pop('controls', None)
        if live_sem: live_sem.pop('controls', None)
        if old_sem != live_sem: _conflict()
        return {'structural': True, 'params': [], 'controls': []}
    left = before and before['native']; right = after and after['native']; live = current and current['native']
    if bool(left) != bool(live): _conflict()
    params = []; controls = []
    if left and right:
        if left['sequence'] != live['sequence']: _conflict()
        for suffix in set(left['params']) | set(right['params']):
            old = left['params'].get(suffix); new = right['params'].get(suffix)
            if old is None or new is None: raise RuntimeError('Native parameter layout changed; this history cannot be restored.')
            if _semantic_par(old) != _semantic_par(new):
                if _semantic_par(live['params'].get(suffix, {})) != _semantic_par(old): _conflict()
                params.append(suffix)
    old_controls = (before or {}).get('controls', {}); new_controls = (after or {}).get('controls', {})
    for name in old_controls.keys() & new_controls.keys():
        if old_controls[name] != new_controls[name]:
            if (current or {}).get('controls', {}).get(name) != old_controls[name]: _conflict()
            controls.append(name)
    if (before or {}).get('link') != (after or {}).get('link'):
        if (current or {}).get('link') != (before or {}).get('link'): _conflict()
    return {'structural': False, 'params': params, 'controls': controls}


def _restrict_delta(runtime, before, after, scope_before, scope_after, logical_before, logical_after):
    # Receipts update current expectations. They must not expand an operation
    # from "edit X" to also include an unrelated Z changed by another editor.
    scope_before = _project(runtime, scope_before, logical_before)
    scope_after = _project(runtime, scope_after, logical_after)
    if _structural(scope_before, scope_after): return after
    if _structural(before, after): _conflict()
    result = copy.deepcopy(after)
    if not result: return result
    left = scope_before and scope_before['native']; right = scope_after and scope_after['native']
    allowed = {key for key in (left or {}).get('params', {}).keys() | (right or {}).get('params', {}).keys()
               if _semantic_par((left or {}).get('params', {}).get(key, {})) != _semantic_par((right or {}).get('params', {}).get(key, {}))}
    if logical_before and logical_after and logical_before != logical_after:
        changes = {key for key in logical_before.keys() | logical_after.keys() if logical_before.get(key) != logical_after.get(key)}
        if changes.issubset({'name', 'type', 'value', 'exposeName'}):
            allowed = {'name'} if 'name' in changes else set()
    if result['native'] and before and before['native']:
        for key in result['native']['params']:
            if key not in allowed and key in before['native']['params']:
                result['native']['params'][key] = copy.deepcopy(before['native']['params'][key])
    old_controls = (scope_before or {}).get('controls', {}); new_controls = (scope_after or {}).get('controls', {})
    for name in result['controls']:
        if old_controls.get(name) == new_controls.get(name) and name in (before or {}).get('controls', {}):
            result['controls'][name] = copy.deepcopy(before['controls'][name])
    if (scope_before or {}).get('link') == (scope_after or {}).get('link'):
        result['link'] = copy.deepcopy((before or {}).get('link'))
    return result


def _safe_row(runtime, sequence, index, entry=None):
    owned = {runtime.source_module().CHANNELS[sequence][item['index']]: item['control']
             for item in (entry or {}).get('link', {}).get('components', [])} if (entry or {}).get('link') else {}
    comp = runtime.target()
    for suffix, par in _row_pars(runtime, sequence, index).items():
        if _mode(par) == 'EXPORT' or getattr(par, 'exportSource', None) is not None:
            raise RuntimeError('Native Export connections prevent safely restoring this sequence. Its current state was preserved.')
        if list(getattr(par, 'bindReferences', []) or []):
            raise RuntimeError('An external Bind references this native sequence. Its current state was preserved.')
        if _mode(par) == 'BIND':
            name = owned.get(suffix); master = getattr(comp.par, name, None) if name else None
            if name is None or not _same_par(master, getattr(par, 'bindMaster', None)):
                raise RuntimeError('An external Bind controls this native sequence. Its current state was preserved.')


def _apply_par(par, state):
    try: mode_type = ParMode
    except NameError: mode_type = None
    constant = getattr(mode_type, 'CONSTANT', 'CONSTANT')
    par.mode = constant
    par.val = state['val']
    par.expr = state['expr']; par.bindExpr = state['bindExpr']
    par.mode = getattr(mode_type, state['mode'], state['mode'])


def _write_row(runtime, row, index):
    pars = _row_pars(runtime, row['sequence'], index)
    if not set(row['params']).issubset(pars): raise RuntimeError('Native parameter layout changed.')
    for suffix, value in row['params'].items(): _apply_par(pars[suffix], value)


def _delete_row(runtime, sequence, index, undo):
    operator = runtime.shader_operator(runtime.target()); seq = getattr(operator.seq, sequence)
    row = _row(runtime, sequence, index)
    if seq.numBlocks == 1:
        undo.append(lambda: _write_row(runtime, row, 0))
        p = _row_pars(runtime, sequence, 0)['name']; value = _par_state(p)
        value.update(val='', mode='CONSTANT', expr='', bindExpr=''); _apply_par(p, value)
        _remember_sentinel(runtime, sequence)
    else:
        def rollback():
            _insert_block(seq, index); _write_row(runtime, row, index)
        undo.append(rollback); seq.destroyBlock(index)


def _insert_block(seq, index):
    if index == seq.numBlocks: seq.numBlocks += 1
    else: seq.insertBlock(index)


def _sequence_snapshot(runtime, sequence):
    seq = getattr(runtime.shader_operator(runtime.target()).seq, sequence)
    return [_row(runtime, sequence, index) for index in range(seq.numBlocks)]


def _restore_sequence(runtime, sequence, rows):
    seq = getattr(runtime.shader_operator(runtime.target()).seq, sequence)
    seq.numBlocks = len(rows)
    for index, row in enumerate(rows):
        pars = _row_pars(runtime, sequence, index)
        for suffix, value in row['params'].items():
            if _semantic_par(_par_state(pars[suffix])) != _semantic_par(value): _apply_par(pars[suffix], value)


def preflight_edit(runtime, body):
    if body.get('action') != 'remove': return
    sources = runtime.source_module(); comp = runtime.target()
    sources.sync(runtime); entries = _live(runtime)[0]['entries']
    entry = entries.get(body.get('id'))
    if not entry or not entry['native']: return
    sequence = entry['native']['sequence']; start = entry['native']['index']
    seq = getattr(runtime.shader_operator(comp).seq, sequence)
    for index in range(start, seq.numBlocks):
        item = next((e for e in entries.values() if e['native'] and e['native']['sequence'] == sequence and e['native']['index'] == index), None)
        _safe_row(runtime, sequence, index, item)


def _remember_sentinel(runtime, sequence):
    _sentinels[(_identity(runtime), sequence)] = _row(runtime, sequence, 0)
    while len(_sentinels) > MAX_CHECKPOINTS: _sentinels.popitem(last=False)


def note_edit(runtime, body, before_token):
    if body.get('action') != 'remove': return
    checkpoint = _checkpoints.get(before_token)
    entry = checkpoint['data']['entries'].get(body.get('id')) if checkpoint else None
    if not entry or not entry['native']: return
    sequence = entry['native']['sequence']; seq = getattr(runtime.shader_operator(runtime.target()).seq, sequence)
    if checkpoint['data']['sequenceCounts'].get(sequence) == 1 and seq.numBlocks == 1 and not _row_pars(runtime, sequence, 0)['name'].eval():
        _remember_sentinel(runtime, sequence)


def _insert_row(runtime, row, undo):
    operator = runtime.shader_operator(runtime.target()); seq = getattr(operator.seq, row['sequence'])
    index = min(row['index'], seq.numBlocks)
    pars = _row_pars(runtime, row['sequence'], 0)
    pristine = all(_mode(pars[suffix]) == 'CONSTANT' and pars[suffix].isDefault for suffix in runtime.source_module().SEQUENCE_CHANNELS[row['sequence']])
    owned = _sentinels.get((_identity(runtime), row['sequence'])) == _row(runtime, row['sequence'], 0)
    if seq.numBlocks == 1 and not pars['name'].eval() and (pristine or owned):
        # Only an untouched initial row or a deletion observed by this history
        # is reusable; an edited empty native row is still user-owned.
        before = _row(runtime, row['sequence'], 0); index = 0
        undo.append(lambda: _write_row(runtime, before, 0))
    else:
        undo.append(lambda: seq.destroyBlock(index)); _insert_block(seq, index)
    _write_row(runtime, row, index)
    return index


def _restore_storage(comp, key, value):
    if value is None: comp.unstore(key)
    else: comp.store(key, value)


def restore(runtime, body):
    request_id = body.get('requestId')
    if not isinstance(request_id, str) or not 1 <= len(request_id) <= 160: raise RuntimeError('History requires a request ID.')
    request_key = (_identity(runtime), request_id); fingerprint = hashlib.sha256(_json(body).encode()).hexdigest()
    if request_key in _requests:
        previous = _requests[request_key]
        if previous['fingerprint'] != fingerprint: raise RuntimeError('History request ID was reused for a different operation.')
        return copy.deepcopy(previous['result'])
    sources = runtime.source_module(); sources.sync(runtime)
    current_state = copy.deepcopy(runtime.checked_state())
    if body.get('revision') != current_state['revision']: raise RuntimeError('Conflict: refresh the native source revision before Undo/Redo.')
    old = _checkpoint(runtime, body.get('fromToken')); target = _checkpoint(runtime, body.get('toToken'))
    delta_old = _checkpoint(runtime, body.get('deltaFromToken', body.get('fromToken')))
    delta_target = _checkpoint(runtime, body.get('deltaToToken', body.get('toToken')))
    desired = copy.deepcopy(body.get('graph')); logical = body.get('currentGraph')
    _validate_graph(desired); _validate_graph(logical)
    ids = body.get('sourceIds')
    if not isinstance(ids, list) or len(ids) > 256 or any(not isinstance(i, str) for i in ids) or len(ids) != len(set(ids)):
        raise RuntimeError('Invalid source scope in history request.')
    left_decl = _declarations(logical); right_decl = _declarations(desired)
    changed = {ident for ident in left_decl.keys() | right_decl.keys() if left_decl.get(ident) != right_decl.get(ident)}
    if not changed.issubset(ids): raise RuntimeError('History cannot restore declarations outside its source scope.')
    live, live_handles = _live(runtime); entries = live['entries']; plans = {}; projected = {}
    for ident in ids:
        before = old['data']['entries'].get(ident); checkpoint_target = target['data']['entries'].get(ident)
        after = _project(runtime, checkpoint_target, right_decl.get(ident))
        after = _restrict_delta(runtime, before, after, delta_old['data']['entries'].get(ident),
                                delta_target['data']['entries'].get(ident), left_decl.get(ident), right_decl.get(ident))
        projected[ident] = after
        plans[ident] = _plan(before, after, entries.get(ident))
        # Do not reconnect a custom Par recreated at the same path/name.
        for name in (after or {}).get('controls', {}):
            remembered = target['handles'].get((ident, name)); actual = getattr(runtime.target().par, name, None)
            if not _same_par(remembered, actual) or actual.index != after['controls'][name]['index'] or actual.owner.id != after['controls'][name]['owner']: _conflict()
        for name in plans[ident]['controls']:
            if not _same_par(old['handles'].get((ident, name)), live_handles.get((ident, name))): _conflict()
            par = live_handles[(ident, name)]
            if not par.enable or par.readOnly or _mode(par) != 'CONSTANT' or par.index != old['data']['entries'][ident]['controls'][name]['index']: _conflict()
    value_ids = body.get('valueIds', [])
    if not isinstance(value_ids, list) or len(value_ids) > 256 or any(not isinstance(i, str) for i in value_ids) or len(value_ids) != len(set(value_ids)):
        raise RuntimeError('Invalid value scope in history request.')
    value_plan = []
    for ident in value_ids:
        before = old['data']['values'].get(ident); after = target['data']['values'].get(ident); now = live['values'].get(ident)
        if not before or not after or not now or before['kind'] != after['kind'] or set(before['fields']) != set(after['fields']):
            raise RuntimeError('This exposed value is no longer available for history.')
        for name, wanted in after['fields'].items():
            previous = before['fields'][name]
            scope_before = delta_old['data']['values'].get(ident, {}).get('fields', {}).get(name)
            scope_after = delta_target['data']['values'].get(ident, {}).get('fields', {}).get(name)
            if scope_before == scope_after or previous == wanted: continue
            par = getattr(runtime.target().par, name, None)
            if now['fields'].get(name) != previous or not _same_par(par, old['handles'].get(('value', ident, name))) or not _same_par(par, target['handles'].get(('value', ident, name))): _conflict()
            if not par.enable or par.readOnly or par.index != wanted['index'] or par.index != previous['index'] or previous['parameter']['mode'] != 'CONSTANT' or wanted['parameter']['mode'] != 'CONSTANT': _conflict()
            if after['kind'] == 'sampler' and wanted['parameter']['val']:
                comp = runtime.target(); top = comp.parent().op(wanted['parameter']['val']); helper = comp.op('texture_sources')
                if top is None or top.id != wanted.get('topId') or not helper or not helper.module._external_allowed(comp, top): _conflict()
            elif after['kind'] == 'uniform':
                declaration = right_decl.get(ident)
                if not declaration or declaration['kind'] != 'uniform':_conflict()
                sources.validate_uniform_component(declaration,wanted['parameter']['val'])
            value_plan.append((par, wanted['parameter']))
    # A failed type/default Apply can leave a browser-only Spec draft between
    # two equal native checkpoints. Undo must reach that draft without turning
    # its metadata into an applied declaration or replaying an unsafe value.
    native_draft = False
    no_native_writes = not value_plan and all(
        not plan['structural'] and not plan['params'] and not plan['controls']
        and _entry_semantic(projected[ident]) == _entry_semantic(old['data']['entries'].get(ident))
        for ident, plan in plans.items())
    for ident, declaration in right_decl.items():
        if ident not in plans or declaration.get('kind') not in sources.SOURCE_KINDS: continue
        plan = plans[ident]; after = projected[ident]
        effective = copy.deepcopy(after if plan['structural'] else entries.get(ident))
        if effective and effective['native'] and not plan['structural']:
            for suffix in plan['params']:
                effective['native']['params'][suffix] = after['native']['params'][suffix]
        try:
            native = (effective or {}).get('native') or {}
            if declaration['kind'] == 'spec_constant':
                sources.validate_spec_native(declaration, declaration.get('value'), 'default')
                value = native.get('params', {}).get('value', {})
                if value.get('mode') == 'CONSTANT': sources.validate_spec_native(declaration, value.get('val'))
            elif declaration['kind']=='uniform':
                sources.validate_uniform_native(declaration, declaration.get('value'), 'default')
                for channel in (() if native.get('sequence') in ('matrix','array') else sources.CHANNELS.get(native.get('sequence'), ())[:sources.source_components(declaration)]):
                    value = native.get('params', {}).get(channel, {})
                    if value.get('mode') == 'CONSTANT':sources.validate_uniform_component(declaration, value.get('val'))
                    elif value.get('mode') == 'BIND':
                        index = sources.CHANNELS[native['sequence']].index(channel)
                        item = next((item for item in (effective.get('link') or {}).get('components',[]) if item['index']==index),None)
                        if item and value.get('bindExpr') == 'parent().par.'+item['control']:
                            name = item['control']; control = getattr(runtime.target().par,name,None)
                            if control is None:_conflict()
                            wanted = after['controls'][name]['parameter'] if name in plan['controls'] else None
                            if wanted and wanted['mode']=='CONSTANT':
                                sources.validate_uniform_component(declaration,wanted['val'])
                            else:
                                sources.validate_uniform_component(declaration,control.eval())
        except RuntimeError:
            previous = left_decl.get(ident, {})
            changes = {key for key in previous.keys() | declaration.keys() if previous.get(key) != declaration.get(key)}
            checkpoints_equal = all(
                _entry_semantic(before['data']['entries'].get(ident)) == _entry_semantic(after['data']['entries'].get(ident))
                for before, after in ((old, target), (delta_old, delta_target)))
            if not (no_native_writes and checkpoints_equal and previous.get('kind') == declaration['kind']
                    and changes and changes.issubset({'type', 'value'}) and effective and effective['native']):
                raise
            native_draft = True
    # Validate all affected rows before any write; reindexing can also affect
    # references/exports attached to neighbours that are outside sourceIds.
    affected = {}
    for ident, plan in plans.items():
        if plan['structural']:
            for entry in (entries.get(ident), projected[ident]):
                if entry and entry['native']:
                    row = entry['native']; sequence = row['sequence']
                    affected[sequence] = min(affected.get(sequence, row['index']), row['index'])
        else:
            for suffix in plan['params']:
                row = entries[ident]['native']; par = _row_pars(runtime, row['sequence'], row['index'])[suffix]
                if not bool(par.enable) or par.readOnly: _conflict()
    for sequence in affected:
        seq = getattr(runtime.shader_operator(runtime.target()).seq, sequence)
        for index in range(min(affected[sequence], seq.numBlocks), seq.numBlocks):
            entry = next((e for e in entries.values() if e['native'] and e['native']['sequence'] == sequence and e['native']['index'] == index), None)
            _safe_row(runtime, sequence, index, entry)
    for ident, entry in projected.items():
        if plans[ident]['structural'] and entry and entry['native']:
            if any(p['mode'] == 'EXPORT' for p in entry['native']['params'].values()):
                raise RuntimeError('This native Export cannot be recreated by editor history.')
            owned = {runtime.source_module().CHANNELS[entry['native']['sequence']][item['index']]: item['control']
                     for item in (entry.get('link') or {}).get('components', [])}
            for suffix, state in entry['native']['params'].items():
                if state['mode'] == 'BIND' and (suffix not in owned or state['bindExpr'] != 'parent().par.' + owned[suffix]):
                    raise RuntimeError('This external Bind cannot be recreated by editor history.')
    # Invalid drafts remain browser working data, never authoritative DATs.
    working = desired if native_draft else None
    try: runtime.core().compile_graph(desired)
    except Exception: working = desired
    comp = runtime.target(); registry_before = copy.deepcopy(comp.fetch(sources.STORE, None))
    links_before = copy.deepcopy(comp.fetch(LINKS, None)); issues_before = copy.deepcopy(comp.fetch('grapeSourceIssues', None))
    registry = copy.deepcopy(registry_before or {}); links = copy.deepcopy(links_before or {})
    link_dat = comp.op('parameter_links'); link_module = link_dat.module if link_dat else None
    previous_busy = link_module._busy if link_module else False
    sequence_before = {sequence: _sequence_snapshot(runtime, sequence) for sequence in affected}
    sequence_expected = copy.deepcopy(sequence_before)
    undo = []
    if link_module: link_module._busy = True
    try:
        removals = [(entry['native']['sequence'], entry['native']['index'], ident) for ident, entry in entries.items()
                    if ident in plans and plans[ident]['structural'] and entry['native']]
        for sequence, index, ident in sorted(removals, reverse=True):
            _delete_row(runtime, sequence, index, undo)
            rows = sequence_expected[sequence]
            if len(rows) == 1: rows[0]['params']['name'].update(val='', mode='CONSTANT', expr='', bindExpr='')
            else: rows.pop(index)
        additions = [(entry['native']['sequence'], entry['native']['index'], ident) for ident, entry in projected.items()
                     if plans[ident]['structural'] and entry and entry['native']]
        for sequence, index, ident in sorted(additions):
            row = projected[ident]['native']; rows = sequence_expected[sequence]
            actual_index = _insert_row(runtime, row, undo); row['index'] = actual_index
            if getattr(runtime.shader_operator(comp).seq, sequence).numBlocks == len(rows): rows[actual_index] = copy.deepcopy(row)
            else: rows.insert(actual_index, copy.deepcopy(row))
        # Some TD builds reset shifted row parameters during insert. Repair
        # those effects from this transaction's live snapshot, including edited
        # empty rows, never from historical values of unselected sources.
        for sequence, rows in sequence_expected.items():
            if getattr(runtime.shader_operator(comp).seq, sequence).numBlocks != len(rows):
                raise RuntimeError('The native sequence changed during history restoration.')
            for index, expected_row in enumerate(rows):
                current_row = _row(runtime, sequence, index)
                for suffix, value in expected_row['params'].items():
                    if _semantic_par(current_row['params'][suffix]) != _semantic_par(value):
                        _apply_par(_row_pars(runtime, sequence, index)[suffix], value)
        for ident, plan in plans.items():
            entry = projected[ident]
            if not plan['structural'] and entry and entry['native']:
                operator = runtime.shader_operator(comp)
                located = sources.locate(operator, entries[ident]['record'])
                if located is None: _conflict()
                pars = _row_pars(runtime, located['sequence'], located['index'])
                for suffix in plan['params']:
                    par = pars[suffix]; previous = _par_state(par)
                    undo.append(lambda par=par, previous=previous: _apply_par(par, previous))
                    _apply_par(par, entry['native']['params'][suffix])
            for name in plan['controls']:
                par = getattr(comp.par, name); previous = _par_state(par)
                undo.append(lambda par=par, previous=previous: _apply_par(par, previous))
                _apply_par(par, entry['controls'][name]['parameter'])
            if entry and entry['record']: registry[ident] = copy.deepcopy(entry['record'])
            else: registry.pop(ident, None)
            if entry and entry['link']:
                link = copy.deepcopy(entry['link'])
                for item in link['components']: item['last'] = float(getattr(comp.par, item['control']).eval())
                links[ident] = link
            else: links.pop(ident, None)
        for par, wanted in value_plan:
            previous = _par_state(par)
            undo.append(lambda par=par, previous=previous: _apply_par(par, previous))
            _apply_par(par, wanted)
        comp.store(sources.STORE, registry); comp.store(LINKS, links)
        canonical = copy.deepcopy(current_state['graph'] if working is not None else desired)
        if working is not None:
            existing = {d['id'] for d in canonical['declarations']}
            for ident in ids:
                if ident in right_decl and ident not in existing:
                    canonical['declarations'].append(copy.deepcopy(right_decl[ident]))
                elif ident not in right_decl:
                    if sources.source_references(canonical, ident):
                        record = copy.deepcopy((entries.get(ident) or {}).get('record'))
                        if record:
                            record['missing'] = True; registry[ident] = record
                    else:
                        canonical['declarations'] = [d for d in canonical['declarations'] if d['id'] != ident]
        # A removed source referenced by the valid applied graph remains a
        # missing declaration there; the local workingGraph can already omit it.
        existing_ids = {d['id'] for d in canonical['declarations']}
        canonical['declarations'].extend(copy.deepcopy(d) for d in current_state['graph']['declarations']
                                         if d.get('kind') in sources.SOURCE_KINDS and d['id'] not in ids and d['id'] not in existing_ids)
        declarations, registry, issues = sources.reconcile(canonical['declarations'], registry, sources.native_rows(runtime.shader_operator(comp)))
        canonical['declarations'] = declarations
        runtime.core().compile_graph(canonical)
        after_state = copy.deepcopy(current_state); after_state.update(graph=canonical, revision=current_state['revision'] + 1, sourceChanged=True)
        _json(after_state)
        comp.store(sources.STORE, registry); comp.store('grapeSourceIssues', issues)
        runtime.write_state(after_state)
        result = attach(runtime, sources.snapshot(runtime)); result['ok'] = True
        if working is not None: result['workingGraph'] = working
    except Exception as exc:
        rollback_error = None
        for callback in reversed(undo):
            try: callback()
            except Exception as failure: rollback_error = failure
        for sequence, rows in sequence_before.items():
            try: _restore_sequence(runtime, sequence, rows)
            except Exception as failure: rollback_error = failure
        _restore_storage(comp, sources.STORE, registry_before); _restore_storage(comp, LINKS, links_before)
        _restore_storage(comp, 'grapeSourceIssues', issues_before); runtime.write_state(current_state)
        if rollback_error: raise RuntimeError('History restoration failed and native rollback needs review; current graph data was retained.') from rollback_error
        raise RuntimeError('History restoration failed; the previous source state was restored. ' + str(exc)) from exc
    finally:
        if link_module:
            link_module._busy = previous_busy; link_module.prime(comp)
    _requests[request_key] = {'fingerprint': fingerprint, 'result': copy.deepcopy(result), 'size': len(_json(result).encode('utf-8'))}
    while len(_requests) > MAX_REQUESTS or sum(item['size'] for item in _requests.values()) > MAX_BYTES: _requests.popitem(last=False)
    return result
