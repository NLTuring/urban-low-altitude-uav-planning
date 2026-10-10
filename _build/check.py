# -*- coding: utf-8 -*-
"""Programmatic checks on the generated DOCX."""
import sys
import collections
import zipfile
import re

DOCX = sys.argv[1]

z = zipfile.ZipFile(DOCX)
doc_xml = z.read('word/document.xml').decode('utf-8')

# --- font usage ---
fonts = collections.Counter(re.findall(r'w:(?:ascii|hAnsi|eastAsia|cs)="([^"]+)"', doc_xml))
print('--- fonts referenced in document.xml ---')
for k, v in fonts.most_common():
    print('  %-24s %d' % (k, v))

# runs with no explicit rFonts? (inherit from style) -> check styles.xml default
styles_xml = z.read('word/styles.xml').decode('utf-8')
m = re.search(r'<w:docDefaults>.*?</w:docDefaults>', styles_xml, re.S)
default_rfonts = re.findall(r'w:eastAsia="([^"]+)"', m.group(0)) if m else []
print('docDefaults eastAsia:', default_rfonts)

# heading styles font
for name in ['Heading1', 'Heading2', 'Heading3', 'Normal']:
    mm = re.search(r'<w:style [^>]*w:styleId="%s".*?</w:style>' % name, styles_xml, re.S)
    if mm:
        f = re.findall(r'w:eastAsia="([^"]+)"', mm.group(0))
        print('style %-10s eastAsia=%s' % (name, f))

# --- structural ---
print()
print('--- structure ---')
print('sections:', len(re.findall(r'<w:sectPr', doc_xml)))
print('tables:', len(re.findall(r'<w:tbl>', doc_xml)))
print('pageBreak runs:', len(re.findall(r'w:type="page"', doc_xml)))
print('TOC field:', 'TOC \\o' in doc_xml)
print('updateFields:', 'updateFields' in z.read('word/settings.xml').decode('utf-8'))
print('pgNumType:', re.findall(r'<w:pgNumType[^>]*/>', doc_xml))

# consecutive empty paragraphs
paras = re.findall(r'<w:p[ >].*?</w:p>', doc_xml, re.S)
run_max = 0
cur = 0
for p in paras:
    text = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))
    if text.strip() == '' and '<w:br' not in p:
        cur += 1
        run_max = max(run_max, cur)
    else:
        cur = 0
print('max consecutive empty paragraphs:', run_max)
