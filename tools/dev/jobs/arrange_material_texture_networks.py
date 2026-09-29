"""Explicit MAT master layout: shared defaults, map selectors, shader, metadata.

Only native OP coordinates change. Never run from startup/Apply; new copies
inherit this layout, while authors remain free to move their own instances.
"""
import hashlib,json,math

owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
r=owner.op('runtime').module

def fingerprint(comp):
    rows=[]
    for n in [comp]+sorted(comp.children,key=lambda n:n.name):
        rows.append({'id':n.id,'name':n.name,'type':n.opType,'storage':repr(n.storage),
            'inputs':[v.id for v in n.inputs],'size':[n.nodeWidth,n.nodeHeight],
            'viewer':n.viewer,'dock':n.dock.id if n.dock else None,'tags':sorted(n.tags),
            'text':n.text if n.family=='DAT' and n.type in ('text','execute','parameterexecute') else None,
            'parameters':[(p.name,str(p.mode),str(p.val) if p.mode==ParMode.CONSTANT else None,p.expr,p.bindExpr) for p in n.pars()]})
    return hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()

records=[]
for key in r.MASTER_KEYS:
    comp=r.master_template(key)
    if not comp or r.shader_kind(comp)!='mat':continue
    specs=comp.fetch('sgrapeTextureSources',{})
    sources=list(dict.fromkeys(spec[field] for spec in specs.values() for field in ('asset','blackAsset') if spec.get(field)))
    selectors=['texture_source_'+hashlib.sha256(k.encode()).hexdigest()[:16] for k in specs]
    selectors=[name for name in selectors if comp.op(name)]
    plan={name:(-1240,200-i*200) for i,name in enumerate(sources)}
    rows=max(1,math.ceil(len(selectors)/2))
    for i,name in enumerate(selectors):plan[name]=(-820+(i//rows)*420,-(i%rows)*190)
    plan.update(vertex_shader=(0,300),pixel_shader=(420,300),material=(0,0),out1=(360,0),compile_info=(0,-230))
    plan={name:xy for name,xy in plan.items() if comp.op(name)}
    bottom=min(-650,-rows*190-150,-len(sources)*200-150)
    order=['texture_sources','controls','parameter_links','parameter_lifecycle','graph','state','manifest','FamManifest']
    others=[name for name in order if comp.op(name) and name not in plan]
    others+=sorted(n.name for n in comp.children if n.name not in plan and n.name not in others)
    for i,name in enumerate(others):plan[name]=(-1240+(i%5)*420,bottom-(i//5)*220)
    before={n.name:[n.nodeX,n.nodeY] for n in comp.children};signature=fingerprint(comp)
    def check_spacing():
        boxes=[(name,*xy,xy[0]+comp.op(name).nodeWidth,xy[1]+comp.op(name).nodeHeight) for name,xy in plan.items()]
        for i,a in enumerate(boxes):
            for b in boxes[i+1:]:
                assert a[3]+40<=b[1] or b[3]+40<=a[1] or a[4]+40<=b[2] or b[4]+40<=a[2],(comp.path,a[0],b[0])
    check_spacing()
    try:
        for name in sorted(plan,key=lambda name:bool(comp.op(name).dock)):
            comp.op(name).nodeX,comp.op(name).nodeY=plan[name]
        assert fingerprint(comp)==signature,comp.path+' functional state changed'
        assert all((comp.op(name).nodeX,comp.op(name).nodeY)==xy for name,xy in plan.items())
        check_spacing()
    except Exception:
        for name in sorted(before,key=lambda name:bool(comp.op(name).dock)):
            comp.op(name).nodeX,comp.op(name).nodeY=before[name]
        raise
    records.append({'key':key,'path':comp.path,'before':before,'after':plan,'sharedImages':sources,'mapSelectors':len(selectors),'functionalStatePreserved':True})
result={'passed':True,'masters':records}
(GRAPE_TEST_OUTPUT/'layout.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
result={'passed':True,'masters':len(records),'functionalStatePreserved':True,'overlaps':0}
