#!/system/bin/sh
# Q2 复核 v3：长距离滚动 + 末页停止测试
PORT="$1"
OUT=/sdcard/q2_probe3.log
MK=/sdcard/q2_marks3.log
rm -f "$OUT" "$MK"
(
  while true; do
    ts=$(date +%s%3N)
    ss -tan 2>/dev/null | grep "$PORT" | grep -v LISTEN | sed "s|^|$ts |"
    sleep 0.01
  done
) >> "$OUT" 2>&1 &
SP=$!
mark() { echo "$1 $(date +%s%3N)" >> "$MK"; }

mark SCROLL_START
i=0; while [ $i -lt 150 ]; do input keyevent 20; sleep 0.15; i=$((i+1)); done
mark SCROLL_END
sleep 3
mark ENDPAGE_START
i=0; while [ $i -lt 40 ]; do input keyevent 20; i=$((i+1)); done
mark ENDPAGE_END
sleep 4
mark DONE
kill $SP 2>/dev/null
echo "probe3 done"
wc -l "$OUT"
