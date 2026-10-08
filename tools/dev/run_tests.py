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
    ['node', 'tools/build_core.cjs', '--check'],
    ['node', '--test', 'tests/unit/test_wire_planning.cjs', 'tests/unit/test_top_compiler.cjs'],
    [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/unit', '-p', 'test_*.py'],
    [sys.executable, 'tests/integration/test_editor_launch.py'],
]
commands.append(['node', '--test', 'tests/unit/test_remote_panel_touch.mjs', 'tests/unit/test_remote_panel_input.mjs', 'tests/unit/test_remote_panel_size.mjs'])
for command in commands:
    subprocess.run(command, cwd=root, env=env, check=True)
print('Portable checks passed')
