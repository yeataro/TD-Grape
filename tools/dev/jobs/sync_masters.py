"""Explicitly upgrade the product Masters, preserving their OP identities.

Run after refreshing sources and reviewing the intended compiler changes.
This job is never called by product startup or by user Shader updates.
"""
import json
import uuid

owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1, 'Expected one TD-Grape manager'
owner=owners[0];runtime=owner.op('runtime').module
masters={kind:runtime.master_template(kind) for kind in ('mat','top')}
for kind,master in masters.items():
    assert master and master.parent()==owner.op('masters')
    assert master.storage.get('sgrapeMaster',False) and runtime.shader_kind(master)==kind
    with runtime.shader_context(master):
        review=runtime.upgrade_review()
        assert not review['blocked'], runtime.upgrade_summary(review)
backup=GRAPE_TEST_OUTPUT/('masters-'+uuid.uuid4().hex)
backup.mkdir()
owner.op('masters').save(str(backup/'before.tox'))
user_shaders=[n for n in op('/').findChildren() if n.storage.get('sgrapeGenerated',False) and n not in masters.values()]
def user_snapshot():
    return {n.path:{key:n.op(key).text for key in ('graph','state','manifest','pixel_shader','vertex_shader') if n.op(key)} for n in user_shaders}
before_users=user_snapshot()
previous_shaders=dict(runtime._shaders)
previous_shader=runtime._shader
before={kind:{'id':m.id,'identity':m.storage.get('sgrapeShaderId'),
              'showCustomOnly':m.showCustomOnly,'currentPage':m.currentPage,
              'positions':{n.id:(n.nodeX,n.nodeY) for n in m.children},
              'parameters':{p.name:(p,str(p.mode),p.val,p.expr,p.bindExpr) for p in m.customPars if p.name!='Version'}}
        for kind,m in masters.items()}
records=[]
try:
    for kind,master in masters.items():
        runtime.register_shader(master)
        with runtime.shader_context(master):
            if runtime.source_module():runtime.source_module().sync(runtime)
            review=runtime.prepare_upgrade_review()
            assert not review['blocked'], runtime.upgrade_summary(review)
            if review['required']:
                outcome=runtime.deploy(review['candidate'],review['revision'],upgrade_token=review['token'])
                assert outcome.get('ok'), outcome
            else:
                runtime._upgrade_tickets.pop(review.get('token'),None)
                runtime.update_shader(master)
            current=runtime.upgrade_review()
            assert not current['required'] and not current['blocked'], runtime.upgrade_summary(current)
            saved=runtime.checked_state()
            assert runtime.compiled_is_current(master,runtime.core().compile_graph(saved['graph']),saved['graph'])
        runtime.validate_material(master)
        records.append({'kind':kind,'upgraded':review['required'],'changes':review['changes'],
                        'revision':saved['revision'],'compilerBuild':json.loads(master.op('manifest').text)['compilerBuild']})
    runtime.prepare_masters()
    for kind,master in masters.items():
        baseline=before[kind]
        assert (master.id,master.storage['sgrapeShaderId'])==(baseline['id'],baseline['identity'])
        assert all((n.nodeX,n.nodeY)==baseline['positions'][n.id] for n in master.children if n.id in baseline['positions'])
        for name,(original,mode,value,expr,bind) in baseline['parameters'].items():
            p=getattr(master.par,name)
            assert p.isSamePar(original) and (str(p.mode),p.val,p.expr,p.bindExpr)==(mode,value,expr,bind), name
        # Rollback evidence belongs to this development upgrade, not to every
        # brand-new Shader copied from the product template.
        old=master.op('upgrade_backup')
        if old:
            assert old.storage.get('sgrapeUpgradeBackup',False)
            (backup/(kind+'-upgrade.json')).write_text(old.text,encoding='utf-8')
            old.destroy()
    assert user_snapshot()==before_users, 'A user Shader changed'
finally:
    for kind,master in masters.items():
        master.store('sgrapeMaster',True);master.tags.discard('sgrapeShader')
        master.showCustomOnly=before[kind]['showCustomOnly']
        master.currentPage=before[kind]['currentPage']
    runtime._shaders=previous_shaders
    runtime._shader=previous_shader
result={'masters':records,'identitiesAndPositionsPreserved':True,'userShadersPreserved':len(before_users),
        'backup':str(backup),'saved':False}
(GRAPE_TEST_OUTPUT/'sync.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
