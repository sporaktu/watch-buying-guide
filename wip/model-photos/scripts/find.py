import json,re,subprocess,sys,os,io,html,concurrent.futures as cf
from urllib.parse import urljoin,urlparse
from PIL import Image
S=json.load(open('/tmp/mg/state.json'));L=json.load(open('/tmp/mg/links.json'))
OUT='/tmp/mg/find.json';R=json.load(open(OUT)) if os.path.exists(OUT) else {}
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
def get(u,t=25,binary=False):
    try:
        p=subprocess.run(['curl','-sL','--compressed','-m',str(t),'-A',UA,'-H','Accept-Language: en-US,en;q=0.9','-H','Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',u],capture_output=True,timeout=t+5)
        return p.stdout if binary else p.stdout.decode('utf8','replace')
    except Exception as e: return b'' if binary else ''
STOP={'the','and','de','of','series','collection','watch','automatic','ref','model','limited','editions','edition'}
def norm(s):
    s=s.lower().replace('é','e').replace('è','e').replace('ü','u').replace('º','').replace('²','2').replace('ä','a').replace('ö','o')
    return re.sub(r'[^a-z0-9]+',' ',s).strip()
def toks(name,brand):
    base=re.sub(r'\(.*?\)','',name); base=base.split('/')[0]
    bt=set(norm(brand).split())
    t=[w for w in norm(base).split() if w not in STOP and w not in bt]
    return t or norm(base).split()
BAD=re.compile(r'strap|bracelet|buckle|clasp|\bband\b|nato|tool|pouch|roll|case\b|box|gift|card|book|cap\b|shirt|sweater|poster|bezel insert|spring ?bar|deposit|warranty|service|sticker|pin\b',re.I)
def score(tk,text):
    w=set(norm(text).split()); joined=norm(text).replace(' ','')
    hit=sum(1 for t in tk if t in w or (len(t)>3 and t in joined))
    return hit/len(tk)
def shopify(site):
    base='{0.scheme}://{0.netloc}'.format(urlparse(site)); prods=[]
    for pg in range(1,6):
        t=get(base+'/products.json?limit=250&page=%d'%pg)
        try: j=json.loads(t)['products']
        except Exception: break
        prods+=j
        if len(j)<250: break
    return base,prods
def sitemap_urls(site):
    base='{0.scheme}://{0.netloc}'.format(urlparse(site)); seen=set(); urls=[]; q=[base+'/sitemap.xml',base+'/sitemap_index.xml']
    rb=get(base+'/robots.txt',10)
    q+=re.findall(r'(?im)^sitemap:\s*(\S+)',rb)
    n=0
    while q and n<25:
        u=q.pop(0)
        if u in seen: continue
        seen.add(u);n+=1;t=get(u,30)
        locs=[html.unescape(x) for x in re.findall(r'<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</loc>',t)]
        if '<sitemapindex' in t:
            locs.sort(key=lambda x:(0 if re.search(r'product|watch|en[-_/.]|us',x,re.I) else 1, 1 if re.search(r'blog|news|image|video|store|/(fr|de|it|es|ja|zh|ko|ru|pt)[-_/]',x,re.I) else 0))
            q=locs[:14]+q
        else: urls+=locs
    return urls
def og(page):
    t=get(page)
    if not t: return None,None
    title=(re.search(r'<title[^>]*>(.*?)</title>',t,re.S) or [None,''])[1].strip()[:90]
    for pat in [r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',r'"image"\s*:\s*\[?\s*"(https?:[^"]+)"',r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)']:
        m=re.search(pat,t)
        if m: return urljoin(page,html.unescape(m.group(1)).replace('\\/','/')),html.unescape(title)
    return None,html.unescape(title)
def save(img,key):
    u=img if img.startswith('http') else 'https:'+img
    if 'cdn.shopify' in u or '/cdn/shop/' in u: u=re.sub(r'\?.*','',u)+'?width=800'
    b=get(u,40,True)
    try:
        im=Image.open(io.BytesIO(b));im.load()
    except Exception as e: return None
    if im.mode in('RGBA','LA','P'):
        im=im.convert('RGBA');bg=Image.new('RGBA',im.size,(255,255,255,255));bg.alpha_composite(im);im=bg
    im=im.convert('RGB')
    if im.width<150: return None
    f='/tmp/mg/cand/'+re.sub(r'[^A-Za-z0-9]+','_',key)+'.jpg';im.thumbnail((800,800));im.save(f,'JPEG',quality=88);return f
def brand_job(b,items):
    res={}
    site=(L.get(b) or {}).get('site')
    if not site:
        for i,e in items: res[b+'|%d'%i]={'status':'nosite'}
        return res
    base,prods=shopify(site); urls=None
    for i,e in items:
        k=b+'|%d'%i; tk=toks(e['name'],b); r={'status':'nolink','tk':tk}
        if e.get('url') and urlparse(e['url']).path.strip('/') and not re.search(r'/collections?/?$',e['url']):
            r['given']=e['url']
        if prods:
            c=[(score(tk,p['title']+' '+p['handle']),p) for p in prods if p.get('images') and not BAD.search(p['title'])]
            c=[x for x in c if x[0]>=0.99]
            if c:
                c.sort(key=lambda x:(0 if re.search('watch',x[1].get('product_type','')+' '.join(x[1].get('tags',[])) ,re.I) else 1,len(x[1]['title'])))
                p=c[0][1]; r.update(status='ok',method='shopify',page=base+'/products/'+p['handle'],img=p['images'][0]['src'],title=p['title'],ncand=len(c))
        if r['status']!='ok':
            if urls is None and not prods: urls=sitemap_urls(site)
            cand=[]
            for u in (urls or []):
                path=urlparse(u).path
                if BAD.search(path): continue
                s=score(tk,path)
                if s>=0.99: cand.append(u)
            cand.sort(key=lambda u:(1 if re.search(r'/(fr|de|it|es|ja|jp|zh|cn|ko|ru|pt|nl)([-_][a-z]{2})?/',u,re.I) else 0, 0 if re.search(r'product|watch|collection',u,re.I) else 1, len(u)))
            pages=([r['given']] if r.get('given') else [])+cand[:3]
            r['ncand']=len(cand)
            for pg in pages:
                img,title=og(pg)
                if img and not re.search(r'logo|favicon|placeholder|default',img,re.I):
                    r.update(status='ok',method='og',page=pg,img=img,title=title);break
            else:
                if pages: r['status']='noog';r['page']=pages[0]
                elif not prods and not urls: r['status']='nositemap'
        if r['status']=='ok':
            f=save(r['img'],k)
            if f: r['file']=f
            else: r['status']='imgfail'
        res[k]=r
    return res
by={}
only=set(sys.argv[1:])
for k,e in S.items():
    if e.get('pic') or (k in R and R[k].get('file')): continue
    if only and e['brand'] not in only: continue
    by.setdefault(e['brand'],[]).append((e['i'],e))
with cf.ThreadPoolExecutor(16) as ex:
    futs={ex.submit(brand_job,b,it):b for b,it in by.items()}
    for f in cf.as_completed(futs):
        b=futs[f]
        try: r=f.result()
        except Exception as e: print('EXC',b,repr(e)[:100]);continue
        R.update(r);print(b,'|',' '.join('%s:%s'%(k.split('|')[1],v['status']+('/'+v.get('method','') if v.get('method') else '')+('(%d)'%v['ncand'] if 'ncand' in v else '')) for k,v in r.items()),flush=True)
        json.dump(R,open(OUT,'w'),ensure_ascii=False,indent=0)
st={}
for v in R.values(): st[v['status']]=st.get(v['status'],0)+1
print(st)
