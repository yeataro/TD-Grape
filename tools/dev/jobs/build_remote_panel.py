"""Refresh the independent Remote Panel component in the current Grape manager.

Existing source/network preferences are preserved. A new component starts inactive.
"""
owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1, 'Expected one Grape manager.'
source = GRAPE_ROOT / 'src/remote_panel/build.py'
scope = dict(globals(), __file__=str(source))
exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), scope, scope)
component = scope['build'](owners[0])
result = {'path': component.path, 'url': component.par.Url.eval(),
          'errors': component.errors(recurse=True)}
