package com.hongguotv.tv
import org.junit.Assert.assertEquals
import org.junit.Test
class Sm3Test {
    @Test fun publishedVectors(){
        assertEquals("66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0",Sm3.digest("abc".toByteArray()).joinToString(""){"%02x".format(it)})
        assertEquals("debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732",Sm3.digest("abcd".repeat(16).toByteArray()).joinToString(""){"%02x".format(it)})
    }
}
