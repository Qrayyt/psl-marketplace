#!/usr/bin/env python3
"""Verify and install a private handbook archive from the inventory and all its ZIP parts."""

import argparse
import csv
import hashlib
import io
import json
from contextlib import ExitStack
from pathlib import Path
import re
import tempfile
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("inventory", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
destination = args.destination
destination.mkdir(parents=True, exist_ok=True)

with ExitStack() as stack:
    inventory = stack.enter_context(ZipFile(args.inventory))
    archives = {args.inventory.name: inventory}
    csv_file = stack.enter_context(inventory.open("PSL_Handbook_Drive.csv"))
    rows = csv.DictReader(io.TextIOWrapper(csv_file, encoding="utf-8-sig"))
    temporary = Path(stack.enter_context(tempfile.TemporaryDirectory(dir=destination)))
    documents = {}
    articles = []
    with inventory.open("PSL_Handbook_Sections.csv") as source:
        for row in csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig")):
            group = row["migration_group"]
            if group not in {"Работа с партнёрами", "Системы решений", "Отрасли применения"} or not row["editor_status"].startswith("published"):
                continue
            articles.append({"title": row["title"], "section": group, "source": row["source_url"]})
    for row in rows:
        if row["state"] != "saved_pdf":
            continue
        archive_name = row["archive"]
        if archive_name not in archives:
            if not re.fullmatch(r"PSL_Handbook_Originals_[0-9]+\.zip", archive_name):
                raise ValueError(f"Unknown archive {archive_name}")
            archives[archive_name] = stack.enter_context(ZipFile(args.inventory.parent / archive_name))
        digest = row["sha256"]
        if not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError(f"Invalid checksum for {row['filename']}")
        with archives[archive_name].open(row["archive_entry"]) as source:
            contents = source.read()
        if hashlib.sha256(contents).hexdigest() != digest or b"%PDF-" not in contents[:1024]:
            raise ValueError(f"Verification failed for {row['filename']}")
        section = "certificates" if row["tilda_page_id"] == "46487191" else "technical"
        product = row["label"].removesuffix(" Копия").strip() if section == "technical" else ""
        if row["tilda_page_id"] == "61729507":
            product = "Wiron Isolit"
        title = row["label"].strip()
        if not title or title.lower() == "тех карта для скачивания":
            title = Path(row["filename"]).stem.replace("_", " ")
        (temporary / f"{digest}.pdf").write_bytes(contents)
        documents.setdefault(digest, {
            "id": digest, "title": title, "filename": row["filename"],
            "pages": int(row["pages"]), "section": section, "product": product,
        })
    if not documents:
        raise ValueError("Archive contains no verified documents")
    for file in temporary.glob("*.pdf"):
        file.replace(destination / file.name)
    manifest = temporary / "manifest.json"
    manifest.write_text(json.dumps({"documents": list(documents.values()), "articles": articles}, ensure_ascii=False), encoding="utf-8")
    manifest.replace(destination / manifest.name)
print(f"Installed {len(documents)} unique PDF documents")
