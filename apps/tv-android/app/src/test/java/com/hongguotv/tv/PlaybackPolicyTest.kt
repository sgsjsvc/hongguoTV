package com.hongguotv.tv

import org.junit.Assert.*
import org.junit.Test

class PlaybackPolicyTest {
    private fun series(id: String) = Series(id, id)

    @Test fun progressIsSavedOnlyForTheMediaCurrentlyLoaded() {
        assertFalse(PlaybackPolicy.canSaveProgress("new-episode", "old-episode"))
        assertFalse(PlaybackPolicy.canSaveProgress("new-episode", null))
        assertTrue(PlaybackPolicy.canSaveProgress("new-episode", "new-episode"))
    }

    @Test fun normalizesOnlyServerOrigins() {
        assertEquals("http://192.168.1.21:8788", PlaybackPolicy.normalizeBaseUrl(" 192.168.1.21:8788/ "))
        assertEquals("https://example.com", PlaybackPolicy.normalizeBaseUrl("https://example.com/"))
        listOf("", "http://user:pass@host", "http://host/api", "http://host?q=x", "ftp://host", "http://host#frag").forEach {
            assertThrows(IllegalArgumentException::class.java) { PlaybackPolicy.normalizeBaseUrl(it) }
        }
    }

    @Test fun paginatedMergeKeepsExistingOrderAndDistinctIds() {
        val first = listOf(series("9007199254740993"), series("2"))
        val merged = PlaybackPolicy.mergeUnique(first, listOf(series("2"), series("3")))
        assertEquals(listOf("9007199254740993", "2", "3"), merged.map { it.id })
        assertEquals(1, PlaybackPolicy.restoredIndex(merged, "2"))
        assertEquals(0, PlaybackPolicy.restoredIndex(merged, "missing"))
    }

    @Test fun seeksClampWithoutTreatingUnknownDurationAsZero() {
        assertEquals(0L, PlaybackPolicy.seek(5_000, -10_000, 60_000))
        assertEquals(60_000L, PlaybackPolicy.seek(55_000, 10_000, 60_000))
        assertEquals(65_000L, PlaybackPolicy.seek(55_000, 10_000, -1))
    }

    @Test fun resumeUsesEpisodeIdAfterEpisodesReorderAndSkipsCompletedEpisode() {
        val episodes = listOf(Episode("b", 2), Episode("a", 1), Episode("c", 3))
        val progress = Progress(series("s"), "a", 1, 12000, 60000, false, 1)
        assertEquals(1, PlaybackPolicy.resumeIndex(episodes, progress))
        assertEquals(2, PlaybackPolicy.resumeIndex(episodes, progress.copy(completed = true)))
        assertEquals(0, PlaybackPolicy.resumeIndex(episodes, progress.copy(episodeId = "deleted")))
    }

    @Test fun endOfSeriesDistinguishesFeedFromFullPlayback() {
        assertEquals(PlaybackPolicy.EndAction.NEXT_EPISODE, PlaybackPolicy.endAction(0, 2, true))
        assertEquals(PlaybackPolicy.EndAction.NEXT_SERIES, PlaybackPolicy.endAction(1, 2, true))
        assertEquals(PlaybackPolicy.EndAction.RELATED, PlaybackPolicy.endAction(1, 2, false))
    }

    @Test fun qualityUsesActualOptionsAndPrefers1080ByDefault() {
        val options = listOf(Quality("4K", "4K", 2160), Quality("1080P", "1080P", 1080), Quality("720P", "720P", 720))
        assertEquals("1080P", PlaybackPolicy.chooseQuality(options).key)
        assertEquals("720P", PlaybackPolicy.chooseQuality(options, "720P").key)
        assertEquals("4K", PlaybackPolicy.chooseQuality(options.take(1)).key)
        assertThrows(IllegalArgumentException::class.java) { PlaybackPolicy.chooseQuality(emptyList()) }
    }

    @Test fun changingGenerationRejectsOldResponses() {
        val guard = GenerationGuard()
        val old = guard.next()
        assertTrue(guard.isCurrent(old))
        val current = guard.next()
        assertFalse(guard.isCurrent(old))
        assertTrue(guard.isCurrent(current))
    }
}
