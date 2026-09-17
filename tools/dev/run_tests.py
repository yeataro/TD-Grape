"""Run portable checks using only this checkout, Python, and Node.js."""
from pathlib import Path
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
env = dict(os.environ)
env['PYTHONPATH'] = os.pathsep.join(str(root / p) for p in ('src/core', 'src/td/runtime', 'tests/unit'))
env['PYTHONDONTWRITEBYTECODE'] = '1'
commands = [
    [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/unit', '-p', 'test_*.py'],
    [sys.executable, 'tools/dev/check_locales.py'],
    [sys.executable, 'tests/integration/test_editor_launch.py'],
    [sys.executable, 'tests/integration/test_node_browser_metadata.py'],
    [sys.executable, 'tools/build/sync_brand_assets.py', '--check'],
]
commands.extend(['node', 'tests/unit/' + name] for name in (
    'test_functions_model.js', 'test_top_source_clipboard.js', 'test_personal_model.js', 'test_editor_edits.js', 'test_editor_save_status.js', 'test_import_ui.js', 'test_spec_import.js', 'test_preview_controls.js'))
commands.append(['node', '--test', 'tests/unit/test_remote_panel_touch.mjs', 'tests/unit/test_remote_panel_input.mjs', 'tests/unit/test_remote_panel_size.mjs'])
for command in commands:
    subprocess.run(command, cwd=root, env=env, check=True)
print('Portable checks passed')
