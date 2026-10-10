# -*- coding: utf-8 -*-
"""Detect orphaned table captions: a line like “表 x-y …” that is the last
non-footer text on a page (its table starts on the next page)."""
import re
import sys

import pymupdf

PDF = sys.argv[1]
doc = pymupdf.open(PDF)
CAP = re.compile(r'^表\s*[0-9A-Z]')

orphans = []
for pi in range(doc.page_count):
    page = doc[pi]
    h = page.rect.height
    d = page.get_text('dict')
    lines = []
    for blk in d.get('blocks', []):
        for ln in blk.get('lines', []):
            txt = ''.join(s.get('text', '') for s in ln.get('spans', [])).strip()
            if not txt:
                continue
            y = ln['bbox'][1]
            if y > h - 80:          # footer zone
                continue
            lines.append((y, txt))
    if not lines:
        continue
    lines.sort()
    last_y, last_txt = lines[-1]
    if CAP.match(last_txt) and len(last_txt) < 60:
        orphans.append((pi + 1, round(last_y), last_txt))

print('pages: %d' % doc.page_count)
print('orphaned captions: %d' % len(orphans))
for pg, y, t in orphans:
    print('  pdf_p%02d y=%4d  %s' % (pg, y, t))
