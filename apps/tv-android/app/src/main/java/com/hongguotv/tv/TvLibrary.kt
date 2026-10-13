package com.hongguotv.tv

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.util.UUID

/** Every user change and its retransmission journal share one durable SQLite commit. */
open class TvLibrary(context: Context, name: String = "hongguotv-library-v1.sqlite") : SQLiteOpenHelper(context.applicationContext,name,null,1) {
    companion object {
        @Volatile private var singleton: TvLibrary?=null
        fun get(context: Context)=singleton ?: synchronized(this){singleton ?: TvLibrary(context).also{singleton=it}}
    }
    override fun onConfigure(db: SQLiteDatabase){db.execSQL("PRAGMA synchronous=FULL")}
    override fun onOpen(db:SQLiteDatabase){
        super.onOpen(db);db.execSQL("CREATE TABLE IF NOT EXISTS versions (kind TEXT NOT NULL,key TEXT NOT NULL,device TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(kind,key,device))")
        db.rawQuery("SELECT kind,key,event FROM records",null).use{cursor->while(cursor.moveToNext()){val row=JSONObject(cursor.getString(2));db.insertWithOnConflict("versions",null,ContentValues().apply{put("kind",cursor.getString(0));put("key",cursor.getString(1));put("device",row.getString("deviceId"));put("event",row.toString())},SQLiteDatabase.CONFLICT_IGNORE)}}
    }
    override fun onCreate(db: SQLiteDatabase){
        db.execSQL("CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)")
        db.execSQL("CREATE TABLE records (kind TEXT NOT NULL,key TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(kind,key))")
        db.execSQL("CREATE TABLE outbox (id TEXT PRIMARY KEY,event TEXT NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase,oldVersion:Int,newVersion:Int)=Unit
    /** Lock the library before SQLite; never acquire a database transaction in a caller. */
    @Synchronized fun <T> transaction(operation:TvLibrary.()->T):T {
        val db=writableDatabase;db.beginTransaction()
        try{val result=operation();db.setTransactionSuccessful();return result}finally{db.endTransaction()}
    }
    @Synchronized fun setting(key:String,default:String=""):String = readableDatabase.rawQuery("SELECT value FROM meta WHERE key=?",arrayOf(key)).use { if(it.moveToFirst())it.getString(0) else default }
    @Synchronized fun setSetting(key:String,value:String){writableDatabase.insertWithOnConflict("meta",null,ContentValues().apply{put("key",key);put("value",value)},SQLiteDatabase.CONFLICT_REPLACE)}
    private fun record(kind:String,key:String):JSONObject?=readableDatabase.rawQuery("SELECT event FROM records WHERE kind=? AND key=?",arrayOf(kind,key)).use{if(it.moveToFirst())JSONObject(it.getString(0))else null}
    private fun compare(a:JSONObject,b:JSONObject):Int{
        val time=a.getLong("at").compareTo(b.getLong("at"));if(time!=0)return time
        val device=a.getString("deviceId").compareTo(b.getString("deviceId"));return if(device!=0)device else a.getLong("seq").compareTo(b.getLong("seq"))
    }
    private fun apply(event:JSONObject,canonical:Boolean=false){
        val kind=event.getString("kind");val key=event.getString("key");val device=event.getString("deviceId")
        val old=readableDatabase.rawQuery("SELECT event FROM versions WHERE kind=? AND key=? AND device=?",arrayOf(kind,key,device)).use{if(it.moveToFirst())JSONObject(it.getString(0))else null}
        if(old!=null&&!(canonical&&old.getString("id")==event.getString("id"))&&compare(event,old)<=0)return
        writableDatabase.insertWithOnConflict("versions",null,ContentValues().apply{put("kind",kind);put("key",key);put("device",device);put("event",event.toString())},SQLiteDatabase.CONFLICT_REPLACE)
        val winner=readableDatabase.rawQuery("SELECT event FROM versions WHERE kind=? AND key=?",arrayOf(kind,key)).use{cursor->buildList{while(cursor.moveToNext())add(JSONObject(cursor.getString(0)))}}.maxWithOrNull{a,b->compare(a,b)}!!
        writableDatabase.insertWithOnConflict("records",null,ContentValues().apply{put("kind",kind);put("key",key);put("event",winner.toString())},SQLiteDatabase.CONFLICT_REPLACE)
    }
    @Synchronized fun write(kind:String,key:String,operation:String,value:JSONObject?,importedAt:Long?=null):JSONObject{
        require(kind in listOf("history","favorite","search","preference","recommendation"))
        require(kind!="history"||operation=="set"){"TV 不允许删除历史记录"}
        val db=writableDatabase;db.beginTransaction()
        try{
            val device=setting("deviceId").ifBlank{UUID.randomUUID().toString().also{setSetting("deviceId",it)}}
            val sequence=setting("sequence","0").toLong()+1;setSetting("sequence",sequence.toString())
            val clock=System.currentTimeMillis()+setting("clockOffset","0").toLong();val last=setting("lastTime","0").toLong()
            val at=importedAt ?: maxOf(clock,if(kotlin.math.abs(last-clock)>300000)clock else last+1)
            if(importedAt==null)setSetting("lastTime",at.toString())
            val event=JSONObject().put("id",UUID.randomUUID().toString()).put("deviceId",device).put("seq",sequence).put("kind",kind).put("key",key).put("op",operation).put("at",at).put("value",value?:JSONObject.NULL)
            record(kind,key)?.let { previous -> db.delete("outbox","id=?",arrayOf(previous.getString("id"))) }
            apply(event)
            db.insertWithOnConflict("outbox",null,ContentValues().apply{put("id",event.getString("id"));put("event",event.toString())},SQLiteDatabase.CONFLICT_REPLACE)
            db.setTransactionSuccessful();return event
        }finally{db.endTransaction()}
    }
    @Synchronized fun rows(kind:String):List<JSONObject>{
        val clear=record(kind,"*")
        return readableDatabase.rawQuery("SELECT event FROM records WHERE kind=? AND key<>'*'",arrayOf(kind)).use{cursor->
            buildList{while(cursor.moveToNext()){val row=JSONObject(cursor.getString(0));if(row.getString("op")=="set"&&(clear==null||compare(row,clear)>0))add(row)}}
        }.sortedWith{a,b->compare(b,a)}
    }
    @Synchronized fun pending(limit:Int=256):List<JSONObject> = readableDatabase.rawQuery("SELECT event FROM outbox LIMIT ?",arrayOf(limit.toString())).use{cursor->buildList{while(cursor.moveToNext())add(JSONObject(cursor.getString(0)))}}
    @Synchronized fun recommendationProfile():JSONObject {
        fun values(kind:String)=org.json.JSONArray(rows(kind).map { row -> JSONObject(row.getJSONObject("value").toString()).put("updatedAt",row.getLong("at")) })
        val preferences=JSONObject()
        rows("preference").forEach { row -> preferences.put(row.getString("key"),row.getJSONObject("value").opt("value")) }
        return JSONObject().put("serverTime",System.currentTimeMillis()+setting("clockOffset","0").toLong()).put("history",values("history")).put("favorites",values("favorite"))
            .put("recommendationSignals",values("recommendation")).put("preferences",preferences)
    }
    @Synchronized open fun merge(events:List<JSONObject>,acked:List<String> = emptyList()){
        val db=writableDatabase;db.beginTransaction();try{events.forEach{apply(it,true)};acked.forEach{db.delete("outbox","id=?",arrayOf(it))};db.setTransactionSuccessful()}finally{db.endTransaction()}
    }
    @Synchronized fun snapshotForNewTarget(){
        val db=writableDatabase;db.beginTransaction();try{
            db.delete("outbox",null,null)
            db.rawQuery("SELECT event FROM records",null).use{cursor->while(cursor.moveToNext()){val event=JSONObject(cursor.getString(0));db.insertWithOnConflict("outbox",null,ContentValues().apply{put("id",event.getString("id"));put("event",event.toString())},SQLiteDatabase.CONFLICT_REPLACE)}}
            db.setTransactionSuccessful()
        }finally{db.endTransaction()}
    }
}
