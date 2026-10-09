"""Editor request contract on a compiler-free, main-thread host.

Resolution and the Grape OP list are injected by the TD Manager. This module
never discovers OPs or reads graphs. Unsupported actions stay explicit.
"""
import re
from urllib.parse import urlsplit


class UnsupportedOperation(RuntimeError):
    pass


class HostAPI:
    def __init__(self, *, bootstrap, resolve, choices, save_project, applied=None, identity=None):
        if bootstrap.get('version') != 1 or bootstrap.get('producer') != 'frontend-modules':
            raise ValueError('The editor module bootstrap is unavailable or incompatible.')
        self.catalog_hash = bootstrap['catalogHash']
        self.resolve = resolve
        self.choices = choices
        self.save_project = save_project
        # Told after a program is applied, so live editors get the new state (Uniform D2). 套用後通知即時通道。
        self.applied = applied
        # Which TD answered (Refactor.52, design-interview Q63): the project file and TD build, on every
        # reply, so people can compare; the host itself never judges "same TD". 每個回覆都帶「哪個 TD 回的」
        # （專案檔名、TD 版本），讓人比對；宿主自己不判斷是不是同一個 TD。
        self.identity = identity

    def dispatch(self, method, path, body=None):
        status, result = self._dispatch(method, path, body)
        if self.identity and isinstance(result, dict):
            result = {**result, 'td': self.identity()}
        return status, result

    def _dispatch(self, method, path, body):
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
            if getattr(error, 'code', None) == 'build_changed':
                # Not a conflict: no version choice helps, the page must be reloaded (Refactor.52).
                # 不是衝突：選哪個版本都沒用，要重新整理頁面。
                return 409, {'error': str(error), 'code': 'build_changed', 'layer': 'grape-op', 'operation': action}
            conflict = 'conflict' in str(error).lower()
            return 409 if conflict else 422, {'error': ('Conflict: ' if conflict and not str(error).startswith('Conflict:') else '') + str(error),
                'code': 'revision_conflict' if conflict else 'host_rejected', 'layer': 'grape-op', 'operation': action}

    def _action(self, family, method, action, body):
        # TD only checks the envelope and what it executes; no history, sources or graph reads.
        # TD 只核對信封與自己要執行的東西；不碰歷史、來源或圖的內容。
        if method == 'GET' and action == 'shaders':
            return self.choices()
        if method == 'GET' and action == 'state':
            return {'state': family.state(), 'uniforms': family.uniform_states(), 'format': family.FORMAT, 'shaderKind': 'top', 'target': family.target().path,
                'frontendCompiler': {'protocol': family.PROTOCOL, 'catalogHash': self.catalog_hash, 'required': True}}
        if method == 'POST' and action == 'apply':
            result = family.apply(body, catalog_hash=self.catalog_hash)
            if self.applied:
                self.applied(family)
            return result
        # Uniform values while they change go over the WebSocket since Uniform D2 (Q53), not HTTP.
        # 改變中的 Uniform 值從 D2 起走 WebSocket，不走 HTTP。
        if method == 'POST' and action == 'save':
            return {'saved': self.save_project()}
        raise UnsupportedOperation('The editor host does not provide this operation yet: ' + method + ' ' + action)
