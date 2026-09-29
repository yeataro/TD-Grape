"""Value-only access to the active viewer's custom parameters, on TD's thread."""
import math

NUMERIC = {'Float', 'Int', 'RGBA', 'RGB', 'XYZW', 'XYZ', 'XY', 'UV', 'UVW'}
OP_STYLES = {'OP', 'TOP', 'MAT', 'POP', 'SOP', 'CHOP', 'DAT', 'COMP'}
SUPPORTED = NUMERIC | OP_STYLES | {'Toggle', 'Menu', 'Str', 'Pulse'}


def component(par):
    value = par.eval()
    if par.style in OP_STYLES:
        value = value.path if value else ''
    mode = str(par.mode).split('.')[-1]
    return {'name': par.name, 'value': value, 'mode': mode,
            'writable': bool(par.enable and not par.readOnly and mode == 'CONSTANT'
                             and par.style in SUPPORTED),
            'min': par.min if par.clampMin else None,
            'max': par.max if par.clampMax else None}


def snapshot(viewer, revision):
    rows = []
    for tuplet in viewer.customTuplets:
        first = tuplet[0]
        if first.style not in SUPPORTED:
            continue
        rows.append({'name': first.name, 'label': first.label, 'style': first.style,
                     'page': first.page.name, 'section': bool(first.startSection),
                     'menuNames': list(first.menuNames or []),
                     'menuLabels': list(first.menuLabels or []),
                     'components': [component(par) for par in tuplet]})
    return {'viewer': viewer.path, 'viewerId': viewer.id, 'revision': revision,
            'label': 'MAT Viewer' if viewer.name == 'mat_viewer' else 'TOP Viewer',
            'controls': rows}


def write(viewer, revision, message):
    current = snapshot(viewer, revision)
    if message.get('viewerId') != viewer.id or message.get('revision') != revision:
        raise ValueError('The preview source changed. Select the preview again.')
    row = next((r for r in current['controls'] if r['name'] == message.get('name')), None)
    index = message.get('component')
    if row is None or type(index) is not int or not 0 <= index < len(row['components']):
        raise ValueError('This viewer parameter no longer exists.')
    seen = row['components'][index]
    if not seen['writable']:
        raise ValueError('This parameter is controlled by TouchDesigner.')
    if message.get('expected') != seen:
        raise ValueError('The value changed in TouchDesigner. Review it and try again.')
    value = message.get('value')
    style = row['style']
    if style in NUMERIC:
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError('Enter a finite number.')
        if style == 'Int' and int(value) != value:
            raise ValueError('Enter an integer.')
        if seen['min'] is not None and value < seen['min'] or seen['max'] is not None and value > seen['max']:
            raise ValueError('The value is outside this parameter’s range.')
    elif style in ('Toggle', 'Pulse'):
        if type(value) is not bool:
            raise ValueError('Expected a toggle value.')
    else:
        if not isinstance(value, str) or len(value) > 2048:
            raise ValueError('Invalid parameter value.')
        if style == 'Menu' and value not in row['menuNames']:
            raise ValueError('This menu choice no longer exists.')
        if style in OP_STYLES and value:
            target = viewer.op(value)
            if not target or style != 'OP' and target.family != style:
                raise ValueError('Choose a valid ' + style + ' path.')
            value = target.path
    # Names come from customTuplets, never from an arbitrary client-supplied path.
    parameter = getattr(viewer.par, seen['name'])
    if style == 'Pulse':
        if value:
            parameter.pulse()
    else:
        parameter.val = value
    return snapshot(viewer, revision)
