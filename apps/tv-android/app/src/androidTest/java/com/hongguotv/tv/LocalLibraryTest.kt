package com.hongguotv.tv

import androidx.test.core.app.ApplicationProvider
import android.content.Context
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LocalLibraryTest {
    @Test fun progressAndOutboxCommitTogetherAndOlderSetsDoNotReviveDeletes() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val library=TvLibrary(context,"library-test-${System.nanoTime()}.sqlite")
        library.write("favorite","a","set",Series("a","剧名").toJson())
        assertEquals(1,library.rows("favorite").size)
        assertEquals(1,library.pending().size)
        val old=JSONObject(library.pending().first().toString())
        library.write("favorite","a","delete",null)
        library.merge(listOf(old))
        assertTrue(library.rows("favorite").isEmpty())
        library.write("favorite","a","set",Series("a","重新追剧").toJson())
        assertEquals("重新追剧",library.rows("favorite").first().getJSONObject("value").getString("title"))
        library.close()
    }
}
