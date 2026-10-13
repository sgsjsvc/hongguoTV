package com.hongguotv.tv

data class Series(
    val id: String,
    val title: String,
    val cover: String = "",
    val description: String = "",
    val badge: String = "",
    val tags: String = "",
    val contentType: String = "",
)

data class Episode(val id: String, val number: Int, val title: String = "第 $number 集")
data class Detail(val series: Series, val episodes: List<Episode>)
data class Quality(val key: String, val label: String, val qualityNum: Int, val codec: String = "")
data class Progress(
    val series: Series,
    val episodeId: String,
    val episodeNumber: Int,
    val positionMs: Long,
    val durationMs: Long,
    val completed: Boolean,
    val updatedAt: Long,
    val source: String = "tv",
)
