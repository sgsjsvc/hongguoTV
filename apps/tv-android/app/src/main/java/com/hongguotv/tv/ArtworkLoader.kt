package com.hongguotv.tv

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import android.widget.ImageView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.util.IdentityHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

internal class ArtworkLoader(private val scope: CoroutineScope) {
    // Dispatcher limits apply to enqueue(), not synchronous execute(). Keep decoding inside
    // its callback so at most four downloads/decodes are active, including across hosts.
    private val client = OkHttpClient.Builder().dispatcher(Dispatcher().apply {
        maxRequests = 4
        maxRequestsPerHost = 4
    }).callTimeout(15, TimeUnit.SECONDS).build()
    private class Pending(val url: String) { var job: Job? = null }
    // Accessed only on the UI thread, like ImageView itself.
    private val pending = IdentityHashMap<ImageView, Pending>()
    private var closed = false
    private val cache = object : LruCache<String, Bitmap>(16 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }
    fun load(url: String, target: ImageView) {
        if (closed) return
        if (url.isBlank()) { clear(target); return }
        if (target.tag == url && (target.drawable != null || pending[target]?.url == url)) return
        pending.remove(target)?.job?.cancel()
        target.tag = url
        cache.get(url)?.let { target.setImageBitmap(it); return }
        target.setImageDrawable(null)
        val request = Pending(url)
        pending[target] = request
        // Defer request construction until RecyclerView finishes this bind/layout pass.
        // A holder recycled in the same pass can then cancel before any HTTP work starts.
        request.job = scope.launch(Dispatchers.Main, start = CoroutineStart.LAZY) {
            try {
                val bitmap = try { fetch(url) } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) { null }
                ensureActive()
                // Identity also protects A -> B -> A from the first A's late response.
                if (!closed && pending[target] === request && target.tag == url && bitmap != null) {
                    cache.put(url, bitmap)
                    target.setImageBitmap(bitmap)
                }
            } finally {
                if (pending[target] === request) pending.remove(target)
            }
        }
        request.job?.start()
    }

    private suspend fun fetch(url: String): Bitmap? = suspendCancellableCoroutine { continuation ->
        val call = client.newCall(Request.Builder().url(url).build())
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resume(null)
            }
            override fun onResponse(call: Call, response: Response) {
                val bitmap = response.use {
                    if (!continuation.isActive || !it.isSuccessful) return@use null
                    runCatching {
                        val bytes = it.body?.bytes() ?: return@runCatching null
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                        var sample = 1
                        while (bounds.outWidth / sample > 800 || bounds.outHeight / sample > 1200) sample *= 2
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size,
                            BitmapFactory.Options().apply { inSampleSize = sample })
                    }.getOrNull()
                }
                if (continuation.isActive) continuation.resume(bitmap)
            }
        })
    }

    fun clear(target: ImageView) {
        pending.remove(target)?.job?.cancel()
        target.tag = null
        target.setImageDrawable(null)
    }

    fun close() {
        closed = true
        pending.values.toList().forEach { it.job?.cancel() }
        pending.clear()
        client.dispatcher.cancelAll()
        client.connectionPool.evictAll()
        cache.evictAll()
    }
}
