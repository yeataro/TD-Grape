"""Color source alpha and native controls through both exposed/bind workflows."""
import json,uuid
from pathlib import Path
area=op('/').create(baseCOMP,'grape_color_controls_'+uuid.uuid4().hex[:8]);checks=[]
try:
 manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
 page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
 for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
 r=manager.op('runtime').module;r._owner=manager;c=r.core();q=manager.op('parameters').module;s=manager.op('sources').module
 for kind in ('mat','top'):
  for expose in (False,True):
   graph=c.normalize_top_sources(c.demo_graph('color',target=kind))[0]
   graph['declarations']=[dict(id='color'+str(size),kind='uniform',name='uColor'+str(size),type='float' if size==1 else 'vec'+str(size),value=.2 if size==1 else [.2]*(size-1)+[0],nativeSequence='color',expose=expose) for size in range(1,5)]
   graph['declarations'].append(dict(id='direction',kind='uniform',name='uDirection',type='vec3',value=[1,0,0],expose=expose))
   shader=r.create_shader(area,'Material',graph,kind)
   with r.shader_context(shader):
    if not expose:
     data=q.snapshot(r);q.edit(r,dict(action='page-create',name='Controls',revision=r.state()['revision'],expectedPages=data['expectedPages']))
    for d in graph['declarations']:
     row=next(x for x in s.snapshot(r)['uniforms'] if x['id']==d['id'])
     if not expose:
      data=q.snapshot(r);q.edit(r,dict(action='bind',id=d['id'],page='Controls',sourceExpected=row['expected'],revision=r.state()['revision'],expectedPages=data['expectedPages']))
     data=q.snapshot(r);control=next(x for x in data['controls'] if d['id'] in x['sources']);group=getattr(shader.parGroup,control['name'])
     assert group.style==('Float' if d['id']=='direction' else 'RGBA'),(d,group.style)
     count=1 if d['type']=='float' else int(d['type'][-1]);assert len(group)==count,(d,len(group))
     group[0].val=.63;row=next(x for x in s.snapshot(r)['uniforms'] if x['id']==d['id']);assert abs(row['components'][0]['value']-.63)<1e-6
     s.write_value(r,dict(id=d['id'],revision=r.state()['revision'],component=0,expected=row['components'][0],value=.47));assert abs(group[0].eval()-.47)<1e-6
    native=r.shader_operator(shader)
    for i in range(4):assert getattr(native.par,'color'+str(i)+'alpha').eval()==(0 if i==3 else 1)
    result=r.deploy(r.state()['graph'],r.state()['revision']);assert result['ok'],result
    assert abs(group[0].eval()-.47)<1e-6
   checks.append(dict(kind=kind,expose=expose,colorSizes=[1,2,3,4],alphaDefault=1,explicitAlphaZeroPreserved=True,vectorUnchanged=True))
 result=dict(passed=True,checks=checks)
 (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
