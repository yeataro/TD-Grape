"""Refresh the reviewed source inventory's implementation columns from the registry."""
import csv
import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[2]
catalog=json.loads((ROOT/'src/library/source_catalog.json').read_text(encoding='utf-8'))
path=ROOT/'docs/discussions/TD_SOURCE_NAMING_CATALOG.csv'
with path.open(encoding='utf-8-sig',newline='') as stream:
    reader=csv.DictReader(stream);fields=list(reader.fieldnames);rows=list(reader)
for field in ('implementation','implementation_note'):
    if field not in fields:fields.append(field)
aliases={'S067':'position','S065':'uv','S080':'TDInstanceTextureIndex','S093':'Viewport Origin','S094':'Viewport Resolution','S137':'uTDEnvLightBuffers.shCoeffs'}
for row in rows:
    n=int(row['id'][1:]);name=row['td_name'].removesuffix('[]').split('(')[0]
    key=aliases.get(row['id'],name)
    if n<=6:status,note='已支援','Common Time 預置；首次建立才填入 Expression，之後引用同一 TD 實體。'
    elif n<=38:status,note='使用者自行新增','Custom Uniform 的來源模式／Python Expression；保留審查決策，不新增低頻預置。'
    elif key in catalog['builtins'] or key in catalog['nodeSources']:
        status,note='已支援','來源表 '+key+'；入口依 TOP／MAT 與 Vertex／Pixel 篩選。'
        if key in ('sTD3DInputs','sTD2DArrayInputs','sTDCubeInputs','sTDSineLookup'):note+=' 資源可經 Array Get／GLSL Code 取樣；既有 Texture Sample 快捷仍為 2D。'
    elif n==90:status,note='沿用欄位來源','提供 uTDEnvLightBuffers.shCoeffs(lightIndex)，保留 SSBO 宿主所有權；不把 block 冒充可複製 struct。'
    elif 54<=n<=60 or 92==n or 95<=n<=136:status,note='沿用集合與欄位','使用相應集合 → Array Get → Field；向量再接 Split／Swizzle，不重複建立每分量來源。'
    elif 146<=n<=150 or n==153:status,note='已支援','Custom Uniform／Matrix／Array／Texture Buffer／Spec Constant 原生配置管理；CHOP 由使用者指定。'
    elif n==151:status,note='部分支援','MAT 具名 sampler 管理目前為 sampler2D；其他種類的原生配置管理尚未擴充，分類不代表已支援。'
    elif n==152:status,note='可沿用機制擴充','3D sampler 的 POffset 配置與快捷尚未納入目前 MAT sampler 管理。'
    elif n in (155,157):status,note='已支援','MAT Vertex Attribute／Matrix Attribute 引用與 Array Size；安裝版沒有 Size 參數時固定 1。跨 vertexIndex 讀取尚未提供入口。'
    elif n==156:status,note='可沿用機制擴充','已可引用具名 Attribute；SOP／POP 特有的 texture-layer accessor 尚未提供專用入口。'
    elif 158<=n<=160:status,note='已支援','POP Buffer 共用配置、雙索引、取值／Length／Array Size；不代建 POP。'
    elif n==166:status,note='沿用欄位來源','環境燈 buffer 透過 shCoeffs accessor；此宏不另作一般值來源。'
    elif row['menu_role'] in ('運算／資源操作','運算／宿主操作'):status,note='非來源','運算／取樣／宿主操作，維持對應運算功能範圍；不以來源清單新增入口冒充實作。'
    elif row['menu_role'] in ('編譯條件','可寫資源','輸出／可寫資料','歷史／輸出／拼字對照','未支援 stage 的來源'):status,note='本輪不適用','條件、可寫資料、歷史對照或未支援 Stage；詳見原始 scope／note，不作唯讀來源。'
    elif 187<=n<=191:status,note='原生／後端對照','TD accessor 與 GLSL 後端名稱不能直接互換；保留研究，不新增通用別名。'
    elif n in (192,197):status,note='可沿用機制擴充','Primitive ID／Sample Mask 需先確認本機渲染與陣列界線，尚未加入已驗證來源。'
    else:raise RuntimeError('Unreviewed inventory row: '+row['id'])
    row.update(implementation=status,implementation_note=note)
with path.open('w',encoding='utf-8',newline='') as stream:
    writer=csv.DictWriter(stream,fieldnames=fields,lineterminator='\n');writer.writeheader();writer.writerows(rows)
print(dict(Counter(row['implementation'] for row in rows)))
