"""Opaque CHOP Texture Buffers remain native resources across graph operations."""
import copy
import unittest
from unittest.mock import Mock
from types import SimpleNamespace

import sgrape_core as c
import sgrape_document as document
import sgrape_sources as sources
import test_array_sources
from test_sampler_split import fn


def graph(target='top'):
    g=c.demo_graph('color',target)
    g['declarations']=[dict(id='data',kind='uniform',name='uData',type='samplerBuffer',
                            nativeSequence='array',elementType='vec3',value=None)]
    g['stages']['pixel']={'nodes':[c.node('uniform','source',declarationId='data'),
        c.node('buffer_fetch','read'),c.node('buffer_length','length'),c.node('divide','scaled',type='vec4'),c.node('pixel_out','out')],
        'edges':[c.edge('source','read','buffer'),c.edge('source','length','buffer'),
                 c.edge('read','scaled','a'),c.edge('length','scaled','b'),c.edge('scaled','out','color')]}
    return g


class TextureBuffer(unittest.TestCase):
    def format_fixture(self):
        fixture=test_array_sources.ArraySources('test_shape_restricts_native_carrier_not_all_graph_arrays')
        result=fixture.fixture();self.addCleanup(fixture.doCleanups)
        return result

    def test_format_adoption_is_explicit_draft_and_reuses_row(self):
        f,decl,block=self.format_fixture();block['arraytype'].val='texturebuffer'
        snap=sources.snapshot(f.runtime);row=next(r for r in snap['uniforms'] if r['id']=='arr')
        self.assertTrue(row['missing']);self.assertEqual(row['formatChange']['arrayType'],'texturebuffer')
        saved=copy.deepcopy(f.current)
        result=sources.edit(f.runtime,dict(action='adoptFormat',id='arr',revision=snap['revision'],expected=row['formatChange']['expected']))
        adopted=next(d for d in result['workingGraph']['declarations'] if d['id']=='arr')
        self.assertEqual(adopted['type'],'samplerBuffer');self.assertIsNone(adopted['value'])
        self.assertNotIn('sourceMissing',adopted);self.assertTrue(result['proposal'])
        self.assertEqual(saved,f.current);block['chop'].eval.assert_not_called()
        self.assertEqual(result['workingGraph']['stages'],saved['graph']['stages'])
        sources.configure(f.runtime,f.comp,result['workingGraph'],{})
        self.assertEqual(f.operator.seq.array.numBlocks,1)
        self.assertEqual(block['arraytype'].val,'texturebuffer');self.assertEqual(block['chop'].val,'../points')
        self.assertNotIn('missing',f.storage[sources.STORE]['arr'])

    def test_adoption_reads_array_length_only_on_request_and_checks_conflicts(self):
        f,decl,block=self.format_fixture();decl.update(type='samplerBuffer',value=None)
        snap=sources.snapshot(f.runtime);row=next(r for r in snap['uniforms'] if r['id']=='arr')
        block['chop'].eval.assert_not_called()
        request=dict(action='adoptFormat',id='arr',revision=snap['revision'],expected=row['formatChange']['expected'])
        block['type'].val='vec4'
        with self.assertRaisesRegex(sources.SourceError,'format changed'):sources.edit(f.runtime,request)
        block['type'].val='vec3';block['chop'].eval=Mock(return_value=SimpleNamespace(family='CHOP',numSamples=7))
        result=sources.edit(f.runtime,request)
        adopted=next(d for d in result['workingGraph']['declarations'] if d['id']=='arr')
        self.assertEqual(adopted['type'],'vec3[7]');self.assertNotIn('elementType',adopted)
        self.assertEqual(decl['type'],'samplerBuffer')
        block['chop'].eval=Mock(return_value=None)
        with self.assertRaisesRegex(sources.SourceError,'CHOP'):sources.edit(f.runtime,request)

    def test_deleted_or_ambiguous_native_rows_cannot_be_adopted(self):
        f,decl,block=self.format_fixture();block['arraytype'].val='texturebuffer'
        snap=sources.snapshot(f.runtime);row=next(r for r in snap['uniforms'] if r['id']=='arr')
        request=dict(action='adoptFormat',id='arr',revision=snap['revision'],expected=row['formatChange']['expected'])
        f.operator.seq.array.numBlocks=2;f.operator.seq.array.blocks[1]['name'].val=decl['name']
        with self.assertRaises(sources.SourceError):sources.edit(f.runtime,request)
        row=next(r for r in sources.snapshot(f.runtime)['uniforms'] if r['id']=='arr')
        self.assertNotIn('formatChange',row)

    def test_read_length_and_multiple_references_share_one_native_binding(self):
        for target in ('top','mat'):
            g=graph(target);before=copy.deepcopy(g);result=c.compile_graph(g)
            self.assertEqual(before,g)
            self.assertIn('uniform samplerBuffer uData;',result['pixel'])
            self.assertIn('texelFetch(uData, ',result['pixel'])
            self.assertIn('textureSize(uData)',result['pixel'])
            self.assertNotIn('samplerBuffer sg_n_',result['pixel'])
            self.assertEqual(len(result['bindings']),1)
            self.assertEqual(document.inspect_document(g,c,target)['status'],'valid')

    def test_unconnected_and_wrong_resources_fail_without_black_fallback(self):
        for key in ('buffer_fetch','buffer_length'):
            g=graph();g['stages']['pixel']={'nodes':[c.node(key,'read'),c.node('pixel_out','out')],
                                           'edges':[c.edge('read','out','color')]}
            with self.assertRaisesRegex(c.GraphError,'Connect a Texture Buffer'):c.compile_graph(g)
        g=graph();g['stages']['pixel']['nodes'].append(c.node('float','number'))
        g['stages']['pixel']['edges'][0]=c.edge('number','read','buffer')
        with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_function_resource_passthrough_keeps_alias(self):
        g=graph();f=fn()
        for p in f['inputs']+f['outputs']:p['type']='samplerBuffer'
        g['functions']=[f];stage=g['stages']['pixel']
        stage['nodes'].append(dict(id='call',definitionUuid=c.CALL,params={'functionId':f['id']},ui={'x':0,'y':0}))
        stage['edges'][0]=c.edge('call','read','buffer','image')
        stage['edges'].append(c.edge('source','call','image'))
        code=c.compile_graph(g)['pixel']
        self.assertIn('texelFetch(uData, ',code);self.assertNotIn('samplerBuffer sg_',code)

    def test_buffer_is_not_a_numeric_default_or_array_element(self):
        for field,value in [('value',0),('initialDriver','absTime'),('nativeSequence','vec'),('elementType','int')]:
            g=graph();g['declarations'][0][field]=value
            with self.assertRaises(c.GraphError):c.compile_graph(g)
        self.assertFalse(c.valid_port_type('samplerBuffer[4]',resources=False))
        with self.assertRaises(c.GraphError):
            c.type_registry().interface('array_create',dict(elementType='samplerBuffer',length=4))

    def test_inventory_tracks_format_not_sample_data(self):
        fixture=test_array_sources.ArraySources('test_shape_restricts_native_carrier_not_all_graph_arrays')
        f,decl,block=fixture.fixture();self.addCleanup(fixture.doCleanups)
        decl.update(type='samplerBuffer',elementType='vec3',value=None)
        block['arraytype'].val='texturebuffer'
        block['chop'].eval=Mock(side_effect=AssertionError('Do not inspect Buffer samples or length'))
        snap=sources.snapshot(f.runtime);row=next(r for r in snap['uniforms'] if r['id']=='arr')
        self.assertEqual(row['components'],[]);self.assertNotIn('length',row['arrayBinding'])
        sources.configure(f.runtime,f.comp,f.current['graph'],{})
        block['type'].val='vec4'
        declarations,_,issues=sources.reconcile([decl],f.storage[sources.STORE],sources.native_rows(f.operator),f.operator)
        self.assertEqual(issues,[]);self.assertEqual(declarations[0]['elementType'],'vec4')
        block['chop'].eval.assert_not_called()


if __name__=='__main__':unittest.main()
