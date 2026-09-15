"""Native Inputs: clock creation, driver ownership and custom-control promotion."""
from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module
def saved():return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
before=saved();assert not op('/grape_inputs_test')
root=op('/').create(baseCOMP,'grape_inputs_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();s=manager.op('sources').module;q=manager.op('parameters').module
    for kind in ('mat','top'):
        shader=r.create_shader(root,'Test_'+kind,c.demo_graph('color',target=kind),kind);native=r.shader_operator(shader)
        with r.shader_context(shader):
            def edit(action,**body):return s.edit(r,{'action':action,'revision':s.snapshot(r)['revision'],**body})
            def row(ident):return next(d for d in s.snapshot(r)['uniforms'] if d['id']==ident)
            for preset,expr in s.PRESETS.items():
                data=edit('create',name='u'+preset.title(),type='float',preset=preset);added=next(d for d in data['uniforms'] if d['name']=='u'+preset.title());ident=added['id']
                p=getattr(native.par,added['components'][0]['parameter']);assert p.expr==expr and p.mode==ParMode.EXPRESSION,(preset,p.expr,p.mode)
                assert abs(p.eval()-eval(expr,{'me':native,'absTime':absTime}))<1e-6
                p.expr=expr+' * 0.5'
                g=copy.deepcopy(r.state()['graph']);g['stages']['pixel']['nodes'][0]['params']['value']=[.2,.1,.3,1]
                assert r.deploy(g,r.state()['revision'])['ok'];assert p.expr==expr+' * 0.5','Recompile reset a user driver'
                entry=row(ident)['components'][0]
                edit('driver',id=ident,component=0,expression=expr,expected=entry['modeExpected']);assert p.expr==expr
                try:edit('driver',id=ident,component=0,expression='0',expected=entry['modeExpected']);raise AssertionError('Stale driver accepted')
                except RuntimeError:pass
                state=q.snapshot(r)
                if not any(pg['name']=='Motion' for pg in state['pages']):q.edit(r,{'action':'page-create','name':'Motion','revision':state['revision'],'expectedPages':state['expectedPages']})
                state=q.snapshot(r);source=row(ident)
                data=q.edit(r,{'action':'bind','id':ident,'page':'Motion','sourceExpected':source['expected'],'revision':state['revision'],'expectedPages':state['expectedPages']})
                assert p.mode==ParMode.BIND and p.bindMaster is not None
                control=p.bindMaster;expected=expr.replace('me.time.','me.op('+repr(native.name)+').time.')
                assert control.expr==expected and control.mode==ParMode.EXPRESSION,(control.expr,expected)
                assert abs(control.eval()-eval(expr,{'me':native,'absTime':absTime}))<1e-6
                entry=row(ident)['components'][0];assert not entry['modeWritable']
                try:edit('driver',id=ident,component=0,expression='0',expected=entry['modeExpected']);raise AssertionError('Bind overwritten')
                except RuntimeError:pass
            checks.append(kind+': four clock presets preserve native edits, reject stale drivers and retain clock context after promotion')
            data=edit('create',name='uPaint',type='vec4',sequence='color');paint=next(d for d in data['uniforms'] if d['name']=='uPaint');assert paint['sequence']=='color',paint
            assert all(c['parameter'].startswith('color') for c in paint['components'])
            ident=paint['id'];p=getattr(native.par,paint['components'][0]['parameter']);p.val=.375
            entry=row(ident)['components'][0];edit('driver',id=ident,component=0,expression='0.25 + 0.5',expected=entry['modeExpected']);assert p.eval()==.75
            entry=row(ident)['components'][0];edit('driver',id=ident,component=0,expression='',expected=entry['modeExpected']);assert p.mode==ParMode.CONSTANT and p.eval()==.75
            entry=row(ident)['components'][0]
            try:edit('driver',id=ident,component=0,expression="float('nan')",expected=entry['modeExpected']);raise AssertionError('NaN accepted')
            except RuntimeError:pass
            assert p.mode==ParMode.CONSTANT and p.eval()==.75
            checks.append(kind+': Color creates a native Colors row; expression edits, freeze and invalid-expression rollback work')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    assert saved()==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True};(w/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
finally:root.destroy()
