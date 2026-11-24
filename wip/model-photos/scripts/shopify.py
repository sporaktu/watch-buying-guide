import json,re,sys,concurrent.futures as cf,urllib.request,urllib.parse,io
from urllib.parse import urlparse
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
P=json.load(open(S+'probe.json'))
src=open('/home/user/watch-buying-guide/site/models.js').read()
M=json.loads(src[src.index('{'):src.rindex('}')+1])
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json,text/html,*/*'}
def get(u,t=25):
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t); return r.read(3_000_000)
shop={b:base for b,st,base in P if 'shopify=True' in st}
fin={b:'https://'+re.search(r'final=(\S+)',st).group(1) for b,st,base in P if 'shopify=True' in st}
def norm(s): return re.sub(r'[^a-z0-9 ]',' ',s.lower())
def find(b,m):
    base=fin[b]; q=urllib.parse.quote(m['name'])
    try:
        d=json.loads(get(f"{base}/search/suggest.json?q={q}&resources[type]=product&resources[limit]=5"))
        prods=d['resources']['results']['products']
    except Exception as e: return None,'ERR '+str(e)[:50]
    if not prods: return None,'none'
    words=[w for w in norm(m['name']).split() if len(w)>1]
    best=max(prods,key=lambda p:sum(w in norm(p.get('title','')) for w in words))
    img=best.get('image') or (best.get('featured_image') or {}).get('url')
    if not img: return None,'noimg'
    if img.startswith('//'): img='https:'+img
    return {'img':img,'page':base+best.get('url','').split('?')[0],'title':best.get('title')},'ok'
jobs=[(b,i,m) for b in shop for i,m in enumerate(M.get(b,[]))]
out={}
with cf.ThreadPoolExecutor(12) as ex:
    for (b,i,m),(r,st) in zip(jobs,ex.map(lambda j:find(j[0],j[2]),jobs)):
        out[f'{b}|{i}']={'brand':b,'model':m['name'],'status':st,**(r or {})}
json.dump(out,open(S+'shopify.json','w'),ensure_ascii=False,indent=0)
ok=sum(v['status']=='ok' for v in out.values()); print(len(jobs),'lines,',ok,'found')
for v in out.values(): print(v['brand'],'|',v['model'],'|',v['status'],'|',v.get('title',''))
