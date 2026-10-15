#!/system/bin/sh
# Q2 复核 v4：榜单页受控滚动 + 末页
PORT="$1"
OUT=/sdcard/q2_p4.log; MK=/sdcard/q2_m4.log
rm -f "$OUT" "$MK"
( while true; do ts=$(date +%s%3N); ss -tan 2>/dev/null | grep "$PORT" | grep -v LISTEN | sed "s|^|$ts |"; sleep 0.01; done ) >> "$OUT" 2>&1 &
SP=$!
mark() { echo "$1 $(date +%s%3N)" >> "$MK"; }
mark SCROLL_START
i=0; while [ $i -lt 60 ]; do input keyevent 20; sleep 0.25; i=$((i+1)); done
mark SCROLL_END
sleep 3
mark RAPID_START
i=0; while [ $i -lt 30 ]; do input keyevent 20; i=$((i+1)); done
mark RAPID_END
sleep 4
mark DONE
kill $SP 2>/dev/null
echo probe4 done
