# Portable content engine

`hongguo.js` preserves the current vendor engine and its pure JavaScript signing,
Spade URL decoding, CENC sample-index parsing, and MP4 transformation. The official
category SSR loader is accepted under both `category_page` and `category_$`.

Node supplies Buffer, crypto, axios and URLSearchParams. Android bundles Buffer
6.0.3 and provides native OkHttp, MD5/SHA512/SM3 and AES adapters to a self-built
QuickJS 2025-09-13 runtime. Android's Gradle preBuild copies this shared source into
generated APK assets so signing/decryption algorithms have one maintained source.

The TV host includes a mathematical unsigned BigInt normalization shim because
the pinned QuickJS release can retain a negative short BigInt in `asUintN(64, x)`.
JNI updates the VM stack top when serialized requests move between worker threads.
