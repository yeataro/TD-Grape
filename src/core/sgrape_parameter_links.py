"""Owned Uniform-to-COMP binds embedded in each Shader.

The last values below are detach recovery data, never an alternative value
source. Normal evaluation and edits use TouchDesigner's actual Bind masters.
"""
import copy
import math

STORE = 'grapeControlLinksV1'
CHANNELS = {'vec': ('valuex','valuey','valuez','valuew'), 'color': ('rgbr','rgbg','rgbb','alpha'), 'const': ('value',)}
_busy = False
_handles = {}


def operator(comp):
    return comp.op('shader') if comp.op('shader') else comp.op('material')


def source_pars(comp, ident):
    record = comp.fetch('grapeNativeUniformsV1', {}).get(ident)
    if not record or record.get('missing'): return []
    op = operator(comp); sequence = record['sequence']
    if sequence not in CHANNELS: return []
    found = [i for i in range(getattr(op.seq, sequence).numBlocks)
             if str(getattr(op.par, sequence+str(i)+'name').eval()) == record['name']]
    if len(found) != 1: return []
    return [getattr(op.par, sequence+str(found[0])+suffix) for suffix in CHANNELS[sequence]]


def expression(name):
    return 'parent().par.' + name


def finite(value):
    try: return math.isfinite(float(value))
    except Exception: return False


def prime(comp):
    for ident, link in comp.fetch(STORE, {}).items():
        _handles[ident] = {item['index']: getattr(comp.par, item['control'], None) for item in link['components']}


def owned(par, item):
    return str(par.mode).endswith('BIND') and par.bindExpr == expression(item['control'])


def detach(comp, ident, current=True):
    links = copy.deepcopy(comp.fetch(STORE, {})); link = links.pop(ident, None)
    if not link: return
    native = source_pars(comp, ident)
    for item in link['components']:
        if not native or item['index']>=len(native): continue
        p = native[item['index']]
        if owned(p, item):
            value = p.eval() if current and p.bindMaster is not None else item['last']
            p.mode = ParMode.CONSTANT; p.val = value
    comp.store(STORE, links); _handles.pop(ident, None)


def bind(comp, ident, controls):
    native = source_pars(comp, ident)
    if not native or len(controls) > len(native): raise RuntimeError('Uniform source is unavailable.')
    link = {'components': []}
    for i, control in enumerate(controls):
        link['components'].append({'index': i, 'control': control.name, 'last': float(control.eval())})
    links = copy.deepcopy(comp.fetch(STORE, {})); links[ident] = link
    comp.store(STORE, links); _handles[ident] = {i:p for i,p in enumerate(controls)}
    for item in link['components']: native[item['index']].bindExpr = expression(item['control'])


def sync(comp, changed=None, previous=None):
    global _busy
    if _busy: return
    _busy = True
    try:
        original = comp.fetch(STORE, {}); links = copy.deepcopy(original)
        for ident, link in list(links.items()):
            native = source_pars(comp, ident)
            if not native:
                links.pop(ident); _handles.pop(ident, None); continue
            kept = []
            for item in link['components']:
                i = item['index']
                if i>=len(native): continue
                p = native[i]
                if not owned(p, item): continue  # A native edit owns its new mode/expression.
                control = getattr(comp.par, item['control'], None)
                if control is None:
                    remembered = _handles.get(ident, {}).get(i)
                    # Native renames preserve the custom Par itself. Never use
                    # a sequence slot, global name or unrelated OP as identity.
                    if remembered is not None and remembered.valid:
                        candidate = getattr(comp.par, remembered.name, None)
                        if candidate is not None and candidate.isSamePar(remembered):
                            control = candidate; item['control'] = control.name
                            p.bindExpr = expression(control.name)
                if control is None:
                    value = item['last']
                    if changed is not None and changed.isSamePar(p) and finite(previous) and float(previous)!=value:
                        value = previous
                    p.mode = ParMode.CONSTANT; p.val = value
                    continue
                _handles.setdefault(ident, {})[i] = control
                value = p.eval()
                if finite(value): item['last'] = float(value)
                kept.append(item)
            if kept: link['components'] = kept
            else: links.pop(ident); _handles.pop(ident, None)
        if links != original: comp.store(STORE, links)
    finally: _busy = False


def onValueChange(par, *args):
    # TD builds use either (par, prev) or (par, val, prev).
    sync(parent(), par, args[-1] if args else None)


def onModeChange(par, prev):
    sync(parent())


def editable(par):
    if str(par.mode).endswith('CONSTANT'): return par
    comp=par.owner.parent()
    for ident,link in comp.fetch(STORE,{}).items():
        native=source_pars(comp,ident)
        for item in link['components']:
            if native and native[item['index']].isSamePar(par) and owned(par,item):
                master=par.bindMaster
                if master is not None and master.owner==comp and str(master.mode).endswith('CONSTANT'):
                    return master
    return None
