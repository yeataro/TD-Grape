"""Run via TDMCP in an isolated copy of the human Editor shell.

Set GRAPE_VFS_TEST_OUTPUT to a disposable workspace directory before executing.
No changes are made to the source component or its VFS.
"""
from pathlib import Path
import json
import os
import uuid


def check_editor_vfs_paths(source, output):
    output = Path(output)
    fixtures = output / 'fixtures'
    expected = {}
    for folder_name in ('first', 'second'):
        folder = fixtures / folder_name
        files = {
            'index.html': ('<p>' + folder_name + '</p>').encode(),
            'icons/logo.svg': b'<svg xmlns="http://www.w3.org/2000/svg"/>',
            'nested/index.html': b'<p>nested</p>',
        }
        for name, data in files.items():
            target = folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        expected[folder_name] = files

    parent_comp = op('/project1')
    probe = parent_comp.copy(source, name='grape_vfs_probe_' + uuid.uuid4().hex[:8])
    failures = []
    results = []
    try:
        folder_dat = probe.op('folder1')
        virtual_files = probe.op('virtualFile')
        virtual_files.par.Echocommands = False
        for folder_name in ('first', 'second'):
            root = fixtures / folder_name
            root_setting = root.as_posix() if folder_name == 'first' else os.path.relpath(root, project.folder)
            probe.par.Rootfolder = root_setting
            reflects_root = (Path(project.folder) / folder_dat.par.rootfolder.eval()).resolve() == root.resolve()
            if not reflects_root:
                failures.append('folder1 does not follow Rootfolder: ' + folder_name)
                # Isolate the naming bug as well, without importing product files.
                folder_dat.par.rootfolder = root.as_posix()
            folder_dat.par.refreshpulse.pulse()
            folder_dat.cook(force=True)
            virtual_files.AddFromTable(table=folder_dat)
            actual_names = {file.name for file in virtual_files.vfs.find()}
            wanted = set(expected[folder_name])
            if actual_names != wanted:
                failures.append('VFS names are not relative asset paths: ' + folder_name)
            content_matches = actual_names == wanted and all(
                bytes(virtual_files.vfs[name].byteArray) == data
                for name, data in expected[folder_name].items()
            )
            if not content_matches:
                failures.append('embedded bytes do not match current folder: ' + folder_name)
            results.append({
                'folder': folder_name,
                'reflectsRoot': reflects_root,
                'relativeNames': actual_names == wanted,
                'contentsMatch': content_matches,
                'actualNames': sorted(actual_names),
            })
        return {'passed': not failures, 'failures': failures, 'cases': results}
    finally:
        probe.destroy()


result = check_editor_vfs_paths(op('/TD_Grape/GrapeEditor'), GRAPE_VFS_TEST_OUTPUT)
print(json.dumps(result, ensure_ascii=False))
Path(GRAPE_VFS_TEST_OUTPUT, 'latest-result.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8'
)
assert result['passed'], '; '.join(result['failures'])
