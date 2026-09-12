"""Local, explicitly enabled TD development runner. No network listener."""
import contextlib
import hashlib
import io
import json
import time
import traceback
from pathlib import Path

ROOT = Path(project.folder).resolve().parents[1]
_paths = {'__file__': str(ROOT / 'tools/dev/paths.py')}
exec(compile((ROOT / 'tools/dev/paths.py').read_text(encoding='utf-8'), _paths['__file__'], 'exec'), _paths)
WORK = _paths['work_path'](ROOT)
QUEUE = WORK / 'bridge'
_last_poll = 0.0

def onFrameStart(frame):
    global _last_poll
    now = time.monotonic()
    if now - _last_poll < .2:
        return
    _last_poll = now
    request_path = QUEUE / 'request.json'
    if not request_path.is_file():
        return
    try:
        request = json.loads(request_path.read_text(encoding='utf-8'))
        identity = request['id']
        if not isinstance(identity, str) or not identity.isalnum() or len(identity) > 80:
            return
        response_path = QUEUE / ('response-' + identity + '.json')
        if response_path.exists():
            return
        script = Path(request['script']).resolve()
        allowed = [ROOT / 'tools/dev/jobs', ROOT / 'tests/td', WORK / 'jobs']
        if script.suffix != '.py' or not any(script.is_relative_to(p.resolve()) for p in allowed):
            raise ValueError('Job must be in tools/dev/jobs, tests/td, or this private work/jobs directory')
        source = script.read_bytes()
        if len(source) > 1000000:
            raise ValueError('Job exceeds size limit')
        if hashlib.sha256(source).hexdigest() != request['sha256']:
            return
        output = WORK / 'reports' / request.get('report', script.stem)
        output = output.resolve()
        output.relative_to((WORK / 'reports').resolve())
        output.mkdir(parents=True, exist_ok=True)
        scope = dict(globals())
        scope.update(__file__=str(script), __name__='__grape_job__', op=op('/').op,
                     GRAPE_ROOT=ROOT, GRAPE_WORK=WORK, GRAPE_TEST_OUTPUT=output,
                     source_path=lambda name: _paths['source_path'](name, ROOT), result=None)
        stream = io.StringIO()
        response = {'id': identity, 'script': str(script)}
        try:
            with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
                exec(compile(source, str(script), 'exec'), scope, scope)
            response.update(ok=True, result=scope.get('result'))
        except Exception:
            response.update(ok=False, error=traceback.format_exc())
        response.update(output=stream.getvalue()[-40000:], time=time.time())
        temporary = response_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(response, ensure_ascii=False, default=str, indent=2), encoding='utf-8')
        temporary.replace(response_path)
    except Exception:
        (QUEUE / 'runner-error.txt').write_text(traceback.format_exc(), encoding='utf-8')
