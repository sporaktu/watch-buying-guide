const fs=require('fs'),vm=require('vm'),{execFileSync}=require('child_process');
let src=fs.readFileSync('site/app.js','utf8');const lines=src.split('\n');const li=lines.findIndex(l=>/^const LINKS\s*=/.test(l));
const pre=lines[li].match(/^const LINKS\s*=\s*/)[0];const L=JSON.parse(lines[li].slice(pre.length).replace(/;\s*$/,''));
const M=vm.runInNewContext(fs.readFileSync('site/models.js','utf8').replace('const MODELS','var MODELS')+'\nMODELS');
const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/²/g,'2').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let line=lines[li],done=[],todo=[];
for(const b of Object.keys(M)){const l=L[b];if(l&&l.img&&fs.existsSync('site/'+l.img))continue;
  const m=M[b].find(x=>x.pic);if(!m){todo.push(b+(l?'':' (no LINKS entry)'));continue}
  if(!l){todo.push(b+' (has pic, no LINKS entry)');continue}
  const f='img/b-'+slug(b)+'.jpg';if(fs.existsSync('site/'+f))throw new Error('exists '+f);
  execFileSync('python3',['-c',"import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB').resize((176,176),Image.LANCZOS);im.save(sys.argv[2],'JPEG',quality=84,optimize=True,progressive=True)",'site/'+m.pic,'site/'+f]);
  const key=JSON.stringify(b)+':{';const at=line.indexOf(key);if(at<0)throw new Error('nokey '+b);const end=line.indexOf('}',at);const obj=line.slice(at+key.length-1,end+1);JSON.parse(obj);
  if(/"img"/.test(obj))throw new Error('has img '+b+' '+obj);
  line=line.slice(0,end)+',"img":'+JSON.stringify(f)+line.slice(end);done.push(b+' <- '+m.name);}
const chk=JSON.parse(line.slice(pre.length).replace(/;\s*$/,''));for(const d of done){const b=d.split(' <- ')[0];if(!chk[b].img||!fs.existsSync('site/'+chk[b].img))throw new Error('verify '+b)}
lines[li]=line;fs.writeFileSync('site/app.js',lines.join('\n'));console.log('added',done.length,done.join('; '));console.log('still without thumb:',todo.join('; '));
