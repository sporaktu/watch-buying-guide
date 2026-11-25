import json,re,os,io,subprocess,glob
from urllib.parse import urlparse
from PIL import Image
S=json.load(open('/tmp/mg/state.json'));L=json.load(open('/tmp/mg/links.json'))
OUT='/tmp/mg/pj.json';O=json.load(open(OUT)) if os.path.exists(OUT) else {}
STOP={'the','and','de','of','series','collection','watch','automatic','ref','model','limited','editions','edition'}
def norm(s):
    s=s.lower()
    for a,b in [('é','e'),('è','e'),('ü','u'),('º',''),('²','2'),('ä','a'),('ö','o')]: s=s.replace(a,b)
    return re.sub(r'[^a-z0-9]+',' ',s).strip()
def toks(name,brand):
    base=re.sub(r'\(.*?\)','',name).split('/')[0];bt=set(norm(brand).split())
    t=[w for w in norm(base).split() if w not in STOP and w not in bt]
    return t or norm(base).split()
BAD=re.compile(r'strap|bracelet|buckle|clasp|\bband\b|nato|tool|pouch|\broll\b|\bbox\b|gift|card|book|\bcap\b|shirt|sweater|crewneck|poster|insert|spring ?bar|deposit|warranty|service|sticker|\bpin\b|instructions|manual|\bhat\b|tee\b|print\b|keychain|loupe|tray|glass|driving|gloves|mesh|rubber|leather|bezel$|part|coming soon',re.I)
def score(tk,text):
    w=set(norm(text).split());j=norm(text).replace(' ','')
    return sum(1 for t in tk if t in w or (len(t)>3 and t in j))/len(tk)
def price(p):
    try: return max(float(v['price']) for v in p['variants'])
    except Exception: return 0
for f in glob.glob('/tmp/mg/pj/*.json'):
    prods=json.load(open(f))
    if not prods: continue
    key=os.path.basename(f)[:-5]
    for k,e in S.items():
        if e.get('pub') or re.sub(r'[^A-Za-z0-9]+','_',e['brand'])!=key or (k in O and O[k].get('file')): continue
        b=e['brand'];tk=toks(e['name'],b);base='{0.scheme}://{0.netloc}'.format(urlparse(L[b]['site']))
        c=[p for p in prods if p.get('images') and price(p)>=120 and not BAD.search(p['title']+' '+p.get('product_type','')) and score(tk,p['title']+' '+p['handle'])>=0.99]
        if not c: O[k]={'status':'none','tk':tk,'n':len(prods)};print(k,'none',tk,len(prods));continue
        c.sort(key=lambda p:len(p['title']));p=c[0];u=re.sub(r'\?.*','',p['images'][0]['src'])+'?width=800'
        fn='/tmp/mg/cand4/'+re.sub(r'[^A-Za-z0-9]+','_',k)+'.img'
        subprocess.run(['curl','-sL','-m','40','-o',fn,u])
        try: Image.open(fn).load();O[k]={'status':'ok','file':fn,'page':base+'/products/'+p['handle'],'title':p['title'],'img':u};print(k,'ok',p['title'][:50])
        except Exception as ex: O[k]={'status':'imgfail'};print(k,'imgfail')
json.dump(O,open(OUT,'w'),ensure_ascii=False,indent=0)
