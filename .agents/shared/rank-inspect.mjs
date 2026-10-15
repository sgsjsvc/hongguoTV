import fs from 'node:fs';
for(const file of fs.readdirSync('outputs/rank-diagnosis').filter(x=>x.endsWith('.html'))){
 const html=fs.readFileSync('outputs/rank-diagnosis/'+file,'utf8');
 console.log(file,'rankList',html.indexOf('rankList'),'names',[...html.matchAll(/data-fn-name="([^"]+)"/g)].map(m=>m[1]));
 for(const m of html.matchAll(/data-fn-args="([^"]+)"/g)){
  try{const a=JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));console.log('args',JSON.stringify(a).slice(0,180));}catch(e){console.log('parse error',e.message);}
 }
}
