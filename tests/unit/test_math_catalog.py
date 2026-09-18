import copy
import json
from pathlib import Path
import subprocess
import unittest
import sgrape_core as c

NEW=('subtract','divide','min','max','clamp','smoothstep','abs','fract','pow','cos','dot','length','normalize')

def math_graph(key,ty):
    g=c.demo_graph('color');p=g['stages']['pixel'];operation=c.node(key,'operation',type=ty)
    output=c.CATALOG[key]['outputs']['out'];output=ty if output=='T' else output
    p['nodes']=[operation,c.node('rgba','compose'),c.node('pixel_out','pixel')]
    p['edges']=[c.edge('compose','pixel','color')]
    if output.startswith('vec'):
        reduction=c.node('dot','reduce',type=output);reduction['inputValues']={'b':[1]*int(output[-1])}
        p['nodes'].append(reduction);p['edges'] += [c.edge('operation','reduce','a'),c.edge('reduce','compose','rgb')]
    else:p['edges'].append(c.edge('operation','compose','rgb'))
    return g

class MathCatalog(unittest.TestCase):
    def test_every_type_has_matching_output_and_stable_saved_graph(self):
        for key in NEW:
            for ty in c.FLOAT_TYPES:
                with self.subTest(key=key,type=ty):
                    g=math_graph(key,ty);before=copy.deepcopy(g);compiled=c.compile_graph(g)
                    self.assertEqual(g,before)
                    self.assertEqual(compiled,c.compile_graph(json.loads(json.dumps(g))))
                    expected='float' if key in ('dot','length') else ty
                    self.assertEqual(compiled['stages']['pixel']['ports']['operation']['out']['out'],expected)
                    self.assertIn('sg_n_operation',compiled['pixel'])

    def test_defaults_match_parameter_panel_for_every_type(self):
        rows=[]
        for key in NEW:
            for ty in c.FLOAT_TYPES:
                for port,t in c.CATALOG[key]['inputs'].items():
                    t=ty if t=='T' else t
                    rows.append({'node':c.node(key,'probe',type=ty),'port':port,'type':t,'expected':c.input_default(key,port,t)})
        script="""const fs=require('fs'),vm=require('vm');const data=JSON.parse(fs.readFileSync(0,'utf8'));
const context={t:x=>x,document:{addEventListener(){}},clone:x=>JSON.parse(JSON.stringify(x)),definition:n=>data.catalog.find(d=>d.definitionUuid===n.definitionUuid)};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);context.setTypeContract(data.contract);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
process.stdout.write(JSON.stringify(data.rows.map(r=>context.defaultInput(r.node,r.port,r.type))));"""
        root=Path(__file__).resolve().parents[2]/'src/editor'
        result=subprocess.check_output(['node','-e',script,str(root/'inspector.js'),str(root/'graph_ui.js')],input=json.dumps({'contract':c.type_contract(),'catalog':list(c.CATALOG.values()),'rows':rows}),text=True)
        self.assertEqual(json.loads(result),[row['expected'] for row in rows])

    def test_wire_value_precedence_and_saved_divisor(self):
        g=math_graph('divide','float');p=g['stages']['pixel'];op=p['nodes'][0]
        self.assertIn('0.0 / 1.0',c.compile_graph(g)['pixel'])
        op['inputValues']={'a':.8,'b':.4};p['nodes'].append(c.node('float','divisor',value=.2))
        p['edges'].append(c.edge('divisor','operation','b'))
        self.assertIn('0.8 / sg_n_divisor',c.compile_graph(g)['pixel'])
        self.assertEqual(op['inputValues']['b'],.4)
        p['edges'].pop();self.assertIn('0.8 / 0.4',c.compile_graph(g)['pixel'])

    def test_new_functions_have_preserved_alpha_and_valid_stages(self):
        library=c.function_library()
        self.assertEqual(len(library),4)
        for f in library[1:]:
            self.assertIn(c.edge('split','rgba','alpha','a'),f['graph']['edges'])
            for stage in ('pixel','vertex'):
                g=c.demo_graph('color');g['functions']=[f]
                g['stages'][stage]={'nodes':[{'id':'filter','definitionUuid':c.CALL,'params':{'functionId':f['id']}},c.node(stage+'_out','result')],
                                    'edges':[c.edge('filter','result','color' if stage=='pixel' else 'position','color')]}
                self.assertTrue(c.compile_graph(g)[stage])

if __name__=='__main__':unittest.main(verbosity=2)
