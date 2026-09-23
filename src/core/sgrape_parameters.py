"""Native COMP custom-page editor, independent of selected-node parameters."""
import hashlib
import json
import math
import re
import copy

_histories = {}
TEXTURES = 'grapeCustomTexturesV1'
_texture_handles = {}


def texture_controls(comp):
    records=copy.deepcopy(comp.fetch(TEXTURES,{}))
    for key,record in records.items():
        name=record.get('parameter')
        if not name:continue
        handle_key=(comp.id,key)
        p=getattr(comp.par,name,None)
        remembered=_texture_handles.get(handle_key)
        if p is None and remembered is not None and remembered.valid:
            p=remembered;record['parameter']=p.name
        if p is not None:
            _texture_handles[handle_key]=p
            value=p.eval()
            if value is not None and hasattr(value,'path'):record['last']=value.path
            elif str(p.mode).endswith('CONSTANT') and not str(p.val).strip():record['last']=''
        else:
            record['parameter']=None
    if records!=comp.fetch(TEXTURES,{}):comp.store(TEXTURES,records)
    return records


def sampler_rows(runtime):
    comp=runtime.target();records=texture_controls(comp);rows=[]
    for d in runtime.state()['graph']['declarations']:
        if d['kind']!='sampler' or d['type']!='sampler2D':continue
        key=runtime.texture_key(d);record=records.get(key)
        legacy=comp.fetch('sgrapePublicTextures',{}).get(key,{})
        name=(record or legacy).get('parameter');p=getattr(comp.par,name,None) if name else None
        rows.append({'id':d['id'],'key':key,'name':d['name'],'type':d['type'],'managed':record is not None,
                     'expected':token([d,record and {k:v for k,v in record.items() if k!='last'},metadata(p.parGroup) if p is not None else None])})
    return rows


def validate_texture_path(comp,value):
    if not isinstance(value,str) or len(value)>2048 or any(ord(c)<32 for c in value):
        raise RuntimeError('Choose a TOP path or leave it empty for the graph default.')
    if value and not comp.op('texture_sources').module._external_allowed(comp,comp.parent().op(value)):
        raise RuntimeError('Choose an existing TOP outside this Shader and the editor.')


def bind_texture(runtime,body,seen,page):
    comp=runtime.target();row=next((r for r in sampler_rows(runtime) if r['id']==body.get('id')),None)
    if row is None or row['expected']!=body.get('sourceExpected'):raise RuntimeError('The Sampler changed. Refresh first.')
    before=body.get('before')
    if before is not None and before not in [g.name for g in page.parGroups]:raise RuntimeError('The parameter drop position changed. Refresh first.')
    records=texture_controls(comp);key=row['key'];record=records.get(key)
    legacy=comp.fetch('sgrapePublicTextures',{}).get(key,{})
    name=(record or legacy).get('parameter');p=getattr(comp.par,name,None) if name else None
    if p is not None and not editable_group(p.parGroup) and not (not record and p.page.name in ('Textures','Inactive Textures') and p.style=='TOP'):
        raise RuntimeError('Built-in pages are protected.')
    if p is None:
        spec=runtime.texture_specs(runtime.state()['graph'])[key]
        default=spec['default'][3:] if spec['default'].startswith('op:') else ''
        value=record.get('last','') if record else default
        validate_texture_path(comp,value)
        p=page.appendTOP(available_name(comp,row['name']),label=source_label(row['name']))[0]
        p.default=default;p.val=value
    if p.style!='TOP':raise RuntimeError('The native texture control must be a TOP parameter.')
    # Only the recognized legacy texture control may leave its protected page.
    # Other system parameters, including Texture Status, remain untouched.
    group=p.parGroup
    if editable_group(group):place_group(comp,group,page,before)
    else:
        group.page=page;place_group(comp,group,page,before)
    value=p.eval();last=value.path if hasattr(value,'path') else ''
    records[key]={'parameter':p.name,'last':last}
    comp.store(TEXTURES,records);_texture_handles[(comp.id,key)]=p
    legacy_specs=copy.deepcopy(comp.fetch('sgrapeTextureSources',{}))
    if key in legacy_specs:
        legacy_specs[key]['parameter']=p.name;comp.store('sgrapeTextureSources',legacy_specs)
    user_pages_first(comp)


def detach_texture(comp,group):
    records=texture_controls(comp)
    for key,record in records.items():
        if record.get('parameter') in [p.name for p in group]:
            record['parameter']=None;_texture_handles.pop((comp.id,key),None)
    comp.store(TEXTURES,records)



def source_label(name):
    label=re.sub(r'(?<=..)(?=[A-Z])',' ',name).replace('_',' ')
    return label[:1].upper()+label[1:]


def initial_range(value):
    extent=10**math.ceil(math.log10(abs(value))) if abs(value)>1 else 1
    return (-extent,0) if value<0 else (0,extent)


def user_pages_first(comp):
    comp.sortCustomPages(*([p.name for p in comp.customPages if editable_page(p)]+[p.name for p in comp.customPages if not editable_page(p)]))

MIGRATED = 'grapeCustomMigratedV1'
RESERVED = {'Openeditor','Openinbrowser','Glslparameters','Version','Material','Outputtop',
            'Resolution','Width','Height','Pixelformat','Extenduv','Texturestatus'}
PROTECTED_PAGES = {'Output','Grape TOP','Grape MAT','Sgrape TOP','Sgrape MAT','TD-Grape','TD-Sgrape'}
STYLES = {'float': ('appendFloat',1), 'vec2': ('appendFloat',2), 'vec3': ('appendFloat',3),
          'double': ('appendFloat',1), **{'dvec'+str(size):('appendFloat',size) for size in (2,3,4)},
          'vec4': ('appendFloat',4), 'rgba': ('appendRGBA',4), 'int': ('appendInt',1),
          'uint': ('appendFloat',1), 'bool': ('appendToggle',1),
          'toggle': ('appendToggle',1), 'text': ('appendStr',1),
          **{prefix+str(size): ('appendFloat' if prefix=='uvec' else 'appendInt',size) for prefix in ('ivec','uvec','bvec') for size in (2,3,4)}}


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


def editable_page(page):
    return page.name not in PROTECTED_PAGES and not any(p.name in RESERVED for g in page.parGroups for p in g)


def editable_group(group):
    return group.isCustom and editable_page(group.page)


def groups(comp):
    return [g for page in comp.customPages for g in page.parGroups]


def user_page(comp, name):
    page=next((p for p in comp.customPages if p.name==name),None)
    if page is None or not editable_page(page):raise RuntimeError('Select a user page. Built-in pages are protected.')
    return page


def place_group(comp, group, page, before=None):
    user_page(comp,group.page.name)
    names=[g.name for g in page.parGroups if g.name!=group.name]
    if before is not None and before not in names:raise RuntimeError('The parameter drop position changed. Refresh first.')
    names.insert(names.index(before) if before else len(names),group.name)
    group.page=page
    page.sort(*names)


def ensure(runtime):
    comp=runtime.target();runtime.ensure_supported_shader(comp);runtime.checked_state()
    runtime.source_module().sync(runtime)
    texture_helper=comp.op('texture_sources')
    if texture_helper is not None and texture_helper.text!=runtime.TEXTURE_SOURCE_CODE:texture_helper.text=runtime.TEXTURE_SOURCE_CODE
    source=runtime._owner.op('parameter_links')
    if source is None:raise RuntimeError('Update the Grape manager to edit custom controls.')
    links=comp.op('parameter_links')
    if links and not links.fetch('grapeControlHelper',False) and links.text!=source.text:
        raise RuntimeError('A user DAT occupies the control-helper name; its contents were preserved.')
    if not links:
        links=comp.create(parameterexecuteDAT,'parameter_links');links.text=source.text
        links.par.op=runtime.shader_operator(comp).name
        links.par.pars='vec*value* color*rgb* color*alpha const*value'
        links.store('grapeControlHelper',True)
        links.par.builtin=True;links.par.custom=False;links.par.valuechange=True;links.par.modechange=True
        links.module.prime(comp)
    if links.fetch('grapeControlHelper',False):
        if links.text!=source.text:links.text=source.text;links.module.prime(comp)
        links.par.pars='vec*value* color*rgb* color*alpha const*value'
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
        # Matrix controls drive one native expression from several numeric
        # columns, not one native Bind per component. Keep that ownership.
        if graph.get(ident,{}).get('type') in runtime.source_module().MATRIX_SHAPES: continue
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
    migrate_names(runtime,comp,model,graph)
    sync_shapes(runtime,comp,model)
    model.sync(comp)
    texture_controls(comp)
    return model


def migrate_names(runtime,comp,model,graph):
    registry=copy.deepcopy(comp.fetch('sgrapePublicUniforms',{}));changed=False
    for ident,record in registry.items():
        decl=graph.get(ident);owned=comp.fetch(model.STORE,{}).get(ident)
        if not decl or not owned or not record['parameters']:continue
        control=getattr(comp.par,record['parameters'][0],None)
        if control is None or not re.fullmatch(r'U[0-9a-f]{16}',control.parGroup.name):continue
        group=control.parGroup
        if not editable_group(group):continue
        try:removable(comp,model,group)
        except RuntimeError:continue  # Native external Bind ownership wins.
        name=available_name(comp,decl['name'])
        model.detach(comp,ident);group.name=name
        if group.label in (decl['name'],decl.get('exposeName')):group.label=source_label(decl.get('exposeName') or decl['name'])
        record['parameters']=[p.name for p in group];model.bind(comp,ident,list(group));changed=True
    if changed:comp.store('sgrapePublicUniforms',registry)


def component(p):
    mode=str(p.mode).split('.')[-1]
    value=p.eval() if not p.isOP and (p.isNumber or p.isString or p.style in ('Toggle','Menu')) else str(p.val)
    default=p.default if not p.isOP and (p.isNumber or p.isString or p.style in ('Toggle','Menu')) else str(p.default)
    if p.isOP:
        resolved=p.eval();value=resolved.path if hasattr(resolved,'path') else ' '.join(v.path for v in resolved) if isinstance(resolved,list) else str(resolved or '')
    if p.style=='Menu':value=p.menuIndex
    if p.isNumber:
        if not math.isfinite(float(value)):value=None
        if not math.isfinite(float(default)):default=None
    return {'name':p.name,'value':value,'default':default,'mode':mode,
            'writable':value is not None and not p.isPython and (p.isNumber or p.isString or p.isOP or p.isPulse or p.style in ('Toggle','Menu')) and mode=='CONSTANT' and bool(p.enable) and not p.readOnly,
            'enabled':bool(p.enable),'readOnly':bool(p.readOnly),'help':p.help,
            'min':p.min,'max':p.max,'normMin':p.normMin,'normMax':p.normMax,
            'clampMin':bool(p.clampMin),'clampMax':bool(p.clampMax)}


def metadata(g):
    return {'name':g.name,'label':g.label,'page':g.page.name,'style':g.style,'size':len(g),'order':g.order,
            'editable':editable_group(g),'section':bool(g[0].startSection),
            'menuNames':list(g[0].menuNames or []),'menuLabels':list(g[0].menuLabels or []),
            'components':[{k:v for k,v in row.items() if k!='value'} for row in map(component,g)]}


def snapshot(runtime):
    model=ensure(runtime);comp=runtime.target();rows=[];bindings=comp.fetch(model.STORE,{})
    textures=texture_controls(comp);samplers=sampler_rows(runtime)
    for g in groups(comp):
        meta=metadata(g);names={p.name for p in g}
        rows.append({**meta,'expected':token(meta),'components':[component(p) for p in g],
                     'sources':[ident for ident,link in bindings.items() if any(i['control'] in names for i in link['components'])]+[r['id'] for r in samplers if textures.get(r['key'],{}).get('parameter') in names],
                     'styleEditable':False})
    pages=[{'name':p.name,'editable':editable_page(p),'empty':not bool(p.parGroups)} for p in comp.customPages]
    return {'operator':comp.path,'enabled':comp.fetch('grapeNativeUniformsV1',None) is not None,
            'samplerSources':samplers,'revision':runtime.state()['revision'],'pages':pages,'controls':rows,'history':history_status(runtime),
            'expectedPages':token([(p.name,[g.name for g in p.parGroups]) for p in comp.customPages])}


def create_group(comp, page, hint, style, values=None, defaults=None, color=False):
    if style not in STYLES:raise RuntimeError('Unsupported control style.')
    method,size=STYLES[style]; name=available_name(comp,hint)
    if color:
        if style not in ('float','vec2','vec3','vec4'):raise RuntimeError('Color controls require floating-point components.')
        method='appendRGBA'
    args={'size':size} if method in ('appendFloat','appendInt','appendRGBA') else {}
    group=getattr(page,method)(name,label=source_label(hint),replace=False,**args)
    for i,p in enumerate(group):
        if style=='uint' or style.startswith('uvec'):
            p.min=0;p.max=4294967295;p.clampMin=True;p.clampMax=True
        elif style=='int' or style.startswith('ivec'):
            p.min=-2147483648;p.max=2147483647;p.clampMin=True;p.clampMax=True
        elif style.startswith('bvec'):
            # TD Toggle groups are scalar. A boolean vector uses one native
            # integer tuple restricted to 0/1; the web editor uses checkboxes.
            p.min=0;p.max=1;p.clampMin=True;p.clampMax=True
        if defaults is not None:p.default=float(defaults[i])
        if values is not None:p.val=float(values[i])
        p.normMin,p.normMax=initial_range(float(values[i] if values is not None else defaults[i] if defaults is not None else 0))
    return group


def validate_source_value(runtime, declaration, value):
    sources=runtime.source_module()
    sources.validate_uniform_component(declaration,value)
    if declaration['kind']=='spec_constant':sources.validate_spec_native(declaration,value)


def validate_bound_value(runtime, comp, model, control, value):
    if control.style=='TOP':validate_texture_path(comp,value);return
    declarations={d['id']:d for d in runtime.source_module().source_graph(runtime,comp)['declarations']}
    for ident,link in comp.fetch(model.STORE,{}).items():
        if any(item['control']==control.name for item in link['components']) and ident in declarations:
            validate_source_value(runtime,declarations[ident],value)
    for ident,link in comp.fetch('sgrapePublicUniforms',{}).items():
        declaration=declarations.get(ident)
        if control.name in link['parameters'] and declaration and declaration.get('expose'):
            validate_source_value(runtime,declaration,value)


CONTROL_ATTRS=('val','default','min','max','clampMin','clampMax','normMin','normMax','enable','readOnly','help','enableExpr','defaultExpr','defaultBindExpr','defaultMode','startSection','expr','bindExpr','mode')


def shape_plans(runtime,comp,graph):
    """Preflight all source-owned shape changes before Apply mutates native data."""
    helper=comp.op('parameter_links')
    if helper is None:return []
    model=helper.module;model.sync(comp)
    declarations={d['id']:d for d in graph['declarations']};plans=[]
    for ident,link in comp.fetch(model.STORE,{}).items():
        decl=declarations.get(ident);native=model.source_pars(comp,ident)
        if not decl or not native or not link['components']:continue
        control=getattr(comp.par,link['components'][0]['control'],None)
        if control is None:continue
        group=control.parGroup
        style=decl['type'];size=runtime.core().type_components(style)
        if style not in STYLES:raise RuntimeError('This bound source format is not supported by custom parameters: '+decl['name'])
        color=decl.get('nativeSequence',comp.fetch('grapeNativeUniformsV1',{}).get(ident,{}).get('sequence'))=='color'
        method=STYLES[style][0] if not color else 'appendRGBA'
        target={'appendRGBA':'RGBA','appendToggle':'Toggle','appendInt':'Int','appendFloat':'Float'}[method]
        if group.style==target and len(group)==size:continue
        if not editable_group(group):raise RuntimeError('Cannot change a source whose control is on a protected page: '+group.name)
        own=set(native)
        if any(ref.valid and ref not in own for p in group for ref in p.bindReferences):
            raise RuntimeError('Cannot automatically change '+group.name+': it has external Bind references. Its parameters were preserved.')
        if any(not str(p.mode).endswith('CONSTANT') for p in group):
            raise RuntimeError('Cannot automatically change '+group.name+': it is driven in TD. Its parameters were preserved.')
        saved=[{k:getattr(p,k) for k in CONTROL_ATTRS} for p in group]
        for attrs in saved[:size]:
            validate_source_value(runtime,decl,attrs['val']);validate_source_value(runtime,decl,attrs['default'])
        plans.append(dict(ident=ident,name=group.name,label=group.label,page=group.page.name,order=group.order,
                          oldStyle=group.style,saved=saved,method=method,size=size,decl=decl))
    return plans


def restore_shapes(comp,model,plans):
    for plan in reversed(plans):
        model.detach(comp,plan['ident'])
        method={'RGBA':'appendRGBA','Int':'appendInt','Toggle':'appendToggle','Float':'appendFloat'}[plan['oldStyle']]
        page=user_page(comp,plan['page']);args={'size':len(plan['saved'])} if method!='appendToggle' else {}
        restored=getattr(page,method)(plan['name'],label=plan['label'],replace=True,**args);restored.order=plan['order']
        for p,attrs in zip(restored,plan['saved']):
            for key,value in attrs.items():setattr(p,key,value)
        # Source configuration is restored by the enclosing Apply transaction.
        native=model.source_pars(comp,plan['ident'])
        if len(native)>=len(restored):model.bind(comp,plan['ident'],list(restored))


def apply_shapes(comp,model,plans):
    applied=[]
    try:
        for plan in plans:
            page=user_page(comp,plan['page']);size=plan['size'];decl=plan['decl'];method=plan['method']
            args={'size':size} if method!='appendToggle' else {}
            model.detach(comp,plan['ident']);applied.append(plan)
            replacement=getattr(page,method)(plan['name'],label=plan['label'],replace=True,**args);replacement.order=plan['order']
            defaults=[decl['value']] if size==1 else decl['value']
            for i,p in enumerate(replacement):
                if i<len(plan['saved']):
                    for key,value in plan['saved'][i].items():setattr(p,key,value)
                else:p.default=float(defaults[i]);p.val=float(defaults[i])
                if decl['type'].startswith(('uint','uvec')):p.min=0;p.max=4294967295;p.clampMin=True;p.clampMax=True
            model.bind(comp,plan['ident'],list(replacement))
    except Exception:
        restore_shapes(comp,model,applied);raise


def sync_shapes(runtime,comp,model):
    apply_shapes(comp,model,shape_plans(runtime,comp,runtime.state()['graph']))


def edit_operation(runtime,body):
    seen=snapshot(runtime);comp=runtime.target();model=comp.op('parameter_links').module
    if not seen['enabled']:raise RuntimeError('Apply this Shader once before editing custom controls.')
    if body.get('revision')!=seen['revision']:raise RuntimeError('Conflict: refresh before editing controls.')
    action=body.get('action')
    if action in ('create','style'):raise RuntimeError('Drag a source into Parameters. Style and Size follow the source.')
    if action in ('page-create','page-rename','page-remove','page-move','page-reorder','bind','place','page','move'):
        if body.get('expectedPages')!=seen['expectedPages']:raise RuntimeError('The native pages changed. Refresh and try again.')
    if action=='page-create':
        name=page_name(body.get('name'))
        if name in PROTECTED_PAGES or any(p.name==name for p in comp.customPages):raise RuntimeError('Use a unique user page name.')
        comp.appendCustomPage(name)
        user_pages_first(comp)
    elif action.startswith('page-'):
        page=user_page(comp,body.get('page'))
        if action=='page-rename':
            name=page_name(body.get('name'))
            if name in PROTECTED_PAGES or any(p.name==name and p!=page for p in comp.customPages):raise RuntimeError('Use a unique user page name.')
            page.name=name
        elif action=='page-remove':
            if page.parGroups:raise RuntimeError('Move or remove this page’s controls first.')
            page.destroy()
        elif action in ('page-reorder','page-move'):
            all_names=[p.name for p in comp.customPages];names=[p.name for p in comp.customPages if editable_page(p)]
            i=names.index(page.name)
            if action=='page-move':
                j=max(0,min(len(names)-1,i+(-1 if body.get('direction')==-1 else 1)))
                names[i],names[j]=names[j],names[i]
            else:
                before=body.get('before');names.remove(page.name)
                if before is not None and before not in names:raise RuntimeError('Select a user page drop position.')
                names.insert(names.index(before) if before else len(names),page.name)
            comp.sortCustomPages(*(names+[name for name in all_names if name not in names]))
        else:raise RuntimeError('Unknown page operation.')
    elif action=='bind':
        page=user_page(comp,body.get('page'))
        if any(r['id']==body.get('id') for r in seen.get('samplerSources',[])):
            bind_texture(runtime,body,seen,page);return snapshot(runtime)
        native=runtime.source_module().snapshot(runtime)
        row=next((r for r in native['uniforms']+native.get('specConstants',[]) if r['id']==body.get('id')),None)
        if row is None or row['missing'] or row['expected']!=body.get('sourceExpected'):raise RuntimeError('The source changed. Refresh first.')
        if row['type'] not in STYLES or row.get('sequence') not in ('vec','color','const'):raise RuntimeError('Only numeric Uniforms and Spec Constants can become custom parameters.')
        existing=next((g for g in seen['controls'] if row['id'] in g['sources']),None)
        if existing:
            place_group(comp,getattr(comp.parGroup,existing['name']),page,body.get('before'))
        else:
            before=body.get('before')
            if before is not None and before not in [g.name for g in page.parGroups]:raise RuntimeError('The parameter drop position changed. Refresh first.')
            count=runtime.core().type_components(row['type']);pars=model.source_pars(comp,row['id'])[:count]
            if len(pars)!=count:raise RuntimeError('The source components are unavailable.')
            presets=runtime.source_module().PRESETS.values()
            if any(not str(p.mode).endswith('CONSTANT') and not (str(p.mode).endswith('EXPRESSION') and p.expr in presets) for p in pars):raise RuntimeError('This source is already driven in TD. Keep or detach that control first.')
            drivers=[p.expr if str(p.mode).endswith('EXPRESSION') else '' for p in pars]
            values=[p.eval() for p in pars];defaults=[row['default']] if count==1 else row['default']
            for value in values+defaults:validate_source_value(runtime,row,value)
            group=create_group(comp,page,row['name'],row['type'],values,defaults,color=row.get('sequence')=='color')
            for control,driver,p in zip(group,drivers,pars):
                if driver:control.expr=driver.replace('me.time.','me.op('+repr(p.owner.name)+').time.')
            model.bind(comp,row['id'],list(group));place_group(comp,group,page,before)
    else:
        row=next((g for g in seen['controls'] if g['name']==body.get('name')),None)
        if row is None or body.get('expected')!=row['expected']:raise RuntimeError('The native control changed. Refresh and try again.')
        g=getattr(comp.parGroup,row['name'])
        if action not in ('value','pulse','color') and not row['editable']:raise RuntimeError('Built-in pages are protected.')
        if action=='color':
            edits=body.get('components')
            if row['style']!='RGBA' or not isinstance(edits,list) or not 1<=len(edits)<=min(3,len(g)):raise RuntimeError('Select color components.')
            plans=[];indices=[]
            for edit in edits:
                index=edit.get('component');value=edit.get('value')
                if type(index)is not int or not 0<=index<min(3,len(g)) or index in indices:raise RuntimeError('Select color components.')
                item=row['components'][index];p=g[index]
                if not item['writable'] or edit.get('expectedValue')!=item:raise RuntimeError('This color changed or is controlled by TD.')
                validate_bound_value(runtime,comp,model,p,value);runtime.core().number(value)
                indices.append(index);plans.append((p,value,lambda value,p=p:validate_bound_value(runtime,comp,model,p,value)))
            runtime.set_parameters_with_undo(plans)
        elif action in ('value','pulse'):
            index=body.get('component',0)
            if type(index)is not int or not 0<=index<len(g):raise RuntimeError('Select a control component.')
            item=row['components'][index];p=g[index]
            if not item['writable'] or body.get('expectedValue')!=item:raise RuntimeError('This value changed or is controlled by TD.')
            if action=='pulse':
                if not p.isPulse:raise RuntimeError('Select a Pulse parameter.')
                p.pulse()
            else:
                value=body.get('value')
                if p.isNumber or p.style in ('Toggle','Menu'):
                    runtime.core().number(int(value) if isinstance(value,bool) else value);validate_bound_value(runtime,comp,model,p,value)
                elif not isinstance(value,str) or len(value)>4096:raise RuntimeError('Enter a text value up to 4096 characters.')
                validate=lambda value:validate_bound_value(runtime,comp,model,p,value)
                if p.style=='TOP':
                    validate_texture_path(comp,value)
                    validate=runtime._texture_undo_validator(comp,p,value,comp.op('texture_sources').module._external_allowed)
                runtime.set_parameter_with_undo(p,value,validate=validate)
        elif action=='label':
            label=body.get('label')
            if not isinstance(label,str) or len(label)>160:raise RuntimeError('Enter a label up to 160 characters.')
            g.label=label
        elif action in ('page','place'):
            place_group(comp,g,user_page(comp,body.get('page')),body.get('before'))
        elif action=='move':
            names=[item.name for item in g.page.parGroups];i=names.index(g.name);j=i+(-1 if body.get('direction')==-1 else 1)
            if 0<=j<len(names):names[i],names[j]=names[j],names[i];g.page.sort(*names)
        elif action=='remove':
            removable(comp,model,g)
            for ident in row['sources']:model.detach(comp,ident)
            detach_texture(comp,g)
            g.destroy()
        elif action=='range':
            index=body.get('component');key=body.get('field');value=body.get('value')
            if type(index)is not int or not 0<=index<len(g) or not g[index].isNumber:raise RuntimeError('Select a numeric component.')
            if key not in ('normMin','normMax','min','max','clampMin','clampMax'):raise RuntimeError('Unknown range field.')
            if key.startswith('clamp'):
                if type(value)is not bool:raise RuntimeError('Choose whether to clamp this component.')
            else:runtime.core().number(value)
            proposed={k:getattr(g[index],k) for k in ('normMin','normMax','min','max','clampMin','clampMax')};proposed[key]=value
            if proposed['normMin']>=proposed['normMax']:raise RuntimeError('Range minimum must be less than maximum.')
            if proposed['clampMin'] and proposed['clampMax'] and proposed['min']>proposed['max']:raise RuntimeError('Clamp minimum must not exceed maximum.')
            current=g[index].eval()
            if (proposed['clampMin'] and current<proposed['min']) or (proposed['clampMax'] and current>proposed['max']):raise RuntimeError('This clamp would change the current source value. Adjust the value first.')
            setattr(g[index],key,value)
        elif action=='default':
            index=body.get('component');value=body.get('value')
            if type(index)is not int or not 0<=index<len(g):raise RuntimeError('Select a control component.')
            if g[index].isNumber or g.style=='Toggle':runtime.core().number(int(value) if isinstance(value,bool) else value);validate_bound_value(runtime,comp,model,g[index],value)
            elif not isinstance(value,str) or len(value)>4096:raise RuntimeError('Enter a text default up to 4096 characters.')
            if g[index].style=='TOP':validate_texture_path(comp,value)
            g[index].default=float(value) if g[index].isNumber or g.style=='Toggle' else value
        else:raise RuntimeError('Unknown custom-control operation.')
    model.sync(comp)
    return snapshot(runtime)


def removable(comp,model,group):
    if group.style not in ('Float','Int','RGBA','Toggle','Str','Menu','StrMenu','Pulse','TOP'):
        raise RuntimeError('Remove this parameter style in TD so its complete definition can be preserved: '+group.style)
    own={p for ident,link in comp.fetch(model.STORE,{}).items() if any(i['control'] in [c.name for c in group] for i in link['components']) for p in model.source_pars(comp,ident)}
    if any(ref.valid and ref not in own for p in group for ref in p.bindReferences):
        raise RuntimeError('This parameter has external Bind references. Disconnect them in TD before removing it.')


def legacy_texture_group(comp,group):
    return group.style=='TOP' and any(r.get('parameter')==group.name for r in comp.fetch('sgrapePublicTextures',{}).values()) and group.page.name in ('Textures','Inactive Textures')


def history_page(comp,meta):
    page=next((p for p in comp.customPages if p.name==meta['page']),None)
    if page is not None and meta['style']=='TOP' and meta['page'] in ('Textures','Inactive Textures') and any(r.get('parameter')==meta['name'] for r in comp.fetch('sgrapePublicTextures',{}).values()):return page
    return user_page(comp,meta['page'])


def history_capture(runtime):
    comp=runtime.target();model=comp.op('parameter_links').module
    return {'pages':[p.name for p in comp.customPages],
            'groups':{g.name:{'meta':metadata(g),'attrs':[{k:getattr(p,k) for k in CONTROL_ATTRS} for p in g]} for g in groups(comp) if editable_group(g) or legacy_texture_group(comp,g)},
            'textures':copy.deepcopy(texture_controls(comp)),
            'links':copy.deepcopy(comp.fetch(model.STORE,{})),
            'sources':[(d['id'],d['kind'],d['type']) for d in runtime.state()['graph']['declarations']]}


def history_signature(data):
    # Live values do not invalidate definition history. TD definition edits,
    # Bind ownership and source type/identity changes do.
    return token({'pages':data['pages'],'groups':{n:{'meta':g['meta'],'definitions':[{k:(v if isinstance(v,(str,int,float,bool,type(None))) else str(v)) for k,v in attrs.items() if k!='val'} for attrs in g['attrs']]} for n,g in data['groups'].items()},
                  'links':{i:[{k:v for k,v in p.items() if k!='last'} for p in l['components']] for i,l in data['links'].items()},'sources':data['sources'],'textures':{k:{n:v for n,v in r.items() if n!='last'} for k,r in data.get('textures',{}).items() if r.get('parameter')}})


def history_entry(runtime):
    comp=runtime.target();key=(comp.path,comp.id)
    return _histories.setdefault(key,{'undo':[],'redo':[]})


def history_status(runtime):
    h=history_entry(runtime)
    if not h['undo'] and not h['redo']:return {'undo':False,'redo':False}
    signature=history_signature(history_capture(runtime))
    available={kind:bool(h[kind]) and h[kind][-1]['expected']==signature for kind in ('undo','redo')}
    return {**available,'expected':signature,'changed':not any(available.values())}


def restore_definition(runtime,target):
    comp=runtime.target();model=comp.op('parameter_links').module;current=history_capture(runtime)
    before=current['groups'];after=target['groups']
    removed=set(before)-set(after);added=set(after)-set(before)
    for name in removed:removable(comp,model,getattr(comp.parGroup,name))
    for name in set(before)&set(after):
        if (before[name]['meta']['style'],before[name]['meta']['size'])!=(after[name]['meta']['style'],after[name]['meta']['size']):
            raise RuntimeError('The parameter shape changed. Refresh before editing definitions.')
        group=getattr(comp.parGroup,name)
        for p,attrs in zip(group,after[name]['attrs']):
            if p.isNumber and ((attrs['clampMin'] and p.eval()<attrs['min']) or (attrs['clampMax'] and p.eval()>attrs['max'])):
                raise RuntimeError('Restoring this clamp would change the current source value. Adjust the value first.')
    for name in added:
        if getattr(comp.parGroup,name,None) is not None or comp.pars(name+'*'):raise RuntimeError('The parameter name is now in use: '+name)
        if after[name]['meta']['style'] not in ('Float','Int','RGBA','Toggle','Str','Menu','StrMenu','Pulse','TOP'):raise RuntimeError('Restore this parameter style in TD: '+name)
    changed_links={i for i in set(current['links'])|set(target['links']) if current['links'].get(i)!=target['links'].get(i)}
    # Compare ownership separately from last-value recovery samples.
    changed_links={i for i in changed_links if [(p['index'],p['control']) for p in current['links'].get(i,{}).get('components',[])]!=[(p['index'],p['control']) for p in target['links'].get(i,{}).get('components',[])]}
    source_values={i:[p.eval() for p in model.source_pars(comp,i)] for i in changed_links}
    for i in changed_links:model.detach(comp,i)
    for name in removed:
        group=getattr(comp.parGroup,name);detach_texture(comp,group);group.destroy()
    user_names={g['meta']['page'] for g in after.values()}|{p for p in target['pages'] if p not in PROTECTED_PAGES and not any(x.name==p and not editable_page(x) for x in comp.customPages)}
    for name in target['pages']:
        if name in user_names and not any(p.name==name for p in comp.customPages):comp.appendCustomPage(name)
    for name,saved in after.items():
        meta=saved['meta'];group=getattr(comp.parGroup,name,None)
        if name in added:
            args={'size':meta['size']} if meta['style'] in ('Float','Int','RGBA') else {}
            group=getattr(history_page(comp,meta),'append'+meta['style'])(name,label=meta['label'],**args)
            if meta['style'] in ('Menu','StrMenu'):
                group[0].menuNames=meta['menuNames'];group[0].menuLabels=meta['menuLabels']
        if group.page.name!=meta['page']:group.page=history_page(comp,meta)
        if group.label!=meta['label']:group.label=meta['label']
        for index,(p,attrs) in enumerate(zip(group,saved['attrs'])):
            for attr,value in attrs.items():
                # Definition undo does not rewind live values or native drivers.
                if name not in added and attr in ('val','expr','bindExpr','mode'):continue
                if name in added or before[name]['attrs'][index][attr]!=value:setattr(p,attr,value)
    for i in changed_links:
        link=target['links'].get(i)
        if not link:continue
        controls=[getattr(comp.par,p['control']) for p in link['components']]
        for p,item in zip(controls,link['components']):
            if p.parGroup.name in added and str(p.mode).endswith('CONSTANT') and item['index']<len(source_values[i]):p.val=source_values[i][item['index']]
        model.bind(comp,i,controls)
    for page in list(comp.customPages):
        if editable_page(page) and page.name not in target['pages'] and not page.parGroups:page.destroy()
    for page in comp.customPages:
        if editable_page(page):page.sort(*(n for n,g in sorted(after.items(),key=lambda pair:pair[1]['meta']['order']) if g['meta']['page']==page.name))
    records=copy.deepcopy(target.get('textures',{}))
    for key,record in records.items():
        live=current.get('textures',{}).get(key,{})
        if 'last' in live:record['last']=live['last']
        name=record.get('parameter');p=getattr(comp.par,name,None) if name else None
        if p is not None:
            if name in added and str(p.mode).endswith('CONSTANT'):p.val=record.get('last','')
            _texture_handles[(comp.id,key)]=p
    # Undoing the initial creation also retains the last selected texture.
    for key,record in current.get('textures',{}).items():
        if key not in records:
            legacy=comp.fetch('sgrapePublicTextures',{}).get(key,{})
            if legacy.get('parameter') not in after:records[key]={'parameter':None,'last':record.get('last','')}
    comp.store(TEXTURES,records)
    comp.sortCustomPages(*target['pages']);model.sync(comp)


def edit(runtime,body):
    action=body.get('action')
    if action in ('value','pulse','color'):return edit_operation(runtime,body)
    # Validate the request before starting a definition transaction.
    seen=snapshot(runtime)
    if body.get('revision')!=seen['revision']:raise RuntimeError('Conflict: refresh before editing controls.')
    before=history_capture(runtime);h=history_entry(runtime)
    if action in ('undo','redo'):
        if body.get('expectedHistory')!=history_signature(before) or not h[action] or h[action][-1]['expected']!=history_signature(before):raise RuntimeError('Definitions changed in TD or another editor. This history cannot overwrite them.')
        entry=h[action][-1]
        try:restore_definition(runtime,entry['state'])
        except Exception:
            restore_definition(runtime,before);raise
        h[action].pop();other='redo' if action=='undo' else 'undo'
        h[other].append({'state':before,'expected':history_signature(history_capture(runtime))})
        return snapshot(runtime)
    try:result=edit_operation(runtime,body)
    except Exception:
        # Most rejections occur during preflight and require no mutation.
        if history_signature(history_capture(runtime))!=history_signature(before):restore_definition(runtime,before)
        raise
    after=history_capture(runtime)
    if history_signature(before)!=history_signature(after):
        if h['undo'] and h['undo'][-1]['expected']!=history_signature(before):h['undo'].clear()
        h['undo'].append({'state':before,'expected':history_signature(after)});del h['undo'][:-50];h['redo'].clear()
    result['history']=history_status(runtime)
    return result
