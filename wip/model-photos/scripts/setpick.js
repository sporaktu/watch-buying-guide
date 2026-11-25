const fs=require('fs');let s=fs.readFileSync('site/app.js','utf8');
const keys=['seagull-1963-42','stowa-marine-original-41','laco-bremerhaven-42-5','hanhart-417-es-heritage-flyback-42','christopher-ward-c12-loco','oris-propilot-x-calibre-115','tutima-patria-admiral-blue'];
const lines=s.split('\n');const li=lines.findIndex(l=>/^\s*const PICKS\s*=/.test(l));const pre=lines[li].match(/^\s*const PICKS\s*=\s*/)[0];
const arr=JSON.parse(lines[li].slice(pre.length).replace(/;\s*$/,''));
let line=lines[li],n=0;
for(const k of keys){const p=arr.find(x=>x.key===k);if(!p||p.img)throw new Error('bad '+k);if(!fs.existsSync('site/img/'+k+'.jpg'))throw new Error('nofile '+k);
  const at=line.indexOf('"key": "'+k+'"');if(at<0)throw new Error('nokey '+k);
  const next=line.indexOf('"key": "',at+10);const seg=line.slice(at,next<0?line.length:next);
  const a=seg.indexOf('"img": ""'),b=line.lastIndexOf('"img": ""',at);
  // img may sit after the key (same object) or before it; pick whichever belongs to this object
  const objStart=line.lastIndexOf('{"',at);let pos=-1;
  if(b>=objStart&&b>=0)pos=b;else if(a>=0)pos=at+a;
  if(pos<0)throw new Error('noimg '+k);
  line=line.slice(0,pos)+'"img": "img/'+k+'.jpg"'+line.slice(pos+9);n++}
const chk=JSON.parse(line.slice(pre.length).replace(/;\s*$/,''));
for(const k of keys){if(chk.find(x=>x.key===k).img!=='img/'+k+'.jpg')throw new Error('verify '+k)}
if(chk.filter(x=>!x.img).length)console.log('still without img:',chk.filter(x=>!x.img).map(x=>x.key));
lines[li]=line;fs.writeFileSync('site/app.js',lines.join('\n'));console.log('set',n,'of',chk.length,'picks; all have img:',chk.every(x=>x.img&&fs.existsSync('site/'+x.img)));
