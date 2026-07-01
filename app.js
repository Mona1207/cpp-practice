const STORE_KEY = "cpp-practice-records-v1";

const app = document.querySelector("#app");

const MODULES = {
  all: { title: "全部题", subtitle: "所有题目", icon: "▰", accent: "blue" },
  choice: { title: "选择题", subtitle: "选择题目", icon: "✓", accent: "green", type: "choice" },
  fill: { title: "填空题", subtitle: "填空题目", icon: "✎", accent: "orange", type: "fill" },
  program: { title: "程序题", subtitle: "程序题目", icon: "</>", accent: "purple", type: "program" },
  wrong: { title: "错题", subtitle: "错题重练", icon: "!", accent: "red", status: "wrong" },
  starred: { title: "星标题", subtitle: "重点收藏", icon: "★", accent: "amber", status: "starred" },
};

const state = {
  data: null,
  records: loadRecords(),
  route: currentRoute(),
  selectedSections: new Set(),
  currentIndex: 0,
  expanded: true,
  selectedAnswers: new Set(),
  fillAnswer: "",
  optionOrders: {},
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

function currentRoute() {
  const key = location.hash.replace(/^#\/?/, "") || "home";
  return key in MODULES ? key : "home";
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

function normalizeFillAnswer(answer = "") {
  return String(answer)
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[，]/g, ",")
    .replace(/[；、]/g, ";")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function typeLabel(type) {
  if (type === "program") return "程序题";
  if (type === "fill") return "填空题";
  return "选择题";
}

function strippedPrompt(question) {
  if (!question.options?.length) return question.prompt;
  const match = question.prompt.match(/\bA\.\s*/);
  if (!match) return question.prompt;
  return question.prompt.slice(0, match.index).trim();
}

function shuffleKeys(keys) {
  const shuffled = [...keys];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function ensureOptionOrder(question) {
  if (!question?.options?.length) return [];
  const keys = question.options.map((option) => option.key);
  const current = state.optionOrders[question.id];
  if (current?.length === keys.length && current.every((key) => keys.includes(key))) {
    return current;
  }
  state.optionOrders[question.id] = shuffleKeys(keys);
  return state.optionOrders[question.id];
}

function moduleQuestions(key) {
  if (!state.data) return [];
  const config = MODULES[key] || MODULES.all;
  return state.data.questions.filter((question) => {
    const record = state.records[question.id] || {};
    if (config.type && question.type !== config.type) return false;
    if (config.status === "wrong" && !record.wrong) return false;
    if (config.status === "starred" && !record.starred) return false;
    return true;
  });
}

function filteredQuestions() {
  const base = moduleQuestions(state.route);
  return base.filter((question) => state.selectedSections.has(question.section));
}

function currentQuestion() {
  const list = filteredQuestions();
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
  state.fillAnswer = "";
  if (question?.id) delete state.optionOrders[question.id];
  state.answerVisible = false;
  state.lastResult = null;
  const record = state.records[question?.id];
  if (record?.lastChoice?.length && !record?.wrong && question?.type === "choice") {
    state.selectedAnswers = new Set(record.lastChoice);
  }
}

function scheduleAutoAdvance(questionId) {
  clearAutoAdvance();
  state.autoAdvanceTimer = setTimeout(() => {
    if (currentQuestion()?.id !== questionId) return;
    const list = filteredQuestions();
    if (list.length <= 1) return;
    move(1);
  }, 850);
}

function doneCount(questions) {
  return questions.filter((question) => (state.records[question.id] || {}).attempts > 0).length;
}

function correctCount(questions) {
  return questions.filter((question) => {
    const record = state.records[question.id] || {};
    return record.correct > 0 && !record.wrong;
  }).length;
}

function wrongCount(questions) {
  return questions.filter((question) => (state.records[question.id] || {}).wrong).length;
}

function moduleProgress(key) {
  const questions = moduleQuestions(key);
  const done = doneCount(questions);
  return {
    total: questions.length,
    done,
    correct: correctCount(questions),
    wrong: wrongCount(questions),
    percent: questions.length ? Math.round((done / questions.length) * 100) : 0,
  };
}

function renderHome() {
  const all = moduleProgress("all");
  const accuracy = all.done ? Math.round((all.correct / all.done) * 100) : 0;
  app.innerHTML = `
    <main class="home-shell">
      <header class="home-header">
        <div>
          <p class="eyebrow">C++ 程序设计</p>
          <h1>刷题题库</h1>
        </div>
        <button class="danger-button" data-action="reset-progress" type="button">清空记录</button>
      </header>

      <section class="module-grid" aria-label="题库模块">
        ${Object.keys(MODULES).map(renderModuleCard).join("")}
      </section>

      <section class="study-panel" aria-label="学习统计">
        <div class="study-head">
          <span class="study-icon">▥</span>
          <h2>学习统计</h2>
          <span>进度 <strong>${all.done}/${all.total}</strong></span>
          <span>正确率 <strong>${accuracy}%</strong></span>
        </div>
        <div class="progress-line"><span style="width:${all.percent}%"></span></div>
        <div class="stat-grid">
          ${["all", "choice", "fill", "program"].map(renderStatCard).join("")}
        </div>
      </section>
    </main>
  `;
}

function renderModuleCard(key) {
  const config = MODULES[key];
  const stats = moduleProgress(key);
  return `
    <a class="module-card ${config.accent}" href="#/${key}" data-module="${key}">
      <span class="module-icon">${escapeHtml(config.icon)}</span>
      <span class="module-title">${config.title}</span>
      <span class="module-count">${stats.done}/${stats.total}</span>
      <span class="module-subtitle">${config.subtitle}</span>
      <span class="module-progress"><span style="width:${stats.percent}%"></span></span>
    </a>
  `;
}

function renderStatCard(key) {
  const config = MODULES[key];
  const stats = moduleProgress(key);
  const label = stats.percent >= 90 ? "优秀" : stats.percent >= 60 ? "良好" : "一般";
  return `
    <div class="stat-card">
      <div>
        <strong>${config.title}</strong>
        <span>${stats.done}/${stats.total}</span>
      </div>
      <b>${stats.percent}<small>%</small></b>
      <div class="mini-progress"><span style="width:${stats.percent}%"></span></div>
      <div>
        <span>${stats.correct} 对 ${stats.wrong} 错</span>
        <em>${label}</em>
      </div>
    </div>
  `;
}

function renderModulePage() {
  const config = MODULES[state.route];
  const list = filteredQuestions();
  const base = moduleQuestions(state.route);
  const current = currentQuestion();
  app.innerHTML = `
    <main class="practice-shell">
      <header class="practice-top">
        <a class="back-link" href="#/">‹ 题库</a>
        <div>
          <p class="eyebrow">${config.subtitle}</p>
          <h1>${config.title}</h1>
        </div>
        <div class="practice-count">${list.length}/${base.length}</div>
      </header>

      <section class="chapter-panel">
        <div class="section-head">
          <h2>章节筛选</h2>
          <button class="text-button" data-action="toggle-sections" type="button">${state.selectedSections.size ? "全不选" : "全选"}</button>
        </div>
        <div class="section-list">
          ${state.data.sections.map(renderSectionOption).join("")}
        </div>
      </section>

      <section class="practice-toolbar">
        <button class="icon-button" data-action="prev" title="上一题" aria-label="上一题">‹</button>
        <button class="secondary-button" data-action="random" type="button">随机</button>
        <button class="icon-button" data-action="next" title="下一题" aria-label="下一题">›</button>
      </section>

      <section class="question-list">
        ${list.length ? list.map(renderQueueItem).join("") : `<div class="empty-state">当前模块或章节下没有题目。</div>`}
      </section>
    </main>
  `;
  syncActiveIntoView(current);
}

function renderSectionOption(section) {
  const checked = state.selectedSections.has(section) ? "checked" : "";
  const count = moduleQuestions(state.route).filter((question) => question.section === section).length;
  return `
    <label class="section-option">
      <input type="checkbox" value="${escapeHtml(section)}" ${checked}>
      <span>${escapeHtml(section)}</span>
      <span>${count}</span>
    </label>
  `;
}

function renderQueueItem(question, index) {
  const record = state.records[question.id] || {};
  const isActive = state.expanded && index === state.currentIndex;
  const flags = [
    typeLabel(question.type),
    record.starred ? "星标" : "",
    record.wrong ? "错题" : "",
    record.attempts ? `${record.attempts} 次` : "未做",
  ].filter(Boolean);
  return `
    <article class="queue-item ${isActive ? "active" : ""}">
      <button class="queue-summary" data-jump="${index}" type="button">
        <span class="queue-title">${question.number}. ${escapeHtml(question.title)}</span>
        <span class="queue-meta">${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}</span>
        <span class="queue-state">${isActive ? "收起" : "展开"}</span>
      </button>
      ${isActive ? `<div class="queue-expanded">${renderQuestionContent(question)}</div>` : ""}
    </article>
  `;
}

function renderQuestionContent(question) {
  const record = ensureRecord(question.id);
  const answerArea = question.type === "program"
    ? renderProgramArea(question, record)
    : question.type === "fill"
      ? renderFillArea()
      : renderChoiceArea(question);
  return `
    <div class="question-header">
      <div class="badges">
        <span class="badge">${escapeHtml(question.section)}</span>
        <span class="badge ${question.type}">${typeLabel(question.type)}</span>
        ${record.wrong ? `<span class="badge wrong">错题</span>` : ""}
      </div>
      <div class="question-title-row">
        <h2>${question.number}. ${escapeHtml(question.title)}</h2>
        <button class="star-button inline-star ${record.starred ? "active" : ""}" data-action="toggle-star" type="button" aria-pressed="${String(Boolean(record.starred))}">
          ${record.starred ? "★ 已星标" : "☆ 星标"}
        </button>
      </div>
    </div>
    <div class="prompt">${renderBlock(strippedPrompt(question))}</div>
    ${answerArea}
    ${state.answerVisible ? renderAnswerPanels(question) : ""}
  `;
}

function renderChoiceArea(question) {
  const selected = state.selectedAnswers;
  const correctSet = new Set(normalizeAnswer(question.answer).split("、").filter(Boolean));
  const optionMap = new Map(question.options.map((option) => [option.key, option]));
  const options = ensureOptionOrder(question)
    .map((key, index) => {
      const option = optionMap.get(key);
      const isSelected = selected.has(option.key);
      const show = state.answerVisible;
      const isCorrect = correctSet.has(option.key);
      const className = [
        "option-button",
        isSelected ? "selected" : "",
        show && isCorrect ? "correct" : "",
        show && isSelected && !isCorrect ? "incorrect" : "",
      ].filter(Boolean).join(" ");
      return `
        <button class="${className}" data-option="${option.key}" type="button">
          <span class="option-key">${index + 1}</span>
          <span>${renderInline(option.text)}</span>
        </button>
      `;
    })
    .join("");
  return `
    <div class="option-list">${options}</div>
    <div class="action-row">
      <button class="primary-button" data-action="submit-choice" type="button">提交</button>
      <button class="secondary-button" data-action="show-answer" type="button">查看答案</button>
      <button class="secondary-button" data-action="clear-choice" type="button">重选</button>
    </div>
    ${state.lastResult ? renderResult() : ""}
  `;
}

function renderFillArea() {
  return `
    <textarea class="fill-input" data-fill-answer spellcheck="false" placeholder="输入填空答案；多个空可以用分号或顿号隔开。">${escapeHtml(state.fillAnswer)}</textarea>
    <div class="action-row">
      <button class="primary-button" data-action="submit-fill" type="button">提交</button>
      <button class="secondary-button" data-action="show-answer" type="button">查看答案</button>
      <button class="secondary-button" data-action="clear-fill" type="button">重填</button>
    </div>
    ${state.lastResult ? renderResult() : ""}
  `;
}

function renderProgramArea(question, record) {
  const draftKey = `draft:${question.id}`;
  const draft = localStorage.getItem(draftKey) || "";
  return `
    <textarea data-draft="${question.id}" spellcheck="false" placeholder="这里写你的思路或代码，内容只保存在本机浏览器。">${escapeHtml(draft)}</textarea>
    <div class="action-row">
      <button class="primary-button" data-action="show-answer" type="button">${state.answerVisible ? "参考答案已展开" : "查看参考答案"}</button>
      <button class="secondary-button" data-action="mark-correct" type="button">做对了</button>
      <button class="secondary-button" data-action="mark-wrong" type="button">记入错题</button>
      ${record.wrong ? `<button class="secondary-button" data-action="clear-wrong" type="button">移出错题</button>` : ""}
    </div>
    ${state.lastResult ? renderResult() : ""}
  `;
}

function renderResult() {
  const ok = state.lastResult === "correct";
  return `<div class="result-line ${ok ? "ok" : "bad"}">${ok ? "答对了，即将进入下一题。" : "已记入错题，之后可在错题模块重练。"}</div>`;
}

function renderAnswerPanels(question) {
  const answer = question.referenceAnswer
    ? `<pre><code>${escapeHtml(question.referenceAnswer)}</code></pre>`
    : `<p>${renderBlock(question.answerText || question.answer)}</p>`;
  return `
    <section class="answer-panel ${question.referenceAnswer ? "program-answer" : ""}">
      <h3>${question.referenceAnswer ? "参考答案" : "答案"}</h3>
      ${answer}
    </section>
    <section class="explanation-panel">
      <h3>解析</h3>
      <p>${renderBlock(question.explanation || "暂无解析。")}</p>
      ${question.pitfalls ? `<h3>错项辨析</h3><p>${renderBlock(question.pitfalls)}</p>` : ""}
    </section>
  `;
}

function gradeChoice(question) {
  const selected = normalizeAnswer([...state.selectedAnswers].join("、"));
  if (!selected) return;
  const correct = normalizeAnswer(question.answer);
  finishObjective(question, selected === correct, [...state.selectedAnswers]);
}

function gradeFill(question) {
  const selected = normalizeFillAnswer(state.fillAnswer);
  if (!selected) return;
  const correct = normalizeFillAnswer(question.answer || question.answerText);
  finishObjective(question, selected === correct, [state.fillAnswer]);
}

function finishObjective(question, isCorrect, lastChoice) {
  const record = ensureRecord(question.id);
  record.attempts += 1;
  record.lastChoice = lastChoice;
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
  render();
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
  render();
  if (outcome === "correct") scheduleAutoAdvance(question.id);
}

function move(delta) {
  const list = filteredQuestions();
  if (!list.length) return;
  state.currentIndex = (state.currentIndex + delta + list.length) % list.length;
  state.expanded = true;
  resetAnswerState(list[state.currentIndex]);
  render();
}

function jumpTo(index) {
  const list = filteredQuestions();
  if (index === state.currentIndex && state.expanded) {
    state.expanded = false;
    resetAnswerState(list[state.currentIndex]);
    render();
    return;
  }
  state.currentIndex = Math.max(0, Math.min(index, list.length - 1));
  state.expanded = true;
  resetAnswerState(list[state.currentIndex]);
  render();
}

function syncActiveIntoView(question) {
  if (!question) return;
  requestAnimationFrame(() => {
    document.querySelector(".queue-item.active")?.scrollIntoView({ block: "nearest" });
  });
}

function render() {
  if (!state.data) return;
  state.route = currentRoute();
  if (state.route === "home") {
    clearAutoAdvance();
    renderHome();
    return;
  }
  renderModulePage();
}

function resetModuleState() {
  state.selectedSections = new Set(state.data.sections);
  state.currentIndex = 0;
  state.expanded = true;
  resetAnswerState(currentQuestion());
}

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const option = event.target.closest("[data-option]");
  const jump = event.target.closest("[data-jump]");
  const question = currentQuestion();

  if (option && question) {
    const key = option.dataset.option;
    if (state.selectedAnswers.has(key)) state.selectedAnswers.delete(key);
    else state.selectedAnswers.add(key);
    state.lastResult = null;
    render();
    return;
  }

  if (jump) {
    jumpTo(Number(jump.dataset.jump));
    return;
  }

  if (!action) return;
  if (action === "reset-progress") {
    if (!confirm("确定清空所有错题、星标、练习次数和草稿吗？")) return;
    localStorage.removeItem(STORE_KEY);
    Object.keys(localStorage)
      .filter((key) => key.startsWith("draft:q"))
      .forEach((key) => localStorage.removeItem(key));
    state.records = {};
    render();
    return;
  }
  if (action === "toggle-sections") {
    state.selectedSections = new Set(state.selectedSections.size ? [] : state.data.sections);
    state.currentIndex = 0;
    state.expanded = true;
    resetAnswerState(currentQuestion());
    render();
    return;
  }
  if (action === "prev") return move(-1);
  if (action === "next") return move(1);
  if (action === "random") {
    const list = filteredQuestions();
    if (!list.length) return;
    state.currentIndex = Math.floor(Math.random() * list.length);
    state.expanded = true;
    resetAnswerState(list[state.currentIndex]);
    render();
    return;
  }
  if (!question) return;
  if (action === "submit-choice") gradeChoice(question);
  if (action === "submit-fill") gradeFill(question);
  if (action === "show-answer") {
    state.answerVisible = true;
    render();
  }
  if (action === "clear-choice") {
    state.selectedAnswers.clear();
    state.answerVisible = false;
    state.lastResult = null;
    render();
  }
  if (action === "clear-fill") {
    state.fillAnswer = "";
    state.answerVisible = false;
    state.lastResult = null;
    render();
  }
  if (action === "mark-correct") markCurrent("correct");
  if (action === "mark-wrong") markCurrent("wrong");
  if (action === "clear-wrong") {
    ensureRecord(question.id).wrong = false;
    saveRecords();
    render();
  }
  if (action === "toggle-star") {
    const record = ensureRecord(question.id);
    record.starred = !record.starred;
    saveRecords();
    render();
  }
});

app.addEventListener("change", (event) => {
  if (!event.target.matches(".section-option input")) return;
  if (event.target.checked) state.selectedSections.add(event.target.value);
  else state.selectedSections.delete(event.target.value);
  state.currentIndex = 0;
  state.expanded = true;
  resetAnswerState(currentQuestion());
  render();
});

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-draft]")) {
    localStorage.setItem(`draft:${event.target.dataset.draft}`, event.target.value);
  }
  if (event.target.matches("[data-fill-answer]")) {
    state.fillAnswer = event.target.value;
    state.lastResult = null;
  }
});

window.addEventListener("hashchange", () => {
  state.route = currentRoute();
  if (state.route !== "home") resetModuleState();
  render();
});

async function init() {
  const response = await fetch("./data/questions.json");
  state.data = await response.json();
  state.selectedSections = new Set(state.data.sections);
  render();
}

init().catch((error) => {
  console.error(error);
  app.innerHTML = `<div class="loading">题库加载失败，请检查 data/questions.json。</div>`;
});
