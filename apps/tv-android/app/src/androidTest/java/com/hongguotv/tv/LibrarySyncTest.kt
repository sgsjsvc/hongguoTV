package com.hongguotv.tv

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LibrarySyncTest {
    @Test fun changedInstanceDuringPullCannotChangeConfigCursorOrOutbox()=runBlocking {
        val context=ApplicationProvider.getApplicationContext<Context>();val library=TvLibrary(context,"instance-test-${System.nanoTime()}.sqlite")
        val event=library.write("favorite","local","set",Series("local","本地剧").toJson());library.merge(emptyList(),listOf(event.getString("id")))
        val server=MockWebServer();server.enqueue(MockResponse().setBody(JSONObject().put("instanceId","replacement-instance").put("serverTime",System.currentTimeMillis()).put("cursor",99).put("hasMore",false).put("events",JSONArray()).toString()));server.start()
        library.setSetting("remoteUrl",server.url("/").toString().trimEnd('/'));library.setSetting("remoteKey","family-key");library.setSetting("instanceId","original-instance");library.setSetting("cursor","7")
        val sync=HistorySync(context,false,library)
        try{
            val error=runCatching{sync.flush()}.exceptionOrNull()
            assertNotNull("Changed instance must require explicit validation",error)
            assertEquals("远程数据实例已更换，请重新验证连接",error!!.message)
            assertEquals("original-instance",library.setting("instanceId"));assertEquals("7",library.setting("cursor"));assertTrue(library.pending().isEmpty())
            assertEquals("远程数据实例已更换，请重新验证连接",sync.status)
        }finally{sync.close();library.close();server.shutdown()}
    }
    @Test fun verifiedConnectionPushesOriginalIdsAndPullsSharedRecords()=runBlocking {
        val context=ApplicationProvider.getApplicationContext<Context>();val library=TvLibrary(context,"sync-test-${System.nanoTime()}.sqlite")
        val original=library.write("favorite","local","set",Series("local","本地剧").toJson())
        val remote=JSONObject(original.toString()).put("id","remote-event").put("deviceId","remote-device").put("key","remote").put("at",System.currentTimeMillis()).put("value",Series("remote","远程剧").toJson())
        val server=MockWebServer();server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest):MockResponse{
            assertEquals("Bearer family-key",request.getHeader("Authorization"))
            val response=JSONObject().put("instanceId","test-instance").put("serverTime",System.currentTimeMillis())
            when{
                request.path=="/api/sync/handshake"->response.put("protocolVersion",1)
                request.path=="/api/sync/push"->{val body=JSONObject(request.body.readUtf8());assertEquals("test-instance",body.getString("instanceId"));val events=body.getJSONArray("events");assertEquals(original.getString("id"),events.getJSONObject(0).getString("id"));response.put("acked",JSONArray(listOf(original.getString("id")))).put("events",events)}
                else->response.put("events",JSONArray(listOf(remote))).put("cursor",1).put("hasMore",false)
            }
            return MockResponse().setBody(response.toString())
        }};server.start()
        val sync=HistorySync(context,false,library)
        try{sync.configure(server.url("/").toString(),"family-key");assertEquals(2,library.rows("favorite").size);assertTrue(library.pending().isEmpty());assertEquals("1",library.setting("cursor"));sync.disable();assertEquals(2,library.rows("favorite").size)}finally{sync.close();library.close();server.shutdown()}
    }
}
