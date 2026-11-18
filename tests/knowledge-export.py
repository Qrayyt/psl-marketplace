"""Regression checks for archived content and atomic PDF export."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temporary:
    directory = Path(temporary)
    database = directory / 'knowledge.sqlite'
    command = [sys.executable, str(ROOT / 'scripts/export-knowledge.py'), str(database)]
    subprocess.run(command, check=True)
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT count(*) FROM articles').fetchone()[0] == 24
        assert db.execute("SELECT count(*) FROM search WHERE search MATCH 'парковки'").fetchone()[0]
        assert 'GLS500' in db.execute("SELECT text FROM articles WHERE id='44064755'").fetchone()[0]
        assert db.execute("SELECT review_status FROM articles WHERE id='36602863'").fetchone()[0] == 'requires_review'
    # A deliberately malformed PDF must retain its metadata without being marked extracted.
    pdf = b'%PDF-1.4\nfixture without a text layer\n'
    digest = hashlib.sha256(pdf).hexdigest()
    pdf_file = directory / (digest + '.pdf')
    pdf_file.write_bytes(pdf)
    (directory / 'manifest.json').write_text(json.dumps({'documents': [{
        'id': digest, 'title': 'Test', 'product': 'Test', 'section': 'technical',
        'filename': 'test.pdf', 'pages': 1,
    }]}))
    subprocess.run(command + ['--documents', str(directory)], check=True)
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT count(*) FROM documents').fetchone()[0] == 1
        assert db.execute('SELECT extraction_status FROM documents').fetchone()[0] in {'not_extracted', 'extraction_failed'}
    previous = database.read_bytes()
    pdf_file.write_bytes(b'corrupted')
    result = subprocess.run(command + ['--documents', str(directory)], capture_output=True)
    assert result.returncode != 0
    assert database.read_bytes() == previous, 'Failed export must preserve the existing database'
print('PASS: archived articles, FTS, PDF extraction status, checksum validation and atomic replacement')
