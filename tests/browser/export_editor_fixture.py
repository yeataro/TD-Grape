"""Refresh a browser fixture's bundled contracts without connecting to TD.

python export_editor_fixture.py BASE_STATE_JSON OUTPUT_STATE_JSON
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'core'))
import sgrape_core as core
import sgrape_document as document


def main():
    source, output = map(Path, sys.argv[1:])
    if source.resolve() == output.resolve():
        raise ValueError('The refreshed fixture must not overwrite its source')
    state = json.loads(source.read_text(encoding='utf-8-sig'))
    state.update(catalog=list(core.CATALOG.values()), typeContract=core.type_contract(),
                 catalogContract=core.catalog_contract(), functionLibrary=core.function_library())
    state['state']['graph'] = document.stamp_catalog(state['state']['graph'], core)
    state['state']['appliedHash'] = core.compile_graph(state['state']['graph'])['hash']
    target = state['state']['graph'].get('target', state.get('shaderKind', 'top'))
    state['examples'] = {
        name: document.stamp_catalog(core.normalize_top_sources(core.demo_graph(name, target))[0], core)
        for name in ('banana', 'color', 'tint')
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
