#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Q4: 提取榜单 dump 中按几何顺序的文本序列，并把 'Top N' 与其后同卡片标题配对。
用法: python q4_seq.py <dump.xml> [<dump.xml> ...]
"""
import sys, re, os
import xml.etree.ElementTree as ET

B = re.compile(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]')

def bounds(s):
    m = B.match(s or "")
    return tuple(map(int, m.groups())) if m else None

def leaves(root):
    out = []
    for n in root.iter():
        t = (n.get("text") or "").strip()
        if t:
            bb = bounds(n.get("bounds"))
            if bb:
                out.append((t, bb))
    return out

def main(path):
    root = ET.parse(path).getroot()
    L = leaves(root)
    # 排序: 先 y 后 x
    L.sort(key=lambda z: (z[1][1], z[1][0]))
    seq = [t for t, _ in L]
    tops = [t for t in seq if re.fullmatch(r'Top \d+', t)]
    nums = [int(t.split()[1]) for t in tops]
    print(f"== {os.path.basename(path)} ==")
    print("  Top序列:", nums)
    if nums:
        print(f"  min={min(nums)} max={max(nums)} 计数={len(nums)} 是否连续={nums==list(range(min(nums),max(nums)+1))}")
    print()

if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
