"""Legacy oracle for the narrow frontend compiler; never used by the product."""
import copy
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src/core'))
import sgrape_core as c


def graph(nodes, edges=(), declarations=()):
    return dict(schemaVersion=1, target='top', declarations=list(declarations), functions=[], topInputs=[],
                stages={'pixel': {'nodes': list(nodes), 'edges': list(edges)}})


cases = []
def add(name, value):
    try:
        result = c.compile_graph(value)
        result.pop('hash')  # The legacy Python semantic hash is an adapter concern.
        cases.append(dict(name=name, graph=value, compiled=result))
    except c.GraphError as exc:
        cases.append(dict(name=name, graph=value, error=str(exc)))


out = c.node('pixel_out', 'out')
add('empty output defaults', graph([out]))
for key, ty, value in [('float', 'float', .25), ('scalar', 'float', -.125),
                       ('vec2', 'vec2', [.1, .2]), ('vec3', 'vec3', [.1, .2, .3]),
                       ('vec4', 'vec4', [.1, .2, .3, 1]), ('color', 'vec4', [.3, .2, .1, 1])]:
    source = c.node(key, 'source', value=value, **({'type': ty} if key == 'scalar' else {}))
    add(key, graph([source, out], [c.edge('source', 'out', 'color')] if ty in ('float', 'vec4') else []))
for ty in ('vec2', 'vec3', 'vec4'):
    source = c.node('vector', 'source', type=ty, components=[.1, .2, .3, 1])
    add('vector ' + ty, graph([source, out], [c.edge('source', 'out', 'color')] if ty == 'vec4' else []))
for key in ('add', 'subtract', 'multiply', 'divide'):
    for a, b in [('float', 'float'), ('vec4', 'vec4'), ('float', 'vec4'), ('vec4', 'float')]:
        ty = b if a == 'float' else a
        left = c.node('float' if a == 'float' else 'color', 'left', value=.25 if a == 'float' else [.1, .2, .3, 1])
        right = c.node('float' if b == 'float' else 'color', 'right', value=.5 if b == 'float' else [.3, .4, .5, 1])
        op = c.node(key, 'operation', type=ty, operandTypes={'a': a, 'b': b})
        for connected in (False, True):
            edges = [c.edge('operation', 'out', 'color')]
            if connected:
                edges += [c.edge('left', 'operation', 'a'), c.edge('right', 'operation', 'b')]
            add(f'{key} {a} {b} connected={connected}', graph([left, right, op, out], edges))
for ty in ('float', 'vec2', 'vec3', 'vec4'):
    value = .5 if ty == 'float' else [.1] * int(ty[-1])
    decl = dict(id='gain', kind='uniform', name='uGain', type=ty, value=value, expose=False)
    uniform = c.node('uniform', 'gainNode', declarationId='gain')
    op = c.node('abs', 'absolute', type=ty)
    edges = [c.edge('gainNode', 'absolute', 'value')]
    if ty in ('float', 'vec4'):
        edges += [c.edge('absolute', 'out', 'color')]
    add('uniform abs ' + ty, graph([uniform, op, out], edges, [decl]))
    manual = c.node('abs', 'manual', type=ty)
    manual['inputValues'] = {'value': value}
    add('manual default ' + ty, graph([manual, out], [c.edge('manual', 'out', 'color')] if ty in ('float', 'vec4') else []))

# Boundary rounding and deterministic random values catch cross-language literal drift.
rng = random.Random(4928)
numbers = [0, -0.0, 1e-4, 1e-5, 1e-7, 1e8, 1e9, 1e20, -1e20, 1.234567885,
           1.234567895, 999999999.5, .00009999999995, 1000000005., 1000000015.]
numbers += [rng.uniform(-1, 1) * 10 ** rng.randint(-14, 19) for _ in range(100)]
for i, value in enumerate(numbers):
    add(f'number {i} {value}', graph([c.node('float', 'source', value=value), out], [c.edge('source', 'out', 'color')]))

base = graph([c.node('float', 'source', value=.25), c.node('abs', 'absolute', type='float'), out],
             [c.edge('source', 'absolute', 'value'), c.edge('absolute', 'out', 'color')])
bad = copy.deepcopy(base); bad['stages']['pixel']['edges'].append(c.edge('source', 'absolute', 'value')); add('duplicate input', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['edges'][0]['from'][1] = 'missing'; add('missing port', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][0]['params']['value'] = True; add('boolean literal', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][0]['params']['value'] = 1e21; add('out of range literal', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][1]['inputValues'] = {'value': [1, 2]}; add('wrong manual type', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'].append(c.node('abs', 'dead', type='float')); bad['stages']['pixel']['edges'].append(c.edge('dead', 'dead', 'value')); add('disconnected cycle', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'].pop(); add('missing output', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'].append(c.node('pixel_out', 'second')); add('extra output', bad)
named = copy.deepcopy(base); named['stages']['pixel']['nodes'][-1]['name'] = 'source'; add('output name shares implicit source ID', named)
for name in ('main', 'vec4', 'a' * 49, 'TDreserved', 'has__double', 'float'):
    bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][0]['name'] = name; add('reserved/invalid name ' + name, bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][0]['params']['requireConstant'] = 0; add('invalid constant flag', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][-1]['params']['bufferCount'] = 0; add('invalid output count', bad)
bad = copy.deepcopy(base); bad['stages']['pixel']['nodes'][1]['inputValues'] = None; add('null input defaults', bad)
print(json.dumps({'cases': cases, 'identifiers': {'reservedNames': sorted(c.GLSL_CODE_RESERVED)}}, allow_nan=False))
