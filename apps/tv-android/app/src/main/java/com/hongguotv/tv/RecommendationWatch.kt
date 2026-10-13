package com.hongguotv.tv

/** Monotonic wall-clock intervals, independent of seek position and playback speed. */
class RecommendationWatch {
    var watchMs = 0L; private set
    private var lastAt: Long? = null
    private var playing = false
    fun update(now: Long, isPlaying: Boolean) {
        lastAt?.let { previous -> if (playing) watchMs += (now - previous).coerceAtLeast(0) }
        lastAt = now; playing = isPlaying
    }
    fun isQuickSkip(explicitNext: Boolean) = explicitNext && watchMs in 1 until 10_000
}
