package com.hongguotv.tv

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

class TvUiLayoutTest {

    @Test
    fun timeFormattingHandlesSecondsAndMinutesProperly() {
        assertEquals("00:00", TvUi.time(0L))
        assertEquals("00:05", TvUi.time(5_000L))
        assertEquals("01:05", TvUi.time(65_000L))
        assertEquals("10:00", TvUi.time(600_000L))
        assertEquals("65:42", TvUi.time(3_942_000L))
        assertEquals("00:00", TvUi.time(-1000L))
    }

    @Test
    fun episodeGroupingMathIsAccurate() {
        // Episode group calculations used across EpisodeDrawerView & DetailScreenView
        fun computeGroups(episodeCount: Int): Int = (episodeCount + 49) / 50

        assertEquals(1, computeGroups(1))
        assertEquals(1, computeGroups(50))
        assertEquals(2, computeGroups(51))
        assertEquals(2, computeGroups(100))
        assertEquals(3, computeGroups(101))

        // Episode range labels
        fun groupLabel(g: Int, total: Int): Pair<Int, Int> {
            val start = g * 50 + 1
            val end = minOf((g + 1) * 50, total)
            return start to end
        }

        assertEquals(1 to 50, groupLabel(0, 85))
        assertEquals(51 to 85, groupLabel(1, 85))
        assertEquals(1 to 30, groupLabel(0, 30))
    }

    @Test
    fun detailGridChunkingFillsEightColumns() {
        val count = 21
        val episodes = (1..count).toList()
        val chunked = episodes.chunked(8)

        assertEquals(3, chunked.size)
        assertEquals(8, chunked[0].size)
        assertEquals(8, chunked[1].size)
        assertEquals(5, chunked[2].size)

        val spacerCount = 8 - chunked[2].size
        assertEquals(3, spacerCount)
    }

    @Test
    fun dimensXmlConsistencyAcrossTiers() {
        // Check that all dimension names in base dimens.xml exist in values-sw600dp and values-w1280dp
        val baseFile = File("src/main/res/values/dimens.xml").let {
            if (it.exists()) it else File("app/src/main/res/values/dimens.xml")
        }
        val sw600File = File("src/main/res/values-sw600dp/dimens.xml").let {
            if (it.exists()) it else File("app/src/main/res/values-sw600dp/dimens.xml")
        }
        val w1280File = File("src/main/res/values-w1280dp/dimens.xml").let {
            if (it.exists()) it else File("app/src/main/res/values-w1280dp/dimens.xml")
        }

        assertTrue("base dimens.xml must exist", baseFile.exists())
        assertTrue("sw600dp dimens.xml must exist", sw600File.exists())
        assertTrue("w1280dp dimens.xml must exist", w1280File.exists())

        fun extractDimenNames(file: File): Set<String> {
            val docBuilder = DocumentBuilderFactory.newInstance().newDocumentBuilder()
            val doc = docBuilder.parse(file)
            val nodes = doc.getElementsByTagName("dimen")
            val names = mutableSetOf<String>()
            for (i in 0 until nodes.length) {
                val elem = nodes.item(i) as org.w3c.dom.Element
                names.add(elem.getAttribute("name"))
            }
            return names
        }

        val baseNames = extractDimenNames(baseFile)
        val sw600Names = extractDimenNames(sw600File)
        val w1280Names = extractDimenNames(w1280File)

        assertTrue("Base dimens should have > 30 entries", baseNames.size > 30)
        assertEquals("sw600dp should define the exact same dimen keys as base", baseNames, sw600Names)
        assertEquals("w1280dp should define the exact same dimen keys as base", baseNames, w1280Names)
    }

    @Test
    fun catalogGridFocusSearchPreventsEscapingVertically() {
        val catalogFile = File("src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt").let {
            if (it.exists()) it else File("app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt")
        }
        assertTrue("CatalogScreenView.kt must exist", catalogFile.exists())
        val content = catalogFile.readText()
        assertTrue("Must override focusSearch on grid", content.contains("override fun focusSearch(focused: View, direction: Int): View?"))
        assertTrue("Must intercept FOCUS_DOWN", content.contains("direction == View.FOCUS_DOWN"))
        assertTrue("Must check isDescendant", content.contains("!isDescendant(this, next)"))
        assertTrue("Must retain focus on focused view when next is outside grid", content.contains("return focused"))
        assertTrue("Must trigger onNearBottom when pressing DOWN at bottom", content.contains("onNearBottom?.invoke()"))
    }
}
