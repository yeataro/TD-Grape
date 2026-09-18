"""Array Create GPU checks in disposable TOP and MAT pixel/vertex fixtures."""
from pathlib import Path

text=Path(__file__).with_name('test_array_nodes.py').read_text(encoding='utf-8')
exec(text.replace("if 'op' in globals():result=run_native()",''),globals())


def build_cases(c):
    cases=[]
    def add(label,nodes,edges,ty,expected,**extra):
        cases.append(dict(label='create/'+label,nodes=nodes,edges=edges,
            outputs=[dict(type=ty,expected=expected,node='operation',port='out')],**extra))
    for ty,value in [('float',2.5),('vec3',[1.,2.,3.]),('double',1.+2**-40),('bool',True),('mat2x3',[1.,2.,3.,4.,5.,6.])]:
        make=c.node('array_create','values',elementType=ty);make['inputValues']={'length':3,'value':value}
        get=c.node('array_get','operation');get['inputValues']={'i':99}
        add('fill-'+ty,[make,get],[c.edge('values','operation','Array')],ty,value if isinstance(value,list) else [value])
    spec=dict(id='count',kind='spec_constant',name='arrayCount',type='int',value=4,constantId=7)
    live=dict(id='live',kind='uniform',name='uArrayIndex',type='float',value=2.)
    for special in (False,True):
        source=c.node('spec_constant','count',declarationId='count') if special else c.node('scalar','count',type='uint',value=4)
        sum_node=c.node('add','size',type='int');sum_node['inputValues']={'b':1}
        base=[source,sum_node,c.node('array_create','values'),c.node('uniform','live',declarationId='live')]
        wires=[c.edge('count','size','a'),c.edge('size','values','length'),c.edge('live','values','value')]
        get=c.node('array_get','operation');get['inputValues']={'i':99}
        options={'declarations':[live,spec] if special else [live]}
        if special:options['specialization']=4
        add(('spec' if special else 'ordinary')+'-chain-runtime-fill',base+[get],wires+[c.edge('values','operation','Array')],'float',[2.],
            updates=[dict(index=v,expected=[v],**({'specialization':n} if special else {})) for v,n in ((2.,4),(-3.,2),(7.,5))],**options)
        if special:
            add('spec-chain-length',base+[c.node('array_length','operation')],wires+[c.edge('values','operation','Array')],'int',[5],
                updates=[dict(index=0,specialization=n,expected=[n+1]) for n in (4,2,5)],**options)
    return cases


result=run_native()
