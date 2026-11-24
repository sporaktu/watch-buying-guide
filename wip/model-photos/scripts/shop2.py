import json,re,subprocess,time,io,os,concurrent.futures as cf
from urllib.parse import urlparse
from PIL import Image
S=json.load(open('/tmp/mg/state.json'));L=json.load(open('/tmp/mg/links.json'));R=json.load(open('/tmp/mg/find.json'))
OUT='/tmp/mg/shop2.json';O={}
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
def get(u,binary=False):
    for a in range(5):
        p=subprocess.run(['curl','-sL','--compressed','-m','40','-A',UA,'-w','\n%{http_code}',u],capture_output=True)
        body,_,code=p.stdout.rpartition(b'\n')
        if code==b'429': time.sleep(20*(a+1));continue
        time.sleep(1.5)
        return body if binary else body.decode('utf8','replace')
    return b'' if binary else ''
STOP={'the','and','de','of','series','collection','watch','automatic','ref','model','limited','editions','edition'}
def norm(s):
    for a,b in [('é','e'),('è','e'),('ü','u'),('º',''),('²','2'),('ä','a'),('ö','o')]: s=s.lower().replace(a,b)
    return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
def toks(name,brand):
    base=re.sub(r'\(.*?\)','',name).split('/')[0]; bt=set(norm(brand).split())
    t=[w for w in norm(base).split() if w not in STOP and w not in bt]
    return t or norm(base).split()
BAD=re.compile(r'strap|bracelet|buckle|clasp|\bband\b|nato|tool|pouch|\broll\b|\bbox\b|gift|card|book|\bcap\b|shirt|sweater|crewneck|poster|insert|spring ?bar|deposit|warranty|service|sticker|\bpin\b|instructions|manual|\bhat\b|tee\b|print\b|keychain|loupe|tray|glasses|sunglass|driving|gloves',re.I)
def score(tk,text):
    w=set(norm(text).split());j=norm(text).replace(' ','')
    return sum(1 for t in tk if t in w or (len(t)>3 and t in j))/len(tk)
def job(b,items):
    base='{0.scheme}://{0.netloc}'.format(urlparse(L[b]['site']));prods=[]
    for pg in range(1,5):
        try: j=json.loads(get(base+'/products.json?limit=250&page=%d'%pg))['products']
        except Exception: break
        prods+=j
        if len(j)<250: break
    res={}
    for i,e in items:
        k='%s|%d'%(b,i);tk=toks(e['name'],b)
        c=[p for p in prods if p.get('images') and not BAD.search(p['title']+' '+p.get('product_type','')) and score(tk,p['title']+' '+p['handle'])>=0.99]
        if not c: res[k]={'status':'none','n':len(prods),'tk':tk};continue
        def price(p):
            try: return max(float(v['price']) for v in p['variants'])
            except Exception: return 0
        c.sort(key=lambda p:(0 if price(p)>=150 else 1,len(p['title'])))
        p=c[0];u=re.sub(r'\?.*','',p['images'][0]['src'])+'?width=800'
        try:
            im=Image.open(io.BytesIO(get(u,True)));im.load()
            if im.mode in('RGBA','LA','P'):
                im=im.convert('RGBA');bg=Image.new('RGBA',im.size,(255,255,255,255));bg.alpha_composite(im);im=bg
            f='/tmp/mg/cand2/'+re.sub(r'[^A-Za-z0-9]+','_',k)+'.jpg';im.convert('RGB').save(f,'JPEG',quality=88)
            res[k]={'status':'ok','file':f,'page':base+'/products/'+p['handle'],'title':p['title'],'img':u,'ncand':len(c)}
        except Exception as ex: res[k]={'status':'imgfail','err':str(ex)[:60]}
    return res
by={}
for k,e in S.items():
    if e.get('pic') or not L.get(e['brand'],{}).get('site'): continue
    by.setdefault(e['brand'],[]).append((e['i'],e))
with cf.ThreadPoolExecutor(30) as ex:
    fs={ex.submit(job,b,it):b for b,it in by.items()}
    for f in cf.as_completed(fs):
        b=fs[f]
        try:r=f.result()
        except Exception as e: print('EXC',b,repr(e)[:80]);continue
        O.update(r)
        n=next(iter(r.values())).get('n')
        if any(v['status']=='ok' for v in r.values()) or (n or 0)>0: print(b,'|',' ; '.join('%s:%s %s'%(k.split('|')[1],v['status'],(v.get('title') or '')[:38]) for k,v in r.items()),flush=True)
        json.dump(O,open(OUT,'w'),ensure_ascii=False,indent=0)
print(sum(1 for v in O.values() if v['status']=='ok'),'ok of',len(O))
