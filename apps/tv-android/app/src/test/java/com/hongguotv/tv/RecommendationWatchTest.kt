package com.hongguotv.tv

import org.junit.Assert.*
import org.junit.Test

class RecommendationWatchTest {
    @Test fun wallClockCountsPlayingOnlyAndSeekingNeverAddsTime() {
        val watch = RecommendationWatch()
        watch.update(1000, true)
        watch.update(4000, true)
        watch.update(5000, false)
        watch.update(9000, false)
        assertEquals(4000L, watch.watchMs)
        watch.update(10000, true)
        watch.update(12000, false)
        assertEquals(6000L, watch.watchMs)
    }
    @Test fun onlyAnExplicitNextAfterActualShortPlayCountsSkip() {
        val watch = RecommendationWatch()
        assertFalse(watch.isQuickSkip(true))
        watch.update(0, true); watch.update(3000, false)
        assertFalse(watch.isQuickSkip(false))
        assertTrue(watch.isQuickSkip(true))
        watch.update(4000, true); watch.update(12000, false)
        assertFalse(watch.isQuickSkip(true))
    }
    @Test fun pausedAndBackgroundIntervalsAreExcludedAndBackwardsClockIsSafe() {
        val watch = RecommendationWatch()
        watch.update(1000, true); watch.update(2000, false)
        watch.update(60000, false); watch.update(61000, true); watch.update(62000, false)
        watch.update(1, false)
        assertEquals(2000L, watch.watchMs)
    }
}
