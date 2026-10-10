# -*- coding: utf-8 -*-
import os
import sys
import pymupdf

PDF = sys.argv[1]
OUT = sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 100

os.makedirs(OUT, exist_ok=True)
doc = pymupdf.open(PDF)
print('pages:', doc.page_count)

blank = []
for i, page in enumerate(doc):
    text = page.get_text().strip()
    # count drawings/images for near-blank detection
    pix = page.get_pixmap(dpi=dpi)
    name = os.path.join(OUT, 'p%02d.png' % (i + 1))
    pix.save(name)
    if len(text) < 15:
        blank.append(i + 1)

print('near-blank pages:', blank)

# text length per page
lens = [(i + 1, len(p.get_text().strip())) for i, p in enumerate(doc)]
short = [x for x in lens if x[1] < 220]
print('short pages (<220 chars):', short)
