package com.hongguotv.tv

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class TvInteractionTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var server: MockWebServer
    @Before fun setup() {
        instrumentation.setInTouchMode(false)
        context.getSharedPreferences("hongguotv_tv_v1", Context.MODE_PRIVATE).edit().clear().commit()
        val library=TvLibrary.get(context)
        library.writableDatabase.execSQL("DELETE FROM records")
        library.writableDatabase.execSQL("DELETE FROM versions")
        library.writableDatabase.execSQL("DELETE FROM outbox")
        library.setSetting("remoteUrl","")
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                val body = when {
                    path == "/health" -> """{"service":"hongguotv-custom-bridge","ok":true}"""
                    path.startsWith("/api/history?") -> """{"items":[]}"""
                    path.startsWith("/api/history/") -> """{}"""
                    path.startsWith("/api/recommend") -> """{"items":[{"id":"9001","title":"测试短剧","cover":"","badge":"全2集","tags":"测试","description":"测试简介"}]}"""
                    path.startsWith("/api/category/tags") -> org.json.JSONObject().put("types", org.json.JSONArray("""[{"id":"real-drama","name":"真人剧"},{"id":"comic-drama","name":"漫剧"},{"id":"ai-drama","name":"AI剧"}]""")).put("tags", org.json.JSONArray().apply {
                        if(path.contains("type=comic-drama")||path.contains("type=ai-drama")) {
                            listOf("脑洞","玄幻","剧情","末世","豪门","奇幻","科幻","冒险").forEachIndexed{index,name->put(org.json.JSONObject().put("id",if(index==0)"creative" else "comic$index").put("name",name))}
                        }else{
                        listOf("爱情", "年代", "逆袭", "传奇", "成长", "家庭", "家族", "萌宝", "悬疑", "惊悚", "恐怖", "志怪", "古装", "玄幻", "奇幻", "都市", "青春", "喜剧", "科幻", "灾难", "动作冒险", "战争", "综艺", "剧情").forEachIndexed { index, name -> put(org.json.JSONObject().put("id", if(index==0) "romance" else "tag$index").put("name",name)) }
                        }
                    }).toString()
                    path.startsWith("/api/category/list") -> """{"items":[{"id":"9001","title":"${if(path.contains("tag=romance")) "爱情分类剧" else "分类测试剧"}","cover":"","badge":"全2集"}]}"""
                    path == "/api/series/9001" -> """{"id":"9001","title":"测试短剧","cover":"","badge":"全2集","tags":"测试","description":"简介","episodes":[{"id":"9101","number":1,"title":"第一集"},{"id":"9102","number":2,"title":"第二集"}]}"""
                    path.contains("/qualities") -> """{"qualities":[{"key":"1080P","label":"1080P","qualityNum":1080,"codec":"HEVC"}]}"""
                    else -> return MockResponse().setResponseCode(404).setBody("not available")
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        server.start()
        context.getSharedPreferences("hongguotv_tv_v1",Context.MODE_PRIVATE).edit().putString("contentTestOrigin",server.url("/").toString()).commit()
    }
    @After fun cleanup() { server.shutdown() }
    @Test fun preparingFirstEpisodeDoesNotTreatClearedPlaylistAsEpisodeCompletion() {
        val regular=server.dispatcher
        server.dispatcher=object:Dispatcher(){override fun dispatch(request:RecordedRequest):MockResponse =
            if(request.path.orEmpty().contains("/stream"))MockResponse().setSocketPolicy(okhttp3.mockwebserver.SocketPolicy.NO_RESPONSE) else regular.dispatch(request)}
        val streamUrl=server.url("/api/episodes/9101/stream").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            await(scenario) { views -> views.filterIsInstance<Button>().any { it.contentDescription=="导航：推荐" && it.isShown } }
            await(scenario) { _ ->
                var ready=false
                scenario.onActivity { activity -> ready=MainActivity::class.java.getDeclaredField("player").apply{isAccessible=true}.get(activity)!=null && MainActivity::class.java.getDeclaredField("activeDetail").apply{isAccessible=true}.get(activity)!=null }
                ready
            }
            scenario.onActivity { activity ->
                val field=MainActivity::class.java.getDeclaredField("player").apply { isAccessible=true }
                val player=field.get(activity) as androidx.media3.exoplayer.ExoPlayer
                player.setMediaItem(androidx.media3.common.MediaItem.Builder().setMediaId("9101").setUri(streamUrl).build())
                player.prepare()
                MainActivity::class.java.getDeclaredField("activeIndex").apply {isAccessible=true}.setInt(activity,0)
                val method=MainActivity::class.java.getDeclaredMethod("loadEpisode",Int::class.javaPrimitiveType,Long::class.javaPrimitiveType,Boolean::class.javaPrimitiveType,Boolean::class.javaPrimitiveType,kotlin.jvm.functions.Function0::class.java).apply{isAccessible=true}
                method.invoke(activity,0,0L,true,true,null)
            }
            await(scenario) { _ ->
                var id:String?=null
                scenario.onActivity { activity -> id=(MainActivity::class.java.getDeclaredField("player").apply{isAccessible=true}.get(activity) as androidx.media3.exoplayer.ExoPlayer).currentMediaItem?.mediaId }
                id!=null
            }
            scenario.onActivity { activity ->
                val player=MainActivity::class.java.getDeclaredField("player").apply{isAccessible=true}.get(activity) as androidx.media3.exoplayer.ExoPlayer
                assertEquals("清空旧播放列表不能自动跳到第二集","9101",player.currentMediaItem?.mediaId)
                assertEquals(0,MainActivity::class.java.getDeclaredField("activeIndex").apply{isAccessible=true}.getInt(activity))
            }
        }
    }
    @Test fun categoryFiltersAreExpandedWrapAndKeepRemoteFocusAfterSelection() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            clickNavigation(scenario, "分类")
            await(scenario) { views -> views.filterIsInstance<Button>().count { it.isShown && it.contentDescription?.toString()?.startsWith("分类筛选：") == true } == 28 }
            scenario.onActivity { activity ->
                val buttons = all(activity.window.decorView).filterIsInstance<Button>().filter { it.isShown }
                assertFalse(buttons.any { it.text.toString() in listOf("内容类型", "题材筛选") })
                val tags = buttons.filter { it.contentDescription?.toString()?.startsWith("分类筛选：tag:") == true }
                assertEquals(25, tags.size)
                val positions = tags.map { button -> IntArray(2).also { button.getLocationOnScreen(it) } }
                assertTrue("题材应自动换行", positions.map { it[1] }.distinct().size > 1)
                tags.forEach { button ->
                    val position = IntArray(2); button.getLocationOnScreen(position)
                    assertTrue("全部标签应在屏幕内", position[0]>=0 && position[0]+button.width<=activity.resources.displayMetrics.widthPixels && position[1]+button.height<activity.resources.displayMetrics.heightPixels)
                }
                val romance = tags.first { it.text.toString()=="爱情" }
                romance.requestFocus()
                assertNotNull("遥控器向右可移动焦点", romance.focusSearch(View.FOCUS_RIGHT))
            }
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
            await(scenario) { views -> views.filterIsInstance<TextView>().any { it.isShown && it.text.toString()=="爱情分类剧" } }
            scenario.onActivity { activity ->
                assertEquals("爱情", (activity.currentFocus as? Button)?.text?.toString())
                assertTrue(activity.currentFocus!!.isSelected)
                assertNotNull(activity.currentFocus!!.focusSearch(View.FOCUS_DOWN))
            }
            click(scenario,"漫剧")
            await(scenario){views->views.filterIsInstance<Button>().any{it.text.toString()=="脑洞"&&it.isShown}}
            scenario.onActivity{activity->
                val tags=all(activity.window.decorView).filterIsInstance<Button>().filter{it.isShown&&it.contentDescription?.toString()?.startsWith("分类筛选：tag:")==true}
                assertEquals(9,tags.size)
                assertFalse(tags.any{it.text.toString()=="爱情"})
                assertTrue(tags.first{it.text.toString()=="全部题材"}.isSelected)
            }
        }
    }
    @Test fun televisionHistoryHasNoSourceFiltersAndNoDeletionActions() {
        TvStore(context).baseUrl = server.url("/").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            clickNavigation(scenario, "历史")
            await(scenario) { views -> views.filterIsInstance<Button>().any { it.text.toString() == "刷新" && it.isShown } }
            scenario.onActivity { activity ->
                val labels = all(activity.window.decorView).filterIsInstance<Button>().filter { it.isShown }.map { it.text.toString() }
                assertFalse(labels.any { it in listOf("● 全部", "Web", "电脑", "电视") })
                assertFalse(labels.any { it.contains("删除") || it.contains("清空") })
            }
        }
    }
    private fun all(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { all(view.getChildAt(it)) } else emptyList()
    private fun await(scenario: ActivityScenario<MainActivity>, predicate: (List<View>) -> Boolean) {
        val deadline = System.currentTimeMillis() + 8000
        while (System.currentTimeMillis() < deadline) {
            var ready = false
            scenario.onActivity { ready = predicate(all(it.window.decorView)) }
            if (ready) return
            Thread.sleep(100)
        }
        var labels = ""
        scenario.onActivity { labels = all(it.window.decorView).filterIsInstance<TextView>().filter { it.isShown }.joinToString(" | ") { it.text.toString() } }
        fail("UI condition timed out: $labels")
    }
    private fun click(scenario: ActivityScenario<MainActivity>, label: String) {
        await(scenario) { views -> views.filterIsInstance<Button>().any { it.text.toString() == label && it.isShown } }
        scenario.onActivity { activity ->
            val target = all(activity.window.decorView).filterIsInstance<Button>().first { it.text.toString() == label && it.isShown }
            target.performClick()
        }
    }
    private fun clickNavigation(scenario: ActivityScenario<MainActivity>, label: String) {
        await(scenario) { views -> views.filterIsInstance<Button>().any { it.contentDescription == "导航：$label" && it.isShown } }
        scenario.onActivity { activity -> all(activity.window.decorView).filterIsInstance<Button>().first { it.contentDescription == "导航：$label" }.performClick() }
    }
    @Test fun topNavigationReplacesMainMenuAndNextEpisodeFollowsPlay() {
        val regular = server.dispatcher
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                if (request.path.orEmpty().contains("/stream")) MockResponse().setSocketPolicy(okhttp3.mockwebserver.SocketPolicy.NO_RESPONSE)
                else regular.dispatch(request)
        }
        TvStore(context).baseUrl = server.url("/").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
            await(scenario) { views -> views.filterIsInstance<Button>().any { it.text.toString() == "继续播放" && it.width > 0 && it.hasFocus() } }
            scenario.onActivity { activity ->
                val buttons = all(activity.window.decorView).filterIsInstance<Button>().filter { it.isShown }
                assertFalse("旧主菜单按钮必须移除", buttons.any { it.text.toString() == "主菜单" })
                val labels = buttons.map { it.text.toString() }
                val playIndex = labels.indexOf("继续播放")
                assertTrue(playIndex >= 0)
                assertEquals("下一集", labels[playIndex + 1])
                assertTrue(labels[playIndex + 2].startsWith("合集："))
                assertEquals(7, buttons.count { it.contentDescription?.toString()?.startsWith("导航：") == true })
            }
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_UP)
            scenario.onActivity { assertEquals("导航：推荐", it.currentFocus?.contentDescription) }
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_DOWN)
            scenario.onActivity { assertEquals("继续播放", (it.currentFocus as TextView).text.toString()) }
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_RIGHT)
            scenario.onActivity {
                // Until metadata is loaded, the disabled next-episode action is skipped.
                val label=(it.currentFocus as TextView).text.toString();assertTrue(label=="下一集" || label.startsWith("合集："))
            }
            click(scenario, "继续播放")
            scenario.onActivity { activity ->
                val content = activity.findViewById<ViewGroup>(android.R.id.content)
                assertEquals("继续播放后焦点应回到播放画面", all(content).filterIsInstance<androidx.media3.ui.PlayerView>().single(), activity.currentFocus)
            }
        }
    }
    @Test fun optionalRemoteFailedValidationKeepsOldAddress() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest) = MockResponse().setBody("""{"service":"wrong","ok":true}""")
        }
        val serverAddress = server.url("/").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            clickNavigation(scenario,"设置")
            scenario.onActivity { activity -> val inputs=all(activity.window.decorView).filterIsInstance<EditText>();inputs[0].setText(serverAddress);inputs[1].setText("test-key") }
            click(scenario, "验证并开启同步")
            await(scenario) { views -> views.filterIsInstance<TextView>().any { it.text.contains("protocolVersion") || it.text.contains("不支持") } }
            assertEquals("", TvStore(context).baseUrl)
        }
    }
    @Test fun localLibraryPersistsStableIdsWithoutHistoryDeletion() {
        val store = TvStore(context)
        store.baseUrl = server.url("/").toString()
        val series = Series("7691228619774905368", "收藏测试", "", "", "", "")
        store.toggleFavorite(series)
        store.saveProgress(Progress(series, "7691228619774905369", 2, 42000, 100000, false, 1))
        val reopened = TvStore(context)
        assertTrue(reopened.isFavorite(series.id))
        assertEquals(42000L, reopened.progress(series.id)!!.positionMs)
        assertEquals(42000L,TvStore(context).history().first{it.series.id==series.id}.positionMs)
        assertEquals(server.url("/").toString().trimEnd('/'), reopened.baseUrl)
    }
    @Test fun delayedRecommendationCannotLeaveMenuAndAllDestinationsRemainReachable() {
        val regular = server.dispatcher
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = regular.dispatch(request).apply {
                if (request.path.orEmpty().startsWith("/api/recommend")) setBodyDelay(1500, TimeUnit.MILLISECONDS)
            }
        }
        TvStore(context).baseUrl = server.url("/").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
            clickNavigation(scenario, "追剧")
            Thread.sleep(2200)
            await(scenario) { views -> views.filterIsInstance<TextView>().any { it.text.toString() == "暂时没有内容" && it.isShown } }
            // Exercise the registered navigation callback; hardware Back is also checked on the real TV.
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            clickNavigation(scenario, "设置")
            await(scenario) { views -> views.filterIsInstance<Button>().any { it.text.toString() == "验证并开启同步" && it.isShown } }
        }
    }
    @Test fun returningFromLoadingDetailInvalidatesItsResponse() {
        val regular = server.dispatcher
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = regular.dispatch(request).apply {
                if (request.path == "/api/series/9001") setBodyDelay(1500, TimeUnit.MILLISECONDS)
            }
        }
        val store = TvStore(context)
        store.baseUrl = server.url("/").toString()
        store.toggleFavorite(Series("9001", "测试短剧", "", "", "", ""))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
            clickNavigation(scenario, "追剧")
            scenario.onActivity { activity ->
                val card = all(activity.window.decorView).first { it.contentDescription?.toString()?.startsWith("测试短剧") == true }
                card.performClick()
            }
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            Thread.sleep(2000)
            await(scenario) { views -> views.filterIsInstance<TextView>().any { it.text.toString() == "我的收藏" && it.isShown } }
        }
    }
    @Test fun backgroundDuringRecommendationDoesNotCreatePlayer() {
        val regular = server.dispatcher
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = regular.dispatch(request).apply {
                if (request.path.orEmpty().startsWith("/api/recommend")) setBodyDelay(1500, TimeUnit.MILLISECONDS)
            }
        }
        TvStore(context).baseUrl = server.url("/").toString()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            Thread.sleep(2000)
            scenario.onActivity { activity ->
                val field = MainActivity::class.java.getDeclaredField("player").apply { isAccessible = true }
                assertNull(field.get(activity))
            }
        }
    }
}
