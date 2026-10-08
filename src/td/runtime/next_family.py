"""Grape OPs and what TD does with the editor's requests (design-interview Q38, Q40, Q48).

TD never parses, validates or re-serializes the graph: the document is opaque text,
checked only by length and checksum and returned as received. TD checks the envelope
(revision, target, build) and what it executes itself (GLSL, bindings).
Grape OP：TD 不解析、不檢查、不重新序列化圖；圖是不透明文字，只核對長度與
校驗值、原樣保存與交回。TD 只核對信封與自己要執行的東西（GLSL、綁定）。
"""
from hashlib import sha256
import json
import uuid

FORMAT = 'grape-next-1'  # the editor <-> TD request format
META_FORMAT = 'grape-meta-1'  # what graph_meta stores (Refactor.33)
PROTOCOL = 'grape.top.ts.1'  # the frontend compiler protocol this build speaks
MAX_TEXT = 512000


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(text):
    return sha256(text.encode('utf-8')).hexdigest()


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


def read_runtime(text, *, catalog_hash):
    """The execution part (GLSL + bindings) is TD's own input, so TD reads it."""
    require(isinstance(text, str) and 0 < len(text.encode('utf-8')) <= 1024 * 1024, 'invalid runtime part')
    compiled = json.loads(text)
    require(isinstance(compiled, dict) and compiled.get('vertex') == ''
            and isinstance(compiled.get('pixel'), str), 'invalid TOP source')
    require(0 < len(compiled['pixel'].encode('utf-8')) <= MAX_TEXT, 'invalid source size')
    bindings = compiled.get('bindings')
    require(isinstance(bindings, list), 'invalid binding table')
    # Uniform bindings arrive with the Uniform round (binding table, design-interview Q41).
    require(not bindings, 'Uniform bindings are not migrated to the new editor path yet.')
    return compiled


class NextFamily:
    """A Grape OP's stored work (design-interview Q38; grape-op-structure #4, #13):
    `graph` holds the graph text, the one copy, readable in TD; `graph_meta` holds what proves and
    runs it (revisions, checksums, ID, execution part, last known good) without the graph text;
    `status` is this Grape OP's state for people. TD never parses the graph.
    圖的正本在 graph（唯一一份，TD 裡看得到）；graph_meta 放證明與執行用的資料，不放圖的文字。"""
    FORMAT = FORMAT
    PROTOCOL = PROTOCOL

    def __init__(self, comp, *, validation_area=None):
        self.comp = comp
        self.validation_area = validation_area

    def target(self):
        return self.comp

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
                and digest(runtime['text']) == runtime.get('sha256')):
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

    def state(self):
        meta, text = self.stored()
        return {'revision': meta['document']['revision'], 'document': text,
                'runtimeRevision': meta['runtime']['revision'], 'targetId': meta['targetId']}

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

    def _validate(self, pixel):
        # A disposable compiler target; never a delivered Grape OP.
        comp = self.validation_area.create(baseCOMP, 'candidate_' + uuid.uuid4().hex[:12])
        try:
            comp.create(textDAT, 'pixel_shader').text = pixel
            shader = comp.create(glslTOP, 'shader')
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
            raise RuntimeError('Conflict: catalog changed; reload the editor')
        text = body.get('document')
        require(isinstance(text, str) and 0 < len(text.encode('utf-8')) <= MAX_TEXT, 'document exceeds 512 KB or is empty')
        runtime_text = body.get('runtime')
        next_revision = revision + 1
        meta = dict(meta)
        meta['document'] = {'revision': next_revision, 'sha256': digest(text)}
        shader_updated = False
        if runtime_text is not None:
            compiled = read_runtime(runtime_text, catalog_hash=catalog_hash)
            pixel = self.comp.op('pixel_shader')
            previous = pixel.text
            try:
                self._validate(compiled['pixel'])
                if pixel.text != compiled['pixel']:
                    pixel.text = compiled['pixel']
                    shader_updated = True
                self._verify_gpu(self.comp)
            except Exception as error:
                pixel.text = previous
                self.status('gpu-validation', str(error), exception=type(error).__name__)
                notify(self.comp, 'TD could not compile this Shader; the last known good keeps running.')
                raise RuntimeError('TD could not compile this Shader; the last known good keeps running. ' + str(error))
            meta['runtime'] = {'revision': next_revision, 'text': runtime_text, 'sha256': digest(runtime_text)}
            # The last known good is this graph: no second copy of its text. 最後成功版就是這份圖，不重存文字。
            meta['lastKnownGood'] = {'revision': next_revision, 'runtime': runtime_text, 'document': None}
        else:
            # The graph moves past the last known good: keep that graph's text once.
            # 圖往前走、Shader 停在最後成功版時，才留一份那時的圖。
            last = dict(meta.get('lastKnownGood') or {})
            if last and last.get('document') is None:
                last['document'] = previous_text
            meta['lastKnownGood'] = last
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
        self.status('applied' if runtime_text is not None else 'document-only',
                    'Shader and document applied' if runtime_text is not None
                    else 'Document saved; Shader unchanged (no program change, or code generation failed in the editor)',
                    revision=next_revision, runtimeRevision=meta['runtime']['revision'])
        return {'ok': True, 'state': self.state(), 'target': self.comp.path, 'shaderUpdated': shader_updated}
