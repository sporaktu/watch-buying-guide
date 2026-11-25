import json,re,subprocess,os
from PIL import Image
S=json.load(open('/tmp/mg/state.json'))
def key(b,name):
    for k,e in S.items():
        if e['brand']==b and e['name'].lower().startswith(name.lower()): return k
    raise SystemExit('no key '+b+' '+name)
M=[('Studio Underd0g','01SERIES','Studio_Underd0g',r'^Watermel0n \(Gen3\)$',0),('Studio Underd0g','02SERIES','Studio_Underd0g',r'^Pink Lem0nade \(Gen2\)$',0),('Studio Underd0g','03SERIES','Studio_Underd0g',r'^Salm0n$',0),('Studio Underd0g','04SERIES','Studio_Underd0g',r'^Cloud10$',0),
('Ollech & Wajs','Early Bird','Ollech_Wajs',r'^OW EARLY BIRD$',0),('Ollech & Wajs','M-Series','Ollech_Wajs',r'^OW MK-102$',0),
('Traska','Freediver','Traska',r'^Freediver Carbon Black$',0),('Traska','Commuter','Traska',r'^Commuter 36 Adriatic Blue$',0),('Traska','Summiteer','Traska',r'^Summiteer 36 Pine Green$',0),
('Halios','Fairwind','Halios',r'^FAIRWIND II$',1),('Vulcain','Skindiver','Vulcain',r'^Skindiver Mark II - Black$',0),('Orient','Sun and Moon','Orient',r'^AK00 Version 3$',0),('Orient Star','Contemporary','Orient',r'^Contemporary Semi Skeleton$',0),('Zelos','Swordfish','Zelos',r"^Swordfish 40mm SS 'Coal'$",0)]
O={}
for b,name,f,rx,ix in M:
    k=key(b,name);P=json.load(open('/tmp/mg/pj/'+f+'.json'))
    c=[p for p in P if re.search(rx,p['title']) and p.get('images')]
    if not c: print(k,'NOMATCH',rx);continue
    p=c[0];u=re.sub(r'\?.*','',p['images'][min(ix,len(p['images'])-1)]['src'])+'?width=800'
    fn='/tmp/mg/cand4/M_'+re.sub(r'[^A-Za-z0-9]+','_',k)+'.img'
    subprocess.run(['curl','-sL','-m','40','-o',fn,u])
    try: Image.open(fn).load();O[k]={'status':'ok','file':fn,'title':p['title'],'img':u};print(k,'ok',p['title'])
    except Exception as ex: print(k,'imgfail',u)
json.dump(O,open('/tmp/mg/manual.json','w'),ensure_ascii=False)
