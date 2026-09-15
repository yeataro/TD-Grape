"""Explicit, one-time native TD layout pass. Never called by product callbacks.

Run through submit_job.py. Coordinates and invariant hashes are saved in the
private report directory so this pass can be reviewed or reversed. No graph,
parameter, connection, operator name, size, docking, or viewer flag is changed.
"""
import hashlib
import json
import re


def fingerprint(component):
    """Capture functional state without evaluating time-dependent expressions."""
    rows = []
    for item in [component] + sorted(component.children, key=lambda n: n.name):
        parameters = []
        for p in item.pars():
            mode = str(p.mode)
            parameters.append((p.name, mode,
                               str(p.val) if mode.endswith('CONSTANT') else None,
                               p.expr, p.bindExpr))
        rows.append(dict(path=item.path, type=item.opType, parameters=parameters,
                         inputs=[n.path for n in item.inputs],
                         storage=repr(item.storage), tags=sorted(item.tags),
                         dock=item.dock.path if item.dock else None,
                         viewer=item.viewer, size=(item.nodeWidth,item.nodeHeight),
                         color=list(item.color), comment=item.comment,
                         text=item.text if item.opType in ('textDAT','executeDAT','parameterexecuteDAT') else None))
    return hashlib.sha256(json.dumps(rows, sort_keys=True).encode('utf-8')).hexdigest()


def coordinates(component):
    return {n.name:[n.nodeX,n.nodeY,n.nodeWidth,n.nodeHeight] for n in component.children}


def complete_plan(component, plan, bottom):
    """Keep unexpected/user-added nodes, giving them their own lower rows."""
    plan = {name:xy for name,xy in plan.items() if component.op(name)}
    remaining = sorted((n for n in component.children if n.name not in plan),key=lambda n:n.name)
    step_x = max([220] + [n.nodeWidth+90 for n in remaining])
    step_y = max([180] + [n.nodeHeight+90 for n in remaining])
    for i,n in enumerate(remaining):
        plan[n.name] = [(i%6)*step_x,bottom-(i//6)*step_y]
    return plan


def manager_plan(component):
    plan = {}
    groups = [
        (0,1,['lifecycle','runtime','controls','shader_controls','editor_launch']),
        (350,1,['node_catalog','core','document','sources','parameters','parameter_links','personal_library']),
        (700,2,['index_html','app_js','style_css','graph_ui_js','inspector_js','import_ui_js',
                'functions_model_js','functions_ui_js','locales_json','favicon_svg','web_icons_json']),
        (1300,1,['tdfam','masters','family_callbacks','menu_colors','licenses']),
    ]
    for x,columns,names in groups:
        for i,name in enumerate(names):
            plan[name]=[x+(i%columns)*240,-(i//columns)*170]
    return complete_plan(component,plan,-1360)


def texture_bank(component, plan):
    """Place image/default/source groups on matching rows, left to right."""
    defaults = sorted(n.name for n in component.children
                      if n.name.startswith('texture_default_') and n.opType=='selectTOP')
    row = 0
    for name in defaults:
        y = -row*190
        for suffix in ('_image','_constant'):
            if component.op(name+suffix): plan[name+suffix]=[0,y]
        # Generated texture names are long; leave room for TD's name labels.
        plan[name]=[400,y]
        source = name.replace('texture_default_','texture_source_',1)
        if component.op(source): plan[source]=[800,y]
        row += 1
    for n in sorted(component.children,key=lambda n:n.name):
        if n.name not in plan and (n.name.startswith(('asset_','texture_','source_','default_in'))
                                   or n.name=='input_fallback') and n.family=='TOP':
            plan[n.name]=[0,-row*190]
            row+=1
    return max(row,1)


def shader_plan(component, kind):
    plan={}
    source_rows=texture_bank(component,plan)
    if kind=='top':
        plan.update(input_default=[800,0],in1=[1080,0],input_router=[1320,0],
                    shader=[1600,0],out1=[1900,0],preview=[1900,-210],
                    pixel_shader=[1600,280],shader_pixel=[1320,280],shader_compute=[1900,280],
                    compile_info=[1600,-420],shader_info=[1900,-420],input_external=[1080,-210])
        inputs=sorted((n for n in component.children if re.fullmatch(r'in\d+',n.name) and n.name!='in1'),
                      key=lambda n:int(n.name[2:]))
        for i,n in enumerate(inputs,1):
            plan[n.name]=[1080,-190*i]
            if component.op('default_'+n.name):plan['default_'+n.name]=[800,-190*i]
        source_rows=max(source_rows,len(inputs)+1)
    else:
        plan.update(vertex_shader=[960,280],pixel_shader=[1200,280],material=[1200,0],
                    compile_info=[1200,-240],material_info=[1200,-430],
                    preview_geometry=[1540,0],preview_camera=[1540,-240],preview=[1840,0],
                    grape_material_preview=[1840,-240],grape_viewer=[1540,-460],grape_viewer_window=[1840,-460])
    bottom=min(-760,-source_rows*190-140)
    for i,name in enumerate(['controls','state','graph','manifest','texture_sources','FamManifest']):
        plan[name]=[i*340,bottom]
    return complete_plan(component,plan,bottom-240)


def assert_spaced(component,plan):
    rectangles=[]
    for name,(x,y) in plan.items():
        n=component.op(name)
        rectangles.append((name,x,y,x+n.nodeWidth,y+n.nodeHeight))
    for i,a in enumerate(rectangles):
        for b in rectangles[i+1:]:
            assert a[3]+24<=b[1] or b[3]+24<=a[1] or a[4]+24<=b[2] or b[4]+24<=a[2], \
                'Layout collision in %s: %s / %s' % (component.path,a[0],b[0])


owners=[n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1, 'Expected one Grape manager'
manager=owners[0]
masters=manager.op('masters')
targets=[(manager,manager_plan(manager))]
shaders=list(masters.children) if masters else []
shaders += [n for n in manager.parent().findChildren(tags=['sgrapeShader'])
            if n not in shaders and n.fetch('sgrapeManagerId',None)==manager.fetch('sgrapeManagerId',None)]
if masters:
    targets.append((masters,complete_plan(masters,{'grape_top':[0,0],'grape_mat':[360,0],
                                                  'sgrape_top':[0,0],'sgrape_mat':[360,0]},-240)))
for component in shaders:
    if component.family!='COMP':continue
    kind=component.fetch('sgrapeTarget','mat')
    targets.append((component,shader_plan(component,kind)))
    for name in ('FamManifest','preview_geometry','preview_camera'):
        child=component.op(name)
        if child:targets.append((child,complete_plan(child,{},0)))
if manager.op('licenses'):
    child=manager.op('licenses')
    targets.append((child,complete_plan(child,{},0)))

records={c.path:dict(before=coordinates(c),plan=plan,fingerprint=fingerprint(c)) for c,plan in targets}
report=GRAPE_TEST_OUTPUT/'native-layout.json'
report.write_text(json.dumps(records,indent=2),encoding='utf-8')
for component,plan in targets:assert_spaced(component,plan)
try:
    for component,plan in targets:
        # A host can move its docked DATs; position hosts first, then their DATs.
        for name in sorted(plan,key=lambda name:bool(component.op(name).dock)):
            item=component.op(name)
            item.nodeX,item.nodeY=plan[name]
    for component,plan in targets:
        assert fingerprint(component)==records[component.path]['fingerprint'], 'Functional state changed: '+component.path
        assert all([component.op(n).nodeX,component.op(n).nodeY]==xy for n,xy in plan.items())
        assert_spaced(component,plan)
        records[component.path]['after']=coordinates(component)
except Exception:
    for component,plan in targets:
        before=records[component.path]['before']
        for name in sorted(before,key=lambda name:bool(component.op(name).dock)):
            component.op(name).nodeX,component.op(name).nodeY=before[name][:2]
    raise
report.write_text(json.dumps(records,indent=2),encoding='utf-8')
result=dict(networks=len(targets),operators=sum(len(p) for c,p in targets),
            functionalStateUnchanged=True,overlaps=0,paths=list(records))
