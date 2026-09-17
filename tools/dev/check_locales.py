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
refs.update(re.findall(r'data-i18n(?:-placeholder|-label|-alt)?="([^"]+)"',(root/'index.html').read_text(encoding='utf-8')))
refs.update('texture.'+key for key in ('current','currentEmpty','effective','invalid','connected','updated','mode','filterMode','sourceMode','default','filterHint','sourceHint'))
refs.discard('browser.category.');refs.discard('browser.source.')
refs.update('browser.category.'+key for key in ('inputs','math','vector','matrix','logic','color','coordinate','texture','data','shader','uncategorized'))
refs.update('browser.source.'+key for key in ('all','glsl','td','editor','personal','project'))
refs.discard('browser.branch.');refs.update('browser.branch.'+key for key in ('uniforms','samplers','arithmetic','interpolation','range','trigonometry','exponential'))
refs.discard('experiments.');refs.discard('experiments.cursor.')
settings=re.search(r'EDITOR_DEV_DEFAULTS = Object.freeze\(\{(.*?)\}\)',(root/'graph_ui.js').read_text(encoding='utf-8')).group(1)
for key in re.findall(r'(\w+):',settings): refs.update(['experiments.'+key,'experiments.'+key+'.hint'])
refs.update('experiments.cursor.'+value for value in ('default','move'))
refs.update('experiments.style.'+value for value in ('professional','cool','excellent','legendary','godlike'))
for key in refs:
    assert key in data['messages'],key
    for lang in data['languages']: assert data['messages'][key].get(lang),(key,lang)
print('Verified',len(refs),'locale keys in',len(data['languages']),'languages')
