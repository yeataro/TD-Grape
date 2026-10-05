"""TD value commits and identity-safe Undo; no graph compiler or Manager calls.

Moved unchanged from the Legacy runtime parameter writer.
"""
from contextlib import contextmanager


@contextmanager
def history_native_writes():
    capture = bool(ui.undo.globalState)
    if capture:
        ui.undo.startBlock('Grape editor Undo/Redo', enable=False)
    try:
        yield
    finally:
        if capture:
            ui.undo.endBlock()


def _set_parameter_without_native_capture(parameter, value):
    if not ui.undo.globalState:
        parameter.val = value
        return
    # TD's native parameter records resolve paths again and can hit replacement OPs.
    ui.undo.startBlock('Grape: ' + parameter.owner.name + ' / ' + parameter.label, enable=False)
    try:
        parameter.val = value
    finally:
        ui.undo.endBlock()


def _parameter_undo(is_undo, entry):
    """Restore only our still-current constant value on the original parameter."""
    if entry['blocked']:
        return
    try:
        parameter = entry['parameter']
        owner = entry['owner']
        if not owner.valid or owner.id != entry['ownerId'] or not parameter.valid:
            raise RuntimeError('the original parameter no longer exists')
        if owner.fetch('sgrapeShaderId', None) != entry['shaderId']:
            raise RuntimeError('the Shader identity changed')
        current = getattr(owner.par, entry['name'], None)
        if current is None or not parameter.isSamePar(current) or current.index != entry['index']:
            raise RuntimeError('the parameter was replaced')
        if parameter.mode != ParMode.CONSTANT or not parameter.enable or parameter.readOnly:
            raise RuntimeError('the parameter is now controlled or inactive')
        expected = entry['after'] if is_undo else entry['before']
        if entry['applied'] != bool(is_undo) or parameter.val != expected:
            raise RuntimeError('the value changed after this edit')
        value = entry['before'] if is_undo else entry['after']
        if entry['range'] is not None and (parameter.min, parameter.max, parameter.clampMin, parameter.clampMax) != entry['range']:
            raise RuntimeError('the parameter limits changed')
        if entry['validate'] is not None:
            entry['validate'](value)
        _set_parameter_without_native_capture(parameter, value)
        entry['applied'] = not bool(is_undo)
    except Exception as exc:
        # A skipped Undo must not become a later unexpected Redo write.
        entry['blocked'] = True
        ui.status = 'Grape: skipped parameter Undo/Redo; ' + str(exc)


def set_parameter_with_undo(parameter, value, validate=None):
    """Record an accepted editor commit; TD groups writes from one callback."""
    before = parameter.val
    if before == value:
        return
    if not ui.undo.globalState:
        _set_parameter_without_native_capture(parameter, value)
        return
    _set_parameter_without_native_capture(parameter, value)
    record_parameter_undo(parameter, before, parameter.val, validate)


def set_parameters_with_undo(plans):
    """Preflight one palette commit and roll back all values if a write fails."""
    unique=[]
    for parameter,value,validate in plans:
        validate(value)
        for previous,other,_ in unique:
            if parameter.isSamePar(previous):
                if value!=other:raise RuntimeError('Color components share one control with conflicting values.')
                break
        else:unique.append((parameter,value,validate))
    originals=[parameter.val for parameter,_,_ in unique]
    written=[]
    try:
        for (parameter,value,_),before in zip(unique,originals):
            written.append((parameter,before));_set_parameter_without_native_capture(parameter,value)
    except Exception:
        for parameter,before in reversed(written):_set_parameter_without_native_capture(parameter,before)
        raise
    if ui.undo.globalState:
        ui.undo.startBlock('Grape: Color')
        try:
            for (parameter,_,validate),before in zip(unique,originals):record_parameter_undo(parameter,before,parameter.val,validate)
        finally:ui.undo.endBlock()


def record_parameter_undo(parameter, before, after, validate=None):
    """Close one completed value edit without rewriting its final value."""
    if before == after or not ui.undo.globalState: return
    owner = parameter.owner
    entry = {'parameter': parameter, 'owner': owner, 'ownerId': owner.id,
             'name': parameter.name, 'index': parameter.index, 'before': before, 'applied': True, 'blocked': False,
             'shaderId': owner.fetch('sgrapeShaderId', None), 'validate': validate,
             'range': (parameter.min, parameter.max, parameter.clampMin, parameter.clampMax) if parameter.isNumber else None}
    ui.undo.startBlock('Grape: ' + owner.name + ' / ' + parameter.label)
    try:
        entry['after'] = after
        if before != entry['after']:
            ui.undo.addCallback(_parameter_undo, entry)
    finally:
        ui.undo.endBlock()
