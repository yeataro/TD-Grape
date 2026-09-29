import copy
import itertools
import json
from pathlib import Path
import re
import unittest

import sgrape_core as c
import sgrape_voronoi as v
from voronoi_fixture import graph, reference, sample


class Voronoi(unittest.TestCase):
    def test_modes_all_targets_and_outputs(self):
        for dim, feature, metric in itertools.product(v.DIMENSIONS, v.FEATURES, v.METRICS):
            params = dict(dimensions=dim, feature=feature, metric=metric)
            ports = v.interface(params)
            self.assertEqual(ports, c.type_contract()['voronoi']['interfaces'][f'{dim}:{feature}:{metric}'])
            for target, stage in [('top','pixel'), ('mat','pixel'), ('mat','vertex')]:
                for output in ports['outputs']:
                    g = graph(c, dim, feature, metric, target, stage, output)
                    # vec3 Position has no implicit vec4 conversion; test via Combine.
                    if output == 'position':
                        data = g['stages'][stage]
                        data['nodes'].append(c.node('rgba','pack'))
                        data['edges'] = [c.edge('cells','pack','rgb','position'), c.edge('pack','result','color' if stage=='pixel' else 'position')]
                    before = copy.deepcopy(g)
                    compiled = c.compile_graph(g)
                    self.assertEqual(g, before)
                    self.assertIn('sg_VoronoiResult sg_voronoi_result_cells', compiled[stage])
                    self.assertNotIn('TDVoronoi', compiled[stage])

    def test_explicit_coordinates_and_hidden_settings(self):
        for dim in v.DIMENSIONS:
            result = c.compile_graph(graph(c, dim))['pixel']
            expected = 'vec4(0.0, 0.0, 0.0, 0.0)' if dim == 1 else 'vec4((vec3(0.0, 0.0, 0.0)).xy, 0.0, 0.0)' if dim == 2 else 'vec4(vec3(0.0, 0.0, 0.0), 0.0)'
            self.assertIn(expected, result)
        for feature in ('distance_to_edge','n_sphere_radius'):
            a = graph(c, 3, feature)
            b = copy.deepcopy(a); b['stages']['pixel']['nodes'][0]['params']['metric']='minkowski'
            # No exposed metric/exponent for geometric modes.
            self.assertNotIn('exponent', v.interface(b['stages']['pixel']['nodes'][0]['params'])['inputs'])
            self.assertEqual(c.compile_graph(a)['pixel'],c.compile_graph(b)['pixel'])

    def test_invalid_modes_and_wire_types_are_rejected(self):
        for key, value in [('dimensions',True),('dimensions',0),('dimensions',5),('dimensions','3'),('feature','bad'),('metric',{}),('normalize',1)]:
            g=graph(c);g['stages']['pixel']['nodes'][0]['params'][key]=value
            with self.subTest(key=key,value=value), self.assertRaises(c.GraphError): c.compile_graph(g)
        g=graph(c);g['stages']['pixel']['nodes'].append(c.node('vec4','coords'))
        g['stages']['pixel']['edges'].append(c.edge('coords','cells','vector'))
        with self.assertRaisesRegex(c.GraphError,'vec4 cannot connect to vec3'): c.compile_graph(g)

    def test_helpers_are_shared_and_unused_nodes_emit_nothing(self):
        g=graph(c);g['stages']['pixel']['nodes'].append(c.node('voronoi','unused',dimensions=4))
        result=c.compile_graph(g)['pixel'];self.assertNotIn('sg_voronoi_4_',result)
        g['stages']['pixel']['nodes'] += [c.node('voronoi','other'),c.node('add','sum')]
        g['stages']['pixel']['edges']=[c.edge('cells','sum','a','distance'),c.edge('other','sum','b','distance'),c.edge('sum','result','color')]
        result=c.compile_graph(g)['pixel']
        self.assertEqual(result.count('uint sg_voronoiHash(uint x)'),1)
        self.assertEqual(result.count('sg_VoronoiResult sg_voronoi_3_f1_euclidean_0('),1)
        compiled=c.compile_graph(g)
        helper_line=compiled['pixel'].splitlines().index('uint sg_voronoiHash(uint x) {')+1
        self.assertTrue(any(row['line']==helper_line and row['node']=='cells' for row in compiled['sourceMap']['pixel']))
        self.assertNotIn('voronoi',c.type_contract()['constantExpressions'])
        g['stages']['pixel']['nodes'][0]['params']['requireConstant']=True
        with self.assertRaisesRegex(c.GraphError,'Require Constant'): c.compile_graph(g)

    def test_analytic_regular_lattice_and_finite_edge_plane(self):
        for dim in v.DIMENSIONS:
            point=[.2]*dim
            self.assertAlmostEqual(sample(point, randomness=0)['distance'],(.3*.3*dim)**.5)
            self.assertAlmostEqual(sample(point,'distance_to_edge',randomness=0)['distance'],.2)
            self.assertAlmostEqual(sample(point,'n_sphere_radius',randomness=0)['distance'],.5)
            self.assertEqual(sample(point,'smooth_f1',randomness=0,smoothness=0),sample(point,randomness=0))
        point=[.19,.36,.72]
        edge=sample(point,'distance_to_edge')['distance']
        self.assertNotAlmostEqual(edge,sample(point,'f2')['distance']-sample(point)['distance'])
        for dim, feature in itertools.product(v.DIMENSIONS,['f1','f2','distance_to_edge','n_sphere_radius']):
            point=[.19,-1.36,.72,2.83][:dim]
            self.assertAlmostEqual(sample(point,feature)['distance'],sample(point,feature,radius=4)['distance'])

    def test_fractional_detail_normalization_and_zero_scale(self):
        for dim in v.DIMENSIONS:
            args=dict(dim=dim,vector=[.19,-.36,.72],w=.83,scale=2.3)
            one=reference(**args,detail=0);two=reference(**args,detail=1);half=reference(**args,detail=.5)
            self.assertAlmostEqual(half['distance'],.5*(one['distance']+two['distance']))
            normalized=reference(**args,detail=1.5,normalize=True)
            self.assertGreaterEqual(normalized['distance'],0);self.assertLessEqual(normalized['distance'],1)
            zero=reference(dim,scale=0)
            self.assertTrue(all(x==0 for x in zero.get('position',[])));self.assertEqual(zero.get('w',0),0)

    def test_catalog_projection_and_five_languages(self):
        root=Path(__file__).resolve().parents[2]
        definition=c.CATALOG['voronoi']
        self.assertEqual(definition['revisionHash'],c.digest({k:v for k,v in definition.items() if k!='revisionHash'}))
        projection=json.loads(re.search(r'<script id="node-browser-data" type="application/json">(.*?)</script>',(root/'src/editor/index.html').read_text('utf-8'),re.S)[1])
        self.assertEqual(projection['nodes'][definition['definitionUuid']]['categoryPath'],['math','noise'])
        locales=json.loads((root/'src/editor/locales.json').read_text('utf-8'))
        keys=set(v.DEFAULTS)|set(v.INPUT_DEFAULTS)|set(v.FEATURES)|set(v.METRICS)|{'distance','color','position','radius','hint'}
        for key in keys:
            for language in locales['languages']:self.assertTrue(locales['messages']['voronoi.'+key][language])


if __name__=='__main__': unittest.main(verbosity=2)
