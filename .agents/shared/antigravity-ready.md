# Antigravity 鎺ュ叆鎶ュ憡

- 韬唤锛歚antigravity`锛屾墽琛屽強娴忚鍣ㄩ獙璇佹柟銆?
- 妫€鏌ユ椂闂达細2026-10-13 20:31锛圓sia/Shanghai锛夈€?
- 鐘舵€侊細宸叉帴鍏ユ枃浠跺崗浣滄€荤嚎锛屽緟鍛斤紱鏈鏈慨鏀逛换浣曚笟鍔′唬鐮併€?
- 宸茶鍙栵細`.agents/README.md`銆乣.agents/QUICKSTART.md`銆傛墽琛岀害鏉熶互鐢ㄦ埛鏈€鏂版寚浠ゅ拰 QUICKSTART 涓哄噯銆?

---

## 1. 鍙闂洰褰?

- **椤圭洰鏍圭洰褰?*锛歚F:\Project\hongguoTV`锛堝畬鍏ㄨ鍐欏彲杈撅級銆?
- **鏂囦欢鎬荤嚎涓庡崗浣滅洰褰?*锛?
  - `.agents/inbox/`锛堜换鍔￠鍙栵級
  - `.agents/outbox/`锛堢粨鏋滆緭鍑猴級
  - `.agents/shared/`锛堝叡浜簨瀹炰笌灏辩华鎶ュ憡锛屾湰娆″凡鍐欏叆 `antigravity-ready.md`锛?
  - `.agents/state/`锛堢姸鎬佷笌閿佸畾锛?
  - `.agents/logs/`锛堟墽琛屼簨浠舵祦锛?
  - `.agents/archive/`锛堝綊妗ｄ换鍔★級
- **鍓嶇涓庢闈㈡簮鐮佺洰褰?*锛歚apps/web-pc/`锛圧eact 鍓嶇鐣岄潰銆丒lectron 妗岄潰閰嶇疆銆佹瀯寤轰笌闈欐€佽祫婧愶級銆?
- **鍏变韩涓庡悗绔洰褰?*锛歚shared/`銆乣custom-server/`銆乣server/`锛堝彲璇伙紝渚涙瘮瀵逛笌鑱旇皟鎺掓煡锛夈€?
- **楠岃瘉涓庢祴璇曠洰褰?*锛歚tests/`銆乣docs/`銆乣outputs/`銆?

---

## 2. 鍙敤宸ュ叿

| 宸ュ叿绫诲埆 | 鍏蜂綋宸ュ叿 / 杩愯鐜 | 鐘舵€佷笌鑳藉姏璇存槑 |
| --- | --- | --- |
| **鍩虹鎵ц鐜** | Node.js `v22.20.0`銆乶pm `10.9.3`銆丟it `2.51.0.windows.1`銆丳owerShell | 姝ｅ父鍙敤锛屾敮鎸佹瀯寤恒€佹墦鍖呫€佺被鍨嬫鏌ュ強娴嬭瘯 |
| **娴忚鍣ㄩ獙璇佸伐鍏?* | `chrome-devtools-mcp` (Lazy MCP)<br>鍖呭惈 navigate, click, fill, evaluate_script, take_screenshot, list_network_requests, get_console_message, wait_for 绛?| **宸插氨缁?*銆傚叿澶囩洿鎺ユ搷鎺?Chrome/Chromium 娴忚鍣ㄣ€丏OM 妫€娴嬨€佺綉缁滄祦鎶撳寘銆丆onsole 鏃ュ織鎶撳彇涓庣晫闈㈡埅鍥捐兘鍔?|
| **鏂囦欢鍗忎綔 CLI** | `node .agents/cli.mjs` (status / ready / claim / done / fail) | 宸插疄娴嬫甯歌繍琛岋紝閫氫俊鏃犲紓甯?|
| **鍓嶇楠岃瘉鎸囦护** | `npm run typecheck`<br>`npm run build`<br>`npm --prefix apps/web-pc run dev`<br>`npm test` | 鍙繍琛屽墠绔瀯寤恒€乀ypeScript 闈欐€佹鏌ャ€佹湰鍦?Vite 寮€鍙戞湇鍔″強鍗曞厓娴嬭瘯 |

---

## 3. 浠诲姟涓庡伐浣滃尯鐜扮姸

1. **浠诲姟妫€鏌?*锛?
   - 鎵ц `node .agents/cli.mjs status` 缁撴灉锛歚total: 0`銆?
   - 鎵ц `node .agents/cli.mjs ready` 缁撴灉锛歚(绌?`銆?
   - inbox 涓綋鍓嶆棤寰呭姙浠诲姟銆傛湭璁ら銆佹湭鎵ц銆佹湭鏀瑰姩浠讳綍涓氬姟浠诲姟銆?

2. **宸ヤ綔鍖烘棦鏈夋湭鎻愪氦宸紓**锛堝凡妫€鏌ワ紝鏈鐩栥€佹湭鍥為€€銆佹湭娓呯悊锛夛細
   - `custom-server/index.mjs`
   - `custom-server/vendor/hongguo.cjs`
   - `server/vendor/hongguo.cjs`
   - `shared/content-core/hongguo.js`
   - 鏈窡韪枃浠讹細`.agents/`銆乣docs/plans/2026-10-13-playback-upstream-fix.md`銆乣scripts/tv-verify.ps1`銆?

---

## 4. 璋冭瘯璁惧锛?026-10-15 鍒嗛厤锛?

**浣犵殑鍥哄畾璁惧锛欴1**

| 椤?| 鍊?|
| --- | --- |
| adb 鍦板潃 | **`127.0.0.1:16384`** |
| Android | 12锛圓PI 32锛?|
| 鍒嗚鲸鐜?| 720脳1280锛?*宸茶皟涓?1280脳720** |
| 瀵嗗害 | 240 |
| 宸茶 App | 鉁?`com.hongguotv.tv` |

### 鈿狅笍 adb 鐜锛堝繀璇伙級

**鏈満 DSH 娌欑鎷掔粷缁戝畾 6300 浠ヤ笅 loopback 绔彛**锛宎db 榛樿 5037 浼氬け璐ャ€?*蹇呴』**锛?

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384
```

### 璁惧浣跨敤瑙勮寖

1. **鍙敤 D1**锛坄127.0.0.1:16384`锛夆€斺€?涓嶈鎿嶄綔鍏朵粬 agent 鐨勮澶?
2. **濮嬬粓鐢?`-s 127.0.0.1:16384`** 鏄惧紡鎸囧畾锛屼笉瑕佷緷璧栭粯璁よ澶?
3. 鎴浘鍛藉悕甯﹁澶囨爣璇嗭細`<浠诲姟ID>-d1-<鍦烘櫙>-<鏃堕棿鎴?.png`
4. `wm size` 瑕嗙洊**閲嶅惎鍚庝細閲嶇疆**锛岄渶閲嶆柊璁剧疆

**瀹屾暣璁惧鐭╅樀瑙?* `.agents/shared/device-allocation.md`

---

## 5. 闃诲椤逛笌鍚庣画鎵ц绾︽潫

1. **闃诲椤?*锛?
   - **B1. 褰撳墠鏃犱换鍔?*锛欼nbox 涓皻鏃犲垎閰嶇粰 `antigravity` 鐨勪换鍔★紝澶勪簬寰呭懡鐘舵€侊紝绛夊緟鍗忚皟鑰咃紙DSH锛夋淳鍙戙€?
   - **B2. 鍏变韩鏍稿績闅旂绾︽潫**锛歚shared/content-core/hongguo.js` 涓轰笁绔叡鐢紱淇敼蹇呴』鍚屾涓変唤鍓湰锛坄shared/` + 涓や唤 `vendor/`锛夈€?
2. **鎵ц涓庨獙璇佸噯鍒?*锛?
   - 鏀跺埌鏄庣‘浠诲姟鍚庯紝**浠呰棰?`assignee=antigravity` 涓斿墠缃緷璧栧叏閮ㄥ畬鎴愶紙ready锛夌殑浠诲姟**銆?
   - **楠岃瘉涓ョ"鍋囨垚鍔?**锛氶獙璇佸繀椤诲搴旀槑纭殑浠ｇ爜鐗堟湰/鎻愪氦锛?*鍧氬喅涓嶆妸 HTTP 200/鎴愬姛鍝嶅簲褰撲綔瀹為檯鎾斁鎴愬姛**锛屽繀椤婚€氳繃娴忚鍣?DevTools / DOM / Media 浜嬩欢娣卞害鏍搁獙鎾斁鍣ㄥ疄闄呮挱鏀剧姸鎬侊紙濡?`video.currentTime > 0`銆佹棤鍗￠】閿欒浜嬩欢銆佸疄闄呮覆鏌撳抚绛夛級銆?
   - **TV 绔凡鍦ㄨ寖鍥村唴**锛堟棫鐗堟湰鏂囨。涓殑"TV 鑼冨洿鎺掗櫎"宸插簾姝級銆?
   - **瀹炴満楠岃瘉娉ㄦ剰**锛氶潤鎬佹埅鍥?*涓嶈兘**璇佹槑"鍗′綇"鎴?姝ｅ父"锛屽繀椤婚獙璇?*鐘舵€佹槸鍚︽帹杩?*锛堝鎾斁浣嶇疆鏃堕棿鎴冲彉鍖栵級銆?

---

## 鍙珵浜変换鍔★紙2026-10-15 鏂板锛?
閮ㄥ垎浠诲姟**涓嶅浐瀹氬綊灞?*锛岀敱澶氫釜 agent **鍏堝埌鍏堝緱**銆?
### 褰撳墠鍙珵浜変换鍔?
| 浠诲姟 ID | 鏍囬 | 鍙棰嗘柟 | 瑙勫垯 |
| --- | --- | --- | --- |
| `t-q5-fix-dup-append` | Q5 淇鍒嗛〉閲嶅杩藉姞 | **codex / antigravity** | 璋佸厛瀹屾垚鑷繁褰撳墠鐨?W 浠诲姟锛岃皝璁ら |

### 璁ら鏂瑰紡

```powershell
node .agents/cli.mjs claim t-q5-fix-dup-append <浣犵殑韬唤>
```

### 鏈哄埗

- 鍏堣棰嗚€呰幏寰?**30 鍒嗛挓鐙崰閿?*
- 鍙︿竴鏂硅棰嗕細鏀跺埌 `task already claimed by <瀵规柟>`
- **涓嶈寮鸿鎶㈠崰** 鈥斺€?鑻ヨ棰嗗け璐ワ紝璇存槑瀵规柟宸插紑濮嬶紝璇峰嬁閲嶅宸ヤ綔

### 濡備綍璇嗗埆鍙珵浜変换鍔?
```powershell
node .agents/cli.mjs ready     # 鍙珵浜変换鍔′細鏄剧ず [鍙珵浜塢 鏍囪
node .agents/cli.mjs show <id> # 鏌ョ湅 assignees 涓?competitive 瀛楁
```

---

## 鍏ㄥ睆浠诲姟鍒嗗伐锛?026-10-15锛?
### 鍏抽敭浜嬪疄锛歐eb 涓?Electron 鏄悓涓€濂楀墠绔唬鐮?
`apps/web-pc/src` 鈫?`vite build` 鈫?`dist` 鈫?琚?Electron 涓庢祻瑙堝櫒**鍏辩敤**銆?
**鎵€浠ユ敼涓€娆″墠绔唬鐮侊紝涓ょ閮界敓鏁堛€?* 妗岄潰绔嚜鍔ㄨ蛋 `window.hongguotvDesktop` 妗ユ帴锛?娴忚鍣ㄨ蛋 DOM API銆?
### 鍒嗗伐

| 浠诲姟 | 璐熻矗鏂?| 椤甸潰 | 鏂囦欢 |
| --- | --- | --- | --- |
| **W5** | **codex** | 璇︽儏椤?鎾斁寮圭獥 | `PlayerModal.tsx` |
| **W4** | **antigravity** | 鎺ㄨ崘娴?| `RecommendStream.tsx` |

### 涓ゆ潯閫氱敤瑕佹眰

1. **淇濈暀鑷姩涓嬩竴闆?* 鈥斺€?鍏ㄥ睆鍚庤嚜鍔ㄨ繛鎾繀椤荤户缁伐浣?2. **鏁翠釜灞忓箷鍏ㄥ睆** 鈥斺€?鐢?`win.setFullScreen`锛圵3 宸插疄鐜帮級锛屼笉鐢?`maximize` 鎴?CSS 妯℃嫙

### 鍙傝€冨浘

- 鍥句簩锛堣鎯呴〉鍏ㄥ睆锛夛細`.agents/shared/ref-fig2-other-page-fullscreen.png`
- 鍥句竴锛堟帹鑽愰〉鍏ㄥ睆锛夛細瑙?`fullscreen-task-split.md` 鐨?ASCII 鎻忚堪

### 鏂囨。

- 鍒嗗伐鎬昏锛歚.agents/shared/fullscreen-task-split.md`
- 闇€姹傛洿姝ｏ細`.agents/shared/fullscreen-requirement-correction.md`

---

## 鎬ц兘浼樺寲浠诲姟锛?026-10-16锛?
鍗忚皟鑰呭凡瀹炴祴寤虹珛鍩虹嚎锛岃 `.agents/shared/perf-baseline.md`銆?
### 瀹炴祴鏁版嵁

| 鐜妭 | 鑰楁椂 |
| --- | --- |
| **璇︽儏鎺ュ彛** | **1086鈥?035 ms锛堝钩鍧?1369锛屾棤缂撳瓨锛?* |
| 鎺ㄨ崘棣栧睆 | 2514 ms锛堝喎锛? 2 ms锛堢儹锛?|
| 娓呮櫚搴?| 0鈥? ms锛堝凡缂撳瓨锛?|
| 鍙栨祦 | 32鈥?7 ms锛堝凡缂撳瓨锛?|
| 鑷姩涓嬩竴闆嗭紙鍚屽墽锛?| 38 ms |
| **鑷姩鍒囦笅涓€閮ㄥ墽** | **1407 ms** |

### 浠诲姟鍒嗛厤锛堜笁鏂瑰悇涓€涓紝瀹屽叏骞惰锛?
| 浠诲姟 | 璐熻矗鏂?| 鏂囦欢 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `apps/tv-android/` |

### 娴嬮噺鑴氭湰锛堥獙鏀堕渶鐢ㄥ悓涓€鑴氭湰澶嶆祴锛?
```powershell
node scripts/perf/measure-playback.mjs    # 鍩虹閾捐矾
node scripts/perf/measure-deep.mjs        # 鍐风儹瀵规瘮涓庡苟鍙?```

### 璁ら鏂瑰紡

```powershell
node .agents/cli.mjs claim <浠诲姟ID> <浣犵殑韬唤>
```

---

## 鎬ц兘浼樺寲浠诲姟琛ュ厖锛?026-10-16 绗簩鎵癸級

### 鏂板 P4锛歍V 绔垪琛ㄦ覆鏌撲笌婊氬姩娴佺晠搴?
**鍗忚皟鑰呴潤鎬佸鏌ュ彂鐜?4 涓棶棰?*锛堣 `.agents/shared/perf-baseline-render.md`锛夛細

| # | 闂 | 褰卞搷 |
| --- | --- | --- |
| A | `SeriesAdapter` 鏃?`onViewRecycled` | 蹇€熸粴鍔ㄥ浘鐗囬敊浣?|
| B | `ArtworkLoader.load()` 鏃犳潯浠舵竻绌哄浘鐗?| 婊氬姩闂儊 |
| C | `GradientDrawable` 姣忔 bind 閮芥柊寤?| 姒滃崟婊氬姩瀵硅薄鍒嗛厤 |
| D | OkHttp 鏃犲苟鍙戦檺鍒?| 蹇€熸粴鍔ㄨ姹傞鏆?|

### 鏈€缁堝垎宸ワ紙璐熻浇 2/2/1锛?
| 浠诲姟 | 璐熻矗鏂?| 鏂囦欢 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p4-tv-render` | **codex** | `SeriesAdapter.kt`銆乣ArtworkLoader.kt` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `MainActivity.kt` |

**娉ㄦ剰**锛歝odex 棰嗕簡 P1 涓?P4 鈥斺€?涓よ€?*鏂囦欢涓嶉噸鍙?*锛堟湇鍔＄ vs TV 绔級锛屽彲鑷敱瀹夋帓椤哄簭銆?
### 鈿狅笍 璁惧褰撳墠绂荤嚎

MuMu 妯℃嫙鍣ㄥ凡鍏抽棴锛岀湡鏈?`192.168.1.120:5555` 鏄剧ず `offline`銆?
**娑夊強 TV 鐨勪换鍔★紙P3銆丳4锛夐渶鍏堝惎鍔ㄦā鎷熷櫒鎴栬繛鐪熸満**锛?
```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect 127.0.0.1:16384
```

鑻ヨ澶囦笉鍙敤锛屽彲鍏堝仛浠ｇ爜鏀瑰姩锛?*鍦ㄦ姤鍛婁腑鏍囨敞銆屾湭瀹炴祴銆?*銆?

---

## 鈿狅笍 P1 浠诲姟鐩爣宸蹭慨姝ｏ紙2026-10-16锛?
### 鎴戝厛鍓嶇殑璇婃柇涓嶅畬鏁?
**鍘熷垽鏂?*锛氥€岃鎯呮帴鍙ｆ棤缂撳瓨銆嶁€斺€?**涓嶅畬鏁?*銆?
**瀹炴祴鍙戠幇**锛歚detail()` 鑷韩鏃犵紦瀛橈紝浣嗗畠璋冪敤鐨?`routerData()` **鏈?`pageCache`锛圱TL 180 绉掞級**銆?
| 鎯呭喌 | 璇︽儏鑰楁椂 |
| --- | --- |
| 180 绉掑唴璁块棶杩?| **1 ms** |
| **棣栨璁块棶** | **1453 ms** |
| **瓒呰繃 180 绉?* | **1453 ms** |

### 鐪熸鐨勭摱棰?
**涓嶆槸銆岀己缂撳瓨銆嶏紝鑰屾槸銆屾病鏈夐鍙栥€嶃€?*

鐪熷疄鍒囧墽瀹炴祴锛?
| 鍦烘櫙 | 鍚堣 |
| --- | --- |
| 鍒囧埌宸茬紦瀛樺墽 | 805 ms |
| **鍒囧埌鏈紦瀛樺墽** | **1981 ms**锛堣鎯呭崰 1453 ms锛?|

**棣栨鍒囧埌鏌愰儴鍓э紝鏃犺濡備綍閮借绛変竴娆′笂娓歌姹?* 鈥斺€?鍔犵紦瀛樿В鍐充笉浜嗐€?
### 淇鍚庣殑 P1 鐩爣

| 鍘?| 鏂?|
| --- | --- |
| ~~璇︽儏鎺ュ彛鍔犵紦瀛榽~ | **瀹炵幇棰勫彇鏈哄埗** |

**瑕佹眰**锛氭彁渚涘彲澶嶇敤鐨勯鍙栬兘鍔涳紝璁╁鎴风鍦ㄧ敤鎴峰垏鎹?*涔嬪墠**鍚庡彴鍔犺浇銆?
**鍏抽敭璁捐**锛氬苟鍙戞帶鍒躲€佸彲鍙栨秷銆佸幓閲嶃€佷綆浼樺厛绾э紙澶辫触涓嶅奖鍝嶄富娴佺▼锛夈€佸彲鍏抽棴銆?
**璇︾粏瑕佹眰瑙?`.agents/inbox/t-p1-detail-cache.brief.md`銆?*

### 鎴戠殑澶辫涓庢暀璁?
鎴戝熀浜庝唬鐮佸鏌ユ柇瑷€銆屾棤缂撳瓨銆嶏紝浣嗘病鍋氥€岄噸鍚湇鍔?+ 棣栨璇锋眰銆嶇殑瀵圭収娴嬭瘯銆?鍏堝墠娴嬮噺鏃舵湇鍔″凡杩愯锛宍pageCache` 鏈夋暟鎹紝鐪嬪埌 1ms 鏃舵垜浠ヤ负鏄埆鐨勬満鍒讹紝
鑰屽啓鍩虹嚎鏃跺張鏍规嵁浠ｇ爜鏂█銆屾棤缂撳瓨銆嶁€斺€?*涓よ€呴兘娌￠敊锛屼絾鎴戞病鎶婂畠浠仈绯昏捣鏉?*銆?
**鏁欒**锛氬垽鏂€屾湁鏃犵紦瀛樸€嶅繀椤绘竻绌虹紦瀛樺悗娴嬮娆¤姹傘€?
瀹屾暣淇璇存槑瑙?`.agents/shared/perf-baseline-correction.md`銆?

---

## 鈿狅笍 骞惰娉ㄦ剰浜嬮」锛圱V 绔换鍔★級

P3锛坵orkbuddy锛変笌 P4锛坈odex锛?*閮戒慨鏀?TV 绔唬鐮?*锛?
| 浠诲姟 | 鏂囦欢 |
| --- | --- |
| P3 | `MainActivity.kt` |
| P4 | `SeriesAdapter.kt`銆乣ArtworkLoader.kt` |

**鏂囦欢涓嶉噸鍙狅紝鍙悓鏃舵敼浠ｇ爜銆?*

**浣嗘瀯寤烘椂浼氫簤鐢ㄥ悓涓€涓?Gradle build 鐩綍**锛?
- 鍚屾椂鎵ц `assembleDebug` 鍙兘瀵艰嚧 Gradle 瀹堟姢杩涚▼鍐茬獊
- 鐥囩姸锛氭瀯寤哄け璐ャ€佷骇鐗╀笉瀹屾暣銆佹垨 `Unable to delete directory`

**寤鸿**锛?
1. **鏀逛唬鐮佸彲骞惰**锛屼絾**鏋勫缓鍓嶄簰鐩哥‘璁?*锛堟垨閿欏紑鏃堕棿锛?2. 鑻ユ瀯寤哄け璐ヤ笖鍘熷洜涓嶆槑锛屽厛妫€鏌ユ槸鍚︽湁鍙︿竴涓?Gradle 杩涚▼鍦ㄨ窇
3. 鏋勫缓鍚庡彲楠岃瘉浜х墿鏃堕棿鎴筹紝纭鏄嚜宸遍偅娆℃瀯寤?
```powershell
# 妫€鏌ユ槸鍚︽湁鍏朵粬 Gradle 杩涚▼
Get-Process -Name java -ErrorAction SilentlyContinue | Select-Object Id, StartTime
```

## 鎾斁娴佺晠搴︽祴閲忕粨璁猴紙鏂板锛?
**鍚炲悙宸叉帓闄?*锛氬疄娴嬩唬鐞嗗悶鍚?**108鈥?89 Mbps**锛屾槸 1080P 鐮佺巼鐨?**36鈥?3 鍊?*銆?
**鐪熸鐨勭摱棰堟槸 HEVC 瑙ｇ爜** 鈥斺€?涓婃父鎵€鏈夋竻鏅板害鍧囦负 HEVC锛坄bytevc1`锛夛紝
鏃犵‖浠惰В鐮佺殑璁惧浼氳蒋瑙ｆ帀甯с€?
璇﹁ `.agents/shared/perf-throughput-verdict.md`銆?
**杩欐剰鍛崇潃**锛?
- 鉂?涓嶉渶瑕佷紭鍖栫綉缁?浠ｇ悊锛堝凡瓒冲蹇級
- 鉁?搴斿叧娉細鍒囬泦閲嶅缓锛圥2锛夈€乁I 鏍戦噸寤猴紙P3锛夈€佸垪琛ㄦ覆鏌擄紙P4锛夈€佹挱鏀惧櫒鍙傛暟

---

## 新增 P5：Web 端轮询优化（2026-10-16）

### 协调者实测发现

`apps/web-pc/src/api.ts:72`：

```javascript
setInterval(() => void refreshLibrary().catch(() => {}), 1000);   // 每秒一次
```

**实测**：每秒 1 次请求 `/api/library`，单次响应 14.2 KB。

| 指标 | 值 |
| --- | --- |
| 每小时 | **50.0 MB** |
| **每天** | **1201 MB** |

**响应体是完整 library**（收藏+历史+偏好+同步状态），随数据增长变大。

### ✅ TV 端有现成的正确范例

`apps/tv-android/.../HistorySync.kt:33`：

```kotlin
var backoff = 1000L
while (isActive) {
  if (foreground && remoteUrl.isNotBlank()) {      // 仅前台 + 已配置
    try { flush(); backoff = 1000 }
    catch { backoff = (backoff * 2).coerceAtMost(30000) }   // 指数退避
  }
  delay(backoff)
}
```

| 特性 | TV | Web（当前） |
| --- | --- | --- |
| 仅前台请求 | ✅ | ❌ |
| 指数退避 | ✅ | ❌ 固定 1s |
| 未配置跳过 | ✅ | ❌ |

### 要求（最低成本）

1. 页面不可见时暂停（`document.hidden`）
2. 间隔 1s → 10s
3. 播放视频时暂停或降频

### ⚠️ 不要破坏

- **主动操作**（点收藏）必须**立即生效**
- 多端同步 **≤ 10 秒**可接受
- 切回前台应**立即拉取一次**
- `refreshLibrary` 被多处调用，**只改 `setInterval` 那处**

### 最终负载（2/2/2）

| 任务 | 负责方 |
| --- | --- |
| P1 预取机制 | codex |
| P4 TV 列表渲染 | codex |
| P2 Web video 复用 | antigravity |
| **P5 Web 轮询优化** | **antigravity** |
| P3 TV UI 树复用 | workbuddy |

详见 `.agents/inbox/t-p5-polling.brief.md`。
