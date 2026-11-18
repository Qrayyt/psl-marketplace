#!/usr/bin/env python3
"""Build the public consent document from the same immutable source used for API proofs."""
import json
from html import escape
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'backend/src/legal/consent-v1.json').read_text())
source = (root / 'frontend/cookies.html').read_text()
content = '<p><a href="/documents.html">Документы сайта</a></p><h1>Согласие на обработку персональных данных</h1>'
content += '<p>Версия: <strong>' + escape(data['version']) + '</strong></p>'
content += ''.join('<p>' + escape(text) + '</p>' for text in data['common'])
for purpose, scope in data['purposes'].items():
    content += '<section id="' + purpose + '"><h2>' + escape(scope['title']) + '</h2>'
    content += ''.join('<p>' + escape(text) + '</p>' for text in scope['paragraphs']) + '</section>'
content += '<p><a href="/privacy.html">Политика обработки данных</a> · <a href="/seller.html">Реквизиты оператора</a></p>'
source = re.sub(r'<title>.*?</title>', '<title>Согласие на обработку данных — PSL</title>', source)
source = re.sub(r'<main class="legal-content">.*?</main>', lambda _: '<main class="legal-content">' + content + '</main>', source, flags=re.S)
(root / 'frontend/consent.html').write_text(source)
