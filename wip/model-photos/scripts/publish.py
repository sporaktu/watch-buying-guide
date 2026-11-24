import json,re,os,sys
from PIL import Image
S=json.load(open('/tmp/mg/state.json'));D=json.load(open('/tmp/mg/decisions.json'))
srcs={}
for f in ['/tmp/mg/find.json','/tmp/mg/shop2.json','/tmp/mg/extra.json']:
    if os.path.exists(f):
        for k,v in json.load(open(f)).items():
            if v.get('file'): srcs.setdefault(k,{})[os.path.basename(f).split('.')[0]]=v['file']
W='wip/model-photos/'
def slug(s):
    for a,b in [('²','2'),('ü','u'),('é','e'),('è','e'),('º',''),('∞','infinity')]: s=s.lower().replace(a,b)
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def fit(src,dst,mode):
    im=Image.open(src)
    if im.mode in('RGBA','LA','P'):
        im=im.convert('RGBA');bg=Image.new('RGBA',im.size,(255,255,255,255));bg.alpha_composite(im);im=bg
    im=im.convert('RGB');w,h=im.size
    if mode=='crop' or (mode=='auto' and w>h*1.15):
        s=min(w,h);im=im.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s))
    elif mode=='trim':
        from PIL import ImageChops
        bb=ImageChops.difference(im,Image.new('RGB',im.size,im.getpixel((2,2)))).convert('L').point(lambda p:255 if p>18 else 0).getbbox()
        if bb:
            pad=int(max(bb[2]-bb[0],bb[3]-bb[1])*0.08);im=im.crop((max(0,bb[0]-pad),max(0,bb[1]-pad),min(w,bb[2]+pad),min(h,bb[3]+pad)))
    im.thumbnail((240,240),Image.LANCZOS);c=Image.new('RGB',(240,240),(255,255,255));c.paste(im,((240-im.width)//2,(240-im.height)//2))
    c.save(dst,'JPEG',quality=82,optimize=True,progressive=True)
plan={}
for k,e in S.items():
    if e.get('pic'): plan[k]=(W+'pics/'+e['pic'],'keep')
byname={(e['brand'],e['name']):k for k,e in S.items()}
new={}
for d in D:
    k=byname.get((d[0],d[1]))
    if not k: print('NO MATCH',d);continue
    src=d[2];mode=d[3] if len(d)>3 else 'auto'
    if src=='raw': f=W+'raw/'+S[k]['raw']
    elif src=='drop': plan.pop(k,None);continue
    else: f=srcs.get(k,{}).get(src)
    if not f or not os.path.exists(f): print('NO FILE',d);continue
    plan[k]=(f,mode);new[k]=1
lines=open('site/models.js',encoding='utf8').read().split('\n');out=[];used={};pubnew={}
for ln in lines:
    m=re.match(r'^("(?:[^"\\]|\\.)*"):(\[.*\])(,?)$',ln)
    if not m: out.append(ln);continue
    b=json.loads(m.group(1));arr=json.loads(m.group(2))
    assert json.dumps(arr,ensure_ascii=False)==m.group(2) or any('pic' in x for x in arr),b
    for i,x in enumerate(arr):
        k='%s|%d'%(b,i);x.pop('pic',None)
        if k in plan:
            name='m-%s-%s.jpg'%(slug(b),slug(x['name']));assert name not in used,name;used[name]=k
            src,mode=plan[k];dst='site/img/'+name
            if mode=='keep':
                open(dst,'wb').write(open(src,'rb').read())
            else: fit(src,dst,mode)
            x['pic']='img/'+name
            if k in new: pubnew[k]={'file':dst}
    out.append(m.group(1)+':'+json.dumps(arr,ensure_ascii=False)+m.group(3))
open('site/models.js','w',encoding='utf8').write('\n'.join(out))
for f in os.listdir('site/img'):
    if f.startswith('m-') and f not in used: os.remove('site/img/'+f)
json.dump(pubnew,open('/tmp/mg/published_new.json','w'))
print('published',len(used),'of',len(S),'new this run',len(pubnew))
