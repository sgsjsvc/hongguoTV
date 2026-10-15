#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Q4 复核：解析榜单 dump，把 (Top N 徽标, 标题) 按卡片分组并按几何顺序输出。
用于判定是否存在「重复追加」——若 Top N 序号跳变 / 同一标题在多个 Top N 下重复出现，则证实重复。
"""
import sys, re, os
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]')

def parse_bounds(b):
    m = BOUNDS.match(b or "")
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return x1, y1, x2, y2

def collect_leaves(root):
    """返回所有有文本的叶子节点 (text, bounds)"""
    out = []
    for n in root.iter():
        t = (n.get("text") or "").strip()
        if t:
            bb = parse_bounds(n.get("bounds"))
            if bb:
                out.append((t, bb))
    return out

def cards_from(leaves):
    """按行(y) 再按列(x) 聚类。卡片高度约 333px（含间距），列宽约 275+gap。
    简化策略：以 Top N 文本作为锚点，其所在卡片标题取同列、y 在其下方的文本。
    但更稳健：用 x 聚类成列，用 y 聚类成行。
    """
    return leaves

def group_rows(leaves, ytol=80):
    items = sorted(leaves, key=lambda z: (z[1][1], z[1][0]))
    rows = []
    for t, bb in items:
        ymid = (bb[1] + bb[3]) // 2
        placed = False
        for r in rows:
            if abs(r["ymid"] - ymid) <= ytol:
                r["items"].append((t, bb))
                r["ymid"] = (r["ymid"] + ymid) // 2
                placed = True
                break
        if not placed:
            rows.append({"ymid": ymid, "items": [(t, bb)]})
    rows.sort(key=lambda r: r["ymid"])
    for r in rows:
        r["items"].sort(key=lambda z: z[1][0])
    return rows

def main(path):
    tree = ET.parse(path)
    root = tree.getroot()
    leaves = collect_leaves(root)
    rows = group_rows(leaves)
    print(f"== {os.path.basename(path)} ==")
    for r in rows:
        # 每行只打印含 'Top' 或看起来像标题的项，且给出 x 位置
        line = " | ".join(f"{t}@x{bb[0]}" for t, bb in r["items"])
        print(f"y={r['ymid']:>4}  {line}")
    print()

if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
