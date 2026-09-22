"""Export native MAT feature branches; store raw host shaders only in private work.

This is a discovery audit, not a claim of Grape/native rendering parity.
No user materials or scenes are modified. Common/Deform are not enumerated.
"""
from pathlib import Path
import hashlib
import json
import re
import uuid

destination = Path(GRAPE_TEST_OUTPUT)
selection_file = Path(GRAPE_WORK) / 'native-material-audit-selection.json'
selection = json.loads(selection_file.read_text(encoding='utf-8')) if selection_file.exists() else {'start': 0, 'count': 12}
assert 1 <= selection.get('count', 12) <= 12, 'Export in short batches of at most twelve cases'
case_index = 0
area = op('/').create(baseCOMP, 'grape_native_audit_' + uuid.uuid4().hex[:8])
manifest = {'build': str(app.build), 'cases': [], 'parameters': {},
            'scope': 'Phong/PBR outside Common and Deform; finite feature branches, not every combination'}


def inventory(text):
    # Keep preprocessor branches: the exported source is itself host-specialized.
    clean = re.sub(r'/\*.*?\*/|//[^\n]*', '', text, flags=re.S)
    identifiers = sorted(set(re.findall(r'\b([A-Za-z_]\w*)\s*\(', clean)))
    definitions = set(re.findall(r'\b\w+\s+(\w+)\s*\([^;{}]*\)\s*\{', clean))
    calls = [name for name in identifiers if name not in definitions and name not in
             {'if', 'for', 'while', 'switch', 'layout', 'return', 'defined'}]
    return {'calls': calls, 'localFunctions': sorted(definitions),
            'includes': sorted(set(re.findall(r'#include\s+[<"]([^>"]+)', clean))),
            'hostSymbols': sorted(set(re.findall(r'\b(?:uTD\w+|sTD\w+|TD_[A-Z_0-9]+)\b', clean))),
            'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest()}


try:
    geometry = area.create(geometryCOMP, 'geometry')
    surface = geometry.create(gridSOP, 'surface')
    surface.render = True
    surface.display = True
    camera = area.create(cameraCOMP, 'camera')
    camera.par.tz = 3
    light = area.create(lightCOMP, 'light')
    light.par.tz = 3
    image = area.create(constantTOP, 'map')
    image.par.colorr = .4
    image.par.colorg = .6
    image.par.colorb = .8
    image.par.alpha = .7
    environment = area.create(environmentlightCOMP, 'environment')
    environment.par.envlightmap = image
    render = area.create(renderTOP, 'render')
    render.par.geometry = geometry
    render.par.camera = camera
    render.par.lights = light.path + ' ' + environment.path
    render.par.resolutionw = 32
    render.par.resolutionh = 32
    for model, operator in [('phong', phongMAT), ('pbr', pbrMAT)]:
        native = area.create(operator, model)
        parameters = {p.name: p for p in native.pars() if p.page and p.page.name not in ('', 'Common', 'Deform')}
        manifest['parameters'][model] = [dict(name=p.name, label=p.label, page=p.page.name,
            style=p.style, default=str(p.eval()), menu=list(p.menuNames or [])) for p in parameters.values()]
        # Nonzero contributions ensure host code generation does not omit a map.
        enabled = dict(emitr=.2, emitg=.3, emitb=.1, constantr=.1, constantg=.2,
                       constantb=.3, darknessemit=True, rimlight0enable=True,
                       heightmapenable=True, alphafront=.8, alphaside=.2, rolloff=2)
        if model == 'phong':
            enabled.update(spec2r=.2, spec2g=.3, spec2b=.4, ambdiff=False,
                           alphamultlight=True, multitexturing=True,
                           multitexexpr='t0 * t1 + t2 * t3')
        else:
            enabled.update(metallic=.4, roughness=.35, ambientocclusion=.6)
        for name, parameter in parameters.items():
            if parameter.style == 'TOP' and name != 'substance':
                enabled[name] = image.path
        cases = [('baseline', {}), ('enabled', enabled)]
        # All map slots are exercised independently by name, not guessed aliases.
        for name, parameter in parameters.items():
            if parameter.style == 'Toggle':
                for value in (False, True):
                    cases.append((name + '_' + str(int(value)), {**enabled, name: value}))
        # Shared modes: apply every menu value to all corresponding map slots.
        groups = {}
        for name, parameter in parameters.items():
            if parameter.style == 'Menu' and name != 'instancetexture':
                values = tuple(parameter.menuNames)
                if values:
                    groups.setdefault(values, []).append(name)
        for values, names in groups.items():
            for value in values:
                cases.append((names[0] + '_' + value, {**enabled, **dict.fromkeys(names, value)}))
        # Instance texture selection needs an actual instanced geometry fixture;
        # do not pretend setting a disabled menu proves that shader path exists.
        manifest.setdefault('notExercised', {})[model] = [
            'instancetexture with instance textures', 'sampler3D/samplerCube map resources',
            'additional Rim and color-buffer sequence blocks', 'Substance authoring shortcut',
            'POP geometry (covered separately by Texture Attribute tests)',
            'scene-dependent shadow/fog configurations and every cross-feature combination']
        native.destroy()
        for label, settings in cases:
            index = case_index
            case_index += 1
            if not selection.get('start', 0) <= index < selection.get('start', 0) + selection.get('count', 12):
                continue
            native = area.create(operator, model + '_case')
            exported = None
            row = dict(index=index, model=model, case=label, settings={k: '@map' if v == image.path else v
                                                        for k, v in settings.items()})
            try:
                for name, value in settings.items():
                    parameter = getattr(native.par, name, None)
                    if parameter is None:
                        raise AssertionError('Missing native parameter: ' + name)
                    if parameter.style == 'Menu' and value not in parameter.menuNames:
                        raise AssertionError('Invalid native menu value: ' + name + '=' + str(value))
                    parameter.val = value
                geometry.par.material = native
                render.cook(force=True)
                row['nativeErrors'] = render.errors()
                row['nativeMaterialErrors'] = native.errors()
                exported = native.outputShader('exported')
                row['stages'] = {}
                for stage, parameter in [('vertex', exported.par.vdat), ('pixel', exported.par.pdat)]:
                    source = parameter.eval().text
                    filename = model + '-' + label + '-' + stage + '.glsl'
                    (destination / filename).write_text(source, encoding='utf-8')
                    row['stages'][stage] = {'file': filename, **inventory(source)}
                geometry.par.material = exported
                render.cook(force=True)
                row['exportErrors'] = render.errors()
                row['exportWarnings'] = exported.warnings()
                row['exportMaterialErrors'] = exported.errors()
                info = area.create(infoDAT, 'compiler_info')
                info.par.op = exported
                info.cook(force=True)
                row['compileInfo'] = info.text
                info.destroy()
            except Exception as error:
                row['failure'] = repr(error)
            finally:
                geometry.par.material = ''
                if exported is not None:
                    # outputShader also creates sibling DATs; area cleanup owns those.
                    exported.destroy()
                native.destroy()
            manifest['cases'].append(row)
            (destination / 'inventory.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
finally:
    area.destroy()

assert manifest['cases'], 'No native material variants were audited'
assert not [r for r in manifest['cases'] if r.get('failure')], 'Some variants failed; inspect inventory.json'
assert all(not r.get('nativeMaterialErrors') and not r.get('exportMaterialErrors') and
           'Linked Successfully' in r.get('compileInfo', '') for r in manifest['cases']), 'Material compile failure; inspect inventory.json'
