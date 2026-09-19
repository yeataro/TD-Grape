"""Static source definitions shared by code generation, native setup and UI.

Loading metadata never queries or initializes a host resource. Native values
are owned by TD and are deliberately absent from this catalog.
"""
import copy
import json
from pathlib import Path


def validate(data):
    if not isinstance(data, dict) or data.get('version') != 1:
        raise ValueError('Unsupported source catalog')
    for name in ('uniformPresets', 'structures', 'builtins', 'lengthMacros'):
        if not isinstance(data.get(name), dict):
            raise ValueError('Invalid source catalog section: ' + name)
    for key, entry in data['uniformPresets'].items():
        init = entry.get('initialize', {})
        if (not isinstance(key, str) or not key or entry.get('type') != 'float'
                or init.get('mode') != 'EXPRESSION' or init.get('component') != 0
                or not isinstance(init.get('expression'), str) or not init['expression']
                or not isinstance(entry.get('name'), str) or not entry['name']
                or not isinstance(entry.get('labelKey'), str)
                or not isinstance(entry.get('path'), list)):
            raise ValueError('Invalid Uniform preset: ' + str(key))
        availability = entry.get('availability', {})
        if not availability or any(target not in ('top', 'mat') or not isinstance(stages, list)
                or not stages or any(stage not in ('vertex', 'pixel') for stage in stages)
                or target == 'top' and stages != ['pixel']
                for target, stages in availability.items()):
            raise ValueError('Invalid Uniform preset availability: ' + key)
    return data


if 'me' in globals():
    CATALOG = validate(json.loads(me.parent().op('source_catalog').text))
else:
    CATALOG = validate(json.loads((Path(__file__).resolve().parents[1] / 'library/source_catalog.json').read_text(encoding='utf-8')))

PRESETS = CATALOG['uniformPresets']


def contract():
    """UI projection; no second mutable catalog and no native value snapshot."""
    return {'version': 1, 'uniformPresets': copy.deepcopy(PRESETS)}
