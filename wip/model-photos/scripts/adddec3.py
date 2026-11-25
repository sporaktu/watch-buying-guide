import json,sys,re
# usage: adddec3.py <picks.json>  where picks = [[stateKey, absFile, mode], ...]
S=json.load(open('/tmp/mg/state.json'));D=json.load(open('/tmp/mg/decisions.json'));P=json.load(open(sys.argv[1]))
def slug(s):
    for a,b in [('²','2'),('ü','u'),('é','e'),('è','e'),('º',''),('∞','infinity')]: s=s.lower().replace(a,b)
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
last={}
for k,f,mode in P:
    e=S[k];d=[e['brand'],e['name'],f]
    if mode!='auto': d.append(mode)
    D.append(d);last[k]={'file':'site/img/m-%s-%s.jpg'%(slug(e['brand']),slug(e['name']))}
json.dump(D,open('/tmp/mg/decisions.json','w'),ensure_ascii=False);json.dump(last,open('/tmp/mg/lastadd.json','w'))
print(len(D),'decisions, added',len(last))
