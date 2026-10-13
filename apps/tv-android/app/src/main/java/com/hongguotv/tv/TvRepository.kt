package com.hongguotv.tv

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class TvApiException(message: String, cause: Throwable? = null) : IOException(message, cause)
internal data class CategoryResult(val items:List<Series>,val totalPages:Int)

class TvRepository(baseUrl: String) {
    private val origin = PlaybackPolicy.normalizeBaseUrl(baseUrl).toHttpUrl()
    companion object {
        // Repositories vary by server origin; dispatcher and connections remain shared.
        private val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(45, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS).build()
    }

    suspend fun health() {
        val json = get(listOf("health"))
        if (json.optString("service") != "hongguotv-custom-bridge" || !json.optBoolean("ok")) {
            throw TvApiException("该地址不是红果 8788 后端，请检查服务地址")
        }
    }

    suspend fun recommend(page: Int, session: String = ""): List<Series> = list(get(listOf("api", "recommend"), "page" to pageValue(page), "session" to session))
    suspend fun search(query: String, page: Int): List<Series> = list(get(listOf("api", "search"), "q" to query, "page" to pageValue(page)))
    suspend fun categoryTypes(): List<Pair<String, String>> = choices(get(listOf("api", "category", "tags")), "types")
    suspend fun categoryTags(type:String="real-drama"): List<Pair<String, String>> = choices(get(listOf("api", "category", "tags"),"type" to type), "tags")
    suspend fun category(type: String, tag: String, page: Int): List<Series> =
        categoryPage(type,tag,page).items
    internal suspend fun categoryPage(type:String,tag:String,page:Int):CategoryResult {
        val json=get(listOf("api","category","list"),"type" to type,"tag" to tag,"page" to pageValue(page))
        return CategoryResult(list(json),json.optJSONObject("pagination")?.optInt("totalPages",0)?:0)
    }
    suspend fun rankTypes(): List<Pair<String, String>> = choices(get(listOf("api", "rank", "types")), "types")
    suspend fun rank(type: String, page: Int): List<Series> =
        list(get(listOf("api", "rank", "list"), "type" to type, "page" to pageValue(page)))

    suspend fun detail(id: String): Detail = contract {
        val json = get(listOf("api", "series", id))
        val episodes = json.getJSONArray("episodes").objects().map {
            val number = it.getInt("number")
            Episode(it.requiredId(), number, it.optString("title", "第 $number 集"))
        }
        if (episodes.isEmpty()) throw TvApiException("该短剧暂无可播放分集")
        Detail(json.toSeries(), episodes)
    }

    suspend fun qualities(episodeId: String, seriesId: String): List<Quality> = contract {
        val result = get(listOf("api", "episodes", episodeId, "qualities"), "seriesId" to seriesId)
            .getJSONArray("qualities").objects().map {
                Quality(it.getString("key"), it.getString("label"), it.getInt("qualityNum"), it.optString("codec"))
            }.distinctBy { it.key }.sortedByDescending { it.qualityNum }
        if (result.isEmpty()) throw TvApiException("后端未返回可用画质，请重试")
        result
    }

    suspend fun related(seriesId: String, page: Int = 1): List<Series> =
        list(get(listOf("api", "series", seriesId, "related"), "page" to pageValue(page), "limit" to "16"))

    fun streamUrl(episodeId: String, seriesId: String, quality: String): String =
        url(listOf("api", "episodes", episodeId, "stream"), "seriesId" to seriesId, "quality" to quality).toString()

    private fun pageValue(page: Int): String {
        require(page >= 1) { "页码从 1 开始" }
        return page.toString()
    }

    private fun url(parts: List<String>, vararg params: Pair<String, String>): HttpUrl = origin.newBuilder().apply {
        parts.forEach { addPathSegment(it) }
        params.forEach { (key, value) -> addQueryParameter(key, value) }
    }.build()

    private suspend fun get(parts: List<String>, vararg params: Pair<String, String>): JSONObject {
        val request = Request.Builder().url(url(parts, *params)).build()
        val body = suspendCancellableCoroutine<String> { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWith(Result.failure(TvApiException("连接失败，请检查网络和后端地址：${e.message}", e)))
                }
                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        try {
                            val text = it.body?.string() ?: throw TvApiException("后端返回空响应，请重试")
                            if (!it.isSuccessful) {
                                val reason = runCatching { JSONObject(text).optString("error") }.getOrDefault("")
                                throw TvApiException("后端请求失败（HTTP ${it.code}）${if (reason.isBlank()) "，请重试" else "：$reason"}")
                            }
                            continuation.resumeWith(Result.success(text))
                        } catch (e: Exception) {
                            continuation.resumeWith(Result.failure(e))
                        }
                    }
                }
            })
        }
        return contract {
            JSONObject(body).also {
                if (it.has("error")) throw TvApiException("后端错误：${it.optString("error")}")
            }
        }
    }

    private fun list(json: JSONObject): List<Series> = contract {
        json.getJSONArray("items").objects().map { it.toSeries() }
    }

    private fun choices(json: JSONObject, key: String): List<Pair<String, String>> = contract {
        json.getJSONArray(key).objects().map { it.requiredId() to it.getString("name") }
    }

    private inline fun <T> contract(block: () -> T): T = try { block() } catch (e: JSONException) {
        throw TvApiException("后端数据格式不符合约定，请检查后端版本或重试", e)
    }
}

internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
internal fun JSONObject.requiredId(): String = get("id").let {
    if (it == JSONObject.NULL || it.toString().isBlank()) throw JSONException("missing id")
    it.toString()
}
internal fun JSONObject.toSeries(): Series = Series(
    requiredId(), getString("title"), optString("cover"), optString("description"), optString("badge"), optString("tags"), optString("contentType"),
)
internal fun Series.toJson(): JSONObject = JSONObject().put("id", id).put("title", title)
    .put("cover", cover).put("description", description).put("badge", badge).put("tags", tags)
    .apply { if(contentType.isNotBlank())put("contentType",contentType) }
