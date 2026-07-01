const STORE_KEY = "cpp-practice-records-v1";

const els = {
  datasetMeta: document.querySelector("#datasetMeta"),
  searchInput: document.querySelector("#searchInput"),
  sectionList: document.querySelector("#sectionList"),
  toggleSections: document.querySelector("#toggleSections"),
  resetProgress: document.querySelector("#resetProgress"),
  totalCount: document.querySelector("#totalCount"),
  doneCount: document.querySelector("#doneCount"),
  wrongCount: document.querySelector("#wrongCount"),
  starCount: document.querySelector("#starCount"),
  questionCard: document.querySelector("#questionCard"),
  queueList: document.querySelector("#queueList"),
  notesList: document.querySelector("#notesList"),
  questionsTab: document.querySelector("#questionsTab"),
  notesTab: document.querySelector("#notesTab"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  randomBtn: document.querySelector("#randomBtn"),
  starBtn: document.querySelector("#starBtn"),
};

const state = {
  data: null,
  records: loadRecords(),
  type: "all",
  status: "all",
  query: "",
  selectedSections: new Set(),
  currentIndex: 0,
  selectedAnswers: new Set(),
  answerVisible: false,
  lastResult: null,
  autoAdvanceTimer: null,
};

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRecords() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.records));
}

function ensureRecord(id) {
  state.records[id] ||= {
    attempts: 0,
    correct: 0,
    wrong: false,
    starred: false,
    lastChoice: [],
  };
  return state.records[id];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(text = "") {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderBlock(text = "") {
  return renderInline(text).replace(/\n/g, "<br>");
}

function normalizeAnswer(answer = "") {
  return answer
    .replace(/[，,/]/g, "、")
    .split("、")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join("、");
}

function getFilteredQuestions() {
  if (!state.data) return [];
  const query = state.query.trim().toLowerCase();
  return state.data.questions.filter((question) => {
    const record = state.records[question.id] || {};
    if (state.type !== "all" && question.type !== state.type) return false;
    if (!state.selectedSections.has(question.section)) return false;
    if (state.status === "wrong" && !record.wrong) return false;
    if (state.status === "starred" && !record.starred) return false;
    if (state.status === "unseen" && record.attempts) return false;
    if (!query) return true;
    const haystack = [
      question.title,
      question.section,
      question.prompt,
      question.answerText,
      question.explanation,
      question.pitfalls,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function currentQuestion() {
  const list = getFilteredQuestions();
  if (!list.length) return null;
  state.currentIndex = Math.max(0, Math.min(state.currentIndex, list.length - 1));
  return list[state.currentIndex];
}

function clearAutoAdvance() {
  if (state.autoAdvanceTimer) {
    clearTimeout(state.autoAdvanceTimer);
    state.autoAdvanceTimer = null;
  }
}

function resetAnswerState(question) {
  clearAutoAdvance();
  state.selectedAnswers = new Set();
  state.answerVisible = false;
  state.lastResult = null;
  const record = state.records[question?.id];
  if (record?.lastChoice?.length && !record?.wrong) {
    state.selectedAnswers = new Set(record.lastChoice);
  }
}

function scheduleAutoAdvance(questionId) {
  clearAutoAdvance();
  state.autoAdvanceTimer = setTimeout(() => {
    if (currentQuestion()?.id !== questionId) return;
    const list = getFilteredQuestions();
    if (list.length <= 1) return;
    move(1);
  }, 850);
}

function revealAnswer(question) {
  state.answerVisible = true;
  renderAll();
  requestAnimationFrame(() => {
    const host = document.querySelector(".queue-item.active") || els.questionCard;
    const panel = host.querySelector(".answer-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    if (question?.type === "program") {
      host.querySelector("[data-action='show-answer']")?.focus();
    }
  });
}

function renderSections() {
  const counts = new Map();
  state.data.questions.forEach((question) => {
    counts.set(question.section, (counts.get(question.section) || 0) + 1);
  });
  els.sectionList.innerHTML = state.data.sections
    .map((section) => {
      const checked = state.selectedSections.has(section) ? "checked" : "";
      return `
        <label class="section-option">
          <input type="checkbox" value="${escapeHtml(section)}" ${checked}>
          <span>${escapeHtml(section.replace(/^[一二三四五六七八九十]+、/, ""))}</span>
          <span>${counts.get(section) || 0}</span>
        </label>
      `;
    })
    .join("");
}

function renderStats() {
  const filtered = getFilteredQuestions();
  const records = Object.values(state.records);
  els.totalCount.textContent = filtered.length;
  els.doneCount.textContent = records.filter((record) => record.attempts > 0).length;
  els.wrongCount.textContent = records.filter((record) => record.wrong).length;
  els.starCount.textContent = records.filter((record) => record.starred).length;
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) {
    els.questionCard.innerHTML = `<div class="empty-state">当前筛选下没有题目。</div>`;
    els.starBtn.classList.remove("active");
    els.starBtn.setAttribute("aria-pressed", "false");
    return;
  }

  els.questionCard.innerHTML = renderQuestionContent(question);
}

function renderQuestionContent(question) {
  const record = ensureRecord(question.id);
  els.starBtn.classList.toggle("active", Boolean(record.starred));
  els.starBtn.textContent = record.starred ? "★ 已星标" : "☆ 星标";
  els.starBtn.setAttribute("aria-pressed", String(Boolean(record.starred)));

  const typeLabel = question.type === "program" ? "程序题" : "选择题";
  const answerArea = question.type === "program" ? renderProgramArea(question, record) : renderChoiceArea(question);

  return `
    <div class="question-header">
      <div class="badges">
        <span class="badge">${question.section}</span>
        <span class="badge ${question.type}">${typeLabel}</span>
        ${record.wrong ? `<span class="badge wrong">错题</span>` : ""}
        ${record.attempts ? `<span class="badge">已练 ${record.attempts} 次</span>` : ""}
      </div>
      <div class="question-title-row">
        <h2>${question.number}. ${escapeHtml(question.title)}</h2>
        <button class="star-button inline-star ${record.starred ? "active" : ""}" data-action="toggle-star" aria-pressed="${String(Boolean(record.starred))}">
          ${record.starred ? "★ 已星标" : "☆ 星标"}
        </button>
      </div>
    </div>
    <div class="prompt">${renderBlock(question.prompt)}</div>
    ${answerArea}
    ${state.answerVisible ? renderAnswerPanels(question) : ""}
  `;
}

function renderChoiceArea(question) {
  if (!question.options.length) {
    return `
      <div class="action-row">
        <button class="primary-button" data-action="show-answer">查看答案</button>
        <button class="secondary-button" data-action="mark-correct">会了</button>
        <button class="secondary-button" data-action="mark-wrong">记入错题</button>
      </div>
      ${state.lastResult ? renderResult() : ""}
    `;
  }

  const selected = state.selectedAnswers;
  const correctSet = new Set(normalizeAnswer(question.answer).split("、").filter(Boolean));
  const options = question.options
    .map((option) => {
      const isSelected = selected.has(option.key);
      const show = state.answerVisible;
      const isCorrect = correctSet.has(option.key);
      const className = [
        "option-button",
        isSelected ? "selected" : "",
        show && isCorrect ? "correct" : "",
        show && isSelected && !isCorrect ? "incorrect" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button class="${className}" data-option="${option.key}" type="button">
          <span class="option-key">${option.key}</span>
          <span>${renderInline(option.text)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <div class="option-list">${options}</div>
    <div class="action-row">
      <button class="primary-button" data-action="submit-choice">提交</button>
      <button class="secondary-button" data-action="show-answer">查看答案</button>
      <button class="secondary-button" data-action="clear-choice">重选</button>
    </div>
    ${state.lastResult ? renderResult() : ""}
  `;
}

function renderProgramArea(question, record) {
  const draftKey = `draft:${question.id}`;
  const draft = localStorage.getItem(draftKey) || "";
  const answerLabel = state.answerVisible ? "参考答案已展开" : "查看参考答案";
  return `
    <textarea data-draft="${question.id}" spellcheck="false" placeholder="这里写你的思路或代码，内容只保存在本机浏览器。">${escapeHtml(draft)}</textarea>
    <div class="action-row">
      <button class="primary-button" data-action="show-answer">${answerLabel}</button>
      <button class="secondary-button" data-action="mark-correct">做对了</button>
      <button class="secondary-button" data-action="mark-wrong">记入错题</button>
      ${record.wrong ? `<button class="secondary-button" data-action="clear-wrong">移出错题</button>` : ""}
    </div>
    ${state.lastResult ? renderResult() : ""}
  `;
}

function renderResult() {
  const ok = state.lastResult === "correct";
  return `<div class="result-line ${ok ? "ok" : "bad"}">${ok ? "答对了，即将进入下一题。" : "已记入错题，之后可在错题筛选里重练。"}</div>`;
}

function renderAnswerPanels(question) {
  const answer = question.referenceAnswer
    ? `<pre><code>${escapeHtml(question.referenceAnswer)}</code></pre>`
    : `<p>${renderBlock(question.answerText || question.answer)}</p>`;
  const answerTitle = question.referenceAnswer ? "参考答案" : "答案";
  return `
    <section class="answer-panel ${question.referenceAnswer ? "program-answer" : ""}">
      <h3>${answerTitle}</h3>
      ${answer}
    </section>
    <section class="explanation-panel">
      <h3>解析</h3>
      <p>${renderBlock(question.explanation || "暂无解析。")}</p>
      ${question.pitfalls ? `<h3>错项辨析</h3><p>${renderBlock(question.pitfalls)}</p>` : ""}
    </section>
  `;
}

function renderQueue() {
  const list = getFilteredQuestions();
  els.queueList.innerHTML = list
    .map((question, index) => {
      const record = state.records[question.id] || {};
      const isActive = index === state.currentIndex;
      const flags = [
        question.type === "program" ? "程序题" : "选择题",
        record.starred ? "星标" : "",
        record.wrong ? "错题" : "",
        record.attempts ? `${record.attempts} 次` : "未做",
      ].filter(Boolean);
      return `
        <article class="queue-item ${isActive ? "active" : ""}" data-card="${index}">
          <button class="queue-summary" data-jump="${index}" type="button">
            <span class="queue-title">${question.number}. ${escapeHtml(question.title)}</span>
            <span class="queue-meta">${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}</span>
            <span class="queue-state">${isActive ? "正在做" : "展开"}</span>
          </button>
          ${isActive ? `<div class="queue-expanded">${renderQuestionContent(question)}</div>` : ""}
        </article>
      `;
    })
    .join("") || `<div class="empty-state">没有匹配的题目。</div>`;
}

function renderNotes() {
  els.notesList.innerHTML = state.data.notes
    .map((note) => `
      <div class="note-item">
        <span class="queue-title">${escapeHtml(note.title)}</span>
      </div>
    `)
    .join("");
}

function renderAll() {
  renderStats();
  renderQuestion();
  renderQueue();
}

function gradeChoice(question) {
  const selected = normalizeAnswer([...state.selectedAnswers].join("、"));
  if (!selected) return;
  const correct = normalizeAnswer(question.answer);
  const record = ensureRecord(question.id);
  const isCorrect = selected === correct;
  record.attempts += 1;
  record.lastChoice = [...state.selectedAnswers];
  if (isCorrect) {
    record.correct += 1;
    record.wrong = false;
    state.lastResult = "correct";
  } else {
    record.wrong = true;
    state.lastResult = "wrong";
  }
  state.answerVisible = true;
  saveRecords();
  renderAll();
  if (isCorrect) scheduleAutoAdvance(question.id);
}

function markCurrent(outcome) {
  const question = currentQuestion();
  if (!question) return;
  const record = ensureRecord(question.id);
  record.attempts += 1;
  if (outcome === "correct") {
    record.correct += 1;
    record.wrong = false;
  } else {
    record.wrong = true;
  }
  state.lastResult = outcome;
  state.answerVisible = true;
  saveRecords();
  renderAll();
  if (outcome === "correct") scheduleAutoAdvance(question.id);
}

function move(delta) {
  const list = getFilteredQuestions();
  if (!list.length) return;
  state.currentIndex = (state.currentIndex + delta + list.length) % list.length;
  resetAnswerState(list[state.currentIndex]);
  renderAll();
}

function jumpTo(index) {
  const list = getFilteredQuestions();
  if (index === state.currentIndex) return;
  state.currentIndex = Math.max(0, Math.min(index, list.length - 1));
  resetAnswerState(list[state.currentIndex]);
  renderAll();
}

function bindEvents() {
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-type]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.type = button.dataset.type;
      state.currentIndex = 0;
      resetAnswerState(currentQuestion());
      renderAll();
    });
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-status]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.status = button.dataset.status;
      state.currentIndex = 0;
      resetAnswerState(currentQuestion());
      renderAll();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.currentIndex = 0;
    resetAnswerState(currentQuestion());
    renderAll();
  });

  els.sectionList.addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox']")) {
      if (event.target.checked) state.selectedSections.add(event.target.value);
      else state.selectedSections.delete(event.target.value);
      els.toggleSections.textContent = state.selectedSections.size ? "全不选" : "全选";
      state.currentIndex = 0;
      resetAnswerState(currentQuestion());
      renderAll();
    }
  });

  els.toggleSections.addEventListener("click", () => {
    const shouldSelectAll = state.selectedSections.size === 0;
    state.selectedSections = new Set(shouldSelectAll ? state.data.sections : []);
    els.toggleSections.textContent = shouldSelectAll ? "全不选" : "全选";
    renderSections();
    state.currentIndex = 0;
    resetAnswerState(currentQuestion());
    renderAll();
  });

  function handlePracticeClick(event) {
    const option = event.target.closest("[data-option]");
    const action = event.target.closest("[data-action]")?.dataset.action;
    const question = currentQuestion();
    if (!question) return;

    if (option) {
      const key = option.dataset.option;
      if (state.selectedAnswers.has(key)) state.selectedAnswers.delete(key);
      else state.selectedAnswers.add(key);
      state.lastResult = null;
      renderAll();
      return;
    }

    if (action === "submit-choice") gradeChoice(question);
    if (action === "show-answer") revealAnswer(question);
    if (action === "clear-choice") {
      state.selectedAnswers.clear();
      state.answerVisible = false;
      state.lastResult = null;
      renderAll();
    }
    if (action === "mark-correct") markCurrent("correct");
    if (action === "mark-wrong") markCurrent("wrong");
    if (action === "clear-wrong") {
      ensureRecord(question.id).wrong = false;
      saveRecords();
      renderAll();
    }
    if (action === "toggle-star") {
      const record = ensureRecord(question.id);
      record.starred = !record.starred;
      saveRecords();
      renderAll();
    }
  }

  els.questionCard.addEventListener("click", handlePracticeClick);

  els.questionCard.addEventListener("input", (event) => {
    if (event.target.matches("[data-draft]")) {
      localStorage.setItem(`draft:${event.target.dataset.draft}`, event.target.value);
    }
  });

  els.queueList.addEventListener("click", (event) => {
    if (event.target.closest("[data-option]") || event.target.closest("[data-action]")) {
      handlePracticeClick(event);
      return;
    }
    const item = event.target.closest("[data-jump]");
    if (item) jumpTo(Number(item.dataset.jump));
  });

  els.queueList.addEventListener("input", (event) => {
    if (event.target.matches("[data-draft]")) {
      localStorage.setItem(`draft:${event.target.dataset.draft}`, event.target.value);
    }
  });

  els.prevBtn.addEventListener("click", () => move(-1));
  els.nextBtn.addEventListener("click", () => move(1));
  els.randomBtn.addEventListener("click", () => {
    const list = getFilteredQuestions();
    if (!list.length) return;
    state.currentIndex = Math.floor(Math.random() * list.length);
    resetAnswerState(list[state.currentIndex]);
    renderAll();
  });

  els.starBtn.addEventListener("click", () => {
    const question = currentQuestion();
    if (!question) return;
    const record = ensureRecord(question.id);
    record.starred = !record.starred;
    saveRecords();
    renderAll();
  });

  els.resetProgress.addEventListener("click", () => {
    if (!confirm("确定清空所有错题、星标、练习次数和草稿吗？")) return;
    localStorage.removeItem(STORE_KEY);
    Object.keys(localStorage)
      .filter((key) => key.startsWith("draft:q"))
      .forEach((key) => localStorage.removeItem(key));
    state.records = {};
    resetAnswerState(currentQuestion());
    renderAll();
  });

  els.questionsTab.addEventListener("click", () => {
    els.questionsTab.classList.add("active");
    els.notesTab.classList.remove("active");
    els.queueList.classList.remove("hidden");
    els.notesList.classList.add("hidden");
  });

  els.notesTab.addEventListener("click", () => {
    els.notesTab.classList.add("active");
    els.questionsTab.classList.remove("active");
    els.notesList.classList.remove("hidden");
    els.queueList.classList.add("hidden");
  });
}

async function init() {
  const response = await fetch("./data/questions.json");
  state.data = await response.json();
  state.selectedSections = new Set(state.data.sections);
  els.datasetMeta.textContent = `${state.data.questionCount} 题 · ${state.data.choiceCount} 选择题 · ${state.data.programCount} 程序题`;
  renderSections();
  renderNotes();
  bindEvents();
  resetAnswerState(currentQuestion());
  renderAll();
}

init().catch((error) => {
  console.error(error);
  els.questionCard.innerHTML = `<div class="empty-state">题库加载失败，请检查 data/questions.json。</div>`;
});
