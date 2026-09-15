"""Read-only import inspection and explicit, reviewable repair proposals.

This module never writes a DAT, touches TD operators, or modifies the input.
The caller must obtain acceptance before using a returned candidate.
"""
import copy
import json
import math


def inspect_document(document, core, expected_target):
    report = {'status': 'blocked', 'repairs': [], 'issues': [], 'candidate': None}

    def issue(code, message, **context):
        report['issues'].append(dict(code=code, message=message, **context))

    try:
        size = len(json.dumps(document, ensure_ascii=False, allow_nan=False).encode('utf-8'))
    except (TypeError, ValueError, RecursionError):
        issue('document', 'The document must contain finite JSON values.')
        return report
    if size > 512000:
        issue('size', 'Graph exceeds 512 KB.')
        return report
    if not isinstance(document, dict):
        issue('document', 'A Graph document must be a JSON object.')
        return report
    version = document.get('schemaVersion')
    if type(version) is not int or version != core.VERSION:
        report['status'] = 'newer' if type(version) is int and version > core.VERSION else 'blocked'
        issue('version', 'Unsupported schema version; the original document is unchanged.')
        return report
    try:
        kind = core.graph_target(document)
        if kind != expected_target:
            issue('target', 'Import a graph for the same Shader target.')
            return report
        if not isinstance(document.get('stages'), dict) or set(document['stages']) != set(core.graph_stages(document)):
            issue('stages', 'Shader stages do not match its target.')
            return report
        candidate = copy.deepcopy(document)
        # The editor requires a declaration list even when the graph uses none.
        if 'declarations' not in candidate:
            candidate['declarations'] = []
            report['repairs'].append({'code': 'declarations', 'path': 'declarations'})
        if not isinstance(candidate['declarations'], list):
            issue('document', 'Declarations must be a list.')
            return report
        functions = core._functions(candidate)
        graphs = [(name, data, None) for name, data in candidate['stages'].items()]
        graphs += [('Function/' + f['id'], f['graph'], f) for f in functions.values()]
        for label, data, function in graphs:
            if not isinstance(data, dict) or not isinstance(data.get('nodes'), list) or not isinstance(data.get('edges'), list):
                issue('document', 'Invalid graph data.', path=label)
                return report
            if len(data['nodes']) > 256 or len(data['edges']) > 1024:
                issue('size', 'Graph is too large.', path=label)
                return report
            identities = set()
            ports = {}
            for index, node in enumerate(data['nodes']):
                if not isinstance(node, dict) or not isinstance(node.get('id'), str) or not core.ID.fullmatch(node['id']):
                    issue('identity', 'Invalid node identity.', path=label)
                    return report
                ident = node['id']
                if ident in identities:
                    # Choosing which duplicate owns existing edges would guess intent.
                    issue('duplicate', 'Duplicate node ID; connections are ambiguous.', path=label, node=ident)
                    return report
                identities.add(ident)
                position = node.get('ui')
                if not isinstance(position, dict) or any(type(position.get(k)) not in (int, float) or not math.isfinite(position[k]) for k in ('x', 'y')):
                    node['ui'] = {'x': 48 + (index % 4) * 240, 'y': 96 + (index // 4) * 216}
                    report['repairs'].append({'code': 'position', 'path': label, 'node': ident})
                key = node.get('definitionUuid')
                if key == core.CALL:
                    ref = functions.get(node.get('params', {}).get('functionId')) if isinstance(node.get('params'), dict) else None
                    if ref:
                        ports[ident] = ({p['id'] for p in ref['inputs']}, {p['id'] for p in ref['outputs']})
                elif key == core.FUNCTION_INPUT and function:
                    ports[ident] = (set(), {p['id'] for p in function['inputs']})
                elif key == core.FUNCTION_OUTPUT and function:
                    ports[ident] = ({p['id'] for p in function['outputs']}, set())
                elif key in core.BY_UUID and key != 'sgrape.internal.relay' and core.inspect_definition_reference(node)['status'] in ('exact', 'compatible_history'):
                    definition = core.BY_UUID[key]
                    templates = core.definition_ports(definition, node.get('params', {}))
                    ports[ident] = (set(templates['inputs']), set(templates['outputs']))
            kept = []
            for index, edge in enumerate(data['edges']):
                well_formed = isinstance(edge, dict) and all(isinstance(edge.get(k), list) and len(edge[k]) == 2 and all(isinstance(x, str) for x in edge[k]) for k in ('from', 'to'))
                if not well_formed:
                    kept.append(edge)
                    continue
                missing = False
                for side, direction in (('from', 1), ('to', 0)):
                    ident, port = edge[side]
                    # Unknown definitions retain every edge as evidence.
                    missing |= ident not in identities or (ident in ports and port not in ports[ident][direction])
                if missing and (not function or function['scope'] == 'local'):
                    report['repairs'].append({'code': 'edge', 'path': label, 'index': index, 'edge': copy.deepcopy(edge)})
                else:
                    kept.append(edge)
            data['edges'] = kept
        # Full compiler validation includes unused Functions, cycles and port types.
        core.compile_graph(candidate)
        report.update(status='repairable' if report['repairs'] else 'valid', candidate=candidate,
                      definitionReview=core.inspect_graph_definitions(candidate))
        if 'archive' in candidate:
            issue('archive', 'Embedded archive is not supported by this version. It is retained as data and is not executed.')
        return report
    except core.GraphError as exc:
        issue('compile', str(exc), node=exc.node, functionId=getattr(exc, 'functionId', None))
    except (TypeError, ValueError, KeyError, AttributeError, IndexError, RecursionError):
        issue('document', 'Invalid Graph structure; the original document is unchanged.')
    return report


def inspect_saved_state(raw, core, expected_target):
    """Check saved DAT text without repairing, normalizing or deploying it."""
    report = {'status': 'blocked', 'state': None, 'issues': []}
    def blocked(message):
        report['issues'].append({'code': 'saved-state', 'message': message})
        return report
    if not isinstance(raw, str):
        return blocked('The saved state DAT is missing.')
    if len(raw.encode('utf-8')) > 1024 * 1024:
        return blocked('Saved state exceeds the 1 MB inspection limit.')
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate JSON key')
            result[key] = value
        return result
    def constant(value):
        raise ValueError('Non-finite JSON value')
    try:
        current = json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)
        if not isinstance(current, dict):
            return blocked('Saved state must be a JSON object.')
        revision = current.get('revision')
        if type(revision) is not int or not 0 <= revision <= 9007199254740991:
            return blocked('Saved state needs a non-negative, safe integer revision.')
        # Also rejects overflowed 1e999 and malformed non-JSON values in extras.
        json.dumps(current, allow_nan=False)
        inspected = inspect_document(current.get('graph'), core, expected_target)
        if inspected['status'] != 'valid':
            report['issues'] = inspected['issues']
            if inspected.get('repairs'):
                report['issues'].append({'code': 'saved-state', 'message': 'The saved graph needs repair. No suggested repair has been applied.'})
            return report
        report.update(status='valid', state=current)
        return report
    except (ValueError, TypeError, RecursionError, UnicodeError):
        return blocked('Saved state contains invalid or ambiguous JSON. Its original text was preserved.')


def catalog_snapshot(core):
    """Portable version evidence, never executable archive content."""
    contract = core.catalog_contract()
    result = {'schemaVersion': 1, 'catalogHash': contract['hash'],
              'emitterAbiVersion': contract['emitterAbiVersion'],
              'targetShellVersion': contract['targetShellVersion'],
              'definitions': {d['definitionUuid']: {
                  'revisionHash': d['revisionHash'],
                  'signature': core._definition_signature(d),
                  'emitter': copy.deepcopy(core._EMITTERS[d['definitionUuid']])}
                  for d in sorted(core.CATALOG.values(), key=lambda d: d['definitionUuid'])}}
    result['hash'] = core.digest(result)
    return result


def stamp_catalog(graph, core):
    result = copy.deepcopy(graph)
    result['catalogSnapshot'] = catalog_snapshot(core)
    return result


def _snapshot_valid(snapshot, core):
    if not isinstance(snapshot, dict) or snapshot.get('schemaVersion') != 1:
        return False
    try:
        if core.digest({k: v for k, v in snapshot.items() if k != 'hash'}) != snapshot.get('hash'):
            return False
        if not isinstance(snapshot.get('definitions'), dict):
            return False
        for row in snapshot['definitions'].values():
            if not isinstance(row, dict) or not isinstance(row.get('signature'), dict) or not isinstance(row.get('emitter'), dict):
                return False
        return all(type(snapshot.get(k)) is int for k in ('emitterAbiVersion', 'targetShellVersion'))
    except (TypeError, ValueError, RecursionError):
        return False


def inspect_upgrade(graph, core, expected_target, baseline=None, require_baseline=True):
    """Propose a version change without TD writes or guessed edge repairs.

    A legacy local manifest can prove the *current* catalog hash. Otherwise a
    missing/incomplete baseline is shown as uncertainty requiring acceptance.
    Snapshot hashes check integrity only, not authorship or executable trust.
    """
    report = {'required': False, 'blocked': False, 'changes': [], 'issues': [],
              'localizedFunctions': [], 'candidate': None}
    current = catalog_snapshot(core)
    snapshot = baseline if baseline is not None else (graph.get('catalogSnapshot') if isinstance(graph, dict) else None)
    valid_snapshot = _snapshot_valid(snapshot, core)
    same_legacy = isinstance(snapshot, dict) and snapshot == {'catalogHash': current['catalogHash']}

    def change(code, **context):
        report['required'] = True
        report['changes'].append(dict(code=code, **context))

    if require_baseline and not valid_snapshot and not same_legacy:
        change('unknownBaseline')
    if valid_snapshot:
        for key in ('emitterAbiVersion', 'targetShellVersion'):
            if snapshot[key] != current[key]:
                change(key, old=snapshot[key], new=current[key])

    try:
        # Validate bounded JSON before inspecting structure; no repair is accepted.
        if not isinstance(graph, dict) or len(json.dumps(graph, allow_nan=False).encode('utf-8')) > 512000:
            raise ValueError('Invalid or oversized Graph')
        if core.graph_target(graph) != expected_target:
            raise ValueError('Import a graph for the same Shader target.')
        functions = core._functions(graph)
        references = core.inspect_graph_definitions(graph)['entries']
        candidate = copy.deepcopy(graph)
        affected = set()
        if expected_target == 'top' and graph.get('topSourceVersion') != 1:
            candidate, changed_functions = core.normalize_top_sources(candidate)
            affected.update(changed_functions)
            change('topSources', old=0, new=1)
        for ref in references:
            if ref['status'] == 'function':
                continue
            context = {k: copy.deepcopy(ref[k]) for k in ('node', 'stage', 'functionId', 'definitionUuid', 'requestedRevision')}
            context['currentRevision'] = ref.get('currentRevision')
            if ref['status'] == 'unresolved_definition':
                change('missingDefinition', **context)
                report['blocked'] = True
                continue
            new = current['definitions'][ref['definitionUuid']]
            old = snapshot['definitions'].get(ref['definitionUuid']) if valid_snapshot else None
            reasons = []
            if ref['status'] in ('unversioned', 'unresolved_revision'):
                reasons.append('unknownRevision')
            if valid_snapshot and old is None:
                reasons.append('unknownRevision')
            if old and (old['signature'] != new['signature'] or old['emitter'] != new['emitter']):
                reasons.append('behavior')
            if reasons:
                change('node', reasons=reasons, old=copy.deepcopy(old), new=copy.deepcopy(new), **context)
                affected.add(ref['functionId'])
                data = candidate['stages'][ref['stage']] if ref['stage'] else next(f['graph'] for f in candidate['functions'] if f['id'] == ref['functionId'])
                node = next(n for n in data['nodes'] if n['id'] == ref['node'])
                node['revisionHash'] = core.BY_UUID[node['definitionUuid']]['revisionHash']

        # A changed source and its read-only callers become Shader-local copies.
        # Old full definitions stay in the TD upgrade backup, not in the active
        # Function list where a removed old port would make the candidate invalid.
        affected = {ident for ident in affected if ident in functions and functions[ident]['scope'] != 'local'}
        again = True
        while again:
            again = False
            for ident, fn in functions.items():
                if fn['scope'] == 'local' or ident in affected:
                    continue
                if any(n.get('definitionUuid') == core.CALL and n.get('params', {}).get('functionId') in affected for n in fn['graph']['nodes']):
                    affected.add(ident)
                    again = True
        occupied = set(functions)
        mapping = {}
        for ident in sorted(affected):
            index = 0
            while True:
                local_id = 'up_' + core.digest([ident, graph, index])[:24]
                if local_id not in occupied:
                    break
                index += 1
            occupied.add(local_id)
            mapping[ident] = local_id
        for fn in candidate.get('functions', []):
            ident = fn['id']
            if ident in mapping:
                report['localizedFunctions'].append({'id': ident, 'name': fn['name'], 'localId': mapping[ident], 'scope': fn['scope']})
                fn['id'] = mapping[ident]
                fn['scope'] = 'local'
                fn['origin'] = fn.pop('source', fn.get('origin', {}))
            for node in fn['graph']['nodes']:
                if node.get('definitionUuid') == core.CALL and node.get('params', {}).get('functionId') in mapping:
                    node['params']['functionId'] = mapping[node['params']['functionId']]
        for data in candidate['stages'].values():
            for node in data['nodes']:
                if node.get('definitionUuid') == core.CALL and node.get('params', {}).get('functionId') in mapping:
                    node['params']['functionId'] = mapping[node['params']['functionId']]
        inspected = inspect_document(candidate, core, expected_target)
        if inspected['status'] != 'valid':
            report['blocked'] = True
            report['issues'] = inspected['issues'] + ([{'code': 'repair', 'message': 'This version cannot safely migrate the graph. Original connections were preserved.'}] if inspected.get('repairs') else [])
        if not report['blocked']:
            report['candidate'] = stamp_catalog(candidate, core)
        return report
    except (core.GraphError, TypeError, ValueError, KeyError, AttributeError, IndexError, RecursionError) as exc:
        report['blocked'] = True
        report['issues'].append({'code': 'structure', 'message': str(exc) or 'The original graph was preserved.'})
        return report


def saved_envelope(raw):
    """Strict read for a version review even if today's compiler rejects a node."""
    if not isinstance(raw, str) or len(raw.encode('utf-8')) > 1024 * 1024:
        raise ValueError('Saved state is missing or exceeds 1 MB.')
    def pairs(items):
        obj = {}
        for key, value in items:
            if key in obj:
                raise ValueError('Duplicate JSON key')
            obj[key] = value
        return obj
    def constant(_):
        raise ValueError('Non-finite JSON value')
    result = json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)
    if not isinstance(result, dict) or type(result.get('revision')) is not int or not 0 <= result['revision'] <= 9007199254740991:
        raise ValueError('Invalid saved state revision')
    json.dumps(result, allow_nan=False)
    if not isinstance(result.get('graph'), dict):
        raise ValueError('Missing saved Graph')
    return result
