"""Observe TD CHOP uploads for literal, const and specialization array lengths.

Disposable raw GLSL TOP fixture, deliberately independent of Grape codegen.
This reports host behavior; zero data is a known limitation, not a passing
support claim. Run through the development runner on each candidate TD build.
"""
from pathlib import Path
import json,uuid
root=op('/').create(baseCOMP,'symbolic_diagnostic_'+uuid.uuid4().hex[:8])
records=[]
try:
    callbacks=root.create(textDAT,'callbacks');callbacks.text='import numpy as np\ndef onCook(o):\n    o.copyNumpyArray(np.asarray([[1.,5.,9.,13.,17.,21.]],dtype=np.float32))\n'
    samples=root.create(scriptCHOP,'samples');samples.par.callbacks=callbacks;samples.cook(force=True)
    shader=root.create(glslTOP,'probe');pixel=root.create(textDAT,'pixel');shader.par.pixeldat=pixel
    shader.par.outputresolution='custom';shader.par.resolutionw=2;shader.par.resolutionh=2;shader.par.format='rgba32float';shader.par.compilebehavior='stalluntildone';shader.par.glslversion='glsl450'
    shader.seq.array.numBlocks=1;shader.par.array0name='weights';shader.par.array0type='float';shader.par.array0arraytype='uniformarray';shader.par.array0chop=samples
    shader.seq.const.numBlocks=1
    for mode,header,extent in [('literal','','4'),('constant','const int arrayCount=4;','arrayCount'),('specialization','layout(constant_id=7) const int arrayCount=4;','arrayCount')]:
        shader.par.const0name='arrayCount' if mode=='specialization' else ''
        for n in ([4,2,5] if mode=='specialization' else [4]):
            shader.par.const0value=n
            pixel.text=header+'\nuniform float weights['+extent+'];\nlayout(location=0)out vec4 color;void main(){color=vec4(weights[0],weights[weights.length()-1],float(weights.length()),float('+extent+'));}'
            shader.cook(force=True);a=shader.numpyArray(delayed=False)
            records.append(dict(mode=mode,n=n,actual=a[0,0].tolist() if a is not None else None,errors=str(shader.errors()),samples=samples.numSamples))
finally:root.destroy()
result=records
Path(GRAPE_TEST_OUTPUT,'details.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
