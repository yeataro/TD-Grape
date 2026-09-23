from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[2]/'src/editor'
data=json.loads((root/'locales.json').read_text(encoding='utf-8'))
refs=set()
for script in root.glob('*.js'):
    refs.update(re.findall(r"\bt\('([^']+)'\)",script.read_text(encoding='utf-8')))
refs.discard('code.');refs.discard('code.add.');refs.update('code.'+k for k in ('inputs','outputs','add.inputs','add.outputs','up','down'));
refs.discard('help.top.'); refs.update(['help.top.uv','help.top.texture','help.top.pixel_out']); refs.discard('help.'); refs.discard('panel.')
refs.discard('category.')
refs.discard('library.source.');refs.discard('library.search.')
refs.update('library.source.'+key for key in ('shader','builtin','personal'))
refs.update('library.search.'+key for key in ('nodes','functions','examples'))
refs.discard('import.');refs.discard('import.repair.')
refs.discard('upgrade.')
refs.update('upgrade.'+key for key in ('node','unknownBaseline','unknownRevision','behavior','missingDefinition','emitterAbiVersion','targetShellVersion','old','new'))
refs.discard('upgrade.node')
refs.update('import.'+key for key in ('checking','valid','repairable','blocked','newer'))
refs.update('import.repair.'+key for key in ('position','edge','declarations'))
import sgrape_core
refs.update(d['descriptionKey'] for d in sgrape_core.CATALOG.values())
refs.update(f['descriptionKey'] for f in sgrape_core.function_library() if f.get('descriptionKey'))
refs.update(['panel.parameters','panel.settings'])
refs.update(re.findall(r'data-i18n(?:-placeholder|-label|-alt|-title)?="([^"]+)"',(root/'index.html').read_text(encoding='utf-8')))
refs.update('texture.'+key for key in ('current','currentEmpty','effective','invalid','connected','updated','mode','filterMode','sourceMode','default','filterHint','sourceHint'))
refs.discard('browser.category.');refs.discard('browser.source.')
refs.update('browser.category.'+key for key in ('inputs','math','vector','matrix','logic','color','coordinate','texture','data','shader','uncategorized'))
refs.update('browser.source.'+key for key in ('all','glsl','td','editor','personal','project'))
refs.discard('browser.branch.');refs.update('browser.branch.'+key for key in ('uniforms','samplers','arithmetic','interpolation','range','trigonometry','exponential'))
# Navigation is generated from catalog metadata; validate every dynamic label.
browser=json.loads(re.search(r'<script id="node-browser-data" type="application/json">(.*?)</script>',(root/'index.html').read_text('utf-8'),re.S)[1])
source_groups=json.loads((root.parent/'library/source_catalog.json').read_text('utf-8'))['menuGroups']
refs.update('browser.category.'+key for key in browser['categories'])
branch_keys={part for row in browser['nodes'].values() for part in row.get('categoryPath',[])[1:]}
branch_keys.update(key for values in browser.get('branches',{}).values() for key in values)
refs.update(source_groups.get(key,'browser.branch.'+key) for key in branch_keys)
refs.discard('experiments.');refs.discard('experiments.cursor.')
settings=re.search(r'EDITOR_DEV_DEFAULTS = Object.freeze\(\{(.*?)\}\)',(root/'graph_ui.js').read_text(encoding='utf-8')).group(1)
for key in re.findall(r'(\w+):',settings): refs.update(['experiments.'+key,'experiments.'+key+'.hint'])
refs.update('experiments.cursor.'+value for value in ('default','move'))
refs.update('experiments.style.'+value for value in ('professional','cool','excellent','legendary','godlike'))
refs.update(['node.resize','comment.resize'])
refs.update('arrange.'+key for key in ('auto','autoReverse','left','centerX','right','top','centerY','bottom','spaceX','spaceY','grid'))
for key in refs:
    assert key in data['messages'],key
def validate_translations(key,values):
    placeholders=lambda text: sorted(re.findall(r'\{[A-Za-z_]\w*\}',text))
    for lang in data['languages']:
        assert isinstance(values.get(lang),str) and values[lang].strip(),(key,lang)
        assert placeholders(values[lang])==placeholders(values['en']),(key,lang,'placeholders')
    # Reference URLs are content, not translated identifiers (including URL fragments).
    links=lambda text: sorted(re.findall(r'\]\((https?://[^\s]+)\)',text))
    for lang in ('ja','fr','ko'):
        assert links(values[lang])==links(values['en']),(key,lang,'reference links')
for key,values in data['messages'].items(): validate_translations(key,values)
sources=json.loads((root.parent/'library/source_catalog.json').read_text('utf-8'))
source_hints=0
for group in ('builtins','nodeSources'):
    for key,item in sources[group].items():
        if 'hint' in item:
            validate_translations('source.'+key,item['hint']);source_hints+=1
print('Verified',len(data['messages']),'locale keys,',len(refs),'UI references and',source_hints,'source hints in',len(data['languages']),'languages')
