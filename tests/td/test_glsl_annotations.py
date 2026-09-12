from pathlib import Path
import json,copy,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/project1/TD_Sgrape').op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_annotations_test')
root=op('/').create(baseCOMP,'grape_annotations_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    for kind in ('mat','top'):
        graph=c.demo_graph('color',target=kind)
        shader=r.create_shader(root,'Test_'+kind,graph,kind)
        with r.shader_context(shader):
            preview=shader.op('preview');preview.cook(force=True);pixels=preview.numpyArray(delayed=False).copy()
            graph=copy.deepcopy(r.state()['graph']);n=graph['stages']['pixel']['nodes'][0]
            n['ui'].update(label='顏色 / freely named',comment='第一行\n*/\n#error inert\u2028slash\\\n最後一行')
            n['ui']['comment']=n['ui']['comment'].replace('\\n','\n').replace('\\u2028','\u2028')
            previous_hash=r.state()['appliedHash'];previous_text=shader.op('pixel_shader').text
            result=r.deploy(graph,r.state()['revision']);assert result['ok'] and result['compileInfo']!='Graph layout saved'
            assert r.state()['appliedHash']==previous_hash and shader.op('pixel_shader').text!=previous_text
            assert '// Label: 顏色 / freely named' in shader.op('pixel_shader').text
            preview.cook(force=True);after=preview.numpyArray(delayed=False)
            assert float(abs(after-pixels).max())<1e-6
            checks.append(kind+': Unicode, multiline notes and GLSL-looking text compile without changing pixels')
            (w/(kind+'-annotated.glsl')).write_text(shader.op('pixel_shader').text,encoding='utf-8')
            changed=copy.deepcopy(r.state()['graph']);changed['stages']['pixel']['nodes'][0]['ui']['comment']='Changed note'
            update=r.deploy(changed,r.state()['revision']);assert update['compileInfo']!='Graph layout saved'
            compiled=c.compile_graph(changed);assert shader.op('pixel_shader').text==compiled['pixel']
            checks.append(kind+': comment-only edits recompile despite an unchanged semantic hash; displayed/exported code is the same')
            fn=copy.deepcopy(c.function_library()[0]);fn['scope']='local';fn['origin']=fn.pop('source');fn['id']='local_annotation_tint';fn['graph']['nodes'][1]['ui']={'x':336,'y':144,'label':'內部乘法','comment':'內部完成'}
            changed['functions']=[fn];changed['stages']['pixel']={'nodes':[{'id':'call','definitionUuid':c.CALL,'params':{'functionId':fn['id']},'ui':{'x':180,'y':140,'label':'呼叫 Tint','comment':'呼叫完成'}},c.node('pixel_out','pixel')],'edges':[c.edge('call','pixel','color','color')]}
            changed=r._owner.op('document').module.stamp_catalog(changed,c)
            result=r.deploy(changed,r.state()['revision']);assert result['ok']
            compiled=c.compile_graph(changed);lines=compiled['pixel'].splitlines();row=next(row for row in compiled['sourceMap']['pixel'] if row['node']=='multiply' and ' * ' in lines[row['line']-1])
            broken=copy.deepcopy(compiled);lines[row['line']-1]=lines[row['line']-1].replace(' = ',' = unknownAnnotationTest + ',1);broken['pixel']='\n'.join(lines)+'\n';shader.op('pixel_shader').text=broken['pixel']
            try:r.validate_material(shader,broken);raise AssertionError('Invalid native shader accepted')
            except RuntimeError as exc:
                assert exc.node=='multiply' and exc.functionId==fn['id'] and exc.trail==[fn['id']],str(exc)
            finally:shader.op('pixel_shader').text=compiled['pixel'];r.validate_material(shader,compiled)
            checks.append(kind+': native compiler errors still select the actual inner node after annotation line insertion')
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()};assert after==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True};(w/'native-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:root.destroy()
