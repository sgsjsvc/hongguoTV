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

## Device identity (read before touching `randomDeviceId` / `freshDevice`)

The upstream `video_model` endpoint is strict about device identity. Two rules apply,
both discovered the hard way:

1. **A device id may only be used once.** The same `device_id` succeeds on the first
   request and returns an empty body (HTTP 200, zero bytes) on every request after that.
   `requestVideoModel` therefore calls `freshDevice()` per attempt, never reusing a value.
2. **A fixed device id gets blocked outright.** A hardcoded constant works until upstream
   blacklists it, then every client fails at once with an empty body — not an error code.

Because all three clients share this file, a single hardcoded value breaks Web, Windows
and TV simultaneously.

### Structural rules

- There is **no module-level `DEVICE` constant**. Do not reintroduce one.
- Functions needing device identity take it as a **required** argument and throw when it
  is missing. There is deliberately no `|| DEVICE` fallback: a silent fallback once made a
  fix look ineffective because the signature still used the old id.
- Device entropy must work in **both** runtimes. `crypto.randomBytes` exists in Node but
  **not** in the TV QuickJS host (which only provides `createHash` / `createDecipheriv`),
  so `deviceEntropy()` probes for it and falls back to hashing
  `time + sequence + Math.random + performance.now`.

`tests/device-identity.test.mjs` locks these rules, including a test that loads the engine
with a TV-like `crypto` that lacks `randomBytes`.

### Diagnosing a playback outage

```bash
node scripts/diagnose-playback.mjs   # layered: engine -> service -> upstream -> end-to-end
npm run smoke                        # release gate: really fetches video, fails the build
```

An empty response body from upstream is the signature of device blocking. `/health` exposes
`playback.upstreamHealthy` / `playback.upstreamDegraded` so callers can tell "process alive"
from "actually able to play".
