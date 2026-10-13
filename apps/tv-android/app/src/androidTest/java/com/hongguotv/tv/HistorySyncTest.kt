package com.hongguotv.tv

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.*
import okhttp3.mockwebserver.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class HistorySyncTest {
    private val context get()=ApplicationProvider.getApplicationContext<Context>()
    private fun record(position:Long)=Progress(Series("9007199254740993","同步测试"),"9007199254740995",2,position,90000,false,System.currentTimeMillis())
    private fun write(library:TvLibrary,position:Long)=library.write("history",record(position).series.id,"set",record(position).toHistoryJson())
    private fun configureLocally(library:TvLibrary,server:MockWebServer){
        library.setSetting("remoteUrl",server.url("/").toString().trimEnd('/'))
        library.setSetting("remoteKey","family-key");library.setSetting("instanceId","test-instance");library.setSetting("cursor","0")
    }
    private fun reply(request:RecordedRequest):MockResponse {
        val json=JSONObject().put("instanceId","test-instance").put("serverTime",System.currentTimeMillis())
        if(request.path=="/api/sync/push"){
            val events=JSONObject(request.body.readUtf8()).getJSONArray("events")
            json.put("acked",JSONArray((0 until events.length()).map{events.getJSONObject(it).getString("id")})).put("events",events)
        }else json.put("events",JSONArray()).put("cursor",1).put("hasMore",false)
        return MockResponse().setBody(json.toString())
    }
    @Test fun failedUploadSurvivesClientRecreationAndAcknowledgementRemovesIt()=runBlocking {
        MockWebServer().use{server->
            server.start();server.enqueue(MockResponse().setResponseCode(503).setBody("{}"))
            val name="restart-sync-${System.nanoTime()}.sqlite";val library=TvLibrary(context,name)
            configureLocally(library,server);val original=write(library,12345);val sync=HistorySync(context,false,library)
            try{assertNotNull(runCatching{sync.flush()}.exceptionOrNull());assertEquals(original.getString("id"),library.pending().single().getString("id"))}finally{sync.close();library.close()}
            server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest)=reply(request)}
            val reopened=TvLibrary(context,name);val retry=HistorySync(context,false,reopened)
            try{retry.flush();assertTrue(reopened.pending().isEmpty());assertEquals(12345L,reopened.rows("history").single().getJSONObject("value").getLong("positionMs"))}finally{retry.close();reopened.close()}
        }
    }
    @Test fun delayedAckPreservesNewerDurableEvent()=runBlocking {
        MockWebServer().use{server->
            val received=CountDownLatch(1);val release=CountDownLatch(1);var first=true
            server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest):MockResponse{
                if(request.path=="/api/sync/push"&&first){first=false;received.countDown();release.await(5,TimeUnit.SECONDS)}
                return reply(request)
            }};server.start()
            val library=TvLibrary(context,"delayed-sync-${System.nanoTime()}.sqlite");configureLocally(library,server);write(library,1000);val sync=HistorySync(context,false,library)
            try{val upload=async(Dispatchers.IO){sync.flush()};assertTrue(received.await(5,TimeUnit.SECONDS));val newer=write(library,2000);release.countDown();upload.await()
                assertEquals(newer.getString("id"),library.rows("history").single().getString("id"));assertEquals(2000L,library.rows("history").single().getJSONObject("value").getLong("positionMs"));assertTrue(library.pending().isEmpty())
            }finally{release.countDown();sync.close();library.close()}
        }
    }
    @Test fun failedRemoteConfigurationPreservesOriginalTargetAndLocalData()=runBlocking {
        MockWebServer().use{candidate->
            candidate.start();candidate.enqueue(MockResponse().setResponseCode(401).setBody("{\"error\":\"invalid shared key\"}"))
            val library=TvLibrary(context,"config-sync-${System.nanoTime()}.sqlite");library.setSetting("remoteUrl","http://127.0.0.1:12345");library.setSetting("remoteKey","original-key");library.setSetting("instanceId","original-instance");library.setSetting("cursor","7");val event=write(library,3000);val sync=HistorySync(context,false,library)
            try{assertNotNull(runCatching{sync.configure(candidate.url("/").toString(),"bad-key")}.exceptionOrNull());assertEquals("http://127.0.0.1:12345",sync.remoteUrl);assertEquals("original-key",sync.remoteKey);assertEquals("7",library.setting("cursor"));assertEquals(event.getString("id"),library.pending().single().getString("id"))}finally{sync.close();library.close()}
        }
    }
    @Test fun localProgressReadAndWriteDoNotWaitForHungRemote()=runBlocking {
        MockWebServer().use{server->
            val received=CountDownLatch(1);val release=CountDownLatch(1)
            server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest):MockResponse{if(request.path=="/api/sync/push"){received.countDown();release.await(5,TimeUnit.SECONDS)};return reply(request)}};server.start()
            val library=TvLibrary(context,"hung-sync-${System.nanoTime()}.sqlite");configureLocally(library,server);write(library,1000);val sync=HistorySync(context,false,library)
            try{val background=async(Dispatchers.IO){sync.flush()};assertTrue(received.await(5,TimeUnit.SECONDS))
                withTimeout(1000){withContext(Dispatchers.IO){assertEquals(1000L,library.rows("history").single().getJSONObject("value").getLong("positionMs"));write(library,3000)}}
                release.countDown();background.await();assertEquals(3000L,library.rows("history").single().getJSONObject("value").getLong("positionMs"))
            }finally{release.countDown();sync.close();library.close()}
        }
    }
}
