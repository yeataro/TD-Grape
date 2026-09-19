"""Shared preset metadata initializes TOP/MAT exactly once, in isolation."""
from pathlib import Path
import copy
import json
import uuid

out = Path(GRAPE_TEST_OUTPUT)
out.mkdir(parents=True, exist_ok=True)
area = op('/').create(baseCOMP, 'grape_source_catalog_' + uuid.uuid4().hex[:8])
checks = []
try:
    manager = area.create(baseCOMP, 'manager')
    manager.store('sgrapeManager', True)
    manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test')
    page.appendStr('Updatestatus')
    page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(out / 'empty_personal')
    mapping = json.loads((GRAPE_ROOT / 'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat, name in mapping.items():
        manager.create(textDAT, dat).text = source_path(name).read_text(encoding='utf-8')
    runtime = manager.op('runtime').module
    runtime._owner = manager
    core = runtime.core()
    sources = manager.op('sources').module
    presets = core.type_contract()['sources']['uniformPresets']
    for kind in ('top', 'mat'):
        graph = core.normalize_top_sources(core.demo_graph('color', kind))[0]
        graph['declarations'] = [dict(id=key, kind='uniform', name=spec['name'], type=spec['type'],
                                      initialDriver=key, value=0) for key, spec in presets.items()]
        shader = runtime.create_shader(area, 'test_' + kind, graph, kind)
        with runtime.shader_context(shader):
            seen = sources.snapshot(runtime)
            operator = runtime.shader_operator(shader)
            for row in seen['uniforms']:
                parameter = getattr(operator.par, row['components'][0]['parameter'])
                assert parameter.expr == presets[row['id']]['initialize']['expression']
                assert str(parameter.mode).endswith('EXPRESSION')
                assert row['components'][0]['value'] is not None
            checks.append(kind + ': all six presets initialize and evaluate')
            row = next(row for row in seen['uniforms'] if row['id'] == 'deltaTime')
            parameter = getattr(operator.par, row['components'][0]['parameter'])
            parameter.mode = ParMode.CONSTANT
            parameter.val = 0.125
            assert runtime.deploy(copy.deepcopy(runtime.state()['graph']), runtime.state()['revision'])['ok']
            assert str(parameter.mode).endswith('CONSTANT') and parameter.eval() == 0.125
            checks.append(kind + ': reapply preserves user-modified preset mode and value')
            seen = sources.snapshot(runtime)
            try:
                sources.edit(runtime, dict(action='create', name=presets['absTime']['name'],
                                           type='float', preset='absTime', revision=seen['revision']))
                raise AssertionError('Duplicate preset name was accepted')
            except RuntimeError as exc:
                assert 'name' in str(exc).lower() or 'exists' in str(exc).lower(), str(exc)
            checks.append(kind + ': duplicate Create does not overwrite existing source')
        runtime._shaders.pop(shader.fetch('sgrapeShaderId'), None)
        shader.destroy()
finally:
    area.destroy()

(out / 'result.json').write_text(json.dumps(dict(checks=checks), indent=2), encoding='utf-8')
print(json.dumps(dict(checks=checks)))
