"""Run in TD with op, project and GRAPE_SERVICE_TEST_OUTPUT globals.

Fixtures and exported TOX are private test artifacts. They never replace the
live Editor source, catalog, masters, VFS, or graph.
"""
import json
from pathlib import Path
import socket
from urllib.request import urlopen
import uuid


def verify_service():
    output = Path(GRAPE_SERVICE_TEST_OUTPUT)
    assets = output / 'fixture'
    (assets / 'icons').mkdir(parents=True, exist_ok=True)
    (assets / 'index.html').write_text('<span class="brand-version">Fixture.1</span><img src="icons/test.png">', encoding='utf-8')
    (assets / 'icons/test.png').write_bytes(b'\x89PNG fixture A')
    (assets / 'stale.txt').write_text('removed in the next snapshot')
    source = op('/TD_Grape/GrapeEditor')
    probe = op('/project1').copy(source, name='editor_service_probe_' + uuid.uuid4().hex[:8])
    holder = None
    results = []
    try:
        probe.par.Active = False
        probe.par.Useexternal = True
        probe.par.Rootfolder = assets.as_posix()
        extension = probe.ext.EditorServiceExt
        extension.Stop()
        with socket.socket() as socket_probe:
            socket_probe.bind(('127.0.0.1', 0))
            probe.par.Port = socket_probe.getsockname()[1]
        probe.par.Allowlan.bindExpr = ''
        probe.par.Allowlan = False
        assert extension.Reload()
        assert extension.Start()
        origin = probe.par.Localurl.eval()
        def get(name):
            with urlopen(origin + name, timeout=3) as response:
                return response.read()
        assert get('icons/test.png') == b'\x89PNG fixture A'
        results.append('external bytes served by real HTTP')

        assert extension.UpdateEmbedded()
        embedded = {file.name: bytes(file.byteArray) for file in probe.op('virtualFile').vfs.find()}
        assert 'icons/test.png' in embedded
        (assets / 'icons/test.png').write_bytes(b'\x89PNG fixture B')
        assert get('icons/test.png') == b'\x89PNG fixture A'
        assert extension.Reload()
        assert get('icons/test.png') == b'\x89PNG fixture B'
        assert probe.par.Localurl.eval() == origin
        results.append('explicit reload replaces bytes without changing origin')

        probe.par.Rootfolder = str(output / 'does-not-exist')
        assert not extension.Reload()
        assert get('icons/test.png') == b'\x89PNG fixture B'
        assert not extension.UpdateEmbedded()
        assert {file.name: bytes(file.byteArray) for file in probe.op('virtualFile').vfs.find()} == embedded
        results.append('bad source preserves served and embedded snapshots')

        probe.par.Useexternal = False
        assert extension.Reload()
        assert get('icons/test.png') == b'\x89PNG fixture A'
        results.append('embedded source is independent of disk source')

        probe.par.Rootfolder = assets.as_posix()
        (assets / 'stale.txt').unlink()
        assert extension.UpdateEmbedded()
        assert 'stale.txt' not in {file.name for file in probe.op('virtualFile').vfs.find()}
        assert get('icons/test.png') == b'\x89PNG fixture B'
        results.append('packing removes stale owned files and updates embedded serving')

        worker = extension.http.worker
        extension.Stop()
        assert not worker.is_alive()
        probe.par.Useexternal = True
        probe.par.Rootfolder = str(output / 'portable-missing-folder')
        saved = probe.save(str(output / 'portable-editor.tox'))
        holder = op('/project1').create(baseCOMP, 'editor_service_reload_' + uuid.uuid4().hex[:8])
        reopened = holder.loadTox(saved)
        fresh = reopened.ext.EditorServiceExt
        assert fresh.Reload()
        assert fresh.snapshot.source == 'embedded'
        assert fresh.snapshot.files['icons/test.png'] == b'\x89PNG fixture B'
        assert 'using embedded' in reopened.par.Serviceerror.eval()
        results.append('saved TOX cold-starts from embedded assets without source folder')
        assert not reopened.errors(recurse=True), reopened.errors(recurse=True)
        return results
    finally:
        if holder and holder.valid:
            holder.destroy()
        if probe.valid:
            probe.ext.EditorServiceExt.Stop()
            probe.destroy()


checks = verify_service()
report = {'passed': True, 'checks': checks}
Path(GRAPE_SERVICE_TEST_OUTPUT, 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
