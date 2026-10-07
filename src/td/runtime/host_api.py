"""Existing editor request contract on a compiler-free, main-thread host.

Resolution, native actions and preview are injected by the TD Manager. This
module never discovers OPs or evaluates graphs. Unsupported actions stay
explicit until their actual adapters are migrated.
"""
from copy import deepcopy
import re
from urllib.parse import urlsplit, parse_qs


class UnsupportedOperation(RuntimeError):
    pass


class HostAPI:
    def __init__(self, *, bootstrap, library, resolve, history, parameters,
                 validation_area, preview, choices, save_project):
        if bootstrap.get('version') != 1 or bootstrap.get('producer') != 'frontend-modules':
            raise ValueError('The editor module bootstrap is unavailable or incompatible.')
        self.bootstrap = deepcopy(bootstrap)
        self.library = deepcopy(library)
        self.resolve = resolve
        self.history = history
        self.parameters = parameters
        self.validation_area = validation_area
        self.preview = preview
        self.choices = choices
        self.save_project = save_project

    def dispatch(self, method, path, body=None):
        url = urlsplit(path)
        path, next_editor = url.path, parse_qs(url.query).get('editor') == ['next']
        match = re.fullmatch(r'/api/([a-f0-9]{32})/([a-z-]+)', path)
        if method == 'GET' and path == '/api/shaders':
            return 200, self.choices()
        if not match:
            return 404, {'error': 'Open a registered TOP Family to edit its graph.', 'code': 'target_required'}
        target_id, action = match.groups()
        try:
            family = self.resolve(target_id)
            if family is None:
                return 404, {'error': 'This Family is not available to the Manager.', 'code': 'target_unavailable'}
            if method == 'POST' and not isinstance(body, dict):
                raise ValueError('Host actions require a JSON object.')
            # Old and new editors never share a Grape OP (design-interview Q40): a TD tag decides.
            # 新舊編輯器不共用 Grape OP，由 TD tag 決定。
            if getattr(family, 'next', False) != next_editor:
                return 409, ({'error': 'This Grape OP is managed by the new editor; open it there.', 'code': 'managed_by_new_editor'}
                    if not next_editor else {'error': 'This Grape OP holds an old-format graph. The new editor does not open or convert old graphs; view them in the main or legacy TD.', 'code': 'old_editor_graph'})
            if next_editor:
                return 200, self._next_action(family, method, action, body)
            return 200, self._action(family, method, action, body)
        except UnsupportedOperation as error:
            return 501, {'error': str(error), 'code': 'capability_not_migrated', 'layer': 'manager', 'operation': action}
        except (ValueError, RuntimeError) as error:
            conflict = 'conflict' in str(error).lower()
            return 409 if conflict else 422, {'error': ('Conflict: ' if conflict and not str(error).startswith('Conflict:') else '') + str(error),
                'code': 'revision_conflict' if conflict else 'host_rejected', 'layer': 'native-family', 'operation': action}

    def _next_action(self, family, method, action, body):
        # TD only checks the envelope and what it executes; no history, sources or graph reads.
        # TD 只核對信封與自己要執行的東西；不碰歷史、來源或圖的內容。
        if method == 'GET' and action == 'state':
            return {'state': family.state(), 'format': family.FORMAT, 'shaderKind': 'top', 'target': family.target().path,
                'frontendCompiler': {'protocol': family.PROTOCOL, 'catalogHash': self.bootstrap['catalogHash'], 'required': True}}
        if method == 'POST' and action == 'apply':
            return family.apply(body, catalog_hash=self.bootstrap['catalogHash'])
        if method == 'POST' and action == 'save':
            return {'saved': self.save_project()}
        raise UnsupportedOperation('The new editor path does not provide this operation yet: ' + method + ' ' + action)

    def _operation(self, family, operation, source_edit=None):
        family.sources.sync(family)
        before = self.history.capture(family)['token']
        result = operation()
        if source_edit is not None:
            self.history.note_edit(family, source_edit, before)
        result = self.history.attach(family, result)
        result['history']['beforeToken'] = before
        return result

    def _action(self, family, method, action, body):
        sources = family.sources
        if method == 'GET':
            if action == 'shaders':
                return self.choices()
            if action == 'state':
                sources.sync(family)
                return self.history.attach(family, {
                    'state': family.state(), 'shaderKind': 'top', 'target': family.target().path,
                    'catalog': self.bootstrap['catalog'], 'typeContract': self.bootstrap['typeContract'],
                    'functionLibrary': self.library['items'], 'examples': {},
                    'frontendCompiler': {'protocol': family.artifact.PROTOCOL,
                        'catalogHash': self.bootstrap['catalogHash'], 'required': True},
                    'hostCapabilities': {'nativeSources': True, 'customParameters': True,
                        'uniformLiveReason': 'Refactor: live Uniform channel not migrated; individual value edits remain available.',
                        'uniformLive': False, 'pixelPreview': False, 'personalLibrary': False},
                    'hostScope': 'Refactor TOP · frontend GLSL · native controls; other host capabilities are still being migrated.'})
            if action == 'sources':
                return self.history.attach(family, sources.snapshot(family))
            if action == 'uniforms':
                seen = sources.snapshot(family)
                return self.history.attach(family, {'revision': seen['revision'], 'textures': {},
                    'uniforms': {row['id']: {'type': row['type'], 'default': row['default'],
                        'components': row['components'][:sources.source_components(row)]}
                        for row in seen['uniforms'] if not row['missing']}})
            if action == 'custom-parameters':
                return self.parameters.snapshot(family)
            if action == 'state-source':
                raw = family.document.serialize(family.state())
                from hashlib import sha256
                return {'raw': raw, 'sha256': sha256(raw.encode('utf-8')).hexdigest()}
        elif method == 'POST':
            if action == 'apply':
                if body.get('pixelPreview'):
                    raise UnsupportedOperation('Temporary pixel preview has not been migrated to this Manager.')
                return self._operation(family, lambda: family.apply(body,
                    catalog_hash=self.bootstrap['catalogHash'], validation_area=self.validation_area))
            if action == 'source-value':
                return self._operation(family, lambda: sources.write_value(family, body))
            if action == 'source-edit':
                self.history.preflight_edit(family, body)
                return self._operation(family, lambda: sources.edit(family, body), source_edit=body)
            if action == 'history-restore':
                with family.values.history_native_writes():
                    return self.history.restore(family, body)
            if action == 'custom-parameters':
                return self.parameters.edit(family, body)
            if action == 'remote-preview':
                return self.preview(family.target())
            if action == 'save':
                return {'saved': self.save_project()}
        raise UnsupportedOperation('The new TOP Manager does not yet provide this operation: ' + method + ' ' + action)
