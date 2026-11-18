#!/usr/bin/env python3
"""Export preserved handbook content and optional installed PDFs to an offline SQLite database."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.main = False
        self.nav = 0
        self.parts = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'main': self.main = True
        if not self.main: return
        if tag == 'nav': self.nav += 1
        if self.nav: return
        if tag in {'p', 'h1', 'h2', 'li'}: self.parts.append('\n')
        if tag == 'a':
            self.links.extend(v for k, v in attrs if k == 'href')
    def handle_endtag(self, tag):
        if tag == 'nav' and self.nav: self.nav -= 1
        if tag == 'main': self.main = False
    def handle_data(self, data):
        if self.main and not self.nav: self.parts.append(data)
    def text(self):
        return '\n'.join(re.sub(r'\s+', ' ', line).strip() for line in ''.join(self.parts).splitlines() if line.strip())

def export(destination, documents=None):
    source = ROOT / 'knowledge/handbook'
    articles = json.loads((source / 'articles.json').read_text())
    records = []
    for article_id, item in articles.items():
        lines = [item['title']]
        for title, points in item.get('blocks', []):
            lines.extend([title, *points])
        if item.get('listing'):
            lines.extend(a['title'] for a in articles.values() if a.get('section') == item['section'] and not a.get('listing'))
        if item.get('products'): lines.extend(['Материалы', *item['products']])
        if item.get('external'): lines.append(' '.join(item['external']))
        if item.get('contact'): lines.append('Позвонить в PSL: 8 800 551-41-45; tel:+78005514145')
        records.append((article_id, item['title'], item['section'], '\n'.join(lines), json.dumps(item, ensure_ascii=False), f'https://psl-handbook-insight.tilda.ws/page{article_id}.html', 'requires_review'))
    for name, article_id, title in [('systems', '36697184', 'Системы решений'), ('fixtile-classic', '44415923', 'FIXTILE Classic'), ('fixtile-pro', '44064755', 'FIXTILE Pro')]:
        html = (source / 'pages' / (name + '.html')).read_text()
        parser = ArticleText(); parser.feed(html)
        records.append((article_id, title, 'Системы решений', parser.text(), json.dumps({'html': html, 'links': parser.links}, ensure_ascii=False), f'https://psl-handbook-insight.tilda.ws/page{article_id}.html', 'requires_review'))
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        database = Path(temporary) / 'knowledge.sqlite'
        db = sqlite3.connect(database)
        db.executescript('''
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE articles (id TEXT PRIMARY KEY, title TEXT NOT NULL, section TEXT NOT NULL,
                text TEXT NOT NULL, content_json TEXT NOT NULL, source_url TEXT NOT NULL, review_status TEXT NOT NULL);
            CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, product TEXT NOT NULL,
                section TEXT NOT NULL, filename TEXT NOT NULL, pages INTEGER NOT NULL, pdf_path TEXT NOT NULL,
                text TEXT NOT NULL, extraction_status TEXT NOT NULL, review_status TEXT NOT NULL);
            CREATE VIRTUAL TABLE search USING fts5(kind UNINDEXED, source_id UNINDEXED, title, text, tokenize='unicode61');
        ''')
        db.execute('INSERT INTO metadata VALUES (?, ?)', ('schema_version', '1'))
        db.execute('INSERT INTO metadata VALUES (?, ?)', ('scope', '24 migrated articles; PDF archive only when --documents is supplied. Not a complete export of all Tilda pages.'))
        db.executemany('INSERT INTO articles VALUES (?,?,?,?,?,?,?)', records)
        db.executemany('INSERT INTO search VALUES (?,?,?,?)', [('article', r[0], r[1], r[3]) for r in records])
        count = 0
        if documents:
            directory = Path(documents).resolve()
            manifest = json.loads((directory / 'manifest.json').read_text())
            for item in manifest['documents']:
                digest = item['id']
                if not re.fullmatch(r'[a-f0-9]{64}', digest): raise ValueError('Invalid PDF ID')
                pdf = directory / (digest + '.pdf')
                if hashlib.sha256(pdf.read_bytes()).hexdigest() != digest: raise ValueError(f'Checksum mismatch: {digest}')
                text = ''
                status = 'not_extracted'
                if shutil.which('pdftotext'):
                    result = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, timeout=120)
                    if result.returncode == 0:
                        text = result.stdout.decode('utf-8', errors='replace')
                        pages = [p.strip() for p in text.split('\f')]
                        if pages and not pages[-1]: pages.pop()
                        status = 'text_extracted' if len(pages) == item['pages'] and all(pages) else 'needs_ocr'
                    else: status = 'extraction_failed'
                db.execute('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?)', (digest, item['title'], item['product'], item['section'], item['filename'], item['pages'], str(pdf), text, status, 'requires_review'))
                db.execute('INSERT INTO search VALUES (?,?,?,?)', ('document', digest, item['title'], text))
                count += 1
        db.commit()
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok': raise ValueError('Invalid database')
        db.close()
        database.replace(destination)
    print(f'Exported {len(records)} articles and {count} PDFs to {destination}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--documents', type=Path, help='Installed PDF directory containing manifest.json')
    args = parser.parse_args()
    export(args.destination, args.documents)
