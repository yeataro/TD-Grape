"""Scoped Table COMP value tables for the installed Sgrape family only.

Keep TDFam's original state callbacks and exact operator identities. This is an
optional compatibility adapter: unrecognized layouts keep their original style.
"""
COLOR_CALLBACK=r'''def onCook(scriptOp):
    scriptOp.clear()
    source=scriptOp.inputs[0] if scriptOp.inputs else None
    palette=scriptOp.parent().fetch('sgrapeMenuPalette',None)
    if not source or not palette or source[0,'opType'] is None:return
    gain=scriptOp.fetch('sgrapeMenuGain')
    for index in range(1,source.numRows):
        color=palette.get(source[index,'opType'].val,palette[''])
        scriptOp.appendRow([min(1,max(0,channel*gain)) for channel in color]+[1])
'''

STYLE_CALLBACK=r'''def onCook(scriptOp):
    original=scriptOp.fetch('sgrapeMenuOriginal')['callback']
    original.module.onCook(scriptOp)
    values=scriptOp.parent().op(scriptOp.fetch('sgrapeMenuValues'))
    if values and scriptOp['bgcolor',0] is not None:
        scriptOp['bgcolor',1]=values.path
'''

def uninstall(layout):
    """Restore only callbacks still owned by this adapter; leave later edits alone."""
    wrapper=layout.op('sgrape_style_callbacks')
    for script in layout.children:
        saved=script.fetch('sgrapeMenuOriginal',None)
        if saved and script.OPType=='scriptDAT':
            if script.par.callbacks.eval()==wrapper:
                script.par.callbacks.val=saved['value'];script.par.callbacks.expr=saved['expr'];script.par.callbacks.mode=saved['mode']
            script.unstore('sgrapeMenuOriginal');script.unstore('sgrapeMenuValues')
    for child in list(layout.children):
        if child.valid and child.fetch('sgrapeMenuOwned',False):child.destroy()
    layout.unstore('sgrapeMenuPalette')

def install(manager,colors):
    family=manager.op('tdfam');registry=family.ext.OpFamExt.fam_registry
    family_name=family.par.Family.eval()
    if registry.GetFamilyOwner(family_name)!=family:return False
    table=op('/ui/dialogs/menu_op/nodetable');layout=table.op('layouts/'+family_name) if table else None
    source=table.op('families') if table else None
    if not layout or not source or source[0,'opType'] is None:return False
    style_names=[prefix+suffix for prefix in ['filter','generator'] for suffix in ['Default','Rollover','Disable','DisableRollover','DefaultHighlight','RolloverHighlight']]
    scripts=[]
    for name in style_names:
        final=layout.op(name);script=final.inputs[0] if final and final.inputs else None
        if not script or script.OPType!='scriptDAT' or not script.par.callbacks.eval():return False
        old=script.fetch('sgrapeMenuOriginal',None);callback=old['callback'] if old else script.par.callbacks.eval()
        if not callback or callback.parent()!=layout or 'def onCook(scriptOp):' not in callback.text:return False
        if script['bgcolor',0] is None or script['fontcolor',0] is None:return False
        scripts.append((script,callback,'Rollover' in name))
    palette={'':list(colors['family'])}
    for data in family.GetMasterOps().values():
        source_type,master=data['source']
        if source_type=='embedded' and master.fetch('sgrapeGenerated',False):
            kind=master.fetch('sgrapeTarget','mat')
            if kind in ('mat','top'):palette[data['op_type']+family_name]=list(colors[kind])
    if len(palette)<2:return False
    for name in ['sgrape_menu_rows','sgrape_color_callbacks','sgrape_style_callbacks','sgrape_colors_default','sgrape_colors_rollover']:
        child=layout.op(name)
        if child and not child.fetch('sgrapeMenuOwned',False):return False
    try:
        layout.store('sgrapeMenuPalette',palette)
        for name,code in [('sgrape_color_callbacks',COLOR_CALLBACK),('sgrape_style_callbacks',STYLE_CALLBACK)]:
            dat=layout.op(name) or layout.create(textDAT,name);dat.store('sgrapeMenuOwned',True);dat.text=code
        rows=layout.op('sgrape_menu_rows') or layout.create(selectDAT,'sgrape_menu_rows');rows.store('sgrapeMenuOwned',True);rows.par.dat=source.path
        for name,gain in [('sgrape_colors_default',.72),('sgrape_colors_rollover',1.)]:
            dat=layout.op(name) or layout.create(scriptDAT,name);dat.store('sgrapeMenuOwned',True);dat.store('sgrapeMenuGain',gain)
            dat.par.callbacks='sgrape_color_callbacks';dat.inputConnectors[0].connect(rows);dat.cook(force=True)
            if dat.errors():raise RuntimeError(dat.errors())
        for script,callback,rollover in scripts:
            if not script.fetch('sgrapeMenuOriginal',None):
                p=script.par.callbacks;script.store('sgrapeMenuOriginal',{'callback':callback,'value':p.val,'expr':p.expr,'mode':p.mode})
            script.store('sgrapeMenuValues','sgrape_colors_rollover' if rollover else 'sgrape_colors_default')
            script.par.callbacks='sgrape_style_callbacks';script.cook(force=True)
            if script.errors():raise RuntimeError(script.errors())
        return True
    except Exception:
        uninstall(layout)
        raise
