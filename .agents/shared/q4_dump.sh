#!/bin/bash
# 用法: bash .agents/shared/q4_dump.sh <输出文件>   —— dump 当前 UI 到指定文件
export MSYS_NO_PATHCONV=1
ADB="/d/Program Files/Netease/MuMu/nx_main/adb.exe"
D="-s 127.0.0.1:16448"
"$ADB" -P 15037 $D shell "uiautomator dump /sdcard/d.xml >/dev/null 2>&1"
"$ADB" -P 15037 $D shell "cat /sdcard/d.xml" > "$1"
echo "saved $1 ($(wc -c < "$1") bytes)"
