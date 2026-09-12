"""Synchronize authored brand SVGs into product HTML and favicon. No raster/font dependency."""
from pathlib import Path
import re,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
mark=(root/'src/assets/brand/mark.svg').read_text(encoding='utf-8').strip()
icon=(root/'src/assets/brand/app-icon.svg').read_text(encoding='utf-8')
ns='{http://www.w3.org/2000/svg}'
mr,ir=ET.fromstring(mark),ET.fromstring(icon)
assert mr.attrib['viewBox']==ir.attrib['viewBox']=='0 0 64 64'
assert len(mr.findall(ns+'circle'))==3 and mr.find(ns+'rect') is None
assert [c.attrib for c in mr.findall(ns+'circle')]==[c.attrib for c in ir.findall(ns+'circle')]
inline=re.sub(r'^<svg\b[^>]*>','<svg class="brand-mark" data-brand-mark="true" viewBox="0 0 64 64" aria-hidden="true" focusable="false" width="28" height="28">',mark,count=1)
htmlpath=root/'src/editor/index.html';html=htmlpath.read_text(encoding='utf-8')
pattern=r'<!-- sgrape-brand:start -->.*?<!-- sgrape-brand:end -->'
assert len(re.findall(pattern,html,re.S))==2,'Expected header and About brand slots'
updated=re.sub(pattern,lambda _: '<!-- sgrape-brand:start -->'+inline+'<!-- sgrape-brand:end -->',html,flags=re.S)
if '--check' in sys.argv:
 assert updated==html,'Embedded UI brand differs from source'
 assert (root/'src/editor/favicon.svg').read_text(encoding='utf-8')==icon,'Favicon differs from source'
 print('UI and favicon match the canonical brand SVG sources')
else:
 htmlpath.write_text(updated,encoding='utf-8')
 (root/'src/editor/favicon.svg').write_text(icon,encoding='utf-8')
 print('Synchronized header, About and favicon; regenerate PNG exports if SVG sources changed')
