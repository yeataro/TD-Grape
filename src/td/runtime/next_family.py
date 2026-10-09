"""Grape OPs and what TD does with the editor's requests (design-interview Q38, Q40, Q48).

TD never parses, validates or re-serializes the graph: the document is opaque text,
checked only by length and checksum and returned as received. TD checks the envelope
(revision, target, build) and what it executes itself (GLSL, bindings).
Grape OP：TD 不解析、不檢查、不重新序列化圖；圖是不透明文字，只核對長度與
校驗值、原樣保存與交回。TD 只核對信封與自己要執行的東西（GLSL、綁定）。
"""
from hashlib import sha256
import json
import math
import re
import uuid

import uniform_writer
from td_text import english

FORMAT = 'grape-next-1'  # the editor <-> TD request format
META_FORMAT = 'grape-meta-2'  # what graph_meta stores (Refactor.34)
PROTOCOL = 'grape.top.ts.1'  # the frontend compiler protocol this build speaks
# Size limits, in UTF-8 bytes. All are ours, not TD's, and none has a measured basis yet: temporary
# safety nets until real limits are measured (CURRENT). They are separate things that happen to
# share a number: the graph limit comes from the legacy product; the GLSL limit copied it when the
# first TD-side receiver was written (2026-10-04); legacy had no GLSL limit (TD generated the GLSL).
# 大小上限（UTF-8 位元組）：都是我們自己的、不是 TD 的，也都還沒有實測依據。圖與 GLSL 是兩件事，
# 數字相同只因為當初 GLSL 照抄了圖的上限（舊產品沒有 GLSL 上限）。
# Why the graph has a limit (measured 2026-10-09, TD 2025.33230): TD handles every edit on its main
# thread, and reading the request, the checksum and writing the graph DAT cost about 3.3 ms per MB
# per pass (about 2 ms at 512 KB, about one 60 fps frame at 5 MB). 512,000 keeps an edit to a few ms.
# The number itself is inherited, not derived; kept because it is hard to reach (human 2026-10-09).
# 為什麼要有圖的上限（10-09 實測）：TD 在主執行緒處理每次編輯，讀請求、校驗、寫 DAT 約每 MB 3.3 ms；
# 512 KB 約 2 ms。數字本身是沿用的；很難碰到，先維持（人類 10-09）。
MAX_GRAPH_BYTES = 512000     # the graph text; the core keeps a copy until we report it (config.ts documentBytes, convention 5)
# Why GLSL has a limit (measured 2026-10-09, TD 2025.33230): TD has none (it compiled a 2 MB source),
# but compiling real code blocks TD's main thread about 2.2 ms per KB (50 KB 104 ms, 150 KB 340 ms),
# and an apply compiles twice (validation, then the Grape OP). 512,000 still allows a stall of
# seconds; the number is inherited and should be revisited with the subgraph-expansion measurements.
# GLSL 上限的理由（10-09 實測）：TD 本身沒有上限（2 MB 也能編）；但實際程式碼編譯時 TD 主執行緒
# 約每 KB 卡 2.2 ms，送出一次編兩次。512 KB 仍可能卡數秒，數字是沿用的，待子圖展開實測時重訂。
MAX_GLSL_BYTES = 512000      # the pixel shader source
MAX_RUNTIME_BYTES = 1024 * 1024  # the whole execution part (GLSL + bindings)

# TOP texture inputs (Refactor.43; texture-inputs.md). Each input of the graph is an In TOP in the
# Grape OP: listed in the GLSL TOP's TOPs list in the graph's order (that order is sTD2DInputs[i]),
# named in1, in2… as TD names a new In TOP (Refactor.60.6, human 2026-10-10), lined up under in1, top to bottom (that order is the Grape OP's input connectors). When nothing is
# connected from outside, the In TOP passes what is wired into it: its default image from Samples.
# TOP 貼圖輸入：圖裡每個輸入是 Grape OP 裡的一個 In TOP；照圖的順序列在 GLSL TOP 的 TOPs 清單
# （＝sTD2DInputs[i]），照 TD 新增 In TOP 的命名叫 in1、in2…（人類），在 in1 下面由上往下排（＝Grape OP 的輸入接口順序）。外面沒接時，
# In TOP 輸出接在它自己身上的東西：Samples 的預設圖。
# Which Samples output is which image is told by its out TOP's label, the same names as the graph's defaultTexture
# (Refactor.58.9, human 2026-10-09, Q66): the OPs inside Samples can change freely. Samples in a Grape OP is a Clone of
# the main component's. Samples 的哪個出口是哪張圖，由 out TOP 的 label 決定，名字同圖裡的 defaultTexture（人類，Q66）：
# Samples 裡的 OP 可以隨意換。Grape OP 裡的 Samples 是主組件那份的 Clone。
# `none` (Refactor.60): the In TOP gets no default and passes what TD does with nothing connected (transparent), the
# default for a new input (human 2026-10-10). The TOP chosen on Samples (`custom`) is gone: wire it into the input instead.
# none：In TOP 不接預設圖，就是 TD 沒接時的樣子（透明），新增輸入的預設（人類）。Samples 上自選 TOP 已拿掉：改接進輸入。
DEFAULT_TEXTURES = ('none', 'grape', 'banana', 'jellybeans', 'white', 'black', 'normal')
INPUT_STORE = 'grapeInput'  # storage key on an In TOP: the ID of the input it belongs to
INPUT_X, INPUT_Y, INPUT_STEP = -200, -125, 100

# Uniforms (Uniform D1, Refactor.47): written straight onto the GLSL OP by uniform_writer.py, keeping
# whatever drives each component in TD (design-interview Q55–Q61). A preset Uniform (`entry`) gets its
# expression from the editor bundle's table, which the Manager reads (Q61) — never from a request.
# Uniform 直接寫到 GLSL OP（uniform_writer.py），保留 TD 上的驅動；預設 Uniform 的 expression 來自網頁資產的表。
UNIFORM_TYPES = uniform_writer.COUNTS
COLOR_TYPES = ('vec3', 'vec4')


class BuildChanged(RuntimeError):
    """The editor page was built for another TD-Grape build (Refactor.52). 編輯頁與 TD-Grape 的建置不同。"""
    code = 'build_changed'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(text):
    return sha256(text.encode('utf-8')).hexdigest()


def sample_output(samples, name):
    """The index of the Samples output labelled `name`; LookupError when there is none or more than one (Refactor.58.9).
    Samples 裡 label 是 name 的出口編號；沒有或不只一個時 LookupError。"""
    found = [i for i, connector in enumerate(samples.outputConnectors)
             if connector.outOP is not None and connector.outOP.par.label.eval() == name]
    if len(found) != 1:
        raise LookupError('{} has {} outputs labelled "{}" (needs exactly one).'.format(samples.path, len(found), name))
    return found[0]


def notify(comp, message):
    """Show a notable state or error on TD's status bar (human: use ui.status in the product);
    the status DAT keeps the record. 值得注意的狀態與錯誤顯示在 TD 狀態列；status DAT 留紀錄。"""
    try:
        ui.status = 'Grape ' + comp.name + ': ' + message
    except Exception:
        pass


def identity(comp):
    """The Grape OP's ID: its read-only Grapeid parameter (Q32)."""
    par = getattr(comp.par, 'Grapeid', None)
    return par.eval() if par is not None else ''


def read_runtime(text, *, catalog_hash, presets=()):
    """The execution part (GLSL + bindings) is TD's own input, so TD reads it."""
    require(isinstance(text, str) and 0 < len(text.encode('utf-8')) <= MAX_RUNTIME_BYTES, 'invalid runtime part')
    compiled = json.loads(text)
    require(isinstance(compiled, dict) and compiled.get('vertex') == ''
            and isinstance(compiled.get('pixel'), str), 'invalid TOP source')
    require(0 < len(compiled['pixel'].encode('utf-8')) <= MAX_GLSL_BYTES, 'GLSL is empty or over 512,000 bytes')
    bindings = compiled.get('bindings')
    require(isinstance(bindings, list), 'invalid binding table')
    seen, names = set(), set()
    for entry in bindings:
        require(isinstance(entry, dict), 'invalid binding table')
        kind, ident, name = entry.get('kind'), entry.get('id'), entry.get('name')
        # Other kinds arrive with their rounds (Spec constants…). 其他種類等各自那一輪。
        require(kind in ('topInput', 'uniform'), 'This kind of binding is not supported by this TD-Grape yet: ' + str(kind))
        require(isinstance(ident, str) and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', ident) and ident not in seen,
                'invalid binding ID')
        seen.add(ident)
        if kind == 'topInput':
            require(isinstance(name, str) and 0 < len(name) <= 48 and entry.get('defaultTexture') in DEFAULT_TEXTURES,
                    'invalid texture input')
            continue
        require(isinstance(name, str) and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,47}', name) and name not in names
                and uniform_value_ok(entry.get('type'), entry.get('value'))
                and entry.get('color', False) in (True, False) and (entry.get('color') is not True or entry['type'] in COLOR_TYPES)
                and (entry.get('entry') is None or entry['entry'] in presets),
                'invalid Uniform')
        names.add(name)
    return compiled


def uniform_value_ok(kind_type, value):
    """A finite number (float) or a list of them (vec2-4). 有限數字（float）或其清單（vec2～4）。"""
    count = UNIFORM_TYPES.get(kind_type)
    values = [value] if count == 1 else value
    return (count is not None and isinstance(values, list) and len(values) == count
            and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in values))


# Live values (Uniform C, Refactor.46; design-interview Q53), per Grape OP: the running program's
# Uniforms (parsed once per program) and the last sequence number per editor page and Uniform.
# 即時值：每個 Grape OP 記住目前程式的 Uniform（每個程式只解析一次）與每個編輯頁、每個 Uniform 的最後序號。
LIVE = {}


def uniforms_of(compiled):
    """The Uniforms of a program, in the graph's order. 程式裡的 Uniform。"""
    return [entry for entry in compiled.get('bindings') or [] if entry.get('kind') == 'uniform']


def texture_inputs(compiled):
    """The TOP texture inputs, in the graph's order. 圖裡的 TOP 貼圖輸入，照圖的順序。"""
    return [entry for entry in compiled['bindings'] if entry['kind'] == 'topInput']


def constant_mode():
    try:
        return ParMode.CONSTANT  # noqa: F821 (a TD global) TD 提供的全域名稱
    except NameError:
        return 'CONSTANT'


class NextFamily:
    """A Grape OP's stored work (design-interview Q38; grape-op-structure #4, #13):
    `graph` holds the graph text, the one copy, readable in TD; `graph_meta` holds what proves and
    runs it (revisions, checksums, ID, execution part) without the graph text; `status` is this
    Grape OP's state for people. TD never parses the graph.
    The execution part only changes when TD compiles it, so it is always the last known good.
    While the graph has moved past it (code generation or TD compilation failed), runtime.document
    keeps the graph that produced it; otherwise None (Refactor.34: no second copy of GLSL or graph).
    圖的正本在 graph（唯一一份）；graph_meta 放證明與執行用的資料，不放圖的文字。執行部分只在 TD
    編譯成功時才換，所以它就是最後成功版；圖往前走而執行部分停住時，runtime.document 才留那時的圖。"""
    FORMAT = FORMAT
    PROTOCOL = PROTOCOL

    def __init__(self, comp, *, validation_area=None, presets=None):
        self.comp = comp
        self.validation_area = validation_area
        # entry -> TD expression, read by the Manager from the editor bundle (Q61). 由 Manager 從網頁資產讀入。
        self.presets = presets or {}

    def target(self):
        return self.comp

    def input_sources(self):
        """What is wired into each texture input from outside (Refactor.60): the OP feeding the Grape OP's input
        connector — the nearest one, a Null in between is what is named — or None when nothing is (the In TOP then
        passes its default). Read only when asked. With the In TOP's name (in1…), as TD labels the connector (Refactor.60.6).
        每個貼圖輸入從外面接了什麼：餵進接口的 OP（最近的那個）；沒接是 None（In TOP 就送預設圖）。只在被問時讀。附上 In TOP
        的名字（in1…），同 TD 標在接口上的。"""
        result = []
        for connector in self.comp.inputConnectors:
            top = connector.inOP
            ident = top.fetch(INPUT_STORE, None) if top is not None else None
            if ident is None:
                continue
            source = connector.connections[0].owner if connector.connections else None
            result.append({'id': ident, 'node': top.name, 'source': source.path if source is not None else None})
        return result

    def input_top(self, ident):
        """The In TOP of one texture input: what the shader actually receives, for a snapshot (Refactor.60).
        一個貼圖輸入的 In TOP：Shader 實際收到的，給快照用。"""
        for top in self.comp.ops('*'):
            if top.OPType == 'inTOP' and top.fetch(INPUT_STORE, None) == ident:
                return top
        raise LookupError('This Grape OP has no texture input with this ID.')

    def _refuse(self, message):
        notify(self.comp, message)
        self.status('refused', message)
        raise ValueError(message)

    def stored(self):
        meta_dat, graph_dat = self.comp.op('graph_meta'), self.comp.op('graph')
        if meta_dat is None or graph_dat is None:
            previous = self.comp.op('GrapeControls/document')
            if previous is not None and '"grape-next-1"' in previous.text[:40]:
                self._refuse('This Grape OP uses the previous Grape storage and needs migration.')
            # Old-format graphs are never opened or written here; an importer handles them later (Q40).
            # 舊格式的圖不在這裡開啟或寫入，之後由匯入器處理。
            self._refuse('This Grape OP holds an old-format graph. The editor does not open or change it; '
                         'an importer will handle old graphs later.')
        try:
            meta = json.loads(meta_dat.text)
        except ValueError:
            meta = None
        if isinstance(meta, dict) and meta.get('format') == 'grape-meta-1':
            self._refuse('This Grape OP uses the previous Grape storage and needs migration.')
        if not (isinstance(meta, dict) and meta.get('format') == META_FORMAT):
            self._refuse('graph_meta is damaged or not in the current format.')
        text = graph_dat.text
        document = meta.get('document')
        if not (isinstance(document, dict) and text and digest(text) == document.get('sha256')):
            # A hand edit or damage never takes effect silently. 手改或損壞不會悄悄生效。
            self._refuse('The graph DAT was changed by hand or is damaged, so the editor does not open it. '
                         'Undo the change in TD to open it again.')
        runtime = meta.get('runtime')
        if not (isinstance(runtime, dict) and isinstance(runtime.get('text'), str)
                and digest(runtime['text']) == runtime.get('sha256')
                and (runtime.get('document') is None) == (runtime.get('revision') == document.get('revision'))):
            self._refuse('The stored execution part is changed or damaged.')
        ident = identity(self.comp)
        if len(ident) != 32:
            self._refuse('This Grape OP has no Grape ID yet.')
        if meta.get('targetId') != ident:
            # A new copy, a fresh template or a regenerated ID: the stored ID follows the parameter
            # (Q32). Only graph_meta changes; the graph and Shader are untouched.
            # 新複本、剛建立的範本或換過號：存的 ID 跟著參數走；只改 graph_meta，圖與 Shader 不動。
            previous = meta.get('targetId')
            meta['targetId'] = ident
            meta_dat.text = json.dumps(meta, ensure_ascii=False)
            self.status('identity-adopted', 'The stored graph now follows this Grape ID.', previousTargetId=previous)
        return meta, text

    def regenerate(self):
        """A new Grape ID, the same as the Grape OP's Regenerate ID button, asked by the editor when people
        decide two copies are different (Refactor.52, design-interview Q63). The graph and Shader stay;
        graph_meta follows the new ID. 編輯器要求換新 Grape ID（等同 Regenerate ID）；圖與 Shader 不動。"""
        self.stored()  # a damaged Grape OP is refused before anything changes 壞掉的先拒絕，什麼都不改
        ident = self.comp.op('GrapeControls/identity').module.assign(self.comp)
        notify(self.comp, 'took a new Grape ID from the editor.')
        self.stored()
        return ident

    def state(self):
        meta, text = self.stored()
        return {'revision': meta['document']['revision'], 'document': text,
                'runtimeRevision': meta['runtime']['revision'], 'targetId': meta['targetId']}

    def running_uniforms(self):
        """The Uniforms of the program TD runs now (last known good). 目前在跑的程式裡的 Uniform。"""
        runtime = json.loads(self.comp.op('graph_meta').text).get('runtime') or {}
        return uniforms_of(json.loads(runtime.get('text') or '{}'))

    def uniform_states(self):
        """Each running Uniform's components as TD has them (mode, value or what drives it), for the
        editor's display (Q56, Q60). 每個 Uniform 各分量在 TD 的現況，給編輯器顯示。"""
        return uniform_writer.states(self._shader(self.comp), self.running_uniforms())

    def status(self, phase, message, **details):
        data = self.comp.op('status')
        if data:
            data.text = json.dumps({'phase': phase, 'message': message,
                'targetId': identity(self.comp), **details}, ensure_ascii=False, indent=2)

    def _shader(self, comp):
        shader = comp.op('shader')
        if shader is None or shader.type != 'glsl':
            raise RuntimeError('This Grape OP does not contain a native GLSL TOP.')
        return shader

    def live(self, body):
        """A Uniform value while it changes (Uniform C, D1; Q41 3-4, Q53, Q56): written onto the GLSL OP
        where Grape may (constant components, or the master of a bound one), so it follows at once.
        Nothing is compiled or saved; the graph arrives later by apply. An old sequence number, or a
        Uniform the running program does not have yet (it arrives with the next apply), is skipped.
        改變中的 Uniform 值：只寫 Grape 能寫的分量（固定值、Bind 的 master），GLSL OP 立即更新；
        不編譯、不存圖。舊序號、或程式裡還沒有的 Uniform，略過。"""
        require(isinstance(body, dict) and body.get('format') == FORMAT, 'unsupported request format')
        ident, session, seq, value = body.get('id'), body.get('session'), body.get('seq'), body.get('value')
        require(isinstance(ident, str) and isinstance(session, str) and 0 < len(session) <= 64
                and isinstance(seq, int) and not isinstance(seq, bool) and seq >= 0, 'invalid live value')
        runtime = json.loads(self.comp.op('graph_meta').text).get('runtime') or {}
        known = LIVE.get(self.comp.path)
        if known is None or known['sha256'] != runtime.get('sha256'):
            bindings = json.loads(runtime.get('text') or '{}').get('bindings') or []
            # Sequence numbers outlive a program change: a late old value never wins. 序號跨程式保留：晚到的舊值不會蓋掉新的。
            known = {'sha256': runtime.get('sha256'), 'seq': known['seq'] if known else {},
                     'uniforms': uniforms_of({'bindings': bindings})}
            LIVE[self.comp.path] = known
        if seq <= known['seq'].get((session, ident), -1):
            return {'ok': True, 'applied': False, 'reason': 'stale'}
        known['seq'][(session, ident)] = seq
        target = next((u for u in known['uniforms'] if u.get('id') == ident), None)
        if target is None:
            return {'ok': True, 'applied': False, 'reason': 'not-running'}
        require(uniform_value_ok(target.get('type'), value), 'invalid live value')
        # Compared with the editor's previous value (the running program's, then the last live one), so
        # only what changed in the editor is written. 和編輯器的上一個值比，只寫在編輯器變了的分量。
        last = known.setdefault('last', {})
        before = last.get(ident, target['value'])
        last[ident] = value
        applied = uniform_writer.live(self._shader(self.comp), target, value, before)
        return {'ok': True, 'applied': applied}

    def _input_ids(self):
        """The input IDs the TOPs list holds now, in order. TOPs 清單現在的輸入 ID，照順序。"""
        ids = []
        for name in self._shader(self.comp).par.tops.val.split():
            target = self.comp.op(name)
            ids.append(target.fetch(INPUT_STORE, None, search=False) if target is not None else None)
        return ids

    def _write_uniforms(self, uniforms, previous):
        """Uniform rows on the GLSL OP (uniform_writer.py), after the GLSL compiled. Grape OPs from
        Refactor.44–46 have their binding table's Export turned off first, keeping what it drove.
        Returns notices for people. GLSL 編譯成功後寫 Uniform 列；R.44～46 的 Grape OP 先關掉綁定表的 Export。"""
        shader = self._shader(self.comp)
        uniform_writer.retire_export_table(self.comp, shader)
        return uniform_writer.apply(shader, uniforms, previous, self.presets, constant_mode())

    def _place_inputs(self, inputs):
        """Give every texture input an In TOP and list them in the TOPs list, so the new GLSL can
        compile. Returns (commit, rollback): commit removes In TOPs no input owns any more, names and
        lines up the rest and wires their default images; rollback undoes this step. External wires
        stay with their In TOP (a removed one loses its wire). An In TOP Grape did not make (no
        stored input ID) is left alone and is not in the TOPs list.
        讓每個貼圖輸入都有 In TOP、列進 TOPs 清單，新 GLSL 才編得過。回傳（確定、復原）：確定時刪掉
        沒有輸入擁有的 In TOP、命名排好其餘的並接上預設圖；復原則還原這一步。外面的線跟著 In TOP 走。
        不是 Grape 建的 In TOP（沒有記輸入 ID）不動，也不列進 TOPs 清單。"""
        comp, shader = self.comp, self._shader(self.comp)
        owned, leftovers = {}, []
        for child in comp.findChildren(type=inTOP, depth=1):
            ident = child.fetch(INPUT_STORE, None, search=False)
            if ident is None:
                continue
            if ident in owned:  # a copy of one Grape made 複製出來的重複者
                leftovers.append(child)
            else:
                owned[ident] = child
        chosen, created = [], []
        for entry in inputs:
            target = owned.pop(entry['id'], None)
            if target is None:
                target = comp.create(inTOP, 'in_new_' + uuid.uuid4().hex[:8])
                target.store(INPUT_STORE, entry['id'])
                created.append(target)
            chosen.append(target)
        leftovers.extend(owned.values())
        previous_tops = shader.par.tops.val
        shader.par.tops = ' '.join(t.name for t in chosen)

        def rollback():
            shader.par.tops = previous_tops
            for target in created:
                target.destroy()

        def commit():
            for target in leftovers:
                target.destroy()
            # Names follow the order as TD names In TOPs: in1, in2… (rename through free names first; Refactor.60.6).
            # 名稱照順序，同 TD 的 In TOP 命名 in1、in2…（先改成不會撞名的暫名）。
            for target in chosen:
                if target.name != 'in' + str(chosen.index(target) + 1):
                    target.name = 'in_move_' + uuid.uuid4().hex[:8]
            samples = comp.op('Samples')
            for i, (target, entry) in enumerate(zip(chosen, inputs)):
                if target.name != 'in' + str(i + 1) and comp.op('in' + str(i + 1)) is None:
                    target.name = 'in' + str(i + 1)
                target.nodeX, target.nodeY = INPUT_X, INPUT_Y - i * INPUT_STEP
                target.nodeWidth, target.nodeHeight = 130, 72
                # Its position in TD's own array, as the editor shows it (Refactor.58.1). 它在 TD 陣列裡的位置，同編輯器顯示的。
                target.par.label = 'sTD2DInputs[' + str(i) + ']'
                # Found by label; when Samples cannot say, the input is left without a default and TD's status bar says
                # so — the shader is applied all the same. 照 label 找；找不到時這個輸入不接預設圖、在狀態列說明，Shader 照常套用。
                if samples is None:
                    continue
                if entry['defaultTexture'] == 'none':  # TD's own "nothing connected" TD 自己的「沒接」
                    target.inputConnectors[0].disconnect()
                    continue
                try:
                    connector = sample_output(samples, entry['defaultTexture'])
                except LookupError as error:
                    target.inputConnectors[0].disconnect()
                    notify(comp, '{} has no default image: {}'.format(target.name, error))
                    continue
                target.inputConnectors[0].connect(samples.outputConnectors[connector])
            shader.par.tops = ' '.join(t.name for t in chosen)

        return commit, rollback

    def _verify_gpu(self, comp):
        shader = self._shader(comp)
        shader.cook(force=True)
        info = comp.op('compile_info')
        info.cook(force=True)
        message = info.text
        error = shader.errors()
        if error or 'ERROR:' in message or message.count('Compiled Successfully') < 2:
            raise RuntimeError((error + '\n' + message).strip() or 'TD has not confirmed Shader compilation.')
        return message

    def _validate(self, pixel, inputs=0):
        # A disposable compiler target; never a delivered Grape OP. It has as many inputs as the Grape
        # OP will have: GLSL that reads sTD2DInputs[i] only compiles when input i exists.
        # 丟棄式的編譯目標；輸入數量與 Grape OP 相同（讀 sTD2DInputs[i] 的 GLSL 要有第 i 個輸入才編得過）。
        comp = self.validation_area.create(baseCOMP, 'candidate_' + uuid.uuid4().hex[:12])
        try:
            comp.create(textDAT, 'pixel_shader').text = pixel
            stand_ins = [comp.create(constantTOP, 'in' + str(i + 1)).name for i in range(inputs)]
            shader = comp.create(glslTOP, 'shader')
            shader.par.tops = ' '.join(stand_ins)
            shader.par.pixeldat = 'pixel_shader'
            shader.par.glslversion = self._shader(self.comp).par.glslversion.eval()
            shader.par.outputresolution = 'custom'
            shader.par.resolutionw = 16
            shader.par.resolutionh = 16
            shader.par.format = 'rgba32float'
            comp.create(infoDAT, 'compile_info').par.op = 'shader'
            return self._verify_gpu(comp)
        finally:
            comp.destroy()

    def apply(self, body, *, catalog_hash):
        """Two parts (Q38 2-2): the execution part (GLSL + bindings) is applied as a pair and
        rolled back as a pair; the document part is stored as received. A failed code
        generation sends the document only: the running Shader stays the last known good."""
        meta, previous_text = self.stored()
        revision = meta['document']['revision']
        require(body.get('format') == FORMAT, 'unsupported request format')
        if body.get('revision') != revision:
            raise RuntimeError('Conflict: stale revision')
        require(body.get('targetId') == identity(self.comp), 'target mismatch')
        if body.get('catalogHash') != catalog_hash:
            raise BuildChanged('The editor page and TD-Grape come from different builds; reload the editor page.')
        text = body.get('document')
        require(isinstance(text, str) and 0 < len(text.encode('utf-8')) <= MAX_GRAPH_BYTES, 'graph text is empty or over 512,000 bytes')
        runtime_text = body.get('runtime')
        editor_version = body.get('editorVersion')
        if runtime_text is not None:
            # Shown as "Grape Editor Version" once this GLSL runs (Q45). 換上後顯示在 Grape 頁。
            require(isinstance(editor_version, str) and 0 < len(editor_version) <= 100, 'missing editor version')
        next_revision = revision + 1
        meta = dict(meta)
        meta['document'] = {'revision': next_revision, 'sha256': digest(text)}
        shader_updated, shader_error, notices = False, None, []
        if runtime_text is not None:
            compiled = read_runtime(runtime_text, catalog_hash=catalog_hash, presets=self.presets)
            inputs = texture_inputs(compiled)
            uniforms = uniforms_of(compiled)
            # What the last successful apply sent: values changed since then were changed in the editor
            # (Q57). 上次成功套用時送的：之後變的值就是在編輯器改的。
            # Refactor.45–46 built-in values count too, so their rows are removed. R.45～46 的內建值也算，好拿掉它們的列。
            previous_uniforms = [entry for entry in json.loads(meta['runtime']['text']).get('bindings') or []
                                 if entry.get('kind') in ('uniform', 'builtin')]
            uniform_writer.check_rows(self._shader(self.comp), uniforms, previous_uniforms)
            pixel = self.comp.op('pixel_shader')
            previous = pixel.text
            placed = None
            # The same program with the same inputs (e.g. only a Uniform value or a default image
            # changed): nothing to compile. 程式與輸入都相同（例如只改 Uniform 的值）：不需要編譯。
            same_program = pixel.text == compiled['pixel'] and self._input_ids() == [e['id'] for e in inputs]
            try:
                if not same_program:
                    self._validate(compiled['pixel'], len(inputs))
                # The inputs and the GLSL that reads them change together (Q38 2-2).
                # 輸入接口與讀它們的 GLSL 一起換。
                placed = self._place_inputs(inputs)
                if pixel.text != compiled['pixel']:
                    pixel.text = compiled['pixel']
                    shader_updated = True
                if not same_program:
                    self._verify_gpu(self.comp)
            except Exception as error:
                # The GLSL did not compile in TD: the Shader and its inputs stay the last known good,
                # and the graph is still saved below (Q38: only the execution part is all-or-nothing).
                # GLSL 在 TD 編譯失敗：Shader 與輸入接口停在最後成功版，圖照樣在下面存起來。
                pixel.text = previous
                if placed is not None:
                    placed[1]()
                shader_updated, shader_error = False, str(error)
            else:
                placed[0]()
                notices = self._write_uniforms(uniforms, previous_uniforms)
                meta['runtime'] = {'revision': next_revision, 'text': runtime_text,
                                   'sha256': digest(runtime_text), 'document': None,
                                   'editorVersion': editor_version}
        if meta['runtime']['revision'] != next_revision and meta['runtime'].get('document') is None:
            # The graph moves past the running program: keep that program's graph once.
            # 圖往前走、執行部分停住時，才留一份那時的圖。
            meta['runtime'] = dict(meta['runtime'], document=previous_text)
        graph_dat, meta_dat = self.comp.op('graph'), self.comp.op('graph_meta')
        before = graph_dat.text, meta_dat.text
        try:
            graph_dat.text = text  # stored as received; TD never re-serializes it
            meta_dat.text = json.dumps(meta, ensure_ascii=False)
        except Exception:
            graph_dat.text, meta_dat.text = before
            raise
        # Every edit is not shown on the status bar: too much (human 2026-10-09). Uncomment to watch edits.
        # 每一步編輯不顯示在狀態列（資訊量太大）；要觀察時取消下一行的註解。
        # notify(self.comp, 'applied revision ' + str(next_revision))
        if shader_error is not None:
            message = 'GLSL failed to compile in TD; the graph is saved and the last good Shader keeps running.'
            self.status('glsl-compile-failed', message, revision=next_revision,
                        runtimeRevision=meta['runtime']['revision'], error=shader_error)
            notify(self.comp, message)
        else:
            self.status('applied' if runtime_text is not None else 'document-only',
                        'Shader and graph applied' if runtime_text is not None
                        else 'Graph saved; Shader unchanged (no program change, or code generation failed in the editor)',
                        revision=next_revision, runtimeRevision=meta['runtime']['revision'])
        for notice in notices:
            notify(self.comp, english(notice))
        # shaderError: TD's compile log when the GLSL did not compile (the graph was saved anyway).
        # uniforms: each Uniform's components as TD has them now (Q60); notices: things to tell people,
        # as code + English + parameters (Q58). uniforms：各分量的現況；notices：要告訴人的事。
        return {'ok': True, 'state': self.state(), 'target': self.comp.path, 'shaderUpdated': shader_updated,
                'shaderError': shader_error, 'uniforms': self.uniform_states(), 'notices': notices}
