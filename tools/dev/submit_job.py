"""Submit a local development job to the explicitly enabled TD runner."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import time
import uuid
from paths import ROOT, work_path

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('script', type=Path)
    parser.add_argument('--timeout', type=float, default=30)
    parser.add_argument('--report', default=None)
    args = parser.parse_args()
    work = work_path()
    script = (ROOT / args.script).resolve()
    allowed = [ROOT / 'tools/dev/jobs', ROOT / 'tests/td', work / 'jobs']
    if script.suffix != '.py' or not any(script.is_relative_to(p.resolve()) for p in allowed):
        parser.error('Job is outside this project and its private work/jobs directory')
    queue = work / 'bridge'
    ready = queue / 'ready.json'
    if not ready.exists() or Path(json.loads(ready.read_text(encoding='utf-8'))['root']).resolve() != ROOT:
        parser.error('Open the development TOE and run tools/dev/bootstrap.py in the TD Textport first')
    identity = uuid.uuid4().hex
    report = args.report or script.stem
    (work / 'reports' / report).resolve().relative_to((work / 'reports').resolve())
    request = {'id': identity, 'script': str(script), 'report': report,
               'sha256': hashlib.sha256(script.read_bytes()).hexdigest()}
    temporary = queue / ('request-' + identity + '.tmp')
    temporary.write_text(json.dumps(request), encoding='utf-8')
    temporary.replace(queue / 'request.json')
    response = queue / ('response-' + identity + '.json')
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        if response.exists():
            data = json.loads(response.read_text(encoding='utf-8'))
            print(json.dumps(data, ensure_ascii=False, indent=2))
            return 0 if data.get('ok') else 1
        time.sleep(.1)
    print('TD did not respond; check that the project is playing and its development runner is enabled.', file=sys.stderr)
    return 1

if __name__ == '__main__':
    raise SystemExit(main())
