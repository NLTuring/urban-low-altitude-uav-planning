# -*- coding: utf-8 -*-
"""Verify every font reference in the DOCX is SimSun."""
import collections
import re
import sys
import zipfile

DOCX = sys.argv[1]
z = zipfile.ZipFile(DOCX)

for part in ('word/document.xml', 'word/styles.xml'):
    xml = z.read(part).decode('utf-8')
    fonts = collections.Counter()
    for m in re.finditer(r'w:(?:ascii|hAnsi|eastAsia|cs)="([^"]*)"', xml):
        fonts[m.group(1)] += 1
    print('== %s' % part)
    for name, count in fonts.most_common():
        flag = 'OK  ' if name == '宋体' else 'DIFF'
        print('   %s %-12r  %d' % (flag, name, count))
