"""Generate editor navigation metadata without changing shader definitions."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[2]


def projection():
    sys.path.insert(0, str(ROOT / 'src/core'))
    import sgrape_core
    document = json.loads((ROOT / 'src/library/node_catalog.json').read_text('utf-8'))
    navigation = document['browser']
    nodes = {}
    for row in document['definitions']:
        meta = row['browser']
        assert meta['category'] in navigation['categories'], row['definition']['key']
        assert meta['categoryPath'][0] == meta['category']
        assert meta['source'] in ('editor', 'glsl', 'td')
        nodes[row['definition']['definitionUuid']] = meta
    functions = {f['source']['id']: f['browser'] for f in sgrape_core.function_library(with_browser=True)}
    return {**navigation, 'nodes': nodes, 'functions': functions}


def main():
    path = ROOT / 'src/editor/index.html'
    html = path.read_text('utf-8')
    pattern = r'(<script id="node-browser-data" type="application/json">).*?(</script>)'
    assert len(re.findall(pattern, html, re.S)) == 1
    data = json.dumps(projection(), ensure_ascii=False, separators=(',', ':'))
    updated = re.sub(pattern, lambda m: m[1] + data + m[2], html, flags=re.S)
    if '--check' in sys.argv:
        assert updated == html, 'Run tools/build/sync_node_browser.py to update browser metadata'
    else:
        path.write_text(updated, 'utf-8')
    print('Node browser projection matches all catalog definitions')


if __name__ == '__main__':
    main()
