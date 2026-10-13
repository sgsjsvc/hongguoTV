package com.hongguotv.tv

import android.content.Context
import android.util.Base64
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import org.json.JSONObject
import org.json.JSONArray
import java.io.Closeable
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Confined, bounded JS VM. Native calls use application-owned HTTP/crypto adapters. */
class StandaloneEngine(context: Context) : Closeable {
    companion object { init { System.loadLibrary("hongguo_quickjs") } }
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(45, TimeUnit.SECONDS).build()
    private var handle = create()
    private val library=TvLibrary.get(context)
    private val recommendationWorkers=java.util.concurrent.Executors.newFixedThreadPool(6)
    private val recommendationClient=client.newBuilder().callTimeout(12,TimeUnit.SECONDS).build()
    private data class CandidateJob(val id:String,val future:java.util.concurrent.Future<JSONObject>)
    private val candidateJobs=LinkedHashMap<String,MutableList<CandidateJob>>()
    private data class NativeStream(val url:String,val key:ByteArray,val header:ByteArray,val samples:List<CencIndex.Sample>,val total:Long)
    private val streams=object:LinkedHashMap<String,NativeStream>(4,.75f,true){override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,NativeStream>)=size>4}
    private external fun create(): Long
    private external fun run(handle: Long, script: String): String
    private external fun destroy(handle: Long)
    init {
        run(handle, context.assets.open("buffer.js").bufferedReader().use { it.readText() })
        run(handle, context.assets.open("engine-host.js").bufferedReader().use { it.readText() })
        run(handle, context.assets.open("hongguo.js").bufferedReader().use { it.readText() })
        run(handle, context.assets.open("recommendation-core.cjs").bufferedReader().use { it.readText() })
        run(handle, context.assets.open("category-contract.cjs").bufferedReader().use { it.readText() })
        run(handle, context.assets.open("content-api.js").bufferedReader().use { it.readText() })
    }
    @Synchronized fun evaluate(expression: String): String {
        check(handle != 0L)
        val begin=System.nanoTime()
        run(handle, "globalThis.__result=undefined; globalThis.__error=undefined; Promise.resolve(($expression)).then(v=>globalThis.__result=JSON.stringify(v),e=>globalThis.__error=String(e)+' '+String(e.stack||''));")
        val error = run(handle, "globalThis.__error||''")
        check(error.isEmpty()) { error }
        return run(handle, "globalThis.__result===undefined?'null':globalThis.__result").also { android.util.Log.w("HongguoStandalone","JS ${(System.nanoTime()-begin)/1000000} ms: ${expression.take(120)}") }
    }
    @Synchronized override fun close() { recommendationWorkers.shutdownNow(); candidateJobs.values.flatten().forEach{it.future.cancel(true)}; if (handle != 0L) { destroy(handle); handle = 0 } }
    private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun decode(value: String) = Base64.decode(value, Base64.DEFAULT)
    fun readStream(token:String,start:Long,end:Long):ByteArray {
        val stream=synchronized(streams){streams[token]} ?: error("视频缓存已失效，请重试加载")
        val output=remoteRange(stream.url,start,end).first
        check(output.size.toLong()==end-start+1){"媒体 Range 长度异常"}
        if(start<stream.header.size)stream.header.copyInto(output,0,start.toInt(),minOf(end+1,stream.header.size.toLong()).toInt())
        if(stream.key.isNotEmpty())for(sample in stream.samples){
            if(sample.end<=start)continue;if(sample.start>end)break
            val overlapStart=maxOf(start,sample.start);val overlapEnd=minOf(end+1,sample.end)
            val relative=overlapStart-sample.start;val skip=(relative%16).toInt()
            val counter=java.math.BigInteger(1,sample.iv).add(java.math.BigInteger.valueOf(relative/16)).and(java.math.BigInteger.ONE.shiftLeft(128).subtract(java.math.BigInteger.ONE)).toByteArray()
            val iv=ByteArray(16);val count=minOf(16,counter.size);counter.copyInto(iv,16-count,counter.size-count,counter.size)
            val cipher=Cipher.getInstance("AES/CTR/NoPadding");cipher.init(Cipher.DECRYPT_MODE,SecretKeySpec(stream.key,"AES"),IvParameterSpec(iv))
            val at=(overlapStart-start).toInt();val countBytes=(overlapEnd-overlapStart).toInt()
            val input=ByteArray(skip+countBytes);output.copyInto(input,skip,at,at+countBytes)
            cipher.doFinal(input).copyInto(output,at,skip,skip+countBytes)
        }
        return output
    }
    private fun remoteRange(url:String,start:Long,end:Long):Pair<ByteArray,Long>{
        val request=Request.Builder().url(url).header("Range","bytes=$start-$end").header("Referer","https://novel.snssdk.com/").header("User-Agent","com.phoenix.read/71332 (Linux; U; Android 16; zh_CN)").build()
        return client.newCall(request).execute().use{response->
            check(response.isSuccessful){"媒体请求失败 ${response.code}"};require((response.body?.contentLength()?:0)<=16*1024*1024){"媒体响应过大"}
            val bytes=response.body?.bytes()?:error("视频响应为空")
            val total=if(response.code==200)bytes.size.toLong() else response.header("Content-Range")?.substringAfterLast('/')?.toLongOrNull()?:error("媒体 Range 缺少总长度")
            (if(response.code==200)bytes.copyOfRange(start.toInt(),minOf(bytes.size.toLong(),end+1).toInt()) else bytes) to total
        }
    }
    @Suppress("unused") fun host(operation: String, payload: String): String = try {
        val value = JSONObject(payload)
        when (operation) {
            "recommendationProfile" -> library.recommendationProfile().toString()
            "recommendationCandidates" -> {
                val session=value.getString("session")
                val jobs=candidateJobs.getOrPut(session){mutableListOf()}
                value.getJSONArray("sources").objects().forEach { source ->
                    val id=source.getString("url")
                    if(jobs.none{it.id==id})jobs.add(CandidateJob(id,recommendationWorkers.submit<JSONObject> {
                        val response=recommendationClient.newCall(Request.Builder().url(id).header("User-Agent","Mozilla/5.0").build()).execute()
                        response.use {
                            check(it.isSuccessful){"分类源 HTTP ${it.code}"}
                            val body=it.body?:error("分类源为空")
                            val maxBytes=16*1024*1024
                            require(body.contentLength()<=maxBytes){"分类响应超过 16 MiB"}
                            val output=java.io.ByteArrayOutputStream()
                            body.byteStream().use { input ->
                                val buffer=ByteArray(8192)
                                while(true){val count=input.read(buffer);if(count<0)break;require(output.size()+count<=maxBytes){"分类响应超过 16 MiB"};output.write(buffer,0,count)}
                            }
                            JSONObject(source.toString()).put("html",output.toString("UTF-8"))
                        }
                    }))
                }
                while(candidateJobs.size>8){val key=candidateJobs.keys.first();candidateJobs.remove(key)?.forEach{it.future.cancel(true)}}
                val output=JSONArray();val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(13)
                var grace:Long?=null
                while(jobs.isNotEmpty()&&System.nanoTime()<deadline&&(grace==null||System.nanoTime()<grace!!)){
                    val ready=jobs.filter{it.future.isDone}
                    ready.forEach { job -> jobs.remove(job);runCatching{job.future.get()}.getOrNull()?.let{output.put(it);if(grace==null)grace=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(1500)} }
                    if(jobs.isNotEmpty())Thread.sleep(10)
                }
                JSONObject().put("rows",output).put("pending",jobs.size).toString()
            }
            "prepareStream" -> {
                val url=value.getString("url");val key=decode(value.getString("key"))
                val first=remoteRange(url,0,256*1024-1L);val size=CencIndex.requiredHeaderSize(first.first)
                require(size<=first.second){"MP4 header larger than media"}
                val bytes=if(size>first.first.size)first.first+remoteRange(url,first.first.size.toLong(),size-1L).first else first.first.copyOfRange(0,size)
                val prepared=if(key.isEmpty())CencIndex.Prepared(bytes,emptyList()) else CencIndex.prepare(bytes)
                val token=java.util.UUID.randomUUID().toString()
                synchronized(streams){streams[token]=NativeStream(url,key,prepared.header,prepared.samples,first.second)}
                JSONObject().put("token",token).put("total",first.second).put("samples",prepared.samples.size).toString()
            }
            "hasStream" -> JSONObject().put("exists",synchronized(streams){streams.containsKey(value.getString("token"))}).toString()
            "log" -> { android.util.Log.i("HongguoStandalone", value.optString("message")); "{}" }
            "hash" -> {
                val bytes = decode(value.getString("data"))
                val result = if (value.getString("algorithm") == "sm3") {
                    Sm3.digest(bytes)
                } else MessageDigest.getInstance(value.getString("algorithm")).digest(bytes)
                JSONObject().put("result", encode(result)).toString()
            }
            "cipher" -> {
                val ctr = value.getString("algorithm").endsWith("ctr")
                val padding = !ctr && value.optBoolean("padding", true)
                val cipher = Cipher.getInstance("AES/${if (ctr) "CTR" else "CBC"}/${if (padding) "PKCS5Padding" else "NoPadding"}")
                cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(decode(value.getString("key")), "AES"), IvParameterSpec(decode(value.getString("iv"))))
                JSONObject().put("result", encode(cipher.doFinal(decode(value.getString("data"))))).toString()
            }
            "http" -> {
                val builder = Request.Builder().url(value.getString("url"))
                value.optJSONObject("headers")?.let { headers -> headers.keys().forEach { name -> builder.header(name, headers.getString(name)) } }
                if (value.optString("method", "GET") != "GET") builder.post(value.optString("body").toRequestBody("application/octet-stream".toMediaTypeOrNull()))
                client.newCall(builder.build()).execute().use { response ->
                    val bytes = response.body?.bytes() ?: ByteArray(0)
                    require(bytes.size <= 16 * 1024 * 1024) { "Content response exceeded 16 MiB" }
                    JSONObject().put("status", response.code).put("headers", JSONObject(response.headers.toMultimap().mapValues { it.value.joinToString(",") }))
                        .put("binary", value.optString("responseType") == "arraybuffer").put("data", if (value.optString("responseType") == "arraybuffer") encode(bytes) else String(bytes, Charsets.UTF_8)).toString()
                }
            }
            else -> error("Unsupported native operation")
        }
    } catch (error: Exception) { JSONObject().put("error", error.message ?: "Native adapter failed").toString() }
}
