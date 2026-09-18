"""Read-only GLSL constructor capability probe in disposable TOP/MAT fixtures.

Expected legality is derived from GLSL 4.50 sections 5.4.1 and 5.4.2:
https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.50.pdf
This reports compiler acceptance AND GPU component values, never edits the
product's conversion table. Rejected constructors are expected test cases.
"""
import json
import math
import re
import uuid
from pathlib import Path


def shape(ty):
    matrix = re.fullmatch(r'd?mat([234])(?:x([234]))?',ty)
    if matrix:
        columns=int(matrix[1]); rows=int(matrix[2] or matrix[1])
        return ('double' if ty.startswith('d') else 'float',columns,rows)
    vector=re.fullmatch(r'([diub]?)vec([234])',ty)
    if vector:return ({'':'float','d':'double','i':'int','u':'uint','b':'bool'}[vector[1]],int(vector[2]),0)
    return (ty,1,0)


def number(value,family):
    if family=='bool':return 'true' if value else 'false'
    if family=='int':return str(int(value))
    if family=='uint':return str(int(value))+'u'
    return repr(float(value))+('lf' if family=='double' else '')


def literal(ty,values):
    family,columns,rows=shape(ty)
    if columns==1 and not rows:return number(values[0],family)
    return ty+'('+', '.join(number(v,family) for v in values)+')'


def converted(value,family):
    return bool(value) if family=='bool' else int(value) if family in ('int','uint') else float(value)


cases=[]
def case(source,target,values,category):
    sf,sc,sr=shape(source);tf,tc,tr=shape(target)
    if tr:
        if sr:
            expected=[converted(values[c*sr+r],tf) if c<sc and r<sr else float(c==r)
                      for c in range(tc) for r in range(tr)]
        elif sc==1:expected=[converted(values[0],tf) if c==r else 0.0 for c in range(tc) for r in range(tr)]
        elif sc>=tc*tr:expected=[converted(v,tf) for v in values[:tc*tr]]
        else:expected=None
    elif tc==1:expected=[converted(values[0],tf)]
    elif sc==1 and not sr:expected=[converted(values[0],tf)]*tc
    elif len(values)>=tc:expected=[converted(v,tf) for v in values[:tc]]
    else:expected=None
    cases.append({'sourceType':source,'targetType':target,'sourceValues':values,'category':category,
                  'expectedCompile':expected is not None,'expected':expected})


# Matrix extraction consumes column-major components, including scalar casts.
for target in ('float','double','int','uint','bool'):
    case('mat2x3',target,[1.75,2.25,3.25,4.25,5.25,6.25],'matrix to scalar')
case('dmat3x2','float',[2.5,3.5,4.5,5.5,6.5,7.5],'double matrix to scalar')
case('mat2','bool',[0.0,2.0,3.0,4.0],'matrix zero to bool')
for source,values in [('mat2',[1.25,0.0,3.5,4.75]),('mat2x3',[1.25,2.25,3.25,4.25,5.25,6.25]),
                      ('dmat3',[1.25,2.25,3.25,4.25,5.25,6.25,7.25,8.25,9.25])]:
    for target in ('vec2','vec3','vec4'):case(source,target,values,'matrix to vector')
for target in ('dvec4','ivec4','uvec4','bvec4'):
    case('mat2',target,[1.25,0.0,3.5,4.75],'matrix to vector family cast')

# A single vector supplies components; it does not become a diagonal or splat.
for count in (2,3,4):
    for target in ('mat2','mat2x3','mat3'):
        case('vec'+str(count),target,[float(i+1) for i in range(count)],'single vector to matrix')
for source,target,values in [('dvec4','mat2',[1.,2.,3.,4.]),('vec4','dmat2',[1.,2.,3.,4.]),
                              ('ivec4','mat2',[1,2,3,4]),('bvec4','dmat2',[True,False,False,True])]:
    case(source,target,values,'vector to matrix family cast')

for source,value in [('int',-3),('uint',7),('bool',True),('double',2.5)]:
    for target in ('mat2','mat2x3','dmat3'):case(source,target,[value],'scalar diagonal')
case('bool','dmat4',[False],'false scalar diagonal')
case('float','mat2',[2.5],'float scalar diagonal')

# Cover every source shape and both shrinking/expanding dimensions. New cells
# use identity positions, not flat padding, even for nonsquare matrices.
dimensions=[(c,r) for c in (2,3,4) for r in (2,3,4)]
def matrix_type(prefix,c,r):return prefix+str(c)+(('x'+str(r)) if c!=r else '')
for index,(columns,rows) in enumerate(dimensions):
    tc,tr=dimensions[(index+4)%len(dimensions)]
    source=matrix_type('mat',columns,rows);target=matrix_type('dmat',tc,tr)
    case(source,target,[float(10*c+r+1)+.25 for c in range(columns) for r in range(rows)],'matrix resize float to double')
for source,target in [('dmat2','mat4'),('dmat4','mat2'),('dmat2x4','mat4x2'),('mat4x2','mat2x4'),('dmat3x2','dmat2x3')]:
    _,columns,rows=shape(source)
    case(source,target,[float(10*c+r+1)+.25 for c in range(columns) for r in range(rows)],'matrix resize and family')

owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1
runtime=owners[0].op('runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in runtime._shaders.values() if s and s.valid}
before=saved();registry={k:s.path for k,s in runtime._shaders.items() if s and s.valid};selected=runtime._shader
name='grape_matrix_constructors_'+uuid.uuid4().hex[:8]
area=op('/').create(baseCOMP,name)
report={'build':str(app.build),'glslVersion':450,'specification':'GLSL 4.50 sections 5.4.1/5.4.2','records':[]}
try:
    top=area.create(glslTOP,'top_probe');top_pixel=area.create(textDAT,'top_pixel');top.par.pixeldat=top_pixel
    top.par.outputresolution='custom';top.par.resolutionw=128;top.par.resolutionh=16;top.par.format='rgba32float'
    mat=area.create(glslMAT,'mat_probe');mat_pixel=mat.par.pdat.eval();mat_vertex=mat.par.vdat.eval()
    geo=area.create(geometryCOMP,'geometry');rectangle=geo.create(rectangleSOP,'rectangle')
    for child in geo.children:
        if child.family in ('SOP','POP'):child.render=child==rectangle;child.display=child==rectangle
    geo.par.material=mat;geo.par.sx=2;geo.par.sy=2
    camera=area.create(cameraCOMP,'camera');camera.par.tz=2;camera.par.projection='ortho';camera.par.orthowidth=1.12
    renderer=area.create(renderTOP,'render');renderer.par.camera=camera;renderer.par.geometry=geo
    renderer.par.format='rgba32float';renderer.par.antialias='aaoff';renderer.par.resolutionw=128;renderer.par.resolutionh=16
    infos={}
    for native in (top,mat):
        native.par.glslversion='glsl450';native.par.compilebehavior='stalluntildone'
        info=area.create(infoDAT,native.name+'_info');info.par.op=native;infos[native.path]=info
    position='gl_Position=TDWorldToProj(TDDeform(TDPos()));'
    for definition in cases:
        for native,stage in ((top,'pixel'),(mat,'pixel'),(mat,'vertex')):
            item=dict(definition,target='TOP' if native==top else 'MAT',stage=stage)
            ty=definition['targetType'];family,columns,rows=shape(ty)
            refs=['converted['+str(c)+']['+str(r)+']' for c in range(columns) for r in range(rows)] if rows else ['converted['+str(i)+']' for i in range(columns)] if columns>1 else ['converted']
            count=len(refs)
            setup=definition['sourceType']+' sourceValue='+literal(definition['sourceType'],definition['sourceValues'])+';\n'+ty+' converted='+ty+'(sourceValue);\n'
            expected=definition['expected'] or [0.0]*count
            outputs=['vec4(float('+ref+'), ('+ref+' == '+number(expected[i],family)+')?1.0:0.0,0.5,1.0)' for i,ref in enumerate(refs)]
            index='min('+str(count-1)+',int(gl_FragCoord.x*'+str(float(count))+'/128.0))'
            try:
                if stage=='vertex':
                    mat_vertex.text='flat out vec4 probeResults['+str(count)+'];\nvoid main(){\n'+setup+'\n'.join('probeResults['+str(i)+']='+value+';' for i,value in enumerate(outputs))+'\n'+position+'\n}'
                    mat_pixel.text='flat in vec4 probeResults['+str(count)+'];\nlayout(location=0) out vec4 fragColor;\nvoid main(){fragColor=probeResults['+index+'];}'
                else:
                    if native==mat:mat_vertex.text='void main(){'+position+'}'
                    pixel=top_pixel if native==top else mat_pixel
                    pixel.text='layout(location=0) out vec4 fragColor;\nvoid main(){\n'+setup+'int i='+index+';\n'+'\n'.join(('if' if i==0 else 'else if')+'(i=='+str(i)+')fragColor='+value+';' for i,value in enumerate(outputs))+'\n}'
                native.cook(force=True)
                target=top if native==top else renderer;target.cook(force=True)
                item['nativeErrors']=str(native.errors() or '');item['renderErrors']=str(target.errors() or '')
                item['compileInfo']=infos[native.path].text
                item['compiled']=not item['nativeErrors'] and not item['renderErrors'] and 'ERROR:' not in item['compileInfo']
                if item['compiled']:
                    pixels=target.numpyArray(delayed=False)
                    if pixels is not None:
                        colors=[pixels[pixels.shape[0]//2,int((i+.5)*pixels.shape[1]/count)].tolist() for i in range(count)]
                        item['actual']=[color[0] for color in colors]
                        item['gpuComponentMatches']=[color[1]==1.0 for color in colors]
                        item['covered']=all(color[2:]==[.5,1.] for color in colors)
                    item['valueMatches']=bool(definition['expected'] is not None and item.get('covered') and all(item.get('gpuComponentMatches',[])))
                item['specConformant']=item['compiled']==definition['expectedCompile'] and (not item['compiled'] or item.get('valueMatches',False))
            except Exception as exc:item.update(error=repr(exc),specConformant=False)
            report['records'].append(item)
finally:
    area.destroy()
    report['existingShadersPreserved']=saved()==before
    report['registryPreserved']=registry=={k:s.path for k,s in runtime._shaders.items() if s and s.valid} and runtime._shader==selected
    report['fixtureRemoved']=op('/'+name) is None
    Path(GRAPE_TEST_OUTPUT,'matrix-constructors-result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    assert report['existingShadersPreserved'] and report['registryPreserved'] and report['fixtureRemoved']
result={'build':report['build'],'cases':len(cases),'records':len(report['records']),
        'specConformant':sum(r['specConformant'] for r in report['records']),
        'accepted':sum(bool(r.get('compiled')) for r in report['records']),
        'unexpected':[r for r in report['records'] if not r['specConformant']],
        'summary':[{k:r.get(k) for k in ('sourceType','targetType','target','stage','compiled','valueMatches','specConformant')} for r in report['records']],
        'existingShadersPreserved':report['existingShadersPreserved'],'registryPreserved':report['registryPreserved'],'fixtureRemoved':report['fixtureRemoved']}
