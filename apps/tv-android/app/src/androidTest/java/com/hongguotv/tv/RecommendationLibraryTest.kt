package com.hongguotv.tv

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RecommendationLibraryTest {
    @Test fun signalsAndResetPreferencesJoinSnapshotWithoutDeletingHistory() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val library=TvLibrary(context,"recommendation-test-${System.nanoTime()}.sqlite")
        try {
            library.write("history","s","set",JSONObject().put("seriesId","s"))
            library.write("recommendation","session:s","set",JSONObject().put("seriesId","s").put("title","剧").put("tags","爱情").put("contentType","comic-drama").put("watchMs",3000).put("exposures",1).put("skips",1).put("completed",false))
            library.write("preference","recommendationResetAt","set",JSONObject().put("value",12345))
            val profile=library.recommendationProfile()
            assertEquals(1,profile.getJSONArray("history").length())
            val signal=profile.getJSONArray("recommendationSignals").getJSONObject(0)
            assertEquals(3000L,signal.getLong("watchMs"))
            assertTrue(signal.has("updatedAt"))
            assertEquals(12345L,profile.getJSONObject("preferences").getLong("recommendationResetAt"))
            assertEquals(3,library.pending().size)
        }finally{library.close()}
    }
}
