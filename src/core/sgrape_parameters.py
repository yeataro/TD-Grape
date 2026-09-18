"""Native COMP custom-page editor, independent of selected-node parameters."""
import copy
import hashlib
import json
import math
import re

MIGRATED = 'grapeCustomMigratedV1'
RESERVED = {'Openeditor','Openinbrowser','Glslparameters','Version','Material','Outputtop',
            'Resolution','Width','Height','Pixelformat','Extenduv','Texturestatus'}
STYLES = {'float': ('appendFloat',1), 'vec2': ('appendFloat',2), 'vec3': ('appendFloat',3),
          'vec4': ('appendFloat',4), 'rgba': ('appendRGBA',4), 'int': ('appendInt',1),
          'uint': ('appendInt',1), 'bool': ('appendToggle',1),
          'toggle': ('appendToggle',1), 'text': ('appendStr',1),
          **{prefix+str(size): ('appendInt',size) for prefix in ('ivec','uvec','bvec') for size in (2,3,4)}}


def token(data):
    return hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def page_name(name):
    if not isinstance(name,str) or not name.strip() or len(name)>80 or any(ord(c)<32 for c in name):
        raise RuntimeError('Enter a page name of 1–80 characters.')
    return name.strip()


def available_name(comp, hint):
    stem = re.sub('[^A-Za-z0-9]','',hint or 'Control').capitalize()
    if not stem or not stem[0].isalpha(): stem = 'Control'+stem
    stem = stem[:40]; name = stem; i = 1
    while getattr(comp.parGroup,name,None) is not None or comp.pars(name+'*'):
        name=stem+str(i);i+=1
    return name


def editable_group(group):
    return group.isCustom and not any(p.name in RESERVED for p in group)


def groups(comp):
    return [g for page in comp.customPages for g in page.parGroups if editable_group(g) and not any(p.isOP for p in g)]


def ensure(runtime):
    comp=runtime.target();runtime.ensure_supported_shader(comp);runtime.checked_state()
    runtime.source_module().sync(runtime)
    source=runtime._owner.op('parameter_links')
    if source is None:raise RuntimeError('Update the Grape manager to edit custom controls.')
    links=comp.op('parameter_links')
    if links and not links.fetch('grapeControlHelper',False) and links.text!=source.text:
        raise RuntimeError('A user DAT occupies the control-helper name; its contents were preserved.')
    if not links:
        links=comp.create(parameterexecuteDAT,'parameter_links');links.text=source.text
        links.par.op=runtime.shader_operator(comp).name
        links.par.pars='vec*value* color*rgb* color*alpha'
        links.store('grapeControlHelper',True)
        links.par.builtin=True;links.par.custom=False;links.par.valuechange=True;links.par.modechange=True
        links.module.prime(comp)
    lifecycle=comp.op('parameter_lifecycle')
    if not lifecycle:
        lifecycle=comp.create(executeDAT,'parameter_lifecycle')
        lifecycle.text="def onStart():\n    parent().op('parameter_links').module.prime(parent())\ndef onCreate():\n    onStart()\n"
        lifecycle.store('grapeControlHelper',True)
        lifecycle.par.start=True;lifecycle.par.create=True
    model=links.module
    if comp.fetch('grapeNativeUniformsV1',None) is None: return model
    migrated=set(comp.fetch(MIGRATED,[]))
    graph={d['id']:d for d in runtime.state()['graph']['declarations']}
    for ident,legacy in comp.fetch('sgrapePublicUniforms',{}).items():
        if ident in migrated: continue
        controls=[getattr(comp.par,name,None) for name in legacy['parameters']]
        native=model.source_pars(comp,ident)
        decl=graph.get(ident,{})
        # Adopt only the old generated expressions. User-authored native
        # expressions/exports/binds keep ownership of their own fields.
        if native and all(p is not None for p in controls) and decl.get('expose') and all(
            str(native[i].mode).endswith('EXPRESSION') and native[i].expr==model.expression(p.name)
            for i,p in enumerate(controls)):
            model.bind(comp,ident,controls)
        for p in controls:
            if p is not None and p.page.name=='Inactive Uniforms' and not p.enableExpr:p.enable=True
        migrated.add(ident)
    if sorted(migrated)!=comp.fetch(MIGRATED,[]):comp.store(MIGRATED,sorted(migrated))
    model.sync(comp)
    return model


def component(p):
    mode=str(p.mode).split('.')[-1]
    value=p.eval() if not p.isOP and (p.isNumber or p.isString) else str(p.val)
    default=p.default if not p.isOP and (p.isNumber or p.isString) else str(p.default)
    if p.isNumber:
        if not math.isfinite(float(value)):value=None
        if not math.isfinite(float(default)):default=None
    return {'name':p.name,'value':value,'default':default,
            'mode':mode,'writable':value is not None and not p.isPython and (p.isNumber or p.isString) and mode=='CONSTANT' and bool(p.enable) and not p.readOnly}


def metadata(g):
    return {'name':g.name,'label':g.label,'page':g.page.name,'style':g.style,'size':len(g),'order':g.order,
            'components':[{k:row[k] for k in ('name','default','mode','writable')} for row in map(component,g)]}


def snapshot(runtime):
    model=ensure(runtime); comp=runtime.target(); rows=[]
    bindings=comp.fetch(model.STORE,{})
    for g in groups(comp):
        meta=metadata(g); names={p.name for p in g}
        rows.append({**meta,'expected':token(meta),'components':[component(p) for p in g],
                     'sources':[ident for ident,link in bindings.items() if any(i['control'] in names for i in link['components'])],
                     'styleEditable':len(g)==4 and g.style in ('Float','RGBA') and all(str(p.mode).endswith('CONSTANT') for p in g)})
    pages=[{'name':p.name,'editable':all(editable_group(g) for g in p.parGroups),'empty':not bool(p.parGroups)} for p in comp.customPages
           if not p.parGroups or any(editable_group(g) for g in p.parGroups)]
    return {'operator':comp.path,'enabled':comp.fetch('grapeNativeUniformsV1',None) is not None,
            'revision':runtime.state()['revision'],'pages':pages,'controls':rows,
            'expectedPages':token([(p.name,[g.name for g in p.parGroups]) for p in comp.customPages])}


def create_group(comp, page, hint, style, values=None, defaults=None):
    if style not in STYLES:raise RuntimeError('Unsupported control style.')
    method,size=STYLES[style]; name=available_name(comp,hint)
    args={'size':size} if method in ('appendFloat','appendInt') else {}
    group=getattr(page,method)(name,label=hint,replace=False,**args)
    for i,p in enumerate(group):
        if style=='uint' or style.startswith('uvec'):
            p.min=0;p.max=4294967295;p.clampMin=True;p.clampMax=True
        elif style=='int' or style.startswith('ivec'):
            p.min=-2147483648;p.max=2147483647;p.clampMin=True;p.clampMax=True
        elif style.startswith('bvec'):
            # TD Toggle groups are scalar. A boolean vector uses one native
            # integer tuple restricted to 0/1; the web editor uses checkboxes.
            p.min=0;p.max=1;p.clampMin=True;p.clampMax=True
        if defaults is not None:p.default=defaults[i]
        if values is not None:p.val=values[i]
    return group


def validate_bound_value(runtime, comp, model, control, value):
    sources = runtime.source_module()
    declarations = {d['id']:d for d in sources.source_graph(runtime,comp)['declarations']}
    for ident, link in comp.fetch(model.STORE, {}).items():
        if any(item['control'] == control.name for item in link['components']):
            declaration = declarations.get(ident)
            if declaration and declaration['kind'] == 'uniform':
                sources.validate_uniform_component(declaration, value, kind=sources.native_kind(runtime,comp))
    for ident, link in comp.fetch('sgrapePublicUniforms', {}).items():
        declaration = declarations.get(ident)
        if control.name in link['parameters'] and declaration and declaration.get('expose'):
            sources.validate_uniform_component(declaration,value,kind=sources.native_kind(runtime,comp))


def edit(runtime,body):
    seen=snapshot(runtime);comp=runtime.target();model=comp.op('parameter_links').module
    if not seen['enabled']:raise RuntimeError('Apply this Shader once before editing custom controls.')
    if body.get('revision')!=seen['revision']:raise RuntimeError('Conflict: refresh before editing controls.')
    action=body.get('action')
    if action in ('page-create','page-rename','page-remove','page-move','create','bind'):
        if body.get('expectedPages')!=seen['expectedPages']:raise RuntimeError('The native pages changed. Refresh and try again.')
        if action=='page-create':
            name=page_name(body.get('name'))
            if any(p.name==name for p in comp.customPages):raise RuntimeError('A page with this name already exists.')
            comp.appendCustomPage(name)
        elif action.startswith('page-'):
            page=next((p for p in comp.customPages if p.name==body.get('page')),None)
            if page is None or not all(editable_group(g) for g in page.parGroups):raise RuntimeError('Select a user control page.')
            if action=='page-rename':
                name=page_name(body.get('name'))
                if any(p.name==name and p!=page for p in comp.customPages):raise RuntimeError('A page with this name already exists.')
                page.name=name
            elif action=='page-remove':
                if page.parGroups:raise RuntimeError('Move or remove this page’s controls first.')
                page.destroy()
            else:
                names=[p.name for p in comp.customPages];i=names.index(page.name);j=i+(-1 if body.get('direction')==-1 else 1)
                if 0<=j<len(names):names[i],names[j]=names[j],names[i];comp.sortCustomPages(*names)
        else:
            page=next((p for p in comp.customPages if p.name==body.get('page')),None)
            if page is None:raise RuntimeError('Select an existing custom page.')
            if action=='create':
                hint=page_name(body.get('name'));create_group(comp,page,hint,body.get('style'))
            else:
                native=runtime.source_module().snapshot(runtime)
                row=next((r for r in native['uniforms'] if r['id']==body.get('id')),None)
                if row is None or row['missing'] or row['expected']!=body.get('sourceExpected'):raise RuntimeError('The Uniform changed. Refresh first.')
                if row['id'] in comp.fetch(model.STORE,{}):raise RuntimeError('This Uniform already has a custom control.')
                count=runtime.core().type_components(row['type']); pars=model.source_pars(comp,row['id'])
                # Only known clocks can move without guessing how to rebase Python.
                presets=runtime.source_module().PRESETS.values()
                if any(not str(p.mode).endswith('CONSTANT') and not (str(p.mode).endswith('EXPRESSION') and p.expr in presets) for p in pars[:count]):raise RuntimeError('This Uniform is already driven in TD. Keep or detach that control first.')
                drivers=[p.expr if str(p.mode).endswith('EXPRESSION') else '' for p in pars[:count]]
                values=[p.eval() for p in pars[:count]]
                defaults=[row['default']] if count==1 else row['default']
                for value in values+defaults:
                    runtime.source_module().validate_uniform_component(row,value,kind=runtime.source_module().native_kind(runtime,comp))
                group=create_group(comp,page,row['name'],row['type'],values,defaults)
                for control,driver,p in zip(group,drivers,pars):
                    if driver:control.expr=driver.replace('me.time.', 'me.op('+repr(p.owner.name)+').time.')
                model.bind(comp,row['id'],list(group))
    else:
        row=next((g for g in seen['controls'] if g['name']==body.get('name')),None)
        if row is None or body.get('expected')!=row['expected']:raise RuntimeError('The native control changed. Refresh and try again.')
        g=getattr(comp.parGroup,row['name'])
        if action=='value':
            index=body.get('component')
            if type(index)is not int or not 0<=index<len(g):raise RuntimeError('Select a control component.')
            item=row['components'][index];p=g[index]
            if not item['writable'] or body.get('expectedValue')!=item:raise RuntimeError('This value changed or is controlled by TD.')
            value=body.get('value')
            if p.isNumber:
                runtime.core().number(int(value) if isinstance(value,bool) else value)
                validate_bound_value(runtime,comp,model,p,value)
            elif not isinstance(value,str) or len(value)>4096:raise RuntimeError('Enter a text value up to 4096 characters.')
            runtime.set_parameter_with_undo(p,value,validate=lambda value:validate_bound_value(runtime,comp,model,p,value))
        elif action=='label':
            label=body.get('label')
            if not isinstance(label,str) or len(label)>160:raise RuntimeError('Enter a label up to 160 characters.')
            g.label=label
        elif action=='page':
            page=next((p for p in comp.customPages if p.name==body.get('page')),None)
            if page is None:raise RuntimeError('Select an existing custom page.')
            g.page=page
        elif action=='move':
            names=[item.name for item in g.page.parGroups];i=names.index(g.name);j=i+(-1 if body.get('direction')==-1 else 1)
            if 0<=j<len(names) and editable_group(getattr(comp.parGroup,names[j])):
                names[i],names[j]=names[j],names[i];g.page.sort(*names)
        elif action in ('detach','remove'):
            for ident in row['sources']:model.detach(comp,ident)
            if action=='remove':g.destroy()
        elif action=='style':
            style=body.get('style')
            if not row['styleEditable'] or style not in ('vec4','rgba'):raise RuntimeError('Only constant four-component controls can switch Vector / RGBA style.')
            own={p for ident in row['sources'] for p in model.source_pars(comp,ident)}
            if any(ref not in own for p in g for ref in p.bindReferences):raise RuntimeError('This control has other native Bind references. Detach them before changing its component names.')
            attrs=[{k:getattr(p,k) for k in ('val','default','min','max','clampMin','clampMax','normMin','normMax','enable','readOnly','help','enableExpr','defaultExpr','defaultBindExpr','defaultMode','startSection')} for p in g]
            label=g.label;order=g.order;page=g.page;name=g.name
            for ident in row['sources']:model.detach(comp,ident)
            method=page.appendRGBA if style=='rgba' else page.appendFloat
            g=method(name,replace=True,**({'size':4} if style=='vec4' else {}));g.label=label;g.order=order
            for p,values in zip(g,attrs):
                for k,v in values.items():setattr(p,k,v)
            for ident in row['sources']:model.bind(comp,ident,list(g))
        elif action=='default':
            index=body.get('component');value=body.get('value')
            if type(index)is not int or not 0<=index<len(g):raise RuntimeError('Select a control component.')
            if g[index].isNumber:
                runtime.core().number(int(value) if isinstance(value,bool) else value)
                validate_bound_value(runtime,comp,model,g[index],value)
            elif not isinstance(value,str) or len(value)>4096:raise RuntimeError('Enter a text default up to 4096 characters.')
            g[index].default=value
        else:raise RuntimeError('Unknown custom-control operation.')
    if action.startswith('page-'):runtime.arrange_shader_parameters(comp)
    model.sync(comp)
    return snapshot(runtime)
