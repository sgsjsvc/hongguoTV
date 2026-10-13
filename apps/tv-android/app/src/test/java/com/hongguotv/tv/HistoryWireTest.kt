package com.hongguotv.tv

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class HistoryWireTest {
    @Test fun keepsStringIdsAndMillisecondsAcrossPlatforms() {
        val record = historyProgress(JSONObject("""{"seriesId":"9007199254740999","title":"剧","episodeId":"9007199254740998","episodeNumber":2,"positionMs":12345,"durationMs":50000,"completed":false,"updatedAt":123,"source":"pc"}"""))
        assertEquals("9007199254740999", record.series.id)
        assertEquals("pc", record.source)
        assertEquals(12345L, record.positionMs)
        assertEquals("9007199254740998", record.toHistoryJson().getString("episodeId"))
    }
    @Test fun ackOfOlderUploadCannotRemoveNewerQueuedPosition() {
        val pending = JSONObject().put("sequence", 3).put("positionMs", 2000)
        assertFalse(historyAcknowledged(pending, 2))
        assertTrue(historyAcknowledged(pending, 3))
    }
}
