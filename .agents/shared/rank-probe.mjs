import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import axios from 'axios';
const html=await (await fetch('https://hongguoduanju.com/rank/hot-drama')).text();
fs.mkdirSync('outputs/rank-diagnosis',{recursive:true});
fs.writeFileSync('outputs/rank-diagnosis/hot-drama.html',html);
for(const m of html.matchAll(/data-fn-name="([^"]+)"[^>]*data-fn-args="([^"]+)"/g)){
 const args=JSON.parse(m[2].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
 console.log('function',m[1],'argtypes',args.map(x=>Array.isArray(x)?'array':typeof x));
 console.log(JSON.stringify(args).slice(0,1100));
}
const ctx=vm.createContext({Buffer,URL,URLSearchParams,axios,require:()=>crypto});
vm.runInContext(fs.readFileSync('shared/content-core/hongguo.js','utf8')+'\nthis.rankDataForTest=rankData;',ctx);
try{console.log('existing core parser',ctx.rankDataForTest(html).rankList.length);}catch(e){console.log('existing core parser ERROR',e.message);}
const bridge=fs.readFileSync('custom-server/index.mjs','utf8');
vm.runInContext(bridge.slice(bridge.indexOf('function extractRankFromHtml('),bridge.indexOf('// 4. 抓取官方排行榜单页')),ctx);
console.log('existing bridge parser',ctx.extractRankFromHtml(html)?.rankList?.length ?? null);
