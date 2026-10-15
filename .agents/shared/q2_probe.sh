#!/system/bin/sh
# Q2 复核 v2：分阶段请求探针。mark 写独立文件，避免重定向交错。
PORT="$1"
OUT=/sdcard/q2_probe.log
MK=/sdcard/q2_marks.log
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

mark IDLE_START
sleep 5
mark IDLE_END
mark SLOW_START
i=0; while [ $i -lt 6 ]; do input keyevent 20; sleep 1.0; i=$((i+1)); done
mark SLOW_END
mark RAPID_START
i=0; while [ $i -lt 40 ]; do input keyevent 20; i=$((i+1)); done
mark RAPID_END
sleep 5
mark DONE

kill $SP 2>/dev/null
echo "probe done"
wc -l "$OUT" "$MK"
