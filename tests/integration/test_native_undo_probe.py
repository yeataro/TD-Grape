"""Native integration probe: isolated TD process only, no original-process Undo.
Requires me.storage originalPid/reportFolder and reportFolder/expected.json.
Clears this research process history and quits it at completion.
Never activate directly in a user working project.
"""
import copy,json,os,time,traceback
from pathlib import Path
import numpy as np
started=time.monotonic();phase=0;step=0;actions=[];checks=[];observations={};context={}

def block(name,fn):
    ui.undo.startBlock('Sgrape research: '+name)
    try:fn()
    finally:ui.undo.endBlock()

def capture():return {'undo':list(ui.undo.undoStack),'redo':list(ui.undo.redoStack)}

def shader_graph(core):
    graph=core.demo_graph('tint',target='top')
    graph['declarations'].append({'id':'undo_uniform','kind':'uniform','name':'uUndoTint','type':'vec4','value':[.7,.3,1,1],'expose':True})
    graph['stages']['pixel']['nodes']=[core.node('uniform','tint',declarationId='undo_uniform') if n['id']=='tint' else n for n in graph['stages']['pixel']['nodes']]
    for declaration in graph['declarations']:declaration['expose']=True
    return graph

def initialize():
    original=me.fetch('originalPid',0)
    assert isinstance(original,int) and original>0 and original!=os.getpid(),'Isolated process required'
    assert not op('/TD_RemoteDebug') and not op('/sgrape_devbridge/runner').par.active.eval(),'Use the isolated verification driver only'
    assert ui.undo.globalState,'Undo is disabled in the research process'
    observations['initialUndoState']=bool(ui.undo.state)
    root=op('/').create(baseCOMP,'sgrape_undo_research');root.store('isolatedUndoResearch',True)
    p=root.appendCustomPage('Research');p.appendFloat('Value');p.appendFloat('Other');root.par.Value=.2;root.par.Other=.7
    dat=root.create(textDAT,'text');dat.text='before'
    root.store('testValue','before')
    m=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False));r=m.op('runtime').module
    graph=shader_graph(r.core())
    shader=r.create_shader(root,'Shader',graph,'top')
    external=root.create(constantTOP,'ExternalBlue');external.par.colorr=.1;external.par.colorg=.2;external.par.colorb=.9
    context.update(root=root,dat=dat,runtime=r,shader=shader,state=shader.op('state').text,manifest=shader.op('manifest').text)
    ui.undo.clear()
    assert not ui.undo.undoStack and not ui.undo.redoStack

    def plain():
        root.par.Value=.25
        observations['plainPythonAssignment']=capture()
        ui.undo.clear();root.par.Value=.2
    actions.append(plain)
    actions.append(lambda:block('numeric parameter',lambda:setattr(root.par.Value,'val',.4)))
    def numeric_check():
        assert root.par.Value.eval()==.4
        assert len(ui.undo.undoStack)==1
        observations['numericBlock']=capture();ui.undo.undo()
    actions.append(numeric_check)
    def numeric_undone():assert root.par.Value.eval()==.2;ui.undo.redo()
    actions.append(numeric_undone)
    def numeric_redone():
        assert root.par.Value.eval()==.4
        checks.append('standard parameter block provides native Undo and Redo across frames')
        ui.undo.clear();root.par.Value=.2;root.par.Other=.7
    actions.append(numeric_redone)

    actions.append(lambda:block('Shader parameter',lambda:setattr(root.par.Value,'val',.6)))
    actions.append(lambda:block('unrelated TD parameter',lambda:setattr(root.par.Other,'val',.9)))
    def unrelated_first():observations['interleavedHistory']=capture();ui.undo.undo()
    actions.append(unrelated_first)
    def unrelated_undone():assert root.par.Other.eval()==.7 and root.par.Value.eval()==.6;ui.undo.undo()
    actions.append(unrelated_undone)
    def shader_undone():
        assert root.par.Value.eval()==.2 and root.par.Other.eval()==.7
        checks.append('global Undo follows the latest TD action; it cannot be blindly used as per-Shader Undo')
        ui.undo.clear();root.par.Value.expr='0.125';root.par.Value.mode=ParMode.EXPRESSION
    actions.append(shader_undone)
    def set_constant():root.par.Value.mode=ParMode.CONSTANT;root.par.Value.val=.55
    actions.append(lambda:block('parameter mode',set_constant))
    actions.append(lambda:ui.undo.undo())
    def expression_restored():
        assert root.par.Value.mode==ParMode.EXPRESSION and root.par.Value.expr=='0.125' and root.par.Value.eval()==.125
        checks.append('native parameter undo restores Expression mode and expression text')
        ui.undo.clear()
    actions.append(expression_restored)

    actions.append(lambda:block('DAT text',lambda:setattr(dat,'text','after')))
    def dat_record():observations['datBeforeUndo']=capture();ui.undo.undo()
    actions.append(dat_record)
    def dat_after():
        observations['datTextAfterUndo']=dat.text
        ui.undo.clear();root.store('testValue','before')
    actions.append(dat_after)
    actions.append(lambda:block('storage',lambda:root.store('testValue','after')))
    def storage_record():observations['storageBeforeUndo']=capture();ui.undo.undo()
    actions.append(storage_record)
    def storage_after():
        observations['storageAfterUndo']=root.fetch('testValue');ui.undo.clear()
        context['callbackValue']='before';context['callbackEvents']=[]
    actions.append(storage_after)
    def callback(isUndo,info):
        context['callbackValue']=info['before'] if isUndo else info['after'];context['callbackEvents'].append(bool(isUndo))
    def add_callback():
        context['callbackValue']='after';ui.undo.addCallback(callback,{'before':'before','after':'after'})
    actions.append(lambda:block('callback data',add_callback))
    actions.append(lambda:ui.undo.undo())
    def callback_undone():assert context['callbackValue']=='before';ui.undo.redo()
    actions.append(callback_undone)
    def callback_redone():
        assert context['callbackValue']=='after' and context['callbackEvents']==[True,False]
        checks.append('callback-only undo can preserve custom data independently of native OP edits')
        ui.undo.clear()
    actions.append(callback_redone)

    def uniform_change():
        with r.shader_context(shader):
            snapshot=r.uniform_snapshot();ident=next(iter(snapshot['uniforms']));row=snapshot['uniforms'][ident];item=row['components'][0]
            assert item['writable'];context.update(uniformId=ident,uniformBefore=item['value'],uniformPar=item['parameter'])
            shader.op('preview').cook(force=True);context['pixels']=shader.op('preview').numpyArray(delayed=False).copy()
            r.set_uniform_value({'declarationId':ident,'component':0,'value':.3,'revision':snapshot['revision'],'expected':item})
    actions.append(uniform_change)
    def uniform_record():
        assert shader.op('state').text==context['state'] and shader.op('manifest').text==context['manifest']
        assert getattr(shader.par,context['uniformPar']).eval()==.3
        observations['uniformHistory']=capture();assert len(ui.undo.undoStack)==1;ui.undo.undo()
    actions.append(uniform_record)
    def uniform_undone():
        assert getattr(shader.par,context['uniformPar']).eval()==context['uniformBefore']
        assert shader.op('state').text==context['state'] and shader.op('manifest').text==context['manifest']
        shader.op('preview').cook(force=True);delta=float(np.abs(shader.op('preview').numpyArray(delayed=False)-context['pixels']).max())
        assert delta<=1/255+.00001;observations['uniformUndoPixelDelta']=delta
        with r.shader_context(shader):assert r.uniform_snapshot()['uniforms'][context['uniformId']]['components'][0]['value']==context['uniformBefore']
        checks.append('accepted Uniform write records one guarded callback with unchanged Graph/revision/GLSL and restored GPU output')
        ui.undo.redo()
    actions.append(uniform_undone)
    def uniform_redone():
        assert getattr(shader.par,context['uniformPar']).eval()==.3 and shader.op('state').text==context['state']
        checks.append('native Redo restores the Uniform value without recompiling the Graph')
        ui.undo.clear()
        getattr(shader.par,context['uniformPar']).mode=ParMode.EXPRESSION
        getattr(shader.par,context['uniformPar']).expr='0.25'
    actions.append(uniform_redone)
    def rejected_uniform():
        with r.shader_context(shader):
            snapshot=r.uniform_snapshot();item=snapshot['uniforms'][context['uniformId']]['components'][0]
            try:r.set_uniform_value({'declarationId':context['uniformId'],'component':0,'value':.8,'revision':snapshot['revision'],'expected':item})
            except RuntimeError:pass
            else:raise AssertionError('Controlled Uniform write was allowed')
    actions.append(rejected_uniform)
    def rejected_check():
        assert not ui.undo.undoStack and getattr(shader.par,context['uniformPar']).mode==ParMode.EXPRESSION
        checks.append('rejected driven Uniform creates no native Undo entry and preserves control mode')
    actions.append(rejected_check)

    def texture_change():
        with r.shader_context(shader):
            snapshot=r.uniform_snapshot();ident=next(iter(snapshot['textures']));item=snapshot['textures'][ident]['components'][0]
            assert item['writable'];context.update(textureId=ident,textureBefore=item['value'],texturePar=item['parameter'])
            shader.op('preview').cook(force=True);context['texturePixels']=shader.op('preview').numpyArray(delayed=False).copy()
            r.set_uniform_value({'declarationId':ident,'component':0,'value':external.path,'revision':snapshot['revision'],'expected':item})
    actions.append(texture_change)
    def texture_record():
        assert str(getattr(shader.par,context['texturePar']).val)==external.path
        assert len(ui.undo.undoStack)==1;ui.undo.undo()
    actions.append(texture_record)
    def texture_undone():
        assert str(getattr(shader.par,context['texturePar']).val)==context['textureBefore']
        assert shader.op('state').text==context['state'] and shader.op('manifest').text==context['manifest']
        shader.op('preview').cook(force=True);delta=float(np.abs(shader.op('preview').numpyArray(delayed=False)-context['texturePixels']).max())
        assert delta<=1/255+.00001;observations['textureUndoPixelDelta']=delta
        checks.append('native Undo restores exposed texture reference, Graph state and GPU output')
        ui.undo.redo()
    actions.append(texture_undone)
    def texture_redone():
        assert str(getattr(shader.par,context['texturePar']).val)==external.path
        checks.append('native Redo restores the exposed TOP reference')
    actions.append(texture_redone)

    def prepare_foreign_mode():
        ui.undo.clear();p=getattr(shader.par,context['uniformPar']);p.mode=ParMode.CONSTANT;p.val=.7
    actions.append(prepare_foreign_mode)
    def mode_source_write():
        with r.shader_context(shader):
            snap=r.uniform_snapshot();item=snap['uniforms'][context['uniformId']]['components'][0]
            r.set_uniform_value({'declarationId':context['uniformId'],'component':0,'value':.3,'revision':snap['revision'],'expected':item})
    actions.append(mode_source_write)
    def foreign_mode():
        p=getattr(shader.par,context['uniformPar']);p.expr='0.91';p.mode=ParMode.EXPRESSION
    actions.append(foreign_mode)
    actions.append(lambda:ui.undo.undo())
    def foreign_mode_result():
        p=getattr(shader.par,context['uniformPar']);observations['unrecordedExpressionAfterUndo']={'mode':str(p.mode),'expr':p.expr,'value':p.eval()}
        assert p.mode==ParMode.EXPRESSION and p.expr=='0.91' and p.eval()==.91
        ui.undo.redo()
    actions.append(foreign_mode_result)
    def skipped_mode_redo():
        p=getattr(shader.par,context['uniformPar']);assert p.mode==ParMode.EXPRESSION and p.expr=='0.91'
        checks.append('external Expression survives both skipped Undo and Redo')
        ui.undo.clear();p.mode=ParMode.CONSTANT;p.val=.7
    actions.append(skipped_mode_redo)
    actions.append(mode_source_write)
    actions.append(lambda:setattr(getattr(shader.par,context['uniformPar']),'val',.9))
    actions.append(lambda:ui.undo.undo())
    def foreign_value_result():
        p=getattr(shader.par,context['uniformPar']);observations['unrecordedConstantAfterUndo']={'mode':str(p.mode),'value':p.eval()}
        assert p.eval()==.9
        checks.append('external constant value is preserved by guarded Undo')
        ui.undo.clear()
        victim=root.create(baseCOMP,'Victim');victim.appendCustomPage('Test').appendFloat('Value');victim.par.Value=.1;context['victim']=victim;context['victimId']=victim.id
    actions.append(foreign_value_result)
    actions.append(lambda:r.set_parameter_with_undo(context['victim'].par.Value,.2))
    def replace_victim():
        context['victim'].destroy();replacement=root.create(baseCOMP,'Victim');replacement.appendCustomPage('Test').appendFloat('Value');replacement.par.Value=.9;context['replacement']=replacement
    actions.append(replace_victim)
    def undo_removed():
        try:ui.undo.undo()
        except Exception as exc:observations['removedOperatorUndoError']=str(exc)
    actions.append(undo_removed)
    def replaced_result():
        replacement=root.op('Victim');observations['replacementAfterUndo']={'exists':bool(replacement),'differentIdentity':replacement.id!=context['victimId'] if replacement else None,'value':replacement.par.Value.eval() if replacement else None}
        assert replacement.par.Value.eval()==.9
        checks.append('a replacement OP at the same path is never modified')
    actions.append(replaced_result)
    def parameter_identity_setup():
        ui.undo.clear();p=context['replacement'].par.Value
        observations['parameterIdentity']={'hasValid':hasattr(p,'valid'),'hasIsSamePar':hasattr(p,'isSamePar'),'same':p.isSamePar(context['replacement'].par.Value)}
        assert p.valid and p.isSamePar(context['replacement'].par.Value)
        r.set_parameter_with_undo(p,.4);context['oldPar']=p
    actions.append(parameter_identity_setup)
    def replace_parameter():
        comp=context['replacement'];context['oldPar'].destroy();comp.customPages[0].appendFloat('Value');comp.par.Value=.4
        observations['oldParameterAfterRecreation']={'valid':context['oldPar'].valid,'same':context['oldPar'].isSamePar(comp.par.Value),'indexOld':context['oldPar'].index,'indexNew':comp.par.Value.index}
    actions.append(replace_parameter)
    actions.append(lambda:ui.undo.undo())
    def replacement_parameter_check():
        observations['sameValueReplacementParameterAfterUndo']=context['replacement'].par.Value.eval()
        assert context['replacement'].par.Value.eval()==.4
        checks.append('same-name same-value recreated parameter is preserved using its index')
        ui.undo.clear()
    actions.append(replacement_parameter_check)

    def unchanged_write():
        p=context['replacement'].par.Value;r.set_parameter_with_undo(p,p.val)
        assert not ui.undo.undoStack
        checks.append('same-value writes create no history item')
    actions.append(unchanged_write)

    def renamed_owner_write():
        context['replacement'].par.Value=.6
        r.set_parameter_with_undo(context['replacement'].par.Value,.7)
        context['replacement'].name='Renamed'
    actions.append(renamed_owner_write)
    actions.append(lambda:ui.undo.undo())
    def renamed_owner_check():
        assert context['replacement'].par.Value.eval()==.6
        checks.append('owner rename preserves identity and valid Undo')
        ui.undo.clear()
    actions.append(renamed_owner_check)

    def interleave_guarded():
        r.set_parameter_with_undo(context['replacement'].par.Value,.7)
    actions.append(interleave_guarded)
    actions.append(lambda:block('separate TD edit',lambda:setattr(root.par.Other,'val',.8)))
    actions.append(lambda:ui.undo.undo())
    def separate_undo_check():
        assert root.par.Other.eval()==.7 and context['replacement'].par.Value.eval()==.7
        ui.undo.undo()
    actions.append(separate_undo_check)
    def guarded_after_separate():
        assert context['replacement'].par.Value.eval()==.6
        checks.append('interleaved native TD history remains in its original order')
    actions.append(guarded_after_separate)
    def multiple_writes():
        ui.undo.clear();p=context['replacement'].par.Value
        r.set_parameter_with_undo(p,.7);r.set_parameter_with_undo(p,.8)
    actions.append(multiple_writes)
    def multiple_record():
        observations['multipleWritesSameFrame']=capture();ui.undo.undo()
    actions.append(multiple_record)
    def multiple_undone():
        assert context['replacement'].par.Value.eval()==.6
        ui.undo.redo()
    actions.append(multiple_undone)
    def multiple_redone():
        assert context['replacement'].par.Value.eval()==.8
        checks.append('multiple writes in one TD callback undo and redo in the correct order')
        ui.undo.clear()
    actions.append(multiple_redone)

    def controlled_redo_prepare():
        r.set_parameter_with_undo(context['replacement'].par.Value,.7)
    actions.append(controlled_redo_prepare)
    actions.append(lambda:ui.undo.undo())
    def controlled_redo_change():
        p=context['replacement'].par.Value;p.expr='0.83';p.mode=ParMode.EXPRESSION
    actions.append(controlled_redo_change)
    actions.append(lambda:ui.undo.redo())
    def controlled_redo_check():
        p=context['replacement'].par.Value;assert p.mode==ParMode.EXPRESSION and p.expr=='0.83'
        checks.append('control mode changed between Undo and Redo is preserved')
        ui.undo.clear();p.mode=ParMode.CONSTANT;p.val=.6
    actions.append(controlled_redo_check)

    def inactive_prepare():r.set_parameter_with_undo(context['replacement'].par.Value,.7)
    actions.append(inactive_prepare)
    actions.append(lambda:setattr(context['replacement'].par.Value,'enable',False))
    actions.append(lambda:ui.undo.undo())
    def inactive_check():
        assert context['replacement'].par.Value.eval()==.7
        checks.append('inactive exposed parameter is preserved by Undo')
        ui.undo.clear();context['replacement'].par.Value.enable=True
    actions.append(inactive_check)
    def range_prepare():
        r.set_parameter_with_undo(context['replacement'].par.Value,.8)
    actions.append(range_prepare)
    def change_range():
        p=context['replacement'].par.Value;p.min=.75;p.clampMin=True
    actions.append(change_range)
    actions.append(lambda:ui.undo.undo())
    def range_check():
        assert context['replacement'].par.Value.eval()==.8
        checks.append('changed parameter limits do not silently clamp an Undo')
        ui.undo.clear()
    actions.append(range_check)

    def actual_texture_write(value):
        with r.shader_context(shader):
            snapshot=r.uniform_snapshot();item=snapshot['textures'][context['textureId']]['components'][0]
            return r.set_uniform_value({'declarationId':context['textureId'],'component':0,'value':value,'revision':snapshot['revision'],'expected':item})
    def source_removed_prepare():
        ui.undo.clear();getattr(shader.par,context['texturePar']).val=external.path
        actual_texture_write('')
        observations['sourceBeforeReplacement']={'value':str(getattr(shader.par,context['texturePar']).val),'history':capture(),'scriptUndoState':bool(ui.undo.state),'sourceId':external.id}
    actions.append(source_removed_prepare)
    def replace_source():
        path=external.path;external.destroy();new=root.create(constantTOP,'ExternalBlue');new.par.colorr=.9
        assert new.path==path;context['newExternal']=new
        observations['sourceAfterReplacement']={'oldValid':external.valid,'newId':new.id,'history':capture()}
    actions.append(replace_source)
    actions.append(lambda:ui.undo.undo())
    def source_replaced_check():
        observations['sourceAfterUndo']={'value':str(getattr(shader.par,context['texturePar']).val),'history':capture()}
        assert str(getattr(shader.par,context['texturePar']).val)==''
        checks.append('Undo cannot reconnect a replaced TOP at the same path')
        ui.undo.clear()
    actions.append(source_replaced_check)

    actions.append(lambda:actual_texture_write(context['newExternal'].path))
    actions.append(lambda:ui.undo.undo())
    def source_delete_after_undo():
        assert str(getattr(shader.par,context['texturePar']).val)==''
        context['newExternal'].destroy()
    actions.append(source_delete_after_undo)
    actions.append(lambda:ui.undo.redo())
    def deleted_source_redo_check():
        assert str(getattr(shader.par,context['texturePar']).val)==''
        checks.append('Redo preserves the current source when its recorded TOP no longer exists')
        ui.undo.clear()
    actions.append(deleted_source_redo_check)

    def shader_identity_prepare():
        p=getattr(shader.par,context['uniformPar']);p.mode=ParMode.CONSTANT;p.val=.7
        with r.shader_context(shader):
            snapshot=r.uniform_snapshot();item=snapshot['uniforms'][context['uniformId']]['components'][0]
            r.set_uniform_value({'declarationId':context['uniformId'],'component':0,'value':.3,'revision':snapshot['revision'],'expected':item})
    actions.append(shader_identity_prepare)
    def replace_shader_identity():
        context['oldShaderId']=shader.fetch('sgrapeShaderId');shader.store('sgrapeShaderId','replacement-shader')
    actions.append(replace_shader_identity)
    actions.append(lambda:ui.undo.undo())
    def shader_identity_check():
        assert getattr(shader.par,context['uniformPar']).eval()==.3
        checks.append('changed Shader identity is preserved')
        shader.store('sgrapeShaderId',context['oldShaderId']);ui.undo.clear()
    actions.append(shader_identity_check)

    def manager_removal_prepare():
        p=getattr(shader.par,context['uniformPar']);p.val=.7
        r.set_parameter_with_undo(p,.3)
    actions.append(manager_removal_prepare)
    def remove_manager():
        m.op('lifecycle').par.active=False;r.stop();m.destroy()
    actions.append(remove_manager)
    actions.append(lambda:ui.undo.undo())
    def removed_manager_check():
        assert getattr(shader.par,context['uniformPar']).eval()==.7
        assert shader.op('state').text==context['state']
        checks.append('existing parameter callback survives manager removal without changing Graph state')
        ui.undo.redo()
    actions.append(removed_manager_check)
    def removed_manager_redo():
        assert getattr(shader.par,context['uniformPar']).eval()==.3
        checks.append('existing parameter callback can Redo after manager removal')
    actions.append(removed_manager_redo)
    def disabled_undo_write():
        ui.undo.clear();ui.undo.globalState=False
        try:r.set_parameter_with_undo(root.par.Other,.6);observations['globalUndoWhileDisabled']=ui.undo.globalState
        finally:ui.undo.globalState=True
        observations['disabledGlobalUndoWrite']={'value':root.par.Other.eval(),'history':capture(),'enabledAfter':ui.undo.globalState}
        ui.undo.clear()
        assert observations['disabledGlobalUndoWrite']['value']==.6 and not observations['disabledGlobalUndoWrite']['history']['undo']
        checks.append('global Undo preference is respected without an empty history block')
    actions.append(disabled_undo_write)






def finish():
    folder=Path(me.fetch('reportFolder'));expected=json.loads((folder/'expected.json').read_text(encoding='utf-8'))
    for path,record in expected['shaders'].items():
        s=op(path);assert json.loads(s.op('state').text)==record['state']
        assert s.op('pixel_shader').text+(s.op('vertex_shader').text if s.op('vertex_shader') else '')==record['code']
    assert not op('/TD_RemoteDebug') and not op('/sgrape_devbridge/runner').par.active.eval()
    return {'passed':True,'researchOnly':True,'newProcess':True,'pid':os.getpid(),'originalPid':me.fetch('originalPid'),'checks':checks,'observations':observations,'formalProductPreserved':True,'formalGraphsPreserved':True}

def onFrameStart(frame):
    global phase,step
    if os.getpid()==me.fetch('originalPid') or phase==3:return
    folder=Path(me.fetch('reportFolder'))
    try:
        if phase==0:
            if time.monotonic()-started<3:return
            r=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module
            if r._family_pending and time.monotonic()-started<25:return
            initialize();phase=1;return
        if phase==1:
            if step<len(actions):actions[step]();step+=1;return
            (folder/'results.json').write_text(json.dumps(finish(),indent=2),encoding='utf-8');phase=2
    except Exception:
        (folder/'results.json').write_text(json.dumps({'passed':False,'pid':os.getpid(),'step':step,'checks':checks,'observations':observations,'error':traceback.format_exc()},indent=2),encoding='utf-8');phase=2
    if phase==2:phase=3;project.quit(force=True)
