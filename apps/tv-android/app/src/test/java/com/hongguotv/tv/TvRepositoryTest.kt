package com.hongguotv.tv

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test

class TvRepositoryTest {
    @Test fun recommendationCarriesStableSessionAcrossPageRetries() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = TvRepository(server.url("/").toString())
            repeat(2) {
                server.enqueue(MockResponse().setBody("{\"items\":[]}"))
                repository.recommend(2, "tv-session")
                val request = server.takeRequest().requestUrl!!
                assertEquals("tv-session", request.queryParameter("session"))
                assertEquals("2", request.queryParameter("page"))
            }
        }
    }
    @Test fun detailAndQualityFollowActualWireContracts() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = TvRepository(server.url("/").toString())
            server.enqueue(MockResponse().setBody("""{"id":"9007199254740993","title":"剧","episodes":[{"id":9007199254740995,"number":1}]}"""))
            val detail = repository.detail("9007199254740993")
            assertEquals("9007199254740995", detail.episodes.single().id)
            assertEquals("第 1 集", detail.episodes.single().title)
            server.enqueue(MockResponse().setBody("""{"qualities":[{"key":"720P","label":"高清","qualityNum":720,"codec":"H.264"},{"key":"1080P","label":"超清","qualityNum":1080,"codec":"HEVC"}]}"""))
            assertEquals(listOf("1080P", "720P"), repository.qualities("9007199254740995", detail.series.id).map { it.key })
        }
    }

    @Test fun cancellationStopsWaitingForAnUnresponsiveServer() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            try {
                withTimeout(250) { TvRepository(server.url("/").toString()).recommend(1) }
                fail("Expected cancellation")
            } catch (_: TimeoutCancellationException) { /* Cancellation remains cancellation, not an API error. */ }
        }
    }

    @Test fun repositoryPreservesLongIdsAndEncodesSearch() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setBody("""{"items":[{"id":9007199254740993,"title":"剧"}]}"""))
            val result = TvRepository(server.url("/").toString()).search("爱情 & 都市", 2)
            assertEquals("9007199254740993", result.single().id)
            val request = server.takeRequest().requestUrl!!
            assertEquals("爱情 & 都市", request.queryParameter("q"))
            assertEquals("2", request.queryParameter("page"))
        }
    }

    @Test fun rejectsWrongServiceAndHttpFailures() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = TvRepository(server.url("/").toString())
            server.enqueue(MockResponse().setBody("""{"service":"other","ok":true}"""))
            try { repository.health(); fail("Expected service validation") } catch (e: TvApiException) { assertTrue(e.message!!.contains("8788")) }
            server.enqueue(MockResponse().setResponseCode(502).setBody("""{"error":"上游不可达"}"""))
            try { repository.recommend(1); fail("Expected HTTP error") } catch (e: TvApiException) { assertTrue(e.message!!.contains("502")) }
        }
    }

    @Test fun malformedListCannotLookLikeEmptySuccess() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setBody("{}"))
            try { TvRepository(server.url("/").toString()).recommend(1); fail("Expected contract error") }
            catch (e: TvApiException) { assertTrue(e.message!!.contains("格式")) }
        }
    }

    @Test fun streamUsesConfiguredBackendAndExactEpisodeAndQuality() {
        val url = okhttp3.HttpUrl.Builder().scheme("http").host("localhost").port(8788).build()
        val stream = TvRepository(url.toString()).streamUrl("9007199254740993", "7000000000000001", "720P").toHttpUrl()
        assertEquals("/api/episodes/9007199254740993/stream", stream.encodedPath)
        assertEquals("7000000000000001", stream.queryParameter("seriesId"))
        assertEquals("720P", stream.queryParameter("quality"))
    }
}
