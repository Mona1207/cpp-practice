#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


SOURCE = Path(
    "/Users/zhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/"
    "xwechat_files/wxid_siz8cv6akzz922_4e13/temp/drag/"
    "C++程序设计复习讲义_题目提取与解析.docx"
)
OUT = Path(__file__).resolve().parents[1] / "data" / "questions.json"

SECTION_RE = re.compile(r"^[一二三四五六七八九十]+、(.+)")
ENTRY_RE = re.compile(r"^(\d+)\.\s*(.+)")
FIELD_RE = re.compile(r"^(原题|答案|答案要点|参考答案|解析|错项辨析)：(.*)")
PROGRAM_TITLE_HINTS = ("编程",)


def normalize_answer(raw: str) -> str:
    match = re.match(r"\s*([A-D](?:[、,，/][A-D])*)", raw)
    if not match:
        return raw.strip("` ")
    return re.sub(r"[,，/]", "、", match.group(1)).strip()


def extract_options(prompt: str) -> list[dict[str, str]]:
    matches = list(re.finditer(r"([A-D])\.\s*", prompt))
    if len(matches) < 2:
        return []

    options = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(prompt)
        options.append({"key": match.group(1), "text": prompt[start:end].strip()})
    return options


def parse_entries(lines: list[str]) -> tuple[list[dict], list[dict]]:
    section = ""
    current = None
    entries = []

    for line in lines:
        text = line.rstrip()
        stripped = text.strip()
        section_match = SECTION_RE.match(stripped)
        if section_match:
            section = stripped
            continue

        entry_match = ENTRY_RE.match(stripped)
        if entry_match:
            if current:
                entries.append(current)
            current = {
                "sourceId": int(entry_match.group(1)),
                "title": entry_match.group(2),
                "section": section,
                "rawLines": [],
            }
            continue

        if current:
            current["rawLines"].append(text)

    if current:
        entries.append(current)

    questions = []
    notes = []
    for entry in entries:
        if entry["section"].startswith("十一、"):
            notes.append(
                {
                    "id": f"note-{entry['sourceId']}",
                    "title": entry["title"],
                    "section": entry["section"],
                }
            )
            continue

        fields: dict[str, list[str]] = {}
        active = None
        for line in entry["rawLines"]:
            stripped = line.strip()
            field_match = FIELD_RE.match(stripped)
            if field_match:
                active = field_match.group(1)
                fields.setdefault(active, [])
                value = field_match.group(2).strip()
                if value:
                    fields[active].append(value)
                continue
            if active:
                fields.setdefault(active, []).append(line.rstrip())

        prompt = "\n".join(fields.get("原题", [])).strip()
        answer_text = "\n".join(fields.get("答案", fields.get("答案要点", []))).strip()
        reference = "\n".join(fields.get("参考答案", [])).strip()
        explanation = "\n".join(fields.get("解析", [])).strip()
        pitfalls = "\n".join(fields.get("错项辨析", [])).strip()
        options = extract_options(prompt)

        type_ = "program" if reference else "choice"
        if type_ != "program" and any(hint in entry["title"] for hint in PROGRAM_TITLE_HINTS):
            type_ = "program"

        questions.append(
            {
                "id": f"q{entry['sourceId']:03d}",
                "number": entry["sourceId"],
                "title": entry["title"],
                "section": entry["section"],
                "type": type_,
                "prompt": prompt,
                "options": options,
                "answer": normalize_answer(answer_text),
                "answerText": answer_text,
                "referenceAnswer": reference,
                "explanation": explanation,
                "pitfalls": pitfalls,
            }
        )

    return questions, notes


def main() -> None:
    document = Document(SOURCE)
    lines = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    questions, notes = parse_entries(lines)
    payload = {
        "source": SOURCE.name,
        "questionCount": len(questions),
        "programCount": sum(1 for item in questions if item["type"] == "program"),
        "choiceCount": sum(1 for item in questions if item["type"] == "choice"),
        "sections": sorted({item["section"] for item in questions}, key=lambda text: text.split("、")[0]),
        "questions": questions,
        "notes": notes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Wrote {OUT} with {payload['questionCount']} questions "
        f"({payload['choiceCount']} choice, {payload['programCount']} program) "
        f"and {len(notes)} notes."
    )


if __name__ == "__main__":
    main()
