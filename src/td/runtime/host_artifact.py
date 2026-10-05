"""Frontend delivery boundary for the new host. Standard library only.

The graph is preserved as a document, not evaluated here. Nodes, port typing,
Subgraph expansion and GLSL generation belong to the frontend. This module
checks delivery identity and the numeric binding data the host may execute.
GPU validation and preserving native Parameter modes belong to the TD adapter.
"""
from copy import deepcopy
from hashlib import sha256
import json
import math
import re

PROTOCOL = 'grape.top.ts.1'
FORMAT = 'grape.host.artifact.1'
WIDTHS = {'float': 1, 'vec2': 2, 'vec3': 3, 'vec4': 4}
IDENTITY = re.compile(r'[A-Za-z][A-Za-z0-9_]{0,63}\Z')
NAME = re.compile(r'[A-Za-z][A-Za-z0-9_]{0,47}\Z')
HASH = re.compile(r'[0-9a-f]{64}\Z')


def require(condition, message):
    if not condition:
        raise ValueError('Frontend delivery: ' + message)


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def _binding(row):
    require(isinstance(row, dict), 'invalid binding')
    require(not set(row) - {'id', 'kind', 'name', 'type', 'value', 'expose',
                           'exposeName', 'nativeSequence'}, 'unsupported binding fields')
    require(row.get('kind') == 'uniform' and row.get('type') in WIDTHS,
            'unsupported binding kind/type')
    require(isinstance(row.get('id'), str) and IDENTITY.fullmatch(row['id'])
            and row['id'] != 'grapeFallbackSampler', 'invalid binding identity')
    require(isinstance(row.get('name'), str) and NAME.fullmatch(row['name'])
            and not row['name'].startswith(('gl_', 'TD', 'sTD', 'uTD', 'sg_')),
            'invalid uniform name')
    require(row.get('nativeSequence', 'vec') in ('vec', 'color'), 'unsupported native sequence')
    require(type(row.get('expose', False)) is bool, 'invalid parameter exposure')
    label = row.get('exposeName', '')
    require(isinstance(label, str) and len(label) <= 80
            and not any(ord(c) < 32 for c in label), 'invalid parameter label')
    width = WIDTHS[row['type']]
    values = [row.get('value')] if width == 1 else row.get('value')
    require(isinstance(values, list) and len(values) == width and all(
        type(v) in (int, float) and math.isfinite(v) and abs(v) <= 1e20 for v in values),
        'invalid uniform default')


def _contents(graph, compiled, catalog_hash):
    require(isinstance(graph, dict) and graph.get('schemaVersion') == 1
            and graph.get('target') == 'top', 'unsupported document target')
    require(isinstance(graph.get('stages'), dict) and set(graph['stages']) == {'pixel'},
            'unsupported stages')
    require(len(encoded(graph)) <= 512000, 'document exceeds 512 KB')
    require(isinstance(catalog_hash, str) and HASH.fullmatch(catalog_hash), 'invalid catalog hash')
    require(isinstance(compiled, dict) and compiled.get('vertex') == ''
            and isinstance(compiled.get('pixel'), str), 'invalid TOP source')
    require(0 < len(compiled['pixel'].encode('utf-8')) <= 512000, 'invalid source size')
    require(len(encoded(compiled)) <= 1024 * 1024, 'artifact exceeds 1 MB')
    declarations = graph.get('declarations')
    require(isinstance(declarations, list), 'invalid declarations')
    by_id, names = {}, set()
    for row in declarations:
        _binding(row)
        require(row['id'] not in by_id and row['name'] not in names, 'duplicate declaration')
        by_id[row['id']] = row
        names.add(row['name'])
    bindings = compiled.get('bindings')
    require(isinstance(bindings, list) and len(bindings) <= len(declarations), 'invalid binding table')
    bound = set()
    for row in bindings:
        _binding(row)
        require(row['id'] not in bound and row['id'] in by_id
                and encoded(row) == encoded(by_id[row['id']]),
                'binding table disagrees with document')
        bound.add(row['id'])
    # Diagnostic data is never evaluated as Python or used to select host OPs.
    require(isinstance(compiled.get('sourceMap'), dict)
            and isinstance(compiled.get('diagnostics'), list), 'invalid diagnostics')


def receive(body, *, target_id, revision, catalog_hash):
    """Return a detached candidate. Calling this does not commit a revision."""
    require(isinstance(body, dict), 'invalid request')
    require(type(body.get('revision')) is int and body['revision'] == revision,
            'revision conflict')
    artifact = body.get('frontendArtifact')
    require(isinstance(artifact, dict), 'frontend artifact required; no Python compiler fallback')
    require(artifact.get('protocol') == PROTOCOL, 'unsupported compiler protocol')
    require(artifact.get('targetId') == target_id, 'target mismatch')
    require(type(artifact.get('baseRevision')) is int and artifact['baseRevision'] == revision,
            'artifact revision conflict')
    require(artifact.get('catalogHash') == catalog_hash, 'catalog changed; reload the editor')
    graph, compiled = body.get('graph'), artifact.get('compiled')
    snapshot = artifact.get('snapshot')
    require(isinstance(snapshot, str) and len(snapshot.encode('utf-8')) <= 512000,
            'invalid document snapshot')
    require(encoded(json.loads(snapshot)) == encoded(graph), 'snapshot mismatch')
    _contents(graph, compiled, catalog_hash)
    return deepcopy({'graph': graph, 'compiled': compiled, 'catalogHash': catalog_hash,
                     'protocol': PROTOCOL, 'targetId': target_id, 'baseRevision': revision})


def saved_state(candidate):
    """Seal only after the TD adapter has accepted and applied the candidate.

    This checksum detects accidental graph/artifact mismatch; it is not a
    signature, authentication mechanism, or proof of GLSL correctness.
    """
    _contents(candidate['graph'], candidate['compiled'], candidate['catalogHash'])
    value = deepcopy({'format': FORMAT, 'targetId': candidate['targetId'],
        'revision': candidate['baseRevision'] + 1, 'graph': candidate['graph'],
        'frontendArtifact': {'protocol': candidate['protocol'],
            'catalogHash': candidate['catalogHash'], 'compiled': candidate['compiled']}})
    value['checksum'] = sha256(encoded(value)).hexdigest()
    return value


def restore(raw, *, target_id):
    """Read saved code as-is, including its producer, with no recompile."""
    require(isinstance(raw, str) and len(raw.encode('utf-8')) <= 2 * 1024 * 1024,
            'invalid saved document size')
    value = json.loads(raw)
    require(isinstance(value, dict) and value.get('format') == FORMAT, 'unknown saved format')
    checksum = value.pop('checksum', None)
    require(checksum == sha256(encoded(value)).hexdigest(), 'saved graph/artifact changed')
    require(value.get('targetId') == target_id, 'saved target mismatch')
    require(type(value.get('revision')) is int and value['revision'] >= 1, 'invalid saved revision')
    artifact = value.get('frontendArtifact')
    require(isinstance(artifact, dict) and artifact.get('protocol') == PROTOCOL,
            'unsupported saved compiler protocol')
    _contents(value.get('graph'), artifact.get('compiled'), artifact.get('catalogHash'))
    value['checksum'] = checksum
    return value
