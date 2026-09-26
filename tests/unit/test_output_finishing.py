"""Independent Color Output calls, without altering saved legacy graphs."""
import copy,itertools,unittest
import sgrape_core as c
import sgrape_document as document

class OutputFinishing(unittest.TestCase):
    def graph(self,flags):
        graph=c.demo_graph('color','mat');output=graph['stages']['pixel']['nodes'][-1]
        output['params'].update(flags,bufferCount=3)
        graph['stages']['pixel']['edges'].extend(c.edge('color','pixel',port) for port in ('buffer1','buffer2'))
        return graph

    def test_all_combinations_only_process_buffer_zero(self):
        for bits in itertools.product((False,True),repeat=3):
            flags=dict(zip(c.PIXEL_FINISHING_DEFAULTS,bits));graph=self.graph(flags);before=copy.deepcopy(graph)
            with self.subTest(flags=flags):
                result=c.compile_graph(graph);text=result['pixel']
                for key,call in [('dither','TDDither('),('alphaTest','TDAlphaTest('),('convertColorSpace','TDConvertColorSpace(')]:
                    self.assertEqual(text.count(call),int(flags[key]))
                self.assertEqual('#include <TDColorSpace>' in text,flags['convertColorSpace'])
                calls=[text.index(call) for flag,call in zip(bits,['TDDither(','TDAlphaTest(','TDConvertColorSpace(']) if flag]
                self.assertEqual(calls,sorted(calls))
                for index in (1,2):self.assertIn(f'fragColor[{index}] = TDOutputSwizzle(sg_n_color);',text)
                if not any(bits):self.assertIn('fragColor[0] = TDOutputSwizzle(sg_color);',text)
                self.assertEqual(graph,before)
                self.assertEqual(document.inspect_document(graph,c,'mat')['candidate'],graph)
                line=next(i for i,s in enumerate(text.splitlines(),1) if 'fragColor[0] =' in s)
                self.assertTrue(any(row['node']=='pixel' and row['line']==line for row in result['sourceMap']['pixel']))

    def test_legacy_modes_and_partial_override(self):
        for legacy in (None,False,True):
            graph=self.graph({} if legacy is None else {'nativeFinishing':legacy})
            text=c.compile_graph(graph)['pixel'];flags=c.pixel_finishing(graph['stages']['pixel']['nodes'][-1]['params'])
            self.assertEqual(flags,dict(dither=True,alphaTest=True,convertColorSpace=bool(legacy)))
            self.assertEqual('TDConvertColorSpace(sg_color)' in text,bool(legacy))
            self.assertEqual(text.index('TDDither(')<text.index('TDAlphaTest('),bool(legacy))
            graph['stages']['pixel']['nodes'][-1]['params']['alphaTest']=False
            new=c.compile_graph(graph)['pixel'];self.assertNotIn('TDAlphaTest(',new)
            self.assertIn('TDDither(',new);self.assertEqual('TDConvertColorSpace(' in new,bool(legacy))

    def test_empty_primary_and_independent_calls(self):
        graph=self.graph(c.PIXEL_FINISHING_DEFAULTS);graph['stages']['pixel']['edges']=[]
        text=c.compile_graph(graph)['pixel'];self.assertNotIn('TDDither(',text);self.assertNotIn('TDConvertColorSpace(',text)
        self.assertIn('TDAlphaTest(sg_color.a);',text)
        graph=self.graph({key:False for key in c.PIXEL_FINISHING_DEFAULTS});p=graph['stages']['pixel']
        p['nodes'] += [c.node('td_dither','dither'),c.node('td_convert_color_space','convert'),c.node('td_alpha_test','alpha')]
        p['edges']=[c.edge('color','dither','color'),c.edge('dither','convert','color'),c.edge('convert','pixel','color')]
        text=c.compile_graph(graph)['pixel']
        for call in ['TDDither(','TDAlphaTest(','TDConvertColorSpace(']:self.assertEqual(text.count(call),1)
        # The author may also choose to repeat every call.
        next(n for n in p['nodes'] if n['id']=='pixel')['params'].update(c.PIXEL_FINISHING_DEFAULTS)
        text=c.compile_graph(graph)['pixel']
        for call in ['TDDither(','TDAlphaTest(','TDConvertColorSpace(']:self.assertEqual(text.count(call),2)

    def test_contract_defaults_and_invalid_values(self):
        self.assertEqual(c.type_contract()['pixelBufferOutputs']['finishingDefaults'],dict(dither=True,alphaTest=True,convertColorSpace=True))
        for key in c.PIXEL_FINISHING_DEFAULTS:
            for invalid in ('false',0,1,None):
                with self.subTest(key=key,invalid=invalid),self.assertRaisesRegex(c.GraphError,'must be a boolean'):c.compile_graph(self.graph({key:invalid}))
            graph=c.demo_graph('color','top');graph['stages']['pixel']['nodes'][-1]['params'][key]=True
            with self.assertRaisesRegex(c.GraphError,'requires a MAT graph'):c.compile_graph(graph)

if __name__=='__main__':unittest.main()
