"""Geometry attributes share inventory/history, but never Uniform values."""
import copy
import re
import unittest
import sgrape_core as c
import sgrape_sources as s
import test_history as fixtures


def graph(ty='vec3'):
    g=c.demo_graph('color','mat')
    g['declarations'].append(dict(id='attribute',kind='attribute',name='Offset',type=ty,value=None,arraySize=1,nativeSequence='mattr' if ty.startswith('mat') else 'attr'))
    v=g['stages']['vertex'];v['nodes'].append(c.node('attribute','attr',declarationId='attribute'))
    v['edges'][0]=c.edge('attr','deform','position')
    if ty.startswith('mat'):
        v['nodes'].append(c.node('determinant','det',type=ty));v['edges'][0]=c.edge('det','deform','position');v['edges'].append(c.edge('attr','det','value'))
    return g


class Sequence(fixtures.Sequence):
    def new(self):
        block={}
        values=dict(name='',type='float') if self.name=='attr' else dict(name='',cols=2,comps=2)
        for key,value in values.items():
            p=fixtures.Par(self.owner,key,value,block);p.menuNames=list(s.ATTRIBUTE_TOKENS) if key=='type' else [];block[key]=p
        return block


class Pars(fixtures.NativePars):
    def __getattr__(self,name):
        match=re.fullmatch(r'(m?attr)([0-9]+)([a-z]+)',name)
        if match:
            sequence,index,suffix=match.groups()
            try:return self.owner.sequences[sequence].blocks[int(index)][suffix]
            except (IndexError,KeyError):pass
        return super().__getattr__(name)


class MatAttributes(unittest.TestCase):
    def fixture(self):
        f=fixtures.History('test_value_undo_redo_and_unrelated_external_value');f.setUp();self.addCleanup(f.doCleanups)
        for key in ('attr','mattr'):
            sequence=Sequence(f.operator,key);f.operator.sequences[key]=sequence;setattr(f.operator.seq,key,sequence)
        f.operator.par=Pars(f.operator)
        f.operator.par.attr0name.val='Offset';f.operator.par.attr0type.val='float3'
        return f

    def test_accessor_has_no_uniform_or_duplicate_glsl_declaration(self):
        for ty in ('float','vec3','mat3'):
            g=graph(ty);before=copy.deepcopy(g);result=c.compile_graph(g)
            self.assertIn('TDAttrib_Offset(',result['vertex']);self.assertNotIn('uniform '+ty+' Offset',result['vertex'])
            self.assertNotIn('in '+ty+' Offset',result['vertex']);self.assertEqual(g,before)
        g=graph();g['stages']['vertex']['edges'][0]=c.edge('attr','deform','position','arraySize')
        self.assertNotIn('TDAttrib_Offset(',c.compile_graph(g)['vertex'])

    def test_target_stage_and_types_are_checked(self):
        g=graph();g['target']='top'
        with self.assertRaises(c.GraphError):c.compile_graph(g)
        g=graph();g['stages']['pixel']['nodes'].append(c.node('attribute','wrong',declarationId='attribute'))
        with self.assertRaises(c.GraphError):c.compile_graph(g)
        for ty in ('bool','sampler2D','dmat3'):
            g=graph();g['declarations'][-1]['type']=ty
            with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_native_inventory_is_configuration_only_and_maps_old_menu_tokens(self):
        f=self.fixture();snap=s.snapshot(f.runtime);decl=next(d for d in snap['declarations'] if d['name']=='Offset')
        self.assertEqual(decl['kind'],'attribute');self.assertEqual(decl['type'],'vec3');self.assertIsNone(decl['value'])
        row=next(r for r in snap['uniforms'] if r['id']==decl['id'])
        self.assertEqual(row['components'],[]);self.assertFalse(row['attributeBinding']['sizeSupported'])
        self.assertEqual(s.attribute_parameters(f.operator,'attr',0,decl),{'type':'float3'})
        with self.assertRaisesRegex(s.SourceError,'Array Size'):s.attribute_parameters(f.operator,'attr',0,dict(decl,arraySize=2))
        f.operator.par.mattr0name.val='Transform';f.operator.par.mattr0cols.val=3;f.operator.par.mattr0comps.val=2
        decl=next(d for d in s.snapshot(f.runtime)['declarations'] if d['name']=='Transform')
        self.assertEqual(decl['type'],'mat3x2')

    def test_type_edit_keeps_native_identity_and_returns_wire_preserving_draft(self):
        f=self.fixture();snap=s.snapshot(f.runtime);decl=next(d for d in snap['declarations'] if d['name']=='Offset')
        row=next(r for r in snap['uniforms'] if r['id']==decl['id']);request=dict(action='attributeConfig',id=decl['id'],revision=snap['revision'],expected=row['attributeBinding']['expected'],type='vec2',arraySize=1)
        result=s.edit(f.runtime,request)
        self.assertEqual(f.operator.par.attr0type.val,'float2');self.assertEqual(f.operator.seq.attr.numBlocks,1)
        self.assertTrue(next(d for d in result['graph']['declarations'] if d['id']==decl['id'])['sourceMissing'])
        self.assertEqual(next(d for d in result['workingGraph']['declarations'] if d['id']==decl['id'])['type'],'vec2')
        self.assertEqual(result['workingGraph']['stages'],snap['graph']['stages'])
        with self.assertRaises(s.SourceError):s.edit(f.runtime,request)


if __name__=='__main__':unittest.main()
