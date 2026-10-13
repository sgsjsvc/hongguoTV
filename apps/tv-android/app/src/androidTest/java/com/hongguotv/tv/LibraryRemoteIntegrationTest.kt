package com.hongguotv.tv

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Opt-in against a temporary QA server, never the installed application's library. */
class LibraryRemoteIntegrationTest {
    @Test fun realRemoteCanonicalPushPullAndReconnectPreserveIdentity()=runBlocking {
        val args=InstrumentationRegistry.getArguments();val url=args.getString("remoteUrl")?:"";val key=args.getString("remoteKey")?:""
        assumeTrue("Supply an isolated QA remote",url.isNotBlank()&&key.isNotBlank())
        val context=ApplicationProvider.getApplicationContext<Context>();val library=TvLibrary(context,"remote-test-${System.nanoTime()}.sqlite")
        val id="tv-integration-${java.util.UUID.randomUUID()}";val series=Series(id,"跨端同步测试")
        library.write("favorite",id,"set",series.toJson())
        val history=library.write("history",id,"set",Progress(series,"9007199254740999",2,4567,14000,false,System.currentTimeMillis()).toHistoryJson())
        library.write("preference","speed","set",JSONObject().put("value",3.0))
        val sync=HistorySync(context,false,library)
        try {
            sync.configure(url,key)
            assertTrue(library.pending().isEmpty())
            assertEquals(4567L,library.rows("history").first{it.getString("key")==id}.getJSONObject("value").getLong("positionMs"))
            assertEquals("9007199254740999",library.rows("history").first{it.getString("key")==id}.getJSONObject("value").getString("episodeId"))
            assertEquals(3.0,library.rows("preference").first{it.getString("key")=="speed"}.getJSONObject("value").getDouble("value"),0.0)
            sync.disable();sync.configure(url,key)
            assertTrue(library.pending().isEmpty())
            assertEquals(history.getString("id"),library.rows("history").first{it.getString("key")==id}.getString("id"))
            InstrumentationRegistry.getInstrumentation().sendStatus(0,android.os.Bundle().apply{putString("stream","\nReal remote TV canonical push/pull/reconnect passed, history $id\n")})
        }finally{sync.close();library.close()}
    }
}
