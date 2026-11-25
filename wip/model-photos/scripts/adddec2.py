import json,sys
# usage: adddec2.py <ok.json> <auto idx csv> [crop idx csv] ; idx = position in the json's key order
S=json.load(open('/tmp/mg/state.json'));D=json.load(open('/tmp/mg/decisions.json'));O=json.load(open(sys.argv[1]));ks=list(O)
auto=[int(x) for x in sys.argv[2].split(',') if x];crop=[int(x) for x in (sys.argv[3] if len(sys.argv)>3 else '').split(',') if x]
last={}
for i in auto+crop:
    k=ks[i];d=[S[k]['brand'],S[k]['name'],O[k]['file']]
    if i in crop: d.append('crop')
    D.append(d);n='m-'+k
    last[k]={'file':O[k]['file']}
json.dump(D,open('/tmp/mg/decisions.json','w'),ensure_ascii=False);print(len(D),'decisions, added',len(last))
# sheet of processed results is produced after publish from published paths
import re
def slug(s):
    for a,b in [('²','2'),('ü','u'),('é','e'),('è','e'),('º',''),('∞','infinity')]: s=s.lower().replace(a,b)
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
json.dump({k:{'file':'site/img/m-%s-%s.jpg'%(slug(S[k]['brand']),slug(S[k]['name']))} for k in last},open('/tmp/mg/lastadd.json','w'))
