import json,re,html,concurrent.futures as cf,urllib.request
from urllib.parse import urljoin,urlparse
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
P={b:(st,base) for b,st,base in json.load(open(S+'probe.json'))}
src=open('/home/user/watch-buying-guide/site/models.js').read()
M=json.loads(src[src.index('{'):src.rindex('}')+1])
SH=json.load(open(S+'shop_final.json'))
done={(v['brand'],v['model']) for v in SH.values() if v.get('pic')}
a=open('/home/user/watch-buying-guide/site/app.js').read()
L=json.loads(re.search(r'const LINKS = (\{.*?\});\n',a,re.S).group(1))
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'text/html,*/*','Accept-Language':'en-US,en'}
def get(u,t=25):
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t); return r.geturl(),r.read(4_000_000).decode('utf-8','replace')
def norm(s): return re.sub(r'[^a-z0-9 ]',' ',html.unescape(s).lower())
STOP={'the','watch','watches','series','and','of','limited','editions','edition','model','no','collection'}
def base_of(b):
    site=L.get(b,{}).get('site','')
    if not site: return None
    u=urlparse(site); h=u.hostname
    if not h.startswith('www.') and h.count('.')==1: h='www.'+h  # most allowed as www
    return f'https://{h}'
def ogimg(page):
    m=re.search(r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',page) or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',page)
    return html.unescape(m.group(1)) if m else None
def brand(b):
    res={}
    todo=[(i,m) for i,m in enumerate(M[b]) if (b,m['name']) not in done]
    if not todo: return b,res
    base=base_of(b)
    if not base: return b,{i:{'status':'nosite'} for i,_ in todo}
    pages={}
    for p in ['/','/en/','/en-us/','/us/','/collections/all','/watches','/en/watches','/en-us/watches','/sitemap.xml']:
        try: fu,txt=get(base+p); pages[fu]=txt
        except Exception: pass
    links={}
    for fu,txt in pages.items():
        for href,text in re.findall(r'<a[^>]+href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>',txt,re.S):
            links.setdefault(urljoin(fu,href),norm(re.sub('<[^>]+>',' ',text)))
        for loc in re.findall(r'<loc>([^<]+)</loc>',txt): links.setdefault(loc,'')
    host=urlparse(base).hostname.replace('www.','')
    links={u:t for u,t in links.items() if host in (urlparse(u).hostname or '')}
    for i,m in todo:
        w=[x for x in norm(m['name']).split() if x not in STOP and len(x)>1]
        if not w: res[i]={'status':'none'}; continue
        def sc(u): return sum(1 for x in w if re.search(r'\b'+re.escape(x)+r'\b',norm(u.replace('-',' ').replace('/',' '))+' '+links[u]))
        best=sorted(links,key=lambda u:(-sc(u),len(u)))
        if not best or sc(best[0])<max(1,(len(w)+1)//2): res[i]={'status':'nolink'}; continue
        page=best[0]
        try:
            fu,txt=get(page); img=ogimg(txt)
            res[i]={'status':'ok' if img else 'noog','page':fu,'img':urljoin(fu,img) if img else '','title':(re.search(r'<title>(.*?)</title>',txt,re.S) or [None,''])[1].strip()[:80]}
        except Exception as e: res[i]={'status':'ERR '+str(e)[:50],'page':page}
    return b,res
brands=[b for b in M if any((b,m['name']) not in done for m in M[b])]
out={}
with cf.ThreadPoolExecutor(12) as ex:
    for b,res in ex.map(brand,brands):
        for i,r in res.items(): out[f'{b}|{i}']={'brand':b,'model':M[b][i]['name'],**r}
json.dump(out,open(S+'gen.json','w'),ensure_ascii=False,indent=0)
from collections import Counter; print(Counter(v['status'][:12] for v in out.values()))
