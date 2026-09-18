"""Run the editor compound-type parity checks with the current core contract."""
import json
from pathlib import Path
import subprocess
import unittest

import sgrape_core as core


class ArrayEditor(unittest.TestCase):
    def test_current_contract_and_editor_compound_semantics(self):
        script = Path(__file__).with_suffix('.js')
        result = subprocess.run(
            ['node', str(script)],
            input=json.dumps({'catalog': list(core.CATALOG.values()), 'typeContract': core.type_contract()}),
            text=True, encoding='utf-8', capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)['passed'])


if __name__ == '__main__':
    unittest.main()
