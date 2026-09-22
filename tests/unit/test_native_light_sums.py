import unittest
import sgrape_core as c
from native_light_sum_fixture import light_sum_graph

class NativeLightSums(unittest.TestCase):
    def test_all_outputs_preserve_their_native_contribution(self):
        for key,outputs,bound in [('td_lighting_all',('diffuse','specular','specular2'),'TD_NUM_LIGHTS'),('td_lighting_pbr_all',('diffuse','specular'),'TD_NUM_LIGHTS'),('td_env_lighting_pbr_all',('diffuse','specular'),'TD_NUM_ENV_LIGHTS')]:
            for output in outputs:
                with self.subTest(key=key,output=output):
                    result=c.compile_graph(light_sum_graph(c,key,output));source=result['pixel']
                    self.assertIn(' < '+bound,source)
                    self.assertIn(' += sg_light_result_lights.'+output,source)
                    self.assertNotIn('uTDGeneral.ambientColor',source)
                    self.assertNotIn(key,c.CONSTANT_EXPRESSIONS)
                    for row in result['sourceMap']['pixel']:
                        if row['node']=='lights':self.assertTrue(source.splitlines()[row['line']-1].strip())
