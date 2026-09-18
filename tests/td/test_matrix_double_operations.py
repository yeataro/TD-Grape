"""Core-generated Convert / If / native double math GPU validation.

Run through the coordinated TD job runner with GRAPE_ROOT, source_path and
GRAPE_TEST_OUTPUT. Reuses the isolated matrix-node readback fixture and its
shader/registry preservation checks; no user shader is deployed or selected.
Output: matrix-nodes-result.json in this job's independent report directory.
"""
from pathlib import Path
import importlib.util
import math
import struct


def build_cases(c):
    cases = []

    def add(label, nodes, edges, ty, expected, tolerance=0., updates=None, declarations=()):
        cases.append(dict(label=label,nodes=nodes,edges=edges,
            outputs=[dict(node='operation',port='out',type=ty,expected=list(expected))],
            tolerance=tolerance,updates=updates or [{}],declarations=list(declarations)))

    def source(ty,values,ident='source'):
        if ty in c.MATRIX_TYPES:return c.node('matrix',ident,type=ty,values=values)
        if c.type_components(ty)==1:return c.node('scalar',ident,type=ty,value=values[0])
        return c.node('vector',ident,type=ty,components=values+[False if c.TYPE_DESCRIPTORS[ty]['family']=='bool' else 0]*(4-len(values)))

    def convert_scalar(value,family):
        if family=='bool':return bool(value)
        if family in ('int','uint'):return math.trunc(value)
        if family=='float':return struct.unpack('f',struct.pack('f',float(value)))[0]
        return float(value)

    def constructor_values(from_type,to_type,values):
        # CPU reference follows GLSL construction, not the core emitter.
        a,b=c.TYPE_DESCRIPTORS[from_type],c.TYPE_DESCRIPTORS[to_type]
        cast=lambda value:convert_scalar(value,b['family'])
        if to_type in c.MATRIX_TYPES:
            if from_type in c.MATRIX_TYPES:
                return [cast(values[column*a['rows']+row]) if column<a['columns'] and row<a['rows'] else cast(column==row)
                        for column in range(b['columns']) for row in range(b['rows'])]
            if a['components']==1:
                return [cast(values[0]) if column==row else cast(0)
                        for column in range(b['columns']) for row in range(b['rows'])]
        return [cast(values[0])]*b['components'] if a['components']==1 else [cast(v) for v in values[:b['components']]]

    precise=1.+2**-40
    constructors=[
        ('float','mat3',[2.5]),('double','dmat2x3',[precise]),('bool','dmat2',[False]),
        ('ivec4','mat2',[1,-2,3,4]),('bvec4','dmat2',[True,False,False,True]),
        ('dvec4','mat2',[precise,2.25,3.5,4.75]),
        ('mat2x3','mat3x2',[1.25,2.25,3.25,4.25,5.25,6.25]),
        ('dmat2','mat4',[precise,2.25,3.5,4.75]),
        ('mat4','dmat2',[float(i)+.25 for i in range(16)]),
        ('mat2x4','dmat4x2',[float(i)+.25 for i in range(8)]),
        ('mat3x2','dvec4',[float(i)+.25 for i in range(6)]),
        ('dmat3x2','vec3',[precise,2.25,3.25,4.25,5.25,6.25]),
        ('mat2x3','int',[2.75,3.25,4.25,5.25,6.25,7.25]),
        ('dmat4','double',[precise]+[float(i)+.25 for i in range(1,16)]),
        ('mat2','bool',[0.,2.,3.,4.]),('dvec4','ivec2',[1.75,-2.5,3.25,4.]),
        ('vec3','double',[2.5,3.25,4.75]),
    ]
    for from_type,to_type,values in constructors:
        add('convert/'+from_type+'/'+to_type,
            [source(from_type,values),c.node('convert','operation',fromType=from_type,toType=to_type)],
            [c.edge('source','operation','value')],to_type,constructor_values(from_type,to_type,values))

    for ty in ('mat2','mat2x3','dmat3','dmat3x2','double','dvec3'):
        d=c.TYPE_DESCRIPTORS[ty];count=d['components']
        for selected in (False,True):
            operation=c.node('if','operation',type=ty);operation['inputValues']={'condition':selected}
            if ty in c.MATRIX_TYPES:
                expected=[float(selected and column==row) for column in range(d['columns']) for row in range(d['rows'])]
            else:expected=[float(selected)]*count
            add('if/default-'+str(selected).lower()+'/'+ty,[operation],[],ty,expected)
        yes=[float(i+1) for i in range(count)];no=[float(20+i) for i in range(count)]
        declaration=dict(id='column',kind='uniform',name='uMatrixColumn',type='bool',value=False)
        updates=[dict(column=int(selected),row=0,expected=[yes if selected else no]) for selected in (False,True)]
        add('if/runtime-both-branches/'+ty,
            [source(ty,yes,'yes'),source(ty,no,'no'),c.node('uniform','condition',declarationId='column'),c.node('if','operation',type=ty)],
            [c.edge('yes','operation','true'),c.edge('no','operation','false'),c.edge('condition','operation','condition')],
            ty,no,updates=updates,declarations=[declaration])

    for ty in ('double','dvec3'):
        count=c.type_components(ty)
        def shape(values):return values[0] if count==1 else list(values[:count])
        def values(sequence):return list(sequence[:count])
        samples=[-1.75,.25,2.125]
        unary={
            'sqrt':([.25,4.,9.],lambda x:math.sqrt(x)),
            'abs':(samples,lambda x:abs(x)),
            'sign':([-2.,0.,3.],lambda x:float((x>0)-(x<0))),
            'floor':(samples,lambda x:float(math.floor(x))),
            'round':(samples,lambda x:float(round(x))),
            'ceil':(samples,lambda x:float(math.ceil(x))),
            'trunc':(samples,lambda x:float(math.trunc(x))),
            'fract':(samples,lambda x:x-math.floor(x)),
        }
        for key,(arguments,evaluate) in unary.items():
            operation=c.node(key,'operation',type=ty);operation['inputValues']={'value':shape(arguments)}
            add(key+'/'+ty,[operation],[],ty,[evaluate(v) for v in values(arguments)])
        for key in ('min','max','mod'):
            a,b=[-1.25,.25,1.5],[1.,.5,-1.]
            evaluate=min if key=='min' else max if key=='max' else lambda x,y:x-y*math.floor(x/y)
            operation=c.node(key,'operation',type=ty);operation['inputValues']={'a':shape(a),'b':shape(b)}
            add(key+'/'+ty,[operation],[],ty,[evaluate(x,y) for x,y in zip(values(a),values(b))])
        operation=c.node('clamp','operation',type=ty)
        operation['inputValues']={'value':shape([-2.,.5,3.]),'min':shape([0.,0.,0.]),'max':shape([1.,1.,1.])}
        add('clamp/'+ty,[operation],[],ty,values([0.,.5,1.]))
        operation=c.node('smoothstep','operation',type=ty)
        operation['inputValues']={'value':shape([-.25,.25,1.25]),'edge0':shape([0.,0.,0.]),'edge1':shape([1.,1.,1.])}
        add('smoothstep/'+ty,[operation],[],ty,values([0.,.15625,1.]))
        operation=c.node('mix','operation',type=ty)
        operation['inputValues']={'a':shape([1.,2.,3.]),'b':shape([2.,3.,4.]),'factor':precise}
        add('mix/double-factor-precision/'+ty,[operation],[],ty,[a+precise for a in values([1.,2.,3.])])
        operation=c.node('dot','operation',type=ty)
        operation['inputValues']={'a':shape([precise,2.,3.]),'b':shape([1.,4.,5.])}
        add('dot/precise-scalar-output/'+ty,[operation],[],'double',[sum(a*b for a,b in zip(values([precise,2.,3.]),values([1.,4.,5.])))])
        for key in ('length','normalize'):
            v=values([-3.,4.,12.]);length=math.sqrt(sum(x*x for x in v))
            operation=c.node(key,'operation',type=ty);operation['inputValues']={'value':shape(v)}
            add(key+'/'+ty,[operation],[],'double' if key=='length' else ty,
                [length] if key=='length' else [x/length for x in v],tolerance=0. if key=='length' else 2e-12)
        operation=c.node('range_from','operation',type=ty)
        operation['inputValues']={'value':shape([3.,4.,7.]),'min':shape([1.,4.,9.]),'max':shape([5.,4.,5.])}
        add('range_from/degenerate-component-fallback/'+ty,[operation],[],ty,values([.5,4.,.5]))
        operation=c.node('range_to','operation',type=ty)
        operation['inputValues']={'value':shape([.25,.5,.75]),'min':shape([2.,4.,6.]),'max':shape([6.,2.,10.])}
        add('range_to/'+ty,[operation],[],ty,values([3.,3.,9.]))
    return cases


def typed_expected(value,family):
    if family=='bool':return 'true' if value else 'false'
    if family in ('int','uint'):return str(math.trunc(value))+('u' if family=='uint' else '')
    text=format(float(value),'.17g')
    if '.' not in text and 'e' not in text.lower():text+='.0'
    return text+('LF' if family=='double' else '')


def load_harness(root):
    path=Path(root)/'tests/td/test_matrix_nodes.py'
    specification=importlib.util.spec_from_file_location('grape_matrix_gpu_harness',path)
    module=importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    module.build_cases=build_cases
    module.scalar_text=typed_expected
    return module


if 'op' in globals():
    harness=load_harness(GRAPE_ROOT)
    # TD exposes some operator classes through its builtins rather than the
    # job's globals dictionary. Resolve them normally before forwarding.
    harness.__dict__.update(op=op,app=app,baseCOMP=baseCOMP,textDAT=textDAT,
        glslTOP=glslTOP,glslMAT=glslMAT,geometryCOMP=geometryCOMP,rectangleSOP=rectangleSOP,
        cameraCOMP=cameraCOMP,renderTOP=renderTOP,infoDAT=infoDAT,
        source_path=source_path,GRAPE_TEST_OUTPUT=GRAPE_TEST_OUTPUT)
    result=harness.run_native()
    result['suite']='matrix-double-operations'
