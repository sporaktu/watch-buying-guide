import json,re,sys,concurrent.futures as cf,urllib.request,ssl
from urllib.parse import urlparse
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
a=open('/home/user/watch-buying-guide/site/app.js').read()
L=json.loads(re.search(r'const LINKS = (\{.*?\});\n',a,re.S).group(1))
rec=[l.split(' | ')[0] for l in open(S+'rec.txt').read().split('\n')]
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
def get(u,t=20):
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t)
    return r.status,r.geturl(),r.read(400000)
def probe(b):
    site=L.get(b,{}).get('site','')
    if not site: return b,'nosite',''
    u=urlparse(site); base=f'{u.scheme}://{u.hostname}'
    try:
        st,fin,body=get(base+'/')
    except Exception as e: return b,'ERR '+str(e)[:60],base
    shop=b'Shopify' in body or b'cdn.shopify' in body
    return b,f'{st} shopify={shop} final={urlparse(fin).hostname}',base
with cf.ThreadPoolExecutor(16) as ex:
    R=list(ex.map(probe,rec))
json.dump(R,open(S+'probe.json','w'))
for r in R: print(r[0],'|',r[1])
