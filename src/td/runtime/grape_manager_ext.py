"""Editing coordinator. Native Families never need this object to render."""
import json
import uuid
from hashlib import sha256


class GrapeManagerExt:
    def __init__(self, ownerComp):
        self.ownerComp = ownerComp
        self.queue = None
        self.api = None
        self.editor = None
        self.families = {}
        self.bootstrap = None

    def _module(self, name):
        return self.ownerComp.op(name).module

    def _status(self, state, **details):
        self.ownerComp.op('status').text = json.dumps({'state': state, **details}, ensure_ascii=False, indent=2)

    def Connect(self, editor):
        """An explicit peer entry point; invoked on service start/reload."""
        self.Disconnect()
        files = editor.snapshot.files
        bootstrap = json.loads(files['editor-bootstrap.json'])
        if bootstrap['catalogHash'] != sha256(files['wire_planning.js']).hexdigest():
            raise RuntimeError('Editor bootstrap and compiler are from different builds.')
        self.bootstrap = bootstrap
        self.editor = editor
        self.api = self._module('host_api').HostAPI(
            bootstrap=bootstrap, library=json.loads(files['editor-library.json']),
            resolve=self.Resolve, history=self._module('history'), parameters=self._module('parameters'),
            validation_area=self.ownerComp.op('validation'), preview=self.Preview,
            choices=self.Choices, save_project=lambda: project.save())
        self.queue = self._module('host_requests').HostRequests()
        editor.http.connect(self.queue)
        panel = self.ownerComp.par.Remotepanel.eval()
        editor.http.preview_port = int(panel.par.Port.eval()) if panel else None
        # Discovery happens on connection, never on an idle frame or child cook.
        self.families = {comp.id: comp for comp in op('/').findChildren(tags=['grapeNativeFamily'])}
        for comp in self.families.values():
            self._clear_absence(comp)
        self._status('Ready', registered=len(self.families), version=editor.snapshot.version)

    def _clear_absence(self, comp):
        # An explicit Manager start restores availability; no child-side polling.
        data = comp.op('GrapeControls/status')
        if data:
            try:
                previous = json.loads(data.text)
            except ValueError:
                return
            if isinstance(previous, dict) and previous.get('state') == 'Editing unavailable' and previous.get('message') == 'No active Manager.':
                data.text = json.dumps({'state': 'Editing available', 'manager': self.ownerComp.path})

    def Disconnect(self):
        if self.editor and self.editor.http and self.editor.http.host_requests is self.queue:
            self.editor.http.connect(None)
        if self.queue:
            self.queue.close()
        self.queue = self.api = self.editor = None

    def Drain(self):
        if self.queue:
            # Empty queue does not read Families, Parameters, Library or state.
            self.queue.drain(self.api.dispatch)

    def Diagnostics(self):
        result = self.queue.outcomes() if self.queue else []
        self._status('Ready' if self.queue else 'Disconnected', recent=result)
        return result

    def Adapter(self, comp):
        # Old and new editors never share a Grape OP; the TD tag decides (design-interview Q40).
        # 新舊編輯器不共用 Grape OP，由 TD tag 決定。
        nxt = self._module('next_family')
        if nxt.is_next(comp):
            return nxt.NextFamily(comp, protocol=self._module('host_artifact').PROTOCOL,
                validation_area=self.ownerComp.op('validation'))
        return self._module('native_family').NativeFamily(comp,
            artifact=self._module('host_artifact'), document=self._module('host_document'),
            sources=self._module('sources'), values=self._module('native_values'),
            controls_source=self.ownerComp.op('parameter_links_source').text)

    def Resolve(self, target_id):
        matches = [comp for comp in self.families.values() if comp.valid and comp.fetch('sgrapeShaderId', None) == target_id]
        if len(matches) > 1:
            raise RuntimeError('Duplicate Family identity detected; no copy was selected or changed. Review the copies before editing.')
        return self.Adapter(matches[0]) if matches else None

    def Register(self, comp):
        if 'grapeNativeFamily' not in comp.tags:
            raise RuntimeError('This is not a migrated native Family.')
        self.Adapter(comp).state()
        self.families[comp.id] = comp
        self._clear_absence(comp)
        return comp.fetch('sgrapeShaderId')

    def Choices(self):
        rows = [{'id': comp.fetch('sgrapeShaderId'), 'path': comp.path, 'kind': 'top'}
                for comp in self.families.values() if comp.valid]
        return {'shaders': rows, 'projectFile': project.name}

    def Open(self, comp):
        if not self.editor or not self.editor.http:
            raise RuntimeError('Editor Service is stopped; native Shader operation is unaffected.')
        target_id = self.Register(comp)
        self.Resolve(target_id)
        address = 'http://127.0.0.1:' + str(self.editor.http.port) + '/shader/' + target_id + '/'
        ui.viewFile(address)
        return address

    def Preview(self, comp):
        panel = self.ownerComp.par.Remotepanel.eval()
        if panel is None or not panel.par.Active.eval():
            raise RuntimeError('Remote Panel is unavailable or stopped.')
        shader = self.Adapter(comp).shader_operator(comp)
        ticket = panel.op('runtime').module.prepare_viewer(shader)
        return {'port': int(panel.par.Port.eval()), 'ticket': ticket, 'source': shader.path}

    def InitializeFamily(self, comp):
        """Use the frontend-built default artifact, never a Python graph builder."""
        if not self.bootstrap:
            raise RuntimeError('Load and connect the editor assets before creating a Family.')
        target_id = comp.fetch('sgrapeShaderId', None)
        if not target_id:
            target_id = uuid.uuid4().hex
            comp.store('sgrapeShaderId', target_id)
        default = self.bootstrap['defaultDocument']
        body = {'revision': 0, 'graph': default['graph'], 'frontendArtifact': {
            'protocol': self._module('host_artifact').PROTOCOL, 'targetId': target_id,
            'baseRevision': 0, 'snapshot': json.dumps(default['graph']),
            'catalogHash': self.bootstrap['catalogHash'], 'compiled': default['compiled']}}
        result = self.Adapter(comp).apply(body, catalog_hash=self.bootstrap['catalogHash'],
            validation_area=self.ownerComp.op('validation'), initial=True)
        comp.tags.add('grapeNativeFamily')
        self.Register(comp)
        return result

    def onInitTD(self):
        editor = self.ownerComp.par.Editorservice.eval()
        if editor and editor.ext.EditorServiceExt.http:
            self.Connect(editor.ext.EditorServiceExt)

    def onDestroyTD(self):
        self.Disconnect()
