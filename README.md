# C++ 程序设计刷题站

这是一个纯静态刷题网站，题库来自桌面上的第一章至第九章 PDF 章节文件。

功能包括：

- 按知识点、题型、状态筛选刷题
- 选择题自动判定，选项随机打乱
- 填空题输入判定
- 程序题本地草稿、参考答案、自评
- 错题本、星标题、练习次数统计
- 考前速记卡片

本地预览：

```bash
python3 -m http.server 5173
```

部署：

- 推送到 GitHub 的 `main` 分支后，`.github/workflows/pages.yml` 会使用 GitHub Actions 发布到 GitHub Pages。
- 如果仓库首次使用 Pages，在仓库 `Settings -> Pages` 中将部署来源设为 `GitHub Actions`。

重新从章节 PDF 生成题库：

```bash
python3 scripts/ocr_pdf_questions.py
python3 scripts/build_chapter_questions.py
```

说明：PDF 的可复制文本会丢失汉字，`ocr_pdf_questions.py` 会调用 macOS Vision OCR 生成中间识别结果；`build_chapter_questions.py` 再合并已清洗答案解析并输出 `data/questions.json`。
