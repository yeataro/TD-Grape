"""Run bounded TOP/MAT pixel/vertex probes with changing native specialization.

No user shader is deployed or changed. The shared GPU harness verifies cleanup.
"""
from pathlib import Path

# Reuse the isolated fixture without triggering its normal full case collection.
text=(Path(__file__).with_name('test_array_nodes.py')).read_text(encoding='utf-8')
exec(text.replace("if 'op' in globals():result=run_native()",''),globals())


def build_cases(c):
    cases=[]
    decl=dict(id='count',kind='spec_constant',name='arrayCount',type='int',value=4,constantId=7)
    for element in ('float','vec3'):
        ty=element+'[sg_len_count]';width=c.type_components(element)
        get=c.node('array_get','operation',type=ty);get['inputValues']={'i':99}
        cases.append(dict(label='symbolic/native-'+element,nodes=[c.node('uniform','values',declarationId='values'),get],
            edges=[c.edge('values','operation','Array')],outputs=[dict(type=element,expected=[0]*width,node='operation',port='out')],
            declarations=[dict(id='count',kind='constant',name='arrayCount',type='int',value=4),dict(id='values',kind='uniform',name='uProbeArray',type=ty,nativeSequence='array',value=None)],
            arrayElement=element,
            updates=[dict(index=99,expected=[float(12+j+offset) for j in range(width)],samples=[[float(i*4+j+offset) for j in range(4)] for i in range(6)]) for offset in (1,21)]))
    for index in (1,99,-1):
        replace=c.node('array_replace','replace');replace['inputValues']={'i':index,'replacement':9.}
        get=c.node('array_get','operation');get['inputValues']={'i':1}
        cases.append(dict(label='symbolic/zero-replace-'+str(index),specialization=4,declarations=[decl],
            nodes=[c.node('array','values',length='sg_len_count'),replace,get],edges=[c.edge('values','replace','Array'),c.edge('replace','operation','Array')],
            outputs=[dict(type='float',expected=[9. if index==1 else 0.],node='operation',port='out')]))
    length=c.node('array_length','operation')
    cases.append(dict(label='symbolic/length-only',specialization=4,declarations=[decl],
        nodes=[c.node('array','values',length='sg_len_count'),length],edges=[c.edge('values','operation','Array')],
        outputs=[dict(type='int',expected=[4],node='operation',port='out')],
        updates=[dict(index=0,specialization=n,expected=[n]) for n in (4,2,5)]))
    replace=c.node('array_replace','replace');replace['inputValues']={'i':3,'replacement':9.}
    get=c.node('array_get','operation');get['inputValues']={'i':99}
    cases.append(dict(label='symbolic/changed-bounds',specialization=4,declarations=[decl],
        nodes=[c.node('array','values',length='sg_len_count'),replace,get],edges=[c.edge('values','replace','Array'),c.edge('replace','operation','Array')],
        outputs=[dict(type='float',expected=[0],node='operation',port='out')],
        updates=[dict(index=0,specialization=n,expected=[9. if n==4 else 0.]) for n in (4,2,5)]))
    code=c.node('glsl_code','values',functionName='makeSymbolicArray',inputs=[],outputs=[dict(id='out',name='result',type='float[sg_len_count]')],code='for (int i=0; i<result.length(); ++i) result[i]=float(i);')
    cases.append(dict(label='symbolic/glsl-code-output',specialization=4,declarations=[decl],
        nodes=[code,get],edges=[c.edge('values','operation','Array')],outputs=[dict(type='float',expected=[0],node='operation',port='out')],
        updates=[dict(index=0,specialization=n,expected=[n-1]) for n in (4,2,5)]))
    return cases


result=run_native()
