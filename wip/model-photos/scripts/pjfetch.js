const pptr=require('puppeteer-core'),fs=require('fs');
const S=JSON.parse(fs.readFileSync('/tmp/mg/state.json')),L=JSON.parse(fs.readFileSync('/tmp/mg/links.json'));
const want=new Set(['Zelos','Helm','Mr Jones Watches','Scurfa','Halios','Traska','Autodromo','Isotope','Lorier','Oak & Oscar','Anoma','Vulcain','anOrdain','Kurono Tokyo','Sartory Billard','Studio Underd0g','Brew','Baltic','Furlan Marri','Nodus','Circula','Marathon','Ming','Horage','Christopher Ward','Minase','Laine','Airain','Ophion','Otsuka Lotec','Orient','Orient Star','Squale','Tutima']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await pptr.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--disable-blink-features=AutomationControlled','--lang=en-US']});
const pg=await br.newPage();await pg.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36');
const brands=[...new Set(Object.values(S).filter(e=>!e.pub).map(e=>e.brand))].filter(b=>want.has(b)&&L[b]&&L[b].site);
for(const b of brands){const f='/tmp/mg/pj/'+b.replace(/[^A-Za-z0-9]+/g,'_')+'.json';
  if(fs.existsSync(f)&&fs.statSync(f).size>10){console.log(b,'cached');continue}
  const org=new URL(L[b].site).origin;let all=[],st='';
  for(let p=1;p<=8;p++){try{const rs=await pg.goto(org+'/products.json?limit=250&page='+p,{waitUntil:'domcontentloaded',timeout:40000});st=rs.status();if(st!==200)break;const t=await pg.evaluate(()=>document.body.innerText);const j=JSON.parse(t).products||[];all.push(...j);if(j.length<250)break}catch(e){st='ERR '+String(e).slice(0,50);break}await sleep(1500)}
  if(all.length)fs.writeFileSync(f,JSON.stringify(all));console.log(b,st,all.length);await sleep(1500)}
await br.close()})();
