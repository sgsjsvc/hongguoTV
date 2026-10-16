package com.hongguotv.tv

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import androidx.recyclerview.widget.RecyclerView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.hongguotv.tv.ui.CatalogScreenView
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okio.Buffer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File

/** Exercises the real category/rank/search screens against deterministic, distinct covers. */
class CatalogRenderingTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun field(name: String) = MainActivity::class.java.getDeclaredField(name).apply { isAccessible = true }
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup)
        (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun color(index: Int) = Color.rgb(40 + index * 37 % 190, 40 + index * 53 % 190, 40 + index * 71 % 190)
    private fun shell(command: String) = instrumentation.uiAutomation.executeShellCommand(command).use {
        android.os.ParcelFileDescriptor.AutoCloseInputStream(it).bufferedReader().readText()
    }
    private fun await(scenario: ActivityScenario<MainActivity>, predicate: (MainActivity) -> Boolean) {
        repeat(400) {
            var ready = false
            scenario.onActivity { activity -> ready = predicate(activity) }
            if (ready) return
            Thread.sleep(20)
        }
        fail("Catalog rendering did not settle")
    }

    @Test fun scrollCategoryRankSearchWithCorrectCoversAndFilters() {
        val prefs = context.getSharedPreferences("hongguotv_tv_v1", Context.MODE_PRIVATE)
        val previous = prefs.getString("contentTestOrigin", null)
        val server = MockWebServer()
        server.start()
        val origin = "http://127.0.0.1:${server.port}"
        val rows = JSONArray().apply {
            repeat(120) { put(JSONObject().put("id", "${10000 + it}").put("title", "测试封面 ${it + 1}")
                .put("cover", "$origin/poster/$it").put("badge", "全20集")) }
        }
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                if (path.startsWith("/poster/")) {
                    val index = path.substringAfterLast('/').toInt()
                    val bytes = ByteArrayOutputStream().use { stream ->
                        Bitmap.createBitmap(60, 90, Bitmap.Config.ARGB_8888).apply { eraseColor(color(index)) }
                            .compress(Bitmap.CompressFormat.PNG, 100, stream)
                        stream.toByteArray()
                    }
                    return MockResponse().setBody(Buffer().write(bytes))
                }
                val json = when {
                    path.startsWith("/api/category/tags") -> """{"types":[{"id":"real-drama","name":"真人剧"},{"id":"comic-drama","name":"漫剧"},{"id":"ai-drama","name":"AI剧"}],"tags":[{"id":"romance","name":"爱情"},{"id":"family","name":"家庭"}]}"""
                    path.startsWith("/api/rank/types") -> """{"types":[{"id":"hot-drama","name":"热播榜"}]}"""
                    path.startsWith("/api/category/list") || path.startsWith("/api/rank/list") || path.startsWith("/api/search") ->
                        JSONObject().put("items", rows).put("pagination", JSONObject().put("totalPages", 1)).toString()
                    else -> """{"items":[]}"""
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(json)
            }
        }
        prefs.edit().putString("contentTestOrigin", origin).commit()
        val label = InstrumentationRegistry.getArguments().getString("p4Label", "after")
        val output = File(context.getExternalFilesDir(null), "p4-$label").apply { mkdirs() }
        val open = MainActivity::class.java.getDeclaredMethod("openCatalog", String::class.java, String::class.java).apply { isAccessible = true }
        try {
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                // An empty recommendation fixture intentionally has no active player.
                instrumentation.waitForIdleSync()
                listOf("category", "rank", "search").forEach { source ->
                    scenario.onActivity { activity ->
                        field("searchQuery").set(activity, "封面")
                        open.invoke(activity, "渲染验证 $source", source)
                    }
                    await(scenario) { activity ->
                        val grid = field("catalogGrid").get(activity) as? RecyclerView
                        val catalog = field("currentCatalogView").get(activity) as? CatalogScreenView
                        catalog?.source == source && grid?.adapter?.itemCount == 120 && grid.childCount > 0
                    }
                    fun checkCovers() {
                        await(scenario) { activity ->
                            val grid = field("catalogGrid").get(activity) as RecyclerView
                            (0 until grid.childCount).all { index ->
                                val holder = grid.getChildViewHolder(grid.getChildAt(index)) as SeriesAdapter.Holder
                                val position = holder.bindingAdapterPosition
                                position >= 0 && holder.image.tag == "$origin/poster/$position" &&
                                    (holder.image.drawable as? BitmapDrawable)?.bitmap?.getPixel(0, 0) == color(position)
                            }
                        }
                    }
                    fun screenshot(name: String) {
                        checkCovers()
                        instrumentation.waitForIdleSync()
                        Thread.sleep(100) // Let the newly loaded page reach the compositor.
                        instrumentation.uiAutomation.takeScreenshot().also { image ->
                            File(output, "$source-$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
                            image.recycle()
                        }
                    }
                    screenshot("start")
                    File(output, "$source-memory-start.txt").writeText(shell("dumpsys meminfo com.hongguotv.tv"))
                    shell("dumpsys gfxinfo com.hongguotv.tv reset")
                    repeat(40) { step ->
                        scenario.onActivity { activity ->
                            (field("catalogGrid").get(activity) as RecyclerView).scrollBy(0, if (step < 20) 150 else -150)
                        }
                        Thread.sleep(45)
                    }
                    screenshot("return")
                    File(output, "$source-gfx.txt").writeText(shell("dumpsys gfxinfo com.hongguotv.tv"))
                    File(output, "$source-memory-end.txt").writeText(shell("dumpsys meminfo com.hongguotv.tv"))
                    if (source == "category") {
                        scenario.onActivity { activity ->
                            val button = views(activity.window.decorView).filterIsInstance<Button>()
                                .first { it.contentDescription == "分类筛选：tag:romance" }
                            button.requestFocus()
                            button.performClick()
                        }
                        await(scenario) { (field("currentCatalogView").get(it) as? CatalogScreenView)?.selectedTag == "romance" &&
                            (field("catalogGrid").get(it) as? RecyclerView)?.adapter?.itemCount == 120 }
                        checkCovers()
                    }
                    if (source == "rank") {
                        scenario.onActivity { activity ->
                            val grid = field("catalogGrid").get(activity) as RecyclerView
                            val adapter = grid.adapter as SeriesAdapter
                            val holder = adapter.onCreateViewHolder(grid, 0)
                            (0..3).forEach { position ->
                                adapter.onBindViewHolder(holder, position)
                                assertEquals("Top ${position + 1}", holder.rankBadge.text.toString())
                                val canvasBitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
                                holder.rankBadge.background.setBounds(0, 0, 32, 32)
                                holder.rankBadge.background.draw(android.graphics.Canvas(canvasBitmap))
                                val pixel = canvasBitmap.getPixel(16, 16)
                                when (position) {
                                    0 -> assertTrue(Color.red(pixel) > 240 && Color.green(pixel) > 140)
                                    1 -> assertTrue(Color.blue(pixel) > Color.red(pixel))
                                    2 -> assertTrue(Color.red(pixel) > 230 && Color.green(pixel) < 140)
                                    3 -> assertTrue(Color.red(pixel) < 50)
                                }
                            }
                            (adapter as RecyclerView.Adapter<SeriesAdapter.Holder>).onViewRecycled(holder)
                        }
                    }
                }
            }
        } finally {
            prefs.edit().apply { if (previous == null) remove("contentTestOrigin") else putString("contentTestOrigin", previous) }.commit()
            server.shutdown()
        }
    }
}
