import json,re
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
A=json.load(open(S+'shopify_sg.json')); B=json.load(open(S+'shopify_pj.json'))
BAD=re.compile(r'strap|band\b|mesh|spring ?bar|screw ?bar|\bkit\b|compass|gift|tool|pouch|battery|nato|buckle|clasp|table|clock|deposit',re.I)
def norm(s): return re.sub(r'[^a-z0-9 ]',' ',s.lower())
STOP={'the','watch','series','and','of','limited','editions','edition','model','no'}
def sc(model,title):
    w=[x for x in norm(model).split() if x not in STOP and len(x)>1]
    return sum(1 for x in w if re.search(r'\b'+re.escape(x)+r'\b',norm(title)))
out={}
for k in A:
    c=[]
    for v in (A[k],B.get(k,{})):
        if v.get('status')=='ok' and not BAD.search(v.get('title','')): c.append((sc(v['model'],v['title']),v))
    c.sort(key=lambda t:-t[0])
    out[k]=c[0][1] if c and c[0][0]>0 else {**A[k],'status':'none'}
json.dump(out,open(S+'shop_final.json','w'),ensure_ascii=False,indent=0)
print(sum(v['status']=='ok' for v in out.values()),'of',len(out))
