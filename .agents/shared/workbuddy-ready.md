# WorkBuddy 灏辩华鎶ュ憡

- 韬唤锛歸orkbuddy锛堟枃妗ｆ暣鐞嗗強鐙珛澶嶆牳鏂癸級
- 鏃堕棿锛?026-10-13 20:30锛圙MT+8锛?
- 渚濇嵁锛?agents/README.md銆?agents/QUICKSTART.md
- 鏈疆鑼冨洿锛氫粎鎺ュ叆涓庢姤鍛婏紱涓嶄慨鏀逛笟鍔′唬鐮侊紝涓嶈嚜鍔ㄦ淳鍙戞垨璁ら浠诲姟

## 涓€銆佸彲璁块棶鐩綍

宸查獙璇侊紙鏈細璇濆疄闄呰鍙?鍐欏叆锛夛細

| 璺緞 | 鑳藉姏 | 璇存槑 |
| --- | --- | --- |
| `F:\Project\hongguoTV` | 璇?| 椤圭洰鏍癸紱宸查€氳 README.md銆丠ANDOVER.md銆乸ackage.json銆乨ocs/ 鍏抽敭鏂囨。 |
| `.agents/` | 璇?| README / QUICKSTART / cli.mjs / bus.mjs / adapters.mjs 鍧囧凡璇伙紱inbox / outbox / state / logs 褰撳墠鍧囦负绌?|
| `.agents/shared/` | 璇诲啓 | 鏈姤鍛婂嵆鍐欏叆姝ゅ锛涙寜绾﹀畾鍙啓灏辩华鎶ュ憡涓?`<浠诲姟ID>-workbuddy.md` 璇︾粏鎶ュ憡 |
| `docs/` | 璇?| 鎴戠殑褰掑睘鍖哄煙锛圧EADME 鍒嗗伐琛級锛涘惈 RECOMMENDATIONS / LOCAL_REMOTE_SERVICES / TV_ANDROID_VERIFICATION 绛夎璁′笌楠岃瘉鏂囨。 |
| `shared/`锛堟簮鐮侊級 | 璇?| 褰?Codex锛屾垜鍙涓嶆敼锛涙敞鎰忓嬁涓?`.agents/shared/` 娣锋穯 |
| `custom-server/` `server/` `apps/` `tests/` `scripts/` | 璇?| 鍚屼笂锛屾寜鍒嗗伐鍙 |
| `.workbuddy-ai/memory/` | 璇诲啓 | 鎴戠殑璁板繂鐩綍锛涙晱鎰熶俊鎭笉寰楀啓鍏?|

鏈獙璇?涓嶅彲鍙婏細

- 鍏朵粬 agent锛坈odex / antigravity / dsh锛夌殑浼氳瘽鍐呴儴鐘舵€侊紝鍙兘閫氳繃鏂囦欢鎬荤嚎瑙傚療銆?
- `node .agents/cli.mjs run <id>` 鑷姩鎶曢€掗摼璺湭楠岃瘉锛決UICKSTART 鏄庣‘鏈獙璇侀€傞厤鍣ㄥ墠涓嶄娇鐢?`run`銆?

## 浜屻€佸彲鐢ㄥ伐鍏?

宸查獙璇佸彲鐢細

- 鏂囦欢璇诲啓涓庢绱細鍙洿鎺ヨ銆佸啓銆佹悳绱㈠伐浣滃尯鏂囦欢锛堟湰鎶ュ憡鍗充骇鐗╋級銆?
- 鏈湴 Shell锛圵indows Git Bash锛? Node v22.22.2锛氭湰浼氳瘽瀹炴祴 `node .agents/cli.mjs status` / `ready` 鍙鍛戒护姝ｅ父杩斿洖銆?
- 鍙 Git锛歚git status` 鍙敤锛堢粨鏋滆涓嬭妭锛夈€?

鍙楅檺/绾﹀畾锛堟湭缁忓崗璋冭€呮巿鏉冧笉涓诲姩浣跨敤锛夛細

- 浠诲姟鐘舵€佸懡浠わ紙claim / done / fail / add锛夛細鎸夋湰娆℃帴鍏ユ寚浠や笌 QUICKSTART锛屾垜鐨勪换鍔＄姸鎬佺敱鍗忚皟鑰咃紙dsh锛変唬璁帮紝鎴戜互鎶ュ憡鏂囦欢鎻愪氦缁撹涓庤瘉鎹紱涓嶇敱鎴戣嚜琛屾敼鍐欎换鍔＄姸鎬佹枃浠躲€?
- 涓嶈繍琛?`run` 鑷姩璋冨害锛涗笉鎵ц鏋勫缓銆佸畨瑁呫€佹帹閫併€佹湇鍔″惎鍋滐紙褰掑崗璋冭€呯粺涓€瀹夋帓锛夈€?
- 涓嶈皟鐢ㄥ叾浠?agent 鐨勯€傞厤鍣ㄣ€?

## 涓夈€佸伐浣滃尯鐘舵€佸揩鐓э紙鍙锛屾湭鍋氫换浣曟敼鍔級

- `git status`锛? 涓凡璺熻釜鏂囦欢琚慨鏀光€斺€擿custom-server/index.mjs`銆乣custom-server/vendor/hongguo.cjs`銆乣server/vendor/hongguo.cjs`銆乣shared/content-core/hongguo.js`锛涙湭璺熻釜 `.agents/`銆乣docs/plans/2026-10-13-playback-upstream-fix.md`銆乣scripts/tv-verify.ps1`銆備笌 QUICKSTART銆屽凡鏈夊叾浠栧伐鍏风殑鏈彁浜や慨鏀广€嶄竴鑷达紱鎴戜笉瑕嗙洊銆佷笉鍥為€€銆佷笉娓呯悊銆?
- 褰撳墠鍒嗘敮锛歚codex/first-github-push-20261013`銆?
- `.agents` 鎬荤嚎锛? 涓换鍔°€佹棤蹇冭烦锛宨nbox / outbox / shared / state / logs 涓虹┖鈥斺€旀殏鏃犲垎娲炬垨鍙棰嗕换鍔°€?

## 鍥涖€侀樆濉為」

1. **鏂囦欢鎬荤嚎鏆傛棤浠诲姟**锛歚cli.mjs status` 杩斿洖 total 0銆傜瓑寰呭崗璋冭€呭啓鍏ュ甫鏄庣‘杈圭晫鐨勪换鍔″悗锛屾垜鎸?`assignee=workbuddy` 涓斾緷璧栧叏閮ㄥ畬鎴愭墠鑳借棰嗐€?
2. **WorkBuddy 鏃犳硶琚嚜鍔ㄨЕ鍙?*锛氫换鍔″叆鍙ｄ緷璧栦汉宸ュ湪鍏剁獥鍙ｇ矘璐?prompt锛圧EADME/QUICKSTART 宸茶堪锛夈€傚洜姝ゆ垜鐨?claim / done / fail 闇€鍗忚皟鑰呬唬璁帮紝鎴栫粡浜哄伐杞揪锛涙垜涓嶄細涓诲姩鏀逛换鍔＄姸鎬佹枃浠躲€?
3. **鎾斁淇澶勪簬鏆傚仠**锛歈UICKSTART 璁板綍鐢ㄦ埛宸插仠姝㈡挱鏀句慨澶嶏紱鍚庣画鑻ユ仮澶嶏紝鑼冨洿浠?Web / Windows锛孴V 涓嶆敼鍔ㄣ€佷笉鏋勫缓銆佷笉瀹夎銆俙docs/plans/` 涓嬪凡鏈夋湭鎻愪氦鐨勪慨澶嶈鍒掞紝鑾峰緱浠诲姟鍚庡彲鐙珛澶嶆牳鍏舵枃妗ｄ笌娴嬭瘯璇佹嵁锛屼絾涓嶆敼鍔ㄤ唬鐮併€?

## 浜斻€佸伐浣滅害瀹氾紙瀵归綈 README / QUICKSTART锛?

- 鍙棰?`assignee=workbuddy` 涓?`blockedBy` 鍏ㄩ儴 `done` 鐨勪换鍔★紱鍔ㄦ墜鍓嶅厛璇讳换鍔?JSON 鐨?context / acceptance銆?
- 鎶ュ憡鍖哄垎銆愬凡楠岃瘉浜嬪疄銆戜笌銆愭帹娴嬨€戯紱娴嬭瘯璇佹嵁浠ュ疄闄呰繍琛岀殑鍛戒护銆佺増鏈€侀€€鍑虹爜鍜岃緭鍑轰负鍑嗭紝涓嶆妸 HTTP 鎴愬姛褰撲綔瀹為檯鎾斁鎴愬姛銆?
- 浠诲姟瀹屾垚鍚庯紝璇︾粏鎶ュ憡鍐?`.agents/shared/<浠诲姟ID>-workbuddy.md`锛堢洰鏍囥€佸疄闄呮敼鍔ㄣ€侀獙璇佺幆澧冧笌鍛戒护銆佺粨鏋溿€佸墿浣欓闄┿€侀渶鍏朵粬鏂瑰洖绛旂殑闂锛夛紝骞舵寜浠诲姟绾﹀畾鍐?`.agents/outbox/<id>.json`锛涚姸鎬佺敱鍗忚皟鑰呬唬璁般€?
- 浠讳綍鍗忎綔鏂囦欢涓嶅啓 Cookie銆佽闂瘑閽ャ€佺鍚嶅嚟鎹€佹湭鑴辨晱鎶撳寘銆?
- 淇敼鑼冨洿浠呴檺 `docs/`銆乣.agents/` 鎶ュ憡涓?`.workbuddy-ai/memory/`锛涗笟鍔′唬鐮佷笉鍔紝纭渶鏀瑰姩鏃跺厛鍙栧緱鍗忚皟鑰呮槑纭巿鏉冨苟纭鏃犲叾浠栦慨鏀硅€呫€?

---

## 鍏€佽皟璇曡澶囷紙2026-10-15 鍒嗛厤锛?

**浣犵殑鍥哄畾璁惧锛欴3**

| 椤?| 鍊?|
| --- | --- |
| adb 鍦板潃 | **`127.0.0.1:16448`** |
| Android | 12锛圓PI 32锛?|
| 鍒嗚鲸鐜?| 1080脳1920锛堢珫灞忥紝闇€鑷璋冩í灞忥級 |
| 瀵嗗害 | 280 |
| 宸茶 App | 鉂?闇€鑷瀹夎 |

**鍒嗛厤鐞嗙敱**锛氫笌 antigravity 鐨?D1 **鐗╃悊闅旂**锛岄伩鍏嶅鏍告椂浜掔浉骞叉壈銆?

### 鍑嗗姝ラ锛堣嫢闇€璁惧楠岃瘉锛?

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16448
& $adb -s 127.0.0.1:16448 shell wm size 1280x720
& $adb -s 127.0.0.1:16448 install -r <apk璺緞>
```

### 璁惧浣跨敤瑙勮寖

1. **鍙敤 D3**锛坄127.0.0.1:16448`锛夆€斺€?涓嶈鎿嶄綔鍏朵粬 agent 鐨勮澶?
2. **濮嬬粓鐢?`-s 127.0.0.1:16448`** 鏄惧紡鎸囧畾
3. 鎴浘鍛藉悕甯﹁澶囨爣璇嗭細`<浠诲姟ID>-d3-<鍦烘櫙>-<鏃堕棿鎴?.png`
4. **楠岃瘉鍑嗗垯**锛氶潤鎬佹埅鍥句笉鑳借瘉鏄?鍗′綇"鎴?姝ｅ父"锛屽繀椤婚獙璇?*鐘舵€佹槸鍚︽帹杩?*锛堝鎾斁浣嶇疆鏃堕棿鎴冲彉鍖栵級

**瀹屾暣璁惧鐭╅樀瑙?* `.agents/shared/device-allocation.md`

---

## 寰呭姙澶嶆牳浠诲姟锛?026-10-15锛?
| 浠诲姟 ID | 鏍囬 | 澶嶆牳瀵硅薄 |
| --- | --- | --- |
| `t-w6-verify-fullscreen` | W6 W4/W5 鍏ㄥ睆鎴愭灉鐙珛澶嶆牳 | W4锛堟帹鑽愭祦鍏ㄥ睆锛夈€乄5锛堣鎯呴〉鍏ㄥ睆锛?|

### 澶嶆牳鐞嗙敱

1. W4/W5 鏄湰杞?*鍞竴鏈粡鐙珛澶嶆牳**鐨勪换鍔?2. **W2 鏇惧洜鍗忚皟鑰呯殑閿欒 brief 鍋氶敊鏂瑰悜** 鈥斺€?璇ュ尯鍩熸槗鍑洪敊
3. **W5 鍙戠幇浜嗙湡瀹炵己闄?*锛堝叏灞忔牱寮忚 Tailwind 瑕嗙洊锛夆€斺€?璇ュ尯鍩熺‘鏈夐棶棰?4. 鍏ㄥ睆鏄敤鎴锋渶鍏冲績鐨勫姛鑳斤紝娑夊強 Web + Electron 鍙岀幆澧?
### 鈿狅笍 澶嶆牳鏃跺繀椤绘敞鎰?
**涓や釜涓嶅悓鐨勯〉闈?*锛?
| 椤甸潰 | 缁勪欢 | 鍏ㄥ睆鎸夐挳 |
| --- | --- | --- |
| 鎺ㄨ崘娴?| `RecommendStream.tsx` | W4 鏂板锛堝彸涓婅锛?|
| 璇︽儏椤?鎾斁寮圭獥 | `PlayerModal.tsx` | 鏈氨鏈夛紙搴曢儴鏍忥級 |

**鍗忚皟鑰呮鍓嶅氨鏄贩娣嗕簡杩欎袱涓〉闈紝瀵艰嚧 W2 鍋氶敊鏂瑰悜銆傚鏍告椂鍔″繀鍏堢‘璁ら〉闈€?*

**涓ゆ潯鐢ㄦ埛鏍稿績瑕佹眰闇€鐙珛楠岃瘉**锛?
1. **鍏ㄥ睆鍚庝繚鐣欒嚜鍔ㄤ笅涓€闆?*锛圵5 澹扮О鐢ㄧ湡瀹?`ended` 浜嬩欢楠岃瘉锛岄潪鎵嬪姩 dispatch锛?2. **鏁翠釜灞忓箷鍏ㄥ睆**锛堝垽鎹?`innerWidth === screen.width`锛岄潪绐楀彛鏈€澶у寲锛?
### 璁ら鏂瑰紡

```powershell
node .agents/cli.mjs claim t-w6-verify-fullscreen workbuddy
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
