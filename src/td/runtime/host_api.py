"""Editor request contract on a compiler-free, main-thread host.

Resolution and the Grape OP list are injected by the TD Manager. This module
never discovers OPs or reads graphs. Unsupported actions stay explicit.
"""
import re
from urllib.parse import urlsplit


class UnsupportedOperation(RuntimeError):
    pass


class HostAPI:
    def __init__(self, *, bootstrap, resolve, choices, save_project):
        if bootstrap.get('version') != 1 or bootstrap.get('producer') != 'frontend-modules':
            raise ValueError('The editor module bootstrap is unavailable or incompatible.')
        self.catalog_hash = bootstrap['catalogHash']
        self.resolve = resolve
        self.choices = choices
        self.save_project = save_project

    def dispatch(self, method, path, body=None):
        path = urlsplit(path).path
        match = re.fullmatch(r'/api/([a-f0-9]{32})/([a-z-]+)', path)
        if method == 'GET' and path == '/api/shaders':
            return 200, self.choices()
        if not match:
            return 404, {'error': 'Open a registered Grape OP to edit its graph.', 'code': 'target_required'}
        target_id, action = match.groups()
        try:
            family = self.resolve(target_id)
            if family is None:
                return 404, {'error': 'This Grape OP is not available to the Manager.', 'code': 'target_unavailable'}
            if method == 'POST' and not isinstance(body, dict):
                raise ValueError('Host actions require a JSON object.')
            return 200, self._action(family, method, action, body)
        except UnsupportedOperation as error:
            return 501, {'error': str(error), 'code': 'capability_not_migrated', 'layer': 'manager', 'operation': action}
        except (ValueError, RuntimeError) as error:
            conflict = 'conflict' in str(error).lower()
            return 409 if conflict else 422, {'error': ('Conflict: ' if conflict and not str(error).startswith('Conflict:') else '') + str(error),
                'code': 'revision_conflict' if conflict else 'host_rejected', 'layer': 'grape-op', 'operation': action}

    def _action(self, family, method, action, body):
        # TD only checks the envelope and what it executes; no history, sources or graph reads.
        # TD 只核對信封與自己要執行的東西；不碰歷史、來源或圖的內容。
        if method == 'GET' and action == 'shaders':
            return self.choices()
        if method == 'GET' and action == 'state':
            return {'state': family.state(), 'format': family.FORMAT, 'shaderKind': 'top', 'target': family.target().path,
                'frontendCompiler': {'protocol': family.PROTOCOL, 'catalogHash': self.catalog_hash, 'required': True}}
        if method == 'POST' and action == 'apply':
            return family.apply(body, catalog_hash=self.catalog_hash)
        if method == 'POST' and action == 'live':
            # Uniform values while they change (Uniform C, Q53). 改變中的 Uniform 值。
            return family.live(body)
        if method == 'POST' and action == 'save':
            return {'saved': self.save_project()}
        raise UnsupportedOperation('The editor host does not provide this operation yet: ' + method + ' ' + action)
