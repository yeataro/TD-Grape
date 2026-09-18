"""GPU operator checks against independently calculated component values."""
from pathlib import Path

text=Path(__file__).with_name('test_array_nodes.py').read_text(encoding='utf-8')
exec(text.replace("if 'op' in globals():result=run_native()",'').replace('array-nodes-result.json','matrix-arithmetic-result.json'),globals())


def build_cases(c):
    cases=[]
    def add(key,a,b,ty,left,right,expected):
        node=c.node(key,'operation',type=ty,operandTypes={'a':a,'b':b})
        node['inputValues']={'a':left,'b':right}
        cases.append(dict(label=key+'/'+a+'/'+b,nodes=[node],edges=[],outputs=[dict(type=ty,expected=expected,node='operation',port='out')]))
    for family,prefix,vector in [('float','mat','vec'),('double','dmat','dvec')]:
        # All 27 legal matrix shape products per precision. Nonconstant cell
        # patterns distinguish row/column swaps and component multiplication.
        for rows in range(2,5):
            for inner in range(2,5):
                left=[float(1+col*rows+row) for col in range(inner) for row in range(rows)]
                a=c.matrix_type(family,inner,rows)
                for columns in range(2,5):
                    right=[float(2+col*inner+row) for col in range(columns) for row in range(inner)]
                    expected=[sum(left[k*rows+r]*right[col*inner+k] for k in range(inner)) for col in range(columns) for r in range(rows)]
                    add('multiply',a,c.matrix_type(family,columns,inner),c.matrix_type(family,columns,rows),left,right,expected)
                v=[float(i+1) for i in range(inner)]
                add('multiply',a,vector+str(inner),vector+str(rows),left,v,[sum(left[k*rows+r]*v[k] for k in range(inner)) for r in range(rows)])
                v=[float(i+2) for i in range(rows)]
                add('multiply',vector+str(rows),a,vector+str(inner),v,left,[sum(v[r]*left[col*rows+r] for r in range(rows)) for col in range(inner)])
        # Powers of two keep division comparisons exact in both precisions.
        a=prefix+'2x3';matrix=[1.,2.,4.,8.,16.,32.];other=[2.,4.,8.,16.,32.,64.]
        operators={'add':lambda a,b:a+b,'subtract':lambda a,b:a-b,'multiply':lambda a,b:a*b,'divide':lambda a,b:a/b}
        for key,fn in operators.items():
            add(key,a,family,a,matrix,2.,[fn(x,2.) for x in matrix])
            add(key,family,a,a,2.,matrix,[fn(2.,x) for x in matrix])
            if key!='multiply':add(key,a,a,a,matrix,other,[fn(x,y) for x,y in zip(matrix,other)])
    for key,fn in [('add',lambda a,b:a+b),('subtract',lambda a,b:a-b),('multiply',lambda a,b:a*b),('divide',lambda a,b:a/b)]:
        add(key,'double','double','double',1.+2**-40,2.,[fn(1.+2**-40,2.)])
        node=c.node(key,'operation',type='mat2x3');node['inputValues']={'a':[1.,2.,3.,4.,5.,6.]}
        cases.append(dict(label='default/'+key,nodes=[node],edges=[],outputs=[dict(type='mat2x3',expected=[1.,2.,3.,4.,5.,6.],node='operation',port='out')]))
    return cases


if 'op' in globals():result=run_native()
