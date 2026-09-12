"""Run this file in TD's Textport after opening src/td/TD-Grape-dev.toe."""
from pathlib import Path
import json
import os

root = Path(project.folder).resolve().parents[1]
if not (root / 'src/td/source_files.json').is_file():
    raise RuntimeError('Open src/td/TD-Grape-dev.toe in the complete source checkout')
scope = {'__file__': str(root / 'tools/dev/paths.py')}
exec(compile((root / 'tools/dev/paths.py').read_text(encoding='utf-8'), scope['__file__'], 'exec'), scope)
work = scope['work_path'](root)
queue = work / 'bridge'
queue.mkdir(parents=True, exist_ok=True)
(work / 'jobs').mkdir(exist_ok=True)
(work / 'reports').mkdir(exist_ok=True)
component = op('/grape_devbridge')
if component and not component.fetch('grapeDevelopment', False):
    raise RuntimeError('An unrelated /grape_devbridge already exists')
component = component or op('/').create(baseCOMP, 'grape_devbridge')
component.store('grapeDevelopment', True)
runner = component.op('runner') or component.create(executeDAT, 'runner')
runner.par.active = False
runner.text = (root / 'tools/dev/runner.py').read_text(encoding='utf-8')
runner.par.framestart = True
runner.par.active = True
ready = {'root': str(root), 'work': str(work), 'pid': os.getpid(),
         'component': component.path, 'tdVersion': app.version, 'tdBuild': app.build}
(queue / 'ready.json').write_text(json.dumps(ready, indent=2), encoding='utf-8')
print('TD-Grape development bridge ready')
