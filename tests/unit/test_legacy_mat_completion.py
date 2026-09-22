"""Cross-stage payloads and integrated lighting in the existing MAT compiler."""
import copy,unittest
import sgrape_core as c

def payload_graph(ty='vec3'):
    g=c.demo_graph('color','mat')
    boundary=next(n for n in g['stages']['vertex']['nodes'] if n['definitionUuid']=='sgrape.builtin.vertex_out')
    boundary['params']['outputs']=[dict(id='custom',name='Custom',type=ty,interpolation='smooth')]
    g['stages']['pixel']['nodes'].append(c.node('vertex_input','input'))
    # An unconnected payload is still produced by the Vertex boundary.
    return g

class MatCompletion(unittest.TestCase):
    def test_value_payloads_round_trip_and_bool_transport(self):
        for ty in ('float','vec4','int','bvec3','mat3x2','float[3]'):
            with self.subTest(type=ty):
                g=payload_graph(ty);p=g['stages']['pixel'];read=('input','custom')
                if ty=='float[3]':p['nodes'].append(c.node('array_get','get',type=ty));p['edges'].append(c.edge('input','get','Array','custom'));read=('get','out');ty='float'
                elif ty=='mat3x2':p['nodes'].append(c.node('matrix_get','get',type=ty,mode='element'));p['edges'].append(c.edge('input','get','value','custom'));read=('get','out');ty='float'
                if ty=='bvec3':
                    p['nodes'] += [c.node('any','any',type='bvec3'),c.node('convert','cast',fromType='bool',toType='float')]
                    p['edges'] += [c.edge(read[0],'any','value',read[1]),c.edge('any','cast','value')];read=('cast','out')
                p['edges']=[e for e in p['edges'] if e['to']!=['pixel','color']]+[c.edge(read[0],'pixel','color',read[1])]
                before=copy.deepcopy(g);result=c.compile_graph(g);self.assertEqual(g,before)
                self.assertIn('sg_v_custom_0',result['vertex']);self.assertIn('sg_v_custom_0',result['pixel'])
                if ty=='bvec3':self.assertIn('flat out ivec3 sg_v_custom_0',result['vertex']);self.assertIn('bvec3(sg_v_custom_0)',result['pixel'])

    def test_invalid_payload_rejected_before_glsl(self):
        for ty in ('sampler2D','sampler2D[2]','float[TD_NUM_LIGHTS]',None,[],{}):
            with self.subTest(type=ty),self.assertRaises(c.GraphError):c.compile_graph(payload_graph(ty))
        g=payload_graph();g['stages']['vertex']['nodes'][-1]['params']['outputs']*=2
        with self.assertRaisesRegex(c.GraphError,'duplicate'):c.compile_graph(g)

    def test_lighting_is_runtime_and_has_automatic_geometry(self):
        for key in ('material_phong','material_pbr'):
            g=c.demo_graph('color','mat');p=g['stages']['pixel'];p['nodes'].append(c.node(key,'lighting'));p['edges']=[c.edge('lighting','pixel','color')]
            result=c.compile_graph(g)
            self.assertIn('i < TD_NUM_LIGHTS',result['pixel']);self.assertIn('TDDeform(TDPos())',result['vertex'])
            self.assertIn('flat in int sg_lighting_camera;',result['pixel'])
            self.assertNotIn(key,c.CONSTANT_EXPRESSIONS)
            if key.endswith('pbr'):self.assertIn('i < TD_NUM_ENV_LIGHTS',result['pixel'])
            # Source-map lines must still refer to the emitted node statements.
            for row in result['sourceMap']['pixel']:
                if row['node']=='lighting':self.assertNotIn('void main',result['pixel'].splitlines()[row['line']-1])
            g['target']='top';g['stages'].pop('vertex')
            with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_lighting_has_no_shell_cost_when_unused(self):
        g=c.demo_graph('color','mat');g['stages']['pixel']['nodes'].append(c.node('material_pbr','unused'))
        result=c.compile_graph(g);self.assertNotIn('sg_lighting_',result['vertex']);self.assertNotIn('TDLightingPBR',result['pixel'])

    def test_output_argument_call_is_not_duplicated(self):
        g=c.demo_graph('color','mat');p=g['stages']['pixel'];p['nodes'].append(c.node('modf','parts'))
        out=next(iter(port for port in c.resolved_ports(c.CATALOG['modf'],{'type':'float'})['outputs'] if port!='out'))
        p['edges']=[c.edge('parts','pixel','color',out)]
        result=c.compile_graph(g);self.assertEqual(result['pixel'].count('modf('),1)

if __name__=='__main__':unittest.main()
