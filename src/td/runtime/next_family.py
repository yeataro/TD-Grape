"""Grape OPs managed by the new editor (TD tag grapeNextEditor; design-interview Q38, Q40).

TD never parses, validates or re-serializes the graph: the document is opaque text,
checked only by length and checksum and returned as received. TD checks the envelope
(revision, target, build) and what it executes itself (GLSL, bindings).
新編輯器管理的 Grape OP：TD 不解析、不檢查、不重新序列化圖；圖是不透明文字，只核對長度與
校驗值、原樣保存與交回。TD 只核對信封與自己要執行的東西（GLSL、綁定）。
"""
from hashlib import sha256
import json
import uuid

TAG = 'grapeNextEditor'
FORMAT = 'grape-next-1'
MAX_TEXT = 512000


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(text):
    return sha256(text.encode('utf-8')).hexdigest()


def is_next(comp):
    return TAG in comp.tags


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
    next = True
    FORMAT = FORMAT

    def __init__(self, comp, *, protocol, validation_area=None):
        self.comp = comp
        self.PROTOCOL = protocol  # the frontend compiler protocol this build speaks
        self.validation_area = validation_area

    def target(self):
        return self.comp

    def _data(self):
        return self.comp.op('GrapeControls/document')

    def stored(self):
        text = self._data().text
        require(text, 'This Grape OP has no new-editor document.')
        value = json.loads(text)
        require(isinstance(value, dict) and value.get('format') == FORMAT, 'unsupported stored format')
        require(value.get('targetId') == self.comp.fetch('sgrapeShaderId', None), 'stored target mismatch')
        for part in ('document', 'runtime'):
            entry = value.get(part)
            require(isinstance(entry, dict) and isinstance(entry.get('text'), str)
                    and digest(entry['text']) == entry.get('sha256'), 'stored ' + part + ' changed or damaged')
        return value

    def state(self):
        value = self.stored()
        return {'revision': value['document']['revision'], 'document': value['document']['text'],
                'runtimeRevision': value['runtime']['revision'], 'targetId': value['targetId']}

    def status(self, phase, message, **details):
        data = self.comp.op('GrapeControls/status')
        if data:
            data.text = json.dumps({'phase': phase, 'message': message,
                'targetId': self.comp.fetch('sgrapeShaderId', None), **details}, ensure_ascii=False, indent=2)

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
        current = self.stored()
        revision = current['document']['revision']
        require(body.get('format') == FORMAT, 'unsupported request format')
        if body.get('revision') != revision:
            raise RuntimeError('Conflict: stale revision')
        require(body.get('targetId') == self.comp.fetch('sgrapeShaderId', None), 'target mismatch')
        if body.get('catalogHash') != catalog_hash:
            raise RuntimeError('Conflict: catalog changed; reload the editor')
        text = body.get('document')
        require(isinstance(text, str) and 0 < len(text.encode('utf-8')) <= MAX_TEXT, 'document exceeds 512 KB or is empty')
        runtime_text = body.get('runtime')
        next_revision = revision + 1
        value = dict(current)
        value['document'] = {'revision': next_revision, 'text': text, 'sha256': digest(text)}
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
                raise RuntimeError('TD could not compile this Shader; the last known good keeps running. ' + str(error))
            value['runtime'] = {'revision': next_revision, 'text': runtime_text, 'sha256': digest(runtime_text)}
            value['lastKnownGood'] = {'revision': next_revision, 'document': text, 'runtime': runtime_text}
        self._data().text = json.dumps(value, ensure_ascii=False)
        view = self.comp.op('graph')
        if view is not None:
            view.text = text  # human-readable copy, written as received
        self.status('applied' if runtime_text is not None else 'document-only',
                    'Shader and document applied' if runtime_text is not None
                    else 'Code generation failed in the editor; document saved, Shader unchanged',
                    revision=next_revision, runtimeRevision=value['runtime']['revision'])
        return {'ok': True, 'state': self.state(), 'target': self.comp.path, 'shaderUpdated': shader_updated}
