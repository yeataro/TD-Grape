"""Development queues must be isolatable for sibling linked worktrees."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    'development_paths', Path(__file__).resolve().parents[2] / 'tools/dev/paths.py')
paths = importlib.util.module_from_spec(spec)
spec.loader.exec_module(paths)


class DevelopmentPathsTest(unittest.TestCase):
    def test_local_checkout_uses_its_own_queue_while_sibling_keeps_shared_setting(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            private = workspace / 'private'
            private.mkdir()
            (private / 'development.json').write_text(
                json.dumps({'workDirectory': '../shared-output'}), encoding='utf-8')
            refactor = workspace / 'refactor'
            local = refactor / '.local'
            local.mkdir(parents=True)
            (local / 'development.json').write_text(
                json.dumps({'workDirectory': '../../isolated-output'}), encoding='utf-8')
            self.assertEqual(paths.work_path(refactor), (workspace / 'isolated-output').resolve())
            self.assertEqual(paths.work_path(workspace / 'main'), (workspace / 'shared-output').resolve())

    def test_invalid_local_settings_fail_instead_of_falling_back_to_shared_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            (workspace / 'private').mkdir()
            (workspace / 'private/development.json').write_text(
                json.dumps({'workDirectory': '../shared-output'}), encoding='utf-8')
            root = workspace / 'refactor'
            (root / '.local').mkdir(parents=True)
            (root / '.local/development.json').write_text('{}', encoding='utf-8')
            with self.assertRaises(KeyError):
                paths.work_path(root)

    def test_unconfigured_checkouts_use_distinct_stable_temporary_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / 'one', Path(directory) / 'two'
            self.assertEqual(paths.work_path(first), paths.work_path(first))
            self.assertNotEqual(paths.work_path(first), paths.work_path(second))


if __name__ == '__main__':
    unittest.main()
