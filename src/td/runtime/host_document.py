"""Editing document persistence, independent of the last applied shader.

TD may reconcile its native sources into the editing document without running
the frontend compiler. That never changes the separately sealed artifact or
claims that its GLSL was generated from the updated document.
"""
from copy import deepcopy
from hashlib import sha256
import json

if 'me' in globals():
    artifact = me.parent().op('host_artifact').module
else:
    import host_artifact as artifact

FORMAT = 'grape.host.document.1'
MAX_BYTES = 3 * 1024 * 1024


def validate_graph(graph):
    """Check the storage envelope, not node semantics or shader validity.

    Native parameter operations validate every value they will write separately.
    A disconnected/unsupported node is still a preservable editing document.
    """
    require = artifact.require
    require(isinstance(graph, dict) and type(graph.get('schemaVersion')) is int
            and graph['schemaVersion'] == 1 and graph.get('target') == 'top',
            'unsupported editing document')
    require(len(artifact.encoded(graph)) <= 512000, 'editing document exceeds 512 KB')
    require(isinstance(graph.get('stages'), dict) and set(graph['stages']) == {'pixel'},
            'unsupported editing stages')
    declarations = graph.get('declarations')
    functions = graph.get('functions', [])
    require(isinstance(declarations, list) and isinstance(functions, list),
            'invalid editing document collections')
    def identities(rows, label):
        ids = set()
        for row in rows:
            require(isinstance(row, dict) and isinstance(row.get('id'), str)
                    and bool(row['id']) and row['id'] not in ids, 'invalid ' + label + ' identity')
            ids.add(row['id'])
    identities(declarations, 'declaration')
    identities(functions, 'subgraph')
    for part in [graph['stages']['pixel']] + [f.get('graph') for f in functions]:
        require(isinstance(part, dict) and isinstance(part.get('nodes'), list)
                and isinstance(part.get('edges'), list), 'invalid editing network')
        identities(part['nodes'], 'node')
        identities(part['edges'], 'edge')


def create(candidate):
    applied = artifact.saved_state(candidate)
    validate_graph(applied['graph'])
    return {'format': FORMAT, 'targetId': applied['targetId'],
            'revision': applied['revision'], 'graph': deepcopy(applied['graph']),
            'applied': applied, 'sourceChanged': False}


def update(current, graph, *, source_changed=True):
    """Advance the editing revision; leave the actual applied artifact intact."""
    validate_graph(graph)
    result = deepcopy(current)
    result.update(graph=deepcopy(graph), revision=current['revision'] + 1,
                  sourceChanged=bool(source_changed))
    return result


def accept(current, candidate):
    artifact.require(candidate['targetId'] == current['targetId']
                     and candidate['baseRevision'] == current['revision'], 'document revision conflict')
    return create(candidate)


def _validate(value, target_id):
    artifact.require(isinstance(value, dict) and value.get('format') == FORMAT,
                     'unknown editing document format')
    artifact.require(value.get('targetId') == target_id, 'editing target mismatch')
    artifact.require(type(value.get('revision')) is int and value['revision'] >= 1,
                     'invalid editing revision')
    artifact.require(type(value.get('sourceChanged')) is bool, 'invalid source change flag')
    validate_graph(value.get('graph'))
    applied = artifact.restore(artifact.encoded(value.get('applied')).decode('utf-8'), target_id=target_id)
    artifact.require(applied['revision'] <= value['revision'], 'applied revision is newer than document')


def serialize(value):
    _validate(value, value.get('targetId'))
    result = deepcopy(value)
    result.pop('checksum', None)
    result['checksum'] = sha256(artifact.encoded(result)).hexdigest()
    encoded = artifact.encoded(result)
    artifact.require(len(encoded) <= MAX_BYTES, 'saved editing document exceeds 3 MB')
    return encoded.decode('utf-8')


def restore(raw, *, target_id):
    artifact.require(isinstance(raw, str) and len(raw.encode('utf-8')) <= MAX_BYTES,
                     'invalid saved editing document size')
    value = json.loads(raw)
    artifact.require(isinstance(value, dict), 'invalid saved editing document')
    checksum = value.pop('checksum', None)
    artifact.require(checksum == sha256(artifact.encoded(value)).hexdigest(), 'saved editing document changed')
    _validate(value, target_id)
    return value
