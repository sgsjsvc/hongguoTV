package com.hongguotv.tv

import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal fun historyProgress(json:JSONObject)=Progress(Series(json.getString("seriesId"),json.getString("title"),json.optString("cover"),json.optString("description"),json.optString("badge"),json.optString("tags"),json.optString("contentType")),json.getString("episodeId"),json.getInt("episodeNumber"),json.getLong("positionMs"),json.optLong("durationMs"),json.optBoolean("completed"),json.optLong("updatedAt"),json.optString("source","tv"))
internal fun Progress.toHistoryJson():JSONObject=series.toJson().put("seriesId",series.id).put("episodeId",episodeId).put("episodeNumber",episodeNumber).put("positionMs",positionMs).put("durationMs",durationMs).put("completed",completed).put("updatedAt",updatedAt)
internal fun historyAcknowledged(pending:JSONObject,sequence:Long)=pending.optLong("sequence")<=sequence

/** Optional sync transport. All reads and playback writes remain local and durable. */
class HistorySync internal constructor(context:Context,autoFlush:Boolean=true,libraryOverride:TvLibrary?=null){
    private val application=context.applicationContext
    private val library=libraryOverride?:TvLibrary.get(application)
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    private val mutex=Mutex()
    private val configurationGeneration=java.util.concurrent.atomic.AtomicLong()
    private val client=OkHttpClient.Builder().connectTimeout(5,TimeUnit.SECONDS).readTimeout(10,TimeUnit.SECONDS).callTimeout(20,TimeUnit.SECONDS).build()
    @Volatile var status="未配置远程同步";private set
    @Volatile private var foreground=true
    private var seriesId=""
    val remoteUrl get()=library.setting("remoteUrl")
    val remoteKey get()=library.setting("remoteKey")
    companion object {@Volatile private var singleton:HistorySync?=null;fun get(context:Context)=singleton ?: synchronized(this){singleton ?: HistorySync(context).also{singleton=it}}}
    init{if(autoFlush)scope.launch{var backoff=1000L;while(isActive){if(foreground&&remoteUrl.isNotBlank()){try{flush();backoff=1000}catch(error:Exception){status=if(error is RemoteInstanceChangedException)error.message!! else "离线待同步";backoff=(backoff*2).coerceAtMost(30000)}};delay(backoff)}}}
    fun foreground(value:Boolean){foreground=value}
    internal fun close(){scope.cancel()}
    fun begin(@Suppress("UNUSED_PARAMETER")origin:String,series:Series){seriesId=series.id}
    fun save(record:Progress){if(seriesId==record.series.id)TvStore(application).saveProgress(record)}
    suspend fun list(@Suppress("UNUSED_PARAMETER")origin:String,@Suppress("UNUSED_PARAMETER")source:String="all"):List<Progress> = withContext(Dispatchers.IO){TvStore(application).history()}
    suspend fun progress(origin:String,seriesId:String)=list(origin).firstOrNull{it.series.id==seriesId}
    suspend fun migrate(store:TvStore)=withContext(Dispatchers.IO){
        if(library.setting("legacyServerHistoryMigrated")=="1"||store.baseUrl.isBlank())return@withContext
        val result=request(store.baseUrl,"","/api/history?source=all")
        library.transaction {
            result.getJSONArray("items").objects().forEach{record->
                val current=library.rows("history").firstOrNull{it.getString("key")==record.getString("seriesId")}
                if(current==null||current.getLong("at")<record.optLong("updatedAt"))library.write("history",record.getString("seriesId"),"set",record,record.optLong("updatedAt"))
            }
            library.setSetting("legacyServerHistoryMigrated","1")
        }
    }
    suspend fun configure(url:String,key:String)=withContext(Dispatchers.IO){val generation=configurationGeneration.incrementAndGet();mutex.withLock{
        val candidate=PlaybackPolicy.normalizeBaseUrl(url);require(key.isNotBlank()){"请输入家庭共享密钥"}
        val start=System.currentTimeMillis();val hello=request(candidate,key,"/api/sync/handshake")
        ensureActive();check(configurationGeneration.get()==generation){"连接设置已取消"}
        require(hello.getInt("protocolVersion")==1){"远程服务版本不支持"}
        val instance=hello.getString("instanceId")
        if(candidate!=remoteUrl||instance!=library.setting("instanceId")){library.snapshotForNewTarget();library.setSetting("cursor","0")}
        library.setSetting("clockOffset",(hello.getLong("serverTime")-(start+System.currentTimeMillis())/2).toString())
        library.setSetting("remoteUrl",candidate);library.setSetting("remoteKey",key);library.setSetting("instanceId",instance);status="同步中"
    };flush()}
    suspend fun disable()=withContext(Dispatchers.IO){configurationGeneration.incrementAndGet();mutex.withLock{library.setSetting("remoteUrl","");library.setSetting("remoteKey","");status="未配置远程同步"}}
    suspend fun flush()=withContext(Dispatchers.IO){mutex.withLock{
        val origin=remoteUrl;if(origin.isBlank())return@withLock
        status="同步中"
        var pending=library.pending()
        while(pending.isNotEmpty()){
            val response=request(origin,remoteKey,"/api/sync/push",JSONObject().put("instanceId",library.setting("instanceId")).put("events",JSONArray(pending)))
            verifyInstance(response.getString("instanceId"))
            val ack=response.getJSONArray("acked");library.merge(response.optJSONArray("events")?.objects()?:emptyList(),(0 until ack.length()).map{ack.getString(it)})
            if(ack.length()==0)error("远程未确认上传事件")
            pending=library.pending()
        }
        do{
            val start=System.currentTimeMillis();val response=request(origin,remoteKey,"/api/sync/pull?cursor=${library.setting("cursor","0")}&limit=256")
            verifyInstance(response.getString("instanceId"))
            library.transaction {library.merge(response.getJSONArray("events").objects());library.setSetting("cursor",response.getLong("cursor").toString());library.setSetting("clockOffset",(response.getLong("serverTime")-(start+System.currentTimeMillis())/2).toString())}
        }while(response.optBoolean("hasMore"))
        status=if(library.pending().isEmpty())"已同步"else"同步中"
    }}
    private fun verifyInstance(actual:String){if(actual!=library.setting("instanceId"))instanceChanged()}
    private fun instanceChanged():Nothing{status="远程数据实例已更换，请重新验证连接";throw RemoteInstanceChangedException(status)}
    private fun request(origin:String,key:String,path:String,body:JSONObject?=null):JSONObject{
        val builder=Request.Builder().url(origin.trimEnd('/')+path)
        if(key.isNotBlank())builder.header("Authorization","Bearer $key")
        if(body!=null)builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        client.newCall(builder.build()).execute().use{response->val value=JSONObject(response.body?.string()?:"{}");if(response.code==409&&value.optString("error").startsWith("remote instance changed"))instanceChanged();check(response.isSuccessful){value.optString("error","连接失败 ${response.code}")};return value}
    }
}
private class RemoteInstanceChangedException(message:String):java.io.IOException(message)
