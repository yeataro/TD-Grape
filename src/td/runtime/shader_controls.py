"""Native controls embedded in every Grape Shader; generated GLSL is independent."""
def manager(shader):
    owners=op('/').findChildren(tags=['sgrapeManager'])
    identity=shader.fetch('sgrapeManagerId',None)
    matches=[owner for owner in owners if owner.fetch('sgrapeManagerId',None)==identity]
    if len(matches)==1:
        return matches[0]
    if not matches and len(owners)==1:
        return owners[0]
    raise RuntimeError('Install the owning TD-Grape component to edit this Shader')

def onPulse(par):
    if par.name == 'Glslparameters':
        shader=parent()
        shader.op('shader' if shader.op('shader') else 'material').openParameters()
        return
    if par.name in ('Openeditor','Openinbrowser'):
        shader=parent()
        owner=manager(shader)
        runtime=owner.op('runtime').module
        runtime.start(owner)
        runtime.register_shader(shader)
        address=runtime.url(shader)
        launcher=owner.op('editor_launch')
        if par.name=='Openinbrowser' or not launcher:
            ui.viewFile(address)
        else:
            launcher.module.open_editor(address,ui.viewFile,lambda callback,ms:run('args[0]()',callback,delayMilliSeconds=ms))
