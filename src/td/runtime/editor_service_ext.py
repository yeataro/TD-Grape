"""TouchDesigner boundary for asset loading, packing, and service lifecycle."""
from pathlib import Path
import socket

PORT_TRIES = 10  # the requested port and the next nine


class EditorServiceExt:
    def __init__(self, ownerComp):
        self.ownerComp = ownerComp
        self.http = None
        self.snapshot = None
        self._message = ''
        self.api = ownerComp.op('editor_service').module
        self._show('Stopped')

    def _root(self):
        value = tdu.expandPath(self.ownerComp.par.Rootfolder.eval())
        return (Path(project.folder) / value).resolve()

    def _vfs_files(self):
        """The embedded files as {name: bytes}. 內嵌的檔案。"""
        return {f.name: bytes(f.byteArray) for f in self.ownerComp.op('virtualFile').vfs.find()}

    def _embedded(self):
        return self.api.AssetSnapshot(self._vfs_files(), 'embedded')

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
        """Read the assets and serve them. The message it ends with is kept for Start (Refactor.62), never passed through a
        parameter. 讀資產並送出；結尾的訊息留給 Start，不借參數傳。"""
        self._message = ''
        try:
            candidate = self.api.folder_snapshot(self._root()) if self.ownerComp.par.Useexternal.eval() else self._embedded()
        except Exception as error:  # an asset problem of any kind keeps the service up 任何資產問題都不讓服務停
            if self.snapshot is not None:
                self._show('Serving previous snapshot' if self.http else 'Previous snapshot retained', str(error))
                return False
            # Cold-start fallback is an entire embedded version, never a
            # file-by-file mixture of external and embedded sources.
            if self.ownerComp.par.Useexternal.eval():
                try:
                    candidate = self._embedded()
                except Exception as embedded_error:
                    # Both reasons, the folder's and the embedded copy's (Refactor.62). 兩個原因都說。
                    self._show('No valid assets', 'External: ' + str(error) + ' | Embedded: ' + str(embedded_error))
                    return False
                message = 'External source failed; using embedded VFS: ' + str(error)
            else:
                self._show('No valid assets', str(error))
                return False
        else:
            message = ''
        self.snapshot = candidate
        self._message = message
        if self.http:
            self.http.replace(candidate)
        self._show('Serving' if self.http else 'Assets ready', message)
        if self.http and not self._connect_manager():
            return False
        return True

    def Start(self):
        if self.http:
            return True
        if self.snapshot is None and not self.Reload():
            return False
        previous = getattr(self, '_message', '')  # what Reload had to say 重新載入留下的話
        host = '0.0.0.0' if self.ownerComp.par.Allowlan.eval() else '127.0.0.1'
        requested = int(self.ownerComp.par.Port.eval())
        # The requested port first, so one TD always gets the same address (browser storage is per
        # port); when another program (e.g. a second TouchDesigner) holds it, the next free one.
        # The Port parameter is left as set; the port in use is shown (human 2026-10-09).
        # 先試設定的 port（同一台 TD 位址不變；瀏覽器儲存依 port 分開）；被佔用時往後找空的。
        # Port 參數不改，實際使用的 port 顯示出來。
        last_error = None
        for port in range(requested, min(requested + PORT_TRIES, 65536)):
            try:
                self.http = self.api.EditorHTTP(self.snapshot, host, port)
                break
            except OSError as error:
                last_error = error
        if not self.http:
            self._show('Cannot start; ports ' + str(requested) + '-' + str(port) + ' are in use', str(last_error))
            return False
        if self.http.port != requested:
            message = ('Port ' + str(requested) + ' is in use (another TouchDesigner?); the editor is served on port '
                       + str(self.http.port) + '.')
            self._show('Serving on port ' + str(self.http.port), ' | '.join(m for m in (message, previous) if m))
            try:
                ui.status = 'TD-Grape: ' + message
            except Exception:
                pass
        else:
            self._show('Serving', previous)
        self._connect_manager()
        return True

    def _connect_manager(self):
        """Returns False when the Manager could not connect; the state says why, with the error's kind (Refactor.62):
        most often the assets (another build, a missing file), not the Manager. 連不上時回 False；狀態寫原因與錯誤種類
        （多半是資產：建置不同、少檔案，不是 Manager 本身）。"""
        par = getattr(self.ownerComp.par, 'Manager', None)
        manager = par.eval() if par else None
        if manager:
            try:
                manager.ext.GrapeManagerExt.Connect(self)
            except Exception as error:  # the service stays up; the reason is shown 服務照常；顯示原因
                self._show('Serving assets; Manager not connected', type(error).__name__ + ': ' + str(error))
                return False
        return True

    def Stop(self):
        if self.http:
            self.http.close()
            self.http = None
        # The Manager lets go too, so nothing is watched while no editor can connect (Refactor.62).
        # Manager 一起放開：沒有編輯器能連時，什麼都不監看。
        par = getattr(self.ownerComp.par, 'Manager', None)
        manager = par.eval() if par else None
        if manager:
            manager.ext.GrapeManagerExt.Disconnect()
        self._show('Stopped')

    def UpdateEmbedded(self):
        # Read and validate everything before touching the owned VFS.
        try:
            candidate = self.api.folder_snapshot(self._root())
        except Exception as error:
            self._show('Pack failed; embedded assets retained', str(error))
            return False
        vfs = self.ownerComp.op('virtualFile').vfs
        previous = self._vfs_files()
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
        # A reload that went wrong keeps its own state, never covered by "updated" (Refactor.62). 重新載入出錯時保留它的狀態。
        if not self.ownerComp.par.Useexternal.eval() and not self.Reload():
            return True
        self._show('Embedded updated; save TOE/TOX to keep it', getattr(self, '_message', ''))
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
