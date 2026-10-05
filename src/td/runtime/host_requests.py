"""Bounded HTTP-to-main-thread handoff. Contains no TouchDesigner objects.

Workers wait here, never on the TD thread. The manager drains only queued work;
an empty drain does not inspect networks, parameters, sources or editor state.
"""
from collections import deque
import threading
from time import monotonic
import traceback


def unavailable(code, message):
    return 503, {'code': code, 'error': message}


class HostRequests:
    def __init__(self, *, capacity=32, timeout=10):
        self.capacity = capacity
        self.timeout = timeout
        self._pending = deque()
        self._lock = threading.Lock()
        self._closed = False
        self._serial = 0
        self._outcomes = deque(maxlen=16)

    def request(self, method, path, body):
        entry = {'method': method, 'path': path, 'body': body,
                 'state': 'pending', 'done': threading.Event(), 'result': None,
                 'deadline': monotonic() + self.timeout}
        with self._lock:
            if self._closed:
                return unavailable('manager_unavailable', 'The TD Manager is not available.')
            if len(self._pending) >= self.capacity:
                return unavailable('manager_busy', 'The TD Manager request queue is full. No changes were made.')
            self._serial += 1
            entry['id'] = self._serial
            self._pending.append(entry)
        entry['done'].wait(self.timeout)
        with self._lock:
            if entry['state'] == 'finished':
                return entry['result']
            if entry['state'] == 'pending':
                self._pending.remove(entry)
                entry['state'] = 'cancelled'
                return unavailable('manager_not_responding', 'TD did not process this request. No changes were made; it will not run later.')
            # A running TD operation cannot be undone safely by its HTTP worker.
            # Report uncertainty; never repeat a mutation automatically.
            return 503, {'code': 'application_outcome_unknown', 'requestId': entry['id'],
                         'error': 'TD started this operation but has not returned its result. Refresh its state before repeating the operation.'}

    def drain(self, dispatch, *, limit=4, budget_seconds=.002):
        started = monotonic()
        count = 0
        while count < limit:
            with self._lock:
                if self._closed or not self._pending:
                    break
                entry = self._pending.popleft()
                if monotonic() >= entry['deadline']:
                    entry.update(state='finished', result=unavailable('manager_not_responding',
                        'TD did not process this request. No changes were made; it will not run later.'))
                    entry['done'].set()
                    continue
                entry['state'] = 'running'
            try:
                result = dispatch(entry['method'], entry['path'], entry['body'])
                failure_trace = ''
            except Exception as error:
                result = 500, {'code': 'host_operation_failed', 'error': str(error),
                               'operation': entry['method'] + ' ' + entry['path'],
                               'layer': 'TD Manager', 'exception': type(error).__name__}
                failure_trace = traceback.format_exc(limit=6)
            with self._lock:
                status, detail = result
                diagnostic = {'requestId': entry['id'], 'operation': entry['method'] + ' ' + entry['path'],
                              'status': status, 'completedAt': monotonic()}
                if isinstance(detail, dict):
                    diagnostic.update({key: str(detail[key])[:2048] for key in
                        ('code', 'error', 'layer', 'exception') if key in detail})
                if failure_trace:
                    diagnostic['traceback'] = failure_trace[-4096:]
                self._outcomes.append(diagnostic)
                entry.update(state='finished', result=result)
                entry['done'].set()
            count += 1
            if monotonic() - started >= budget_seconds:
                break
        return count

    def outcomes(self):
        """Small diagnostics, including completions after an HTTP timeout.

        No graph, shader or request body is retained here. The TD adapter can
        display these on demand; nothing refreshes a viewer on idle frames.
        """
        with self._lock:
            return [dict(row) for row in self._outcomes]

    def close(self):
        with self._lock:
            self._closed = True
            while self._pending:
                entry = self._pending.popleft()
                entry.update(state='finished', result=unavailable(
                    'manager_unavailable', 'The TD Manager stopped before processing the request. No changes were made.'))
                entry['done'].set()
