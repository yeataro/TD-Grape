"""Finite native-call implementations for the final legacy TOP/MAT extension.

This is part of the existing Python emitter, not the next project's schema.
Concrete interfaces are projected through the existing type contract.
GLSL 4.60 sections 8.1-8.9, 8.13; TD 2025.32820 TOP/MAT native functions.
"""
import copy

FLOAT = ('float', 'vec2', 'vec3', 'vec4')
DOUBLE = ('double', 'dvec2', 'dvec3', 'dvec4')
INT = ('int', 'ivec2', 'ivec3', 'ivec4')
UINT = ('uint', 'uvec2', 'uvec3', 'uvec4')
BOOL = ('bool', 'bvec2', 'bvec3', 'bvec4')
CALLS = {}


def add(key, function, inputs, outputs='T', *, types=FLOAT, constant=True,
        stages=('vertex', 'pixel'), targets=('top', 'mat'), out_args=(),
        defaults=None, description='', category='math', section='8.3'):
    outputs = {'out': outputs} if isinstance(outputs, str) else outputs
    inputs = dict(inputs)
    variants = {}
    for ty in types:
        count = int(ty[-1]) if ty[-1:].isdigit() else 1
        family = 'double' if ty.startswith(('dvec', 'double')) else 'float'
        shape = lambda scalar, prefix: scalar if count == 1 else prefix + str(count)
        mapping = {'T': ty, 'S': family, 'B': shape('bool', 'bvec'),
                   'I': shape('int', 'ivec'), 'U': shape('uint', 'uvec')}
        variants[ty] = {direction: {p: mapping.get(t, t) for p, t in ports.items()}
                        for direction, ports in (('inputs', inputs), ('outputs', outputs))}
    CALLS[key] = dict(function=function, variants=variants, constant=constant,
        stages=list(stages), targets=list(targets), outArgs=list(out_args),
        inputDefaults=defaults or {}, description=description, category=category,
        section=section, parameter=len(types)>1)


def fixed(key, function, inputs, outputs, **kw):
    add(key, function, inputs, outputs, types=('float',), **kw)


# Ordinary value functions. Out-parameter calls are not constant expressions.
for fn in ('radians','degrees','tan','asin','acos','atan','sinh','cosh','tanh','asinh','acosh','atanh'):
    add(fn, fn, [('value','T')], section='8.1')
add('atan2', 'atan', [('y','T'),('x','T')], defaults={'x':1}, section='8.1')
for fn in ('exp','log','exp2','log2'):
    add(fn, fn, [('value','T')], defaults={'value':1} if fn.startswith('log') else {}, section='8.2')
add('inversesqrt','inversesqrt',[('value','T')],types=FLOAT+DOUBLE,defaults={'value':1},section='8.2')
add('round_even','roundEven',[('value','T')],types=FLOAT+DOUBLE)
add('step','step',[('edge','T'),('value','T')],types=FLOAT+DOUBLE)
for fn in ('isnan','isinf'):
    add(fn,fn,[('value','T')],'B',types=FLOAT+DOUBLE)
add('fma','fma',[('a','T'),('b','T'),('c','T')],types=FLOAT+DOUBLE)
add('modf','modf',[('value','T')],{'out':'T','whole':'T'},types=FLOAT+DOUBLE,constant=False,out_args=('whole',))
add('frexp','frexp',[('value','T')],{'out':'T','exponent':'I'},types=FLOAT+DOUBLE,constant=False,out_args=('exponent',))
add('ldexp','ldexp',[('value','T'),('exponent','I')],types=FLOAT+DOUBLE)
add('mix_boolean','mix',[('a','T'),('b','T'),('factor','B')],types=FLOAT+DOUBLE+INT+UINT+BOOL)
add('mix_components','mix',[('a','T'),('b','T'),('factor','T')],types=FLOAT[1:]+DOUBLE[1:])
add('step_scalar','step',[('edge','S'),('value','T')],types=FLOAT[1:]+DOUBLE[1:])
for key,operator,types,unary in [
    ('bit_and','&',INT+UINT,False),('bit_or','|',INT+UINT,False),('bit_xor','^',INT+UINT,False),
    ('bit_not','~',INT+UINT,True),('shift_left','<<',INT+UINT,False),('shift_right','>>',INT+UINT,False),
    ('remainder','%',INT+UINT,False),('boolean_and','&&',('bool',),False),
    ('boolean_or','||',('bool',),False),('boolean_xor','^^',('bool',),False),('boolean_not','!',('bool',),True)]:
    add(key,operator,[('value','T')] if unary else [('a','T'),('b','T')],types=types,defaults={'b':1} if key=='remainder' else {},section='5.9')
    CALLS[key]['operator']=operator
for fn, types, output in [('floatBitsToInt',FLOAT,'I'),('floatBitsToUint',FLOAT,'U'),('intBitsToFloat',INT,'T'),('uintBitsToFloat',UINT,'T')]:
    add(fn,fn,[('value','T')],output,types=types)
    if fn in ('intBitsToFloat','uintBitsToFloat'):
        for ty,v in CALLS[fn]['variants'].items():v['outputs']['out']=FLOAT[types.index(ty)]
for fn in ('packUnorm2x16','packSnorm2x16','packHalf2x16','packUnorm4x8','packSnorm4x8'):
    fixed(fn,fn,[('value','vec4' if '4x8' in fn else 'vec2')],'uint',section='8.4')
for fn in ('unpackUnorm2x16','unpackSnorm2x16','unpackHalf2x16','unpackUnorm4x8','unpackSnorm4x8'):
    fixed(fn,fn,[('value','uint')],'vec4' if '4x8' in fn else 'vec2',section='8.4')
fixed('packDouble2x32','packDouble2x32',[('value','uvec2')],'double',section='8.4')
fixed('unpackDouble2x32','unpackDouble2x32',[('value','double')],'uvec2',section='8.4')
add('distance','distance',[('a','T'),('b','T')],'S',types=FLOAT+DOUBLE,section='8.5')
add('cross','cross',[('a','T'),('b','T')],types=('vec3','dvec3'),section='8.5')
add('faceforward','faceforward',[('normal','T'),('incident','T'),('reference','T')],types=FLOAT+DOUBLE,section='8.5')
add('reflect','reflect',[('incident','T'),('normal','T')],types=FLOAT+DOUBLE,section='8.5')
add('refract','refract',[('incident','T'),('normal','T'),('eta','S')],types=FLOAT+DOUBLE,defaults={'eta':1},section='8.5')
for fn in ('lessThan','lessThanEqual','greaterThan','greaterThanEqual','equal','notEqual'):
    add(fn,fn,[('a','T'),('b','T')],'B',types=FLOAT[1:]+DOUBLE[1:]+INT[1:]+UINT[1:]+(BOOL[1:] if fn in ('equal','notEqual') else ()),section='8.7',category='logic')
for fn in ('any','all'):
    add(fn,fn,[('value','T')],'bool',types=BOOL[1:],section='8.7',category='logic')
add('not','not',[('value','T')],types=BOOL[1:],section='8.7',category='logic')
for fn in ('bitfieldReverse','bitCount','findLSB','findMSB'):
    add(fn,fn,[('value','T')],'T' if fn=='bitfieldReverse' else 'I',types=INT+UINT,section='8.8')
add('bitfieldExtract','bitfieldExtract',[('value','T'),('offset','int'),('bits','int')],types=INT+UINT,section='8.8')
add('bitfieldInsert','bitfieldInsert',[('base','T'),('insert','T'),('offset','int'),('bits','int')],types=INT+UINT,section='8.8')
for fn in ('uaddCarry','usubBorrow'):
    add(fn,fn,[('a','T'),('b','T')],{'out':'T','carry':'T'},types=UINT,out_args=('carry',),constant=False,section='8.8')
for fn,types in [('umulExtended',UINT),('imulExtended',INT)]:
    add(fn,fn,[('a','T'),('b','T')],{'high':'T','low':'T'},types=types,out_args=('high','low'),constant=False,section='8.8')
for fn in ('dFdx','dFdy','fwidth','dFdxFine','dFdyFine','fwidthFine','dFdxCoarse','dFdyCoarse','fwidthCoarse'):
    add(fn,fn,[('value','T')],constant=False,stages=('pixel',),section='8.13')
fixed('interpolateAtCentroid','interpolateAtCentroid',[('value','float')],'float',constant=False,stages=('pixel',),section='8.14')
# Interpolation arguments must be actual fragment inputs, not arbitrary values.
# The current value graph cannot express that contract; do not expose this call.
del CALLS['interpolateAtCentroid']


def td(key, function, inputs, outputs, **kw):
    fixed(key,function,inputs,outputs,constant=False,section='Common_Functions',**kw)


td('td_average','TDAverage',[('a','float'),('b','float')],'float')
td('td_rotate_to_vector','TDRotateToVector',[('forward','vec3'),('up','vec3')],'mat3',category='matrix')
td('td_rotate_on_axis','TDRotateOnAxis',[('radians','float'),('axis','vec3')],'mat3',category='matrix')
for axis in 'XYZ':td('td_rotate_'+axis.lower(),'TDRotate'+axis,[('radians','float')],'mat3',category='matrix')
for name,out in [('Scale','mat3'),('Translate','mat4')]:
    td('td_'+name.lower(),'TD'+name,[('x','float'),('y','float'),('z','float')],out,defaults={p:1 for p in 'xyz'} if name=='Scale' else {},category='matrix')
td('td_create_rot_matrix','TDCreateRotMatrix',[('from','vec3'),('to','vec3')],'mat3',category='matrix')
td('td_create_tbn_matrix','TDCreateTBNMatrix',[('normal','vec3'),('tangent','vec3'),('handedness','float')],'mat3',defaults={'handedness':1},category='matrix')
td('td_extract_rotation','TDExtractRotation',[('matrix','mat4')],'mat3',category='matrix')
td('td_slerp_rotation_matrices','TDSlerpRotationMatrices',[('a','mat3'),('b','mat3'),('factor','float')],'mat3',category='matrix')
td('td_interpolate_transform_matrices','TDInterpolateTransformMatrices',[('a','mat4'),('b','mat4'),('factor','float')],'mat4',category='matrix')
for key,fn,inputs,out in [
    ('axis_angle_to_quaternion','TDAxisAngleToQuaternion',[('axis','vec3'),('angle','float')],'vec4'),
    ('quaternion_to_matrix','TDQuaternionToRotMatrix',[('quaternion','vec4')],'mat3'),
    ('matrix_to_quaternion','TDRotMatrixToQuaternion',[('matrix','mat3')],'vec4'),
    ('rotate_quaternion','TDRotateFromQuaternion',[('value','vec3'),('quaternion','vec4')],'vec3'),
    ('multiply_quaternion','TDQuaternionMultiply',[('a','vec4'),('b','vec4')],'vec4'),
    ('slerp_quaternion','TDSlerpQuaternions',[('a','vec4'),('b','vec4'),('factor','float')],'vec4'),
    ('quaternion_from_to','TDQuaternionFromTo',[('from','vec3'),('to','vec3')],'vec4')]:
    td('td_'+key,fn,inputs,out,category='vector')
for key,fn in [('fade','TDFade'),('fade_deriv','TDFadeDeriv'),('sine_lookup','TDSineLookup')]:td('td_'+key,fn,[('value','float')],'float')
for key,fn in [('perlin_noise_deriv','TDPerlinNoiseDeriv'),('simplex_noise_deriv','TDSimplexNoiseDeriv')]:
    add('td_'+key,fn,[('position','T')],'vec4',types=FLOAT[1:],constant=False,section='Noise_Functions')
    td('td_'+key+'_noise',fn,[('position','vec4')],{'out':'vec4','noise':'float'},out_args=('noise',))
td('td_luminance','TDLuminance',[('color','vec3')],'float',category='color')
for pair in ('Rec709ToRec2020','Rec2020ToRec709'):
    td('td_gamut_'+pair.lower(),'TDGamut'+pair,[('color','vec3')],'vec3',category='color')
for curve in ('SRGB','Rec709','Gamma1_8','Gamma2_2','Gamma2_4','Gamma2_6','Gamma2_8','ACESproxy','ST2084PQ','BT2100HLG'):
    for direction in ('LinearTo'+curve,curve+'ToLinear'):
        params=[('color','T')]
        if curve=='BT2100HLG':params.append(('peakNits','float'))
        if curve in ('ST2084PQ','BT2100HLG'):params.append(('referenceWhiteNits','float'))
        add('td_transfer_'+direction.lower(),'TDTransfer'+direction,params,types=('vec3','vec4') if curve=='SRGB' else ('vec3',),constant=False,defaults={'peakNits':1000,'referenceWhiteNits':100},section='Color_Space_Functions',category='color')
td('td_triplanar_blend','TDTriplanarBlend',[('normal','vec3'),('xcolor','vec4'),('ycolor','vec4'),('zcolor','vec4'),('blendPower','int')],'vec4',defaults={'blendPower':1})
for key,fn,dim in [('bicubic','TDBicubicInterpolation',2),('tricubic','TDTricubicInterpolation',3)]:
    td('td_'+key,fn,[('sampler','sampler'+str(dim)+'D'),('uv','vec'+str(dim))],'vec4')
    td('td_'+key+'_size',fn,[('sampler','sampler'+str(dim)+'D'),('uv','vec'+str(dim)),('size','vec'+str(dim)),('inverseSize','vec'+str(dim))],'vec4',defaults={'size':1,'inverseSize':1})
td('td_texgen_sphere','TDTexGenSphere',[('direction','vec3')],'vec2')
td('td_equirectangular_to_cube','TDEquirectangularToCubeMap',[('uv','vec2')],'vec3')
td('td_cube_to_equirectangular','TDCubeMapToEquirectangular',[('direction','vec3')],{'out':'vec2','mipMapBias':'float'},out_args=('mipMapBias',))

# MAT-only calls retain explicit stage/target restrictions.
for key,fn,inp,out in [('deform_normal','TDDeformNorm','vec3','vec3'),('deform_vector','TDDeformVec','vec3','vec3'),('skinned_deform','TDSkinnedDeform','vec4','vec4'),('skinned_vector','TDSkinnedDeformVec','vec3','vec3'),('instance_deform','TDInstanceDeform','vec4','vec4'),('instance_vector','TDInstanceDeformVec','vec3','vec3')]:
    td('td_'+key,fn,[('value',inp)],out,targets=('mat',),stages=('vertex',))
for key,fn,port,out in [('deform_instance','TDDeform','position','vec4'),('deform_normal_instance','TDDeformNorm','normal','vec3'),('deform_vector_instance','TDDeformVec','vector','vec3'),('instance_texcoord','TDInstanceTexCoord','uv','vec3')]:
    td('td_'+key,fn,[('instance','int'),(port,'vec3')],out,targets=('mat',),stages=('vertex',))
td('td_quad_reproject','TDQuadReproject',[('position','vec4'),('camera','int')],'vec4',targets=('mat',),stages=('vertex',))
td('td_world_to_proj_uv','TDWorldToProj',[('position','vec4'),('uv','vec3')],'vec4',targets=('mat',),stages=('vertex',))
td('td_front_facing','TDFrontFacing',[('position','vec3'),('normal','vec3')],'bool',targets=('mat',),stages=('pixel',))
td('td_pixel_color','TDPixelColor',[('color','vec4')],'vec4',targets=('mat',),stages=('pixel',))
td('td_fog','TDFog',[('color','vec4'),('position','vec3'),('camera','int')],'vec4',targets=('mat',),stages=('pixel',))
for fn,inputs,out in [
    ('TDHardShadow',[('light','int'),('position','vec3')],'float'),
    ('TDSoftShadow',[('light','int'),('position','vec3'),('samples','int'),('searchSteps','int')],'float'),
    ('TDProjMap',[('light','int'),('position','vec3'),('defaultColor','vec4')],'vec4'),
    ('TDCompareShadowTexture',[('light','int'),('uv','vec2'),('depth','float')],'float'),
    ('TDCompareShadowTextureProj',[('light','int'),('uv','vec4')],'float'),
    ('TDShadowTexture',[('light','int'),('uv','vec2')],'float'),
    ('TDShadowTextureProj',[('light','int'),('uv','vec3')],'float'),
    ('TDProjTexture',[('light','int'),('uv','vec2'),('bias','float')],'vec4'),
    ('TDProjTextureProj',[('light','int'),('uv','vec3')],'vec4'),
    ('TDConeLookup',[('light','int'),('coord','float')],'float')]:
    td('td_'+fn[2:].lower(),fn,inputs,out,targets=('mat',),stages=('pixel',),defaults={'samples':25,'searchSteps':25})
add('td_env_light_texture','TDEnvLightTextureLod',[('light','int'),('uv','T'),('lod','float')],'vec4',types=('vec2','vec3'),constant=False,targets=('mat',),stages=('pixel',),section='Common_Lighting_Functions')
td('td_attenuate_light','TDAttenuateLight',[('light','int'),('distance','float')],'float',targets=('mat',),stages=('pixel',))
td('td_instance_color','TDInstanceColor',[('instance','int'),('color','vec4')],'vec4',targets=('mat',),stages=('vertex',))
add('td_instance_texture','TDInstanceTexture',[('index','uint'),('uv','T')],'vec4',types=('vec2','vec3'),constant=False,targets=('mat',),section='Instance_Texturing')

# Texture forms for the opaque sampler types already supported by this editor.
# Offsets are compile-time operands, recorded separately from ordinary inputs.
SAMPLERS={'sampler1D':('float','int'),'sampler2D':('vec2','ivec2'),
          'sampler3D':('vec3','ivec3'),'sampler2DArray':('vec3','ivec3'),
          'samplerCube':('vec3','ivec2'),'samplerBuffer':('int','int')}
for sampler,(uv,size) in SAMPLERS.items():
    suffix=sampler[7:].lower()
    inputs=[('sampler',sampler)]
    if sampler!='samplerBuffer':inputs.append(('lod','int'))
    fixed('texture_size_'+suffix,'textureSize',inputs,size,constant=False,section='8.9')
    if sampler=='samplerBuffer':continue
    fixed('texture_levels_'+suffix,'textureQueryLevels',[('sampler',sampler)],'int',constant=False,section='8.9')
    for label,fn,extra,stages in [('sample','texture',[],('vertex','pixel')),
                                ('lod','textureLod',[('lod','float')],('vertex','pixel')),
                                ('bias','texture',[('bias','float')],('pixel',))]:
        fixed('texture_'+label+'_'+suffix,fn,[('sampler',sampler),('uv',uv)]+extra,'vec4',constant=False,section='8.9',stages=stages)
    grad='vec2' if sampler=='sampler2DArray' else uv
    fixed('texture_grad_'+suffix,'textureGrad',[('sampler',sampler),('uv',uv),('dx',grad),('dy',grad)],'vec4',constant=False,section='8.9')
    if sampler!='samplerCube':
        fixed('texel_fetch_'+suffix,'texelFetch',[('sampler',sampler),('coord',size),('lod','int')],'vec4',constant=False,section='8.9')
    if sampler in ('sampler1D','sampler2D','sampler3D'):
        proj='vec2' if sampler=='sampler1D' else 'vec4'
        fixed('texture_proj_'+suffix,'textureProj',[('sampler',sampler),('uv',proj)],'vec4',constant=False,section='8.9')
    queryuv='vec2' if sampler=='sampler2DArray' else uv
    fixed('texture_query_lod_'+suffix,'textureQueryLod',[('sampler',sampler),('uv',queryuv)],'vec2',constant=False,stages=('pixel',),section='8.9')
    if sampler in ('sampler2D','sampler2DArray','samplerCube'):
        fixed('texture_gather_'+suffix,'textureGather',[('sampler',sampler),('uv',uv),('component','int')],'vec4',constant=False,section='8.9')
        CALLS['texture_gather_'+suffix]['constantInputs']=['component']
    if sampler!='samplerCube':
        offset='ivec2' if sampler=='sampler2DArray' else size
        for label,fn,extra in [('offset','textureOffset',[]),('lod_offset','textureLodOffset',[('lod','float')]),('grad_offset','textureGradOffset',[('dx',grad),('dy',grad)])]:
            key='texture_'+label+'_'+suffix
            fixed(key,fn,[('sampler',sampler),('uv',uv)]+extra+[('offset',offset)],'vec4',constant=False,section='8.9')
            CALLS[key]['constantInputs']=['offset']
        key='texel_fetch_offset_'+suffix
        fixed(key,'texelFetchOffset',[('sampler',sampler),('coord',size),('lod','int'),('offset',offset)],'vec4',constant=False,section='8.9')
        CALLS[key]['constantInputs']=['offset']
    if sampler in ('sampler1D','sampler2D','sampler3D'):
        for label,fn,extra in [('lod','textureProjLod',[('lod','float')]),('grad','textureProjGrad',[('dx',grad),('dy',grad)])]:
            fixed('texture_proj_'+label+'_'+suffix,fn,[('sampler',sampler),('uv',proj)]+extra,'vec4',constant=False,section='8.9')

# Lighting results are exposed as individual outputs, so no duplicate host
# struct declaration or new graph-owned type is required.
for key,fn,inputs,fields in [
    ('td_lighting','TDLighting',[('light','int'),('position','vec3'),('normal','vec3'),('shadowStrength','float'),('shadowColor','vec3'),('view','vec3'),('shininess','float'),('shininess2','float')],{'diffuse':'vec3','specular':'vec3','specular2':'vec3','shadowStrength':'float'}),
    ('td_lighting_pbr','TDLightingPBR',[('light','int'),('diffuseColor','vec3'),('specularColor','vec3'),('position','vec3'),('normal','vec3'),('shadowStrength','float'),('shadowColor','vec3'),('view','vec3'),('roughness','float')],{'diffuse':'vec3','specular':'vec3','shadowStrength':'float'})]:
    td(key,fn,inputs,fields,targets=('mat',),stages=('pixel',),defaults={'shadowStrength':1,'roughness':.5,'shininess':32,'shininess2':32})
    CALLS[key]['resultStruct']='TDPBRResult' if key.endswith('pbr') else 'TDPhongResult'


td('td_env_lighting_pbr','TDEnvLightingPBR',
   [('light','int'),('diffuseColor','vec3'),('specularColor','vec3'),('normal','vec3'),('view','vec3'),('roughness','float'),('ambientOcclusion','float')],
   {'diffuse':'vec3','specular':'vec3','shadowStrength':'float'},targets=('mat',),stages=('pixel',),defaults={'roughness':.5,'ambientOcclusion':1})
CALLS['td_env_lighting_pbr']['resultStruct']='TDPBRResult'

# Expose native light sums independently of material composition. In particular,
# no ambient term, alpha multiplication or material-color multiplication is added.
for source,key,label,bound in (
    ('td_lighting','td_lighting_all','Phong Lights','TD_NUM_LIGHTS'),
    ('td_lighting_pbr','td_lighting_pbr_all','PBR Lights','TD_NUM_LIGHTS'),
    ('td_env_lighting_pbr','td_env_lighting_pbr_all','PBR Environment Lights','TD_NUM_ENV_LIGHTS')):
    spec=copy.deepcopy(CALLS[source])
    for variant in spec['variants'].values():
        variant['inputs'].pop('light')
        variant['outputs'].pop('shadowStrength')
    spec['lightLoop']=bound;spec['label']=label
    CALLS[key]=spec

for model in ('phong','pbr'):
    inputs=[('baseColor','vec3'),('specularColor','vec3')]
    inputs+=([('metallic','float'),('roughness','float'),('ambientOcclusion','float')] if model=='pbr' else [('shininess','float'),('ambient','float')])
    inputs += [('emission','vec3'),('alpha','float'),('shadowStrength','float'),('shadowColor','vec3'),('position','vec3'),('normal','vec3'),('camera','int')]
    td('material_'+model,'Material '+model.upper(),inputs,{'out':'vec4','diffuse':'vec3','specular':'vec3'},targets=('mat',),stages=('pixel',),
       defaults={'baseColor':.8,'specularColor':.04 if model=='pbr' else 1,'roughness':.5,'ambientOcclusion':1,'shininess':32,'ambient':1,'alpha':1,'shadowStrength':1})
    CALLS['material_'+model]['lighting']=model
    CALLS['material_'+model]['implicitInputs']={'position':'sg_lighting_position','normal':'sg_lighting_normal','camera':'sg_lighting_camera'}


# The online TD documentation is newer than the archive's tested host build.
# Keep unavailable references explicit, but never advertise an uncallable node.
UNAVAILABLE = {key:CALLS.pop(key) for key in (
    'td_extract_rotation','td_slerp_rotation_matrices','td_interpolate_transform_matrices',
    'td_axis_angle_to_quaternion','td_quaternion_to_matrix','td_matrix_to_quaternion',
    'td_rotate_quaternion','td_multiply_quaternion','td_slerp_quaternion','td_quaternion_from_to')}
for key,spec in CALLS.items():
    if key.startswith(('td_transfer_','td_gamut_')):
        # Native signature probes: available in MAT pixel, absent in MAT vertex
        # and GLSL TOP on 2025.32820. Do not emulate a different host function.
        spec['targets']=['mat'];spec['stages']=['pixel']


td('td_instance_texcoord_current','TDInstanceTexCoord',[('uv','vec3')],'vec3',targets=('mat',),stages=('vertex',))
CALLS['td_instance_texcoord_current']['label']='TDInstanceTexCoord (Current)'

def interface(key, ty):
    return copy.deepcopy(CALLS[key]['variants'][ty])


def emit(key, ports, argument, symbols, lines, expressions, ident):
    """One native call. Output arguments get distinct writable SSA temporaries."""
    spec = CALLS[key]
    if spec.get('lighting'):
        return emit_lighting(spec['lighting'],argument,symbols,lines,expressions,ident)
    args = [argument(p) for p in ports['in']]
    if spec.get('lightLoop'):
        for port,ty in ports['out'].items():
            name=symbols[(ident,port)];expressions[(ident,port)]=name
            lines.append('    '+ty+' '+name+' = '+ty+'(0.0);')
        index='sg_light_index_'+ident;result='sg_light_result_'+ident
        lines.extend(['    for (int '+index+' = 0; '+index+' < '+spec['lightLoop']+'; ++'+index+') {',
                      '        '+spec['resultStruct']+' '+result+' = '+spec['function']+'('+', '.join([index]+args)+');'])
        for port in ports['out']:
            lines.append('        '+symbols[(ident,port)]+' += '+result+'.'+port+';')
        lines.append('    }')
        return None
    if spec.get('operator'):
        return '('+(spec['operator']+args[0] if len(args)==1 else (' '+spec['operator']+' ').join(args))+')'
    if spec.get('resultStruct'):
        name='sg_result_'+ident
        lines.append('    '+spec['resultStruct']+' '+name+' = '+spec['function']+'('+', '.join(args)+');')
        for port in ports['out']:expressions[(ident,port)]=name+'.'+port
        return None
    for port in spec['outArgs']:
        name = symbols[(ident, port)]
        lines.append('    ' + ports['out'][port] + ' ' + name + ';')
        args.append(name)
        expressions[(ident, port)] = name
    call = spec['function'] + '(' + ', '.join(args) + ')'
    if 'out' in ports['out']:
        return call
    lines.append('    ' + call + ';')
    return None


def emit_lighting(model,a,symbols,lines,expressions,ident):
    prefix='sg_light_'+ident
    normal=prefix+'_normal';view=prefix+'_view';diffuse=symbols[(ident,'diffuse')];specular=symbols[(ident,'specular')]
    lines.extend(['    vec3 '+normal+' = normalize('+a('normal')+');',
                  '    vec3 '+view+' = normalize(uTDMats['+a('camera')+'].camInverse[3].xyz - '+a('position')+');',
                  '    vec3 '+diffuse+' = vec3(0.0);','    vec3 '+specular+' = vec3(0.0);'])
    if model=='pbr':
        material_diffuse=prefix+'_base';material_specular=prefix+'_reflectance'
        lines.extend(['    vec3 '+material_diffuse+' = '+a('baseColor')+' * (1.0 - '+a('metallic')+');',
                      '    vec3 '+material_specular+' = mix('+a('specularColor')+', '+a('baseColor')+', '+a('metallic')+');'])
        direct='TDLightingPBR(i, '+', '.join([material_diffuse,material_specular,a('position'),normal,a('shadowStrength'),a('shadowColor'),view,a('roughness')])+')'
        lines.extend(['    for (int i = 0; i < TD_NUM_LIGHTS; ++i) {','        TDPBRResult light = '+direct+';',
                      '        '+diffuse+' += light.diffuse;','        '+specular+' += light.specular;','    }',
                      '    for (int i = 0; i < TD_NUM_ENV_LIGHTS; ++i) {',
                      '        TDPBRResult light = TDEnvLightingPBR(i, '+', '.join([material_diffuse,material_specular,normal,view,a('roughness'),a('ambientOcclusion')])+');',
                      '        '+diffuse+' += light.diffuse;','        '+specular+' += light.specular;','    }',
                      '    '+diffuse+' += uTDGeneral.ambientColor.rgb * '+material_diffuse+' * '+a('ambientOcclusion')+';'])
    else:
        direct='TDLighting(i, '+', '.join([a('position'),normal,a('shadowStrength'),a('shadowColor'),view,a('shininess'),a('shininess')])+')'
        lines.extend(['    for (int i = 0; i < TD_NUM_LIGHTS; ++i) {','        TDPhongResult light = '+direct+';',
                      '        '+diffuse+' += light.diffuse;','        '+specular+' += light.specular;','    }',
                      '    '+diffuse+' = ('+diffuse+' + uTDGeneral.ambientColor.rgb * '+a('ambient')+') * '+a('baseColor')+';',
                      '    '+specular+' *= '+a('specularColor')+';'])
    expressions[(ident,'diffuse')]=diffuse;expressions[(ident,'specular')]=specular
    return 'vec4('+diffuse+' + '+specular+' + '+a('emission')+', '+a('alpha')+')'
