// Freeze only source directories needed by the backend; no Git operations/user data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const target=path.resolve('outputs/testing/b5');
fs.mkdirSync(target,{recursive:true});
const sources=['shared','server','custom-server'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const evidence={createdAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commits:{},files:{},meaning:'Counterfactual paired source snapshot, not the named Git commits. Only difference is removal of item.definition priority. No 15% speedup assumed.'};
for(const revision of ['617c073','c2561f5']) evidence.commits[revision]={description:execFileSync('git',['show','--format=fuller','--stat',revision],{encoding:'utf8'}),engineSha256:digest(execFileSync('git',['show',revision+':shared/content-core/hongguo.js']))};
for(const variant of ['actual-current','current-without-definition']) {
  const dir=path.join(target,variant,'source');
  if(fs.existsSync(dir)) throw Error('Snapshot exists; select/archive prior run explicitly instead of overwriting: '+dir);
  fs.mkdirSync(dir,{recursive:true});
  const sourceRoot=variant==='actual-current'?root:path.join(target,'actual-current','source');
  for(const folder of sources) fs.cpSync(path.join(sourceRoot,folder),path.join(dir,folder),{recursive:true,filter:from=>!['data','node_modules','.cache'].includes(path.basename(from))});
  fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
  if(variant==='current-without-definition') {
    for(const relative of ['shared/content-core/hongguo.js','custom-server/vendor/hongguo.cjs','server/vendor/hongguo.cjs']) {
      const file=path.join(dir,relative),text=fs.readFileSync(file,'utf8');
      if(text.split('const quality = str(item.definition || ').length!==2) throw Error('Expected exactly one Q2 definition chain');
      fs.writeFileSync(file,text.replace('const quality = str(item.definition || ','const quality = str('));
    }
  }
  const walk=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile())evidence.files[variant+'/'+path.relative(dir,full).replaceAll('\\','/')]=digest(fs.readFileSync(full));}};
  for(const folder of sources)walk(path.join(dir,folder));
}
evidence.differences=[];
for(const key of Object.keys(evidence.files).filter(k=>k.startsWith('actual-current/'))) {
  const relative=key.slice('actual-current/'.length);
  const before=fs.readFileSync(path.join(target,'current-without-definition/source',relative));
  const after=fs.readFileSync(path.join(target,'actual-current/source',relative));
  if(before.equals(after))continue;
  evidence.differences.push(relative);
  const allowed=['shared/content-core/hongguo.js','custom-server/vendor/hongguo.cjs','server/vendor/hongguo.cjs'];
  if(!allowed.includes(relative)||before.toString().replace('const quality = str(item.quality_desc','const quality = str(item.definition || item.quality_desc')!==after.toString())throw Error('Unexpected snapshot difference: '+relative);
}
if(evidence.differences.length!==3)throw Error('Expected exactly three Q2 engine differences');
fs.writeFileSync(path.join(target,'snapshot-evidence.json'),JSON.stringify(evidence,null,2));
console.log('Frozen variants and evidence under '+target);
