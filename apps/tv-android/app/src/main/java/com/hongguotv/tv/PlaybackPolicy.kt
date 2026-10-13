package com.hongguotv.tv

import java.net.URI
import java.util.concurrent.atomic.AtomicLong

object PlaybackPolicy {
    fun canSaveProgress(expectedEpisodeId: String, currentMediaId: String?): Boolean =
        expectedEpisodeId.isNotBlank() && expectedEpisodeId == currentMediaId

    fun normalizeBaseUrl(input: String): String {
        val value = input.trim().let { if ("://" in it) it else "http://$it" }
        val uri = try { URI(value) } catch (_: Exception) {
            throw IllegalArgumentException("请输入有效的远程地址，例如 https://sync.example.com")
        }
        require(uri.scheme in setOf("http", "https") && !uri.host.isNullOrBlank()) { "请输入 HTTP 或 HTTPS 服务地址" }
        require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null && uri.rawPath in listOf("", "/")) {
            "服务地址不能包含账号、路径、查询参数或片段"
        }
        require(uri.port == -1 || uri.port in 1..65535) { "端口必须在 1 到 65535 之间" }
        return URI(uri.scheme.lowercase(), null, uri.host.lowercase(), uri.port, null, null, null).toASCIIString()
    }

    fun mergeUnique(existing: List<Series>, incoming: List<Series>): List<Series> =
        (existing + incoming).distinctBy { it.id }

    fun restoredIndex(items: List<Series>, id: String?): Int = items.indexOfFirst { it.id == id }.coerceAtLeast(0)

    fun seek(positionMs: Long, deltaMs: Long, durationMs: Long): Long {
        val target = if (deltaMs > 0 && positionMs > Long.MAX_VALUE - deltaMs) Long.MAX_VALUE else positionMs + deltaMs
        return target.coerceAtLeast(0).let { if (durationMs > 0) it.coerceAtMost(durationMs) else it }
    }

    fun resumeIndex(episodes: List<Episode>, progress: Progress?): Int {
        if (progress == null) return 0
        val index = episodes.indexOfFirst { it.id == progress.episodeId }
        if (index < 0) return 0
        return if (progress.completed && index < episodes.lastIndex) index + 1 else index
    }

    enum class EndAction { NEXT_EPISODE, NEXT_SERIES, RELATED }

    fun endAction(index: Int, count: Int, feed: Boolean): EndAction =
        if (index + 1 < count) EndAction.NEXT_EPISODE else if (feed) EndAction.NEXT_SERIES else EndAction.RELATED

    fun chooseQuality(options: List<Quality>, preferred: String = "1080P"): Quality {
        require(options.isNotEmpty()) { "后端未返回可用画质，请重试" }
        return options.firstOrNull { it.key.equals(preferred, true) } ?: options.maxBy { it.qualityNum }
    }
}

class GenerationGuard {
    private val generation = AtomicLong(0)
    fun next(): Long = generation.incrementAndGet()
    fun isCurrent(token: Long): Boolean = token == generation.get()
}
