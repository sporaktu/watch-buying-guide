import json,re,sys,io,concurrent.futures as cf,urllib.request
from PIL import Image,ImageDraw,ImageFont
import os; S=os.path.join(os.environ.get('WORKDIR','.'),'')
F=sys.argv[1]; D=json.load(open(S+F))
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower().replace('²','2').replace('ü','u').replace('é','e').replace('è','e')).strip('-')
def fetch(k):
    v=D[k]
    if v.get('status')!='ok': return k,None
    u=v['img']; u=u if u.startswith('http') else 'https:'+u
    if 'cdn.shopify' in u or '/cdn/shop/' in u: u=re.sub(r'\?.*','',u)+'?width=600'
    try:
        b=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30).read(15_000_000)
        im=Image.open(io.BytesIO(b)); im.load()
        if im.mode in ('RGBA','LA','P'):
            im=im.convert('RGBA'); bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im); im=bg
        im=im.convert('RGB'); im.thumbnail((240,240),Image.LANCZOS)
        c=Image.new('RGB',(240,240),(255,255,255)); c.paste(im,((240-im.width)//2,(240-im.height)//2))
        name=f"m-{slug(v['brand'])}-{slug(v['model'])}.jpg"
        c.save(S+'pics/'+name,'JPEG',quality=82,optimize=True,progressive=True)
        return k,name
    except Exception as e:
        return k,'ERR '+str(e)[:60]
with cf.ThreadPoolExecutor(12) as ex: R=dict(ex.map(fetch,D))
for k,n in R.items():
    if n and not n.startswith('ERR'): D[k]['pic']=n
    elif n: D[k]['status']=n
json.dump(D,open(S+F,'w'),ensure_ascii=False,indent=0)
got=[k for k in D if D[k].get('pic')]
print('saved',len(got),'errors',[ (k,R[k]) for k in R if R[k] and R[k].startswith('ERR')])
# contact sheet
cols=8; W=240; H=290; rows=(len(got)+cols-1)//cols
sheet=Image.new('RGB',(cols*W,rows*H),(240,240,240)); d=ImageDraw.Draw(sheet)
for i,k in enumerate(got):
    x,y=(i%cols)*W,(i//cols)*H; sheet.paste(Image.open(S+'pics/'+D[k]['pic']),(x,y))
    d.text((x+4,y+244),(D[k]['brand'][:30]),fill=(0,0,0)); d.text((x+4,y+258),D[k]['model'][:34],fill=(0,0,180)); d.text((x+4,y+272),(D[k].get('title') or '')[:34],fill=(120,0,0))
sheet.save(S+F.replace('.json','_sheet.jpg'),quality=70)
