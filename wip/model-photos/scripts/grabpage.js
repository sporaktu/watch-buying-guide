const pptr=require('puppeteer-core'),fs=require('fs'),{execFileSync}=require('child_process');
const U=JSON.parse(fs.readFileSync(process.argv[2])),dir=process.argv[3],N=+(process.argv[4]||4);
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await pptr.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--disable-blink-features=AutomationControlled','--window-size=1400,1000','--lang=en-US']});
const pg=await br.newPage();await pg.setViewport({width:1400,height:1000});await pg.setUserAgent(UA);await pg.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'webdriver',{get:()=>undefined})});
for(const [k,u] of Object.entries(U)){try{
  const rs=await pg.goto(u,{waitUntil:'domcontentloaded',timeout:45000});await sleep(4000);for(let y=0;y<3;y++){await pg.evaluate(()=>window.scrollBy(0,800)).catch(()=>{});await sleep(500)}await pg.evaluate(()=>window.scrollTo(0,0)).catch(()=>{});await sleep(400);
  const c=await pg.evaluate(()=>{const o=[];const m=document.querySelector('meta[property="og:image"]');if(m&&m.content)o.push({src:new URL(m.content,location.href).href,w:0,h:0,t:'og'});
    const a=[];for(const im of document.images){const w=im.naturalWidth,h=im.naturalHeight,r=im.getBoundingClientRect();if(w<400||h<400||r.width<150)continue;if(im.closest('header,nav,footer'))continue;const s=im.currentSrc||im.src;if(!/^https?:/.test(s)||/\.svg/i.test(s))continue;a.push({src:s,w,h,t:(im.alt||'').slice(0,40),y:r.top+scrollY,area:r.width*r.height})}
    a.sort((x,y)=>x.y-y.y||y.area-x.area);const seen=new Set();for(const x of a){if(!seen.has(x.src)){seen.add(x.src);o.push(x)}}return o});
  console.log(k,rs&&rs.status(),c.length,(await pg.title()).slice(0,50));let n=0;
  for(const x of c.slice(0,N)){const f=dir+'/'+k+'__'+n+'.img';let ok=false;
    try{const b64=await pg.evaluate(async s=>{const r=await fetch(s);if(!r.ok)return '';const b=await r.blob();return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result.split(',')[1]);f.readAsDataURL(b)})},x.src);if(b64&&b64.length>4000){fs.writeFileSync(f,Buffer.from(b64,'base64'));ok=true}}catch(e){}
    if(!ok){try{execFileSync('curl',['-sL','-m','30','-A',UA,'-e',pg.url(),'-o',f,x.src]);ok=fs.statSync(f).size>3000}catch(e){}}
    console.log('  ',n,ok?'ok':'FAIL',x.w+'x'+x.h,x.t,'|',x.src.slice(0,110));n++}
}catch(e){console.log(k,'ERR',String(e).slice(0,80))}}
await br.close()})();
