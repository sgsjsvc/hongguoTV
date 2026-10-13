package com.hongguotv.tv

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.Closeable
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors

/** Process-owned, loopback-only media endpoint. A fresh port prevents service collisions. */
class LocalContentService(context: Context) : Closeable {
    private val engine = StandaloneEngine(context.applicationContext)
    private val socket = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
    private val workers = Executors.newFixedThreadPool(4)
    val baseUrl = "http://127.0.0.1:${socket.localPort}"
    @Volatile private var running = true
    @Volatile var lastEngineMillis=0L;private set
    @Volatile var lastMediaMillis=0L;private set
    init { Thread({ while (running) { try { val request=socket.accept(); workers.execute { serve(request) } } catch (_: Exception) { if(running) Thread.yield() } } },"TV-local-content").apply { isDaemon=true;start() } }
    private fun serve(client: Socket) {
        client.use {
            client.soTimeout=60000
            try {
                val reader=client.getInputStream().bufferedReader()
                val request=reader.readLine()?.split(' ') ?: return
                if(request.size<2)return
                val target=request[1].split('?',limit=2)
                val params=JSONObject()
                if(target.size>1)target[1].split('&').filter { it.isNotBlank() }.forEach { pair -> val fields=pair.split('=',limit=2);params.put(URLDecoder.decode(fields[0],"UTF-8"),URLDecoder.decode(fields.getOrElse(1){""},"UTF-8")) }
                var line=reader.readLine()
                while(!line.isNullOrEmpty()){ val at=line.indexOf(':');if(at>0&&line.substring(0,at).equals("Range",true))params.put("range",line.substring(at+1).trim());line=reader.readLine() }
                val engineBegin=System.nanoTime()
                val data=JSONObject(engine.evaluate("localContent(${JSONObject.quote(target[0])},$params)"))
                lastEngineMillis=(System.nanoTime()-engineBegin)/1000000
                val media=data.has("status")
                val status=if(media)data.getInt("status") else 200
                val type=if(media)data.optString("type","video/mp4") else "application/json; charset=utf-8"
                val mediaBegin=System.nanoTime()
                val body=if(data.has("nativeToken"))engine.readStream(data.getString("nativeToken"),data.getLong("start"),data.getLong("end")) else if(media&&data.optBoolean("binary"))Base64.decode(data.getString("data"),Base64.DEFAULT) else (if(media)data.optString("data") else data.toString()).toByteArray(Charsets.UTF_8)
                if(media)lastMediaMillis=(System.nanoTime()-mediaBegin)/1000000
                val headers=data.optJSONObject("headers") ?: JSONObject()
                respond(client,status,type,body,headers)
            }catch(error:Exception){runCatching {respond(client,502,"application/json",JSONObject().put("error",error.message?:"Local engine failed").toString().toByteArray(),JSONObject())}}
        }
    }
    private fun respond(client: Socket,status:Int,type:String,body:ByteArray,headers:JSONObject){
        val text=StringBuilder("HTTP/1.1 $status ${if(status==206)"Partial Content" else if(status==200)"OK" else "Error"}\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\nConnection: close\r\n")
        headers.keys().forEach {name->text.append("$name: ${headers.getString(name)}\r\n")}
        text.append("\r\n");client.getOutputStream().write(text.toString().toByteArray(Charsets.US_ASCII));client.getOutputStream().write(body);client.getOutputStream().flush()
    }
    override fun close(){running=false;socket.close();workers.shutdownNow();engine.close()}
}
