globalThis.log = function (message) { nativeBridge('log',JSON.stringify({message:String(message)})); };
// Preserve unsigned arithmetic identically on 32-bit and 64-bit QuickJS builds.
BigInt.asUintN = function(bits,value){const modulus=1n<<BigInt(bits);return ((BigInt(value)%modulus)+modulus)%modulus;};
globalThis.setResult = function (items) { return items; };
function native(operation, value) { const out=JSON.parse(nativeBridge(operation,JSON.stringify(value))); if(out.error)throw new Error(out.error); return out; }
globalThis.crypto = {
  createHash(algorithm) { const chunks=[]; return { update(data){chunks.push(Buffer.from(data));return this;},digest(encoding){const out=Buffer.from(native('hash',{algorithm,data:Buffer.concat(chunks).toString('base64')}).result,'base64');return encoding?out.toString(encoding):out;} }; },
  createDecipheriv(algorithm,key,iv) { const chunks=[];let padding=true;const ctr=algorithm.endsWith('ctr');function decode(){return Buffer.from(native('cipher',{algorithm,key:Buffer.from(key).toString('base64'),iv:Buffer.from(iv).toString('base64'),data:Buffer.concat(chunks).toString('base64'),padding}).result,'base64');}return {setAutoPadding(value){padding=value;return this;},update(data){const offset=chunks.reduce((n,b)=>n+b.length,0);chunks.push(Buffer.from(data));return ctr?decode().subarray(offset):Buffer.alloc(0);},final(){return ctr?Buffer.alloc(0):decode();}}; }
};
globalThis.require = function(name) { if(name==='node:crypto')return globalThis.crypto;throw new Error('Unsupported module '+name); };
globalThis.axios = async function(url,options={}) { const out=native('http',{url,headers:options.headers||{},method:options.method||'GET',body:options.body||'',responseType:options.responseType||'text'});if(out.binary)out.data=Buffer.from(out.data,'base64');return out; };
axios.post = function(url,body,options={}) { return axios(url,{...options,method:'POST',body:Buffer.isBuffer(body)?body.toString():String(body)}); };
globalThis.URLSearchParams = class {
  constructor(value=''){this.rows=[];if(typeof value==='string'){for(const part of value.replace(/^\?/,'').split('&')){if(!part)continue;const at=part.indexOf('=');this.rows.push([decodeURIComponent((at<0?part:part.slice(0,at)).replace(/\+/g,' ')),decodeURIComponent((at<0?'':part.slice(at+1)).replace(/\+/g,' '))]);}}else{for(const [k,v]of Object.entries(value))this.rows.push([k,String(v)]);}}
  set(k,v){this.rows=this.rows.filter(row=>row[0]!==k);this.rows.push([k,String(v)]);} get(k){return this.rows.find(row=>row[0]===k)?.[1]??null;}
  entries(){return this.rows[Symbol.iterator]();} [Symbol.iterator](){return this.entries();}
  toString(){return this.rows.map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');}
};
