"""Embed the canonical Subgraph SVG; the three-circle brand itself stays unchanged."""
from pathlib import Path
import re,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
source=(root/'src/assets/brand/subgraph.svg').read_text('utf-8').strip()
svg=ET.fromstring(source);ns='{http://www.w3.org/2000/svg}'
assert [(c.get('cx'),c.get('cy')) for c in svg.findall(ns+'circle')]==[('20','23'),('44','23'),('32','44')]
inline=re.sub(r'^<svg\b[^>]*>','<svg class="subgraph-icon" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" focusable="false">',source,count=1)
path=root/'src/editor/index.html';html=path.read_text('utf-8');pattern=r'(<template id="subgraph-icon">).*?(</template>)'
assert len(re.findall(pattern,html,re.S))==1
updated=re.sub(pattern,lambda m:m[1]+inline+m[2],html,flags=re.S)
if '--check' in sys.argv:assert updated==html,'Embedded Subgraph icon differs from its SVG source'
else:path.write_text(updated,'utf-8')
print('Subgraph SVG matches its embedded template')
