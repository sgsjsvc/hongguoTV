import { createHash,timingSafeEqual,randomUUID } from 'node:crypto';
import { writeFileSync,renameSync,unlinkSync,statSync } from 'node:fs';
import { LibraryError } from '../../shared/library-store.mjs';
const digest=value=>createHash('sha256').update(value).digest();
export class SharedKey {
 #digest;
 constructor(key,{keyFile,keyManaged=false}={}){
  if(typeof key!=='string'||key.length<16)throw Error('shared key must contain at least 16 characters');
  this.#digest=digest(key);this.file=keyFile;this.managed=keyManaged;
  try{this.changedAt=statSync(keyFile).mtimeMs}catch{this.changedAt=Date.now()}
 }
 accepts(key){return typeof key==='string'&&timingSafeEqual(this.#digest,digest(key))}
 info(){return {canRotate:!this.managed,source:this.managed?'environment':this.file?'file':'memory',changedAt:this.changedAt,minLength:16,maxLength:128}}
 rotate({currentKey,newKey,confirmation}){
  if(this.managed)throw new LibraryError(409,'密钥由 HG_SYNC_KEY 环境变量管理，请在部署配置中修改');
  if(!this.accepts(currentKey))throw new LibraryError(400,'当前密钥不正确');
  if(typeof newKey!=='string'||!/^[-_A-Za-z0-9]{16,128}$/.test(newKey))throw new LibraryError(400,'新密钥需为16–128位英文字母、数字、横线或下划线');
  if(confirmation!==newKey)throw new LibraryError(400,'两次输入的新密钥不一致');
  if(this.accepts(newKey))throw new LibraryError(400,'新密钥必须与当前密钥不同');
  if(this.file){
   const temporary=`${this.file}.${randomUUID()}.tmp`;
   try{writeFileSync(temporary,newKey+'\n',{flag:'wx',mode:0o600});renameSync(temporary,this.file)}
   catch{try{unlinkSync(temporary)}catch{}throw new LibraryError(500,'密钥保存失败，原密钥仍有效')}
  }
  this.#digest=digest(newKey);this.changedAt=Date.now();return {updated:true,...this.info()};
 }
}
