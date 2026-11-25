const fs=require('fs'),vm=require('vm');
const M=vm.runInNewContext(fs.readFileSync('site/models.js','utf8').replace('const MODELS','var MODELS')+'\nMODELS');
const S=JSON.parse(fs.readFileSync('/tmp/mg/state.json'));let n=0,miss=0;
for(const b in M)M[b].forEach((m,i)=>{const e=S[b+'|'+i];if(m.pic){e.pub=m.pic;n++;if(!fs.existsSync('site/'+m.pic))miss++}else delete e.pub});
fs.writeFileSync('/tmp/mg/state.json',JSON.stringify(S,null,1));console.log('pics',n,'missing files',miss);
