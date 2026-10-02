"""Emit real-core shader fixtures for the isolated numerical Preview GPU probe.

No TouchDesigner process, saved graph, or host bridge is used or changed.
Expected pixels are explicit test data, not obtained from the compiler mapping.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src' / 'core'))
import sgrape_core as c


CASES = [
    ('float', -.25, [-.25, -.25, -.25, 1]),
    ('vec2', [-.2, 1.8], [-.2, 1.8, .5, 1]),
    ('vec3', [.2, -.4, 1.6], [.2, -.4, 1.6, 1]),
    ('vec4', [.2, .4, 1.6, .3], [.2, .4, 1.6, .3]),
    ('int', -2, [-2, -2, -2, 1]),
    ('ivec2', [-1, 2], [-1, 2, .5, 1]),
    ('ivec3', [-2, 0, 3], [-2, 0, 3, 1]),
    ('ivec4', [-2, 0, 3, 0], [-2, 0, 3, 0]),
    ('uint', 2, [2, 2, 2, 1]),
    ('uvec2', [2, 3], [2, 3, .5, 1]),
    ('uvec3', [2, 0, 3], [2, 0, 3, 1]),
    ('uvec4', [2, 0, 3, 1], [2, 0, 3, 1]),
    ('bool', True, [1, 1, 1, 1]),
    ('bvec2', [True, False], [1, 0, .5, 1]),
    ('bvec3', [False, True, False], [0, 1, 0, 1]),
    ('bvec4', [True, False, True, False], [1, 0, 1, 0]),
    ('double', .25, [.25, .25, .25, 1]),
    ('dvec2', [.2, .8], [.2, .8, .5, 1]),
    ('dvec3', [.2, .4, .6], [.2, .4, .6, 1]),
    ('dvec4', [.2, .4, .6, .3], [.2, .4, .6, .3]),
]


def fixture(ty, value, expected, target='top'):
    graph = c.demo_graph('color', target)
    pixel = graph['stages']['pixel']
    pixel['nodes'] += [
        c.node('glsl_code', 'sample', functionName='previewValue', inputs=[],
               outputs=[{'id': 'out', 'name': 'value', 'type': ty}],
               code='value = ' + c.literal(value, ty) + ';'),
        c.node('preview', 'preview'),
    ]
    pixel['edges'].append(c.edge('sample', 'preview', 'value'))
    if target == 'mat':
        output = next(node for node in pixel['nodes'] if node['id'] == 'pixel')
        output['params'].update({key: False for key in c.PIXEL_FINISHING_DEFAULTS})
        output['params']['bufferCount'] = 2
        next(node for node in pixel['nodes'] if node['id'] == 'color')['params']['value'] = [.1, .3, .7, .4]
        pixel['edges'].append(c.edge('color', 'pixel', c.PIXEL_BUFFER_PORTS[1]))
    compiled = c.compile_graph(graph)
    assert compiled['stages']['pixel']['ports']['preview'] == {'in': {'value': ty}, 'out': {}}
    assert 'sg_color = sg_preview_color;' in compiled['pixel']
    return {'id': target + '-' + ty, 'type': ty, 'target': target,
            'input': value, 'expected': expected, 'pixel': compiled['pixel']}


def main():
    cases = [fixture(*case) for case in CASES]
    native = cases[16:]
    conversions = {'double': 'vec4(vec3(float(sg_n_sample_out)), 1.0)',
                   'dvec2': 'vec4(vec2(sg_n_sample_out), 0.5, 1.0)',
                   'dvec3': 'vec4(vec3(sg_n_sample_out), 1.0)',
                   'dvec4': 'vec4(sg_n_sample_out)'}
    for case in native:
        assert 'vec4 sg_preview_color = ' + conversions[case['type']] + ';' in case['pixel']
        case['compilerCheck'] = 'PASS'
        case['gpuStatus'] = 'NOT_RUN_REQUIRES_NATIVE_TD'
        case['reason'] = 'WebGL2 / GLSL ES 3.00 does not support double or dvecN; compiler emission is not GPU evidence.'
    mrt = fixture('vec2', [.2, .8], [[.2, .8, .5, 1], [.1, .3, .7, .4]], 'mat')
    assert 'fragColor[1] = TDOutputSwizzle(sg_n_color);' in mrt['pixel']
    core_file = ROOT / 'src' / 'core' / 'sgrape_core.py'
    print(json.dumps({'schemaVersion': 1, 'compilerFile': 'src/core/sgrape_core.py',
                      'compilerSha256': hashlib.sha256(core_file.read_bytes()).hexdigest(),
                      'webglCases': cases[:16], 'nativeOnlyCases': native, 'mrtCase': mrt}, indent=2))


if __name__ == '__main__':
    main()
