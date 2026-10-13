package com.hongguotv.tv

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Portable library lives in SQLite; connection credentials stay device-local. */
class TvStore(context:Context) {
    private val preferences=context.applicationContext.getSharedPreferences("hongguotv_tv_v1",Context.MODE_PRIVATE)
    private val library=TvLibrary.get(context)
    init {
        synchronized(library){if(library.setting("legacyTvMigrated")!="1"){
            library.transaction {
                runCatching{JSONArray(preferences.getString("favorites","[]")).objects()}.getOrDefault(emptyList()).forEach{item->library.write("favorite",item.getString("id"),"set",item,0)}
                runCatching{JSONArray(preferences.getString("history","[]")).objects()}.getOrDefault(emptyList()).forEach{item->
                    val series=item.getJSONObject("series");val value=JSONObject(series.toString()).put("seriesId",series.getString("id")).put("episodeId",item.getString("episodeId")).put("episodeNumber",item.getInt("episodeNumber")).put("positionMs",item.getLong("positionMs")).put("durationMs",item.optLong("durationMs")).put("completed",item.optBoolean("completed"))
                    library.write("history",series.getString("id"),"set",value,item.optLong("updatedAt"))
                }
                if(preferences.contains("quality"))library.write("preference","quality","set",JSONObject().put("value",preferences.getString("quality","1080P")),0)
                if(preferences.contains("speed"))library.write("preference","speed","set",JSONObject().put("value",preferences.getFloat("speed",1f).toDouble()),0)
                library.setSetting("legacyTvMigrated","1")
            }
            preferences.edit().remove("favorites").remove("history").remove("quality").remove("speed").commit()
        }}
        synchronized(library){if(library.setting("legacyHistoryOutboxMigrated")!="1"){
            val old=context.applicationContext.getSharedPreferences("hongguotv_history_outbox",Context.MODE_PRIVATE)
            val queued=runCatching{JSONArray(old.getString("pending","[]")).objects()}.getOrDefault(emptyList())
            library.transaction {
                queued.forEach{entry->entry.optJSONObject("event")?.let{event->
                    val id=event.getString("seriesId");val at=event.optLong("observedAt",event.optLong("updatedAt"))
                    val existing=library.rows("history").firstOrNull{it.getString("key")==id}
                    if(existing==null||existing.getLong("at")<at)library.write("history",id,"set",event,at)
                }}
                library.setSetting("legacyHistoryOutboxMigrated","1")
            }
            old.edit().remove("pending").commit()
        }}
    }
    var baseUrl:String
        get()=preferences.getString("baseUrl","")?:""
        set(value){preferences.edit().putString("baseUrl",PlaybackPolicy.normalizeBaseUrl(value)).commit()}
    var quality:String
        get()=library.rows("preference").firstOrNull{it.getString("key")=="quality"}?.getJSONObject("value")?.optString("value","1080P")?:"1080P"
        set(value){library.write("preference","quality","set",JSONObject().put("value",value))}
    var speed:Float
        get()=library.rows("preference").firstOrNull{it.getString("key")=="speed"}?.getJSONObject("value")?.optDouble("value",1.0)?.toFloat()?:1f
        set(value){require(value in .25f..4f);library.write("preference","speed","set",JSONObject().put("value",value.toDouble()))}
    var recommendationMode:String
        get()=library.rows("preference").firstOrNull{it.getString("key")=="recommendationMode"}?.getJSONObject("value")?.optString("value","mixed")?:"mixed"
        set(value){require(value in listOf("mixed","real-drama","comic-drama","ai-drama"));library.write("preference","recommendationMode","set",JSONObject().put("value",value))}
    val recommendationResetAt:Long get()=library.rows("preference").firstOrNull{it.getString("key")=="recommendationResetAt"}?.getJSONObject("value")?.optLong("value",0)?:0
    fun resetRecommendationPreferences(){library.transaction {
        val at=recommendationResetWatermark(System.currentTimeMillis(),setting("clockOffset","0").toLong(),setting("lastTime","0").toLong())
        write("preference","recommendationResetAt","set",JSONObject().put("value",at))
    }}
    fun saveRecommendation(session:String,series:Series,watchMs:Long,exposures:Int,skips:Int,completed:Boolean){
        if(series.contentType !in listOf("real-drama","comic-drama","ai-drama"))return
        library.write("recommendation","$session:${series.id}","set",JSONObject().put("seriesId",series.id).put("title",series.title)
            .put("tags",series.tags).put("contentType",series.contentType).put("watchMs",watchMs.coerceAtLeast(0))
            .put("exposures",exposures.coerceAtLeast(0)).put("skips",skips.coerceAtLeast(0)).put("completed",completed))
    }
    fun favorites():List<Series> = library.rows("favorite").mapNotNull{runCatching{it.getJSONObject("value").toSeries()}.getOrNull()}
    fun isFavorite(id:String)=favorites().any{it.id==id}
    fun toggleFavorite(series:Series):Boolean {val exists=isFavorite(series.id);library.write("favorite",series.id,if(exists)"delete" else "set",if(exists)null else series.toJson());return !exists}
    fun history():List<Progress> = library.rows("history").mapNotNull{row->runCatching{historyProgress(JSONObject(row.getJSONObject("value").toString()).put("updatedAt",row.getLong("at")))}.getOrNull()}
    fun progress(id:String)=history().firstOrNull{it.series.id==id}
    fun saveProgress(record:Progress){require(record.series.id.isNotBlank()&&record.episodeId.isNotBlank()&&record.episodeNumber>=1&&record.positionMs>=0&&record.durationMs>=0);library.write("history",record.series.id,"set",record.toHistoryJson())}
    fun saveSearch(query:String){val value=query.trim();if(value.isNotEmpty())library.write("search",value.lowercase(),"set",JSONObject().put("query",value))}
    fun searches()=library.rows("search").map{it.getJSONObject("value").getString("query")}
}

internal fun recommendationResetWatermark(systemNow:Long,clockOffset:Long,lastTime:Long):Long {
    val clock=(systemNow+clockOffset).coerceAtLeast(0)
    return maxOf(clock,if(kotlin.math.abs(lastTime-clock)>300000)clock else lastTime+1)
}
