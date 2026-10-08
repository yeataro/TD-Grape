"""Preserve asset paths below GrapeEditor's Rootfolder when packing into VFS.

Embedded as GrapeEditor/folder1_callbacks in the main component. The Palette virtualFile
component consumes the overrideName column; path remains the disk read source.
"""
from pathlib import Path


def onInitGetColumnNames(dat):
    return ['overrideName']


def onGetValues(dat, info, row):
    root = (Path(project.folder) / tdu.expandPath(dat.par.rootfolder.eval())).resolve()
    relative_path = Path(info.path).resolve().relative_to(root)
    return [relative_path.as_posix()]
