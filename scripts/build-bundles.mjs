import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'outputs','bundles');fs.mkdirSync(output,{recursive:true});
const version='22.20.0';
const platforms=(process.argv.find(arg=>arg.startsWith('--platforms='))?.split('=')[1]||'win-x64,linux-x64,linux-arm64,darwin-x64,darwin-arm64').split(',');
const cache=path.join(root,'outputs','runtime-cache');fs.mkdirSync(cache,{recursive:true});
function run(binary,args,options={}){const result=spawnSync(binary,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});if(result.status!==0)throw Error(`${binary} failed: ${result.error?.message||result.status}`);}
async function download(url,destination){const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`download failed ${response.status}: ${url}`);fs.writeFileSync(destination,Buffer.from(await response.arrayBuffer()));}
const checksumFile=path.join(cache,`node-v${version}-SHASUMS256.txt`);if(!fs.existsSync(checksumFile))await download(`https://nodejs.org/dist/v${version}/SHASUMS256.txt`,checksumFile);
const sums=new Map(fs.readFileSync(checksumFile,'utf8').trim().split('\n').map(line=>{const [hash,file]=line.trim().split(/\s+/);return[file,hash];}));
async function runtime(platform){
 const name=`node-v${version}-${platform}`;const archive=name+(platform.startsWith('win-')?'.zip':'.tar.xz');const file=path.join(cache,archive);
 if(!fs.existsSync(file))await download(`https://nodejs.org/dist/v${version}/${archive}`,file);
 const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(hash!==sums.get(archive))throw Error(`runtime checksum mismatch: ${archive}`);
 if(!fs.existsSync(path.join(cache,name)))run('tar',['-xf',file,'-C',cache]);
 return path.join(cache,name,platform.startsWith('win-')?'node.exe':'bin/node');
}
function copy(source,destination){
 if(fs.existsSync(destination)&&fs.statSync(source).isFile()&&fs.statSync(destination).isFile()){
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(hash(source)===hash(destination))return;
 }
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(source,destination,{recursive:true});
}
function scripts(directory,remote=false){
 const service=remote?'set "HG_SERVICE=sync"\r\n':'';
 fs.writeFileSync(path.join(directory,'start.cmd'),`@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\n${service}"%~dp0runtime\\node.exe" "%~dp0scripts\\service-launcher.mjs" start\r\npause\r\n`);
 fs.writeFileSync(path.join(directory,'stop.cmd'),`@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\n${service}"%~dp0runtime\\node.exe" "%~dp0scripts\\service-launcher.mjs" stop\r\npause\r\n`);
 for(const action of ['start','stop'])fs.writeFileSync(path.join(directory,`${action}.sh`),`#!/bin/sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nchmod +x "$ROOT/runtime/node"\n${remote?'export HG_SERVICE=sync\n':''}exec "$ROOT/runtime/node" "$ROOT/scripts/service-launcher.mjs" ${action}\n`,{mode:0o755});
 fs.writeFileSync(path.join(directory,'README.txt'),`HongguoTV ${remote?'远程共享服务':'独立 Web 服务'}\nWindows: 双击 start.cmd / stop.cmd\nLinux/macOS: sh start.sh / sh stop.sh\n无需安装 Node/npm；运行环境随包提供。\n数据位于用户资料目录 HongguoTV/${remote?'remote-service':'web-service'}，更新程序不会覆盖数据。\n端口默认 ${remote?'8791':'8788'}，可通过 HG_PORT 设置；HG_DATA_DIR 可指定数据位置。\n${remote?'首次启动生成 shared-key.txt；各端填写地址和该密钥。公网部署使用 HTTPS 反向代理。':'启动脚本会显示浏览器访问地址，端口被其他程序占用时启动失败并保留日志。'}\n`);
}
async function stage(platform,remote=false){
 const directory=path.join(output,`hongguotv-${remote?'sync':'web'}-${platform}`);fs.mkdirSync(directory,{recursive:true});
 const node=await runtime(platform);copy(node,path.join(directory,'runtime',platform.startsWith('win-')?'node.exe':'node'));
 const runtimeDirectory=platform.startsWith('win-')?path.dirname(node):path.dirname(path.dirname(node));copy(path.join(runtimeDirectory,'LICENSE'),path.join(directory,'runtime','LICENSE-node.txt'));
 copy(path.join(root,'LICENSE'),path.join(directory,'LICENSE'));
 for(const name of ['library-store.mjs','http-json.mjs','legacy-migration.mjs','listen-port.mjs'])copy(path.join(root,'shared',name),path.join(directory,'shared',name));
 copy(path.join(root,'scripts','service-launcher.mjs'),path.join(directory,'scripts','service-launcher.mjs'));
 copy(path.join(root,'scripts','migrate-library.mjs'),path.join(directory,'scripts','migrate-library.mjs'));
 copy(path.join(root,'custom-server','history-store.mjs'),path.join(directory,'custom-server','history-store.mjs'));
 if(remote){for(const name of ['index.mjs','server.mjs','admin.mjs','shared-key.mjs','public'])copy(path.join(root,'apps','sync-server',name),path.join(directory,'apps','sync-server',name));}
 else{
  const notices=['react','react-dom','scheduler','lucide-react','axios'].map(name=>`${name}\n${fs.readFileSync(path.join(root,'apps','web-pc','node_modules',name,'LICENSE'),'utf8')}`).join('\n\n');
  fs.writeFileSync(path.join(directory,'THIRD_PARTY_NOTICES.txt'),notices);
  for(const name of fs.readdirSync(path.join(root,'custom-server')).filter(name=>name.endsWith('.mjs')))copy(path.join(root,'custom-server',name),path.join(directory,'custom-server',name));
  copy(path.join(root,'custom-server','vendor'),path.join(directory,'custom-server','vendor'));copy(path.join(root,'server','provider.mjs'),path.join(directory,'server','provider.mjs'));copy(path.join(root,'server','vendor'),path.join(directory,'server','vendor'));
  copy(path.join(root,'shared','content-core'),path.join(directory,'shared','content-core'));for(const name of ['recommendation-core.cjs','category-contract.cjs'])copy(path.join(root,'shared',name),path.join(directory,'shared',name));copy(path.join(root,'apps','web-pc','dist'),path.join(directory,'apps','web-pc','dist'));
  fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{axios:'1.13.6'}},null,2));
  const accidentalLink=path.join(directory,'node_modules','hongguotv');
  if(fs.existsSync(accidentalLink)&&fs.lstatSync(accidentalLink).isSymbolicLink())fs.unlinkSync(accidentalLink);
  run(process.execPath,[process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'),'install','--omit=dev','--no-audit','--no-fund'],{cwd:directory});
 }
 scripts(directory,remote);
 copy(path.join(root,'docs','LOCAL_REMOTE_SERVICES.md'),path.join(directory,'DEPLOYMENT.md'));
 const archive=directory+(platform.startsWith('win-')?'.zip':'.tar.gz');
 if(platform.startsWith('win-'))run('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath '${directory.replaceAll("'","''")}' -DestinationPath '${archive.replaceAll("'","''")}' -Force`]);
 else if(process.platform==='win32')run('python',['-c',"import tarfile,sys,os\ndef mode(info):\n if info.issym() or info.islnk(): return None\n if info.name.endswith('/runtime/node') or info.name.endswith('.sh'): info.mode=0o755\n return info\nwith tarfile.open(sys.argv[2],'w:gz',compresslevel=6) as archive: archive.add(sys.argv[1],arcname=os.path.basename(sys.argv[1]),filter=mode)",directory,archive]);
 else run('tar',['-czf',archive,'-C',output,path.basename(directory)]);
 console.log(`已生成 ${archive}`);return directory;
}
for(const platform of platforms){await stage(platform);if(platform.startsWith('linux-'))await stage(platform,true);}
if(platforms.includes('win-x64')&&!process.argv.includes('--web-only')){
 const desktop=path.join(root,'dist-win','hongguoTV-win32-x64');
 copy(path.join(output,'hongguotv-web-win-x64'),path.join(desktop,'resources','hongguotv'));
 copy(path.join(root,'apps','web-pc','dist'),path.join(desktop,'resources','app','dist'));
 copy(path.join(root,'apps','web-pc','electron','main.cjs'),path.join(desktop,'resources','app','electron','main.cjs'));
 copy(path.join(root,'apps','web-pc','electron','preload.cjs'),path.join(desktop,'resources','app','electron','preload.cjs'));
 const archive=path.join(output,'hongguotv-desktop-win-x64.zip');run('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath '${desktop.replaceAll("'","''")}' -DestinationPath '${archive.replaceAll("'","''")}' -Force`]);console.log(`已生成 ${archive}`);
}
