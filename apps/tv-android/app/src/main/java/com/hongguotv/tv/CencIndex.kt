package com.hongguotv.tv

/** Native counterpart of the shared engine's MP4 CENC index parser. Offsets are absolute. */
internal object CencIndex {
    data class Sample(val start:Long,val end:Long,val iv:ByteArray)
    data class Prepared(val header:ByteArray,val samples:List<Sample>)
    private data class Box(val offset:Int,val size:Int,val type:String,val body:Int){val end get()=offset+size}
    private fun u32(data:ByteArray,at:Int):Long {require(at>=0&&at+4<=data.size);return ((data[at].toLong()and 255)shl 24)or((data[at+1].toLong()and 255)shl 16)or((data[at+2].toLong()and 255)shl 8)or(data[at+3].toLong()and 255)}
    private fun u64(data:ByteArray,at:Int):Long {val high=u32(data,at);require(high<=0x1fffff){"MP4 offset too large"};return(high shl 32)or u32(data,at+4)}
    private fun box(data:ByteArray,at:Int):Box? {
        if(at<0||at+8>data.size)return null
        var size=u32(data,at);var header=8
        if(size==1L){if(at+16>data.size)return null;size=u64(data,at+8);header=16}else if(size==0L)size=(data.size-at).toLong()
        if(size<header||size>data.size-at)return null
        return Box(at,size.toInt(),String(data,at+4,4,Charsets.US_ASCII),at+header)
    }
    private fun find(data:ByteArray,type:String,start:Int=0,end:Int=data.size):Box? {
        for(at in start.coerceAtLeast(0)..end-8){if(data[at+4].toInt()!=type[0].code||data[at+5].toInt()!=type[1].code||data[at+6].toInt()!=type[2].code||data[at+7].toInt()!=type[3].code)continue
            val value=box(data,at);if(value?.type==type&&value.end<=end)return value
        };return null
    }
    fun requiredHeaderSize(first:ByteArray):Int {
        require(first.size>=16){"MP4 header too short"};val ftyp=u32(first,0).toInt();require(ftyp>=8&&ftyp+8<=first.size){"Invalid MP4 ftyp"}
        require(String(first,4,4,Charsets.US_ASCII)=="ftyp"&&String(first,ftyp+4,4,Charsets.US_ASCII)=="moov"){"MP4 moov must follow ftyp"}
        val length=u32(first,ftyp);require(length>=8&&ftyp+length<=8*1024*1024){"MP4 moov size exceeded"};return(ftyp+length).toInt()
    }
    fun prepare(data:ByteArray):Prepared {
        val size=requiredHeaderSize(data);require(size<=data.size){"Truncated MP4 moov"}
        val ftyp=box(data,0)!!;val moov=box(data,ftyp.end)!!
        val body=data.copyOfRange(moov.body,moov.end);val samples=mutableListOf<Sample>();var cursor=0
        while(true){val track=find(body,"trak",cursor)?:break;cursor=track.end
            val stbl=find(body,"stbl",track.body,track.end)?:continue
            fun payload(type:String):ByteArray?=find(body,type,stbl.body,stbl.end)?.let{body.copyOfRange(it.body,it.end)}
            val stsz=payload("stsz")?:continue;val stsc=payload("stsc")?:continue;val chunk=find(body,"stco",stbl.body,stbl.end)?:find(body,"co64",stbl.body,stbl.end)?:continue
            val saiz=payload("saiz")?:continue;val saio=payload("saio")?:continue
            require(stsz.size>=12&&stsc.size>=8&&saiz.size>=9&&saio.size>=8){"Truncated CENC tables"}
            val count=u32(stsz,8).toInt();require(count in 0..250000){"CENC sample count exceeded"}
            val defaultSize=u32(stsz,4).toInt();val sizes=IntArray(count){i->if(defaultSize!=0)defaultSize else u32(stsz,12+i*4).toInt()}
            val chunks=u32(body,chunk.body+4).toInt();require(chunks in 0..250000)
            val offsets=LongArray(chunks){i->val at=chunk.body+8+i*(if(chunk.type=="co64")8 else 4);if(chunk.type=="co64")u64(body,at)else u32(body,at)}
            val entries=u32(stsc,4).toInt();require(entries in 0..250000)
            val first=IntArray(entries){u32(stsc,8+it*12).toInt()};val per=IntArray(entries){u32(stsc,12+it*12).toInt()}
            val auxCount=u32(saiz,5).toInt();require(auxCount>=count&&auxCount<=250000)
            val defaultAux=saiz[4].toInt()and 255;val auxSizes=IntArray(auxCount){i->maxOf(8,if(defaultAux>0)defaultAux else saiz[9+i].toInt()and 255)}
            require(u32(saio,4)>0);var aux=if((u32(saio,0)ushr 24)==1L)u64(saio,8)else u32(saio,8)
            require(aux>=0&&aux+auxSizes.sum()<=data.size){"MP4 auxiliary data out of range"}
            var sample=0;var entry=0
            for(chunkIndex in offsets.indices){while(entry+1<entries&&first[entry+1]<=chunkIndex+1)entry++
                val perChunk=if(entries==0||first[entry]>chunkIndex+1)0 else per[entry];var offset=offsets[chunkIndex]
                repeat(perChunk.coerceAtMost(count-sample)){val length=sizes[sample];require(length>=0&&offset+length<=9007199254740991L)
                    val iv=ByteArray(16);data.copyInto(iv,0,aux.toInt(),aux.toInt()+8);samples.add(Sample(offset,offset+length,iv));offset+=length;aux+=auxSizes[sample];sample++}
            }
            require(sample==count){"MP4 sample count mismatch"}
        }
        val header=data.copyOfRange(0,size)
        fun replace(from:String,to:String){val source=from.toByteArray(Charsets.US_ASCII);val target=to.toByteArray(Charsets.US_ASCII);var at=0;while(at+4<=header.size){if(header[at]==source[0]&&header[at+1]==source[1]&&header[at+2]==source[2]&&header[at+3]==source[3]){target.copyInto(header,at);at+=4}else at++}}
        replace("encv","hvc1");replace("enca","mp4a")
        val free="free".toByteArray(Charsets.US_ASCII)
        var at=4;while(at+4<=header.size){if(header[at]==115.toByte()&&header[at+1]==105.toByte()&&header[at+2]==110.toByte()&&header[at+3]==102.toByte()){val length=u32(header,at-4).toInt();if(length in 8..49999&&at-4+length<=header.size){free.copyInto(header,at);header.fill(0,at+4,at-4+length);at+=length-4}else at+=4}else at++}
        return Prepared(header,samples.sortedBy{it.start})
    }
}
