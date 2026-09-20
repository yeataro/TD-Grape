"""POP bindings use metadata/configuration, not CPU copies of attribute values."""
import copy
import re
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
import sgrape_core as c
import sgrape_sources as sources
import sgrape_history as history
import test_history as fixtures


def graph(target='top',ty='float'):
    g=c.demo_graph('color',target)
    g['declarations']=[dict(id='data',kind='pop_buffer',name='Data',type=ty,value=None,
                           nativeSequence='buffer',popSource='/test/data',attributeClass='point',attribute='Data')]
    g['stages']['pixel']={'nodes':[c.node('pop_buffer','read',declarationId='data'),c.node('pixel_out','out')],
                          'edges':[c.edge('read','out','color')]}
    return g


class BufferSequence(fixtures.Sequence):
    def new(self):
        block={}
        for key,value in dict(name='',pop='',attrclass='point',attr='').items():
            block[key]=fixtures.Par(self.owner,key,value,block)
        return block


class BufferPars(fixtures.NativePars):
    def __getattr__(self,name):
        match=re.fullmatch(r'buffer([0-9]+)([a-z]+)',name)
        if match:
            index,key=match.groups()
            return self.owner.sequences['buffer'].blocks[int(index)][key]
        return super().__getattr__(name)


class PopBuffer(unittest.TestCase):
    def fixture(self):
        f=fixtures.History('test_value_undo_redo_and_unrelated_external_value');f.setUp();self.addCleanup(f.doCleanups)
        sequence=BufferSequence(f.operator,'buffer');f.operator.sequences['buffer']=sequence;f.operator.seq.buffer=sequence
        f.operator.par=BufferPars(f.operator);block=sequence.blocks[0]
        for key,value in dict(name='Data',pop='/test/data',attrclass='point',attr='Data').items():block[key].val=value
        attribute=SimpleNamespace(name='Data',size=1,type=float,numMatCols=0,numMatRows=0,isArray=True,arraySize=3,
                                  vals=Mock(side_effect=AssertionError('No GPU readback')))
        pop=SimpleNamespace(family='POP',path='/test/data',pointAttributes=[attribute],vertAttributes=[],primAttributes=[])
        block['pop'].eval=Mock(return_value=pop)
        declaration=graph()['declarations'][0];f.current['graph']['declarations'].append(declaration)
        f.storage[sources.STORE]['data']=dict(sequence='buffer',index=0,name='Data')
        return f,declaration,block,attribute

    def test_compile_accessors_and_explicit_output_type(self):
        for target in ('top','mat'):
            g=graph(target);before=copy.deepcopy(g);compiled=c.compile_graph(g)
            self.assertEqual(g,before);self.assertEqual(len(compiled['bindings']),1)
            self.assertIn('float(TDBuffer_Data(0u, 0u))',compiled['pixel'])
            self.assertNotIn('uniform float Data',compiled['pixel'])
            for port,code in [('length','TDBufferLength_Data()'),('arraySize','cTDBufferArraySize_Data')]:
                g['stages']['pixel']['edges'][0]['from'][1]=port
                result=c.compile_graph(g)['pixel'];self.assertIn(code,result);self.assertNotIn('TDBuffer_Data(',result)

    def test_invalid_declaration_not_treated_as_uniform(self):
        for key,value in [('type','bool'),('type','samplerBuffer'),('value',0),('nativeSequence','vec'),('expose',True),('initialDriver','absTime'),('attributeClass','invalid')]:
            g=graph();g['declarations'][0][key]=value
            with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_import_only_reads_attribute_definition_and_does_not_claim_precision(self):
        f,decl,block,attribute=self.fixture();row=next(r for r in sources.native_rows(f.operator) if r['sequence']=='buffer')
        metadata=sources.buffer_attribute(f.operator,0)
        self.assertFalse(metadata['precisionKnown']);self.assertEqual(metadata['arraySize'],3)
        declarations,_,issues=sources.reconcile([],{},[row],f.operator)
        self.assertEqual(issues,[]);self.assertEqual(declarations[0]['kind'],'pop_buffer');self.assertIsNone(declarations[0]['value'])
        attribute.vals.assert_not_called()
        block['pop'].eval.reset_mock();snapshot=sources.snapshot(f.runtime)
        self.assertEqual(next(r for r in snapshot['uniforms'] if r['id']=='data')['components'],[])
        attribute.vals.assert_not_called()

    def test_configuration_and_failed_binding_edit_preserve_previous_fields(self):
        f,decl,block,_=self.fixture();before=sources.capture_configuration(f.runtime,f.comp)
        block['attr'].val='Other';sources.restore_configuration(f.runtime,f.comp,before)
        self.assertEqual(block['attr'].val,'Data')
        snapshot=sources.snapshot(f.runtime);row=next(r for r in snapshot['uniforms'] if r['id']=='data')
        with self.assertRaisesRegex(sources.SourceError,'not found'):
            sources.edit(f.runtime,dict(action='bufferBinding',id='data',revision=snapshot['revision'],expected=row['bufferBinding']['expected'],fields=dict(pop='/test/data',attrclass='point',attr='Missing')))
        self.assertEqual(block['attr'].val,'Data')

    def test_driven_path_preserved_and_missing_used_data_rejected(self):
        f,decl,block,_=self.fixture();p=block['pop'];source=p.eval();p.mode='EXPRESSION';p.expr="op('../data')";p.evalExpression=Mock(return_value=source)
        self.assertFalse(sources.buffer_binding(f.operator,0)['writable'])
        sources.configure(f.runtime,f.comp,f.current['graph'],{})
        self.assertEqual(p.expr,"op('../data')");self.assertEqual(p.mode,'EXPRESSION')
        block['attr'].val='Missing'
        with self.assertRaisesRegex(sources.SourceError,'not found'):sources.configure(f.runtime,f.comp,f.current['graph'],{},used=set())
        with self.assertRaisesRegex(sources.SourceError,'not found'):sources.configure(f.runtime,f.comp,f.current['graph'],{},used={'data'})

    def test_history_restores_only_changed_buffer_field(self):
        f,_,block,_=self.fixture();before=f.token();block['attr'].val='Other';after=f.token()
        f.par('B').val=91
        history.restore(f.runtime,f.request(before,after,ids=('data',)))
        self.assertEqual(block['attr'].val,'Data');self.assertEqual(f.par('B').val,91)


if __name__=='__main__':unittest.main()
