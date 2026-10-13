package com.hongguotv.tv

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class StandaloneEngineTest {
    @Test fun recommendationsMixTypesAndKeepSessionPagesStable() {
        LocalContentService(ApplicationProvider.getApplicationContext()).use { service ->
            val repository=TvRepository(service.baseUrl)
            kotlinx.coroutines.runBlocking {
                val session=java.util.UUID.randomUUID().toString()
                val first=repository.recommend(1,session)
                assertEquals(24,first.size)
                assertEquals(setOf("real-drama","comic-drama","ai-drama"),first.map { it.contentType }.toSet())
                assertEquals(first,repository.recommend(1,session))
                val second=repository.recommend(2,session)
                assertTrue(second.none { row -> first.any { it.id==row.id } })
                assertNotEquals(first.map { it.id },repository.recommend(1,java.util.UUID.randomUUID().toString()).map { it.id })
                android.util.Log.i("HongguoRecommendation","Native mixed feed ${first.groupingBy { it.contentType }.eachCount()}, page2=${second.size}, stable retry and fresh session passed")
            }
        }
    }
    @Test fun localMediaEndpointPlaysWithoutAnyOtherDevice() {
        val context=ApplicationProvider.getApplicationContext<android.content.Context>()
        LocalContentService(context).use { service ->
            val started=System.currentTimeMillis()
            val repository=TvRepository(service.baseUrl)
            val series=kotlinx.coroutines.runBlocking {repository.recommend(1).first()}
            val recommended=System.currentTimeMillis()
            val detail=kotlinx.coroutines.runBlocking {repository.detail(series.id)}
            val detailed=System.currentTimeMillis()
            val quality=kotlinx.coroutines.runBlocking {repository.qualities(detail.episodes.first().id,series.id).first()}
            val qualified=System.currentTimeMillis()
            val latch=java.util.concurrent.atomic.AtomicReference(java.util.concurrent.CountDownLatch(1))
            var error:String?=null
            var player:androidx.media3.exoplayer.ExoPlayer?=null
            val instrumentation=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
            instrumentation.runOnMainSync {
                val factory=androidx.media3.datasource.DefaultHttpDataSource.Factory().setReadTimeoutMs(120000)
                player=androidx.media3.exoplayer.ExoPlayer.Builder(context).setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(context).setDataSourceFactory(factory)).build()
                player!!.addListener(object:androidx.media3.common.Player.Listener {
                    override fun onPlaybackStateChanged(state:Int){if(state==androidx.media3.common.Player.STATE_READY)latch.get().countDown()}
                    override fun onPlayerError(value:androidx.media3.common.PlaybackException){error=value.toString()+" "+value.cause;latch.get().countDown()}
                })
                player!!.setMediaItem(androidx.media3.common.MediaItem.fromUri(repository.streamUrl(detail.episodes.first().id,series.id,quality.key)))
                player!!.prepare();player!!.play()
            }
            try {
                assertTrue("Playback preparation timed out",latch.get().await(180,java.util.concurrent.TimeUnit.SECONDS))
                instrumentation.sendStatus(0,android.os.Bundle().apply{putString("stream","\nStandalone phases ms: recommend=${recommended-started}, detail=${detailed-recommended}, qualities=${qualified-detailed}, ready=${System.currentTimeMillis()-qualified}, lastJs=${service.lastEngineMillis}, lastNativeMedia=${service.lastMediaMillis}\n")})
                assertNull("Standalone media playback failed",error)
                Thread.sleep(2500)
                instrumentation.runOnMainSync {assertTrue("Playback position must advance",player!!.currentPosition>1000)}
                latch.set(java.util.concurrent.CountDownLatch(1))
                var target=0L
                instrumentation.runOnMainSync {target=player!!.duration/2;player!!.seekTo(target)}
                assertTrue("Seek must load another decrypted Range",latch.get().await(40,java.util.concurrent.TimeUnit.SECONDS))
                assertNull("Seek playback failed",error)
                Thread.sleep(1500)
                instrumentation.runOnMainSync {assertTrue("Playback after seek must advance",player!!.currentPosition>target+500)}
            }finally{instrumentation.runOnMainSync{player?.release()}}
        }
    }
    @Test fun initializedRuntimeCanMoveToMediaWorkerThread(){
        StandaloneEngine(ApplicationProvider.getApplicationContext()).use{engine->
            val executor=java.util.concurrent.Executors.newSingleThreadExecutor()
            try{assertEquals("{\"ok\":true}",executor.submit<String>{engine.evaluate("Promise.resolve({ok:true})")}.get(5,java.util.concurrent.TimeUnit.SECONDS))}finally{executor.shutdownNow()}
        }
    }
    @Test fun nativeRuntimeSupportsSigningPrimitivesAndPromises() {
        StandaloneEngine(ApplicationProvider.getApplicationContext()).use { engine ->
            val result = JSONObject(engine.evaluate("Promise.resolve({md5:crypto.createHash('md5').update('abc').digest('hex'),sm3:crypto.createHash('sm3').update('abc').digest('hex'),big:String(1n<<64n),buffer:Buffer.from('01020304','hex').readUInt32LE(0)})"))
            assertEquals("900150983cd24fb0d6963f7d28e17f72", result.getString("md5"))
            assertEquals("66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0", result.getString("sm3"))
            assertEquals("18446744073709551616", result.getString("big"))
            assertEquals(67305985, result.getInt("buffer"))
        }
    }
    @Test fun bundledEngineFetchesDirectContentWithoutLocalBackend() {
        StandaloneEngine(ApplicationProvider.getApplicationContext()).use { engine ->
            val result = JSONObject(engine.evaluate("(async()=>{const raw=await categoryPage('sort_type=1');const cards=categoryData(raw).map(itemToCard); if(!cards.length)throw Error('No recommendations '+JSON.stringify(raw).slice(0,1000)); const detail=await rule.二级.call({orId:cards[0].url});const vid=detail.vod_play_url.split('$$$')[0].split('#')[0].split('$')[1].split('|')[0];const info=await fetchVideoInfo(vid);const stream=await resolveStream(vid,info.rows[0].key);const prepared=await prepareHeader(stream);const remote=await remoteRange(stream,0,Math.min(prepared.total,1048576)-1);const bytes=decryptPartial(remote.data,0,stream.key,prepared);return {title:detail.vod_name,vid,qualities:info.rows.length,total:prepared.total,ftyp:bytes.subarray(4,8).toString('ascii'),length:bytes.length};})()"))
            assertTrue(result.getString("title").isNotBlank())
            assertTrue(result.getInt("qualities") > 0)
            assertEquals("ftyp", result.getString("ftyp"))
            assertTrue(result.getLong("total") > result.getInt("length"))
            android.util.Log.i("HongguoStandalone", result.toString())
        }
    }
}
