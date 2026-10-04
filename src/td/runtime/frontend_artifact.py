"""TD adapter for complete frontend results; never emits shader code.

The authenticated editor supplies code. These checks protect the transport and
native binding boundary, not a proof that arbitrary GLSL implements its graph.
GPU candidate validation and parameter ownership remain in the deployer.
"""
import copy
import json
import math
import re
from pathlib import Path

PROTOCOL = 'grape.top.ts.1'
TYPES = {'float': 1, 'vec2': 2, 'vec3': 3, 'vec4': 4}


def capabilities():
    if 'me' in globals():
        raw = me.parent().op('frontend_capabilities').text
    else:
        raw = (Path(__file__).resolve().parents[2] / 'core/frontend_capabilities.json').read_text(encoding='utf-8')
    return json.loads(raw)


def graph_hash(graph, core):
    return core.digest(core.clean_semantic(graph))


def input_hash(graph, core):
    # Keep annotation/viewer nodes and diagnostic inputs that the old semantic
    # hash intentionally omits. Reuse must never swallow an unsupported edit.
    source = copy.deepcopy(graph)
    source.pop('catalogSnapshot', None)
    for stage in [*source.get('stages', {}).values(), *(f['graph'] for f in source.get('functions', []))]:
        for node in stage.get('nodes', []):
            ui = node.get('ui')
            if isinstance(ui, dict):
                for field in ('x', 'y', 'width', 'height'):
                    if type(ui.get(field)) in (int, float): ui.pop(field)
                for field in ('collapsed', 'componentsExpanded'):
                    if type(ui.get(field)) is bool: ui.pop(field)
                columns = ui.get('matrixColumnsExpanded')
                if isinstance(columns, list) and all(v is None or type(v) is bool for v in columns): ui.pop('matrixColumnsExpanded')
                if not ui: node.pop('ui')
    return core.digest(source)


def checked_artifact(graph, artifact, core, *, saved=False):
    """Validate a detached result, retaining its actual producer version.

    An incoming result must use the current catalog. A persisted result already
    belongs to its saved graph and may predate a compiler update; checking that
    snapshot must not silently recompile it or relabel it as a new result.
    All protocol, graph, input, binding and capability checks apply to both.
    """
    def require(condition, message):
        if not condition:
            raise ValueError('Frontend artifact: ' + message)

    require(isinstance(artifact, dict), 'missing result')
    require(len(json.dumps(artifact, allow_nan=False).encode('utf-8')) <= 1024 * 1024, 'result exceeds 1 MB')
    require(artifact.get('protocol') == PROTOCOL, 'unsupported compiler protocol')
    catalog = artifact.get('catalogHash')
    require(isinstance(catalog, str) and re.fullmatch('[0-9a-f]{64}', catalog), 'invalid producer catalog hash')
    if not saved:
        require(catalog == core.catalog_contract()['hash'], 'catalog changed; reload the editor')
    require(artifact.get('graphHash') == graph_hash(graph, core), 'result belongs to another graph snapshot')
    require(artifact.get('inputHash') == input_hash(graph, core), 'compiler input snapshot changed')
    require(graph.get('schemaVersion') == 1 and graph.get('target') == 'top', 'unsupported document target')
    require(set(graph.get('stages', {})) == {'pixel'}, 'unsupported stages')
    require(not any(graph.get(key) for key in ('topInputs', 'typeDefinitions')), 'outside compiler capabilities')
    require(len(json.dumps(graph, allow_nan=False).encode('utf-8')) <= 512000, 'document exceeds 512 KB')
    # Subgraph metadata validation never calls a shader emitter. Authenticated
    # source still follows the same candidate compile and native binding checks.
    functions = core._functions(graph)
    for f in functions.values():
        require('pixel' in f['stages'] and 'top' in f.get('targets', ['top', 'mat']), 'unsupported Subgraph stage/target')
        require(all(p['type'] in capabilities().get('valueTypes', TYPES) for key in ('inputs', 'outputs') for p in f[key]), 'unsupported Subgraph interface')
    scopes = {'': graph['stages']['pixel'], **{key: f['graph'] for key, f in functions.items()}}
    allowed = set(capabilities()['definitions'])
    scope_ids = {}
    for key, data in scopes.items():
        nodes, edges = data['nodes'], data['edges']
        require(len(nodes) <= 256 and len(edges) <= 1024, 'graph is too large')
        ids = {n['id'] for n in nodes}
        require(len(ids) == len(nodes) and all(isinstance(i, str) and core.ID.fullmatch(i) for i in ids), 'invalid node identities')
        require(all(n.get('definitionUuid') in allowed for n in nodes), 'unsupported node definition')
        scope_ids[key] = ids

    def valid_location(row):
        if not isinstance(row, dict) or row.get('stage') != 'pixel': return False
        trail = row.get('trail', [])
        if not isinstance(trail, list) or len(trail) > 64: return False
        scope = ''
        for key in trail:
            if not isinstance(key, str) or key not in functions: return False
            if not any(n.get('definitionUuid') == core.CALL and n.get('params', {}).get('functionId') == key for n in scopes[scope]['nodes']): return False
            scope = key
        return row.get('node') in scope_ids[scope] and row.get('functionId') == (scope or None)

    # Only exact numeric Uniform declarations reach native configure(). No
    # executable driver, source reference, or arbitrary parameter selector.
    declarations = graph['declarations']
    require(isinstance(declarations, list), 'invalid declarations')
    seen_ids, seen_names = set(), set()
    for d in declarations:
        require(isinstance(d, dict) and d.get('kind') == 'uniform' and d.get('type') in TYPES, 'unsupported binding kind/type')
        ident, name = d.get('id'), d.get('name')
        require(isinstance(ident, str) and core.ID.fullmatch(ident) and ident not in seen_ids and ident != 'grapeFallbackSampler', 'invalid binding identity')
        require(isinstance(name, str) and core.NAME.fullmatch(name) and not name.startswith(('gl_', 'TD', 'sTD', 'sg_')) and name not in seen_names, 'invalid binding name')
        seen_ids.add(ident); seen_names.add(name)
        require(d.get('nativeSequence', 'vec') in ('vec', 'color') and 'initialDriver' not in d and not d.get('sourceMissing'), 'unsupported native binding source')
        require(type(d.get('expose', False)) is bool, 'invalid parameter exposure')
        label = d.get('exposeName', '')
        require(isinstance(label, str) and len(label) <= 80 and not any(ord(c) < 32 for c in label), 'invalid parameter label')
        value = d.get('value'); count = TYPES[d['type']]
        values = [value] if count == 1 else value
        require(isinstance(values, list) and len(values) == count and all(type(v) in (int, float) and math.isfinite(v) and abs(v) <= 1e20 for v in values), 'invalid binding default')

    compiled = artifact.get('compiled')
    require(isinstance(compiled, dict) and compiled.get('vertex') == '' and isinstance(compiled.get('pixel'), str), 'invalid TOP source')
    require(0 < len(compiled['pixel'].encode('utf-8')) <= 512000, 'invalid source size')
    bindings = compiled.get('bindings')
    require(isinstance(bindings, list) and len(bindings) <= len(declarations), 'invalid binding table')
    by_id = {d['id']: d for d in declarations}
    require(all(isinstance(b, dict) and b.get('id') in by_id and core.digest(b) == core.digest(by_id[b['id']]) for b in bindings), 'binding table disagrees with document')
    require(len({b['id'] for b in bindings}) == len(bindings), 'duplicate binding')
    maps = compiled.get('sourceMap', {})
    require(isinstance(maps, dict) and set(maps) == {'pixel'} and isinstance(maps['pixel'], list), 'invalid source map')
    require(all(valid_location(row) and type(row.get('line')) is int and 0 < row['line'] <= len(compiled['pixel'].splitlines()) for row in maps['pixel']), 'invalid source location')
    diagnostics = compiled.get('diagnostics')
    require(isinstance(diagnostics, list) and all(valid_location(row) and isinstance(row.get('message'), str) and len(row['message']) <= 1000 for row in diagnostics), 'invalid diagnostics')
    result = {key: copy.deepcopy(compiled[key]) for key in ('vertex', 'pixel', 'bindings', 'sourceMap', 'diagnostics')}
    result.update(hash=artifact['graphHash'], frontendProtocol=PROTOCOL, frontendCatalogHash=artifact['catalogHash'], frontendInputHash=artifact['inputHash'])
    return result


def receive(graph, payload, target_id, revision, core):
    """Bind a transport result to the exact submitted document and TD target."""
    if not isinstance(payload, dict) or payload.get('targetId') != target_id or type(payload.get('baseRevision')) is not int or payload['baseRevision'] != revision:
        raise ValueError('Frontend artifact: target or revision mismatch')
    snapshot = payload.get('snapshot')
    if not isinstance(snapshot, str) or len(snapshot.encode('utf-8')) > 512000 or core.digest(json.loads(snapshot)) != core.digest(graph):
        raise ValueError('Frontend artifact: snapshot mismatch')
    artifact = {key: copy.deepcopy(payload.get(key)) for key in ('protocol', 'catalogHash', 'compiled')}
    artifact['graphHash'] = graph_hash(graph, core)
    artifact['inputHash'] = input_hash(graph, core)
    checked_artifact(graph, artifact, core)
    return artifact


def remember(state, compiled):
    result = dict(state)
    result.pop('frontendArtifact', None)
    if compiled.get('frontendProtocol') == PROTOCOL:
        result['frontendArtifact'] = dict(protocol=PROTOCOL, catalogHash=compiled['frontendCatalogHash'],
            graphHash=compiled['hash'], inputHash=compiled['frontendInputHash'], compiled={key: copy.deepcopy(compiled[key]) for key in ('vertex', 'pixel', 'bindings', 'sourceMap', 'diagnostics')})
    return result
