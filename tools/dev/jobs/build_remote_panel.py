"""Refresh the independent Remote Panel component in the current Grape manager.

Existing source/network preferences are preserved. A new component starts inactive.
"""
# The main component is found by its global OP shortcut only (design-interview Q49). The old
# lookup (a 'sgrapeManager' storage key) found nothing after the 2026-10-08 cleanup.
assert hasattr(op, 'TDGrape'), 'The TD-Grape main component (global OP shortcut TDGrape) is not in this project.'
owners = [op.TDGrape]
source = GRAPE_ROOT / 'src/remote_panel/build.py'
scope = dict(globals(), __file__=str(source))
exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), scope, scope)
component = scope['build'](owners[0])
result = {'path': component.path, 'url': component.par.Url.eval(),
          'errors': component.errors(recurse=True)}
