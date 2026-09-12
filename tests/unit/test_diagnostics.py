import copy,unittest
import sgrape_core as c

def nested():
    g=c.demo_graph('color');inner=copy.deepcopy(c.function_library()[0]);inner['scope']='local'
    outer=copy.deepcopy(inner);outer.update(id='outer',name='Outer')
    outer['graph']['nodes'][1]={'id':'call_inner','definitionUuid':c.CALL,'params':{'functionId':inner['id']}}
    outer['graph']['edges']=[c.edge('input','call_inner','color','color'),c.edge('input','call_inner','tint','tint'),c.edge('call_inner','output','color','color')]
    g['functions']=[outer,inner]
    g['stages']['pixel']={'nodes':[{'id':'outer_call','definitionUuid':c.CALL,'params':{'functionId':'outer'}},c.node('pixel_out','pixel')],'edges':[c.edge('outer_call','pixel','color','color')]}
    return g

class Diagnostics(unittest.TestCase):
    def test_root_body_and_output_lines(self):
        for target in ('mat','top'):
            result=c.compile_graph(c.demo_graph('color',target=target));rows=result['sourceMap']['pixel'];text=result['pixel'].splitlines()
            color=next(row for row in rows if row['node']=='color');self.assertIn('sg_n_color',text[color['line']-1])
            output=[row for row in rows if row['node']=='pixel'];self.assertEqual(len(output),6 if target=='mat' else 2)
            self.assertTrue(all(row['stage']=='pixel' for row in rows))
    def test_nested_source_is_actual_inner_node(self):
        g=nested();before=copy.deepcopy(g);result=c.compile_graph(g)
        row=next(row for row in result['sourceMap']['pixel'] if row['node']=='multiply')
        self.assertEqual(row['functionId'],'library_tint_v1');self.assertEqual(row['trail'],['outer','library_tint_v1']);self.assertEqual(g,before)
        self.assertIn(' * ',result['pixel'].splitlines()[row['line']-1])
    def test_relays_point_at_call_in_containing_graph(self):
        result=c.compile_graph(nested());rows=result['sourceMap']['pixel']
        self.assertTrue(any(row['node']=='outer_call' and row['trail']==[] for row in rows))
        self.assertTrue(any(row['node']=='call_inner' and row['trail']==['outer'] and row['functionId']=='outer' for row in rows))
    def test_nested_unused_error_does_not_blame_outer_function(self):
        g=nested();g['stages']['pixel']=c.demo_graph('color')['stages']['pixel']
        g['functions'][1]['graph']['nodes'][1]['inputValues']={'a':[1,2]}
        with self.assertRaises(c.GraphError) as ctx:c.compile_graph(g)
        self.assertEqual(ctx.exception.node,'multiply');self.assertEqual(ctx.exception.functionId,'library_tint_v1')
        self.assertEqual(ctx.exception.trail,['outer','library_tint_v1']);self.assertEqual(ctx.exception.stage,'pixel')
    def test_expansion_error_carries_inner_scope(self):
        g=nested();g['functions'][1]['graph']['nodes'][1]['definitionUuid']='missing'
        with self.assertRaises(c.GraphError) as ctx:c.compile_graph(g)
        self.assertEqual(ctx.exception.node,'multiply');self.assertEqual(ctx.exception.functionId,'library_tint_v1')
    def test_same_node_id_in_vertex_and_pixel(self):
        g=c.demo_graph('color');g['stages']['vertex']['nodes'][0]['id']='color';g['stages']['vertex']['edges'][0]['from'][0]='color'
        result=c.compile_graph(g)
        for stage in ('vertex','pixel'):
            row=next(row for row in result['sourceMap'][stage] if row['node']=='color');self.assertEqual(row['stage'],stage)
    def test_native_error_path_line_and_unknown_sources(self):
        result=c.compile_graph(nested());row=next(row for row in result['sourceMap']['pixel'] if row['node']=='multiply')
        info=f"ERROR: /test/pixel_shader:{row['line']}: broken\nERROR: /external/pixel_shader:{row['line']}: external\nERROR: /test/pixel_shader:1: shell\nERROR: 1 compilation errors. No code generated."
        found=c.native_compile_diagnostics(info,result,{'pixel':'/test/pixel_shader','vertex':'/test/vertex_shader'})
        self.assertEqual(found[0]['node'],'multiply');self.assertNotIn('node',found[1]);self.assertNotIn('node',found[2]);self.assertEqual(len(found),3)
    def test_native_duplicate_and_limit(self):
        result=c.compile_graph(c.demo_graph('color'))
        text='ERROR: /test/pixel_shader:5: bad\n'*4
        self.assertEqual(len(c.native_compile_diagnostics(text,result,{'pixel':'/test/pixel_shader'})),1)
        text='\n'.join(f'ERROR: /test/pixel_shader:{i+1}: bad' for i in range(60))
        self.assertEqual(len(c.native_compile_diagnostics(text,result,{'pixel':'/test/pixel_shader'})),32)

if __name__=='__main__':unittest.main()
