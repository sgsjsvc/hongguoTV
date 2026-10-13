package com.hongguotv.tv

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import android.widget.ImageView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

internal class ArtworkLoader(private val scope: CoroutineScope) {
    private val client = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
    private val cache = object : LruCache<String, Bitmap>(16 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }
    fun load(url: String, target: ImageView) {
        target.tag = url; target.setImageDrawable(null)
        if (url.isBlank()) return
        cache.get(url)?.let { target.setImageBitmap(it); return }
        scope.launch {
            val bitmap = withContext(Dispatchers.IO) {
                runCatching {
                    client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                        if (!response.isSuccessful) return@use null
                        val bytes = response.body?.bytes() ?: return@use null
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                        var sample = 1
                        while (bounds.outWidth / sample > 800 || bounds.outHeight / sample > 1200) sample *= 2
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
                    }
                }.getOrNull()
            }
            if (bitmap != null) {
                cache.put(url, bitmap)
                if (target.tag == url) target.setImageBitmap(bitmap)
            }
        }
    }
    fun close() { client.dispatcher.cancelAll(); cache.evictAll() }
}
