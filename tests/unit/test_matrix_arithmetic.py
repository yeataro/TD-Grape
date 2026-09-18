"""Operator contracts, concrete saved signatures, and unchanged legacy shaders."""
import copy
import json
from pathlib import Path
import subprocess
import unittest

import sgrape_core as c
from test_matrix_foundation import graph


class MatrixArithmetic(unittest.TestCase):
    def test_every_signature_compiles_and_round_trips_without_graph_mutation(self):
        for key in c.ARITHMETIC_KEYS:
            self.assertEqual(c.arithmetic_variants(key)[0]['type'],c.CATALOG[key]['defaults']['type'])
            for variant in c.arithmetic_variants(key):
                with self.subTest(key=key,inputs=variant['inputs']):
                    operation=c.node(key,'matrix',type=variant['type'],**variant.get('params',{}))
                    operation['inputValues']={p:c.filled_value(t,2) for p,t in variant['inputs'].items()}
                    document=graph([operation],ty=variant['type']);before=copy.deepcopy(document)
                    result=c.compile_graph(document)
                    self.assertEqual(document,before)
                    self.assertEqual(result,c.compile_graph(json.loads(json.dumps(document))))
                    self.assertEqual(c.resolved_ports(c.CATALOG[key],operation['params']),{k:variant[k] for k in ('inputs','outputs')})

    def test_operand_order_and_shape(self):
        for family,prefix,vector in [('float','mat','vec'),('double','dmat','dvec')]:
            for key in c.ARITHMETIC_KEYS:
                for a,b,out in [(prefix+'3',family,prefix+'3'),(family,prefix+'3',prefix+'3')]:
                    self.assertEqual(c.arithmetic_result(key,a,b),out)
            for a,b,out in [(prefix+'2x3',prefix+'4x2',prefix+'4x3'),(prefix+'2x3',vector+'2',vector+'3'),(vector+'3',prefix+'2x3',vector+'2')]:
                self.assertEqual(c.arithmetic_result('multiply',a,b),out)
            self.assertIsNone(c.arithmetic_result('multiply',prefix+'2x3',prefix+'2x3'))
            for key in ('add','subtract','divide'):
                self.assertIsNone(c.arithmetic_result(key,prefix+'3',vector+'3'))
                self.assertIsNone(c.arithmetic_result(key,prefix+'2x3',prefix+'3x2'))

    def test_invalid_saved_signatures_are_rejected(self):
        for operands in [None,[],{'a':'mat3'},{'a':'mat3','b':'vec3'}, {'a':'mat3','b':'dmat3'}, {'a':'mat3','b':{}}, {'a':'mat3','b':'float','c':'float'}]:
            with self.subTest(operands=operands),self.assertRaises(c.GraphError):
                c.resolved_ports(c.CATALOG['add'],{'type':'mat3','operandTypes':operands})
        with self.assertRaises(c.GraphError):c.resolved_ports(c.CATALOG['multiply'],{'type':'mat3','operandTypes':{'a':'mat2x3','b':'mat4x2'}})

    def test_scalar_is_not_emitted_as_diagonal_matrix(self):
        for key in c.ARITHMETIC_KEYS:
            for a,b in [('mat3','float'),('float','mat3')]:
                operation=c.node(key,'matrix',type='mat3',operandTypes={'a':a,'b':b})
                operation['inputValues']={'a':c.filled_value(a,2),'b':c.filled_value(b,3)}
                code=c.compile_graph(graph([operation],ty='mat3'))['pixel']
                scalar='2.0' if a=='float' else '3.0'
                self.assertNotIn('mat3('+scalar+')',code)
                self.assertIn(('('+scalar+' ' if a=='float' else ' '+scalar+')'),code)

    def test_unconnected_matrix_defaults_match_operator_neutral_values(self):
        for ty in c.MATRIX_TYPES:
            for key in ('add','subtract'):self.assertEqual(c.input_default(key,'b',ty),[0]*c.type_components(ty))
            self.assertEqual(c.input_default('divide','b',ty),[1]*c.type_components(ty))
            self.assertEqual(c.input_default('multiply','b',ty),c.matrix_identity(ty))

    def test_editor_signatures_wiring_history_and_local_creator(self):
        payload={'catalog':list(c.CATALOG.values()),'contract':c.type_contract()}
        output=subprocess.check_output(['node',str(Path(__file__).with_name('test_matrix_arithmetic.js'))],input=json.dumps(payload),text=True)
        self.assertIn('matrix arithmetic editor passed',output)
