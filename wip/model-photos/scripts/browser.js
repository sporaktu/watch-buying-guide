const {chromium}=require('playwright');const fs=require('fs');
const S=require('path').join(process.env.WORKDIR||'.','/');
const src=fs.readFileSync('/home/user/watch-buying-guide/site/models.js','utf8');const M=JSON.parse(src.slice(src.indexOf('{'),src.lastIndexOf('}')+1));
const SH=JSON.parse(fs.readFileSync(S+'shop_final.json'));const G=JSON.parse(fs.readFileSync(S+'gen.json'));
const have=new Set([...Object.values(SH),...Object.values(G)].filter(v=>v.pic).map(v=>v.brand+'|'+v.model));
const app=fs.readFileSync('/home/user/watch-buying-guide/site/app.js','utf8');const L=JSON.parse(app.match(/const LINKS = (\{.*?\});\n/s)[1]);
const STOP=new Set(['the','watch','watches','series','and','of','limited','editions','edition','model','no','collection']);
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ');
function base(b){const s=(L[b]||{}).site;if(!s)return null;const u=new URL(s);let h=u.hostname;if(!h.startsWith('www.')&&h.split('.').length==2)h='www.'+h;return 'https://'+h;}
const out={};
(async()=>{const br=await chromium.launch();
 const brands=Object.keys(M).filter(b=>M[b].some(m=>!have.has(b+'|'+m.name)));
 const work=async b=>{const B=base(b);const ctx=await br.newContext({viewport:{width:1280,height:1000},userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',locale:'en-US'});const p=await ctx.newPage();
  const todo=M[b].map((m,i)=>[i,m]).filter(([i,m])=>!have.has(b+'|'+m.name));
  if(!B){todo.forEach(([i,m])=>out[b+'|'+i]={brand:b,model:m.name,status:'nosite'});await ctx.close();return;}
  const links=new Map();
  for(const path of ['/','/en','/en-us','/us','/watches','/en/watches','/en-us/watches','/collections/all']){
   try{await p.goto(B+path,{timeout:25000,waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
    const as=await p.$$eval('a[href]',a=>a.map(x=>[x.href,x.textContent.trim().slice(0,120)]));
    for(const [h,t] of as){try{const u=new URL(h);if(u.hostname.replace('www.','')==new URL(B).hostname.replace('www.',''))if(!links.has(u.origin+u.pathname))links.set(u.origin+u.pathname,norm(t));}catch(e){}}
   }catch(e){}
  }
  for(const [i,m] of todo){
   const w=norm(m.name).split(' ').filter(x=>x.length>1&&!STOP.has(x));
   const sc=u=>w.filter(x=>new RegExp('\\b'+x+'\\b').test(norm(u.replace(/[-_/]/g,' '))+' '+links.get(u))).length;
   const cand=[...links.keys()].sort((a,c)=>sc(c)-sc(a)||a.length-c.length)[0];
   if(!cand||!w.length||sc(cand)<Math.max(1,Math.ceil(w.length/2))){out[b+'|'+i]={brand:b,model:m.name,status:'nolink'};continue;}
   try{await p.goto(cand,{timeout:30000,waitUntil:'domcontentloaded'});await p.waitForTimeout(3500);
    const h=await p.evaluateHandle(()=>{let best=null,ba=0;for(const im of document.images){const r=im.getBoundingClientRect();if(!im.complete||!im.naturalWidth)continue;const a=Math.min(r.width,800)*Math.min(r.height,800);const s=(im.currentSrc+im.alt).toLowerCase();if(/logo|icon|flag|payment|badge/.test(s))continue;if(r.width<150||r.height<150||r.top>2500)continue;if(a>ba){ba=a;best=im;}}return best;});
    const el=h.asElement();
    if(!el){out[b+'|'+i]={brand:b,model:m.name,status:'noimg',page:p.url()};continue;}
    await el.scrollIntoViewIfNeeded();const f='br-'+b.replace(/\W+/g,'_')+'-'+i+'.png';await el.screenshot({path:S+'pics/raw/'+f,timeout:10000});
    out[b+'|'+i]={brand:b,model:m.name,status:'ok',page:p.url(),raw:f,title:(await p.title()).slice(0,80)};
   }catch(e){out[b+'|'+i]={brand:b,model:m.name,status:'ERR '+String(e).slice(0,60),page:cand};}
  }
  await ctx.close();};
 const q=[...brands];await Promise.all(Array.from({length:6},async()=>{while(q.length){const b=q.shift();try{await work(b);}catch(e){}}}));
 fs.writeFileSync(S+'browser.json',JSON.stringify(out,null,0));
 const c={};Object.values(out).forEach(v=>c[v.status.slice(0,8)]=(c[v.status.slice(0,8)]||0)+1);console.log(c);await br.close();})();
