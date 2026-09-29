"""Build the two integrated, textured MAT templates without replacing basic presets.

The JSON is the editable product asset. Run this explicitly to regenerate only
phong_textured/pbr_textured; never run it during source refresh or Apply.
"""
import copy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src/core'))
import sgrape_core as c


def build(model, base):
    g = {'schemaVersion': base['schemaVersion'], 'target': 'mat',
         'declarations': [copy.deepcopy(d) for d in base['declarations'] if d['id'] == 'tex'],
         'stages': {'vertex': copy.deepcopy(base['stages']['vertex']),
                    'pixel': {'nodes': [], 'edges': [], 'ui': {'frames': []}}}}
    v, p = g['stages']['vertex'], g['stages']['pixel']

    def add(stage, key, ident, x, y, values=None, label=None, **params):
        node = c.node(key, ident, x, y, **params)
        if values is not None:
            node['inputValues'] = values
        if label:
            node['ui']['label'] = label
        stage['nodes'].append(node)
        return ident

    def wire(stage, source, target, port, out='out', link=False):
        edge = c.edge(source, target, port, out)
        if link:
            edge['ui'] = {'style': 'link'}
        stage['edges'].append(edge)

    def n(key, ident, x, y, **kw):
        return add(p, key, ident, x, y, **kw)

    def w(source, target, port, out='out', link=False):
        wire(p, source, target, port, out, link)

    def group(stage, ident, name, nodes, color='#94a574'):
        stage.setdefault('ui', {}).setdefault('frames', []).append(
            dict(id='group_'+ident, name=name, nodes=nodes, color=color))

    def uniform(ident, ty, value, label, x, y):
        declaration = dict(id=ident, kind='uniform', name='u'+ident[0].upper()+ident[1:],
                           type=ty, value=value, expose=True, exposeName=label)
        if ty == 'vec3':
            declaration['nativeSequence'] = 'color'
        g['declarations'].append(declaration)
        return n('uniform', ident, x, y, declarationId=ident, label=label)

    def texture(ident, label, x, y, normal=False):
        decl = ident+'Map'
        g['declarations'].append(dict(id=decl, kind='sampler', name='s'+decl[0].upper()+decl[1:],
            type='sampler2D', source='builtin:normal' if normal else 'builtin:white',
            expose=True, exposeName=label+' Map'))
        n('sampler', decl, x, y, declarationId=decl, label=label+' Map')
        n('texture_sample', ident+'Sample', x+290, y)
        w(decl, ident+'Sample', 'sampler')
        w('uv', ident+'Sample', 'uv', link=True)
        return ident+'Sample'

    # TD native normal-map contract: geometry supplies the vec4 T attribute.
    # Do not synthesize missing tangents in the fragment shader.
    g['declarations'].append(dict(id='tangent', kind='attribute', name='T', type='vec4',
                                   value=None, nativeSequence='attr', arraySize=1))
    boundary = next(node for node in v['nodes'] if node['id'] == 'vertex')
    boundary['params']['outputs'].append(dict(id='tbn', name='tangentToWorld', type='mat3', interpolation='smooth'))
    boundary['ui'].update(x=1950, y=450)
    tangent_nodes = [
        ('attribute', 'tangent', 24, dict(declarationId='tangent', type='vec4')),
        ('swizzle', 'tangent_xyz', 314, dict(type='vec4', mask='xyz')),
        ('swizzle', 'handedness', 314, dict(type='vec4', mask='w')),
        ('td_deform_normal', 'tangent_deform', 604, {}),
        ('normalize', 'tangent_normalize', 894, dict(type='vec3')),
        ('td_create_tbn_matrix', 'tbn', 1184, {}),
    ]
    for key, ident, x, params in tangent_nodes:
        add(v, key, ident, x, 1550 if ident == 'handedness' else 1290, **params)
    for src, dst, port in [('tangent','tangent_xyz','value'),('tangent','handedness','value'),
                          ('tangent_xyz','tangent_deform','value'),('tangent_deform','tangent_normalize','value'),
                          ('vertex_normal','tbn','normal'),('tangent_normalize','tbn','tangent'),
                          ('handedness','tbn','handedness'),('tbn','vertex','tbn')]:
        wire(v, src, dst, port)
    group(v, 'tangent', 'Normal Map Tangent Basis', [item[1] for item in tangent_nodes], '#72a6a5')

    n('vertex_input', 'inputs', 0, -430)
    n('swizzle', 'uv', 300, -430, type='vec3', mask='xy')
    w('inputs', 'uv', 'value', 'uv')
    n('td_pixel_color', 'point_color', 620, -430)
    w('inputs', 'point_color', 'color', 'color')
    n('swizzle', 'point_rgb', 930, -430, type='vec4', mask='xyz')
    n('swizzle', 'point_alpha', 930, -210, type='vec4', mask='w')
    w('point_color', 'point_rgb', 'value'); w('point_color', 'point_alpha', 'value')
    group(p, 'inputs', 'Geometry, UV and Point Color', ['inputs','uv','point_color','point_rgb','point_alpha'], '#759bb5')

    specs = [('baseColor','Base Color' if model=='pbr' else 'Diffuse','vec3',[1,1,1] if model=='pbr' else [.7]*3,'baseColor')]
    if model == 'pbr':
        specs += [('specularLevel','Specular Level','float',.5,'specularColor'),
                  ('metallic','Metallic','float',0,'metallic'),('roughness','Roughness','float',.5,'roughness'),
                  ('ambientOcclusion','Ambient Occlusion','float',1,'ambientOcclusion')]
    else:
        specs += [('specularColor','Specular Color','vec3',[.3]*3,'specularColor'),
                  ('shininess','Shininess','float',100,'shininess'),('ambient','Ambient','float',1,'ambient')]
    specs += [('emission','Emission','vec3',[0,0,0],'emission'),('alpha','Alpha','float',1,'alpha'),
              ('shadowStrength','Shadow Strength','float',1,'shadowStrength'),
              ('shadowColor','Shadow Color','vec3',[0,0,0],'shadowColor')]
    outputs = {}
    for index, (ident, label, ty, value, port) in enumerate(specs):
        x, y = (index % 2)*1580, (index//2)*480+140
        start = len(p['nodes'])
        sample = texture(ident, label, x, y)
        n('swizzle', ident+'Channel', x+580, y, type='vec4', mask='xyz' if ty=='vec3' else 'x')
        w(sample, ident+'Channel', 'value')
        uniform(ident, ty, value, label, x+580, y+220)
        n('multiply', ident+'Mapped', x+870, y, type=ty)
        w(ident+'Channel', ident+'Mapped', 'a'); w(ident, ident+'Mapped', 'b')
        output = ident+'Mapped'
        if ident == 'specularLevel':
            n('multiply', 'reflectance', x+1160, y, type='float', values={'b':.08}, label='Specular Level × 0.08')
            w(output, 'reflectance', 'a')
            n('convert', 'reflectanceRGB', x+1160, y+220, fromType='float', toType='vec3')
            w('reflectance', 'reflectanceRGB', 'value'); output='reflectanceRGB'
        elif ident == 'roughness':
            n('max', 'safeRoughness', x+1160, y, type='float', values={'b':.0001}, label='Roughness ≥ 0.0001')
            w(output, 'safeRoughness', 'a'); output='safeRoughness'
        outputs[port] = output
        group(p, ident, label+' Texture', [node['id'] for node in p['nodes'][start:]], '#ad83a2' if ty=='vec3' else '#b6a270')

    # Tangent-space normal RGB: [0,1] -> [-1,1], XY strength, TBN -> world.
    start = len(p['nodes']); x, y = 0, 2720
    sample = texture('normal', 'Normal', x, y, normal=True)
    n('swizzle','normalRGB',580,y,type='vec4',mask='xyz');w(sample,'normalRGB','value')
    n('subtract','normalCentered',870,y,type='vec3',values={'b':[.5]*3});w('normalRGB','normalCentered','a')
    n('multiply','normalDecoded',1160,y,type='vec3',values={'b':[2]*3});w('normalCentered','normalDecoded','a')
    uniform('normalStrength','float',1,'Normal Strength',580,y+240)
    n('combine','normalScale',870,y+240,type='vec3',values={'z':1})
    w('normalStrength','normalScale','x');w('normalStrength','normalScale','y')
    n('multiply','normalScaled',1450,y,type='vec3');w('normalDecoded','normalScaled','a');w('normalScale','normalScaled','b')
    n('multiply','normalWorld',1740,y,type='vec3',operandTypes={'a':'mat3','b':'vec3'})
    w('inputs','normalWorld','a','tbn',link=True);w('normalScaled','normalWorld','b')
    n('normalize','normalUnit',2030,y,type='vec3');w('normalWorld','normalUnit','value')
    n('td_front_facing','frontFacing',2030,y+230)
    w('inputs','frontFacing','position','world',link=True);w('inputs','frontFacing','normal','normal',link=True)
    n('multiply','normalBack',2320,y+230,type='vec3',values={'b':[-1]*3});w('normalUnit','normalBack','a')
    n('if','surfaceNormal',2610,y,type='vec3')
    w('frontFacing','surfaceNormal','condition');w('normalUnit','surfaceNormal','true');w('normalBack','surfaceNormal','false')
    group(p,'normal','Tangent-space Normal Map',[node['id'] for node in p['nodes'][start:]],'#72a6a5')

    # Match the native placement of point color / alpha without repeating the
    # metallic split performed inside Material PBR.
    start=len(p['nodes'])
    n('multiply','finalAlpha',3270,100,type='float');w(outputs['alpha'],'finalAlpha','a',link=True);w('point_alpha','finalAlpha','b',link=True)
    outputs['alpha']='finalAlpha'
    n('convert','alphaRGB',3270,-180,fromType='float',toType='vec3');w('alphaMapped','alphaRGB','value',link=True)
    if model=='pbr':
        n('multiply','basePointColor',3270,350,type='vec3');w(outputs['baseColor'],'basePointColor','a',link=True);w('point_rgb','basePointColor','b',link=True)
        n('multiply','basePremultiplied',3580,350,type='vec3')
        w('basePointColor','basePremultiplied','a');w('alphaRGB','basePremultiplied','b',link=True)
        outputs['baseColor']='basePremultiplied'
    group(p,'color','Opacity and Point Color',[node['id'] for node in p['nodes'][start:]],'#ad83a2')
    n('material_'+model,'material',3930,450)
    for port, output in outputs.items():
        w(output,'material',port,link=True)
    w('surfaceNormal','material','normal',link=True)
    w('inputs','material','position','world',link=True);w('inputs','material','camera','camera',link=True)
    color='material'
    if model=='phong':
        n('swizzle','litRGB',4270,450,type='vec4',mask='xyz');w(color,'litRGB','value')
        n('multiply','litPremultiplied',4570,450,type='vec3')
        w('litRGB','litPremultiplied','a');w('alphaRGB','litPremultiplied','b',link=True)
        n('multiply','litPointColor',4880,450,type='vec3');w('litPremultiplied','litPointColor','a');w('point_rgb','litPointColor','b',link=True)
        n('combine','litRGBA',5190,450,type='vec4',groups={'x':'vec3'})
        w('litPointColor','litRGBA','x');w('finalAlpha','litRGBA','w',link=True);color='litRGBA'
    n('td_fog','fog',5500,450);w(color,'fog','color');w('inputs','fog','position','world',link=True);w('inputs','fog','camera','camera',link=True)
    n('pixel_out','pixel',5810,450,dither=True,alphaTest=True,convertColorSpace=True);w('fog','pixel','color')
    group(p,'output','Material and Output',[node['id'] for node in p['nodes'] if node['ui']['x']>=3930],'#75a28a')
    c.compile_graph(g)
    return g


def main():
    path=ROOT/'src/library/material_presets.json'
    presets=json.loads(path.read_text(encoding='utf-8'))
    for model in ('phong','pbr'):
        presets[model+'_textured']=build(model,presets[model])
    path.write_text(json.dumps(presets,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
