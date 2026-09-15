"""Check native creation and family lookup after the public OP naming migration."""
import json

owner=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager',False))
runtime=owner.op('runtime').module
family=owner.op('tdfam')
parent_comp=owner.parent()
initial_ids={n.id for n in parent_comp.children}
previous_shaders=dict(runtime._shaders)
previous_shader=runtime._shader
records=[]
templates={kind:runtime.master_template(kind) for kind in ('top','mat')}
def snapshot():
    return {kind:{'id':n.id,'storage':repr(n.storage),
                 'nodes':[(v.id,v.name,v.nodeX,v.nodeY,tuple(x.id for x in v.inputs)) for v in n.children],
                 'text':{key:n.op(key).text for key in ('graph','state','manifest','pixel_shader','vertex_shader') if n.op(key)}}
            for kind,n in templates.items()}
before=snapshot()
try:
    for kind,template in templates.items():
        assert template.name=='grape_'+kind
        for name in ('grape_'+kind,'sgrape_'+kind):
            source=family.GetOpSource(name)
            assert source and source[1]==template
        old_ids={n.id for n in parent_comp.children}
        # Exercise the same callback as the native Create Grape TOP/MAT pulses.
        owner.op('controls').module.onPulse(getattr(owner.par,'Create'+kind))
        added=[n for n in parent_comp.children if n.id not in old_ids]
        assert len(added)==1,[(n.name,n.id) for n in added]
        instance=added[0]
        assert instance.name.startswith('Grape_'+kind.upper())
        assert instance.storage['sgrapeShaderId']!=template.storage['sgrapeShaderId']
        assert instance.storage['sgrapeManagerId']==owner.storage['sgrapeManagerId']
        assert not instance.storage['sgrapeMaster']
        assert instance.op('graph').text==template.op('graph').text
        assert instance.op('state').text==template.op('state').text
        assert instance.op('controls').module.manager(instance)==owner
        runtime.validate_material(instance)
        records.append({'kind':kind,'created':instance.name,'nativeCompilePassed':True,
                        'graphPreserved':True,'managerResolved':True,'familyAliasesResolved':True})
        instance.destroy()
    # Check compatibility on a private fixture, never by renaming the user's master again.
    fixture=op('/grape_devbridge').create(baseCOMP,'naming_fixture')
    try:
        fixture.create(baseCOMP,'masters')
        runtime._owner=fixture
        for kind in ('top','mat'):
            old=fixture.op('masters').create(baseCOMP,'sgrape_'+kind)
            assert runtime.master_template(kind)==old
            current=fixture.op('masters').create(baseCOMP,'grape_'+kind)
            assert runtime.master_template(kind)==current
    finally:
        runtime._owner=owner
        fixture.destroy()
    assert snapshot()==before,'Creation changed a template'
finally:
    runtime._owner=owner
    for n in parent_comp.children:
        if n.id not in initial_ids:
            assert n.storage.get('sgrapeGenerated',False)
            n.destroy()
    runtime._shaders=previous_shaders
    runtime._shader=previous_shader
assert {n.id for n in parent_comp.children}==initial_ids
result={'checks':records,'legacyTemplateLookupPassed':True,'templatesUnchanged':True,
        'testInstancesRemoved':True,'version':runtime.PRODUCT_VERSION}
(GRAPE_TEST_OUTPUT/'validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
