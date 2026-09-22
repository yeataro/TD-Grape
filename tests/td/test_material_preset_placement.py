"""Real TDFam registration/placement, independent copies and native MAT outlets."""
import json,uuid,copy
owner=op('/TD_Grape');r=owner.op('runtime').module;family=owner.op('tdfam')
users=[s for s in r._shaders.values() if s and s.valid and not s.fetch('sgrapeMaster',False)]
def snapshot():return {s.path:{name:s.op(name).text for name in ('graph','state','manifest','vertex_shader','pixel_shader') if s.op(name)} for s in users}
before=snapshot();previous=dict(r._shaders);active=r._shader
area=op('/').create(baseCOMP,'grape_preset_place_'+uuid.uuid4().hex[:8]);checks=[]
try:
 family.Install(True)
 entries=family.GetMasterOps()
 for key,label in [('phong','Phong MAT Graph'),('pbr','PBR MAT Graph')]:
  typ='sgrape_'+key;assert entries[typ]['op_label']==label,entries
  master=r.master_template(key);assert master.fetch('sgrapeMaster',False)
  manifest=json.loads(master.op('FamManifest/OpInfo').text);assert manifest['compatible_types']==['MAT']
  assert entries[typ]['group']=='MAT' and manifest['op_group']=='MAT'
  original=master.op('graph').text;clones=[]
  for index in range(2):
   clone=family.PlaceOp(area,typ,name=key+str(index));assert clone,typ;clones.append(clone)
   assert clone.fetch('sgrapeGenerated',False) and not clone.fetch('sgrapeMaster',False)
   assert clone.op('graph').text==original
   r.validate_material(clone)
   assert clone.op('out1').inputs==[clone.op('material')]
   output=area.create(nullMAT,key+'_out'+str(index));output.inputConnectors[0].connect(clone.outputConnectors[0]);output.cook(force=True);assert not output.errors(),output.errors()
   with r.shader_context(clone):
    state=r.checked_state();assert r.compiled_is_current(clone,r.core().compile_graph(state['graph']),state['graph'])
    controls=owner.op('parameters').module.snapshot(r)
    for d in state['graph']['declarations']:
     if d.get('nativeSequence')=='color':
      row=next(x for x in controls['controls'] if d['id'] in x['sources']);group=getattr(clone.parGroup,row['name'])
      assert group.style=='RGBA' and len(group)==3
  assert len({master.fetch('sgrapeShaderId'),*(n.fetch('sgrapeShaderId') for n in clones)})==3
  state=json.loads(clones[0].op('state').text);state['graph']['stages']['pixel']['nodes'][0]['ui']['x']+=100
  with r.shader_context(clones[0]):
   result=r.deploy(state['graph'],state['revision']);assert result['ok'],result
  assert master.op('graph').text==original and clones[1].op('graph').text==original
  r.register_shader(master);assert master.fetch('sgrapeMaster',False) and 'sgrapeShader' not in master.tags
  checks.append(dict(key=key,label=label,placedCopies=2,independent=True,outlet=True,compiled=True))
 assert entries['sgrape_mat']['group']=='MAT' and entries['sgrape_top']['group']=='TOP'
 assert snapshot()==before
 result=dict(passed=True,checks=checks,userShadersPreserved=len(users),entries=list(entries))
 (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
 r._shaders=previous;r._shader=active;area.destroy()
