"""TD-Grape main component controls."""
def onPulse(par):
    owner=parent()
    runtime=owner.op('runtime').module
    runtime.start(owner)
    def create(kind='mat'):
        master=runtime.master_template(kind)
        if not master:raise RuntimeError('Missing Grape '+kind.upper()+' template')
        shader=owner.parent().copy(master,name='Grape_'+kind.upper()+'1')
        runtime.register_shader(shader,fresh=True)
        shader.nodeX=owner.nodeX+240;shader.nodeY=owner.nodeY
        return shader
    if par.name=='Createmat':
        shader=create()
    elif par.name=='Createtop':
        shader=create('top')
    elif par.name=='Updateshaders':
        runtime.update_shaders()
    elif par.name=='Openpersonalfolder':
        folder=runtime.personal_folder();folder.mkdir(parents=True,exist_ok=True)
        ui.viewFile(str(folder))
    elif par.name=='Registertdfam':
        runtime.request_family_registration()
    elif par.name in ('Openeditor','Openinbrowser'):
        shaders=runtime.shaders()
        shader=shaders[0] if shaders else create()
        address=runtime.url(shader)
        launcher=owner.op('editor_launch')
        if par.name=='Openinbrowser' or not launcher:
            ui.viewFile(address)
        else:
            launcher.module.open_editor(address,ui.viewFile,lambda callback,ms:run('args[0]()',callback,delayMilliSeconds=ms))
