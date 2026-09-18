import copy,json
owner=globals().get('GRAPE_TEST_MANAGER') or op('/TD_Grape');r=owner.op('runtime').module;c=r.core()
user_before={s.path:{key:s.op(key).text for key in ('graph','state','manifest') if s.op(key)} for s in r._shaders.values() if s and s.valid}
(GRAPE_TEST_OUTPUT/'user-before.json').write_text(json.dumps(user_before,ensure_ascii=False,indent=2),encoding='utf-8')
area=op('/').create(baseCOMP,'grape_source_test')
checks=[]
try:
    s=r.create_shader(area,'shader',kind='top')
    g=json.loads(s.op('graph').text)
    assert g['topSourceVersion']==1 and len(g['topInputs'])==1
    assert not s.op('input_router') and not s.op('input_fallback')
    assert len([n for n in s.children if n.type=='moviefilein'])==1
    checks.append({'case':'template','children':[(n.name,n.type) for n in s.children]})
    # Extend the inventory past the three physical GLSL TOP wires.
    for i in range(1,5):g['topInputs'].append({'id':'slot'+str(i),'name':'sTD2DInputs['+str(i)+']','defaultSource':'builtin:white' if i%2 else 'builtin:black'})
    g['stages']['pixel']={'nodes':[c.node('top_input','src',inputId='slot4'),c.node('texture_sample','sample'),c.node('pixel_out','out')], 'edges':[c.edge('src','sample','sampler'),c.edge('sample','out','color')]}
    r.configure(s,c.compile_graph(g),g);r.validate_material(s);r.cleanup_top_sources(s,g)
    assert len(s.op('shader').par.tops.eval())==5 and len(s.inputConnectors)==5
    count=len(s.children)
    for i in range(8):g['stages']['pixel']['nodes'].append(c.node('top_input','repeat'+str(i),inputId='slot4'))
    r.configure(s,c.compile_graph(g),g);r.validate_material(s);r.cleanup_top_sources(s,g)
    assert len(s.children)==count
    checks.append({'case':'five inputs and repeated references','children':count})
    ext=area.create(constantTOP,'external');ext.par.resolutionw=140;ext.par.resolutionh=86
    s.inputConnectors[4].connect(ext)
    identities={row['id']:s.op(row['node']).id for row in s.fetch('grapeTopSlots')}
    for _ in range(3):
        r.configure(s,c.compile_graph(g),g);r.validate_material(s)
        assert {row['id']:s.op(row['node']).id for row in s.fetch('grapeTopSlots')}==identities
        assert s.inputConnectors[4].connections[0].owner==ext
    checks.append({'case':'unchanged TOP inventory preserves In TOP identities and external wire'})
    # An unchanged slot list must still apply changed defaults and repair a
    # missing internal connection; it is not a blanket configure early return.
    g['topInputs'][0]['defaultSource']='builtin:white'
    r.configure(s,c.compile_graph(g),g);r.validate_material(s);r.cleanup_top_sources(s,g)
    incoming=s.op('in1');default=s.op('input_1_default')
    assert default.type=='constant' and default.par.colorr.eval()==1
    assert incoming.inputConnectors[0].connections[0].owner==default
    incoming.inputConnectors[0].disconnect()
    r.configure(s,c.compile_graph(g),g);r.validate_material(s)
    assert incoming.inputConnectors[0].connections[0].owner==default
    checks.append({'case':'default change and missing internal wire are still applied'})
    g['topInputs'].reverse()
    r.configure(s,c.compile_graph(g),g);r.validate_material(s);r.cleanup_top_sources(s,g)
    assert s.inputConnectors[0].connections[0].owner==ext
    assert (s.op('shader').width,s.op('shader').height)==(140,86)
    checks.append({'case':'reorder preserves wire and input resolution','size':[s.op('shader').width,s.op('shader').height]})
    s.inputConnectors[0].disconnect()
    empty=c.normalize_top_sources(c.demo_graph('color','top'))[0];empty['topInputs']=[]
    empty['stages']['pixel']={'nodes':[c.node('texture_sample','empty'),c.node('pixel_out','out')],'edges':[c.edge('empty','out','color')]}
    s.par.Width=310;s.par.Height=190
    r.configure(s,c.compile_graph(empty),empty);r.validate_material(s);r.cleanup_top_sources(s,empty)
    assert not s.inputConnectors and not s.op('shader').par.tops.eval()
    assert (s.op('shader').width,s.op('shader').height)==(310,190)
    assert not [n for n in s.children if n.fetch('grapeManagedTopSource',False)]
    checks.append({'case':'zero inputs, no hidden sampler','size':[310,190]})
finally:
    r._shaders={k:v for k,v in r._shaders.items() if v and v.valid and not v.path.startswith(area.path+'/')}
    area.destroy()
result={'checks':checks,'userGraphsPreserved':all(op(path) and all(op(path).op(k).text==v for k,v in data.items()) for path,data in user_before.items())}
(GRAPE_TEST_OUTPUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
