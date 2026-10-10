"""Editing coordinator. Native Families never need this object to render."""
import json
import time
from hashlib import sha256

import numpy as np




class GrapeManagerExt:
    def __init__(self, ownerComp):
        self.ownerComp = ownerComp
        self.queue = None
        self.api = None
        self.editor = None
        self.bootstrap = None
        self.live = None  # LiveWatch while connected (Uniform D2) 連線期間的即時值監看

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
            applied=self.live.applied, identity=lambda: {'file': project.name, 'folder': project.folder, 'build': app.build, 'version': editor.snapshot.version},
            textures=self.Texture,
            capture=self.Capture, saved=lambda family: self.SavedState(family.comp))
        self.queue = self._module('host_requests').HostRequests()
        editor.http.connect(self.queue)
        panel = self.ownerComp.par.Remotepanel.eval()
        editor.http.preview_port = int(panel.par.Port.eval()) if panel else None
        # Discovery happens on connection, never on an idle frame or child cook.
        self._status('Ready', registered=len(self.GrapeOps()), version=editor.snapshot.version)

    def Texture(self, name):
        """A shared default image, from the main component's Samples (Refactor.58; the human placed a copy there).
        The host asks once per connection. Whatever Samples has an output labelled `name` for is served, so an image added
        to Samples later needs no change here (Refactor.67, D7: no list of names); the editor still draws plain colours
        itself. 公用預設圖，來自主組件裡的 Samples；宿主每次連線只問一次。Samples 有 label 是這個名字的出口就給，之後在
        Samples 加的圖不用改這裡（D7：不寫名單）；純色仍由編輯器自己畫。"""
        samples = self.ownerComp.parent.GrapeHost.op('Samples')
        nxt = self._module('next_family')
        if samples is None or name not in nxt.sample_labels(samples):
            return None
        # Found by the out TOP's label (Refactor.58.9). 照 out TOP 的 label 找。
        try:
            index = nxt.sample_output(samples, name)
        except LookupError as error:
            # Samples is broken (no or two outs with this label): said as it is (Refactor.62). Samples 壞了：照實說。
            raise nxt.TextureUnavailable(str(error)) from None
        return self.Capture(samples.outputConnectors[index].outOP)

    def Capture(self, top):
        """A TOP's pixels, small: the preview TOP scales it on the GPU (no larger than 320 px) and lets go of it
        again. Only reading here (about 2 ms); the PNG is made on the editor service's thread (Refactor.58).
        TD textures are premultiplied, so the colour is divided back for the browser; numpy rows run bottom up.
        一個 TOP 縮小後的像素：預覽 TOP 在 GPU 上縮到 320 px 以內、讀完就放開。這裡只讀（約 2 ms），PNG 在編輯服務的
        執行緒壓。TD 的貼圖是預乘 Alpha，所以顏色除回去給瀏覽器；numpy 的列由下往上。"""
        preview = self.ownerComp.op('texture_preview')
        preview.par.top = top
        try:
            pixels = preview.numpyArray()
        finally:
            preview.par.top = ''
        alpha = pixels[..., 3:4]
        rgb = np.divide(pixels[..., :3], alpha, out=np.zeros_like(pixels[..., :3]), where=alpha > 0)
        image = np.concatenate([rgb, alpha], axis=2)[::-1]
        height, width = image.shape[:2]
        return width, height, (np.clip(image, 0, 1) * 255 + .5).astype(np.uint8).tobytes()

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

    def _watch(self, paths, comps=()):
        """What the watchers watch, only Grape OPs with a connected editor, nothing when none is: `uniform_watch` their
        GLSL OPs' parameters, `wire_watch` their input wiring (Refactor.60).
        監看的範圍只有連著編輯器的 Grape OP、沒人連就不看：uniform_watch 看 GLSL OP 的參數，wire_watch 看接線。"""
        for name, ops in (('uniform_watch', paths), ('wire_watch', comps)):
            watcher = self.ownerComp.op(name)
            if watcher is not None:
                watcher.par.op = ' '.join(ops)
                watcher.par.active = bool(ops)

    def LiveValuesChanged(self, changes):
        if self.live:
            self.live.values_changed(changes)

    def LiveStateChanged(self, par):
        if self.live:
            self.live.changed(par)

    def LiveWiresChanged(self, comp):
        if self.live:
            self.live.wires_changed(comp)

    def ProjectSaving(self):
        """Project Pre Save (`save_watch`, Refactor.73): which revision of each Grape OP goes into the file, and when, kept in
        the Manager's storage so it is saved with the project; the editor shows how far it is behind (human 2026-10-10: the
        editor never saves the project by itself). A Grape OP TD-Grape cannot read keeps no revision.
        存檔前：每個 Grape OP 哪一版存進檔案、什麼時候，放在管理器的 storage、跟著專案存；編輯器據此顯示落後多少（人類：
        編輯器不會自己存專案）。讀不了的 Grape OP 不記版號。"""
        revisions = {}
        for comp in self.GrapeOps():
            try:
                revisions[self._module('grape_op_identity').identity(comp)] = self.Adapter(comp).state()['revision']
            except self._module('next_family').Refused:
                continue
        self.ownerComp.store('projectSaved', {'time': int(time.time() * 1000), 'revisions': revisions})

    def SavedState(self, comp):
        """The project's last save as one Grape OP sees it: the revision it saved (None before the first save Refactor.73
        saw) and when (ms). 專案上次存檔，從一個 Grape OP 看：存了哪一版（R.73 之後第一次存檔前是 None）、什麼時候（毫秒）。"""
        saved = self.ownerComp.fetch('projectSaved', None, search=False) or {}
        when = saved.get('time')
        if when is None:
            # Not recorded yet: TD's own time of the last save (e.g. 'Sat Oct 10 20:29:50 2026'). 還沒記過：TD 自己的上次存檔時間。
            try:
                when = int(time.mktime(time.strptime(project.saveTime, '%a %b %d %H:%M:%S %Y')) * 1000)
            except (ValueError, TypeError):
                when = None
        return {'revision': saved.get('revisions', {}).get(self._module('grape_op_identity').identity(comp)), 'time': when}

    def ProjectSaved(self):
        """Project Post Save (`save_watch`, Refactor.71, 73): connected editors are told, with the revision each one's Grape
        OP saved. 存檔後：告訴連著的編輯器，附上它的 Grape OP 存的是哪一版。"""
        if self.live:
            self.live.saved(project.name, lambda comp: self.SavedState(comp))

    def Diagnostics(self):
        result = self.queue.outcomes() if self.queue else []
        self._status('Ready' if self.queue else 'Disconnected', recent=result)
        return result

    def Adapter(self, comp):
        nxt = self._module('next_family')
        # Preset Uniform expressions come from the editor bundle (Q61), never from a request.
        # 預設 Uniform 的 expression 來自網頁資產，不來自請求。
        presets = {preset['entry']: preset['expression'] for preset in (self.bootstrap or {}).get('uniformPresets', [])}
        return nxt.NextFamily(comp, presets=presets)

    def Resolve(self, target_id):
        # TD is the registry (Q32): search by tag on demand, so new copies are found without registering.
        # TD 本身就是名冊：需要時用 tag 搜尋，新複本不必先登記也找得到。
        matches = [comp for comp in self.GrapeOps() if self._module('grape_op_identity').identity(comp) == target_id]
        if len(matches) > 1:
            raise self._module('next_family').Refused('More than one Grape OP has this Grape ID; nothing was selected or changed. '
                                                      'Review the copies before editing.')
        return self.Adapter(matches[0]) if matches else None

    def Register(self, comp):
        if self._module('grape_op_identity').TAG not in comp.tags or self._module('grape_op_identity').in_template(comp):
            raise self._module('next_family').Refused('This is not a Grape OP.')
        self.Adapter(comp).state()
        return self._module('grape_op_identity').identity(comp)

    def GrapeOps(self):
        """Every Grape OP in the project now, templates aside: searched when asked, never kept, so copies and deletions are
        always seen (Q32; Refactor.62 dropped a stale registry). 專案現在所有的 Grape OP（範本除外）：要用時才找、不留名冊。"""
        return [comp for comp in op('/').findChildren(tags=[self._module('grape_op_identity').TAG])
                if not self._module('grape_op_identity').in_template(comp)]

    def Choices(self):
        rows = [{'id': self._module('grape_op_identity').identity(comp), 'path': comp.path, 'kind': 'top'} for comp in self.GrapeOps()]
        return {'shaders': rows}

    def Open(self, comp, app=False):
        """Open the editor for a Grape OP. app=True: an app window when the default browser
        supports it (editor_launch.py: Chrome or Edge on Windows), else the normal browser (Q45).
        app=True 時能開 App 視窗就開（Windows 的 Chrome／Edge），否則一般瀏覽器。"""
        if not self.editor or not self.editor.http:
            raise self._module('next_family').Refused('Editor Service is stopped; native Shader operation is unaffected.')
        target_id = self.Register(comp)
        self.Resolve(target_id)  # refuses when a copy shares the ID; the result is not needed 有複本共用 ID 時拒絕；結果不需要
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
