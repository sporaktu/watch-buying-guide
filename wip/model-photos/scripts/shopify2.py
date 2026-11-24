import json,re,concurrent.futures as cf,urllib.request
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
P=json.load(open(S+'probe.json'))
src=open('/home/user/watch-buying-guide/site/models.js').read()
M=json.loads(src[src.index('{'):src.rindex('}')+1])
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json'}
def get(u,t=30): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t).read(20_000_000)
fin={b:'https://'+re.search(r'final=(\S+)',st).group(1) for b,st,base in P if 'shopify=True' in st}
BAD=re.compile(r'strap|bracelet\b(?!.*watch)|spring ?bar|screw ?bar|\bkit\b|compass|gift card|tool|pouch|case\b(?!.*watch)|roll|box|service|battery|nato|rubber|leather|sticker|apparel|shirt|hat|cap\b|buckle|clasp|link',re.I)
def norm(s): return re.sub(r'[^a-z0-9 ]',' ',s.lower())
STOP={'the','watch','series','and','of','limited','editions','edition','model','no'}
def load(b):
    prods=[]
    for page in range(1,6):
        try: d=json.loads(get(f"{fin[b]}/products.json?limit=250&page={page}"))
        except Exception as e: return b,prods,str(e)[:60]
        if not d.get('products'): break
        prods+=d['products']
    return b,prods,'ok'
with cf.ThreadPoolExecutor(12) as ex: R=list(ex.map(load,fin))
out={}
for b,prods,st in R:
    prods=[p for p in prods if p.get('images') and not BAD.search(p['title']+' '+(p.get('product_type') or ''))]
    used=set()
    for i,m in enumerate(M.get(b,[])):
        words=[w for w in norm(m['name']).split() if w not in STOP and len(w)>1]
        def score(p):
            t=norm(p['title']+' '+p.get('handle','').replace('-',' '))
            return sum(1 for w in words if re.search(r'\b'+re.escape(w)+r'\b',t))
        cands=sorted(prods,key=lambda p:(-score(p),p['id'] in used))
        best=cands[0] if cands and words and score(cands[0])>=max(1,len(words)//2+ (1 if len(words)>=3 else 0)) else None
        if best: used.add(best['id'])
        out[f'{b}|{i}']={'brand':b,'model':m['name'],'status':'ok' if best else ('none' if st=='ok' else 'ERR '+st),
          **({'img':best['images'][0]['src'],'page':f"{fin[b]}/products/{best['handle']}",'title':best['title']} if best else {})}
json.dump(out,open(S+'shopify.json','w'),ensure_ascii=False,indent=0)
print(sum(v['status']=='ok' for v in out.values()),'of',len(out))
for v in out.values(): print(v['brand'],'|',v['model'],'|',v['status'],'|',v.get('title',''))
