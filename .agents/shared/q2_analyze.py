#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Q2 复核：解析 UI dump，分析卡片几何 / 空白 / 行内等高 / 加载更多按钮 / 卡片计数。"""
import sys, re
import xml.etree.ElementTree as ET

def B(n):
    b = n.get('bounds')
    if not b:
        return None
    return list(map(int, re.findall(r'-?\d+', b)))

def main(path):
    root = ET.parse(path).getroot()
    # 收集所有节点
    nodes = list(root.iter())
    # 找容器：包含多个"卡片"子节点的 ViewGroup（卡片=LinearLayout，其下有 ImageView + >=1 TextView）
    cards = []
    for n in nodes:
        if n.get('class', '').split('.')[-1] != 'LinearLayout':
            continue
        bb = B(n)
        if not bb:
            continue
        w = bb[2] - bb[0]; h = bb[3] - bb[1]
        if w < 60 or h < 60:   # 卡片应有一定尺寸
            continue
        kids = list(n)
        has_img = any(k.get('class', '').endswith('ImageView') for k in kids)
        texts = [k for k in kids if k.get('text', '')]
        if has_img and texts:
            img = next((k for k in kids if k.get('class', '').endswith('ImageView')), None)
            cards.append({
                'bounds': bb, 'node': n, 'img': B(img) if img is not None else None,
                'texts': [(t.get('text', ''), B(t)) for t in texts],
            })

    print(f"== {path} ==")
    print(f"卡片数: {len(cards)}")
    if not cards:
        # 回退：打印所有文本节点
        for n in nodes:
            if n.get('text', ''):
                print('  TXT', repr(n.get('text', '')[:30]), n.get('bounds'))
        return

    # 行分组（按 top 容差）
    cards.sort(key=lambda c: (c['bounds'][1], c['bounds'][0]))
    rows = []
    for c in cards:
        top = c['bounds'][1]
        if rows and abs(top - rows[-1][0]['bounds'][1]) <= 12:
            rows[-1].append(c)
        else:
            rows.append([c])

    print(f"行数: {len(rows)}")
    for ri, row in enumerate(rows):
        print(f"  -- 第{ri+1}行 ({len(row)} 张) --")
        for c in sorted(row, key=lambda c: c['bounds'][0]):
            x1, y1, x2, y2 = c['bounds']
            h = y2 - y1; w = x2 - x1
            # 最后一个文本节点底部
            last_bottom = max((t[1][3] for t in c['texts'] if t[1]), default=None)
            img_b = c['img'][3] if c['img'] else None
            blank = (y2 - last_bottom) if last_bottom else None
            tx = ' | '.join(t[0][:12] for t in c['texts'])
            print(f"     card x[{x1},{x2}] y[{y1},{y2}] {w}x{h}  imgBot={img_b} lastTxtBot={last_bottom} 底部余白={blank}  «{tx}»")

    # 行高一致性
    print("  == 行高一致性 ==")
    for ri, row in enumerate(rows):
        hs = [c['bounds'][3] - c['bounds'][1] for c in row]
        tops = [c['bounds'][1] for c in row]
        print(f"    第{ri+1}行 高度集合={sorted(set(hs))} 顶部集合={sorted(set(tops))} 一致={len(set(hs))==1}")

    # 加载更多
    alltext = ' '.join(n.get('text', '') for n in nodes)
    print("  == 加载更多按钮 ==")
    print("    含'加载更多':", '加载更多' in alltext)
    print("    含'下一页':", '下一页' in alltext)
    print("    含'重试':", '重试' in alltext)

if __name__ == '__main__':
    main(sys.argv[1])
