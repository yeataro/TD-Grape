"""Native numeric source ownership, separate from graph and custom controls.

The GLSL OP owns current values and their modes. Graph declarations retain
portable defaults/type metadata. No stored snapshot is a competing value store.
"""
import ast
import copy
import hashlib
import json
import math
import re
import uuid
from contextlib import nullcontext

if 'me' in globals():
    _source_catalog = me.parent().op('sgrape_source_catalog').module
else:
    import sgrape_source_catalog as _source_catalog

STORE = 'grapeNativeUniformsV1'
# Native vector rows contain up to four scalar components. Their GLSL family is
# declared by the graph, independent of the native page's numeric widgets.
TYPES = {name: count for scalar, prefix in (('float','vec'), ('double','dvec'), ('int','ivec'), ('uint','uvec'), ('bool','bvec'))
         for count in range(1,5) for name in (scalar if count == 1 else prefix+str(count),)}
MATRIX_SHAPES = {prefix+str(c)+(('x'+str(r)) if c != r else ''): (c,r)
                 for prefix in ('mat','dmat') for c in range(2,5) for r in range(2,5)}
TYPES.update({ty:c*r for ty,(c,r) in MATRIX_SHAPES.items()})
SPEC_TYPES = ('int', 'uint', 'bool', 'float')
SOURCE_KINDS = ('uniform', 'spec_constant', 'pop_buffer')
PRESETS = {key: entry['initialize']['expression'] for key, entry in _source_catalog.PRESETS.items()}
CHANNELS = {'vec': ('valuex', 'valuey', 'valuez', 'valuew'),
            'color': ('rgbr', 'rgbg', 'rgbb', 'alpha'), 'const': ('value',), 'matrix': ('value',)}
ARRAY_ELEMENT_TYPES = ('float', 'vec2', 'vec3', 'vec4')
MAX_NATIVE_ARRAY_LENGTH = 2147483647  # GLSL length representation, not a GPU capacity claim.
# Configuration channels are deliberately separate from editable numeric values.
SEQUENCE_CHANNELS = dict(CHANNELS, array=('type', 'chop', 'arraytype'), buffer=('pop','attrclass','attr'))


class SourceError(RuntimeError):
    phase = 'source'


def source_issue(row, message, ident=None):
    """Keep rejected native rows visible without inventing a graph declaration."""
    binding = row.get('arrayBinding', {})
    return dict(message=message, name=row['name'], sequence=row['sequence'], index=row['index'],
                status='invalid', **({'id':ident} if ident else {}),
                **({'type':'samplerBuffer' if binding.get('arrayType')=='texturebuffer' else binding.get('elementType','')+'[N]'} if binding else {}))


def array_shape(ty):
    match = re.fullmatch(r'(float|vec[234])\[([1-9][0-9]*|sg_len_[A-Za-z][A-Za-z0-9_]{0,63})\]', ty) if isinstance(ty,str) else None
    if not match:return None
    if match[2].startswith('sg_len_'):return (match[1],match[2])
    return (match[1],int(match[2])) if int(match[2])<=MAX_NATIVE_ARRAY_LENGTH else None


def source_sequence(declaration):
    return 'buffer' if declaration.get('kind')=='pop_buffer' else 'const' if declaration.get('kind') == 'spec_constant' else 'array' if array_shape(declaration.get('type')) else 'matrix' if declaration.get('type') in MATRIX_SHAPES else declaration.get('nativeSequence', 'vec')


def native_array_length(declaration, declarations):
    shape=array_shape(declaration.get('type'))
    if not shape:return None
    length=shape[1]
    if isinstance(length,int):return length
    source=declarations.get(length[7:])
    if not source or source.get('kind') not in ('constant','spec_constant') or source.get('type') not in ('int','uint'):
        raise SourceError('Uniform Array length source is missing or is not an integer constant.')
    if source['kind']=='spec_constant':
        # TD 2025.32820 probe: length specializes, but the CHOP values arrive as
        # zero; MAT also fails linking identical declarations across stages.
        # Do not silently replace the symbol with its default value.
        raise SourceError('TouchDesigner CHOP Uniform Arrays do not correctly upload specialization-sized arrays on the verified host build. Use a literal or Graph Constant length; graph-local specialization-sized arrays remain supported.')
    value=source.get('value')
    if type(value) is not int or value<1:raise SourceError('Uniform Array length constant must be positive.')
    return value


def source_components(declaration):
    if declaration.get('type')=='samplerBuffer' or declaration.get('kind')=='pop_buffer':return 0
    shape = array_shape(declaration.get('type'))
    if shape: return TYPES[shape[0]] * shape[1] if isinstance(shape[1],int) else 0
    return 1 if declaration.get('kind') == 'spec_constant' else TYPES[declaration['type']]


def next_constant_id(declarations):
    used = {d.get('constantId') for d in declarations if d.get('kind') == 'spec_constant'}
    return next(i for i in range(len(used) + 1) if i not in used)


def source_family(ty):
    if ty not in TYPES: raise SourceError('Unsupported native source type.')
    return 'double' if ty.startswith('d') else 'bool' if ty == 'bool' or ty.startswith('bvec') else 'uint' if ty == 'uint' or ty.startswith('uvec') else 'int' if ty == 'int' or ty.startswith('ivec') else 'float'


def validate_uniform_component(declaration, value, role='value'):
    """Validate an editor write's declared type; native transport is TD-owned."""
    family = source_family(declaration['type'])
    name = declaration.get('name', 'Uniform')
    if family == 'bool':
        if not isinstance(value, (bool, int, float)) or value not in (0, 1):
            raise SourceError('Uniform '+name+': native boolean '+role+' must be 0 or 1.')
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise SourceError('Uniform '+name+': native '+role+' must be a finite number.')
    if family in ('float','double'): return
    low, high = (-2147483648, 2147483647) if family == 'int' else (0, 4294967295)
    if int(value) != value or not low <= value <= high:
        raise SourceError('Uniform '+name+': native '+role+' must be a whole '+family+' value from '+str(low)+' to '+str(high)+'.')


def validate_uniform_native(declaration, value, role='value'):
    if declaration.get('type')=='samplerBuffer':
        if value is not None:raise SourceError('Texture Buffer values belong to the native CHOP.')
        return
    shape = array_shape(declaration.get('type'))
    if shape:
        if value is None: return  # The CHOP owns data; no sampled JSON default.
        if not isinstance(value, (list, tuple)) or len(value) != shape[1]:
            raise SourceError('Uniform '+declaration.get('name', '')+': invalid native array length.')
        for element in value: validate_uniform_native(dict(declaration, type=shape[0]), element, role)
        return
    values = [value] if source_components(declaration) == 1 else value
    if not isinstance(values, (list, tuple)) or len(values) != source_components(declaration):
        raise SourceError('Uniform '+declaration.get('name', '')+': invalid native component count.')
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
        raise SourceError('The native source or its component is no longer available.')
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
        raise SourceError('Spec Constant '+name+': native '+role+' must be a whole '+ty+' value.')
    minimum, maximum = (-2147483648, 2147483647) if ty == 'int' else (0, 4294967295)
    if not minimum <= value <= maximum:
        raise SourceError('Spec Constant '+name+': '+role+' must be a whole '+ty+' value from '+str(minimum)+' to '+str(maximum)+'.')


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


def component(p, resolve=editable_parameter):
    try:
        value = float(p.eval())
        if not math.isfinite(value): raise ValueError('Non-finite value')
    except Exception:
        value = None
    mode = str(p.mode).split('.')[-1].upper()
    edit=resolve(p)
    expression=p.expr if mode=='EXPRESSION' else ''
    return {'parameter': p.name, 'value': value, 'mode': mode,
            'expression': expression, 'binding':p.bindExpr if mode=='BIND' else '',
            'modeWritable': mode in ('CONSTANT','EXPRESSION') and bool(p.enable) and not p.readOnly,
            'modeExpected': token({'parameter':p.name,'mode':mode,'expression':expression,
                                   'bind':p.bindExpr if mode=='BIND' else ''}),
            'writable': value is not None and edit is not None and bool(edit.enable) and not edit.readOnly,
            **({'control':edit.name} if edit is not None and not edit.isSamePar(p) else {})}


def matrix_literal(expression):
    """Read our literal carrier without evaluating arbitrary Python or an OP."""
    if not isinstance(expression, str) or len(expression) > 4096: return None
    try:
        node = ast.parse(expression, mode='eval').body
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name) and node.func.value.id == 'tdu'
                and node.func.attr == 'Matrix' and len(node.args) == 1 and not node.keywords): return None
        values = ast.literal_eval(node.args[0])
        if not isinstance(values, (list,tuple)) or len(values) != 16: return None
        if any(type(v) not in (int,float) or not math.isfinite(v) for v in values): return None
        return list(values)
    except (SyntaxError, ValueError, TypeError, OverflowError, RecursionError): return None


def matrix_expression(declaration, values, carrier=None):
    """TD's carrier is 4x4; GLSL reads its top-left columns/rows."""
    validate_uniform_native(declaration, values)
    columns, rows = MATRIX_SHAPES[declaration['type']]
    result = list(carrier) if carrier is not None else [float(c == r) for c in range(4) for r in range(4)]
    for c in range(columns):
        for r in range(rows): result[c*4+r] = values[c*rows+r]
    return 'tdu.Matrix('+repr(result)+')'


def matrix_control_expression(declaration, names):
    columns, rows = MATRIX_SHAPES[declaration['type']]
    values = ['1.0' if c == r else '0.0' for c in range(4) for r in range(4)]
    for c in range(columns):
        for r in range(rows): values[c*4+r] = 'parent().par.'+names[c*rows+r]+'.eval()'
    return 'tdu.Matrix(['+', '.join(values)+'])'


def matrix_binding(p):
    # Configuration only: snapshots must not evaluate animated matrix drivers,
    # cook DATs/CHOPs, or turn their sampled values into history conflicts.
    mode = str(p.mode).split('.')[-1].upper()
    state = {'parameter':p.name, 'mode':mode, 'value':str(p.val),
             'expression':p.expr if mode == 'EXPRESSION' else '',
             'binding':p.bindExpr if mode == 'BIND' else ''}
    return {**state, 'expected':token(state),
            'writable':mode in ('CONSTANT','EXPRESSION') and bool(p.enable) and not p.readOnly,
            'literalValues':matrix_literal(state['expression']) if mode == 'EXPRESSION' else None}


def matrix_components(binding, ty='mat4'):
    values = binding['literalValues']
    if values is None: return []
    columns, rows = MATRIX_SHAPES[ty]
    return [{'parameter':binding['parameter'], 'value':values[c*4+r], 'mode':binding['mode'],
             'writable':False, 'column':c, 'row':r} for c in range(columns) for r in range(rows)]


def matrix_driver_value(p):
    """Candidate-cook forwarding only, never used by source polling/history.

    Matrix values are OP parameters in TD: eval() may turn a valid tdu.Matrix
    expression into None. Preserve the expression's Python result and resolve
    string paths in the original native OP's context before forwarding them.
    """
    if not str(p.mode).endswith('EXPRESSION'): return p.eval()
    value = p.evalExpression()
    return p.owner.parent().op(value) if isinstance(value,str) else value


def array_binding(operator, index):
    """Read configuration only: never sample or evaluate an animated CHOP."""
    p = parameter(operator, 'array', index, 'chop')
    mode = str(p.mode).split('.')[-1].upper()
    state = {'parameter': p.name, 'mode': mode, 'value': str(p.val),
             'expression': p.expr if mode == 'EXPRESSION' else '',
             'binding': p.bindExpr if mode == 'BIND' else '',
             'elementType': str(parameter(operator, 'array', index, 'type').eval()),
             'arrayType': str(parameter(operator, 'array', index, 'arraytype').eval())}
    return dict(state, expected=token(state),
                writable=mode in ('CONSTANT', 'EXPRESSION') and bool(p.enable) and not p.readOnly)


def array_driver_value(p):
    """Resolve paths in the original OP context during candidate validation."""
    value = p.evalExpression() if str(p.mode).endswith('EXPRESSION') else p.eval()
    return p.owner.parent().op(value) if isinstance(value, str) else value


def array_source_length(operator, index):
    """Used once on import/apply, never to poll individual CHOP samples."""
    source = array_driver_value(parameter(operator, 'array', index, 'chop'))
    if source is None or getattr(source, 'family', None) != 'CHOP':
        raise SourceError('Choose an existing CHOP for the Uniform Array source.')
    length = int(source.numSamples)
    if length < 1: raise SourceError('The Uniform Array source has no samples.')
    return length


def buffer_binding(operator, index):
    fields={}
    for suffix in SEQUENCE_CHANNELS['buffer']:
        p=parameter(operator,'buffer',index,suffix);mode=str(p.mode).split('.')[-1].upper()
        fields[suffix]=dict(value=str(p.val),mode=mode,expression=p.expr if mode=='EXPRESSION' else '',
                            writable=mode=='CONSTANT' and bool(p.enable) and not p.readOnly)
    return dict(fields=fields,expected=token(fields),writable=all(f['writable'] for f in fields.values()))


def buffer_attribute(operator,index):
    # Definition metadata only. Never call vals(), points(), or numPoints().
    source=array_driver_value(parameter(operator,'buffer',index,'pop'))
    if source is None or getattr(source,'family',None)!='POP':raise SourceError('Choose an existing POP for this Buffer.')
    group=str(parameter(operator,'buffer',index,'attrclass').eval())
    prop={'point':'pointAttributes','vertex':'vertAttributes','primitive':'primAttributes'}.get(group)
    if not prop:raise SourceError('Choose Point, Vertex or Primitive attributes.')
    name=str(parameter(operator,'buffer',index,'attr').eval())
    attribute=next((a for a in getattr(source,prop) if a.name==name),None)
    if attribute is None:raise SourceError('POP Attribute not found: '+name)
    cols=int(getattr(attribute,'numMatCols',0));rows=int(getattr(attribute,'numMatRows',0));size=int(attribute.size)
    family='float' if attribute.type is float else 'int' if attribute.type is int else None
    if not family or not 1<=size<=16:raise SourceError('Unsupported POP attribute shape: '+name)
    if cols:
        if family!='float' or cols not in (2,3,4) or rows not in (2,3,4):raise SourceError('Unsupported POP matrix shape: '+name)
        ty='mat'+str(cols)+('x'+str(rows) if cols!=rows else '')
    else:
        if size>4:raise SourceError('POP attributes with more than four components require a supported matrix shape.')
        ty=family if size==1 else ('vec' if family=='float' else 'ivec')+str(size)
    return dict(type=ty,components=size,columns=cols,rows=rows,arraySize=int(attribute.arraySize) if attribute.isArray else 1,
                popSource=source.path,attributeClass=group,attribute=name,
                precisionKnown=False)  # TD Python folds float/double and int/uint.


def buffer_issues(operator, rows):
    issues=[]
    for row in rows:
        if row and row['sequence']=='buffer':
            try:buffer_attribute(operator,row['index'])
            except SourceError as exc:issues.append(source_issue(row,str(exc)))
    return issues


def validate_buffer_sources(operator, rows):
    # TD validates configured POP attributes even when GLSL does not use them.
    # Do not silently clear native rows to make an unrelated graph compile.
    issues=buffer_issues(operator,rows)
    if issues:raise SourceError('TD Buffer '+issues[0]['name']+': '+issues[0]['message'])


def native_rows(operator):
    rows = []
    for sequence, channels in SEQUENCE_CHANNELS.items():
        seq = getattr(operator.seq, sequence, None)
        if seq is None: continue
        for index in range(seq.numBlocks):
            p = parameter(operator, sequence, index, 'name')
            name = str(p.eval())
            if not name: continue
            if sequence == 'buffer':
                rows.append(dict(sequence=sequence,index=index,name=name,nameMode=str(p.mode).split('.')[-1].upper(),components=[],bufferBinding=buffer_binding(operator,index)))
                continue
            if sequence == 'array':
                binding = array_binding(operator, index)
                rows.append({'sequence': sequence, 'index': index, 'name': name,
                             'nameMode': str(p.mode).split('.')[-1].upper(),
                             'components': [], 'arrayBinding': binding})
                continue
            binding = matrix_binding(parameter(operator, sequence, index, 'value')) if sequence == 'matrix' else None
            rows.append({'sequence': sequence, 'index': index, 'name': name,
                         'nameMode': str(p.mode).split('.')[-1].upper(),
                         'components': matrix_components(binding) if binding else [component(parameter(operator, sequence, index, c)) for c in channels],
                         **({'matrixBinding':binding} if binding else {})})
    return rows


def reconcile(declarations, registry, rows, operator=None):
    """Match within one OP, never by global names or transient Par identities.

    Exact unique names survive row movement. A single rename in an otherwise
    unchanged sequence can retain its ID. Ambiguous edits stay missing.
    """
    declarations = copy.deepcopy(declarations)
    identities = {d['id'] for d in declarations}
    registry = {ident: copy.deepcopy(record) for ident, record in registry.items() if ident in identities}
    names = {}; slots = {}
    for i, row in enumerate(rows):
        names[row['name']] = names.get(row['name'], 0) + 1
        slots.setdefault((row['sequence'], row['name']), []).append(i)
    matches = {}; taken = set(); issues = []
    for ident, record in registry.items():
        found = slots.get((record['sequence'], record['name']), [])
        if len(found) == 1:
            matches[ident] = found[0]; taken.add(found[0])
    for sequence in SEQUENCE_CHANNELS:
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
        duplicate = row is not None and names[row['name']] != 1
        array_invalid = row is not None and row['sequence'] == 'array' and (row['arrayBinding']['arrayType'] != ('texturebuffer' if decl['type']=='samplerBuffer' else 'uniformarray') or (decl['type']!='samplerBuffer' and (not array_shape(decl['type']) or row['arrayBinding']['elementType'] != array_shape(decl['type'])[0])))
        if row is None or duplicate or not valid_name(row['name']) or row['name'] in occupied or array_invalid:
            decl['sourceMissing'] = True; record['missing'] = True
            message = ('Native Array storage or element type differs from '+decl['type']+': ' if array_invalid else 'Native source is missing or ambiguous: ') + decl['name']
            issues.append(source_issue(row,message,ident) if row else {'id':ident,'name':decl['name'],'status':'missing','message':message})
        else:
            decl['name'] = row['name']; decl.pop('sourceMissing', None)
            if row['sequence'] in ('color','matrix','array'):decl['nativeSequence']=row['sequence']
            if decl['type']=='samplerBuffer':decl['elementType']=row['arrayBinding']['elementType']
            record.update(name=row['name'], index=row['index']); record.pop('missing', None)
    known = {d['name'] for d in declarations}
    for i, row in enumerate(rows):
        if i in taken: continue
        name = row['name']
        if not valid_name(name) or name in known or names[name] != 1:
            issues.append(source_issue(row,'Review the native Uniform name: ' + name)); continue
        kind = 'spec_constant' if row['sequence'] == 'const' else 'uniform'
        ident = kind + '_' + uuid.uuid4().hex
        if row['sequence']=='buffer':
            try:metadata=buffer_attribute(operator,row['index'])
            except SourceError as exc:
                issues.append(source_issue(row,str(exc)));continue
            ident='pop_buffer_'+uuid.uuid4().hex
            declarations.append(dict(id=ident,kind='pop_buffer',name=name,nativeSequence='buffer',value=None,**{k:metadata[k] for k in ('type','popSource','attributeClass','attribute')}))
            registry[ident]={k:row[k] for k in ('sequence','index','name')};known.add(name);continue
        if row['sequence'] == 'array':
            binding = row['arrayBinding']
            if binding['arrayType']=='texturebuffer' and binding['elementType'] in ARRAY_ELEMENT_TYPES:
                declarations.append(dict(id=ident,kind='uniform',name=name,type='samplerBuffer',nativeSequence='array',elementType=binding['elementType'],value=None))
                registry[ident]={k:row[k] for k in ('sequence','index','name')}
                known.add(name)
                continue
            if binding['arrayType'] != 'uniformarray' or binding['elementType'] not in ARRAY_ELEMENT_TYPES:
                issues.append(dict(source_issue(row,'Unsupported native Array format: ' + name),status='unsupported'))
                continue
            try:
                if operator is None: raise SourceError('Refresh native sources to inspect the CHOP length.')
                length = array_source_length(operator, row['index'])
                if length > MAX_NATIVE_ARRAY_LENGTH:
                    raise SourceError('The CHOP length exceeds the GLSL signed 32-bit range.')
            except RuntimeError as exc:
                issues.append(source_issue(row,name + ': ' + str(exc))); continue
            element = binding['elementType']
            declarations.append({'id': ident, 'kind': 'uniform', 'name': name,
                                 'type': element+'['+str(length)+']', 'nativeSequence': 'array',
                                 'value': None})
            registry[ident] = {k: row[k] for k in ('sequence', 'index', 'name')}
            known.add(name)
            continue
        ty = 'mat4' if row['sequence'] == 'matrix' else 'vec4' if row['sequence'] == 'color' else 'float'
        values = [c['value'] if c['value'] is not None and abs(c['value']) <= 1e20 else 0.0 for c in row['components']]
        if kind == 'spec_constant':
            # TD has a numeric value but no declaration type on this page.
            # New imports use float; an existing graph's chosen type is kept.
            ty = 'float'; values = [float(values[0])]
        elif ty == 'mat4':
            values = row['matrixBinding']['literalValues'] or [float(c == r) for c in range(4) for r in range(4)]
        declarations.append({'id': ident, 'kind': kind, 'name': name, 'type': ty,
                             'value': values if ty in ('vec4','mat4') else values[0],
                             **({'constantId': next_constant_id(declarations), 'nativeSequence':'const'} if kind == 'spec_constant' else {}),
                             **({'nativeSequence':row['sequence']} if row['sequence'] in ('color','matrix') else {})})
        registry[ident] = {k: row[k] for k in ('sequence', 'index', 'name')}
        known.add(name)
    return declarations, registry, issues


def native_index(operator):
    """One synchronous snapshot; duplicate names remain unresolvable.

    Callers must rebuild this index after native writes. Never retain it across
    requests: TD expressions, controls and sequence rows can change externally.
    """
    result = {}
    for row in native_rows(operator):
        key = (row['sequence'], row['name'])
        result[key] = None if key in result else row
    return result


def locate(operator, record, index=None):
    if not record or record.get('missing'): return None
    rows = native_index(operator) if index is None else index
    return rows.get((record['sequence'], record['name']))


def capture_configuration(runtime, comp):
    operator = runtime.shader_operator(comp)
    return {'registry': copy.deepcopy(comp.fetch(STORE, None)),
            'matrixParameters': [(parameter(operator,'matrix',i,'value'),
                                  {key:getattr(parameter(operator,'matrix',i,'value'),key) for key in ('val','mode','expr','bindExpr')})
                                 for i in range(getattr(getattr(operator.seq,'matrix',None),'numBlocks',0))],
            'arrayParameters': [(parameter(operator,'array',i,suffix),
                                 {key:getattr(parameter(operator,'array',i,suffix),key) for key in ('val','mode','expr','bindExpr')})
                                for i in range(getattr(getattr(operator.seq,'array',None),'numBlocks',0))
                                for suffix in SEQUENCE_CHANNELS['array']],
            'bufferParameters': [(parameter(operator,'buffer',i,suffix),
                                  {key:getattr(parameter(operator,'buffer',i,suffix),key) for key in ('val','mode','expr','bindExpr')})
                                 for i in range(getattr(getattr(operator.seq,'buffer',None),'numBlocks',0))
                                 for suffix in SEQUENCE_CHANNELS['buffer']],
            'sequences': {name: [(parameter(operator, name, i, 'name'), parameter(operator, name, i, 'name').val)
                                for i in range(getattr(operator.seq, name).numBlocks)]
                          for name in SEQUENCE_CHANNELS if getattr(operator.seq, name, None) is not None}}


def restore_configuration(runtime, comp, before):
    operator = runtime.shader_operator(comp)
    for name, pars in before['sequences'].items():
        getattr(operator.seq, name).numBlocks = len(pars)
        for p, value in pars:
            if p.val != value: p.val = value
    for p, state in before.get('matrixParameters',[]) + before.get('arrayParameters',[]) + before.get('bufferParameters',[]):
        for key in ('val','expr','bindExpr','mode'):
            if getattr(p,key) != state[key]:setattr(p,key,state[key])
    if before['registry'] is None: comp.unstore(STORE)
    else: comp.store(STORE, before['registry'])


def configure(runtime, comp, graph, public, preserve=None, input_owner=None, used=None):
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
    declaration_map={d['id']:d for d in graph['declarations']}
    array_lengths={d['id']:native_array_length(d,declaration_map) for d in declarations if array_shape(d.get('type'))}
    original_index=native_index(original)
    validate_buffer_sources(original,original_index.values())
    # Existing unused native data must not block an unrelated valid Shader.
    # New sources still validate their data when first configured.
    validate_data={d['id'] for d in declarations if used is None or d['id'] in used or
                   locate(original,original_registry.get(d['id']),original_index) is None}
    # Validate candidate types before creating/renaming native rows.
    # Precision and numerical conversion remain the host's responsibility.
    for decl in declarations:
        if decl['kind']=='pop_buffer' and not decl.get('sourceMissing'):
            source=locate(original,original_registry.get(decl['id']),original_index)
            if source and source['sequence']!='buffer':raise SourceError('Native Buffer source kind differs: '+decl['name'])
        if decl['kind'] == 'uniform' and not decl.get('sourceMissing'):
            validate_uniform_native(decl, decl['value'], 'default')
            source = locate(original, original_registry.get(decl['id']),original_index)
            if source is None:
                matches = [r for r in native_rows(original) if r['name'] == decl['name'] and r['sequence'] != 'const']
                source = matches[0] if len(matches) == 1 else None
            if decl['type']=='samplerBuffer':
                if source and (source['sequence']!='array' or source['arrayBinding']['arrayType']!='texturebuffer'):raise SourceError('Native Texture Buffer storage differs from its declaration: '+decl['name'])
                continue
            if array_shape(decl['type']):
                if source:
                    if source['sequence'] != 'array' or source['arrayBinding']['arrayType'] != 'uniformarray':
                        raise SourceError('Create a new Uniform Array when changing native source pages: '+decl['name'])
                    if source['arrayBinding']['elementType'] != array_shape(decl['type'])[0]:
                        raise SourceError('The CHOP Uniform Array element type differs from its graph declaration: '+decl['name'])
                    if decl['id'] in validate_data and array_source_length(original, source['index']) < array_lengths[decl['id']]:
                        raise SourceError('The CHOP has fewer samples than the declared Uniform Array length: '+decl['name'])
                continue
            if source and source['sequence'] == 'array':
                raise SourceError('Create a new Uniform when changing native source pages: '+decl['name'])
            if source and source['sequence']=='buffer':raise SourceError('Native Buffer source kind differs: '+decl['name'])
            if source and (source['sequence'] == 'matrix') != (decl['type'] in MATRIX_SHAPES):
                raise SourceError('Create a new Uniform when changing between Matrix and Vector sources: '+decl['name'])
            if source and source['sequence'] != 'matrix' and decl['id'] in validate_data:
                for component in source['components'][:source_components(decl)]:
                    validate_uniform_component(decl, component['value'])
            elif not source and decl['id'] in (preserve or {}): validate_uniform_native(decl, preserve[decl['id']])
        if decl['kind'] != 'spec_constant' or decl.get('sourceMissing'): continue
        validate_spec_native(decl, decl['value'], 'default')
        source = locate(original, original_registry.get(decl['id']),original_index)
        if source is None:
            matches = [r for r in native_rows(original) if r['name'] == decl['name'] and r['sequence'] == 'const']
            source = matches[0] if len(matches) == 1 else None
        if source and decl['id'] in validate_data: validate_spec_native(decl, source['components'][0]['value'])
        elif not source and decl['id'] in (preserve or {}): validate_spec_native(decl, preserve[decl['id']])
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
            if len(candidates) > 1: raise SourceError('Duplicate native Uniform: ' + decl['name'])
            existing = candidates[0] if candidates else None
        if existing:
            sequence = existing['sequence']; index = existing['index']
            if (sequence=='const') != (decl['kind']=='spec_constant'):
                raise SourceError('Native source kind differs from its declaration: ' + decl['name'])
            if (sequence == 'array') != bool(array_shape(decl['type']) or decl['type']=='samplerBuffer'):
                raise SourceError('Create a new Uniform when changing native source pages: '+decl['name'])
            if (sequence=='matrix') != (decl['kind']=='uniform' and decl['type'] in MATRIX_SHAPES):
                raise SourceError('Create a new Uniform when changing between Matrix and Vector sources: '+decl['name'])
            if existing['name'] != decl['name']:
                if existing['nameMode'] != 'CONSTANT': raise SourceError('The Uniform name is controlled by TD.')
                parameter(operator, sequence, index, 'name').val = decl['name']
            if (sequence=='buffer') != (decl['kind']=='pop_buffer'):raise SourceError('Native Buffer source kind differs: '+decl['name'])
            if sequence in ('array','buffer'):
                registry[ident] = {'sequence': sequence, 'index': index, 'name': decl['name']}
                continue
            previous = old_graph.get(ident, {})
            if decl['kind']=='uniform' and ident not in comp.fetch('grapeCustomMigratedV1',[]) and bool(previous.get('expose')) != bool(decl.get('expose')):
                legacy = comp.fetch('sgrapePublicUniforms', {}).get(ident, {})
                if sequence == 'matrix':
                    names = legacy.get('parameters', [])
                    p = parameter(operator, sequence, index, 'value')
                    generated = matrix_control_expression(decl,names) if len(names) == source_components(decl) else None
                    if generated and decl.get('expose'):p.expr = generated
                    elif generated and str(p.mode).endswith('EXPRESSION') and p.expr == generated:
                        p.expr = matrix_expression(decl,[float(getattr(comp.par,name).eval()) for name in names])
                    registry[ident] = {'sequence':sequence, 'index':index, 'name':decl['name']}
                    continue
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
            raise SourceError('Uniform changed in TD. Refresh sources before applying: ' + decl['name'])
        sequence = source_sequence(decl); seq = getattr(operator.seq,sequence)
        index = seq.numBlocks
        # The untouched initial blank row is safe; edited blank rows survive.
        if index == 1 and not parameter(operator,sequence,0,'name').eval() and all(str(parameter(operator, sequence, 0, c).mode).endswith('CONSTANT') and parameter(operator, sequence, 0, c).isDefault for c in SEQUENCE_CHANNELS[sequence]): index = 0
        else: seq.numBlocks = index + 1
        parameter(operator, sequence, index, 'name').val = decl['name']
        source = locate(original, original_registry.get(ident))
        if source is None:
            candidates = [r for r in native_rows(original) if r['name'] == decl['name']]
            source = candidates[0] if len(candidates) == 1 and original != operator else None
        if sequence=='buffer':
            for suffix,field in (('attrclass','attributeClass'),('attr','attribute')):
                parameter(operator,sequence,index,suffix).val=parameter(original,sequence,source['index'],suffix).eval() if source else decl.get(field,'point' if suffix=='attrclass' else '')
            p=parameter(operator,sequence,index,'pop')
            if source and original!=operator:
                helper=runtime._owner.op('sources').path
                p.expr='op('+repr(helper)+').module.array_driver_value(op('+repr(original.path)+').par.buffer'+str(source['index'])+'pop)'
            else:
                path=decl.get('popSource','');resolved=input_owner.op(path) if input_owner and path else None
                p.val=resolved.path if resolved else path
            if ident in validate_data:buffer_attribute(operator,index)
            registry[ident]=dict(sequence=sequence,index=index,name=decl['name']);continue
        if sequence == 'array':
            parameter(operator, sequence, index, 'type').val = (source['arrayBinding']['elementType'] if source else decl.get('elementType','float')) if decl['type']=='samplerBuffer' else array_shape(decl['type'])[0]
            parameter(operator, sequence, index, 'arraytype').val = 'texturebuffer' if decl['type']=='samplerBuffer' else 'uniformarray'
            p = parameter(operator, sequence, index, 'chop')
            if source and original != operator:
                helper = runtime._owner.op('sources').path
                p.expr = 'op('+repr(helper)+').module.array_driver_value(op('+repr(original.path)+').par.array'+str(source['index'])+'chop)'
            elif input_owner and decl.get('arraySource'):
                resolved = input_owner.op(decl['arraySource'])
                if resolved is None: raise SourceError('Choose an existing CHOP for the Uniform Array source.')
                p.val = resolved.path
            else:
                p.val = decl.get('arraySource', '')
            if decl['type']!='samplerBuffer' and ident in validate_data and array_source_length(operator, index) < array_lengths[decl['id']]:
                raise SourceError('The CHOP has fewer samples than the declared Uniform Array length: '+decl['name'])
            registry[ident] = {'sequence': sequence, 'index': index, 'name': decl['name']}
            continue
        default = decl['value']; values = [default] if source_components(decl) == 1 else list(default)
        if sequence == 'matrix':
            p = parameter(operator, sequence, index, 'value')
            if ident in public and not input_owner:
                p.expr = matrix_control_expression(decl,public[ident]['parameters'])
            elif source and original != operator:
                # Candidate cooks use the existing native parameter in its own
                # context, preserving relative OP paths and Python drivers.
                helper = runtime._owner.op('sources').path
                p.expr = 'op('+repr(helper)+').module.matrix_driver_value(op('+repr(original.path)+').par.matrix'+str(source['index'])+'value)'
            else:
                p.expr = matrix_expression(decl, (preserve or {}).get(ident, values))
            registry[ident] = {'sequence':sequence, 'index':index, 'name':decl['name']}
            continue
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
    operator = runtime.shader_operator(comp)
    declarations, new_registry, issues = reconcile(current['graph']['declarations'], registry, native_rows(operator), operator)
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
    registry = comp.fetch(STORE, {}); index = native_index(operator)
    rows = []; spec_rows = []; issues = copy.deepcopy(comp.fetch('grapeSourceIssues', []))
    by_slot={(record['sequence'],record['name']):ident for ident,record in registry.items()}
    for issue in buffer_issues(operator,index.values()):
        ident=by_slot.get((issue['sequence'],issue['name']))
        if ident:issue['id']=ident
        if not any(existing.get('sequence')==issue['sequence'] and existing.get('index')==issue['index'] for existing in issues):issues.append(issue)
    for decl in current['graph']['declarations']:
        if decl['kind'] not in SOURCE_KINDS: continue
        row = locate(operator, registry.get(decl['id']), index)
        destination = spec_rows if decl['kind']=='spec_constant' else rows
        destination.append({'id': decl['id'], 'kind':decl['kind'], 'name': decl['name'], 'type': decl['type'],
                     **({'constantId':decl['constantId']} if decl['kind']=='spec_constant' else {}),
                     'default': decl['value'], 'missing': comp.fetch(STORE, None) is not None and row is None,
                     'pending': comp.fetch(STORE, None) is None,
                     'sequence': row['sequence'] if row else '',
                     'components': (matrix_components(row['matrixBinding'],decl['type']) if row.get('matrixBinding') else row['components']) if row else [],
                     **({'matrixBinding':row['matrixBinding']} if row and row.get('matrixBinding') else {}),
                     **({'arrayBinding':dict(row['arrayBinding'], **({'length':array_shape(decl['type'])[1]} if array_shape(decl['type']) else {}))} if row and row.get('arrayBinding') else {}),
                     **({'bufferBinding':row['bufferBinding']} if row and row.get('bufferBinding') else {}),
                     'nameWritable': row is not None and row['nameMode'] == 'CONSTANT',
                     'expected': edit_token(row) if row else None})
    return {'revision': current['revision'], 'operator': operator.path, 'uniforms': rows, 'specConstants': spec_rows,
            'declarations': current['graph']['declarations'], 'graph': current['graph'], 'sourceChanged': current.get('sourceChanged', False),
            'issues': issues, 'enabled': comp.fetch(STORE, None) is not None}


def write_value(runtime, body):
    seen = snapshot(runtime)
    if body.get('revision') != seen['revision']: raise SourceError('Conflict: refresh sources before editing.')
    rows = [r for r in seen['uniforms'] + seen.get('specConstants', []) if r['id'] == body.get('id')]
    index = body.get('component')
    if len(rows) != 1 or type(index) is not int or not 0 <= index < len(rows[0]['components']) or rows[0]['missing']:
        raise SourceError('Select an existing native source component.')
    item = rows[0]['components'][index]
    if not item['writable']: raise SourceError('This value is controlled by TD; its Expression, Export or Bind was preserved.')
    if body.get('expected') != item: raise SourceError('The value changed in TD. Refresh and try again.')
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
            raise SourceError('The Uniform row moved or its source was removed.')
    target=editable_parameter(p)
    if target is None: raise SourceError('The native control changed.')
    original_validate=validate
    def validate(value):
        original_validate(value)
        current=editable_parameter(p)
        if current is None or not current.isSamePar(target): raise SourceError('The custom control was detached or replaced.')
        validate_source_value(runtime, comp, ident, value, index)
    runtime.set_parameter_with_undo(target, value, validate=validate)
    return snapshot(runtime)


def source_references(graph, ident):
    """Inventory ownership includes disconnected nodes and every function body."""
    data = list(graph.get('stages', {}).values()) + [f['graph'] for f in graph.get('functions', [])]
    def uses_length(item):
        if isinstance(item,list):return any(uses_length(v) for v in item)
        if not isinstance(item,dict):return False
        token='sg_len_'+ident
        return any((v==token or '['+token+']' in v) if k in ('type','elementType','fromType','toType','fixedType','length') and isinstance(v,str)
                   else uses_length(v) if k not in ('code','ui','source','origin') else False for k,v in item.items())
    return [node for part in data for node in part.get('nodes', [])
            if node.get('params', {}).get('declarationId') == ident
            or node.get('params', {}).get('inputId') == ident or uses_length(node)] + [item for item in graph.get('declarations',[]) if uses_length(item)] + [f for f in graph.get('functions',[]) if uses_length(f.get('inputs',[])) or uses_length(f.get('outputs',[]))]


def purge_missing_source(runtime, ident):
    """Forget an unused missing source without compiling unrelated graph edits.

    Native deletion is a separate, already-completed operation. If this metadata
    commit fails, restore its recoverable missing record, not destroyed TD Pars.
    """
    comp = runtime.target(); before = copy.deepcopy(runtime.state())
    graph = before['graph']
    decl = next((d for d in graph['declarations'] if d['id'] == ident and d['kind'] in SOURCE_KINDS), None)
    if not decl or not decl.get('sourceMissing'):
        raise SourceError('Select a missing Uniform source to remove from Inputs.')
    if source_references(graph, ident):
        raise SourceError('This Uniform still has graph references. Remove or reassign them before removing the missing source.')
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
        raise SourceError('Could not remove the missing Uniform from Inputs. Its missing record was retained; refresh and retry.') from exc


def edit(runtime, body):
    seen = snapshot(runtime)
    if not seen['enabled']: raise SourceError('Apply this Shader once to enable native Uniform sources.')
    if body.get('revision') != seen['revision']: raise SourceError('Conflict: refresh sources before editing.')
    action = body.get('action'); comp = runtime.target(); operator = runtime.shader_operator(comp)
    graph = copy.deepcopy(runtime.state()['graph'])
    decl = next((d for d in graph['declarations'] if d['id'] == body.get('id') and d['kind'] in SOURCE_KINDS), None)
    if action in ('create', 'restore'):
        if action == 'create':
            name = body.get('name'); ty = body.get('type'); kind = body.get('kind', 'uniform')
            if not valid_name(name) or name in {d['name'] for d in graph['declarations']} or any(r['name'] == name for r in native_rows(operator)):
                raise SourceError('Use a unique GLSL Uniform name.')
            if kind not in SOURCE_KINDS or not (ty in SPEC_TYPES if kind=='spec_constant' else ty in TYPES or array_shape(ty) or ty=='samplerBuffer'): raise SourceError('Unsupported native source type.')
            decl = {'id': kind + '_' + uuid.uuid4().hex, 'kind': kind, 'name': name, 'type': ty,
                    'value': None if kind=='pop_buffer' or array_shape(ty) or ty=='samplerBuffer' else runtime.core().filled_value(ty)}
            if kind=='pop_buffer':
                if ty not in TYPES or numeric_family(ty)=='bool':raise SourceError('Choose a numeric Buffer output type.')
                decl.update(nativeSequence='buffer',popSource=body.get('popSource',''),attributeClass=body.get('attributeClass','point'),attribute=body.get('attribute',''))
            elif kind=='spec_constant':decl.update(constantId=next_constant_id(graph['declarations']), nativeSequence='const')
            elif array_shape(ty) or ty=='samplerBuffer':
                if ty=='samplerBuffer':
                    element=body.get('elementType','float')
                    if element not in ARRAY_ELEMENT_TYPES:raise SourceError('Choose a floating CHOP element type.')
                    decl['elementType']=element
                path = body.get('arraySource', '')
                if not isinstance(path, str) or len(path)>4096 or any(ord(c)<32 for c in path): raise SourceError('Choose a CHOP path for the Uniform Array.')
                decl.update(nativeSequence='array', arraySource=path)
            elif ty in MATRIX_SHAPES:decl['nativeSequence']='matrix'
            if body.get('sequence'):
                if body['sequence'] not in (('buffer',) if kind=='pop_buffer' else ('const',) if kind=='spec_constant' else ('array',) if array_shape(ty) or ty=='samplerBuffer' else ('matrix',) if ty in MATRIX_SHAPES else ('vec','color')):raise SourceError('Unsupported native source page.')
                decl['nativeSequence']=body['sequence']
            if body.get('preset'):
                if kind!='uniform' or body['preset'] not in PRESETS or ty!='float':raise SourceError('Unsupported time preset.')
                decl['initialDriver']=body['preset']
            graph['declarations'].append(decl)
        elif not decl or not decl.get('sourceMissing'):
            raise SourceError('Select a missing Uniform to restore.')
        else: decl.pop('sourceMissing', None)
        result = runtime.deploy(graph, seen['revision'])
        if not result.get('ok'): raise SourceError('Review the Shader version before changing sources.')
        return snapshot(runtime)
    if not decl: raise SourceError('Select an existing Uniform source.')
    row = locate(operator, comp.fetch(STORE, {}).get(decl['id']))
    if action == 'remove' and row is None:
        if body.get('expected') is not None: raise SourceError('The Uniform changed in TD. Refresh and try again.')
        purge_missing_source(runtime, decl['id'])
        return snapshot(runtime)
    if row is None: raise SourceError('This Uniform source is missing.')
    if action=='bufferBinding':
        binding=row.get('bufferBinding')
        if not binding or not binding['writable'] or body.get('expected')!=binding['expected']:raise SourceError('Buffer configuration changed or is controlled in TD. Refresh and retry.')
        fields=body.get('fields',{})
        if set(fields)!=set(SEQUENCE_CHANNELS['buffer']):raise SourceError('Provide POP path, attribute class and attribute name.')
        for suffix,value in fields.items():
            if not isinstance(value,str) or len(value)>4096 or any(ord(ch)<32 for ch in value):raise SourceError('Invalid Buffer field.')
        if fields['attrclass'] not in ('point','vertex','primitive'):raise SourceError('Invalid attribute class.')
        pars={key:parameter(operator,'buffer',row['index'],key) for key in fields}
        if any(not str(p.mode).endswith('CONSTANT') for p in pars.values()):raise SourceError('Edit Expression or Bind / Export configuration in TD.')
        before={key:p.val for key,p in pars.items()}
        try:
            for key,p in pars.items():p.val=fields[key]
            buffer_attribute(operator,row['index'])
        except Exception:
            for key,p in pars.items():p.val=before[key]
            raise
        return snapshot(runtime)
    if action == 'arrayBinding':
        if row['sequence'] != 'array' or not (array_shape(decl['type']) or decl['type']=='samplerBuffer'): raise SourceError('Select a CHOP Uniform Array source.')
        binding = row['arrayBinding']
        if not binding['writable'] or body.get('expected') != binding['expected']:
            raise SourceError('The array source changed or is owned by Bind / Export. Refresh or use native Parameters.')
        mode = body.get('mode'); value = body.get('expression') if mode == 'EXPRESSION' else body.get('value')
        if mode not in ('CONSTANT', 'EXPRESSION') or not isinstance(value, str) or len(value)>4096:
            raise SourceError('Enter a CHOP path or Python expression up to 4096 characters.')
        if mode == 'CONSTANT' and any(ord(c)<32 for c in value): raise SourceError('Choose a CHOP path without control characters.')
        p = parameter(operator, 'array', row['index'], 'chop')
        before = {key:getattr(p,key) for key in ('val','mode','expr','bindExpr')}
        try:
            if mode == 'EXPRESSION': p.expr = value
            else: p.mode = ParMode.CONSTANT; p.val = value
            if decl['type']!='samplerBuffer' and array_source_length(operator,row['index']) < native_array_length(decl,{d['id']:d for d in runtime.state()['graph']['declarations']}):
                raise SourceError('The CHOP has fewer samples than the declared Uniform Array length.')
        except Exception:
            for key in ('val','expr','bindExpr','mode'): setattr(p,key,before[key])
            raise
        return snapshot(runtime)
    if action in ('matrixBinding','matrixValue'):
        if row['sequence'] != 'matrix' or decl['type'] not in MATRIX_SHAPES:
            raise SourceError('Select a Matrix Uniform source.')
        binding = row['matrixBinding']
        if not binding['writable'] or body.get('expected') != binding['expected']:
            raise SourceError('The matrix source changed or is owned by Bind / Export. Refresh or use native Parameters.')
        p = parameter(operator, 'matrix', row['index'], 'value')
        if action == 'matrixValue':
            if binding['literalValues'] is None: raise SourceError('This matrix is driven by TD. Edit its source binding instead.')
            runtime.core().literal(body.get('value'), decl['type'])
            expression = matrix_expression(decl, body['value'], binding['literalValues'])
            p.expr = expression
        else:
            mode = body.get('mode')
            value = body.get('expression') if mode == 'EXPRESSION' else body.get('value')
            if mode not in ('CONSTANT','EXPRESSION') or not isinstance(value,str) or len(value)>4096:
                raise SourceError('Enter a Matrix source path or Python expression up to 4096 characters.')
            # TD owns evaluation and error reporting. Do not sample drivers or
            # impose additional numerical/transport rules on accepted sources.
            if mode == 'EXPRESSION':p.expr = value
            else:p.mode = ParMode.CONSTANT;p.val = value
        return snapshot(runtime)
    if action == 'driver':
        if row['sequence'] in ('matrix','array','buffer'): raise SourceError('Use the source binding to edit this driver.')
        if decl['kind']=='spec_constant':raise SourceError('Spec Constants are intended for infrequent integer mode changes; edit native drivers in TD.')
        index=body.get('component');expression=body.get('expression')
        if type(index) is not int or not 0<=index<4 or not isinstance(expression,str) or len(expression)>4096:
            raise SourceError('Select a component and enter a Python expression up to 4096 characters.')
        item=row['components'][index]
        if not item['modeWritable'] or body.get('expected')!=item['modeExpected']:
            raise SourceError('The driver changed or is owned by Bind / Export. Refresh or use native Parameters.')
        p=getattr(operator.par,item['parameter']);before=(p.mode,p.val,p.expr)
        try:
            if expression.strip():p.expr=expression
            else:
                value=p.eval();runtime.core().number(value);p.mode=ParMode.CONSTANT;p.val=value
            runtime.core().number(p.eval())
            validate_uniform_component(decl, p.eval())
        except Exception:
            p.val=before[1];p.expr=before[2];p.mode=before[0]
            raise SourceError('Expression must evaluate to a finite numeric value; the previous driver was restored.')
        return snapshot(runtime)
    if body.get('expected') != edit_token(row): raise SourceError('The Uniform changed in TD. Refresh and try again.')
    if action == 'rename':
        name = body.get('name')
        if not valid_name(name) or any(d['name'] == name and d['id'] != decl['id'] for d in graph['declarations']) or any(r['name'] == name and (r['sequence'], r['index']) != (row['sequence'], row['index']) for r in native_rows(operator)):
            raise SourceError('Use a unique GLSL Uniform name.')
        if row['nameMode'] != 'CONSTANT': raise SourceError('The native Uniform name is controlled by TD.')
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
    else: raise SourceError('Unknown source operation.')
    return snapshot(runtime)
