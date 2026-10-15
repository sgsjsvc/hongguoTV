#!/bin/bash
# Q4 复核 adb 辅助 (D3)
export MSYS_NO_PATHCONV=1
ADB="/d/Program Files/Netease/MuMu/nx_main/adb.exe"
D="-s 127.0.0.1:16448"
a() { "$ADB" -P 15037 $D "$@"; }
key() { a shell input keyevent "$1"; }
dump() { a shell "uiautomator dump /sdcard/d.xml >/dev/null 2>&1"; a shell "cat /sdcard/d.xml"; }
port() { a shell "ss -ltn 2>/dev/null | sed -n 's/.*127\.0\.0\.1\]:\([0-9]*\).*/\1/p' | head -1" | tr -d '\r'; }
"$@"
