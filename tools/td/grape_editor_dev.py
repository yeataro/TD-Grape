"""Grape Editor delivery / development mode for the dev TOE. Not product code.

Embedded as the DAT /dev_tools/grape_editor (outside /TD_Grape so it never ships).
Run from the Textport or TD MCP:

    op('/dev_tools/grape_editor').module.Deliver()   # pack web assets into VFS, external off, save TOE
    op('/dev_tools/grape_editor').module.DevMode()   # serve from the external build folder again

AGENTS.md 網頁資產規則的可執行版本：交付前打包進 VFS → 關閉 Use External Folder → 確認版本 → 存 TOE；
開發時改回外部資料夾。每一步失敗即停止並說明原因，不會在半途存檔。
"""
import json

EDITOR = '/TD_Grape/GrapeEditor'


def _editor():
    editor = op(EDITOR)
    if editor is None:
        raise RuntimeError('GrapeEditor not found at ' + EDITOR)
    return editor


def _report(editor):
    p = editor.par
    return {'source': p.Actualsource.eval(), 'state': p.Servicestate.eval(),
            'version': p.Frontendversion.eval(), 'error': p.Serviceerror.eval()}


def _folder_version(service):
    # The build writes build-info.json; it names the version the VFS must now carry.
    with open(service._root() / 'build-info.json', encoding='utf-8') as handle:
        return json.load(handle)['version']


def Deliver(save=True):
    editor = _editor()
    service = editor.ext.EditorServiceExt
    expected = _folder_version(service)
    if not service.UpdateEmbedded():
        raise RuntimeError('Update Embedded failed; nothing saved: ' + editor.par.Serviceerror.eval())
    # The parameter callback also reloads; reload here so this run checks the result itself.
    editor.par.Useexternal = False
    if not service.Reload():
        raise RuntimeError('Embedded reload failed; nothing saved: ' + editor.par.Serviceerror.eval())
    report = _report(editor)
    if report['source'] != 'embedded' or report['version'] != expected:
        raise RuntimeError('Served {} {} but expected embedded {}; nothing saved'.format(
            report['source'], report['version'], expected))
    if save:
        project.save()
        report['saved'] = project.name
    return report


def DevMode():
    editor = _editor()
    editor.par.Useexternal = True
    if not editor.ext.EditorServiceExt.Reload():
        raise RuntimeError('External reload failed: ' + editor.par.Serviceerror.eval())
    return _report(editor)
