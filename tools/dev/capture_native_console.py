"""Read one Windows TD native console into bounded local diagnostic logs.

The controller retains its own console. A short-lived, windowless reader attaches
to TD with read-only CONOUT$ access; it never sends input or changes TD state.
"""
import argparse
import ctypes as ct
from ctypes import wintypes as wt
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time


class Coord(ct.Structure):
    _fields_ = [('X', wt.SHORT), ('Y', wt.SHORT)]


class SmallRect(ct.Structure):
    _fields_ = [(name, wt.SHORT) for name in ('Left', 'Top', 'Right', 'Bottom')]


class BufferInfo(ct.Structure):
    _fields_ = [('dwSize', Coord), ('dwCursorPosition', Coord),
               ('wAttributes', wt.WORD), ('srWindow', SmallRect),
               ('dwMaximumWindowSize', Coord)]


def snapshot(pid, expected_start=None):
    api = ct.WinDLL('kernel32', use_last_error=True)
    api.OpenProcess.argtypes = [wt.DWORD, wt.BOOL, wt.DWORD]
    api.OpenProcess.restype = wt.HANDLE
    api.GetProcessTimes.argtypes = [wt.HANDLE] + [ct.POINTER(wt.FILETIME)] * 4
    api.GetProcessTimes.restype = wt.BOOL
    api.AttachConsole.argtypes = [wt.DWORD]
    api.AttachConsole.restype = wt.BOOL
    api.CreateFileW.argtypes = [wt.LPCWSTR, wt.DWORD, wt.DWORD, wt.LPVOID,
                               wt.DWORD, wt.DWORD, wt.HANDLE]
    api.CreateFileW.restype = wt.HANDLE
    api.GetConsoleScreenBufferInfo.argtypes = [wt.HANDLE, ct.POINTER(BufferInfo)]
    api.GetConsoleScreenBufferInfo.restype = wt.BOOL
    api.ReadConsoleOutputCharacterW.argtypes = [wt.HANDLE, wt.LPWSTR, wt.DWORD,
                                              Coord, ct.POINTER(wt.DWORD)]
    api.ReadConsoleOutputCharacterW.restype = wt.BOOL
    api.CloseHandle.argtypes = [wt.HANDLE]
    process = api.OpenProcess(0x1000, False, pid)
    if not process:
        raise ct.WinError(ct.get_last_error())
    handle = None
    attached = False
    try:
        times = [wt.FILETIME() for _ in range(4)]
        if not api.GetProcessTimes(process, *[ct.byref(value) for value in times]):
            raise ct.WinError(ct.get_last_error())
        created = (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime
        if expected_start is not None and created != expected_start:
            raise ValueError('PID belongs to a different process; refusing console capture')
        api.FreeConsole()
        if not api.AttachConsole(pid):
            raise ct.WinError(ct.get_last_error())
        attached = True
        handle = api.CreateFileW('CONOUT$', 0x80000000, 3, None, 3, 0, None)
        if handle == wt.HANDLE(-1).value:
            raise ct.WinError(ct.get_last_error())
        info = BufferInfo()
        if not api.GetConsoleScreenBufferInfo(handle, ct.byref(info)):
            raise ct.WinError(ct.get_last_error())
        width, rows = info.dwSize.X, info.dwSize.Y
        if width <= 0 or rows <= 0 or width * rows > 2_000_000:
            raise ValueError('Console dimensions are invalid or exceed the capture limit')
        count = width * rows
        text = ct.create_unicode_buffer(count + 1)
        copied = wt.DWORD()
        if not api.ReadConsoleOutputCharacterW(handle, text, count, Coord(0, 0), ct.byref(copied)):
            raise ct.WinError(ct.get_last_error())
        raw = text[:copied.value]
        lines = [raw[i:i+width].rstrip() for i in range(0, len(raw), width)]
        return dict(ok=True, text='\n'.join(lines).rstrip(), width=width, rows=rows, processStarted=created,
                    cursor=[info.dwCursorPosition.X, info.dwCursorPosition.Y])
    finally:
        if handle and handle != wt.HANDLE(-1).value:
            api.CloseHandle(handle)
        if attached:
            api.FreeConsole()
        api.CloseHandle(process)


def write_json(path, value):
    pending = path.with_suffix(path.suffix + '.pending')
    pending.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    pending.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pid', type=int, help='PID of the TD process owning the native console')
    parser.add_argument('--output', type=Path, required=True, help='Private capture directory')
    parser.add_argument('--seconds', type=float, default=3600, help='Maximum duration; default one hour')
    parser.add_argument('--interval', type=float, default=1, help='Polling interval in seconds')
    parser.add_argument('--snapshot', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--expected-start', type=int, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if os.name != 'nt':
        parser.error('Native console capture requires Windows')
    if args.pid <= 0 or args.seconds <= 0 or args.interval < 0.1:
        parser.error('PID/duration must be positive; interval must be at least 0.1 seconds')
    folder = args.output.resolve()
    folder.mkdir(parents=True, exist_ok=True)
    sample = folder / 'snapshot.json'
    if args.snapshot:
        try:
            result = snapshot(args.pid, args.expected_start)
        except Exception as error:
            result = dict(ok=False, error=str(error))
        write_json(sample, result)
        return 0 if result['ok'] else 1
    if sample.exists() or (folder / 'status.json').exists():
        parser.error('Use a new output directory for each capture session')
    deadline, previous, failures = time.monotonic() + args.seconds, '', 0
    process_started = None
    status = dict(pid=args.pid, intervalSeconds=args.interval, started=datetime.now(timezone.utc).isoformat())
    print('Capturing TD console to', folder, flush=True)
    try:
        while time.monotonic() < deadline and not (folder / 'stop').exists():
            try:
                command = [sys.executable, str(Path(__file__).resolve()), str(args.pid),
                           '--output', str(folder), '--snapshot']
                if process_started is not None:
                    command.extend(['--expected-start', str(process_started)])
                subprocess.run(command, timeout=5,
                               creationflags=subprocess.CREATE_NO_WINDOW, check=True,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                result = json.loads(sample.read_text(encoding='utf-8'))
                text = result.pop('text')
                process_started = result['processStarted']
                failures = 0
                if text != previous:
                    delta = text[len(previous):] if text.startswith(previous) else '\n[Buffer changed/scrolled; full snapshot]\n' + text
                    with (folder / 'history.log').open('a', encoding='utf-8') as stream:
                        stream.write('\n[' + datetime.now(timezone.utc).isoformat() + ']\n' + delta + '\n')
                        stream.flush()
                    (folder / 'console.log').write_text(text, encoding='utf-8')
                    previous = text
                status.update(result, checked=datetime.now(timezone.utc).isoformat(), characters=len(text))
                history = folder / 'history.log'
                if history.exists() and history.stat().st_size > 32 * 1024 * 1024:
                    status['stopped'] = '32 MiB capture limit reached'
                    break
            except (OSError, subprocess.SubprocessError, ValueError, KeyError) as error:
                failures += 1
                detail = str(error)
                if isinstance(error, subprocess.CalledProcessError) and sample.exists():
                    detail = json.loads(sample.read_text(encoding='utf-8')).get('error', detail)
                status.update(ok=False, checked=datetime.now(timezone.utc).isoformat(), error=detail)
                if failures >= 5:
                    status['stopped'] = 'Console unavailable after five attempts'
                    break
            write_json(folder / 'status.json', status)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        status['stopped'] = 'Stopped by caller'
    finally:
        status.setdefault('stopped', 'Duration ended or stop file requested')
        write_json(folder / 'status.json', status)
    return 0 if status.get('ok') else 1


if __name__ == '__main__':
    raise SystemExit(main())
