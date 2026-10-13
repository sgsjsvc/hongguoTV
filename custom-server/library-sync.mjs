import { createHash } from 'node:crypto';
import { LibraryError } from '../shared/library-store.mjs';

function origin(input){let url;try{url=new URL(input);}catch{throw new LibraryError(400,'远程地址无效');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new LibraryError(400,'远程地址必须为 HTTP(S) 服务地址');return url.toString().replace(/\/+$/,'');}
export class LibrarySync {
  constructor(store){this.store=store;this.running=false;this.nextAttempt=0;this.failures=0;this.generation=0;this.status={state:store.getMeta('syncConfig')?'pending':'unconfigured',pending:0,lastSyncedAt:null,error:''};}
  async request(config,path,body){const response=await fetch(config.url+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${config.key}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw new LibraryError(response.status,data.error||'远程请求失败');return data;}
  async configure(input){
    const generation=++this.generation;
    if(input.enabled===false){this.store.setMeta('syncConfig',null);this.status={state:'unconfigured',pending:0,lastSyncedAt:this.status.lastSyncedAt,error:''};return this.view();}
    const previous=this.store.getMeta('syncConfig');
    const url=origin(input.url);
    const config={url,key:typeof input.key==='string'&&input.key?input.key:(previous?.url===url?previous.key:'')};
    if(config.key.length<16)throw new LibraryError(400,'家庭共享密钥无效');
    const started=Date.now();const handshake=await this.request(config,'/api/sync/handshake');
    if(generation!==this.generation)throw new LibraryError(409,'配置已被更新，忽略旧验证结果');
    if(handshake.protocolVersion!==1||typeof handshake.instanceId!=='string'||!Number.isSafeInteger(handshake.serverTime))throw new LibraryError(400,'该地址不是兼容的共享服务');
    config.instanceId=handshake.instanceId;config.target=createHash('sha256').update(config.url+'\n'+config.instanceId+'\n'+config.key).digest('hex');
    this.store.setMeta('clockOffset',handshake.serverTime-(started+Date.now())/2);this.store.seedTarget(config.target);this.store.setMeta('syncConfig',config);
    this.nextAttempt=0;this.failures=0;this.status={...this.status,state:'pending',error:''};return this.view();
  }
  view(){const config=this.store.getMeta('syncConfig');return{...this.status,enabled:!!config,url:config?.url||'',pending:config?this.store.pending(config.target).length:0};}
  start(){this.timer=setInterval(()=>void this.tick(),1000);this.timer.unref();void this.tick();}
  stop(){clearInterval(this.timer);this.generation++;}
  async tick(){
    const config=this.store.getMeta('syncConfig');if(!config||this.running||Date.now()<this.nextAttempt)return;
    this.running=true;const generation=this.generation;this.status.state='syncing';
    try{
      const events=this.store.pending(config.target);
      if(events.length){const ack=await this.request(config,'/api/sync/push',{events,instanceId:config.instanceId});if(generation!==this.generation)return;if(ack.instanceId!==config.instanceId)throw new LibraryError(409,'远程实例已更换，请重新验证连接');this.store.receive(ack.events,{canonical:true});this.store.acknowledge(config.target,ack.acked);}
      let cursor=this.store.getMeta(`cursor:${config.target}`)||0;
      for(let batch=0;batch<16;batch++){
        const started=Date.now();const result=await this.request(config,`/api/sync/pull?cursor=${cursor}`);if(generation!==this.generation)return;
        if(result.instanceId!==config.instanceId)throw new LibraryError(409,'远程实例已更换，请重新验证连接');
        this.store.receive(result.events,{canonical:true});cursor=result.cursor;this.store.setMeta(`cursor:${config.target}`,cursor);this.store.setMeta('clockOffset',result.serverTime-(started+Date.now())/2);
        if(!result.hasMore)break;
      }
      this.failures=0;this.nextAttempt=0;this.status={state:this.store.pending(config.target).length?'pending':'synced',pending:0,lastSyncedAt:Date.now(),error:''};
    }catch(error){if(generation===this.generation){this.failures++;this.nextAttempt=Date.now()+Math.min(30000,1000*2**Math.min(this.failures,5));this.status.state='offline';this.status.error=error.message;}}
    finally{this.running=false;}
  }
}
