"""MAT MRT interfaces, import round trips and the native-safe output shell."""
import copy, unittest
import sgrape_core as c
import sgrape_document as document

def legacy_single_buffer_result(result):
    """Compare historical fingerprints after removing only the approved shell delta."""
    result=copy.deepcopy(result)
    if not result['vertex']:return result
    clear=['    for (int sg_buffer = 0; sg_buffer < TD_NUM_COLOR_BUFFERS; ++sg_buffer) {',
           '        fragColor[sg_buffer] = TDOutputSwizzle(vec4(0.0, 0.0, 0.0, 0.0));','    }']
    lines=result['stages']['pixel']['lines'];start=lines.index(clear[0])
    assert lines[start:start+3]==clear
    result['pixel']=result['pixel'].replace('\n'.join(clear)+'\n','')
    del lines[start:start+3]
    zero='    vec4 sg_color = vec4(0.0, 0.0, 0.0, 0.0);'
    if zero in lines:
        opaque=zero.replace('0.0);','1.0);')
        lines[lines.index(zero)]=opaque
        write='    fragColor[0] = TDOutputSwizzle(TDDither(sg_color));'
        lines.append(write)
        result['pixel']=result['pixel'].replace(zero,opaque).replace('    TDAlphaTest(sg_color.a);','    TDAlphaTest(sg_color.a);\n'+write)
    return result

def graph_with_buffers(count):
    graph=c.demo_graph('color');graph['stages']['pixel']['nodes'][-1]['params']['bufferCount']=count
    return graph

class MatBuffers(unittest.TestCase):
    def test_count_and_round_trip(self):
        for count in range(1,9):
            graph=graph_with_buffers(count);pixel=graph['stages']['pixel']
            for port in c.PIXEL_BUFFER_PORTS[1:count]:pixel['edges'].append(c.edge('color','pixel',port))
            before=copy.deepcopy(graph);out=c.compile_graph(graph)
            self.assertEqual(len(out['stages']['pixel']['ports']['pixel']['in']),count)
            self.assertEqual(document.inspect_document(graph,c,'mat')['candidate'],graph)
            self.assertEqual(graph,before)
            for index in range(1,count):
                self.assertIn('#if TD_NUM_COLOR_BUFFERS > '+str(index),out['pixel'])
                self.assertIn('fragColor['+str(index)+'] = TDOutputSwizzle(sg_n_color);',out['pixel'])

    def test_empty_slots_are_zero_without_dithering(self):
        graph=graph_with_buffers(4);graph['stages']['pixel']['edges']=[]
        result=c.compile_graph(graph);text=result['pixel']
        self.assertIn('sg_buffer < TD_NUM_COLOR_BUFFERS',text)
        self.assertIn('fragColor[sg_buffer] = TDOutputSwizzle(vec4(0.0, 0.0, 0.0, 0.0));',text)
        self.assertNotIn('TDDither(',text)
        for index in range(1,4):self.assertIn('fragColor['+str(index)+'] = TDOutputSwizzle(vec4(0.0, 0.0, 0.0, 0.0));',text)

    def test_subgraph_can_feed_an_additional_buffer(self):
        graph=graph_with_buffers(3);fn=copy.deepcopy(c.function_library()[0]);graph['functions']=[fn]
        graph['stages']['pixel']['nodes'].append({'id':'call','definitionUuid':c.CALL,'params':{'functionId':fn['id']}})
        graph['stages']['pixel']['edges'].append(c.edge('call','pixel','buffer2','color'))
        out=c.compile_graph(graph)
        self.assertIn('fragColor[2] = TDOutputSwizzle(',out['pixel'])
        self.assertTrue(any(r.get('functionId')==fn['id'] for r in out['sourceMap']['pixel']))

    def test_defaults_are_editable_but_wires_override(self):
        graph=graph_with_buffers(2);node=graph['stages']['pixel']['nodes'][-1]
        node['inputValues']={'buffer1':[.1,.2,.3,.4]}
        self.assertIn('TDOutputSwizzle(vec4(0.1, 0.2, 0.3, 0.4))',c.compile_graph(graph)['pixel'])
        graph['stages']['pixel']['edges'].append(c.edge('color','pixel','buffer1'))
        self.assertIn('fragColor[1] = TDOutputSwizzle(sg_n_color)',c.compile_graph(graph)['pixel'])
        self.assertEqual(node['inputValues']['buffer1'],[.1,.2,.3,.4])

    def test_invalid_counts_do_not_repair_away_wires(self):
        for count in [0,9,-1,True,'3',1.5,None]:
            graph=graph_with_buffers(count);before=copy.deepcopy(graph)
            with self.assertRaises(c.GraphError):c.compile_graph(graph)
            self.assertEqual(document.inspect_document(graph,c,'mat')['status'],'blocked')
            self.assertEqual(graph,before)

    def test_top_remains_single_output(self):
        graph=c.demo_graph('color','top');graph['stages']['pixel']['edges']=[]
        self.assertIn('sg_color = vec4(0.0, 0.0, 0.0, 1.0)',c.compile_graph(graph)['pixel'])
        graph['stages']['pixel']['nodes'][-1]['params']['bufferCount']=2
        with self.assertRaises(c.GraphError):c.compile_graph(graph)

    def test_every_emitted_output_line_has_source_mapping(self):
        out=c.compile_graph(graph_with_buffers(8));lines=out['pixel'].splitlines()
        for row in out['sourceMap']['pixel']:
            if row['node']=='pixel':self.assertIn(lines[row['line']-1],out['stages']['pixel']['lines'])
        mapped={r['line'] for r in out['sourceMap']['pixel']}
        self.assertTrue(all(i+1 in mapped for i,line in enumerate(lines) if 'fragColor[' in line and ' = ' in line))

if __name__=='__main__':unittest.main()
