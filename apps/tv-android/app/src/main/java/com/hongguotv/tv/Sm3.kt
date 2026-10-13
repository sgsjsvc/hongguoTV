package com.hongguotv.tv

/** SM3 compression as specified in GB/T 32905-2016; no global security provider changes. */
internal object Sm3 {
    fun digest(input:ByteArray):ByteArray {
        val padded=ByteArray(((input.size+9+63)/64)*64);input.copyInto(padded);padded[input.size]=0x80.toByte()
        val bits=input.size.toLong()*8;for(i in 0..7)padded[padded.lastIndex-i]=(bits ushr(i*8)).toByte()
        val state=intArrayOf(0x7380166f,0x4914b2b9,0x172442d7,0xda8a0600.toInt(),0xa96f30bc.toInt(),0x163138aa,0xe38dee4d.toInt(),0xb0fb0e4e.toInt())
        val words=IntArray(68)
        for(offset in padded.indices step 64){
            for(i in 0..15){val at=offset+i*4;words[i]=((padded[at].toInt()and 255)shl 24)or((padded[at+1].toInt()and 255)shl 16)or((padded[at+2].toInt()and 255)shl 8)or(padded[at+3].toInt()and 255)}
            for(i in 16..67){val n=words[i-16]xor words[i-9]xor rol(words[i-3],15);words[i]=n xor rol(n,15)xor rol(n,23)xor rol(words[i-13],7)xor words[i-6]}
            var a=state[0];var b=state[1];var c=state[2];var d=state[3];var e=state[4];var f=state[5];var g=state[6];var h=state[7]
            for(j in 0..63){
                val ss1=rol(rol(a,12)+e+rol(if(j<16)0x79cc4519 else 0x7a879d8a,j),7)
                val ss2=ss1 xor rol(a,12)
                val ff=if(j<16)a xor b xor c else(a and b)or(a and c)or(b and c)
                val gg=if(j<16)e xor f xor g else(e and f)or(e.inv()and g)
                val tt1=ff+d+ss2+(words[j]xor words[j+4]);val tt2=gg+h+ss1+words[j]
                d=c;c=rol(b,9);b=a;a=tt1;h=g;g=rol(f,19);f=e;e=tt2 xor rol(tt2,9)xor rol(tt2,17)
            }
            state[0]=state[0]xor a;state[1]=state[1]xor b;state[2]=state[2]xor c;state[3]=state[3]xor d;state[4]=state[4]xor e;state[5]=state[5]xor f;state[6]=state[6]xor g;state[7]=state[7]xor h
        }
        return ByteArray(32){i->(state[i/4]ushr(24-(i%4)*8)).toByte()}
    }
    private fun rol(value:Int,bits:Int)=Integer.rotateLeft(value,bits)
}
