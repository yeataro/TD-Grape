"""Candidate modes must preserve the actual model validation/transaction path."""
import json
from pathlib import Path
import subprocess
import unittest
import sgrape_core as core


class WireValidation(unittest.TestCase):
    def test_candidate_geometry_and_lifetime(self):
        subprocess.run(['node', str(Path(__file__).with_name('test_wire_candidates.js'))], check=True)

    def test_real_planner_and_transactions(self):
        payload = {'catalog': list(core.CATALOG.values()), 'contract': core.type_contract()}
        subprocess.run(['node', str(Path(__file__).with_name('test_wire_validation_model.js'))],
                       input=json.dumps(payload), text=True, check=True)
