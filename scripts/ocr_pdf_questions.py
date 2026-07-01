#!/usr/bin/env python3
"""Extract question-card OCR text from the chapter PDFs.

The Rain Classroom PDFs keep the visible Chinese text in a form that regular
PDF text extraction cannot recover, so this script renders each page and uses
macOS Vision OCR. It writes a JSON file plus a readable Markdown audit file.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import Vision
from Cocoa import NSData
from Quartz import CGImageSourceCreateImageAtIndex, CGImageSourceCreateWithData


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "pdfs" / "chapter_ocr"
POPPLER = Path("/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin")

SOURCES = [
    ("第一章", Path("/Users/zhang/Desktop/第一章.pdf")),
    ("第二章", Path("/Users/zhang/Desktop/第二章1.pdf")),
    ("第二章", Path("/Users/zhang/Desktop/第二章2.pdf")),
    ("第三章", Path("/Users/zhang/Desktop/第三章.pdf")),
    ("第三章", Path("/Users/zhang/Desktop/第三章 2.pdf")),
    ("第四章", Path("/Users/zhang/Desktop/第四章.pdf")),
    ("第五章", Path("/Users/zhang/Desktop/第五章.pdf")),
    ("第六章", Path("/Users/zhang/Desktop/第六章.pdf")),
    ("第七章", Path("/Users/zhang/Desktop/第七章.pdf")),
    ("第八章", Path("/Users/zhang/Desktop/第八章.pdf")),
    ("第九章", Path("/Users/zhang/Desktop/第九章.pdf")),
]


@dataclass
class OcrItem:
    text: str
    confidence: float
    x: float
    y: float
    w: float
    h: float

    @property
    def top(self) -> float:
        return 1 - self.y - self.h

    @property
    def mid_y(self) -> float:
        return self.top + self.h / 2


def run(args: list[str]) -> str:
    return subprocess.check_output(args, text=True, errors="ignore")


def page_count(pdf: Path) -> int:
    info = run([str(POPPLER / "pdfinfo"), str(pdf)])
    for line in info.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError(f"Cannot read page count: {pdf}")


def render_page(pdf: Path, page: int, out_prefix: Path) -> Path:
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    target = out_prefix.with_suffix(".png")
    if target.exists():
        return target
    run([
        str(POPPLER / "pdftoppm"),
        "-png",
        "-f",
        str(page),
        "-l",
        str(page),
        "-singlefile",
        "-r",
        "120",
        str(pdf),
        str(out_prefix),
    ])
    return target


def ocr_image(image_path: Path) -> list[OcrItem]:
    data = NSData.dataWithContentsOfFile_(str(image_path))
    source = CGImageSourceCreateWithData(data, None)
    image = CGImageSourceCreateImageAtIndex(source, 0, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setRecognitionLanguages_(["zh-Hans", "en-US"])
    request.setUsesLanguageCorrection_(True)
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(image, {})
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(f"OCR failed for {image_path}: {err}")

    items: list[OcrItem] = []
    for obs in request.results() or []:
        cand = obs.topCandidates_(1)[0]
        box = obs.boundingBox()
        text = str(cand.string()).strip()
        if not text:
            continue
        items.append(OcrItem(text, float(cand.confidence()), box.origin.x, box.origin.y, box.size.width, box.size.height))
    return items


def line_join(items: list[OcrItem]) -> list[str]:
    if not items:
        return []
    rows: list[list[OcrItem]] = []
    for item in sorted(items, key=lambda part: (part.mid_y, part.x)):
        for row in rows:
            if abs(row[0].mid_y - item.mid_y) < 0.018:
                row.append(item)
                break
        else:
            rows.append([item])

    lines: list[str] = []
    for row in rows:
        row.sort(key=lambda part: part.x)
        text = " ".join(part.text for part in row)
        if "雨课堂" in text or "页" in text and "面向对象" in text:
            continue
        lines.append(text)
    return lines


def split_cards(items: list[OcrItem]) -> tuple[list[str], list[str]]:
    left = [item for item in items if item.x < 0.5 and item.top < 0.93]
    right = [item for item in items if item.x >= 0.5 and item.top < 0.93]
    return line_join(left), line_join(right)


def main() -> None:
    cards: list[dict[str, object]] = []
    for chapter, pdf in SOURCES:
        pages = page_count(pdf)
        print(f"OCR {pdf.name}: {pages} pages", flush=True)
        for page in range(1, pages + 1):
            image = render_page(pdf, page, TMP / pdf.stem / f"page_{page:03d}")
            items = ocr_image(image)
            for side, lines in zip(("left", "right"), split_cards(items)):
                text = "\n".join(lines).strip()
                if not text:
                    continue
                cards.append({
                    "chapter": chapter,
                    "source": pdf.name,
                    "page": page,
                    "side": side,
                    "text": text,
                })

    out_json = TMP / "ocr_cards.json"
    out_md = TMP / "ocr_cards.md"
    out_json.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    out_md.write_text(
        "\n\n".join(
            f"## {idx:03d} {card['chapter']} {card['source']} p{card['page']} {card['side']}\n\n{card['text']}"
            for idx, card in enumerate(cards, 1)
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(cards)} cards to {out_json}")


if __name__ == "__main__":
    main()
