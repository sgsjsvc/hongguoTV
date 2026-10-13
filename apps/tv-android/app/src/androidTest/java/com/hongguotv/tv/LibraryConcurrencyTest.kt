package com.hongguotv.tv

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class LibraryConcurrencyTest {
    @Test fun syncingBatchAndPreferenceReaderCannotDeadlock() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val merging=CountDownLatch(1);val release=CountDownLatch(1)
        // Pause at the real merge seam, without replacing Android SQLite or its locking.
        val library=object:TvLibrary(context,"concurrent-${System.nanoTime()}.sqlite"){
            override fun merge(events:List<JSONObject>,acked:List<String>){
                merging.countDown();check(release.await(5,TimeUnit.SECONDS));super.merge(events,acked)
            }
        }
        val syncDone=CountDownLatch(1);val readDone=CountDownLatch(1);val readStarted=CountDownLatch(1)
        val failure=AtomicReference<Throwable?>();val result=AtomicReference<List<JSONObject>>()
        val server=MockWebServer();server.start()
        val event=JSONObject().put("id","quality-event").put("deviceId","remote").put("seq",1).put("at",System.currentTimeMillis()).put("kind","preference").put("key","quality").put("op","set").put("value",JSONObject().put("value","720P"))
        server.enqueue(MockResponse().setBody(JSONObject().put("instanceId","test-instance").put("serverTime",System.currentTimeMillis()).put("cursor",1).put("hasMore",false).put("events",JSONArray(listOf(event))).toString()))
        library.setSetting("remoteUrl",server.url("/").toString().trimEnd('/'));library.setSetting("remoteKey","family-key");library.setSetting("instanceId","test-instance")
        val sync=HistorySync(context,false,library)
        val background=Thread{try{runBlocking{sync.flush()}}catch(error:Throwable){failure.set(error)}finally{syncDone.countDown()}}.apply{isDaemon=true}
        val reader=Thread{readStarted.countDown();try{result.set(library.rows("preference"))}catch(error:Throwable){failure.set(error)}finally{readDone.countDown()}}.apply{isDaemon=true}
        try{
            background.start();assertTrue(merging.await(5,TimeUnit.SECONDS));reader.start();assertTrue(readStarted.await(1,TimeUnit.SECONDS))
            val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(1)
            while(reader.state==Thread.State.RUNNABLE&&System.nanoTime()<deadline)Thread.sleep(5)
            release.countDown()
            assertTrue("Sync and UI preference reader must finish without lock inversion",syncDone.await(2,TimeUnit.SECONDS))
            assertTrue("Preference reader must resume after the sync commit",readDone.await(2,TimeUnit.SECONDS))
            failure.get()?.let{throw AssertionError(it)}
            assertEquals("720P",result.get().single().getJSONObject("value").getString("value"));assertEquals("1",library.setting("cursor"))
        }finally{release.countDown();sync.close();server.shutdown();if(syncDone.count==0L&&readDone.count==0L)library.close()}
    }
}
