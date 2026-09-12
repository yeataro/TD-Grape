"""Best-effort app-window launch, with the system browser as the guaranteed route.

Pure stdlib; TouchDesigner supplies its normal opener and main-thread scheduler.
An explicit, verified OS/browser matrix prevents guessing about Chromium forks.
"""
from pathlib import Path
from urllib.parse import urlsplit
import ctypes
import platform
import subprocess

# Only browser/platform combinations verified as app windows are enabled.
# macOS detection is supported, but its browsers fall back pending native checks.
APP_BROWSERS = {('Windows', 'chrome'): True, ('Windows', 'edge'): True}


def _windows_association(scheme, kind):
    query = ctypes.WinDLL('shlwapi').AssocQueryStringW
    query.argtypes = [ctypes.c_uint, ctypes.c_uint, ctypes.c_wchar_p,
                      ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_ulong)]
    query.restype = ctypes.c_long
    size = ctypes.c_ulong()
    query(0x1000, kind, scheme, None, None, ctypes.byref(size))
    if not 1 < size.value < 32768:
        return ''
    value = ctypes.create_unicode_buffer(size.value)
    if query(0x1000, kind, scheme, None, value, ctypes.byref(size)) != 0:
        return ''
    return value.value


def _mac_default_bundle(scheme):
    cf = ctypes.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    ls = ctypes.CDLL('/System/Library/Frameworks/CoreServices.framework/CoreServices')
    cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
    cf.CFStringCreateWithCString.restype = ctypes.c_void_p
    cf.CFStringGetCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]
    cf.CFStringGetCString.restype = ctypes.c_bool
    cf.CFRelease.argtypes = [ctypes.c_void_p]
    ls.LSCopyDefaultHandlerForURLScheme.argtypes = [ctypes.c_void_p]
    ls.LSCopyDefaultHandlerForURLScheme.restype = ctypes.c_void_p
    text = cf.CFStringCreateWithCString(None, scheme.encode('utf-8'), 0x08000100)
    if not text:
        return ''
    bundle = None
    try:
        bundle = ls.LSCopyDefaultHandlerForURLScheme(text)
        if not bundle:
            return ''
        value = ctypes.create_string_buffer(2048)
        return value.value.decode('utf-8') if cf.CFStringGetCString(bundle, value, len(value), 0x08000100) else ''
    finally:
        if bundle:
            cf.CFRelease(bundle)
        cf.CFRelease(text)


def default_browser(scheme):
    system = platform.system()
    if system == 'Windows':
        executable = _windows_association(scheme, 2)  # ASSOCSTR_EXECUTABLE
        progid = _windows_association(scheme, 20)  # ASSOCSTR_PROGID
        name = Path(executable).name.lower()
        browser = 'chrome' if name == 'chrome.exe' and progid.lower().startswith('chromehtml') else 'edge' if name == 'msedge.exe' and progid.lower().startswith('msedgehtm') else 'unknown'
        return {'system': system, 'browser': browser, 'executable': executable}
    if system == 'Darwin':
        bundle = _mac_default_bundle(scheme)
        return {'system': system, 'browser': {'com.google.chrome':'chrome','com.apple.Safari':'safari'}.get(bundle, 'unknown'), 'bundle': bundle}
    return {'system': system, 'browser': 'unknown'}


def app_command(browser, url):
    if not APP_BROWSERS.get((browser.get('system'), browser.get('browser'))):
        return None
    executable = browser.get('executable', '')
    if not executable or not Path(executable).is_file():
        return None
    # URL is a single argument, without a shell or changes to browser/profile settings.
    return [executable, '--app=' + url]


def open_editor(url, normal_open, schedule=None, *, detect=default_browser, spawn=subprocess.Popen):
    """Launch once; startup rejection falls back once on the TD main thread.

    schedule(callback, milliseconds) must execute callbacks on the UI thread.
    A zero process exit may be a successful handoff to an existing browser.
    A running process is monitored briefly without blocking TouchDesigner.
    """
    scheme = urlsplit(url).scheme.lower()
    if scheme not in ('http', 'https'):
        raise ValueError('The editor address must be an HTTP or HTTPS URL')
    result = {'mode':'browser', 'fallback':False, 'finished':False}

    def fallback():
        if result['finished']:
            return
        result.update(mode='browser', fallback=True, finished=True)
        normal_open(url)

    try:
        command = app_command(detect(scheme), url)
        # Without a scheduler we cannot safely monitor startup from the TD UI.
        if not command or schedule is None:
            fallback()
            return result
        process = spawn(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL, shell=False, close_fds=True)
    except Exception:
        if result['finished']:
            raise
        fallback()
        return result
    result['mode'] = 'app'
    remaining = 10

    def check():
        nonlocal remaining
        if result['finished']:
            return
        try:
            code = process.poll()
            if code is not None:
                if code != 0:
                    fallback()
                else:
                    result['finished'] = True
                return
            remaining -= 1
            if remaining <= 0:
                result['finished'] = True
                return
            schedule(check, 300)
        except Exception:
            if result['finished']:
                raise
            fallback()
    check()
    return result
