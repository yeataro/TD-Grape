"""Real HTTP and filesystem tests for the host-independent Editor service."""
import http.client
from hashlib import sha256
import importlib.util
import json
import socket
import time
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2] / 'src/td/runtime/editor_service.py'
spec = importlib.util.spec_from_file_location('grape_editor_service', SOURCE)
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


def bundle(version='Test.1'):
    # The version comes from build-info.json (src/version.json at build time). 版本來自建置資料。
    return {'index.html': b'<script src="/nested/app.js"></script><img src="/icons/test.png">',
        'nested/app.js': b'/* static */', 'icons/test.png': b'\x89PNG\r\n\x1a\n',
        'manifest.webmanifest': b'{"name":"test"}',
        'build-info.json': json.dumps({'schemaVersion': 1, 'version': version, 'assets': {}}).encode()}


class AssetsTest(unittest.TestCase):
    def test_build_metadata_identifies_edits_and_rejects_missing_files(self):
        files = bundle()
        del files['build-info.json']
        metadata = {'schemaVersion': 1, 'version': 'Test.1',
            'assets': {name: sha256(data).hexdigest() for name, data in files.items()}}
        files['build-info.json'] = json.dumps(metadata).encode()
        self.assertEqual(service.AssetSnapshot(files, 'external').version, 'Test.1')
        files['nested/app.js'] = b'/* local edit before rebuild */'
        edited = service.AssetSnapshot(files, 'external')
        self.assertEqual(edited.version, 'Test.1 (modified)')
        self.assertTrue(edited.modified)
        del files['manifest.webmanifest']
        with self.assertRaisesRegex(ValueError, 'Build asset is missing'):
            service.AssetSnapshot(files, 'external')

    def test_snapshot_version_binary_and_isolation(self):
        files = bundle()
        snapshot = service.AssetSnapshot(files, 'embedded')
        files['nested/app.js'] = b'changed'
        self.assertEqual(snapshot.version, 'Test.1')
        self.assertEqual(snapshot.files['nested/app.js'], b'/* static */')
        with self.assertRaises(TypeError):
            snapshot.files['extra'] = b'bad'

    def test_incomplete_source_is_rejected(self):
        files = bundle()
        del files['nested/app.js']
        with self.assertRaisesRegex(ValueError, 'nested/app.js'):
            service.AssetSnapshot(files, 'external')

    def test_folder_preserves_relative_names_and_ignores_private_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, data in bundle().items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            (root / '.private').write_text('not a web asset')
            self.assertEqual(dict(service.folder_snapshot(root).files), bundle())

    def test_bad_asset_names_rejected(self):
        for name in ('../secret', '/absolute', 'folder\\file'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                service.AssetSnapshot({**bundle(), name: b'x'}, 'external')


class HTTPTest(unittest.TestCase):
    def setUp(self):
        self.server = service.EditorHTTP(service.AssetSnapshot(bundle(), 'embedded'), port=0)

    def tearDown(self):
        self.server.close()
        self.assertFalse(self.server.worker.is_alive())

    def request(self, path, method='GET', headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.port, timeout=3)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_nested_assets_binary_mime_head_and_query(self):
        status, headers, data = self.request('/icons/test.png?v=1')
        self.assertEqual((status, data), (200, bundle()['icons/test.png']))
        self.assertEqual(headers['Content-Type'], 'image/png')
        status, headers, data = self.request('/nested/app.js', 'HEAD')
        self.assertEqual((status, data), (200, b''))
        self.assertEqual(int(headers['Content-Length']), len(bundle()['nested/app.js']))
        self.assertEqual(self.request('/manifest.webmanifest')[1]['Content-Type'], 'application/manifest+json; charset=utf-8')

    def test_root_and_edit_address_serve_the_new_editor(self):
        # Refactor.24: the new editor is the only entry. 新編輯器是唯一入口。
        page = b'<!doctype html><title>new editor</title>'
        self.server.replace(service.AssetSnapshot({**bundle(), 'index.html': page}, 'embedded'))
        for path in ['/', '/shader/' + 'a' * 32 + '/', '/shader/' + 'a' * 32 + '/?x=1']:
            status, headers, data = self.request(path)
            self.assertEqual((status, data), (200, page), path)
            self.assertTrue(headers['Content-Type'].startswith('text/html'))
        self.assertEqual(self.request('/shader/not-an-id/')[0], 404)

    def test_reload_on_same_origin_and_no_filesystem_dependency(self):
        port = self.server.port
        self.server.replace(service.AssetSnapshot(bundle('Test.2'), 'external'))
        info = json.loads(self.request('/service-info.json')[2])
        self.assertEqual((info['version'], info['source']), ('Test.2', 'external'))
        self.assertEqual(self.server.port, port)

    def test_does_not_pretend_to_be_a_manager(self):
        status, _, data = self.request('/api/state')
        self.assertEqual(status, 501)
        self.assertEqual(json.loads(data)['code'], 'manager_not_connected')

    def live_socket(self, origin=None, target='a' * 32):
        """A raw WebSocket client: handshake, then masked text frames. 最小的 WebSocket 用戶端。"""
        sock = socket.create_connection(('127.0.0.1', self.server.port), timeout=3)
        host = '127.0.0.1:' + str(self.server.port)
        sock.sendall(('GET /api/' + target + '/live HTTP/1.1\r\nHost: ' + host + '\r\nUpgrade: websocket\r\n'
                      'Connection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n'
                      'Origin: ' + (origin or 'http://' + host) + '\r\n\r\n').encode('ascii'))
        head = b''
        while b'\r\n\r\n' not in head:
            head += sock.recv(1)
        return sock, head.decode('ascii')

    @staticmethod
    def client_frame(text):
        payload, mask = text.encode('utf-8'), b'\x01\x02\x03\x04'
        return bytes([0x81, 0x80 | len(payload)]) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

    def wait_for(self, check):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            result = check()
            if result:
                return result
            time.sleep(.01)
        self.fail('timed out')

    def test_live_websocket_carries_text_both_ways_without_td_waiting(self):
        # Uniform D2 (Refactor.48): same port, same checks; TD's side only queues and drains.
        # 同一個 port、同樣的檢查；TD 那邊只排隊與取走。
        sock, head = self.live_socket()
        self.assertIn('501', head.split('\r\n')[0])  # no Manager yet 還沒有 Manager
        sock.close()
        self.server.connect(object())  # stands in for the Manager's request queue 代替 Manager 的佇列
        sock, head = self.live_socket()
        self.assertIn('101', head.split('\r\n')[0])
        self.assertIn('Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=', head)  # RFC 6455 example
        events = self.wait_for(lambda: self.server.live.drain())
        self.assertEqual([(kind, connection.target) for kind, connection, _ in events], [('open', 'a' * 32)])
        connection = events[0][1]
        sock.sendall(self.client_frame('{"type":"value"}'))
        events = self.wait_for(lambda: self.server.live.drain())
        self.assertEqual([(kind, text) for kind, _, text in events], [('message', '{"type":"value"}')])
        for frame in range(3):
            connection.send('values ' + str(frame), replaceable=True)
        connection.send('state')
        received = b''
        while received.count(b'\x81') < 4:
            received += sock.recv(4096)
        self.assertIn(b'values 2', received)
        self.assertTrue(received.endswith(b'state'))
        sock.sendall(bytes([0x88, 0x82]) + b'\x00\x00\x00\x00' + b'\x03\xe8')  # close 1000
        events = self.wait_for(lambda: self.server.live.drain())
        self.assertEqual([kind for kind, _, _ in events], ['close'])
        sock.close()
        self.server.connect(None)

    def test_live_websocket_keeps_the_http_checks(self):
        self.server.connect(object())
        sock, head = self.live_socket(origin='https://unrelated.example')
        self.assertIn('403', head.split('\r\n')[0])
        sock.close()
        self.assertEqual(self.server.live.drain(), [])
        self.server.connect(None)

    def test_rejects_other_origins_hosts_and_traversal(self):
        self.assertEqual(self.request('/', headers={'Origin': 'https://unrelated.example'})[0], 403)
        self.assertEqual(self.request('/', headers={'Host': 'unrelated.example'})[0], 403)
        self.assertEqual(self.request('/%2e%2e/secret')[0], 400)
        self.assertEqual(self.request('/missing')[0], 404)

    def test_busy_port_does_not_silently_change_origin(self):
        with self.assertRaises(OSError):
            service.EditorHTTP(self.server.snapshot, port=self.server.port)

    def test_remote_preview_policy_is_limited_to_current_peer_and_port(self):
        self.server.preview_port = 8920
        policy = self.request('/')[1]['Content-Security-Policy']
        self.assertIn("connect-src 'self' http://127.0.0.1:8920 ws://127.0.0.1:8920;", policy)
        client = http.client.HTTPConnection('127.0.0.1', self.server.port)
        try:
            client.putrequest('GET', '/', skip_host=True)
            client.endheaders()
            reply = client.getresponse()
            self.assertEqual(reply.status, 403)
            reply.read()
        finally:
            client.close()


if __name__ == '__main__':
    unittest.main()
