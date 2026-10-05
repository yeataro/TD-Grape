"""On-demand editor discovery. No per-frame search or retry on a Family."""
import json


def onPulse(par):
    if par.name != 'Edit':
        return
    comp = par.owner
    status = comp.op('GrapeControls/status')
    try:
        managers = [item for item in op('/').findChildren(tags=['grapeNativeManager'])
                    if item.ext.GrapeManagerExt.queue is not None]
        if len(managers) != 1:
            status.text = json.dumps({'state': 'Editing unavailable', 'message':
                'No active Manager.' if not managers else 'More than one Manager is available; select a Manager before editing.'})
            return
        address = managers[0].ext.GrapeManagerExt.Open(comp)
        status.text = json.dumps({'state': 'Editor opened', 'url': address})
    except Exception as error:
        status.text = json.dumps({'state': 'Editing unavailable', 'message': str(error)})
