"""TouchDesigner boundary for asset loading, packing, and service lifecycle."""
from pathlib import Path
import socket


class EditorServiceExt:
    def __init__(self, ownerComp):
        self.ownerComp = ownerComp
        self.http = None
        self.snapshot = None
        self.api = ownerComp.op('editor_service').module
        self._show('Stopped')

    def _root(self):
        value = tdu.expandPath(self.ownerComp.par.Rootfolder.eval())
        return (Path(project.folder) / value).resolve()

    def _embedded(self):
        return self.api.AssetSnapshot({f.name: bytes(f.byteArray)
            for f in self.ownerComp.op('virtualFile').vfs.find()}, 'embedded')

    def _show(self, state, error=''):
        p = self.ownerComp.par
        p.Servicestate = state
        p.Serviceerror = error
        p.Actualsource = self.snapshot.source if self.snapshot else 'None'
        p.Frontendversion = self.snapshot.version if self.snapshot else 'Unknown'
        p.Assetcount = len(self.snapshot.files) if self.snapshot else 0
        p.Sourcefolder = str(self._root())
        p.Localurl = 'http://127.0.0.1:' + str(self.http.port) + '/' if self.http else ''
        addresses = set()
        if self.http and p.Allowlan.eval():
            try:
                addresses = {row[4][0] for row in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
                    if not row[4][0].startswith('127.')}
            except OSError:
                pass
        p.Lanurls = '\n'.join('http://' + address + ':' + str(self.http.port) + '/' for address in sorted(addresses))

    def Reload(self):
        try:
            candidate = self.api.folder_snapshot(self._root()) if self.ownerComp.par.Useexternal.eval() else self._embedded()
        except Exception as error:
            if self.snapshot is not None:
                self._show('Serving previous snapshot' if self.http else 'Previous snapshot retained', str(error))
                return False
            # Cold-start fallback is an entire embedded version, never a
            # file-by-file mixture of external and embedded sources.
            if self.ownerComp.par.Useexternal.eval():
                try:
                    candidate = self._embedded()
                except Exception:
                    self._show('No valid assets', str(error))
                    return False
                message = 'External source failed; using embedded VFS: ' + str(error)
            else:
                self._show('No valid assets', str(error))
                return False
        else:
            message = ''
        self.snapshot = candidate
        if self.http:
            self.http.replace(candidate)
        self._show('Serving' if self.http else 'Assets ready', message)
        if self.http:
            self._connect_manager()
        return True

    def Start(self):
        if self.http:
            return True
        if self.snapshot is None and not self.Reload():
            return False
        previous_error = self.ownerComp.par.Serviceerror.eval()
        try:
            self.http = self.api.EditorHTTP(self.snapshot,
                '0.0.0.0' if self.ownerComp.par.Allowlan.eval() else '127.0.0.1',
                int(self.ownerComp.par.Port.eval()))
        except OSError as error:
            self._show('Cannot start; requested port unchanged', str(error))
            return False
        self._show('Serving', previous_error)
        self._connect_manager()
        return True

    def _connect_manager(self):
        par = getattr(self.ownerComp.par, 'Manager', None)
        manager = par.eval() if par else None
        if manager:
            try:
                manager.ext.GrapeManagerExt.Connect(self)
            except Exception as error:
                self._show('Serving assets; Manager unavailable', str(error))

    def Stop(self):
        if self.http:
            self.http.close()
            self.http = None
        self._show('Stopped')

    def UpdateEmbedded(self):
        # Read and validate everything before touching the owned VFS.
        try:
            candidate = self.api.folder_snapshot(self._root())
        except Exception as error:
            self._show('Pack failed; embedded assets retained', str(error))
            return False
        vfs = self.ownerComp.op('virtualFile').vfs
        previous = {f.name: bytes(f.byteArray) for f in vfs.find()}
        def replace(files):
            for file in vfs.find():
                file.destroy()
            for name, data in files.items():
                vfs.addByteArray(data, name)
        try:
            replace(candidate.files)
        except Exception as error:
            replace(previous)
            self._show('Pack failed; embedded assets restored', str(error))
            return False
        if not self.ownerComp.par.Useexternal.eval():
            self.Reload()
        self._show('Embedded updated; save TOE/TOX to keep it')
        return True

    def onParValueChange(self, par, prev):
        if par.name == 'Active':
            self.Start() if par.eval() else self.Stop()
        elif par.name in ('Port', 'Allowlan'):
            self.Stop()
            if self.ownerComp.par.Active.eval():
                self.Start()
        elif par.name == 'Useexternal':
            self.Reload()
        elif par.name == 'Rootfolder':
            self._show('Source changed; reload or update embedded')

    def onParPulse(self, par):
        if par.name == 'Reload':
            self.Reload()
            if self.ownerComp.par.Active.eval() and not self.http:
                self.Start()
        elif par.name == 'Updateembedded':
            self.UpdateEmbedded()
        elif par.name == 'Openeditor' and self.http:
            ui.viewFile(self.ownerComp.par.Localurl.eval())

    def onInitTD(self):
        if self.ownerComp.par.Active.eval():
            self.Start()

    def onDestroyTD(self):
        if self.http:
            self.http.close()
            self.http = None
