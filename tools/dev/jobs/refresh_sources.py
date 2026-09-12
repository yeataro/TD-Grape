"""Refresh embedded sources, preserving live graphs and the connection session."""
from pathlib import Path
import json

owners = [n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1, 'Expected one TD-Grape manager in /project1'
owner = owners[0]
mapping = json.loads((GRAPE_ROOT / 'src/td/embedded_sources.json').read_text(encoding='utf-8'))
old = {dat: owner.op(dat).text for dat in mapping}
new = {dat: source_path(name).read_text(encoding='utf-8') for dat, name in mapping.items()}
changed = [dat for dat in mapping if old[dat] != new[dat]]
runtime = owner.op('runtime').module
shaders = [s for s in runtime._shaders.values() if s and s.valid]
def snapshot():
    return {s.path: {name: s.op(name).text for name in ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader') if s.op(name)} for s in shaders}
before = snapshot()
if changed:
    namespace = dict(runtime.__dict__)
    keys = ('_owner', '_queue', '_shaders', '_shader', '_personal_cache', '_family_pending',
            '_family_next', '_family_attempts', '_family_force', '_upgrade_tickets')
    state = {key: getattr(runtime, key) for key in keys}
    session = {'port': runtime._port, 'token': runtime._token, 'strictPort': True,
               'rebind': True, 'lan': bool(owner.par.Allowlan.eval())}
    lifecycle = owner.op('lifecycle')
    active = lifecycle.par.active.eval()
    try:
        lifecycle.par.active = False
        worker = runtime._worker
        runtime.stop()
        assert not worker or not worker.is_alive(), 'Previous HTTP worker is still alive'
        for dat in changed:
            owner.op(dat).text = new[dat]
        runtime = owner.op('runtime').module
        for key, value in state.items():
            setattr(runtime, key, value)
        runtime.start(owner, session=session)
        assert (runtime._port, runtime._token, runtime._lan_enabled) == (session['port'], session['token'], session['lan'])
        assert snapshot() == before, 'Refresh changed a saved Shader'
    except Exception:
        if getattr(runtime, '_server', None):
            runtime.stop()
        for dat in changed:
            owner.op(dat).text = old[dat]
        restored = owner.op('runtime').module
        restored.__dict__.update(namespace)
        restored._server = restored._worker = None
        restored.start(owner, session=session)
        raise
    finally:
        lifecycle.par.active = active
result = {'updated': changed, 'sources': len(mapping), 'shadersPreserved': len(shaders),
          'version': runtime.PRODUCT_VERSION, 'saved': False}
