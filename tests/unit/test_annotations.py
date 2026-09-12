import copy,json,unittest
import sgrape_core as c
from test_diagnostics import nested

class Annotations(unittest.TestCase):
    def test_node_and_view_hash(self):
        g=c.demo_graph('color');n=g['stages']['pixel']['nodes'][0];before=c.compile_graph(g)
        n['ui']['x']=700;self.assertEqual(c.compile_graph(g)['pixel'],before['pixel'])
        n['ui'].update(label='顏色 / freely named',comment='first line\nsecond line')
        original=copy.deepcopy(g);r=c.compile_graph(g);lines=r['pixel'].splitlines();i=next(i for i,line in enumerate(lines) if 'sg_n_color =' in line)
        self.assertIn('Label: 顏色 / freely named',lines[i-1]);self.assertIn('Comment: first line',lines[i+1]);self.assertEqual(lines[i+2],'    // second line');self.assertEqual(g,original);self.assertEqual(r['hash'],before['hash']);self.assertNotEqual(r['pixel'],before['pixel'])
        self.assertTrue(all(row['node']=='color' for row in r['sourceMap']['pixel'] if i<=row['line']<=i+3))

    def test_text_is_not_syntax(self):
        g=c.demo_graph('color');g['stages']['pixel']['nodes'][0]['ui'].update(label='label\\',comment='*/\r\n#error injected\u2028void bad() {}\nslash\\\n\x00end')
        r=c.compile_graph(g);lines=r['pixel'].splitlines()
        self.assertTrue(all(line.lstrip().startswith('//') for line in lines if any(t in line for t in ('#error','void bad','*/','slash'))));self.assertTrue(all(not line.rstrip().endswith('\\') for line in lines));self.assertNotIn('\x00',r['pixel']);self.assertIn('vec4 sg_n_color =',r['pixel'])

    def test_nested_and_error_mapping(self):
        g=nested();g['stages']['pixel']['nodes'][0]['ui']={'label':'Outer call','comment':'Outer done'};g['functions'][0]['graph']['nodes'][1]['ui']={'label':'Inner call','comment':'Inner done'};g['functions'][1]['graph']['nodes'][1]['ui']={'label':'Inner multiply','comment':'Multiply done'}
        r=c.compile_graph(g);lines=r['pixel'].splitlines()
        for token in ('Outer call','Outer done','Inner call','Inner done','Inner multiply','Multiply done'):self.assertEqual(r['pixel'].count(token),1)
        row=next(row for row in r['sourceMap']['pixel'] if row['node']=='multiply' and ' * ' in lines[row['line']-1]);self.assertEqual(row['functionId'],'library_tint_v1');self.assertEqual(row['trail'],['outer','library_tint_v1'])
        error=c.native_compile_diagnostics('ERROR: /test/pixel_shader:'+str(row['line'])+': failure',r,{'pixel':'/test/pixel_shader'})[0];self.assertEqual(error['node'],'multiply');self.assertEqual(error['trail'],row['trail'])
        start=next(row for row in r['sourceMap']['pixel'] if 'Label: Outer call' in lines[row['line']-1]);self.assertEqual(start['node'],'outer_call');self.assertEqual(start['trail'],[]);self.assertTrue(all('_originResolved' not in row for row in r['sourceMap']['pixel']))

    def test_repeated_function_instances(self):
        g=c.demo_graph('color');fn=copy.deepcopy(c.function_library()[0]);g['functions']=[fn]
        calls=[{'id':ident,'definitionUuid':c.CALL,'params':{'functionId':fn['id']},'ui':{'label':ident+' label','comment':ident+' done'}} for ident in ('first','second')]
        g['stages']['pixel']={'nodes':calls+[c.node('add','sum',type='vec4'),c.node('pixel_out','pixel')],'edges':[c.edge('first','sum','a','color'),c.edge('second','sum','b','color'),c.edge('sum','pixel','color')]};r=c.compile_graph(g)
        for ident in ('first','second'):self.assertEqual(r['pixel'].count(ident+' label'),1);self.assertEqual(r['pixel'].count(ident+' done'),1)

    def test_interface_notes(self):
        g=nested();inner=g['functions'][1];inner['graph']['nodes'][0]['ui']={'label':'Inputs note','comment':'After inputs'};inner['graph']['nodes'][2]['ui']={'label':'Output note','comment':'After output'};r=c.compile_graph(g)
        for token in ('Inputs note','After inputs','Output note','After output'):self.assertEqual(r['pixel'].count(token),1)

    def test_inline_and_dead(self):
        g=c.demo_graph('color');g['stages']['pixel']['nodes'] += [c.node('split','parts'),c.node('float','dead')];g['stages']['pixel']['nodes'][-2]['ui'].update(label='Inline channels',comment='Inline note');g['stages']['pixel']['nodes'][-1]['ui']['label']='Never emitted';g['stages']['pixel']['edges']=[c.edge('color','parts','color'),c.edge('parts','pixel','color','a')];r=c.compile_graph(g)
        self.assertIn('Label: Inline channels',r['pixel']);self.assertIn('Comment: Inline note',r['pixel']);self.assertNotIn('Never emitted',r['pixel']);self.assertNotIn('sg_n_parts',r['pixel'])

    def test_annotation_metadata_does_not_reduce_graph_capacity(self):
        g=c.demo_graph('color');g['stages']['pixel']['nodes'][0]['ui']['extra']=''
        room=512000-len(json.dumps(g,allow_nan=False))-8
        g['stages']['pixel']['nodes'][0]['ui']['extra']='x'*room
        c.compile_graph(g)

    def test_top_sampler_comment_keeps_text(self):
        g=c.demo_graph('banana',target='top');decl=g['declarations'][0];n=next(n for n in g['stages']['pixel']['nodes'] if n['definitionUuid']==c.CATALOG['texture']['definitionUuid']);n['ui']['label']='sg_sampler_'+decl['id'];r=c.compile_graph(g)
        self.assertIn('// Label: sg_sampler_'+decl['id'],r['pixel']);self.assertIn('texture(sTD2DInputs[0]',r['pixel'])

if __name__=='__main__':unittest.main()
