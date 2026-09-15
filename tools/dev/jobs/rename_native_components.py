"""Rename the development manager/templates without upgrading their graphs."""
import hashlib,json

owners=[n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1
owner=owners[0]
assert owner.name in ('TD_Sgrape','TD_Grape')
masters=owner.op('masters')
old_owner_path=owner.path
new_owner_path=owner.parent().path+'/TD_Grape'
assert not owner.parent().op('TD_Grape') or owner.parent().op('TD_Grape')==owner
renames=[(owner,'TD_Grape')]
templates={}
for kind in ('top','mat'):
    canonical=masters.op('grape_'+kind)
    legacy=masters.op('sgrape_'+kind)
    assert not (canonical and legacy),'Both old and new '+kind+' templates exist'
    node=canonical or legacy
    assert node and node.storage.get('sgrapeMaster',False)
    templates[kind]=node
    renames.append((node,'grape_'+kind))
paths={old_owner_path:'<manager>',new_owner_path:'<manager>'}
for node,name in renames[1:]:
    paths[node.path]='<'+name+'>'
    paths[new_owner_path+'/masters/'+name]='<'+name+'>'
def normalize(value):
    if hasattr(value,'id') and hasattr(value,'path'):return ('OP',value.id)
    text=str(value)
    for path,replacement in sorted(paths.items(),key=lambda p:-len(p[0])):text=text.replace(path,replacement)
    return text

def snapshot():
    values=[]
    for kind,component in templates.items():
        for n in [component]+component.findChildren():
            pars=[(p.name,str(p.mode),normalize(p.val) if str(p.mode).endswith('CONSTANT') else None,p.expr,p.bindExpr)
                  for p in n.pars()]
            values.append(dict(id=n.id,type=n.opType,parameters=pars,
                storage={key:normalize(value) for key,value in n.storage.items() if key!='sgrapeOwnerName'},
                inputs=[v.id for v in n.inputs],dock=n.dock.id if n.dock else None,
                xy=[n.nodeX,n.nodeY],size=[n.nodeWidth,n.nodeHeight],viewer=n.viewer,
                tags=sorted(n.tags),color=list(n.color),comment=n.comment,
                text=n.text if n.opType in ('textDAT','executeDAT','parameterexecuteDAT') else None))
    return sorted(values,key=lambda row:row['id'])

def output():
    top=templates['top']
    top.op('shader').cook(force=True);top.op('out1').cook(force=True)
    assert not top.op('shader').errors(),top.op('shader').errors()
    assert top.op('compile_info').text.count('Compiled Successfully')>=2
    pixels=top.op('out1').numpyArray(delayed=False)
    assert pixels is not None
    return hashlib.sha256(pixels.tobytes()).hexdigest()

backup=GRAPE_TEST_OUTPUT/'manager-before-naming.tox'
assert not backup.exists(),'Use a new report directory'
owner.save(str(backup))
before=snapshot();before_pixels=output()
previous_names=[(n,n.name) for n,name in renames]
owner_names=[(n,n.storage['sgrapeOwnerName']) for n in owner.findChildren() if n.storage.get('sgrapeOwnerName')==owner.name]
# Refresh source DATs without preparing masters or rewriting any template UI.
scope=dict(globals())
exec(compile((GRAPE_ROOT/'tools/dev/jobs/refresh_sources.py').read_text(encoding='utf-8'),'refresh_sources.py','exec'),scope)
refresh=scope['result']
runtime=owner.op('runtime').module
try:
    for n,name in renames:n.name=name
    for n,previous in owner_names:n.store('sgrapeOwnerName',owner.name)
    assert snapshot()==before,'Template state or layout changed'
    assert output()==before_pixels,'TOP output changed'
    family=owner.op('tdfam')
    assert family.ext.OpFamExt.fam_registry.GetFamilyOwner('Grape')==family,'TDFam owner reference broke'
    for kind,node in templates.items():
        assert runtime.master_template(kind)==node
        for name in ('sgrape_'+kind,'grape_'+kind):
            source=family.GetOpSource(name)
            assert source and source[0]=='embedded' and source[1]==node,(name,repr(source))
    assert all(not templates['top'].op(name) for name in ('input_fallback','shader_pixel','shader_info','shader_compute'))
except Exception:
    for n,name in reversed(previous_names):n.name=name
    for n,name in owner_names:n.store('sgrapeOwnerName',name)
    assert snapshot()==before,'Rollback did not preserve template state'
    raise
result={'renamed':[{'id':n.id,'from':name,'to':n.path} for n,name in previous_names],
    'sources':refresh,'templateStateAndLayoutUnchanged':True,'topOutputUnchanged':True,
    'familyLookupPassed':True,'backup':str(backup),'toeSaved':False}
(GRAPE_TEST_OUTPUT/'rename.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
