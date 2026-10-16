# P4 TV 绔垪琛ㄦ覆鏌撲笌婊氬姩娴佺晠搴?
**浠诲姟 ID**: `t-p4-tv-render`
**璐熻矗浜?*: **antigravity**
**渚濊禆**: 鏃狅紙涓?P3 鏂囦欢涓嶅啿绐侊級
**鍗忚皟鑰?*: dsh
**鑼冨洿**: TV 绔垪琛ㄦ覆鏌?
---

## 涓€銆佽儗鏅?
**鍗忚皟鑰呴潤鎬佸鏌ュ彂鐜?4 涓棶棰?*锛堣瑙?`.agents/shared/perf-baseline-render.md`锛夈€?
**娉ㄦ剰**锛氳澶囧綋鍓嶇绾匡紙MuMu 鍏抽棴锛岀湡鏈?offline锛夛紝鏈换鍔″熀浜庝唬鐮佸鏌ャ€?**鎵ц鏂归渶鍦ㄨ澶囧彲鐢ㄦ椂瀹炴祴楠岃瘉銆?*

### 涓?P3 鐨勫叧绯?
| 浠诲姟 | 鏂囦欢 | 璐熻矗鏂?|
| --- | --- | --- |
| P3 TV 鍒囬泦 UI 鏍戝鐢?| `MainActivity.kt` | workbuddy |
| **P4 TV 鍒楄〃娓叉煋锛堟湰浠诲姟锛?* | **`SeriesAdapter.kt`銆乣ArtworkLoader.kt`** | **antigravity** |

**鏂囦欢涓嶉噸鍙狅紝鍙苟琛屻€?*

---

## 浜屻€佽淇殑闂

### 馃敶 闂 A锛歚SeriesAdapter` 鏃?`onViewRecycled`

**浣嶇疆**锛歚apps/tv-android/.../SeriesAdapter.kt`

**鐜扮姸**锛氬彧鏈?`onBindViewHolder`锛?*娌℃湁 `onViewRecycled`**銆?
**褰卞搷**锛歊ecyclerView 澶嶇敤鍗＄墖鏃舵棫鍥剧墖娈嬬暀 鈫?**蹇€熸粴鍔ㄥ嚭鐜板浘鐗囬敊浣?*锛堟樉绀轰笂涓€閮ㄥ墽灏侀潰锛夈€?
**瑕佹眰**锛?
```kotlin
override fun onViewRecycled(holder: Holder) {
    super.onViewRecycled(holder)
    holder.image.tag = null          // 娓呯悊 tag锛岄伩鍏嶅鐢ㄨ鍒?    holder.image.setImageDrawable(null)
    // 閲嶇疆鍙兘娈嬬暀鐨勭姸鎬侊紙濡?rankBadge 鑳屾櫙锛?}
```

### 馃敶 闂 B锛歚ArtworkLoader.load()` 姣忔閮芥竻绌哄浘鐗?
**浣嶇疆**锛歚ArtworkLoader.kt:21`

```kotlin
fun load(url: String, target: ImageView) {
    target.tag = url; target.setImageDrawable(null)   // 鈫?鏃犳潯浠舵竻绌?    if (url.isBlank()) return
    cache.get(url)?.let { target.setImageBitmap(it); return }
    ...
}
```

**褰卞搷**锛?*姣忔 bind 閮藉厛娓呯┖** 鈫?婊氬姩鏃?*鏄庢樉闂儊**銆?
**瑕佹眰**锛?
- 鑻?`target.tag == url` **涓斿凡鏈夊浘鐗?*锛岀洿鎺ヨ繑鍥烇紙閬垮厤閲嶅宸ヤ綔锛?- **缂撳瓨鍛戒腑鏃朵笉娓呯┖**锛岀洿鎺?`setImageBitmap`

**寤鸿鏀规硶**锛?
```kotlin
fun load(url: String, target: ImageView) {
    if (target.tag == url && target.drawable != null) return   // 宸叉槸鐩爣鍥撅紝璺宠繃
    if (url.isBlank()) { target.tag = null; target.setImageDrawable(null); return }
    cache.get(url)?.let {
        target.tag = url
        target.setImageBitmap(it)      // 鍛戒腑缂撳瓨锛氫笉娓呯┖锛岀洿鎺ヨ缃?        return
    }
    target.tag = url
    target.setImageDrawable(null)      // 浠呮湭鍛戒腑鏃舵墠娓呯┖
    scope.launch { ... }
}
```

### 馃煛 闂 C锛歚GradientDrawable` 姣忔 bind 閮芥柊寤?
**浣嶇疆**锛歚SeriesAdapter.kt:141-144`

```kotlin
val cornerRadiusPx = TvUi.dimen(holder.itemView.context, R.dimen.series_rank_badge_radius).toFloat()
holder.rankBadge.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, bgGradient).apply {
    cornerRadius = cornerRadiusPx
}
```

**褰卞搷**锛氭鍗曢〉婊氬姩鏃舵瘡娆?bind 閮藉垱寤烘柊瀵硅薄 + 鏌ヨ dimens銆?
**瑕佹眰**锛氬湪 `Holder` 涓?*缂撳瓨 4 绉?*锛堥噾/閾?閾?鏅€氾級`GradientDrawable`锛?鍦?`onCreateViewHolder` 鏃堕寤轰竴娆★紝bind 鏃舵寜浣嶇疆閫夌敤銆?
**娉ㄦ剰**锛歚cornerRadius` 渚濊禆 `TvUi.dimen`锛?*鍦?ViewHolder 鍒涘缓鏃惰绠椾竴娆″嵆鍙?*
锛堝悓涓€ holder 鐨勫昂瀵镐笉鍙橈級銆?
### 馃煛 闂 D锛氭棤鍥剧墖璇锋眰骞跺彂闄愬埗

**浣嶇疆**锛歚ArtworkLoader.kt:16`

```kotlin
private val client = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
```

**褰卞搷**锛歄kHttp 榛樿鍏佽 64 骞跺彂 鈫?蹇€熸粴鍔ㄦ椂**璇锋眰椋庢毚**銆?
**瑕佹眰**锛?
- 闄愬埗 `dispatcher.maxRequests` 涓?`maxRequestsPerHost`锛堝 4~8锛?- 鎴栧湪蹇€熸粴鍔ㄦ椂鍙栨秷杩涜涓殑璇锋眰锛堣繘闃讹紝鍙€夛級

---

## 涓夈€佸繀椤婚獙璇佺殑琛屼负

| # | 鍦烘櫙 | 鏈熸湜 |
| --- | --- | --- |
| 1 | 蹇€熸粴鍔ㄥ垎绫婚〉 | 鏃犲浘鐗囬敊浣?|
| 2 | 蹇€熸粴鍔ㄦ鍗曢〉 | 鏃犲浘鐗囬敊浣嶃€佹棤闂儊 |
| 3 | 婊氬姩鍚庡洖鍒板凡鍔犺浇浣嶇疆 | 鍥剧墖宸茬紦瀛橈紝绔嬪嵆鏄剧ず |
| 4 | 姒滃崟 Top 1/2/3 寰芥爣 | 棰滆壊姝ｇ‘锛堥噾/閾?閾滐級 |
| 5 | 姒滃崟 Top 4+ 寰芥爣 | 鏅€氳壊 |
| 6 | 鍒嗙被椤靛乏鏍忕瓫閫?| 涓嶅彈褰卞搷 |
| 7 | 鎼滅储缁撴灉椤?| 涓嶅彈褰卞搷 |
| 8 | 鍐呭瓨 | 鏃犳硠婕忥紙`dumpsys meminfo`锛?|

**娉ㄦ剰**锛歚SeriesAdapter` 琚?*鍒嗙被椤点€佹鍗曢〉銆佹悳绱㈢粨鏋?*鍏辩敤锛?*闇€鍏ㄥ満鏅洖褰?*銆?
---

## 鍥涖€佺‖鎬х害鏉?
1. **鍙敼鏂囦欢**锛?   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ArtworkLoader.kt`
2. **涓嶈鏀?* `MainActivity.kt`锛圥3 鐨勮亴璐ｏ紝workbuddy 鍦ㄥ仛锛?3. **涓嶈鏀?* `server/provider.mjs`銆乣custom-server/`锛圥1锛?4. **涓嶈鏀?* `apps/web-pc/src/`锛圥2 鏄綘鑷繁鐨勫彟涓€浠诲姟锛?5. **涓嶈鏀?* `shared/content-core/hongguo.js`
6. 淇濇寔 TV 鍗曞厓娴嬭瘯閫氳繃锛?2 椤癸級
7. 褰撳墠 shell 鏄?**Windows PowerShell 5.1**

---

## 浜斻€侀獙鏀舵爣鍑?
| # | 椤?| 鍒ゅ畾 |
| --- | --- | --- |
| 1 | `onViewRecycled` 宸插疄鐜?| 浠ｇ爜鏍稿疄 |
| 2 | 缂撳瓨鍛戒腑鏃朵笉娓呯┖鍥剧墖 | 浠ｇ爜鏍稿疄 |
| 3 | `GradientDrawable` 宸插鐢?| 浠ｇ爜鏍稿疄锛坆ind 涓笉鍐?new锛?|
| 4 | 鍥剧墖璇锋眰鏈夊苟鍙戜笂闄?| 浠ｇ爜鏍稿疄 |
| 5 | 8 椤硅涓洪獙璇侀€氳繃 | 璁惧瀹炴祴 |
| 6 | TV 鍗曞厓娴嬭瘯 32 椤归€氳繃 | |
| 7 | 鎶ュ憡鍐欏叆 `.agents/shared/t-p4-tv-render-codex.md` | |

---

## 鍏€侀獙璇佹柟娉?
### 鐜锛堣澶囧彲鑳介渶鍏堝惎鍔級

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384     # D1锛堥渶鍏堝惎鍔?MuMu锛?# 鎴栫湡鏈?& $adb connect 192.168.1.120:5555
```

**鑻ヨ澶囦笉鍙敤**锛氬湪鎶ュ憡涓?*鏄庣‘璇存槑**锛屽苟鑷冲皯鎻愪緵浠ｇ爜绾ц瘉鎹€?
### 婊氬姩娴佺晠搴︽祴閲?
```powershell
# 閲嶇疆缁熻
& $adb -s <璁惧> shell dumpsys gfxinfo com.hongguotv.tv reset
# 婊氬姩鑻ュ共娆?# 璇诲彇缁熻
& $adb -s <璁惧> shell dumpsys gfxinfo com.hongguotv.tv
```

鍏虫敞 **Janky frames** 姣斾緥涓?**90th/95th/99th percentile**銆?
### 鍐呭瓨妫€鏌?
```powershell
& $adb -s <璁惧> shell dumpsys meminfo com.hongguotv.tv | Select-String "TOTAL"
```

---

## 涓冦€佽瘉鎹姹?
1. **浠ｇ爜鏀瑰姩瀵规瘮**锛? 涓棶棰樼殑淇敼锛?2. **婊氬姩瀹炴祴**锛氬揩閫熸粴鍔ㄥ墠鍚庢埅鍥撅紙鏃犻敊浣嶏級
3. **gfxinfo 鏁版嵁**锛氫紭鍖栧墠鍚庣殑 Janky frames 瀵规瘮
4. **鍐呭瓨鏁版嵁**锛氱‘璁ゆ棤娉勬紡
5. **8 椤硅涓洪獙璇?*缁撴灉
6. TV 鍗曞厓娴嬭瘯杈撳嚭

**鑻ヨ澶囦笉鍙敤**锛氳鏄庢儏鍐碉紝鎻愪緵浠ｇ爜绾ц瘉鎹紝骞舵爣娉ㄣ€屾湭瀹炴祴銆嶃€?
---

## 鍏€佸凡鐭ラ櫡闃?
| 闄烽槺 | 璇存槑 |
| --- | --- |
| **`onViewRecycled` 蹇呴』娓?tag** | 鍚﹀垯澶嶇敤鏃朵細璇垽銆屽凡鏄洰鏍囧浘銆嶈€岃烦杩囧姞杞?|
| **缂撳瓨鍛戒腑涓嶆竻绌虹殑鍓嶆彁** | 渚濊禆 `tag` 鏍￠獙锛宼ag 涓嶅尮閰嶆椂蹇呴』娓呯┖ |
| **`GradientDrawable` 澶嶇敤** | 娉ㄦ剰 `cornerRadius` 鍦ㄤ笉鍚屽睆骞曟。浣嶄笅鐨勫€间笉鍚岋紝闇€鍦?ViewHolder 鍒涘缓鏃剁畻濂?|
| **`SeriesAdapter` 涓夊鍏辩敤** | 鍒嗙被椤?姒滃崟椤?鎼滅储椤碉紝鏀瑰姩闇€鍏ㄥ洖褰?|
| **璁惧绂荤嚎** | 闇€鍏堝惎鍔?MuMu 鎴栬繛鐪熸満 |
| 寮曟搸闄愬埗 | TV 鐨?QuickJS 鏃?`randomBytes`锛堝凡鐭ワ紝涓庢湰浠诲姟鏃犲叧锛?|

---

## 涔濄€佹彁浜ゆ柟寮?
```powershell
node .agents/cli.mjs done t-p4-tv-render codex "缁撹鍙婃姤鍛婅矾寰?
```
