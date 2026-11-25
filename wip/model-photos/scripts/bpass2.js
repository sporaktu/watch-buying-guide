const pptr=require('puppeteer-core'),fs=require('fs'),{execFileSync}=require('child_process');
const S=JSON.parse(fs.readFileSync('/tmp/mg/state.json')),L=JSON.parse(fs.readFileSync('/tmp/mg/links.json'));
const OUT='/tmp/mg/extra2.json';const O=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT)):{};
const SKIP=new Set((process.env.SKIP||'Zelos,Helm,Mr Jones Watches,Brew,Scurfa,Halios,Traska,Autodromo,Isotope,Lorier,Nivada Grenchen,Ollech & Wajs,Orient,Orient Star,Oak & Oscar,Anoma,Vulcain,anOrdain,Kurono Tokyo,Sartory Billard,Studio Underd0g,Smiths').split(','));
const ONLY=process.env.ONLY?new Set(process.env.ONLY.split(',')):null;
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const STOP=new Set(['the','and','de','of','series','collection','watch','automatic','ref','model','limited','editions','edition']);
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/º/g,'').replace(/²/g,'2').replace(/[^a-z0-9]+/g,' ').trim();
const toks=(name,brand)=>{const base=name.replace(/\(.*?\)/g,'').split('/')[0];const bt=new Set(norm(brand).split(' '));const t=norm(base).split(' ').filter(w=>w&&!STOP.has(w)&&!bt.has(w));return t.length?t:norm(base).split(' ');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const by={};for(const [k,e] of Object.entries(S)){if(e.pub||!L[e.brand]||!L[e.brand].site||SKIP.has(e.brand)||(O[k]&&O[k].file))continue;if(process.env.KEYS&&!process.env.KEYS.split(',').includes(k))continue;if(ONLY&&!ONLY.has(e.brand))continue;(by[e.brand]=by[e.brand]||[]).push(e);}
const inPage=(tk,phase)=>{
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const sc=t=>{const n=norm(t),w=new Set(n.split(' ')),j=n.replace(/ /g,'');return tk.filter(x=>w.has(x)||(x.length>3&&j.includes(x))).length/tk.length};
  const bad=/strap|bracelet|buckle|clasp|nato|logo|icon|banner|flag|payment|store|boutique|news|blog|journal|story|stories|career|press|service|warranty|account|cart|login|facebook|instagram|youtube/i;
  if(phase==='links'){
    const c=[];for(const a of document.querySelectorAll('a[href]')){const h=a.href;if(!/^https?:/.test(h)||bad.test(new URL(h).pathname))continue;if(new URL(h).host.replace(/^www\./,'')!==location.host.replace(/^www\./,''))continue;const s=Math.max(sc(new URL(h).pathname),sc(a.textContent.slice(0,80)),sc(a.getAttribute('aria-label')||a.title||''));if(s>=0.99)c.push(h.split('#')[0]);}
    const u=[...new Set(c)].filter(h=>h!==location.href.split('#')[0]);u.sort((a,b)=>(/\/(fr|de|it|es|ja|jp|zh|cn|ko|ru|pt|nl)([-_][a-z]{2})?\//i.test(new URL(a).pathname)-/\/(fr|de|it|es|ja|jp|zh|cn|ko|ru|pt|nl)([-_][a-z]{2})?\//i.test(new URL(b).pathname))||a.length-b.length);return u.slice(0,3);
  }
  const c=[];let i=0;for(const im of document.images){i++;const w=im.naturalWidth,h=im.naturalHeight,r=im.getBoundingClientRect();if(w<300||h<300||r.width<120||r.height<120)continue;const ar=w/h;if(ar>1.7||ar<0.45)continue;const src=im.currentSrc||im.src;if(!/^https?:/.test(src)||/\.svg(\?|$)/i.test(src)||bad.test(src.split('/').pop()))continue;
    if(im.closest('header,nav,footer,[class*="menu" i],[class*="nav" i],[class*="cookie" i],[class*="footer" i]'))continue;
    const a=im.closest('a');const ctx=(im.alt||'')+' '+src+' '+(a?a.href+' '+a.textContent.slice(0,80):'');const m=sc(ctx);
    c.push({src,w,h,m,i,alt:(im.alt||'').slice(0,60),sq:Math.abs(ar-1)<0.35?1:0});}
  c.sort((a,b)=>(b.m-a.m)||(b.sq-a.sq)||(a.i-b.i));return c.slice(0,2);
};
async function grab(pg,src,file){
  try{const b64=await pg.evaluate(async s=>{const r=await fetch(s);if(!r.ok)return '';const b=await r.blob();return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result.split(',')[1]);f.readAsDataURL(b)})},src);if(b64&&b64.length>4000){fs.writeFileSync(file,Buffer.from(b64,'base64'));return true}}catch(e){}
  try{execFileSync('curl',['-sL','-m','30','-A',UA,'-e',pg.url(),'-o',file,src]);return fs.statSync(file).size>3000}catch(e){return false}
}
async function load(pg,u){const rs=await pg.goto(u,{waitUntil:'domcontentloaded',timeout:45000});await sleep(3500);for(let y=0;y<4;y++){await pg.evaluate(()=>window.scrollBy(0,900)).catch(()=>{});await sleep(600)}await pg.evaluate(()=>window.scrollTo(0,0)).catch(()=>{});await sleep(400);return rs?rs.status():0}
async function brand(br,b,items){
  const pg=await br.newPage();await pg.setViewport({width:1400,height:1000});await pg.setUserAgent(UA);await pg.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'webdriver',{get:()=>undefined})});
  for(const e of items){const k=b+'|'+e.i,tk=toks(e.name,b);let r={status:'nolink',tk};
    try{
      const starts=[];if(e.url&&new URL(e.url).pathname.length>1)starts.push(e.url);starts.push(L[b].site);if(L[b].model_url)starts.push(L[b].model_url);const org=new URL(L[b].site).origin,q=encodeURIComponent(tk.join(' '));starts.push(org+'/search?q='+q,org+'/?s='+q);
      let pages=[];
      for(const s of starts){const st=await load(pg,s);if(st>=400){r.status='http'+st;continue}
        if(s===e.url){pages.push(s)}
        const ls=await pg.evaluate(inPage,tk,'links');pages.push(...ls);if(pages.length)break;}
      pages=[...new Set(pages)].slice(0,3);
      for(const p of pages){if(pg.url().split('#')[0]!==p){const st=await load(pg,p);if(st>=400)continue}
        const c=await pg.evaluate(inPage,tk,'imgs');if(!c.length){const og=await pg.evaluate(()=>{const m=document.querySelector('meta[property="og:image"],meta[name="og:image"],meta[name="twitter:image"]');return m?new URL(m.content,location.href).href:''});if(og&&!/logo|default|share|social/i.test(og))c.push({src:og,m:-1,alt:'og'});}if(!c.length){r.status='noimg';r.page=p;continue}
        const pick=c[0];const f='/tmp/mg/cand5/'+k.replace(/[^A-Za-z0-9]+/g,'_')+'.img';
        if(await grab(pg,pick.src,f)){r={status:'ok',file:f,page:pg.url(),img:pick.src,m:pick.m,alt:pick.alt,title:(await pg.title()).slice(0,70)};break}else{r.status='imgfail';r.page=p}}
    }catch(err){r.status='ERR '+String(err&&err.stack||err).slice(0,300).replace(/\n/g,' ')}
    O[k]=r;fs.writeFileSync(OUT,JSON.stringify(O,null,0));console.log(k,'|',r.status,r.m!==undefined?'m='+r.m:'','|',(r.page||'').slice(0,90),'|',(r.alt||'').slice(0,40));
  }
  await pg.close();
}
(async()=>{const br=await pptr.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--disable-blink-features=AutomationControlled','--window-size=1400,1000','--lang=en-US']});
  const q=Object.entries(by);const work=async()=>{while(q.length){const [b,it]=q.shift();try{await brand(br,b,it)}catch(e){console.log('BRANDERR',b,String(e).slice(0,80))}}};
  await Promise.all([1,2,3,4,5].map(work));await br.close();console.log('DONE');})();
