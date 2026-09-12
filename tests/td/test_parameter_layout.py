from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/project1/TD_Sgrape').op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_parameter_layout_test')
root=op('/').create(baseCOMP,'grape_parameter_layout_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();q=manager.op('parameters').module
    for kind in ('top','mat'):
        graph=c.demo_graph('color',target=kind)
        graph['declarations'].append({'id':'gain','kind':'uniform','name':'uGain','type':'float','value':.25})
        shader=r.create_shader(root,'Test_'+kind,graph,kind)
        names=[p.name for p in shader.customPages];assert names==(['Output'] if kind=='top' else [])+['Grape '+kind.upper()],names
        controls=shader.appendCustomPage('My Controls');gain=controls.appendFloat('Gain')[0];gain.val=.7;gain.default=.2
        driver=controls.appendFloat('Driver')[0];driver.expr='me.par.Gain * 2';driver.default=.1
        other=shader.appendCustomPage('Uniforms');other.appendFloat('Useruniform')[0].val=.5
        page_name='Grape '+kind.upper()
        expected=['My Controls','Uniforms']+(['Output'] if kind=='top' else [])+[page_name]
        dats={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if shader.op(n)}
        for _ in range(2):r.arrange_shader_parameters(shader)
        assert [p.name for p in shader.customPages]==expected
        assert shader.par.Gain.isSamePar(gain) and shader.par.Driver.isSamePar(driver)
        assert gain.val==.7 and gain.default==.2 and driver.expr=='me.par.Gain * 2' and driver.eval()==1.4
        pars=next(p for p in shader.customPages if p.name==page_name).pars
        assert [p.name for p in pars]==['Openeditor','Openinbrowser','Glslparameters','Version','Outputtop' if kind=='top' else 'Material']
        assert [p.name for p in pars if p.startSection]==['Glslparameters','Version']
        assert dats=={n:shader.op(n).text for n in dats}
        with r.shader_context(shader):
            data=q.snapshot(r)
            q.edit(r,{'action':'page-create','name':'Later','expectedPages':data['expectedPages'],'revision':data['revision']})
            assert [p.name for p in shader.customPages]==['My Controls','Uniforms','Later']+expected[2:]
        checks.append(kind+': new Uniforms stay internal; custom pages precede functional pages; sort preserves Par objects, expressions, defaults and shader data')
    after={s.path:{n:s.op(n).text for n in before[s.path]} for s in original.shaders()};assert after==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
finally:root.destroy()
