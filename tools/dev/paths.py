"""Repository-relative source locations and optional private development output."""
from pathlib import Path
import hashlib
import json
import tempfile

ROOT = Path(__file__).resolve().parents[2]

def source_path(name, root=ROOT):
    root = Path(root).resolve()
    files = json.loads((root / 'src/td/source_files.json').read_text(encoding='utf-8'))
    path = (root / files[name]).resolve()
    path.relative_to(root / 'src')
    return path

def work_path(root=ROOT):
    root = Path(root).resolve()
    # This optional file is outside the public repository. A clone without an
    # enclosing private workspace runs with its own system-temporary directory.
    local = root.parent / 'private/development.json'
    if local.is_file():
        settings = json.loads(local.read_text(encoding='utf-8'))
        return (local.parent / settings['workDirectory']).resolve()
    identity = hashlib.sha256(str(root).encode()).hexdigest()[:16]
    return Path(tempfile.gettempdir()) / 'TD-Grape' / identity
