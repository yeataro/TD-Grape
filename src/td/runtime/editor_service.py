"""Static Editor assets and HTTP transport. No TouchDesigner or graph imports.

The TD adapter builds snapshots on explicit actions. HTTP workers only read
ordinary immutable bytes; they never inspect OPs, VFS, or the source folder.
"""
from hashlib import sha256
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path, PurePosixPath
import re
import socket
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
        # Legacy bundles have no build metadata yet. Read the actual displayed
        # version rather than inventing a second authoritative version field.
        version = re.search(r'class=["\'][^"\']*\bbrand-version\b[^"\']*["\'][^>]*>([^<]+)', html)
        self.version = version.group(1).strip() if version else 'Unknown'
        self.modified = False
        if 'build-info.json' in normalized:
            metadata = json.loads(normalized['build-info.json'])
            if metadata.get('schemaVersion') != 1 or metadata.get('version') != self.version:
                raise ValueError('Build metadata does not match the editor version')
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


class EditorHTTP:
    """A replaceable asset snapshot served independently of TD's cook loop."""
    def __init__(self, snapshot, host='127.0.0.1', port=65465):
        self.snapshot = snapshot
        self.request_count = 0
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
                if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Length', '0') != '0':
                    return self.reply(400, {'error': 'This service does not accept request bodies yet'}, head=head)
                path = unquote(urlsplit(self.path).path)
                if '\\' in path or '..' in path.split('/') or '\0' in path:
                    return self.reply(400, {'error': 'Invalid asset path'}, head=head)
                if path.startswith('/api/') or self.command == 'POST':
                    return self.reply(501, {'error': 'Editor assets are ready; the new TD Manager is not connected yet', 'code': 'manager_not_connected'}, head=head)
                if path == '/service-info.json':
                    return self.reply(200, {'service': 'grape-editor-assets', 'source': snapshot.source,
                        'version': snapshot.version, 'digest': snapshot.digest,
                        'files': len(snapshot.files), 'managerConnected': False}, head=head)
                name = path.lstrip('/') or 'index.html'
                if re.fullmatch(r'shader/[a-f0-9]{32}/', name):
                    name = 'index.html'
                data = snapshot.files.get(name)
                if data is None:
                    return self.reply(404, {'error': 'Asset not found'}, head=head)
                self.reply(200, data, content_type(name), head=head)

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
                    self.send_header('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'")
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

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(timeout=1)
