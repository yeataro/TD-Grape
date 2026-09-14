"""Prepare an isolated, instrumented development TOE for a fresh TD process.

The output directory must be new and outside this checkout. This never opens or
saves the source project; the probe reports in the output directory and quits
only the isolated process. Launch the printed TOE with TouchDesigner afterwards.
"""
from pathlib import Path
import argparse
import json
import re
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def dat_text(path):
    raw = path.read_bytes()
    if raw[:3] != b'2\n*' or len(raw) < 27 or len(raw) != 27 + struct.unpack('>I', raw[23:27])[0]:
        raise ValueError('Unsupported expanded DAT format: ' + path.name)
    return raw[27:].decode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--td-bin', type=Path, required=True)
    parser.add_argument('--original-pid', type=int, required=True)
    args = parser.parse_args()
    control = args.output.resolve()
    if control.exists() or control.is_relative_to(ROOT):
        parser.error('Choose a new directory outside the repository')
    control.mkdir(parents=True)
    checkout = control / 'TD-Grape'
    shutil.copytree(ROOT / 'src', checkout / 'src', ignore=shutil.ignore_patterns(
        '__pycache__', 'logs', '*.bkp*', '*.toe.dir', '*.toe.toc', '*.pending', 'TD-Grape-dev.*.toe'))
    toe = checkout / 'src/td/TD-Grape-dev.toe'
    expanded = Path(str(toe) + '.dir')
    toc = Path(str(toe) + '.toc')
    # Some TD builds return 1 after a successful expand. Validate the actual files.
    result = subprocess.run([str(args.td_bin / 'toeexpand.exe'), str(toe)], capture_output=True, text=True)
    if not toc.is_file() or not (expanded / '.build').is_file():
        raise RuntimeError(result.stdout + result.stderr)
    entries = toc.read_text(encoding='utf-8').splitlines()
    for name in entries:
        target = (expanded / name).resolve()
        if not name or not target.is_relative_to(expanded) or not target.is_file():
            raise RuntimeError('Incomplete TOE expansion: ' + name)
    version = re.search(r"PRODUCT_VERSION='([^']+)'", (ROOT / 'src/td/runtime/sgrape_runtime.py').read_text(encoding='utf-8')).group(1)
    expected = {'originalPid': args.original_pid, 'version': version, 'shaders': {}}
    for state in (expanded / 'project1').glob('*/state.text'):
        if not (state.parent / 'pixel_shader.text').is_file():
            continue
        expected['shaders']['/project1/' + state.parent.name] = {
            'state': dat_text(state), 'code': {name: dat_text(state.parent / (name + '.text'))
            for name in ('pixel_shader', 'vertex_shader') if (state.parent / (name + '.text')).is_file()}}
    assert expected['shaders'], 'No saved Shader fixtures in the development TOE'
    (control / 'expected.private.json').write_text(json.dumps(expected, indent=2), encoding='utf-8')
    sample = expanded / 'project1/TD_Sgrape/lifecycle'
    for ext in ('n', 'parm'):
        (expanded / ('grape_cold_probe.' + ext)).write_bytes(sample.with_suffix('.' + ext).read_bytes())
    code = (ROOT / 'tests/td/cold_start_probe.py').read_bytes()
    (expanded / 'grape_cold_probe.text').write_bytes(sample.with_suffix('.text').read_bytes()[:23] + struct.pack('>I', len(code)) + code)
    index = entries.index('project1.n')
    entries[index:index] = ['grape_cold_probe.' + ext for ext in ('n', 'parm', 'text')]
    # toecollapse treats CR as part of the filename, even on Windows. Always LF.
    toc.write_bytes(('\n'.join(entries) + '\n').encode('utf-8'))
    result = subprocess.run([str(args.td_bin / 'toecollapse.exe'), str(toe)], capture_output=True, text=True)
    if result.returncode or 'Unable to find file' in result.stdout + result.stderr:
        raise RuntimeError(result.stdout + result.stderr)
    print(json.dumps({'toe': str(toe), 'report': str(control / 'cold-result.json'),
                      'shaders': len(expected['shaders']), 'version': version}, indent=2))


if __name__ == '__main__':
    main()
