"""Editor request contract on a compiler-free, main-thread host.

Resolution and the Grape OP list are injected by the TD Manager. This module
never discovers OPs or reads graphs. Unsupported actions stay explicit.
"""
import re
import struct
import threading
import zlib
from urllib.parse import urlsplit


# What each refusal code replies (Refactor.62). An error without one of these codes is a failure: it leaves dispatch and
# the request queue reports it with its type and traceback. 每種拒絕代碼的回覆；沒有這些代碼的錯誤是失敗，交給請求佇列照實回報。
REFUSALS = {'host_rejected': 422, 'revision_conflict': 409, 'build_changed': 409, 'texture_unavailable': 404,
            'capability_not_migrated': 501}


class BadRequest(ValueError):
    """The request itself is not usable. 請求本身不能用。"""
    code = 'host_rejected'


class UnsupportedOperation(RuntimeError):
    """Not migrated to this build yet. 這個版本還沒做。"""
    code = 'capability_not_migrated'


def encode_png(width, height, rgba):
    """Straight RGBA, top row first, as a PNG. 直接的 RGBA（第一列在上）壓成 PNG。"""
    stride = width * 4
    rows = b''.join(b'\x00' + rgba[y * stride:(y + 1) * stride] for y in range(height))
    def chunk(tag, body):
        return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(rows, 6)) + chunk(b'IEND', b''))


class Image:
    """An image reply (Refactor.58, default-image previews): pixels TD read, made a PNG (alpha kept) only when the
    reply is written, on the editor service's thread, never TD's (human 2026-10-09: 24 ms in TD was too much); and
    whether the browser may keep it. 圖片回覆：TD 讀出的像素，到寫回覆時才在編輯服務的執行緒壓成 PNG（保留透明度），
    不佔 TD 的執行緒（人類：TD 裡 24 ms 太多）；以及瀏覽器能不能留著用。"""
    mime = 'image/png'

    def __init__(self, pixels, *, keep):
        self.pixels, self.keep = pixels, keep
        self._png, self._lock = None, threading.Lock()

    @property
    def data(self):
        with self._lock:
            if self._png is None:
                self._png = encode_png(*self.pixels)
            return self._png


class HostAPI:
    def __init__(self, *, bootstrap, resolve, choices, save_project, applied=None, identity=None, textures=None, capture=None):
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
        # The shared default images, by name, for previews while editing (Refactor.58): the same for every
        # Grape OP, so one address each and the browser keeps them. 編輯時預覽用的公用預設圖：每個 Grape OP
        # 都一樣，所以一張圖一個網址，瀏覽器留著用。
        self.textures = textures
        # Reads a TOP small, as (width, height, straight RGBA bytes) (the Manager's preview TOP).
        # 把一個 TOP 縮小讀出像素：(寬, 高, RGBA)（Manager 的預覽 TOP）。
        self.capture = capture
        self.shared = {}  # shared images read this connection; each made a PNG once 這次連線讀過的公用圖，各只壓一次

    def dispatch(self, method, path, body=None):
        status, result = self._dispatch(method, path, body)
        if self.identity and isinstance(result, dict):
            result = {**result, 'td': self.identity()}
        return status, result

    def _dispatch(self, method, path, body):
        path = urlsplit(path).path
        match = re.fullmatch(r'/api/([a-f0-9]{32})/([a-z-]+)(?:/([A-Za-z0-9_-]{1,64}))?', path)
        if method == 'GET' and path == '/api/shaders':
            return 200, self.choices()
        shared = re.fullmatch(r'/api/textures/([a-z]+)\.png', path)
        if method == 'GET' and shared:
            name = shared.group(1)
            if name not in self.shared:
                pixels = self.textures(name) if self.textures else None
                if not pixels:
                    return 404, {'error': 'There is no shared default image with this name.', 'code': 'texture_unavailable'}
                self.shared[name] = Image(pixels, keep=True)
            return 200, self.shared[name]
        if not match:
            return 404, {'error': 'Open a registered Grape OP to edit its graph.', 'code': 'target_required'}
        target_id, action, argument = match.groups()
        # Only `input` names one of its inputs; any other extra part, or `input` without one, is not an address (Refactor.62).
        # 只有 input 帶輸入 ID；其他多帶的、或 input 沒帶的，都不是有效位址。
        if (argument is not None) != (action == 'input'):
            return 404, {'error': 'There is no such host address.', 'code': 'not_found', 'operation': action}
        try:
            family = self.resolve(target_id)
            if family is None:
                return 404, {'error': 'This Grape OP is not available to the Manager.', 'code': 'target_unavailable'}
            if method == 'POST' and not isinstance(body, dict):
                raise BadRequest('Host actions require a JSON object.')
            return 200, self._action(family, method, action, body, argument)
        except Exception as error:
            # Only refusals are answered here, by their code (build_changed is not a conflict: no version choice helps,
            # the page must be reloaded). Anything else is a failure and goes on to the request queue, which reports it
            # with its type, never as "TD refused" (Refactor.62).
            # 這裡只回覆拒絕，照代碼（build_changed 不是衝突：選哪個版本都沒用，要重新整理）。其他是失敗，交給請求佇列照實回報。
            code = getattr(error, 'code', None)
            if code not in REFUSALS:
                raise
            return REFUSALS[code], {'error': str(error), 'code': code,
                'layer': 'manager' if code == 'capability_not_migrated' else 'grape-op', 'operation': action}

    def _action(self, family, method, action, body, argument=None):
        # TD only checks the envelope and what it executes; no history, sources or graph reads.
        # TD 只核對信封與自己要執行的東西；不碰歷史、來源或圖的內容。
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
        # The person chose "also give this Grape OP a new Grape ID" (Refactor.52, Q63). 使用者勾了換新 ID。
        if method == 'POST' and action == 'identity':
            return {'targetId': family.regenerate()}
        # What each texture input has wired in, and one input as the shader receives it now: a snapshot, not live
        # (Refactor.60). 每個貼圖輸入接了什麼；以及某個輸入 Shader 現在收到的樣子：快照，不是即時。
        if method == 'GET' and action == 'inputs':
            return {'inputs': family.input_sources()}
        if method == 'GET' and action == 'input' and argument:
            if not self.capture:
                raise UnsupportedOperation('The editor host cannot take previews.')
            # Its size and format come with the inputs (input_sources), one place for them (Refactor.61.6).
            # 尺寸與格式隨輸入回報（input_sources），只有一處。
            return Image(self.capture(family.input_top(argument)), keep=False)
        if method == 'POST' and action == 'save':
            return {'saved': self.save_project()}
        raise UnsupportedOperation('The editor host does not provide this operation yet: ' + method + ' ' + action)
