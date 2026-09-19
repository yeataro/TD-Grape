"""Layout parity and native guard checks in disposable TD fixtures."""
from pathlib import Path
import copy
import json
import time
import uuid

original = op('/TD_Grape/runtime').module
def live():
    return {s.path: {n: s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before = live(); registry_before = dict(original._shaders)
assert not op('/grape_sync_test')
root = op('/').create(baseCOMP, 'grape_sync_test'); checks = []; measurements = []
try:
    manager = root.create(baseCOMP, 'manager'); manager.store('sgrapeManager', True); manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test'); page.appendStr('Updatestatus'); page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(Path(GRAPE_TEST_OUTPUT)/'empty_personal')
    mapping = json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat, name in mapping.items(): manager.create(textDAT, dat).text = source_path(name).read_text(encoding='utf-8')
    r = manager.op('runtime').module; r._owner = manager; c = r.core(); d = manager.op('document').module
    real_compile = c.compile_graph; real_validate = r.validate_material
    calls = {'compile': 0, 'native': 0}
    def compile(graph):
        calls['compile'] += 1
        return real_compile(graph)
    def validate(*args, **kwargs):
        calls['native'] += 1
        return real_validate(*args, **kwargs)
    c.compile_graph = compile; r.validate_material = validate
    class NoReuse(d.GraphChecks):
        def compile(self, graph): return c.compile_graph(graph)
        def saved(self, raw, target): return d.inspect_saved_state(raw, c, target, self.compile)
    for kind in ('top', 'mat'):
        for count in (16, 101):
            graph = c.normalize_top_sources(c.demo_graph('color', target=kind))[0]
            nodes = graph['stages']['pixel']['nodes']
            nodes.extend(c.node('scalar', 'extra'+str(i), x=i*50, y=200, value=0.5) for i in range(count-len(nodes)))
            shader = r.create_shader(root, 'Check_'+kind+str(count), graph, kind)
            with r.shader_context(shader):
                outputs = {n: shader.op(n).text for n in ('pixel_shader','vertex_shader') if shader.op(n)}
                # Measure the existing request path with reuse explicitly off,
                # then the same path with bounded reuse. No native guards stubbed.
                for reuse in (False, True):
                    r._graph_checks = d.GraphChecks(c) if reuse else NoReuse(c)
                    current = r.state()
                    warm = r.process_shader_request('POST','/api/apply',dict(graph=current['graph'],revision=current['revision']))
                    assert warm['ok'] and not warm['shaderUpdated'], warm
                    for i in range(3):
                        current = r.state(); moved = copy.deepcopy(current['graph'])
                        for node in moved['stages']['pixel']['nodes']: node['ui']['x'] += 5
                        calls.update(compile=0, native=0); start = time.perf_counter()
                        result = r.process_shader_request('POST','/api/apply',dict(graph=moved,revision=current['revision']))
                        elapsed = (time.perf_counter()-start)*1000
                        assert result['ok'] and not result['shaderUpdated'], result
                        assert result['state']['revision'] == current['revision']+1
                        assert result['state']['graph'] == moved and r.state()['graph'] == moved
                        assert json.loads(shader.op('graph').text) == moved
                        assert all(shader.op(n).text == text for n,text in outputs.items())
                        assert calls['native'] == 0
                        if reuse: assert calls['compile'] == 0, calls
                        measurements.append(dict(kind=kind,nodes=count,reuse=reuse,ms=elapsed,**calls))
                checks.append(kind+str(count)+': layout keeps content, revisions, history, DAT and shader output; warm compile/native calls zero')
                current = r.state(); raw = shader.op('state').text
                try: r.deploy(current['graph'], current['revision']-1); raise AssertionError('stale revision accepted')
                except RuntimeError as exc: assert 'Conflict' in str(exc)
                assert shader.op('state').text == raw
                shader.op('state').text = '{broken'
                try: r.deploy(current['graph'], current['revision']); raise AssertionError('damaged state accepted')
                except RuntimeError as exc: assert 'Saved Shader state' in str(exc)
                assert shader.op('state').text == '{broken'
                shader.op('state').text = raw
                # Semantic edits and generated annotations must miss the cache.
                changed = copy.deepcopy(current['graph']); changed['stages']['pixel']['nodes'][0]['params']['value'] = [0.2,0.3,0.4,1]
                calls.update(compile=0,native=0)
                changed_result = r.deploy(changed,current['revision'])
                assert changed_result['ok'] and changed_result['shaderUpdated'] and calls['native'] == 2 and calls['compile'] > 0
                current = r.state(); changed = copy.deepcopy(current['graph']); changed['stages']['pixel']['nodes'][0]['ui']['comment'] = 'Updated comment'
                assert r.deploy(changed,current['revision'])['shaderUpdated']
                assert 'Updated comment' in shader.op('pixel_shader').text
                # Editing the shader text outside the editor still forces repair.
                shader.op('pixel_shader').text += '\n// external edit'
                current = r.state(); calls.update(compile=0,native=0)
                assert r.deploy(current['graph'],current['revision'])['shaderUpdated'] and calls['native'] == 2
                checks.append(kind+str(count)+': revision, damaged DAT, semantic/comment update and external shader guards preserved')
            shader.destroy()
    result = dict(checks=checks,measurements=measurements)
    Path(GRAPE_TEST_OUTPUT).mkdir(parents=True, exist_ok=True)
    (Path(GRAPE_TEST_OUTPUT)/'measurements.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
    root.destroy()
    assert live() == before and original._shaders == registry_before, 'Existing user shader/registry changed'
