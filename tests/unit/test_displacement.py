"""Vertex displacement, external resource bindings, and old sampler compatibility."""
import copy
import unittest
import sgrape_core as c
import sgrape_document as document
import sgrape_library as library
from test_material_subgraphs import library as builtin


def displacement_graph(height=.8,scale=.25,midlevel=.5,normal=(1,2,3),sampled=False,shared=False):
    g=c.demo_graph('color','mat');g['declarations']=[]
    fn=builtin('displacement');g['functions']=[fn]
    call={'id':'displace','name':'Move_Surface','definitionUuid':c.CALL,'params':{'functionId':fn['id']},
          'inputValues':{'height':height,'scale':scale,'midlevel':midlevel,'normal':list(normal)},'ui':{'x':600,'y':160}}
    v=g['stages']['vertex'];v['nodes'].append(call)
    v['edges']=[e for e in v['edges'] if e['to']!=['deform','position']]
    v['edges'] += [c.edge('position','displace','position'),c.edge('displace','deform','position','position')]
    boundary=next(n for n in v['nodes'] if n['id']=='vertex')
    boundary['params']['outputs']=[dict(id='world',name='World Position',type='vec3',interpolation='smooth')]
    v['nodes'].append(c.node('swizzle','world',type='vec4',mask='xyz'))
    v['edges'] += [c.edge('deform','world','value'),c.edge('world','vertex','world')]
    g['stages']['pixel']={'nodes':[c.node('vertex_input','inputs'),c.node('rgba','rgba'),
        c.node('pixel_out','pixel',dither=False,alphaTest=False,convertColorSpace=False)],
        'edges':[c.edge('inputs','rgba','rgb','world'),c.edge('rgba','pixel','color')]}
    if sampled:
        g['declarations'].append(dict(id='heightMap',kind='sampler',name='sHeight',type='sampler2D',source='builtin:white'))
        v['nodes'] += [c.node('sampler','heightMap',declarationId='heightMap'),c.node('texture_lod_2d','sample'),
                       c.node('swizzle','height',type='vec4',mask='x'),c.node('builtin_source','uvSource',source='TDTexCoord'),
                       c.node('swizzle','uv',type='vec3',mask='xy')]
        v['edges'] += [c.edge('heightMap','sample','sampler'),c.edge('uvSource','uv','value'),c.edge('uv','sample','uv'),
                       c.edge('sample','height','value'),c.edge('height','displace','height')]
    if shared:
        p=g['stages']['pixel'];p['nodes'] += [c.node('sampler','sameMap',declarationId='heightMap'),c.node('texture_sample','sample')]
        p['edges']=[c.edge('sameMap','sample','sampler'),c.edge('sample','pixel','color')]
    return g


class Displacement(unittest.TestCase):
    def test_external_height_and_position_pipeline_compile_without_graph_mutation(self):
        for sampled,shared in [(False,False),(True,False),(True,True)]:
            g=displacement_graph(sampled=sampled,shared=shared);before=copy.deepcopy(g);code=c.compile_graph(g)
            self.assertEqual(g,before)
            self.assertIn('TDDeform(',code['vertex']);self.assertIn('normalize(',code['vertex'])
            self.assertEqual('textureLod(sHeight' in code['vertex'],sampled)
            self.assertEqual('texture(sHeight' in code['pixel'],shared)
            self.assertEqual(len(code['bindings']),int(sampled))

    def test_default_is_neutral_and_snapshot_stays_source_free(self):
        f=builtin('displacement');defaults={p['id']:p['default'] for p in f['inputs']}
        self.assertEqual(defaults['height'],defaults['midlevel']);self.assertEqual(defaults['scale'],1)
        g=displacement_graph();packet=library.build(c,g,f['id']);restored=library.entry(c,packet)
        self.assertEqual(restored['graph'],f['graph'])
        self.assertFalse(any(n['definitionUuid'] in ('sgrape.builtin.sampler','sgrape.builtin.uniform') for n in f['graph']['nodes']))

    def test_displacement_remains_mat_vertex_only(self):
        g=displacement_graph();call=next(n for n in g['stages']['vertex']['nodes'] if n['id']=='displace')
        g['stages']['pixel']['nodes'].append(copy.deepcopy(call))
        with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_ordinary_texture_sampling_does_not_gain_vertex_support(self):
        g=displacement_graph(sampled=True);v=g['stages']['vertex']
        v['nodes']=[c.node('texture_sample','sample') if n['id']=='sample' else n for n in v['nodes']]
        with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_old_sampler_revision_retains_binding_and_pixel_code(self):
        g=displacement_graph(sampled=True,shared=True);before=c.compile_graph(g)
        old=next(e['definition'] for e in c._CATALOG_DOCUMENT['history'] if e['definition']['key']=='sampler')
        node=next(n for n in g['stages']['pixel']['nodes'] if n['id']=='sameMap');node['revisionHash']=old['revisionHash']
        self.assertEqual(c.inspect_definition_reference(node)['status'],'compatible_history')
        after=c.compile_graph(g)
        self.assertEqual(before['pixel'],after['pixel']);self.assertEqual(before['bindings'],after['bindings'])

    def test_history_allows_added_stages_but_rejects_removed_stages(self):
        doc=copy.deepcopy(c._CATALOG_DOCUMENT);c.validate_catalog(doc)
        current=next(e['definition'] for e in doc['definitions'] if e['definition']['key']=='sampler')
        current['stages']=['vertex'];current['revisionHash']=c.digest({k:v for k,v in current.items() if k!='revisionHash'})
        with self.assertRaisesRegex(c.GraphError,'Historical behavior'):c.validate_catalog(doc)

    def test_saved_stage_metadata_does_not_force_unrelated_graph_upgrades(self):
        g=document.stamp_catalog(c.demo_graph('color','mat'),c)
        snapshot=g['catalogSnapshot']
        for uid,row in snapshot['definitions'].items():
            row['signature']['stages']=list(c.BY_UUID[uid]['stages'])
        snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        review=document.inspect_upgrade(g,c,'mat')
        self.assertFalse(review['blocked']);self.assertFalse(review['required'],review['changes'])


if __name__=='__main__':unittest.main()
