package com.hongguotv.tv

import org.junit.Assert.*
import org.junit.Test

class RecommendationResetTest {
    @Test fun clockOffsetKeepsResetInTheSameTimeDomainAsLibraryEvents() {
        assertEquals(1_600_001L,recommendationResetWatermark(1_000_000,600_000,1_600_000))
        assertEquals(400_001L,recommendationResetWatermark(1_000_000,-600_000,400_000))
    }
    @Test fun staleMonotonicClockCannotLeaveResetFarInTheFuture() {
        assertEquals(400_000L,recommendationResetWatermark(1_000_000,-600_000,1_000_000))
    }
    @Test fun unavailableContentTypeIsOmittedFromStrictPortableRecords() {
        val series=Series("s","剧")
        assertFalse(series.toJson().has("contentType"))
        assertFalse(Progress(series,"e",1,0,0,false,1).toHistoryJson().has("contentType"))
        assertEquals("comic-drama",series.copy(contentType="comic-drama").toJson().getString("contentType"))
    }
}
