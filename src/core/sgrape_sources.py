"""Native numeric source ownership, separate from graph and custom controls.

The GLSL OP owns current values and their modes. Graph declarations retain
portable defaults/type metadata. No stored snapshot is a competing value store.
"""
import copy
import hashlib
import json
import math
import re
import uuid
from contextlib import nullcontext

STORE = 'grapeNativeUniformsV1'
# Native vector rows contain up to four scalar components. Their GLSL family is
# declared by the graph, independent of the native page's numeric widgets.
TYPES = {name: count for scalar, prefix in (('float','vec'), ('int','ivec'), ('uint','uvec'), ('bool','bvec'))
         for count in range(1,5) for name in (scalar if count == 1 else prefix+str(count),)}
SPEC_TYPES = ('int', 'uint', 'bool', 'float')
SOURCE_KINDS = ('uniform', 'spec_constant')
PRESETS = {'time': 'me.time.seconds', 'frame': 'me.time.frame',
           'absTime': 'absTime.seconds', 'absFrame': 'absTime.frame'}
CHANNELS = {'vec': ('valuex', 'valuey', 'valuez', 'valuew'),
            'color': ('rgbr', 'rgbg', 'rgbb', 'alpha'), 'const': ('value',)}


def source_sequence(declaration):
    return 'const' if declaration.get('kind') == 'spec_constant' else declaration.get('nativeSequence', 'vec')


def source_components(declaration):
    return 1 if declaration.get('kind') == 'spec_constant' else TYPES[declaration['type']]


def next_constant_id(declarations):
    used = {d.get('constantId') for d in declarations if d.get('kind') == 'spec_constant'}
    return next(i for i in range(len(used) + 1) if i not in used)


def source_family(ty):
    if ty not in TYPES: raise RuntimeError('Unsupported native source type.')
    return 'bool' if ty == 'bool' or ty.startswith('bvec') else 'uint' if ty == 'uint' or ty.startswith('uvec') else 'int' if ty == 'int' or ty.startswith('ivec') else 'float'


def validate_uniform_component(declaration, value, role='value'):
    """Validate an editor write's declared type; native transport is TD-owned."""
    family = source_family(declaration['type'])
    name = declaration.get('name', 'Uniform')
    if family == 'bool':
        if not isinstance(value, (bool, int, float)) or value not in (0, 1):
            raise RuntimeError('Uniform '+name+': native boolean '+role+' must be 0 or 1.')
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise RuntimeError('Uniform '+name+': native '+role+' must be a finite number.')
    if family == 'float': return
    low, high = (-2147483648, 2147483647) if family == 'int' else (0, 4294967295)
    if int(value) != value or not low <= value <= high:
        raise RuntimeError('Uniform '+name+': native '+role+' must be a whole '+family+' value from '+str(low)+' to '+str(high)+'.')


def validate_uniform_native(declaration, value, role='value'):
    values = [value] if source_components(declaration) == 1 else value
    if not isinstance(values, (list, tuple)) or len(values) != source_components(declaration):
        raise RuntimeError('Uniform '+declaration.get('name', '')+': invalid native component count.')
    for component in values: validate_uniform_component(declaration, component, role)


def source_graph(runtime, comp):
    # Native TD Undo runs after the HTTP shader context has already exited.
    # Always resolve metadata against the original Shader, never the manager's
    # current target or a declaration captured before a type change.
    with runtime.shader_context(comp) if hasattr(runtime, 'shader_context') else nullcontext():
        return runtime.state()['graph']


def validate_source_value(runtime, comp, ident, value, index=0):
    graph = source_graph(runtime, comp)
    declaration = next((d for d in graph['declarations'] if d['id'] == ident and d.get('kind') in SOURCE_KINDS), None)
    if not declaration or declaration.get('sourceMissing') or not 0 <= index < source_components(declaration):
        raise RuntimeError('The native source or its component is no longer available.')
    if declaration['kind'] == 'uniform':
        validate_uniform_component(declaration, value)
    elif declaration['type'] == 'bool':
        validate_uniform_component(declaration, value)
    elif declaration['type'] == 'float':
        runtime.core().number(value)
    else:
        validate_spec_native(declaration, value)


def validate_spec_native(declaration, value, role='value'):
    ty = declaration.get('type')
    if ty not in ('int', 'uint'): return
    name = declaration.get('name', 'Spec Constant')
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or int(value) != value:
        raise RuntimeError('Spec Constant '+name+': native '+role+' must be a whole '+ty+' value.')
    minimum, maximum = (-2147483648, 2147483647) if ty == 'int' else (0, 4294967295)
    if not minimum <= value <= maximum:
        raise RuntimeError('Spec Constant '+name+': '+role+' must be a whole '+ty+' value from '+str(minimum)+' to '+str(maximum)+'.')


def valid_name(name):
    return isinstance(name, str) and bool(re.fullmatch(r'[A-Za-z][A-Za-z_0-9]{0,47}', name)) and not name.startswith(('gl_', 'TD', 'sg_', 'sTD'))


def token(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def edit_token(row):
    return token({k: row[k] for k in ('sequence', 'index', 'name', 'nameMode')})


def parameter(operator, sequence, index, suffix):
    return getattr(operator.par, sequence + str(index) + suffix)


def editable_parameter(p):
    if str(p.mode).endswith('CONSTANT'): return p
    links=p.owner.parent().op('parameter_links')
    return links.module.editable(p) if links else None


def component(p):
    try:
        value = float(p.eval())
        if not math.isfinite(value): raise ValueError('Non-finite value')
    except Exception:
        value = None
    mode = str(p.mode).split('.')[-1].upper()
    edit=editable_parameter(p)
    expression=p.expr if mode=='EXPRESSION' else ''
    return {'parameter': p.name, 'value': value, 'mode': mode,
            'expression': expression, 'binding':p.bindExpr if mode=='BIND' else '',
            'modeWritable': mode in ('CONSTANT','EXPRESSION') and bool(p.enable) and not p.readOnly,
            'modeExpected': token({'parameter':p.name,'mode':mode,'expression':expression,
                                   'bind':p.bindExpr if mode=='BIND' else ''}),
            'writable': value is not None and edit is not None and bool(edit.enable) and not edit.readOnly,
            **({'control':edit.name} if edit is not None and not edit.isSamePar(p) else {})}


def native_rows(operator):
    rows = []
    for sequence, channels in CHANNELS.items():
        seq = getattr(operator.seq, sequence, None)
        if seq is None: continue
        for index in range(seq.numBlocks):
            p = parameter(operator, sequence, index, 'name')
            name = str(p.eval())
            if not name: continue
            rows.append({'sequence': sequence, 'index': index, 'name': name,
                         'nameMode': str(p.mode).split('.')[-1].upper(),
                         'components': [component(parameter(operator, sequence, index, c)) for c in channels]})
    return rows


def reconcile(declarations, registry, rows):
    """Match within one OP, never by global names or transient Par identities.

    Exact unique names survive row movement. A single rename in an otherwise
    unchanged sequence can retain its ID. Ambiguous edits stay missing.
    """
    declarations = copy.deepcopy(declarations)
    registry = {ident: copy.deepcopy(record) for ident, record in registry.items() if any(d['id'] == ident for d in declarations)}
    matches = {}; taken = set(); issues = []
    for ident, record in registry.items():
        found = [i for i, row in enumerate(rows) if row['name'] == record['name'] and row['sequence'] == record['sequence']]
        if len(found) == 1:
            matches[ident] = found[0]; taken.add(found[0])
    for sequence in CHANNELS:
        old = [(ident, rec) for ident, rec in registry.items() if rec['sequence'] == sequence and not rec.get('missing')]
        new = [(i, row) for i, row in enumerate(rows) if row['sequence'] == sequence]
        absent = [(ident, rec) for ident, rec in old if ident not in matches]
        added = [(i, row) for i, row in new if i not in taken]
        # All other rows must stay at their old slots: a compound move/rename
        # cannot be distinguished safely by a polling snapshot.
        unchanged_slots = all(rows[matches[ident]]['index'] == rec['index'] for ident, rec in old if ident in matches)
        if len(old) == len(new) and len(absent) == len(added) == 1 and unchanged_slots:
            ident, rec = absent[0]; i, row = added[0]
            if rec['index'] == row['index'] and valid_name(row['name']):
                matches[ident] = i; taken.add(i)
    by_id = {d['id']: d for d in declarations}
    occupied = {d['name'] for d in declarations if d['kind'] not in SOURCE_KINDS}
    for ident, record in registry.items():
        decl = by_id.get(ident)
        if not decl: continue
        row = rows[matches[ident]] if ident in matches else None
        duplicate = row is not None and sum(r['name'] == row['name'] for r in rows) != 1
        if row is None or duplicate or not valid_name(row['name']) or row['name'] in occupied:
            decl['sourceMissing'] = True; record['missing'] = True
            issues.append({'id': ident, 'message': 'Native source is missing or ambiguous: ' + decl['name']})
        else:
            decl['name'] = row['name']; decl.pop('sourceMissing', None)
            if row['sequence']=='color':decl['nativeSequence']='color'
            record.update(name=row['name'], index=row['index']); record.pop('missing', None)
    known = {d['name'] for d in declarations}
    for i, row in enumerate(rows):
        if i in taken: continue
        name = row['name']
        if not valid_name(name) or name in known or sum(r['name'] == name for r in rows) != 1:
            issues.append({'message': 'Review the native Uniform name: ' + name}); continue
        kind = 'spec_constant' if row['sequence'] == 'const' else 'uniform'
        ident = kind + '_' + uuid.uuid4().hex
        ty = 'vec4' if row['sequence'] == 'color' else 'float'
        values = [c['value'] if c['value'] is not None and abs(c['value']) <= 1e20 else 0.0 for c in row['components']]
        if kind == 'spec_constant':
            ty = 'int'; values = [max(-2147483648, min(2147483647, int(values[0])))]
        declarations.append({'id': ident, 'kind': kind, 'name': name, 'type': ty,
                             'value': values if ty == 'vec4' else values[0],
                             **({'constantId': next_constant_id(declarations), 'nativeSequence':'const'} if kind == 'spec_constant' else {}),
                             **({'nativeSequence':'color'} if row['sequence']=='color' else {})})
        registry[ident] = {k: row[k] for k in ('sequence', 'index', 'name')}
        known.add(name)
    return declarations, registry, issues


def locate(operator, record):
    if not record or record.get('missing'): return None
    rows = [row for row in native_rows(operator) if row['name'] == record['name'] and row['sequence'] == record['sequence']]
    return rows[0] if len(rows) == 1 else None


def capture_configuration(runtime, comp):
    operator = runtime.shader_operator(comp)
    return {'registry': copy.deepcopy(comp.fetch(STORE, None)),
            'sequences': {name: [(parameter(operator, name, i, 'name'), parameter(operator, name, i, 'name').val)
                                for i in range(getattr(operator.seq, name).numBlocks)]
                          for name in CHANNELS if getattr(operator.seq, name, None) is not None}}


def restore_configuration(runtime, comp, before):
    operator = runtime.shader_operator(comp)
    for name, pars in before['sequences'].items():
        getattr(operator.seq, name).numBlocks = len(pars)
        for p, value in pars:
            if p.val != value: p.val = value
    if before['registry'] is None: comp.unstore(STORE)
    else: comp.store(STORE, before['registry'])


def configure(runtime, comp, graph, public, preserve=None, input_owner=None):
    """Create missing declarations once; never reset existing rows/modes.

    Candidates get effective values for validation. Existing destination Par
    objects, expressions, exports, binds and dormant Z/W survive recompiles.
    """
    operator = runtime.shader_operator(comp)
    registry = copy.deepcopy(comp.fetch(STORE, {}))
    original = runtime.shader_operator(input_owner) if input_owner else operator
    original_registry = input_owner.fetch(STORE, {}) if input_owner else registry
    old_graph = {}
    if comp.op('graph') and comp.op('graph').text:
        old_graph = {d['id']: d for d in json.loads(comp.op('graph').text).get('declarations', [])}
    declarations = [d for d in graph['declarations'] if d['kind'] in SOURCE_KINDS]
    # Validate candidate types before creating/renaming native rows.
    # Precision and numerical conversion remain the host's responsibility.
    for decl in declarations:
        if decl['kind'] == 'uniform' and not decl.get('sourceMissing'):
            validate_uniform_native(decl, decl['value'], 'default')
            source = locate(original, original_registry.get(decl['id']))
            if source is None:
                matches = [r for r in native_rows(original) if r['name'] == decl['name'] and r['sequence'] != 'const']
                source = matches[0] if len(matches) == 1 else None
            if source:
                for component in source['components'][:source_components(decl)]:
                    validate_uniform_component(decl, component['value'])
            elif decl['id'] in (preserve or {}): validate_uniform_native(decl, preserve[decl['id']])
        if decl['kind'] != 'spec_constant' or decl.get('sourceMissing'): continue
        validate_spec_native(decl, decl['value'], 'default')
        source = locate(original, original_registry.get(decl['id']))
        if source is None:
            matches = [r for r in native_rows(original) if r['name'] == decl['name'] and r['sequence'] == 'const']
            source = matches[0] if len(matches) == 1 else None
        if source: validate_spec_native(decl, source['components'][0]['value'])
        elif decl['id'] in (preserve or {}): validate_spec_native(decl, preserve[decl['id']])
    # Legacy builds only instantiated used uniforms. Adopt those exact native
    # names; don't reuse arbitrary blank slots carrying expressions/exports.
    for decl in declarations:
        ident = decl['id']; record = registry.get(ident)
        if decl.get('sourceMissing'):
            if record: record['missing'] = True
            continue
        existing = locate(operator, record)
        if existing is None and not record:
            candidates = [r for r in native_rows(operator) if r['name'] == decl['name']]
            if len(candidates) > 1: raise RuntimeError('Duplicate native Uniform: ' + decl['name'])
            existing = candidates[0] if candidates else None
        if existing:
            sequence = existing['sequence']; index = existing['index']
            if (sequence=='const') != (decl['kind']=='spec_constant'):
                raise RuntimeError('Native source kind differs from its declaration: ' + decl['name'])
            if existing['name'] != decl['name']:
                if existing['nameMode'] != 'CONSTANT': raise RuntimeError('The Uniform name is controlled by TD.')
                parameter(operator, sequence, index, 'name').val = decl['name']
            previous = old_graph.get(ident, {})
            if decl['kind']=='uniform' and ident not in comp.fetch('grapeCustomMigratedV1',[]) and bool(previous.get('expose')) != bool(decl.get('expose')):
                legacy = comp.fetch('sgrapePublicUniforms', {}).get(ident, {})
                for j, name in enumerate(legacy.get('parameters', [])):
                    p = parameter(operator, sequence, index, CHANNELS[sequence][j])
                    expression = 'parent().par.' + name
                    if decl.get('expose'):
                        p.expr = expression
                    elif str(p.mode).endswith('EXPRESSION') and p.expr == expression:
                        value = p.eval(); p.mode = ParMode.CONSTANT; p.val = value
            registry[ident] = {'sequence': sequence, 'index': index, 'name': decl['name']}
            continue
        if record and not record.get('missing'):
            raise RuntimeError('Uniform changed in TD. Refresh sources before applying: ' + decl['name'])
        sequence = source_sequence(decl); seq = getattr(operator.seq,sequence)
        index = seq.numBlocks
        # The untouched initial blank row is safe; edited blank rows survive.
        if index == 1 and not parameter(operator,sequence,0,'name').eval() and all(str(parameter(operator, sequence, 0, c).mode).endswith('CONSTANT') and parameter(operator, sequence, 0, c).isDefault for c in CHANNELS[sequence]): index = 0
        else: seq.numBlocks = index + 1
        parameter(operator, sequence, index, 'name').val = decl['name']
        source = locate(original, original_registry.get(ident))
        if source is None:
            candidates = [r for r in native_rows(original) if r['name'] == decl['name']]
            source = candidates[0] if len(candidates) == 1 and original != operator else None
        default = decl['value']; values = [default] if source_components(decl) == 1 else list(default)
        # Old exposed but unused sources still have their existing COMP value.
        if ident in public:
            master = input_owner or comp
            values = [float((getattr(master.par, name) if getattr(master.par, name, None) is not None else getattr(comp.par, name)).eval()) for name in public[ident]['parameters']]
        elif ident in (preserve or {}):
            value = preserve[ident]; values = [value] if source_components(decl) == 1 else list(value)
        for j, suffix in enumerate(CHANNELS[sequence]):
            p = parameter(operator, sequence, index, suffix)
            p.val = (source['components'][j]['value'] if source and source['components'][j]['value'] is not None else values[j] if j < len(values) else 0)
            if ident in public and j < len(public[ident]['parameters']) and not input_owner:
                p.expr = 'parent().par.' + public[ident]['parameters'][j]
            elif not source and not input_owner and j == 0 and decl.get('initialDriver') in PRESETS:
                p.expr = PRESETS[decl['initialDriver']]
        registry[ident] = {'sequence': sequence, 'index': index, 'name': decl['name']}
    # Removing a graph reference does not remove a declaration or native row.
    # Explicit source deletion is handled by remove(), with a missing reference.
    comp.store(STORE, registry)
    return registry


def sync(runtime):
    comp = runtime.target(); registry = comp.fetch(STORE, None)
    if registry is None: return False
    current = runtime.checked_state()
    declarations, new_registry, issues = reconcile(current['graph']['declarations'], registry, native_rows(runtime.shader_operator(comp)))
    if new_registry != registry: comp.store(STORE, new_registry)
    if issues != comp.fetch('grapeSourceIssues', []): comp.store('grapeSourceIssues', issues)
    if declarations == current['graph']['declarations']: return False
    current = copy.deepcopy(current)
    current['graph']['declarations'] = declarations
    current['revision'] += 1
    current['sourceChanged'] = True
    runtime.write_state(current)
    return True


def snapshot(runtime):
    sync(runtime)
    comp = runtime.target(); current = runtime.state(); operator = runtime.shader_operator(comp)
    links=comp.op('parameter_links')
    if links: links.module.sync(comp)
    registry = comp.fetch(STORE, {})
    rows = []; spec_rows = []; issues = copy.deepcopy(comp.fetch('grapeSourceIssues', []))
    for decl in current['graph']['declarations']:
        if decl['kind'] not in SOURCE_KINDS: continue
        row = locate(operator, registry.get(decl['id']))
        destination = spec_rows if decl['kind']=='spec_constant' else rows
        destination.append({'id': decl['id'], 'kind':decl['kind'], 'name': decl['name'], 'type': decl['type'],
                     **({'constantId':decl['constantId']} if decl['kind']=='spec_constant' else {}),
                     'default': decl['value'], 'missing': comp.fetch(STORE, None) is not None and row is None,
                     'pending': comp.fetch(STORE, None) is None,
                     'sequence': row['sequence'] if row else '',
                     'components': row['components'] if row else [],
                     'nameWritable': row is not None and row['nameMode'] == 'CONSTANT',
                     'expected': edit_token(row) if row else None})
    return {'revision': current['revision'], 'operator': operator.path, 'uniforms': rows, 'specConstants': spec_rows,
            'declarations': current['graph']['declarations'], 'graph': current['graph'], 'sourceChanged': current.get('sourceChanged', False),
            'issues': issues, 'enabled': comp.fetch(STORE, None) is not None}


def write_value(runtime, body):
    seen = snapshot(runtime)
    if body.get('revision') != seen['revision']: raise RuntimeError('Conflict: refresh sources before editing.')
    rows = [r for r in seen['uniforms'] + seen.get('specConstants', []) if r['id'] == body.get('id')]
    index = body.get('component')
    if len(rows) != 1 or type(index) is not int or not 0 <= index < len(rows[0]['components']) or rows[0]['missing']:
        raise RuntimeError('Select an existing native source component.')
    item = rows[0]['components'][index]
    if not item['writable']: raise RuntimeError('This value is controlled by TD; its Expression, Export or Bind was preserved.')
    if body.get('expected') != item: raise RuntimeError('The value changed in TD. Refresh and try again.')
    value = body.get('value')
    if rows[0].get('kind')=='spec_constant':
        runtime.core().literal(value, rows[0]['type'])
        validate_spec_native(rows[0], value)
    else:
        family = runtime.core().TYPE_DESCRIPTORS[rows[0]['type']]['family']
        runtime.core().literal(value, family)
        validate_uniform_component(rows[0], value)
    p = getattr(runtime.shader_operator(runtime.target()).par, item['parameter'])
    comp = runtime.target(); ident = rows[0]['id']; operator = runtime.shader_operator(comp)
    def validate(value):
        row = locate(operator, comp.fetch(STORE, {}).get(ident))
        if row is None or row['components'][index]['parameter'] != p.name:
            raise RuntimeError('The Uniform row moved or its source was removed.')
    target=editable_parameter(p)
    if target is None: raise RuntimeError('The native control changed.')
    original_validate=validate
    def validate(value):
        original_validate(value)
        current=editable_parameter(p)
        if current is None or not current.isSamePar(target): raise RuntimeError('The custom control was detached or replaced.')
        validate_source_value(runtime, comp, ident, value, index)
    runtime.set_parameter_with_undo(target, value, validate=validate)
    return snapshot(runtime)


def source_references(graph, ident):
    """Inventory ownership includes disconnected nodes and every function body."""
    data = list(graph.get('stages', {}).values()) + [f['graph'] for f in graph.get('functions', [])]
    return [node for part in data for node in part.get('nodes', [])
            if node.get('params', {}).get('declarationId') == ident
            or node.get('params', {}).get('inputId') == ident]


def purge_missing_source(runtime, ident):
    """Forget an unused missing source without compiling unrelated graph edits.

    Native deletion is a separate, already-completed operation. If this metadata
    commit fails, restore its recoverable missing record, not destroyed TD Pars.
    """
    comp = runtime.target(); before = copy.deepcopy(runtime.state())
    graph = before['graph']
    decl = next((d for d in graph['declarations'] if d['id'] == ident and d['kind'] in SOURCE_KINDS), None)
    if not decl or not decl.get('sourceMissing'):
        raise RuntimeError('Select a missing Uniform source to remove from Inputs.')
    if source_references(graph, ident):
        raise RuntimeError('This Uniform still has graph references. Remove or reassign them before removing the missing source.')
    registry_before = copy.deepcopy(comp.fetch(STORE, {}))
    issues_before = copy.deepcopy(comp.fetch('grapeSourceIssues', []))
    registry = copy.deepcopy(registry_before); registry.pop(ident, None)
    after = copy.deepcopy(before)
    after['graph']['declarations'] = [d for d in after['graph']['declarations'] if d['id'] != ident]
    after['revision'] += 1; after['sourceChanged'] = True
    # Validate serialization before writing any inventory metadata.
    json.dumps(after, allow_nan=False)
    try:
        comp.store(STORE, registry)
        comp.store('grapeSourceIssues', [issue for issue in issues_before if issue.get('id') != ident])
        runtime.write_state(after)
    except Exception as exc:
        comp.store(STORE, registry_before)
        comp.store('grapeSourceIssues', issues_before)
        runtime.write_state(before)
        raise RuntimeError('Could not remove the missing Uniform from Inputs. Its missing record was retained; refresh and retry.') from exc


def edit(runtime, body):
    seen = snapshot(runtime)
    if not seen['enabled']: raise RuntimeError('Apply this Shader once to enable native Uniform sources.')
    if body.get('revision') != seen['revision']: raise RuntimeError('Conflict: refresh sources before editing.')
    action = body.get('action'); comp = runtime.target(); operator = runtime.shader_operator(comp)
    graph = copy.deepcopy(runtime.state()['graph'])
    decl = next((d for d in graph['declarations'] if d['id'] == body.get('id') and d['kind'] in SOURCE_KINDS), None)
    if action in ('create', 'restore'):
        if action == 'create':
            name = body.get('name'); ty = body.get('type'); kind = body.get('kind', 'uniform')
            if not valid_name(name) or name in {d['name'] for d in graph['declarations']} or any(r['name'] == name for r in native_rows(operator)):
                raise RuntimeError('Use a unique GLSL Uniform name.')
            if kind not in SOURCE_KINDS or ty not in (SPEC_TYPES if kind=='spec_constant' else TYPES): raise RuntimeError('Unsupported native source type.')
            decl = {'id': kind + '_' + uuid.uuid4().hex, 'kind': kind, 'name': name, 'type': ty,
                    'value': runtime.core().filled_value(ty)}
            if kind=='spec_constant':decl.update(constantId=next_constant_id(graph['declarations']), nativeSequence='const')
            if body.get('sequence'):
                if body['sequence'] not in (('const',) if kind=='spec_constant' else ('vec','color')):raise RuntimeError('Unsupported native source page.')
                decl['nativeSequence']=body['sequence']
            if body.get('preset'):
                if kind!='uniform' or body['preset'] not in PRESETS or ty!='float':raise RuntimeError('Unsupported time preset.')
                decl['initialDriver']=body['preset']
            graph['declarations'].append(decl)
        elif not decl or not decl.get('sourceMissing'):
            raise RuntimeError('Select a missing Uniform to restore.')
        else: decl.pop('sourceMissing', None)
        result = runtime.deploy(graph, seen['revision'])
        if not result.get('ok'): raise RuntimeError('Review the Shader version before changing sources.')
        return snapshot(runtime)
    if not decl: raise RuntimeError('Select an existing Uniform source.')
    row = locate(operator, comp.fetch(STORE, {}).get(decl['id']))
    if action == 'remove' and row is None:
        if body.get('expected') is not None: raise RuntimeError('The Uniform changed in TD. Refresh and try again.')
        purge_missing_source(runtime, decl['id'])
        return snapshot(runtime)
    if row is None: raise RuntimeError('This Uniform source is missing.')
    if action == 'driver':
        if decl['kind']=='spec_constant':raise RuntimeError('Spec Constants are intended for infrequent integer mode changes; edit native drivers in TD.')
        index=body.get('component');expression=body.get('expression')
        if type(index) is not int or not 0<=index<4 or not isinstance(expression,str) or len(expression)>4096:
            raise RuntimeError('Select a component and enter a Python expression up to 4096 characters.')
        item=row['components'][index]
        if not item['modeWritable'] or body.get('expected')!=item['modeExpected']:
            raise RuntimeError('The driver changed or is owned by Bind / Export. Refresh or use native Parameters.')
        p=getattr(operator.par,item['parameter']);before=(p.mode,p.val,p.expr)
        try:
            if expression.strip():p.expr=expression
            else:
                value=p.eval();runtime.core().number(value);p.mode=ParMode.CONSTANT;p.val=value
            runtime.core().number(p.eval())
            validate_uniform_component(decl, p.eval())
        except Exception:
            p.val=before[1];p.expr=before[2];p.mode=before[0]
            raise RuntimeError('Expression must evaluate to a finite numeric value; the previous driver was restored.')
        return snapshot(runtime)
    if body.get('expected') != edit_token(row): raise RuntimeError('The Uniform changed in TD. Refresh and try again.')
    if action == 'rename':
        name = body.get('name')
        if not valid_name(name) or any(d['name'] == name and d['id'] != decl['id'] for d in graph['declarations']) or any(r['name'] == name and (r['sequence'], r['index']) != (row['sequence'], row['index']) for r in native_rows(operator)):
            raise RuntimeError('Use a unique GLSL Uniform name.')
        if row['nameMode'] != 'CONSTANT': raise RuntimeError('The native Uniform name is controlled by TD.')
        parameter(operator, row['sequence'], row['index'], 'name').val = name
        registry = copy.deepcopy(comp.fetch(STORE)); registry[decl['id']]['name'] = name
        comp.store(STORE, registry)
    elif action == 'remove':
        registry = copy.deepcopy(comp.fetch(STORE)); registry[decl['id']]['missing'] = True
        sequence = getattr(operator.seq, row['sequence'])
        if sequence.numBlocks == 1:
            # Native vector sequences retain one slot; deleting the last block
            # is a no-op in TD. Clear its name to remove the actual Uniform.
            name_parameter = parameter(operator, row['sequence'], row['index'], 'name')
            name_parameter.mode = ParMode.CONSTANT
            name_parameter.val = ''
        else: sequence.destroyBlock(row['index'])
        comp.store(STORE, registry)
        # First reconcile the native removal into a recoverable missing record.
        # Metadata purge can then fail/retry without pretending TD row identity
        # or its Expression/Export/Bind state was restored.
        removed = snapshot(runtime)
        if not source_references(removed['graph'], decl['id']):
            purge_missing_source(runtime, decl['id'])
            return snapshot(runtime)
        return removed
    else: raise RuntimeError('Unknown source operation.')
    return snapshot(runtime)
