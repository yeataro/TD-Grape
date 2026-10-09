"""Live Uniform values between TD and connected editors (Uniform D2, Refactor.48; design-interview
Q53, Q58, Q60; work/in-place-refactor-design/uniform-d.md B).

- Editor -> TD: the latest value of each Uniform per frame per connection, written by NextFamily.live
  (only where Grape may, only what changed in the editor).
- TD -> editor: values are data — one bundle per Grape OP per frame, tagged with TD's frame, carrying
  the constant and bound components that changed, read with eval(). States are messages — sent when a
  connection opens and when a mode, expression, export or name changes (or a program is applied).
- One Parameter Execute DAT in the Manager watches only the GLSL OPs of Grape OPs with a connected
  editor (its `op` list); with no editor connected it watches nothing.

即時 Uniform 值：編輯器→TD 每條連線每格每個 Uniform 只寫最新的；TD→編輯器，數值是資料（每個 Grape OP 每格一包、
帶 TD 影格、只有固定值與 Bind 的分量、用 eval() 讀），狀態是訊息（連上時、模式／expression／export／名字改變時、
套用時送）。Manager 裡一個 Parameter Execute DAT 只監看有編輯器連著的 Grape OP 的 GLSL OP；沒人連就不看。
"""
import json

import uniform_writer


class LiveWatch:
    def __init__(self, *, resolve, watcher, frame):
        """resolve(target_id) -> NextFamily or None; watcher(paths, comps): set what the watchers watch, the GLSL OPs'
        parameters and the Grape OPs' wiring; frame() -> TD's frame. resolve 找 Grape OP；watcher 設定監看的 GLSL OP 參數與
        Grape OP 接線；frame 是 TD 影格。"""
        self.resolve, self.watcher, self.frame = resolve, watcher, frame
        # Keyed by the Grape OP's TD id (Refactor.62): a rename keeps it, so live values and states go on while HTTP, which
        # finds the OP by Grape ID, does too. 以 Grape OP 的 TD id 為鍵：改名不變，即時值與狀態和 HTTP 一樣繼續。
        self.links = {}    # connection -> Grape OP id 連線 → Grape OP
        self.watched = {}  # Grape OP id -> entry 監看中的 Grape OP

    def drain(self, events):
        """What arrived from the editors since the last frame. 上一格之後收到的。"""
        self._follow()
        latest = {}
        for kind, connection, text in events:
            if kind == 'open':
                self._open(connection)
            elif kind == 'close':
                self._close(connection)
            elif connection in self.links:
                try:
                    message = json.loads(text)
                except ValueError:
                    continue
                if isinstance(message, dict) and message.get('type') == 'value':
                    latest[(connection, message.get('id'))] = message
        for (connection, _), message in latest.items():
            entry = self.watched.get(self.links.get(connection))
            if entry is None:
                continue
            try:
                entry['family'].live({'format': entry['family'].FORMAT, 'id': message.get('id'), 'value': message.get('value'),
                                      'session': connection.session, 'seq': message.get('seq')})
            except Exception as error:
                if getattr(error, 'code', None) is None:
                    raise  # a failure, not a refusal (Refactor.62) 是失敗、不是拒絕
                # a value TD refuses is dropped; the normal save follows 被拒絕的值丟掉，一般送出會跟上
        self.flush()

    def _open(self, connection):
        family = self.resolve(connection.target)
        if family is None:
            connection.send(json.dumps({'type': 'error', 'code': 'target_unavailable'}))
            connection.close()
            return
        key = family.comp.id
        entry = self.watched.get(key)
        if entry is None:
            entry = self.watched[key] = {'family': family, 'connections': set(), 'index': {}, 'dirty': True,
                                         'path': family.comp.path}
            self._watch()
        entry['connections'].add(connection)
        self.links[connection] = key
        entry['dirty'] = True  # a new connection gets the whole state first 新連線先拿到全部現況

    def _close(self, connection):
        key = self.links.pop(connection, None)
        entry = self.watched.get(key)
        if entry is None:
            return
        entry['connections'].discard(connection)
        entry['family'].forget(connection.session)
        if not entry['connections']:
            del self.watched[key]
            self._watch()

    def _follow(self):
        """Grape OPs deleted while watched are let go; renamed ones are watched under their new path (the watchers hold
        paths). Once a frame, before anything else. 監看中被刪的 Grape OP 放掉；改名的照新路徑監看（監看 DAT 存的是路徑）。"""
        changed = False
        for key, entry in list(self.watched.items()):
            comp = entry['family'].comp
            if not comp.valid:
                for connection in entry['connections']:
                    self.links.pop(connection, None)
                    connection.close()
                del self.watched[key]
                changed = True
            elif comp.path != entry['path']:
                entry['path'] = comp.path
                changed = True
        if changed:
            self._watch()

    def _watch(self):
        paths, comps = [], []
        for entry in self.watched.values():
            comps.append(entry['family'].comp.path)
            try:
                paths.append(entry['family'].glsl().path)
            except uniform_writer.Refused:
                pass  # no GLSL OP to watch: only its wiring is 沒有 GLSL OP 可看：只看接線
        self.watcher(paths, comps)

    def _entry_of(self, par):
        try:
            return self.watched.get(par.owner.parent().id)
        except AttributeError:
            return None

    def applied(self, family):
        """A program was applied: Uniforms may be new or renamed. 套用了新程式：Uniform 可能新增或改名。"""
        entry = self.watched.get(family.comp.id)
        if entry is not None:
            entry['dirty'] = True
            self.flush()
        # Inputs may have changed too (a default image, an input added): asked again, no new snapshots (Refactor.61.5).
        # 輸入也可能變了（預設圖、增減輸入）：再問一次，不重拍快照。
        self._inputs(family.comp, retake=False)

    def changed(self, par):
        """A mode, expression or export changed: a state message follows. 模式等改變：之後送狀態。"""
        entry = self._entry_of(par)
        if entry is not None:
            entry['dirty'] = True

    def flush(self):
        """Send the state of Grape OPs whose state changed. 送出狀態有變的 Grape OP 的現況。"""
        for entry in self.watched.values():
            if not entry['dirty']:
                continue
            entry['dirty'] = False
            family = entry['family']
            try:
                uniforms = family.running_uniforms()
                shader = family.glsl()
                entry['index'] = self._index(shader, uniforms)
                text = json.dumps({'type': 'state', 'frame': self.frame(), 'uniforms': uniform_writer.states(shader, uniforms)})
            except uniform_writer.Refused:
                continue  # no GLSL OP or a damaged program: nothing to tell yet (D3, open) 沒有 GLSL OP 或程式壞了：還沒有可說的
            for connection in entry['connections']:
                connection.send(text)

    @staticmethod
    def _index(shader, uniforms):
        """Parameter name -> (Uniform ID, component); names map to None (a rename means a new state).
        參數名稱 → （Uniform ID、第幾個分量）；名字欄對到 None（改名要送新的狀態）。"""
        index = {}
        for uniform in uniforms:
            page = uniform_writer.page_of(uniform)
            row = uniform_writer.find_row(shader, page, uniform['name'])
            if row is None:
                continue
            index['%s%dname' % (page, row)] = None
            for component, suffix in enumerate(uniform_writer.PAGES[page][:uniform_writer.COUNTS[uniform['type']]]):
                index['%s%d%s' % (page, row, suffix)] = (uniform['id'], component)
        return index

    def values_changed(self, changes):
        """End of frame (Parameter Execute onValuesChanged): one bundle per Grape OP. Expression and
        Export components are skipped (only their state is Grape's business, Q60).
        每格結束：每個 Grape OP 一包；Expression、Export 的分量略過（只送狀態）。"""
        bundles = {}
        for change in changes:
            par = change.par
            entry = self._entry_of(par)
            if entry is None:
                continue
            if par.name not in entry['index']:
                if par.name.endswith('name'):
                    entry['dirty'] = True  # a row got a Uniform's name in TD 某列在 TD 被改成某個 Uniform 的名字
                continue
            target = entry['index'][par.name]
            if target is None:
                entry['dirty'] = True
                continue
            if uniform_writer.mode_name(par) not in ('CONSTANT', 'BIND'):
                continue
            ident, component = target
            values = bundles.setdefault(id(entry), (entry, {}))[1]
            values.setdefault(ident, {})[component] = par.eval()
        if bundles:
            frame = self.frame()
            for entry, values in bundles.values():
                text = json.dumps({'type': 'values', 'frame': frame,
                                   'values': {ident: [parts.get(i) for i in range(max(parts) + 1)] for ident, parts in values.items()}})
                for connection in entry['connections']:
                    connection.send(text, replaceable=True)
        self.flush()

    def wires_changed(self, comp):
        """A watched Grape OP was rewired in TD (OP Execute onWireChange, one call a frame at most): its editors ask what
        is wired in now (Refactor.60). Only a nudge; the editor reads the inputs over HTTP.
        TD 上重新接線（每格最多一次）：通知它的編輯器去問現在接了什麼。只是提醒；編輯器經 HTTP 讀。
        A watched Grape OP that is deleted is reported with None (seen in TD 2025.33230, Refactor.63.6.5); deletion is
        _follow's, so it is ignored here. 監看中的 Grape OP 被刪掉時 TD 傳 None（實測）；刪除由 _follow 處理，這裡略過。"""
        if comp is None:
            return
        self._inputs(comp, retake=True)

    def _inputs(self, comp, retake):
        """Tell a Grape OP's editors to ask about its inputs; `retake` also takes new snapshots.
        通知 Grape OP 的編輯器再問輸入；retake 時也重拍快照。"""
        entry = self.watched.get(comp.id)
        if entry is None:
            return
        text = json.dumps({'type': 'inputs', 'frame': self.frame(), 'retake': retake})
        for connection in entry['connections']:
            connection.send(text, replaceable=True)

    def close(self):
        for connection in list(self.links):
            connection.close()
        self.links.clear()
        self.watched.clear()
        self.watcher([], [])
