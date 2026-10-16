package com.hongguotv.tv

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import okio.Buffer
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

/** Real ImageViews and local HTTP: no content source or application preferences are touched. */
class ArtworkRenderingTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun ui(block: () -> Unit) = instrumentation.runOnMainSync(block)
    private fun await(predicate: () -> Boolean) {
        val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(8)
        while (System.nanoTime() < end) {
            var ready = false
            ui { ready = predicate() }
            if (ready) return
            Thread.sleep(20)
        }
        fail("Image state did not settle")
    }
    private fun url(server: MockWebServer, path: String) = "http://127.0.0.1:${server.port}$path"
    private fun imageResponse(color: Int = Color.RED) = MockResponse().setBody(Buffer().write(
        ByteArrayOutputStream().use { stream ->
            Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888).apply { eraseColor(color) }
                .compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.toByteArray()
        }
    ))
    private class RecordingImage(context: android.content.Context) : ImageView(context) {
        var clears = 0
        override fun setImageDrawable(drawable: Drawable?) {
            if (drawable == null) clears++
            super.setImageDrawable(drawable)
        }
    }
    private fun fixture(block: (ArtworkLoader, MockWebServer) -> Unit) {
        val server = MockWebServer()
        server.start()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val loader = ArtworkLoader(scope)
        try { block(loader, server) } finally {
            ui { loader.close(); scope.cancel() }
            server.shutdown()
        }
    }

    @Test fun cachedAndAlreadyDisplayedImagesNeverClear() = fixture { loader, server ->
        server.enqueue(imageResponse())
        lateinit var first: RecordingImage
        lateinit var second: RecordingImage
        val url = url(server, "/cached")
        ui {
            first = RecordingImage(instrumentation.targetContext)
            second = RecordingImage(instrumentation.targetContext)
            loader.load(url, first)
        }
        await { first.drawable != null }
        ui {
            val old = first.drawable
            val clears = first.clears
            loader.load(url, first)
            assertSame("Same image must keep its drawable", old, first.drawable)
            assertEquals(clears, first.clears)
            loader.load(url, second)
            assertNotNull(second.drawable)
            assertEquals("Cache hit must not blank the target", 0, second.clears)
        }
        assertEquals(1, server.requestCount)
    }

    @Test fun repeatedBindSharesPendingRequestForTarget() = fixture { loader, server ->
        server.enqueue(imageResponse().setBodyDelay(300, TimeUnit.MILLISECONDS))
        lateinit var image: ImageView
        ui {
            image = ImageView(instrumentation.targetContext)
            repeat(20) { loader.load(url(server, "/same"), image) }
        }
        await { image.drawable != null }
        Thread.sleep(100)
        assertEquals("Same target and URL must not start duplicate requests", 1, server.requestCount)
    }

    @Test fun imageRequestsHaveRealNetworkConcurrencyLimit() = fixture { loader, server ->
        repeat(16) { server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE)) }
        val images = mutableListOf<ImageView>()
        ui {
            repeat(16) {
                val image = ImageView(instrumentation.targetContext)
                images.add(image)
                loader.load(url(server, "/blocked-$it"), image)
            }
        }
        Thread.sleep(1000)
        assertTrue("Expected at least one HTTP request", server.requestCount > 0)
        assertTrue("In-flight HTTP limit must be 4, actual ${server.requestCount}", server.requestCount <= 4)
    }

    @Test fun recycledHolderClearsImageAndLateResponseCannotRepopulate() = fixture { loader, server ->
        server.enqueue(imageResponse().setBodyDelay(300, TimeUnit.MILLISECONDS))
        lateinit var holder: SeriesAdapter.Holder
        ui {
            val adapter = SeriesAdapter(listOf(Series("1", "test", url(server, "/late"))), loader, {}, {})
            holder = adapter.onCreateViewHolder(FrameLayout(instrumentation.targetContext), 0)
            adapter.onBindViewHolder(holder, 0)
            holder.card.scaleX = 1.04f
            holder.card.scaleY = 1.04f
            adapter.onViewRecycled(holder)
            assertNull(holder.image.tag)
            assertNull(holder.image.drawable)
            assertEquals(1f, holder.card.scaleX)
        }
        Thread.sleep(650)
        ui { assertNull(holder.image.drawable) }
    }

    @Test fun rankGradientsAreReusedPerHolderAndAllFourStylesStayDistinct() = fixture { loader, _ ->
        ui {
            val adapter = SeriesAdapter((1..4).map { Series("$it", "rank $it") }, loader, {}, {}, isRank = true)
            val holder = adapter.onCreateViewHolder(FrameLayout(instrumentation.targetContext), 0)
            val styles = (0..3).map { position ->
                adapter.onBindViewHolder(holder, position)
                holder.rankBadge.background
            }
            assertEquals(4, styles.toSet().size)
            (0..3).forEach { position ->
                adapter.onBindViewHolder(holder, position)
                assertSame("Rank drawable should be constructed once per holder", styles[position], holder.rankBadge.background)
            }
        }
    }

    @Test fun oldResponseCannotReplaceNewCover() = fixture { loader, server ->
        server.enqueue(imageResponse(Color.RED).setBodyDelay(500, TimeUnit.MILLISECONDS))
        server.enqueue(imageResponse(Color.BLUE))
        lateinit var image: ImageView
        ui { image = ImageView(instrumentation.targetContext); loader.load(url(server, "/old"), image) }
        assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
        ui { loader.load(url(server, "/new"), image) }
        await { image.drawable != null }
        Thread.sleep(600)
        ui {
            assertEquals(url(server, "/new"), image.tag)
            val bitmap = (image.drawable as android.graphics.drawable.BitmapDrawable).bitmap
            assertEquals(Color.BLUE, bitmap.getPixel(0, 0))
        }
    }

    @Test fun recyclingCancelsActiveCallAndFreesSlotForNextCover() = fixture { loader, server ->
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse =
                if (request.path == "/next") imageResponse(Color.GREEN)
                else MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE)
        }
        val images = mutableListOf<ImageView>()
        ui {
            repeat(4) { index ->
                images.add(ImageView(instrumentation.targetContext).also { loader.load(url(server, "/blocked-$index"), it) })
            }
        }
        repeat(4) { assertNotNull(server.takeRequest(2, TimeUnit.SECONDS)) }
        lateinit var next: ImageView
        ui {
            loader.clear(images.first())
            next = ImageView(instrumentation.targetContext)
            loader.load(url(server, "/next"), next)
        }
        await { next.drawable != null }
        assertEquals(5, server.requestCount)
        ui { assertNull(images.first().tag); assertNull(images.first().drawable) }
    }

    @Test fun failedCoverCanRetrySameUrl() = fixture { loader, server ->
        server.enqueue(MockResponse().setResponseCode(404))
        server.enqueue(imageResponse(Color.GREEN))
        lateinit var image: ImageView
        ui { image = ImageView(instrumentation.targetContext); loader.load(url(server, "/retry"), image) }
        assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
        // Wait for the failure to be delivered on the UI dispatcher before requesting retry.
        Thread.sleep(150)
        ui { loader.load(url(server, "/retry"), image) }
        await { image.drawable != null }
        assertEquals(2, server.requestCount)
    }

    @Test fun returningToSameUrlRejectsEarlierGeneration() = fixture { loader, server ->
        val aRequests = java.util.concurrent.atomic.AtomicInteger()
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse = when {
                request.path != "/a" -> MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE)
                aRequests.incrementAndGet() == 1 -> imageResponse(Color.RED).setBodyDelay(500, TimeUnit.MILLISECONDS)
                else -> imageResponse(Color.BLUE)
            }
        }
        lateinit var image: ImageView
        ui { image = ImageView(instrumentation.targetContext); loader.load(url(server, "/a"), image) }
        assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
        ui { loader.load(url(server, "/b"), image); loader.load(url(server, "/a"), image) }
        await { (image.drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap?.getPixel(0, 0) == Color.BLUE }
        Thread.sleep(650)
        ui {
            assertEquals("An earlier A response must not overwrite the new A", Color.BLUE,
                (image.drawable as android.graphics.drawable.BitmapDrawable).bitmap.getPixel(0, 0))
        }
    }
}
