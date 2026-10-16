# Codex 鎺ュ叆鎶ュ憡

- 韬唤锛歚codex`锛屾墽琛屽強瀹℃煡鏂广€?
- 妫€鏌ユ椂闂达細2026-10-13 20:28锛圓sia/Shanghai锛夈€?
- 鐘舵€侊細宸叉帴鍏ユ枃浠跺崗浣滄€荤嚎锛屽緟鍛斤紱鏈鏈慨鏀逛笟鍔′唬鐮併€?
- 宸茶鍙栵細`.agents/README.md`銆乣.agents/QUICKSTART.md`銆傜敤鎴锋渶鏂版寚浠や紭鍏堬紝鍏舵涓?QUICKSTART 鐨勬湰杞竟鐣屻€?

## 鍙闂洰褰?

- 椤圭洰鏍圭洰褰曪細`F:\Project\hongguoTV`锛屽凡瀹為檯璇诲彇锛屽崗浣滄姤鍛婂彲鍐欏叆銆?
- 鍗忎綔鐩綍锛氶」鐩唴 `.agents/inbox`銆乣outbox`銆乣shared`銆乣state`銆乣logs`銆乣archive`銆?
- 鍙鍙栭」鐩簮鐮併€佹祴璇曘€佽剼鏈€佷氦鎺ュ強璁″垝鏂囨。锛涘綋鍓嶄粎鎺堟潈鎺ュ叆妫€鏌ュ拰鎶ュ憡鍐欏叆銆?
- 闄勫姞鍙闂伐浣滃尯锛歚C:\Users\AnLin\.codex\visualizations\2026\10\12\01a12ea6-758d-7c22-9032-2c96e9b8e060`锛屽凡纭瀛樺湪锛屾湰娆℃湭鍐欏叆銆?
- 鏈細璇濆疄闄呮枃浠舵潈闄愬苟闈?README 鎵€杩扮殑鍥哄畾 workspace-write锛涙墽琛岃寖鍥翠粛涓ユ牸鍙楃敤鎴锋巿鏉冪害鏉熴€?

## 鍙敤宸ュ叿

| 宸ュ叿 | 鏈纭鎯呭喌 |
| --- | --- |
| PowerShell | 鍙墽琛岃鍙栥€佹鏌ュ懡浠?|
| Node.js | `node --version` 鈫?`v22.20.0` |
| npm | `npm --version` 鈫?`10.9.3` |
| Git | `git --version` 鈫?`2.51.0.windows.1` |
| ripgrep | `rg --version` 鈫?`15.2.0` |
| 鏂囦欢鍗忎綔 CLI | `status`銆乣ready` 宸插疄闄呮墽琛屾垚鍔?|
| 鏂囦欢缂栬緫宸ュ叿 | 鍙畾鍚戝垱寤恒€佷慨鏀规巿鏉冭寖鍥村唴鐨勬枃浠讹紱鏈浠呭垱寤烘湰鎶ュ憡 |
| 缃戠粶妫€鏌ヤ笌缃戦〉妫€绱?| 褰撳墠浼氳瘽鎻愪緵锛屾帴鍏ユ鏌ユ湭鍙戣捣涓婃父涓氬姟璇锋眰 |
| Python | 宸插彂鐜?`F:\software\Anaconda3\python.exe`锛涙湰娆℃湭楠岃瘉鍏惰繍琛屽強渚濊禆 |
| 娴忚鍣ㄨ嚜鍔ㄥ寲 | 宸茬‘璁ゆ湰鏈?Playwright 鍖呭瓨鍦紱鏈鏈惎鍔ㄦ祻瑙堝櫒 |
| Android 宸ュ叿 | 宸茬‘璁?ADB 鍜?JDK 17 鏂囦欢瀛樺湪锛涙湰杞?TV 涓嶅湪鎵ц鑼冨洿锛屾湭杩炴帴鎴栨搷浣滆澶?|

宸ュ叿瀛樺湪涓嶄唬琛ㄥ叾浠?agent 鐨勮嚜鍔ㄨ皟鐢ㄩ€傞厤鍣ㄥ凡楠岃瘉銆傛湰娆℃湭鎵ц `doctor`銆乣run`锛屾湭璋冪敤鍏朵粬浜у搧鐨勭鏈変細璇濇帴鍙ｏ紝涔熸湭鍒涘缓澶栭儴浼氳瘽銆?

## 浠诲姟妫€鏌?

鍦ㄩ」鐩牴鐩綍瀹為檯鎵ц锛?

```powershell
node .agents/cli.mjs status
node .agents/cli.mjs ready
```

缁撴灉锛歚total: 0`锛宍heartbeats: []`锛宺eady 鏄剧ず `(绌?`锛涙鏌ユ椂 inbox 鏃犱换鍔℃枃浠躲€傚洜姝ゆ病鏈夎棰嗐€佹墽琛屾垨鏍囪瀹屾垚浠讳綍浠诲姟銆?

## 鎵ц鍓嶅樊寮傚揩鐓?

`git status --short` 鏄剧ず浠ヤ笅宸插瓨鍦ㄧ殑涓氬姟浠ｇ爜淇敼锛?

- `custom-server/index.mjs`
- `custom-server/vendor/hongguo.cjs`
- `server/vendor/hongguo.cjs`
- `shared/content-core/hongguo.js`

妫€鏌ユ椂 `git diff --stat` 鍚堣涓?4 涓枃浠躲€?12 琛屾柊澧炪€?13 琛屽垹闄ゃ€傚彟鏈夋湭璺熻釜鐨?`.agents/`銆佹挱鏀句慨澶嶈鍒掑強 `scripts/tv-verify.ps1`銆?

姝や负宸叉湁宸ヤ綔鍖虹姸鎬侊紝涓嶆槸鏈鎺ュ叆鎵€浜х敓鐨勪笟鍔′慨鏀癸紱鏈鍙褰曞樊寮傛憳瑕侊紝鏈杩欎簺淇敼浣滃畬鏁磋瘎瀹★紝涔熸湭璁ゅ畾鍏舵祴璇曢€氳繃銆傛病鏈夎鐩栥€佸洖閫€鎴栨竻鐞嗚繖浜涘唴瀹广€?

## 璋冭瘯璁惧锛?026-10-15 鍒嗛厤锛?

**浣犵殑鍥哄畾璁惧锛欴2**

| 椤?| 鍊?|
| --- | --- |
| adb 鍦板潃 | **`127.0.0.1:16416`** |
| Android | **15锛圓PI 35锛?* |
| 鍒嗚鲸鐜?| 1080脳1920锛堢珫灞忥紝闇€鑷璋冩í灞忥級 |
| 瀵嗗害 | 280 |
| 宸茶 App | 鉂?闇€鑷瀹夎 |

**鐗圭偣**锛氫笁涓ā鎷熷櫒涓?*绯荤粺鐗堟湰鏈€鏂?*锛岄€傚悎楠岃瘉鏂扮郴缁熷吋瀹规€с€?

### 鍑嗗姝ラ

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16416
& $adb -s 127.0.0.1:16416 shell wm size 1280x720     # 璋冩í灞?
& $adb -s 127.0.0.1:16416 install -r <apk璺緞>
```

### 璁惧浣跨敤瑙勮寖

1. **鍙敤 D2**锛坄127.0.0.1:16416`锛夆€斺€?涓嶈鎿嶄綔鍏朵粬 agent 鐨勮澶?
2. **濮嬬粓鐢?`-s 127.0.0.1:16416`** 鏄惧紡鎸囧畾
3. 鎴浘鍛藉悕甯﹁澶囨爣璇嗭細`<浠诲姟ID>-d2-<鍦烘櫙>-<鏃堕棿鎴?.png`
4. 閫昏緫瀹藉害锛?280/1.75 = **731dp** 鈫?鍛戒腑 `sw600dp` 妗?

**瀹屾暣璁惧鐭╅樀瑙?* `.agents/shared/device-allocation.md`

---

## 闃诲椤逛笌鍚庣画绾︽潫

1. 褰撳墠鏃犲垎閰嶇粰 codex 鐨勬槑纭换鍔★紝绛夊緟 DSH 鍗忚皟鑰呮淳鍙戙€傝繖涓嶅奖鍝嶆帴鍏ュ氨缁€?
2. 鑻ュ悗缁慨鏀?Web / Windows 鐨勫叡浜彇娴佷唬鐮侊紝浠诲姟蹇呴』鏄庣‘濡備綍闅旂 TV 鎵撳寘浣跨敤鐨勫叡浜紩鎿庯紱涓嶅緱鍋囧畾涓嶆敼 Android 鏂囦欢灏变笉浼氬奖鍝?TV銆?
3. 鐜版湁鏈彁浜や慨鏀归渶瑕佸崗璋冭€呯‘璁や慨鏀瑰綊灞炰笌鍩虹嚎锛屽啀瀹夋帓閲嶅彔鏂囦欢鐨勫疄鐜颁换鍔°€?
4. 鏂囦欢鎬荤嚎涓嶄細鑷姩鍞ら啋鏈細璇濓紱闇€瑕佹柊鐨勭敤鎴锋秷鎭垨宸查厤缃殑鍚堟硶璋冨害鍏ュ彛瑙﹀彂妫€鏌ワ紝涓嶅０绉版寔缁悗鍙扮洃鍚€?

鍚庣画鏀跺埌鏄庣‘浠诲姟鏃讹紝閲嶆柊妫€鏌?ready 鍜屼换鍔¤鎯咃紝浠呰棰?`assignee=codex` 涓斾緷璧栧凡瀹屾垚鐨勪换鍔°€傚紑濮嬪墠妫€鏌ユ渶鏂板樊寮傦紱缁撴灉璁板綍鏀瑰姩鏂囦欢銆侀獙璇佸懡浠ゃ€佸疄闄呰緭鍑恒€佸け璐ヤ笌鍓╀綑闂銆傛湭鍒嗛厤浠诲姟鏃朵繚鎸佸緟鍛斤紝涓嶈嚜琛屾墿灞曡寖鍥淬€?

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

## 寰呭姙浠诲姟锛?026-10-15锛?
| 浠诲姟 ID | 鏍囬 | 璇存槑 |
| --- | --- | --- |
| `t-w7-release-package` | **W7 Web 涓?Windows 绔?Release 鎵撳寘鍙戝竷** | 鐢ㄦ埛鐩存帴鎸囨淳 |

### 鑳屾櫙

褰撳墠浜х墿**宸茶繃鏈?*锛?
| 浜х墿 | 鏃堕棿 | 闂 |
| --- | --- | --- |
| `release/web/hongguotv-web-win-x64.zip` | 20:43 | 寮曟搸 `hongguo.js` 鏄?20:49 |
| `release/windows/绾㈡灉鐭墽-1.0.0-x64-setup.exe` | **19:02** | 钀藉悗绾?2 灏忔椂 |

鏈寘鍚殑宸插畬鎴愪慨澶嶏細

- `3a752c0` 淇鍏ㄩ儴绔棤娉曟挱鏀撅紙涓婃父 `device_id` 灏佺锛?- `cb0e16a` 璁惧鏍囪瘑闃插洖褰?+ 璇婃柇鑴氭湰
- `023fd99` 鍥涘眰闃叉姢
- `e2957b2` 淇 TV 绔?`crypto.randomBytes` 鍏煎
- `2836803` 鍏ㄥ睆蹇嵎閿€佹帹鑽愭祦鍏ㄥ睆澶撮儴

### 纭€у墠缃?
**蹇呴』鍏?`npm run release:check` 鍏ㄧ豢鎵嶈兘鎵撳寘銆?*

鍐掔儫娴嬭瘯澶辫触鍒?*涓嶈鎵撳寘**锛屽厛鎶ュ憡闂銆?
### 鈿狅笍 涓や釜宸茬煡闄烽槺

1. **涓嶈璁剧疆 `HG_ELECTRON_DIST`** 鈥斺€?璁句簡浼氬己鍒剁敤 x64 鐨?Electron锛?   arm64 鎵撳寘浼氳 `afterPack` 閽╁瓙鎷︽埅鎶ャ€屼骇鐗╂灦鏋勯敊璇€嶃€?2. **蹇呴』鐢?`--platforms=win-x64,win-arm64`** 鐢熸垚 bundle 鈥斺€?   鍙啓 `win-x64` 浼氳 arm64 bundle 鐩綍淇濈暀鏃у紩鎿庛€?
### 璁ら鏂瑰紡

```powershell
node .agents/cli.mjs claim t-w7-release-package codex
```

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
