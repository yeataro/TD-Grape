"""Isolated TOP/MAT Matrix source edits, native drivers and editor history."""
from pathlib import Path
import copy
import json
import uuid

w = Path(GRAPE_TEST_OUTPUT); w.mkdir(parents=True, exist_ok=True)
owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1
original = owners[0].op('runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before_user = saved(); original_selection = original._shader
root_name = 'grape_matrix_sources_'+uuid.uuid4().hex[:8]
area = op('/').create(baseCOMP,root_name); checks = []
try:
    manager = area.create(baseCOMP,'manager'); manager.store('sgrapeManager',True); manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page = manager.appendCustomPage('Test'); page.appendStr('Updatestatus'); page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(w/'empty_personal')
    mapping = json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    runtime=manager.op('runtime').module; runtime._owner=manager
    core=runtime.core(); sources=manager.op('sources').module
    def api(method,endpoint,body=None):
        with runtime.history_native_writes():return runtime.process_shader_request(method,'/api/'+endpoint,body or {})
    def row(seen,ident='matrix'):
        return next(r for r in seen['uniforms'] if r['id']==ident)
    def edit(action,**extra):
        seen=api('GET','sources'); item=row(seen)
        return api('POST','source-edit',dict(action=action,id=item['id'],revision=seen['revision'],expected=item['matrixBinding']['expected'],**extra))
    def restore(before,after):
        return api('POST','history-restore',dict(requestId=uuid.uuid4().hex,revision=runtime.state()['revision'],
            fromToken=after['history']['token'],toToken=before['history']['token'],sourceIds=['matrix'],
            currentGraph=copy.deepcopy(after['graph']),graph=copy.deepcopy(before['graph'])))
    for kind in ('top','mat'):
        graph=core.normalize_top_sources(core.demo_graph('color',target=kind))[0]
        graph['declarations']=[{'id':'matrix','kind':'uniform','name':'uMatrix','type':'mat2x3','value':[1.,2.,3.,4.,5.,6.],'nativeSequence':'matrix'}]
        shader=runtime.create_shader(area,'Test_'+kind,graph,kind); native=runtime.shader_operator(shader)
        with runtime.shader_context(shader):
            initial=api('GET','sources'); item=row(initial); p=getattr(native.par,item['matrixBinding']['parameter'])
            assert [c['value'] for c in item['components']]==[1.,2.,3.,4.,5.,6.]
            assert all(not c['writable'] for c in item['components'])
            assert sources.matrix_literal(p.expr) is not None
            changed=edit('matrixValue',value=[6.,5.,4.,3.,2.,1.])
            assert [c['value'] for c in row(changed)['components']]==[6.,5.,4.,3.,2.,1.]
            undone=restore(initial,changed)
            assert [c['value'] for c in row(undone)['components']]==[1.,2.,3.,4.,5.,6.]
            restored=restore(changed,undone)
            assert [c['value'] for c in row(restored)['components']]==[6.,5.,4.,3.,2.,1.]
            checks.append(kind+': column-major defaults, whole matrix edit and Undo/Redo')

            table=shader.create(tableDAT,'external_matrix'); table.clear()
            for r in range(4):table.appendRow([float(10*r+c+.25) for c in range(4)])
            bound=edit('matrixBinding',mode='EXPRESSION',expression="op('external_matrix')")
            assert row(bound)['components']==[] and row(bound)['matrixBinding']['literalValues'] is None
            expression=p.expr; history_token=bound['history']['token']
            for i in range(4):
                table[0,0]=float(i)
                seen=api('GET','sources')
                assert seen['history']['token']==history_token and p.expr==expression
            updated=copy.deepcopy(runtime.state()['graph'])
            updated['stages']['pixel']['nodes'][0]['params']['value']=[.2,.4,.6,1.]
            assert runtime.deploy(updated,runtime.state()['revision'])['ok']
            assert p.expr==expression and str(p.mode).endswith('EXPRESSION')
            assert p.eval()==table
            checks.append(kind+': dynamic DAT changes are not history; recompile preserves relative native source')

            # Exposed matrices are columns of native Float controls. This
            # legacy capability remains separate from per-component Bind UI.
            literal=sources.matrix_expression(graph['declarations'][0],[7.,8.,9.,10.,11.,12.])
            edit('matrixBinding',mode='EXPRESSION',expression=literal)
            updated=copy.deepcopy(runtime.state()['graph']); updated['declarations'][0]['expose']=True
            assert runtime.deploy(updated,runtime.state()['revision'])['ok']
            public=shader.fetch('sgrapePublicUniforms')['matrix']['parameters']
            assert len(public)==6 and len({getattr(shader.par,n).parGroup.name for n in public})==2
            getattr(shader.par,public[4]).val=42.
            evaluated=p.evalExpression()
            evaluation_error=''
            if evaluated is None:
                try:eval(p.expr,{'tdu':tdu,'parent':lambda:shader})
                except Exception as exc:evaluation_error=repr(exc)
            assert evaluated is not None and evaluated[1,1]==42., {
                'parameter':p.owner.path+'.par.'+p.name, 'expression':p.expr, 'mode':str(p.mode),
                'controls':[(n,getattr(shader.par,n,None).eval() if getattr(shader.par,n,None) else None) for n in public],
                'nativeErrors':str(native.errors()), 'evaluated':str(evaluated),'evaluationError':evaluation_error}
            manager.op('parameters').module.snapshot(runtime)
            assert 'matrix' not in shader.fetch('grapeCustomMigratedV1',[])
            assert runtime.deploy(runtime.state()['graph'],runtime.state()['revision'])['ok']
            assert p.evalExpression()[1,1]==42.
            updated=copy.deepcopy(runtime.state()['graph']);updated['declarations'][0]['expose']=False
            assert runtime.deploy(updated,runtime.state()['revision'])['ok']
            assert sources.matrix_literal(p.expr)[5]==42.
            checks.append(kind+': exposed native column controls preserve values and detach as a literal')

            # All declared matrix and double types are accepted without fake
            # host precision/transport guards. GPU correctness is audited by
            # test_matrix_transport.py, separately from source configuration.
            for ty in list(sources.MATRIX_SHAPES)+['double','dvec2','dvec3','dvec4']:
                seen=api('GET','sources')
                created=api('POST','source-edit',dict(action='create',revision=seen['revision'],name='uNative_'+ty,type=ty))
                added=next(r for r in created['uniforms'] if r['name']=='uNative_'+ty)
                assert added['sequence']==('matrix' if ty in sources.MATRIX_SHAPES else 'vec')
                assert not added['missing']
            checks.append(kind+': all 18 matrix and 4 double source types retain native capability')
        runtime._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
finally:
    area.destroy()
    preserved=saved()==before_user and original._shader==original_selection and op('/'+root_name) is None
    result={'passed':preserved,'checks':checks,'existingShadersPreserved':preserved}
    (w/'matrix-sources-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    assert preserved
