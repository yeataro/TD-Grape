"""Editing coordinator. Native Families never need this object to render."""
import json
from hashlib import sha256


GRAPE_OP_TAG = 'grapeOP'
TEMPLATES_TAG = 'grapeTemplates'


class GrapeManagerExt:
    def __init__(self, ownerComp):
        self.ownerComp = ownerComp
        self.queue = None
        self.api = None
        self.editor = None
        self.families = {}
        self.bootstrap = None
        self.live = None  # LiveWatch while connected (Uniform D2) 連線期間的即時值監看
        self.textures = {}  # shared default images made this connection (Refactor.58) 這次連線做好的公用預設圖

    @staticmethod
    def _template(comp):
        node = comp.parent()
        while node is not None:
            if TEMPLATES_TAG in node.tags:
                return True
            node = node.parent()
        return False

    def _module(self, name):
        return self.ownerComp.op(name).module

    def _status(self, state, **details):
        self.ownerComp.op('status').text = json.dumps({'state': state, **details}, ensure_ascii=False, indent=2)

    def Connect(self, editor):
        """An explicit peer entry point; invoked on service start/reload."""
        self.Disconnect()
        files = editor.snapshot.files
        # TD reads its shared tables from the editor bundle here, one read point (design-interview Q61):
        # the compiler hash (catalogHash) and the Uniform presets' expressions. If the web assets ever
        # move out of TD, these move with them (see the annotation in this network).
        # TD 從網頁資產讀共用表，只有這一處：編譯器雜湊、預設 Uniform 的 expression。網頁資產搬離 TD 時要一起處理。
        bootstrap = json.loads(files['editor-bootstrap.json'])
        if bootstrap['catalogHash'] != sha256(files['grape_core.js']).hexdigest():
            raise RuntimeError('Editor bootstrap and compiler are from different builds.')
        self.bootstrap = bootstrap
        self.editor = editor
        # Live Uniform values over the editor service's WebSocket (Uniform D2). 經 WebSocket 的即時值。
        self.live = self._module('live_watch').LiveWatch(resolve=self.Resolve, watcher=self._watch, frame=lambda: absTime.frame)
        self.api = self._module('host_api').HostAPI(
            bootstrap=bootstrap, resolve=self.Resolve, choices=self.Choices, save_project=lambda: project.save(),
            applied=self.live.applied, identity=lambda: {'file': project.name, 'build': app.build}, textures=self.Texture)
        self.textures = {}
        self.queue = self._module('host_requests').HostRequests()
        editor.http.connect(self.queue)
        panel = self.ownerComp.par.Remotepanel.eval()
        editor.http.preview_port = int(panel.par.Port.eval()) if panel else None
        # Discovery happens on connection, never on an idle frame or child cook.
        self.families = {comp.id: comp for comp in op('/').findChildren(tags=[GRAPE_OP_TAG]) if not self._template(comp)}
        self._status('Ready', registered=len(self.families), version=editor.snapshot.version)

    def Texture(self, name):
        """A shared default image as a JPEG, from the main component's Samples (Refactor.58; the human placed a
        copy there): made once per connection. Only the images; the plain colours are drawn by the editor.
        公用預設圖（JPEG），來自主組件裡的 Samples（人類放的一份）；每次連線只做一次。只有圖片，純色由編輯器畫。"""
        index = {'grape': 1, 'banana': 2, 'jellybeans': 3}.get(name)
        samples = self.ownerComp.parent.GrapeHost.op('Samples')
        if index is None or samples is None:
            return None
        if name not in self.textures:
            self.textures[name] = bytes(samples.op('out' + str(index)).saveByteArray('.jpg', quality=.8))
        return self.textures[name]

    def Disconnect(self):
        if self.live:
            self.live.close()
            self.live = None
        if self.editor and self.editor.http and self.editor.http.host_requests is self.queue:
            self.editor.http.connect(None)
        if self.queue:
            self.queue.close()
        self.queue = self.api = self.editor = None

    def Drain(self):
        if self.queue:
            # Empty queue does not read Families, Parameters, Library or state.
            self.queue.drain(self.api.dispatch)
        if self.live and self.editor and self.editor.http:
            # Nothing arrived and no editor connected: nothing is read. 沒收到、也沒人連著：什麼都不讀。
            events = self.editor.http.live.drain()
            if events or self.live.watched:
                self.live.drain(events)

    def _watch(self, paths):
        """What the Parameter Execute DAT `uniform_watch` watches: the GLSL OPs of Grape OPs with a
        connected editor; nothing when none is connected. 只監看有編輯器連著的 Grape OP 的 GLSL OP。"""
        watcher = self.ownerComp.op('uniform_watch')
        if watcher is not None:
            watcher.par.op = ' '.join(paths)
            watcher.par.active = bool(paths)

    def LiveValuesChanged(self, changes):
        if self.live:
            self.live.values_changed(changes)

    def LiveStateChanged(self, par):
        if self.live:
            self.live.changed(par)

    def Diagnostics(self):
        result = self.queue.outcomes() if self.queue else []
        self._status('Ready' if self.queue else 'Disconnected', recent=result)
        return result

    def Adapter(self, comp):
        nxt = self._module('next_family')
        # Preset Uniform expressions come from the editor bundle (Q61), never from a request.
        # 預設 Uniform 的 expression 來自網頁資產，不來自請求。
        presets = {preset['entry']: preset['expression'] for preset in (self.bootstrap or {}).get('uniformPresets', [])}
        return nxt.NextFamily(comp, validation_area=self.ownerComp.op('validation'), presets=presets)

    def Resolve(self, target_id):
        # TD is the registry (Q32): search by tag on demand, so new copies are found without registering.
        # TD 本身就是名冊：需要時用 tag 搜尋，新複本不必先登記也找得到。
        matches = [comp for comp in op('/').findChildren(tags=[GRAPE_OP_TAG])
                   if not self._template(comp) and self._module('next_family').identity(comp) == target_id]
        if len(matches) > 1:
            raise RuntimeError('Duplicate Family identity detected; no copy was selected or changed. Review the copies before editing.')
        return self.Adapter(matches[0]) if matches else None

    def Register(self, comp):
        if GRAPE_OP_TAG not in comp.tags or self._template(comp):
            raise RuntimeError('This is not a Grape OP.')
        self.Adapter(comp).state()
        self.families[comp.id] = comp
        return self._module('next_family').identity(comp)

    def Choices(self):
        rows = [{'id': self._module('next_family').identity(comp), 'path': comp.path, 'kind': 'top'}
                for comp in op('/').findChildren(tags=[GRAPE_OP_TAG]) if not self._template(comp)]
        return {'shaders': rows}

    def Open(self, comp, app=False):
        """Open the editor for a Grape OP. app=True: an app window when the default browser
        supports it (editor_launch.py: Chrome or Edge on Windows), else the normal browser (Q45).
        app=True 時能開 App 視窗就開（Windows 的 Chrome／Edge），否則一般瀏覽器。"""
        if not self.editor or not self.editor.http:
            raise RuntimeError('Editor Service is stopped; native Shader operation is unaffected.')
        target_id = self.Register(comp)
        self.Resolve(target_id)
        address = 'http://127.0.0.1:' + str(self.editor.http.port) + '/shader/' + target_id + '/'
        launcher = self.ownerComp.op('editor_launch')
        if app and launcher is not None:
            launcher.module.open_editor(address, ui.viewFile,
                lambda callback, milliseconds: run('args[0]()', callback, delayMilliSeconds=milliseconds))
        else:
            ui.viewFile(address)
        return address

    def onInitTD(self):
        editor = self.ownerComp.par.Editorservice.eval()
        if editor and editor.ext.EditorServiceExt.http:
            self.Connect(editor.ext.EditorServiceExt)

    def onDestroyTD(self):
        self.Disconnect()
