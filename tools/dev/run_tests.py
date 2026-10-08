"""Run portable checks after npm ci, using Python, Node.js and the local TS compiler."""
from pathlib import Path
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
env = dict(os.environ)
env['PYTHONPATH'] = os.pathsep.join(str(root / p) for p in ('src/td/runtime', 'tests/unit'))
env['PYTHONDONTWRITEBYTECODE'] = '1'
commands = [
    # Every Python file that is pasted into TD must at least compile: nothing else imports some of
    # them outside TD (Refactor.37: a broken string in grape_op_controls.py passed every test).
    [sys.executable, '-m', 'compileall', '-q', 'src/td/runtime', 'src/remote_panel', 'tools'],
    ['node', 'tools/build_core.cjs', '--check'],
    # Every tr('code', 'original') is a complete literal; en.json and zh-Hant.json are in step (Q34).
    ['node', 'tools/dev/locales.cjs'],
    ['node', '--test', 'tests/unit/test_wire_planning.cjs', 'tests/unit/test_top_compiler.cjs'],
    [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/unit', '-p', 'test_*.py'],
    [sys.executable, 'tests/integration/test_editor_launch.py'],
]
commands.append(['node', '--test', 'tests/unit/test_remote_panel_touch.mjs', 'tests/unit/test_remote_panel_input.mjs', 'tests/unit/test_remote_panel_size.mjs'])
for command in commands:
    subprocess.run(command, cwd=root, env=env, check=True)
print('Portable checks passed')
