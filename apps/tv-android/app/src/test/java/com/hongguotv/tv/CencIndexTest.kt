package com.hongguotv.tv
import org.junit.Assert.*
import org.junit.Test
import java.nio.ByteBuffer
class CencIndexTest {
    private fun ints(vararg values:Int)=ByteBuffer.allocate(values.size*4).also{buffer->values.forEach{buffer.putInt(it)}}.array()
    private fun box(type:String,body:ByteArray)=ints(body.size+8)+type.toByteArray()+body
    @Test fun derivesAbsoluteSampleOffsetsAndEightByteIv(){
        val fields=box("stsz",ints(0,16,1))+box("stsc",ints(0,1,1,1,1))+box("stco",ints(0,1,1000))+box("saiz",ints(0)+byteArrayOf(8)+ints(1))
        val ftyp=box("ftyp","iso6".toByteArray())
        fun header(aux:Int)=ftyp+box("moov",box("trak",box("stbl",fields+box("saio",ints(0,1,aux))+byteArrayOf(1,2,3,4,5,6,7,8))))
        val data=header(header(0).size-8)
        val parsed=CencIndex.prepare(data)
        assertEquals(1,parsed.samples.size);assertEquals(1000L,parsed.samples.single().start);assertEquals(1016L,parsed.samples.single().end)
        assertArrayEquals(byteArrayOf(1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0),parsed.samples.single().iv)
    }
    @Test(expected=IllegalArgumentException::class)fun rejectsTruncatedMoov(){CencIndex.prepare(box("ftyp","iso6".toByteArray())+ints(100)+"moov".toByteArray())}
}
