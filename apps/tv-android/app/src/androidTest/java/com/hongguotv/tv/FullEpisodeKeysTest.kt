package com.hongguotv.tv

import android.content.Context
import android.view.KeyEvent
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.SocketPolicy
import org.junit.Assert.*
import org.junit.Test

class FullEpisodeKeysTest {
    @Test fun fullPlaybackArrowsSwitchEpisodesButRespectMenusAndRepeat() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val prefs = context.getSharedPreferences("hongguotv_tv_v1", Context.MODE_PRIVATE)
        val server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                if (path.contains("/stream")) return MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE)
                val json = when {
                    path.contains("/qualities") -> """{"qualities":[{"key":"720P","label":"720P","qualityNum":720}]}"""
                    path.startsWith("/api/recommend") -> """{"items":[]}"""
                    else -> "{}"
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(json)
            }
        }
        server.start()
        val previousOrigin = prefs.getString("contentTestOrigin", null)
        prefs.edit().putString("contentTestOrigin", server.url("/").toString()).commit()
        try {
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val detail = Detail(Series("key-test", "遥控器切集测试"), (1..3).map { Episode("key-$it", it) })
                scenario.onActivity { activity ->
                    method("playDetailWithRecord").invoke(activity, detail, null, 0, true)
                }
                awaitEpisode(scenario, 0)
                hideChrome(scenario)
                key(scenario, KeyEvent.KEYCODE_DPAD_UP)
                assertIndex(scenario, 0)
                key(scenario, KeyEvent.KEYCODE_DPAD_DOWN)
                awaitEpisode(scenario, 1)
                key(scenario, KeyEvent.KEYCODE_DPAD_DOWN, 2)
                assertIndex(scenario, 1)
                key(scenario, KeyEvent.KEYCODE_DPAD_DOWN)
                awaitEpisode(scenario, 2)
                key(scenario, KeyEvent.KEYCODE_DPAD_DOWN)
                assertIndex(scenario, 2)
                key(scenario, KeyEvent.KEYCODE_DPAD_UP)
                awaitEpisode(scenario, 1)
                scenario.onActivity { activity -> method("revealChrome").invoke(activity) }
                key(scenario, KeyEvent.KEYCODE_DPAD_DOWN)
                assertIndex(scenario, 1)
                scenario.onActivity { activity -> method("showEpisodeDrawer").invoke(activity) }
                key(scenario, KeyEvent.KEYCODE_DPAD_UP)
                assertIndex(scenario, 1)
            }
        } finally {
            prefs.edit().apply { if (previousOrigin == null) remove("contentTestOrigin") else putString("contentTestOrigin", previousOrigin) }.commit()
            server.shutdown()
        }
    }

    private fun method(name: String) = MainActivity::class.java.declaredMethods.first { it.name == name }.apply { isAccessible = true }
    private fun field(name: String) = MainActivity::class.java.getDeclaredField(name).apply { isAccessible = true }
    private fun assertIndex(scenario: ActivityScenario<MainActivity>, expected: Int) {
        scenario.onActivity { activity ->
            assertEquals(expected, field("activeIndex").getInt(activity))
            assertFalse(field("feedMode").getBoolean(activity))
            assertEquals("FULL", field("screen").get(activity)?.toString())
        }
    }
    private fun hideChrome(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> method("hideChromeNow").invoke(activity) }
    }
    private fun key(scenario: ActivityScenario<MainActivity>, code: Int, repeat: Int = 0) {
        if (repeat == 0) {
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(code)
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        } else {
            scenario.onActivity { activity -> activity.dispatchKeyEvent(KeyEvent(0L, 0L, KeyEvent.ACTION_DOWN, code, repeat)) }
        }
    }
    private fun awaitEpisode(scenario: ActivityScenario<MainActivity>, index: Int) {
        val deadline = System.currentTimeMillis() + 8000
        while (System.currentTimeMillis() < deadline) {
            var ready = false
            scenario.onActivity { activity ->
                val player = field("player").get(activity) as? androidx.media3.exoplayer.ExoPlayer
                ready = player?.currentMediaItem?.mediaId == "key-${index + 1}"
            }
            if (ready) { assertIndex(scenario, index); return }
            Thread.sleep(100)
        }
        fail("Episode $index did not load")
    }
}
