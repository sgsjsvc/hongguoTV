#!/system/bin/sh
# Q4 请求计数探针: 采样本机服务端口的 TCP 连接状态
PORT=$1
OUT=/sdcard/q4_probe.log
: > "$OUT"
while true; do
  ss -tan 2>/dev/null | grep ":$PORT " | grep -v LISTEN
  sleep 0.01
done >> "$OUT"
