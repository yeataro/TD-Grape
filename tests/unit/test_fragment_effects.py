import copy
import unittest
import sgrape_core as c


def effect_graph(key, target='mat', values=None):
    g=c.demo_graph('color',target)
    g['declarations']=[]
    effect=c.node(key,'effect')
    if values is not None:effect['inputValues']=values
    g['stages']['pixel']={'nodes':[c.node('vec4','color',value=[.2,.4,.6,1]),effect,c.node('pixel_out','pixel')],
                          'edges':[c.edge('color','pixel','color')]}
    return g


class FragmentEffects(unittest.TestCase):
    def test_terminal_reachability_and_unused_pruning(self):
        g=effect_graph('discard','top')
        p=g['stages']['pixel'];p['nodes'] += [c.node('scalar','flag',type='bool',value=True),c.node('sin','unused')]
        p['edges'].append(c.edge('flag','effect','condition'))
        result=c.compile_graph(g);text=result['pixel']
        self.assertIn('discard;',text)
        self.assertLess(text.index('discard;'),text.index('fragColor = TDOutputSwizzle'))
        self.assertTrue(any(d['node']=='unused' for d in result['diagnostics']))
        self.assertFalse(any(d['node'] in ('flag','effect') for d in result['diagnostics']))
        self.assertTrue(any(row['node']=='effect' for row in result['sourceMap']['pixel']))
        reverse=copy.deepcopy(g);reverse['stages']['pixel']['nodes'].reverse()
        self.assertEqual(c.compile_graph(reverse)['pixel'],text)

    def test_effect_order_and_single_depth_writer(self):
        g=effect_graph('depth_out');p=g['stages']['pixel']
        p['nodes'] += [c.node('td_alpha_test','alpha'),c.node('discard','discard')]
        text=c.compile_graph(g)['pixel']
        self.assertIn('gl_FragDepth = gl_FragCoord.z;',text)
        self.assertLess(text.index('discard;'),text.index('TDAlphaTest(1.0)'))
        self.assertLess(text.index('TDAlphaTest(1.0)'),text.index('gl_FragDepth ='))
        self.assertLess(text.index('gl_FragDepth ='),text.index('TDAlphaTest(sg_color.a)'))
        p['nodes'].append(c.node('depth_out','second'))
        with self.assertRaisesRegex(c.GraphError,'Only one Depth Output'):c.compile_graph(g)

    def test_repeated_alpha_and_dither_allowed(self):
        g=effect_graph('td_dither');p=g['stages']['pixel']
        p['nodes'] += [c.node('td_dither','dither2'),c.node('td_alpha_test','alpha'),c.node('td_alpha_test','alpha2')]
        p['edges']=[c.edge('color','effect','color'),c.edge('effect','dither2','color'),c.edge('dither2','pixel','color')]
        text=c.compile_graph(g)['pixel']
        self.assertEqual(text.count('TDDither('),3)
        self.assertEqual(text.count('TDAlphaTest('),3)
        self.assertNotIn('early_fragment_tests',text)

    def test_environment_and_stage_restrictions(self):
        for key in ('depth_out','td_alpha_test','td_dither'):
            with self.subTest(key=key),self.assertRaises(c.GraphError):c.compile_graph(effect_graph(key,'top'))
        for key in ('discard','depth_out','td_alpha_test','td_dither'):
            g=c.demo_graph('color','mat');g['stages']['vertex']['nodes'].append(c.node(key,'invalid'))
            with self.subTest(key=key),self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_effects_inside_unused_subgraph_are_roots(self):
        g=effect_graph('discard');p=g['stages']['pixel'];p['nodes']=[n for n in p['nodes'] if n['id']!='effect']
        fn=copy.deepcopy(c.function_library()[0]);fn['stages']=['pixel'];fn['graph']['nodes'].append(c.node('discard','discard'))
        g['functions']=[fn];p['nodes'].append({'id':'sub','definitionUuid':c.CALL,'params':{'functionId':fn['id']}})
        result=c.compile_graph(g)
        self.assertEqual(result['pixel'].count('discard;'),1)
        # Ordinary unused arithmetic inside the same Subgraph remains pruned.
        self.assertTrue(any('Disconnected' in d['message'] for d in result['diagnostics']))

    def test_old_graph_output_unchanged(self):
        for target in ('mat','top'):
            g=c.demo_graph('color',target);before=c.compile_graph(g)['pixel']
            g['stages']['pixel']['nodes'].append(c.node('td_dither','unused')) if target=='mat' else None
            self.assertEqual(c.compile_graph(g)['pixel'],before)

    def test_unplaced_definition_has_no_effect(self):
        g=c.demo_graph('color','mat');before=c.compile_graph(g)['pixel']
        fn=copy.deepcopy(c.function_library()[0]);fn['stages']=['pixel'];fn['graph']['nodes'].append(c.node('discard','discard'))
        g['functions']=[fn]
        self.assertEqual(c.compile_graph(g)['pixel'],before)

    def test_subgraph_depth_duplicates_and_dependency_cycles(self):
        g=c.demo_graph('color','mat');fn=copy.deepcopy(c.function_library()[0]);fn['stages']=['pixel']
        fn['graph']['nodes'].append(c.node('depth_out','depth'));g['functions']=[fn]
        for ident in ('one','two'):g['stages']['pixel']['nodes'].append({'id':ident,'definitionUuid':c.CALL,'params':{'functionId':fn['id']}})
        with self.assertRaisesRegex(c.GraphError,'Only one Depth Output'):c.compile_graph(g)
        g=effect_graph('discard');p=g['stages']['pixel'];p['nodes'].append(c.node('router','cycle',type='bool'))
        p['edges'] += [c.edge('cycle','cycle','value'),c.edge('cycle','effect','condition')]
        with self.assertRaises(c.GraphError):c.compile_graph(g)


if __name__=='__main__':unittest.main()
