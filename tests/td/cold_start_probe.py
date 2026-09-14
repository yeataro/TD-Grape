"""Isolated startup verification driver; embedded only in the disposable test TOE."""
from pathlib import Path
import hashlib,json,os,threading,time,traceback,urllib.request
ROOT=Path(project.folder).resolve().parents[1]
CONTROL=ROOT.parent
EXPECTED=json.loads((CONTROL/'expected.private.json').read_text(encoding='utf-8'))
started=time.monotonic();phase=0;http_result=None
def onStart():
    (CONTROL/'started.json').write_text(json.dumps({'pid':os.getpid(),'project':str(project.name)}),encoding='utf-8')

def native():
    assert os.getpid()!=EXPECTED['originalPid']
    assert ROOT.name=='TD-Grape' and (CONTROL/'expected.private.json').is_file()
    assert not op('/TD_RemoteDebug') and not op('/sgrape_devbridge') and not op('/grape_devbridge')
    m=op('/project1/TD_Sgrape');r=m.op('runtime').module
    assert r._server and r._worker.is_alive()
    mapping=json.loads((ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    files=json.loads((ROOT/'src/td/source_files.json').read_text(encoding='utf-8'))
    for dat,name in mapping.items():
        assert m.op(dat).text==(ROOT/files[name]).read_text(encoding='utf-8'),dat
    ids=[]
    for path,record in EXPECTED['shaders'].items():
        s=op(path)
        assert s.op('state').text==record['state'],path+' state'
        for name,code in record['code'].items():assert s.op(name).text==code,path+' '+name
        r.validate_material(s)
        assert not s.errors(recurse=True),str(s.errors(recurse=True))
        s.op('preview').cook(force=True)
        assert s.op('preview').width>0
        ids.append(s.fetch('sgrapeShaderId'))
    assert r.PRODUCT_VERSION==EXPECTED['version']
    assert str(m.par.Tdfamstatus)=='Ready',str(m.par.Tdfamstatus)
    return {'passed':True,'newProcess':True,'pid':os.getpid(),'sourceAssets':len(mapping),
        'shaders':len(ids),'savedGraphsAndCodeMatch':True,'privateHelpersAbsent':True,
        'tdfamReady':True,'version':r.PRODUCT_VERSION,'checkout':str(ROOT)},r._port,r._token,ids

def http(report,port,token,ids):
    global http_result
    try:
        base='http://127.0.0.1:'+str(port);checked=[]
        for identity in ids:
            for name in ('state','shaders','preview'):
                req=urllib.request.Request(base+'/api/'+identity+'/'+name,headers={'X-Sgrape-Token':token})
                with urllib.request.urlopen(req,timeout=10) as response:data=response.read()
                if name=='preview':assert data.startswith(b'\x89PNG')
                else:json.loads(data)
                checked.append(name)
        for name in ('index.html','app.js','graph_ui.js','inspector.js','locales.json'):
            route='/' if name=='index.html' else '/'+name
            with urllib.request.urlopen(base+route,timeout=10) as response:data=response.read()
            assert data.decode('utf-8')==(ROOT/'src/editor'/name).read_text(encoding='utf-8'),name
        http_result={**report,'httpChecks':len(checked),'editorAssetsMatch':True}
    except Exception:http_result={'passed':False,'error':traceback.format_exc()}

def onFrameStart(frame):
    global phase
    if phase==2:return
    if phase==0 and time.monotonic()-started>5:
        m=op('/project1/TD_Sgrape');r=m.op('runtime').module
        if r._family_pending and time.monotonic()-started<35:return
        phase=1
        try:
            report,port,token,ids=native()
            threading.Thread(target=http,args=(report,port,token,ids),daemon=True).start()
        except Exception:
            (CONTROL/'cold-result.json').write_text(json.dumps({'passed':False,'error':traceback.format_exc()},indent=2),encoding='utf-8');phase=2
    if phase==1 and http_result is not None:
        (CONTROL/'cold-result.json').write_text(json.dumps(http_result,indent=2),encoding='utf-8');phase=2
    if phase==1 and time.monotonic()-started>60:
        (CONTROL/'cold-result.json').write_text(json.dumps({'passed':False,'error':'HTTP timeout'}),encoding='utf-8');phase=2
    if phase==2 and os.getpid()!=EXPECTED['originalPid']:project.quit(force=True)
