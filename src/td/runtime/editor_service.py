"""Static Editor assets and HTTP transport. No TouchDesigner or graph imports.

The TD adapter builds snapshots on explicit actions. HTTP workers only read
ordinary immutable bytes; they never inspect OPs, VFS, or the source folder.
"""
import base64
from collections import deque
from hashlib import sha1, sha256
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path, PurePosixPath
import re
import select
import socket
import struct
import threading
from types import MappingProxyType
from urllib.parse import unquote, urlsplit


class AssetSnapshot:
    def __init__(self, files, source):
        normalized = {}
        for name, data in files.items():
            if not name or name.startswith('/') or '\\' in name or '..' in name.split('/'):
                raise ValueError('Invalid asset path: ' + name)
            normalized[name] = bytes(data)
        if 'index.html' not in normalized:
            raise ValueError('index.html is missing from the selected source')
        html = normalized['index.html'].decode('utf-8')
        references = _PageReferences()
        references.feed(html)
        for name in references.assets:
            if name not in normalized:
                raise ValueError('Referenced asset is missing: ' + name)
        self.files = MappingProxyType(normalized)
        self.source = source
        # The version comes from the build metadata, written from src/version.json (Refactor.25).
        # 版本來自建置資料（由 src/version.json 寫入）。
        self.version = 'Unknown'
        self.modified = False
        if 'build-info.json' in normalized:
            metadata = json.loads(normalized['build-info.json'])
            if metadata.get('schemaVersion') != 1 or not metadata.get('version'):
                raise ValueError('Build metadata is incomplete')
            self.version = metadata['version']
            for name, expected in metadata.get('assets', {}).items():
                if name not in normalized:
                    raise ValueError('Build asset is missing: ' + name)
                self.modified |= sha256(normalized[name]).hexdigest() != expected
            if self.modified:
                self.version += ' (modified)'
        digest = sha256()
        for name, data in sorted(normalized.items()):
            digest.update(name.encode('utf-8') + b'\0' + sha256(data).digest())
        self.digest = digest.hexdigest()
        self.byte_count = sum(map(len, normalized.values()))


class _PageReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        value = attrs.get('src') if tag in ('script', 'img') else None
        if tag == 'link' and attrs.get('rel') in ('stylesheet', 'icon', 'manifest', 'apple-touch-icon'):
            value = attrs.get('href')
        if value:
            parsed = urlsplit(value)
            if not parsed.scheme and not parsed.netloc and parsed.path:
                self.assets.add(unquote(parsed.path).lstrip('/'))


def folder_snapshot(folder):
    root = Path(folder).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Editor source must be a folder')
    files = {}
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part.startswith('.') or part == '__pycache__' for part in relative.parts):
            continue
        if path.is_file():
            # A folder snapshot must not expose files outside its declared root.
            path.resolve().relative_to(root)
            files[relative.as_posix()] = path.read_bytes()
    return AssetSnapshot(files, 'external')


def content_type(name):
    suffix = PurePosixPath(name).suffix.lower()
    return {
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
    }.get(suffix) or mimetypes.guess_type(name)[0] or 'application/octet-stream'


# Live Uniform values (Uniform D2, Refactor.48; design-interview Q53, uniform-d.md B): a WebSocket on
# the same port, /api/<Grape ID>/live, with the same Host and Origin checks as HTTP. Each connection is
# read and written on its own worker thread; TD's thread only queues text (send) and takes what arrived
# (LiveHub.drain), so TD never waits on a browser. Text frames only (RFC 6455).
# 即時 Uniform 值：同一個 port 的 WebSocket，檢查與 HTTP 相同。每條連線在自己的執行緒讀寫；
# TD 的執行緒只排隊要送的文字、取走收到的，不會等瀏覽器。只收送文字訊框。
LIVE_PATH = re.compile(r'/api/([a-f0-9]{32})/live')
WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def websocket_frame(opcode, payload):
    """A server frame (never masked). 伺服器送出的訊框（不加遮罩）。"""
    size = len(payload)
    if size < 126:
        head = struct.pack('>BB', 0x80 | opcode, size)
    elif size < 65536:
        head = struct.pack('>BBH', 0x80 | opcode, 126, size)
    else:
        head = struct.pack('>BBQ', 0x80 | opcode, 127, size)
    return head + payload


def read_websocket_frame(buffer, limit):
    """(opcode, payload, bytes used) for one whole client frame, or None while incomplete. Raises
    ValueError for frames this service does not take (unmasked, fragmented, too big).
    讀一個完整的瀏覽器訊框；不完整時回傳 None；不收的訊框（沒遮罩、分段、太大）丟 ValueError。"""
    if len(buffer) < 2:
        return None
    first, second = buffer[0], buffer[1]
    size, at = second & 0x7f, 2
    if size == 126:
        if len(buffer) < 4:
            return None
        size, at = struct.unpack('>H', buffer[2:4])[0], 4
    elif size == 127:
        if len(buffer) < 10:
            return None
        size, at = struct.unpack('>Q', buffer[2:10])[0], 10
    if not first & 0x80 or first & 0x70 or not second & 0x80 or size > limit:
        raise ValueError('Unsupported WebSocket frame')
    if len(buffer) < at + 4 + size:
        return None
    mask = buffer[at:at + 4]
    payload = bytes(b ^ mask[i % 4] for i, b in enumerate(buffer[at + 4:at + 4 + size]))
    return first & 0x0f, payload, at + 4 + size


class LiveConnection:
    """One editor page's WebSocket. send() may be called from TD's thread; everything else runs on
    the connection's worker thread. A newer values bundle may replace older ones still waiting
    (they are whole values, not changes); other messages are kept in order.
    一個編輯頁的 WebSocket。TD 的執行緒只呼叫 send()；其餘都在連線自己的執行緒。等待中的舊數值包可被新的取代
    （包裡是完整的值，不是變化量）；其他訊息照順序保留。"""
    MAX_MESSAGE = 64 * 1024
    MAX_WAITING = 64

    def __init__(self, sock, target, hub, serial):
        self.sock, self.target, self.hub = sock, target, hub
        self.session = 'live' + str(serial)
        self.closed = False
        self._outbox = deque()
        self._lock = threading.Lock()
        self._wake_read, self._wake_write = socket.socketpair()
        self._wake_read.setblocking(False)
        self._wake_write.setblocking(False)

    def send(self, text, replaceable=False):
        with self._lock:
            if self.closed:
                return
            if replaceable and len(self._outbox) >= self.MAX_WAITING:
                for item in list(self._outbox):
                    if item[0]:
                        self._outbox.remove(item)
                        break
            self._outbox.append((replaceable, text))
        self._wake()

    def close(self):
        with self._lock:
            self.closed = True
        self._wake()

    def _wake(self):
        try:
            self._wake_write.send(b'.')
        except OSError:
            pass

    def run(self):
        buffer = b''
        try:
            while True:
                readable, _, _ = select.select([self.sock, self._wake_read], [], [], 30)
                if self._wake_read in readable:
                    try:
                        while self._wake_read.recv(4096):
                            pass
                    except (BlockingIOError, OSError):
                        pass
                with self._lock:
                    waiting = [text for _, text in self._outbox]
                    self._outbox.clear()
                    closing = self.closed
                if waiting:
                    self.sock.sendall(b''.join(websocket_frame(0x1, text.encode('utf-8')) for text in waiting))
                if closing:
                    self.sock.sendall(websocket_frame(0x8, struct.pack('>H', 1000)))
                    return
                if self.sock not in readable:
                    continue
                data = self.sock.recv(65536)
                if not data:
                    return
                buffer += data
                while True:
                    try:
                        frame = read_websocket_frame(buffer, self.MAX_MESSAGE)
                    except ValueError:
                        self.sock.sendall(websocket_frame(0x8, struct.pack('>H', 1003)))
                        return
                    if frame is None:
                        break
                    opcode, payload, used = frame
                    buffer = buffer[used:]
                    if opcode == 0x1:
                        self.hub.received(self, payload.decode('utf-8', 'replace'))
                    elif opcode == 0x8:
                        self.sock.sendall(websocket_frame(0x8, payload[:2]))
                        return
                    elif opcode == 0x9:
                        self.sock.sendall(websocket_frame(0xA, payload))
                    elif opcode != 0xA:
                        self.sock.sendall(websocket_frame(0x8, struct.pack('>H', 1003)))
                        return
        except (OSError, TimeoutError):
            return
        finally:
            with self._lock:
                self.closed = True
            self._wake_read.close()
            self._wake_write.close()


class LiveHub:
    """Live connections and what arrived from them, for TD's thread to take (drain). Contains no TD
    objects. 即時連線與收到的訊息，給 TD 的執行緒取走；不含 TD 物件。"""
    MAX_EVENTS = 4096

    def __init__(self):
        self._lock = threading.Lock()
        self._events = deque()
        self._serial = 0
        self.connections = set()

    def serve(self, sock, target):
        """Runs on the HTTP worker thread for the connection's whole life. 在 HTTP 工作執行緒上跑完整條連線。"""
        with self._lock:
            self._serial += 1
            connection = LiveConnection(sock, target, self, self._serial)
            self.connections.add(connection)
            self._events.append(('open', connection, None))
        try:
            connection.run()
        finally:
            with self._lock:
                self.connections.discard(connection)
                self._events.append(('close', connection, None))

    def received(self, connection, text):
        with self._lock:
            if len(self._events) >= self.MAX_EVENTS:
                return  # TD is not taking them (stopped or stuck): values are best effort 只是盡力送
            self._events.append(('message', connection, text))

    def drain(self):
        with self._lock:
            events = list(self._events)
            self._events.clear()
        return events

    def close(self):
        with self._lock:
            connections = list(self.connections)
        for connection in connections:
            connection.close()


class EditorHTTP:
    """A replaceable asset snapshot served independently of TD's cook loop."""
    def __init__(self, snapshot, host='127.0.0.1', port=65465):
        self.snapshot = snapshot
        self.request_count = 0
        self.host_requests = None
        self.preview_port = None
        self.live = LiveHub()
        self._lock = threading.Lock()
        service = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def setup(self):
                self.request.settimeout(5)
                super().setup()

            def log_message(self, *args):
                pass

            def do_GET(self):
                self.respond()

            def do_HEAD(self):
                self.respond(head=True)

            def do_POST(self):
                self.respond()

            def respond(self, head=False):
                with service._lock:
                    service.request_count += 1
                    snapshot = service.snapshot
                    host_requests = service.host_requests
                address = self.connection.getsockname()[0]
                expected_host = address + ':' + str(self.server.server_port)
                hosts = self.headers.get_all('Host', [])
                allowed = [expected_host]
                if address == '127.0.0.1':
                    allowed.append('localhost:' + str(self.server.server_port))
                if len(hosts) != 1 or hosts[0] not in allowed:
                    return self.reply(403, {'error': 'Invalid host'}, head=head)
                origin = self.headers.get_all('Origin', [])
                if origin and origin != ['http://' + hosts[0]]:
                    return self.reply(403, {'error': 'Invalid origin'}, head=head)
                if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                    return self.reply(403, {'error': 'Cross-site request rejected'}, head=head)
                path = unquote(urlsplit(self.path).path)
                if '\\' in path or '..' in path.split('/') or '\0' in path:
                    return self.reply(400, {'error': 'Invalid asset path'}, head=head)
                lengths = self.headers.get_all('Content-Length', [])
                if self.headers.get('Transfer-Encoding') or len(lengths) > 1 or (lengths and not re.fullmatch(r'[0-9]+', lengths[0])):
                    return self.reply(400, {'error': 'Invalid request length'}, head=head)
                length = int(lengths[0]) if lengths else 0
                if length > 2 * 1024 * 1024:
                    return self.reply(413, {'error': 'Request exceeds 2 MB'}, head=head)
                live = LIVE_PATH.fullmatch(path)
                if live and self.headers.get('Upgrade', '').lower() == 'websocket':
                    return self.upgrade(live.group(1), host_requests, length)
                if path.startswith('/api/'):
                    if head:
                        return self.reply(405, {'error': 'Use GET for host state'}, head=True)
                    if host_requests is None:
                        return self.reply(501, {'error': 'Editor assets are ready; the new TD Manager is not connected yet', 'code': 'manager_not_connected'})
                    if self.command == 'GET' and length:
                        return self.reply(400, {'error': 'GET must not carry a body'})
                    body = None
                    if self.command == 'POST':
                        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json' or not length:
                            return self.reply(400, {'error': 'Host actions require a JSON object'})
                        try:
                            data = self.rfile.read(length)
                            if len(data) != length:
                                raise ValueError('Incomplete request body')
                            body = json.loads(data)
                            if not isinstance(body, dict):
                                raise ValueError('Expected a JSON object')
                        except (ValueError, UnicodeDecodeError, TimeoutError) as error:
                            return self.reply(400, {'error': str(error)})
                    status, result = host_requests.request(self.command, self.path, body)
                    return self.reply(status, result)
                if length or self.command == 'POST':
                    return self.reply(405, {'error': 'Static assets do not accept actions or bodies'}, head=head)
                if path == '/service-info.json':
                    return self.reply(200, {'service': 'grape-editor-assets', 'source': snapshot.source,
                        'version': snapshot.version, 'digest': snapshot.digest,
                        'files': len(snapshot.files), 'managerConnected': host_requests is not None}, head=head)
                # The new editor (index.html) is the only entry: the root and a Grape OP's Edit
                # address both serve it. 新編輯器（index.html）是唯一入口：首頁與 Edit 網址都給它。
                name = path.lstrip('/')
                if not name or re.fullmatch(r'shader/[a-f0-9]{32}/', name):
                    name = 'index.html'
                data = snapshot.files.get(name)
                if data is None:
                    return self.reply(404, {'error': 'Asset not found'}, head=head)
                self.reply(200, data, content_type(name), head=head)

            def upgrade(self, target, host_requests, length):
                """WebSocket handshake, then the connection's life on this thread (Uniform D2).
                WebSocket 握手，之後整條連線在這個執行緒。"""
                if self.command != 'GET' or length:
                    return self.reply(400, {'error': 'A live connection is a GET without a body'})
                if host_requests is None:
                    return self.reply(501, {'error': 'Editor assets are ready; the new TD Manager is not connected yet', 'code': 'manager_not_connected'})
                key = self.headers.get('Sec-WebSocket-Key', '')
                if self.headers.get('Sec-WebSocket-Version') != '13' or not key:
                    return self.reply(400, {'error': 'Unsupported WebSocket handshake'})
                accept = base64.b64encode(sha1((key + WEBSOCKET_GUID).encode('ascii')).digest()).decode('ascii')
                self.send_response(101)
                self.send_header('Upgrade', 'websocket')
                self.send_header('Connection', 'Upgrade')
                self.send_header('Sec-WebSocket-Accept', accept)
                self.end_headers()
                self.wfile.flush()
                self.close_connection = True
                self.connection.settimeout(5)
                service.live.serve(self.connection, target)

            def reply(self, status, data, mime=None, head=False):
                if not isinstance(data, bytes):
                    data = json.dumps(data, ensure_ascii=False).encode('utf-8')
                if status >= 400:
                    self.close_connection = True
                try:
                    self.send_response(status)
                    self.send_header('Content-Type', mime or 'application/json; charset=utf-8')
                    self.send_header('Content-Length', str(len(data)))
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.send_header('Referrer-Policy', 'no-referrer')
                    peer = ''
                    hostname = urlsplit('http://' + self.headers.get('Host', '')).hostname
                    if service.preview_port is not None and hostname:
                        if ':' in hostname:
                            hostname = '[' + hostname + ']'
                        peer = ' http://' + hostname + ':' + str(service.preview_port) + ' ws://' + hostname + ':' + str(service.preview_port)
                    self.send_header('Content-Security-Policy', "default-src 'self'; connect-src 'self'" + peer + "; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'")
                    if self.close_connection:
                        self.send_header('Connection', 'close')
                    self.end_headers()
                    if not head:
                        self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError, TimeoutError):
                    pass

        class Server(ThreadingHTTPServer):
            allow_reuse_address = False
            daemon_threads = True
            block_on_close = False

            def server_bind(self):
                if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
                    self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                super().server_bind()

        self.server = Server((host, port), Handler)
        self.port = self.server.server_port
        self.worker = threading.Thread(target=self.server.serve_forever,
            kwargs={'poll_interval': .1}, daemon=True, name='Grape Editor HTTP')
        self.worker.start()

    def replace(self, snapshot):
        with self._lock:
            self.snapshot = snapshot

    def connect(self, host_requests):
        """The main-thread adapter passes a queue, never a TD callback to workers."""
        with self._lock:
            self.host_requests = host_requests

    def close(self):
        with self._lock:
            host_requests = self.host_requests
            self.host_requests = None
        if host_requests:
            host_requests.close()
        self.live.close()
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(timeout=1)
