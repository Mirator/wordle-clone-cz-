(() => {
  const BOARD_ROWS = 6;
  const BOARD_COLS = 5;
  const STORAGE_STATE = "cz-wordle-state";
  const STORAGE_SETTINGS = "cz-wordle-settings";
  const STORAGE_STATS = "cz-wordle-stats";
  const STORAGE_OVERRIDE = "cz-wordle-overrides";
  const EPOCH = new Date("2021-06-19T00:00:00Z");
  const PASSWORD = "Vincent";

  const Status = {
    EXACT: "exact",
    PRESENT: "present",
    BASE: "base",
    ABSENT: "absent",
  };

  const statusPriority = [Status.ABSENT, Status.BASE, Status.PRESENT, Status.EXACT];

  const keyboardLayout = [
    ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P"],
    ["Ů", "Ú", "A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Ě", "Š", "Č", "Ř", "Y", "X", "C", "V", "B", "N"],
    [
      { action: "enter", label: "ENTER" },
      "M",
      "Á",
      "Í",
      "É",
      "Ň",
      "Ť",
      "Ž",
      "Ý",
      { action: "backspace", label: "⌫" },
    ],
  ];

  let state = {
    board: Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill("")),
    evaluations: [],
    rowIndex: 0,
    gameStatus: "playing",
    solution: "",
    solutionDate: "",
    mode: "daily",
  };

  const settings = loadSettings();
  applyTheme(settings);

  const stats = loadStats();

  const dom = {
    board: document.getElementById("board"),
    keyboard: document.getElementById("keyboard"),
    toast: document.getElementById("toast-container"),
    helpModal: document.getElementById("help-modal"),
    statsModal: document.getElementById("stats-modal"),
    settingsModal: document.getElementById("settings-modal"),
    adminModal: document.getElementById("admin-modal"),
    darkToggle: document.getElementById("dark-toggle"),
    contrastToggle: document.getElementById("contrast-toggle"),
    practiceToggle: document.getElementById("practice-toggle"),
    statPlayed: document.getElementById("stat-played"),
    statWinrate: document.getElementById("stat-winrate"),
    statStreak: document.getElementById("stat-streak"),
    statMaxStreak: document.getElementById("stat-maxstreak"),
    distribution: document.getElementById("guess-distribution"),
    shareButton: document.getElementById("share-button"),
    shareResult: document.getElementById("share-result"),
    adminPassword: document.getElementById("admin-password"),
    adminWord: document.getElementById("admin-word"),
    adminSubmit: document.getElementById("admin-submit"),
    adminReset: document.getElementById("admin-reset"),
  };

  function normalizeBase(word) {
    return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Slova se ukládají velkými písmeny. allowedBaseSet dovolí i vstup bez diakritiky,
  // pokud existuje alespoň jedno povolené slovo se stejným základem.
  const allowedSet = new Set(ALLOWED);
  const allowedBaseSet = new Set(ALLOWED.map((w) => normalizeBase(w)));

  function getTodayKey(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getDayIndex(date = new Date()) {
    const diff = date.setHours(0, 0, 0, 0) - EPOCH.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function loadOverrides() {
    try {
      const data = localStorage.getItem(STORAGE_OVERRIDE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Cannot load overrides", e);
    }
    return {};
  }

  function saveOverrides(map) {
    localStorage.setItem(STORAGE_OVERRIDE, JSON.stringify(map));
  }

  function pickSolution(date = new Date()) {
    const key = getTodayKey(date);
    const overrides = loadOverrides();
    if (overrides[key]) {
      return { word: overrides[key], dateKey: key, dayIndex: getDayIndex(date) };
    }
    const index = getDayIndex(date) % SOLUTIONS.length;
    return { word: SOLUTIONS[index], dateKey: key, dayIndex: getDayIndex(date) };
  }

  function pickPractice() {
    const idx = Math.floor(Math.random() * SOLUTIONS.length);
    return SOLUTIONS[idx];
  }

  function loadSettings() {
    const defaults = { dark: true, contrast: false, practice: false };
    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  }

  function loadStats() {
    const defaults = { played: 0, wins: 0, streak: 0, maxStreak: 0, distribution: Array(6).fill(0) };
    try {
      const stored = localStorage.getItem(STORAGE_STATS);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  }

  function saveStats() {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  }

  function saveState() {
    const toSave = { ...state };
    localStorage.setItem(STORAGE_STATE, JSON.stringify(toSave));
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_STATE);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  }

  function applyTheme(opts) {
    document.body.classList.toggle("light", !opts.dark);
    document.body.classList.toggle("contrast", opts.contrast);
  }

  function init() {
    buildBoard();
    buildKeyboard();
    registerEvents();
    initializeGame();
    updateStatsUI();
    registerServiceWorker();
  }

  function initializeGame() {
    const saved = loadState();
    const daily = pickSolution();
    const practiceMode = settings.practice;

    if (saved && saved.mode === "daily" && !practiceMode && saved.solutionDate === daily.dateKey && saved.solution === daily.word) {
      state = { ...state, ...saved };
    } else if (saved && saved.mode === "practice" && practiceMode) {
      state = { ...state, ...saved };
    } else {
      const solution = practiceMode ? pickPractice() : daily.word;
      const dateKey = practiceMode ? getTodayKey() : daily.dateKey;
      resetState(solution, dateKey, practiceMode ? "practice" : "daily");
    }

    dom.practiceToggle.checked = settings.practice;
    dom.darkToggle.checked = settings.dark;
    dom.contrastToggle.checked = settings.contrast;
    renderBoard();
    renderKeyboard();
  }

  function resetState(solution, dateKey, mode) {
    state = {
      board: Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill("")),
      evaluations: [],
      rowIndex: 0,
      gameStatus: "playing",
      solution,
      solutionDate: dateKey,
      mode,
    };
    saveState();
  }

  function buildBoard() {
    dom.board.innerHTML = "";
    for (let r = 0; r < BOARD_ROWS; r++) {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.row = r;
      for (let c = 0; c < BOARD_COLS; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        const inner = document.createElement("span");
        inner.className = "letter";
        tile.appendChild(inner);
        row.appendChild(tile);
      }
      dom.board.appendChild(row);
    }
  }

  function buildKeyboard() {
    dom.keyboard.innerHTML = "";
    keyboardLayout.forEach((rowKeys) => {
      const row = document.createElement("div");
      row.className = "key-row";
      rowKeys.forEach((key) => {
        const btn = document.createElement("button");
        btn.className = "key";
        if (typeof key === "string") {
          btn.textContent = key;
          btn.dataset.key = key;
        } else {
          btn.textContent = key.label;
          btn.dataset.action = key.action;
          btn.classList.add("wide");
        }
        row.appendChild(btn);
      });
      dom.keyboard.appendChild(row);
    });
  }

  function registerEvents() {
    document.addEventListener("keydown", onKeydown);
    dom.keyboard.addEventListener("click", onKeyboardClick);

    document.getElementById("help-button").addEventListener("click", () => openModal(dom.helpModal));
    document.getElementById("stats-button").addEventListener("click", () => openModal(dom.statsModal));
    document.getElementById("settings-button").addEventListener("click", () => openModal(dom.settingsModal));
    document.getElementById("admin-button").addEventListener("click", () => openModal(dom.adminModal));

    document.querySelectorAll("[data-close-modal]").forEach((btn) =>
      btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal")))
    );

    dom.darkToggle.addEventListener("change", () => {
      settings.dark = dom.darkToggle.checked;
      applyTheme(settings);
      saveSettings();
    });
    dom.contrastToggle.addEventListener("change", () => {
      settings.contrast = dom.contrastToggle.checked;
      applyTheme(settings);
      saveSettings();
    });
    dom.practiceToggle.addEventListener("change", () => {
      settings.practice = dom.practiceToggle.checked;
      saveSettings();
      const solutionInfo = settings.practice ? { word: pickPractice(), dateKey: getTodayKey() } : pickSolution();
      resetState(solutionInfo.word, solutionInfo.dateKey, settings.practice ? "practice" : "daily");
      renderBoard();
      renderKeyboard();
    });

    dom.shareButton.addEventListener("click", shareResult);

    dom.adminSubmit.addEventListener("click", handleAdminSubmit);
    dom.adminReset.addEventListener("click", handleAdminReset);
  }

  function onKeyboardClick(e) {
    const key = e.target.closest(".key");
    if (!key || state.gameStatus !== "playing") return;
    if (key.dataset.action === "enter") {
      submitGuess();
    } else if (key.dataset.action === "backspace") {
      removeLetter();
    } else if (key.dataset.key) {
      addLetter(key.dataset.key);
    }
  }

  function onKeydown(e) {
    if (state.gameStatus !== "playing") return;
    if (e.key === "Enter") {
      submitGuess();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      removeLetter();
    } else {
      const letter = normalizeInputLetter(e.key);
      if (letter) addLetter(letter);
    }
  }

  function normalizeInputLetter(key) {
    const upper = key.toUpperCase();
    if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]$/.test(upper)) return upper;
    return null;
  }

  function addLetter(letter) {
    const row = state.board[state.rowIndex];
    const col = row.findIndex((c) => c === "");
    if (col === -1) return;
    row[col] = letter;
    renderBoard();
    saveState();
  }

  function removeLetter() {
    const row = state.board[state.rowIndex];
    for (let i = BOARD_COLS - 1; i >= 0; i--) {
      if (row[i]) {
        row[i] = "";
        break;
      }
    }
    renderBoard();
    saveState();
  }

  function submitGuess() {
    const guess = state.board[state.rowIndex].join("");
    if (guess.length < BOARD_COLS) {
      shakeRow(state.rowIndex);
      return showToast("Nedostatek písmen");
    }
    const upperGuess = guess.toUpperCase();
    if (!isValidWord(upperGuess)) {
      shakeRow(state.rowIndex);
      return showToast("Slovo není v seznamu");
    }

    const evaluation = evaluateGuess(upperGuess, state.solution);
    state.evaluations.push(evaluation);
    animateReveal(state.rowIndex, evaluation);
    updateKeyboardColors(upperGuess, evaluation);

    const isWin = evaluation.every((s) => s === Status.EXACT);
    if (isWin) {
      state.gameStatus = "won";
      updateStats(true, state.rowIndex + 1);
      showToast("Výborně!");
      setTimeout(() => openModal(dom.statsModal), 700);
    } else if (state.rowIndex === BOARD_ROWS - 1) {
      state.gameStatus = "lost";
      updateStats(false);
      showToast(`Slovo bylo ${state.solution}`);
      setTimeout(() => openModal(dom.statsModal), 700);
    } else {
      state.rowIndex += 1;
    }
    saveState();
  }

  function isValidWord(word) {
    if (allowedSet.has(word)) return true;
    const base = normalizeBase(word);
    return allowedBaseSet.has(base);
  }

  function evaluateGuess(guess, solution) {
    const res = Array(BOARD_COLS).fill(Status.ABSENT);
    const solutionUnits = solution.split("").map((letter) => ({
      letter,
      base: normalizeBase(letter),
      used: false,
    }));

    const guessLetters = guess.split("");
    const guessBases = guessLetters.map((l) => normalizeBase(l));

    // Pass 1: exact match
    for (let i = 0; i < BOARD_COLS; i++) {
      if (guessLetters[i] === solutionUnits[i].letter) {
        res[i] = Status.EXACT;
        solutionUnits[i].used = true;
      }
    }

    // Pass 2: present exact (correct letter, wrong position)
    for (let i = 0; i < BOARD_COLS; i++) {
      if (res[i] !== Status.ABSENT) continue;
      const idx = solutionUnits.findIndex(
        (unit, j) => !unit.used && guessLetters[i] === unit.letter && j !== i
      );
      if (idx !== -1) {
        res[i] = Status.PRESENT;
        solutionUnits[idx].used = true;
      }
    }

    // Pass 3: base match only (diacritics differ)
    for (let i = 0; i < BOARD_COLS; i++) {
      if (res[i] !== Status.ABSENT) continue;
      const idx = solutionUnits.findIndex(
        (unit) => !unit.used && guessBases[i] === unit.base && guessLetters[i] !== unit.letter
      );
      if (idx !== -1) {
        res[i] = Status.BASE;
        solutionUnits[idx].used = true;
      }
    }

    return res;
  }

  function updateKeyboardColors(guess, evaluation) {
    const keys = dom.keyboard.querySelectorAll(".key");
    const map = {};
    keys.forEach((k) => (map[k.dataset.key || k.dataset.action] = k));

    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const status = evaluation[i];
      const key = map[letter];
      if (!key) continue;
      const current = key.dataset.state;
      if (!current || statusPriority.indexOf(status) > statusPriority.indexOf(current)) {
        key.dataset.state = status;
        key.classList.remove(...Object.values(Status));
        key.classList.add(status);
      }
    }
  }

  function renderBoard() {
    state.board.forEach((row, r) => {
      const rowEl = dom.board.children[r];
      row.forEach((letter, c) => {
        const tile = rowEl.children[c];
        const span = tile.querySelector(".letter");
        span.textContent = letter;
        tile.className = "tile" + (letter ? " filled" : "");
        if (state.evaluations[r]) {
          tile.classList.add(state.evaluations[r][c]);
        }
      });
    });
  }

  function renderKeyboard() {
    dom.keyboard.querySelectorAll(".key").forEach((k) => {
      k.classList.remove(...Object.values(Status));
      k.removeAttribute("data-state");
    });
    state.board.slice(0, state.rowIndex).forEach((row, idx) => {
      if (state.evaluations[idx]) updateKeyboardColors(row.join(""), state.evaluations[idx]);
    });
  }

  function animateReveal(rowIndex, evaluation) {
    const row = dom.board.children[rowIndex];
    row.querySelectorAll(".tile").forEach((tile, idx) => {
      setTimeout(() => {
        tile.classList.add("flip");
        tile.addEventListener(
          "animationend",
          () => {
            tile.classList.add(evaluation[idx]);
          },
          { once: true }
        );
      }, idx * 250);
    });
  }

  function shakeRow(rowIndex) {
    const row = dom.board.children[rowIndex];
    row.classList.add("shake");
    row.addEventListener(
      "animationend",
      () => {
        row.classList.remove("shake");
      },
      { once: true }
    );
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    dom.toast.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  function openModal(modal) {
    modal.classList.add("open");
  }

  function closeModal(modal) {
    modal.classList.remove("open");
  }

  function updateStats(won, guessCount = 0) {
    stats.played += 1;
    if (won) {
      stats.wins += 1;
      stats.streak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      if (guessCount >= 1 && guessCount <= 6) {
        stats.distribution[guessCount - 1] += 1;
      }
    } else {
      stats.streak = 0;
    }
    saveStats();
    updateStatsUI();
  }

  function updateStatsUI() {
    dom.statPlayed.textContent = stats.played;
    dom.statWinrate.textContent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    dom.statStreak.textContent = stats.streak;
    dom.statMaxStreak.textContent = stats.maxStreak;

    dom.distribution.innerHTML = "";
    const max = Math.max(...stats.distribution, 1);
    stats.distribution.forEach((count, idx) => {
      const row = document.createElement("div");
      row.className = "distribution-row";
      row.innerHTML = `<div>${idx + 1}</div>`;
      const bar = document.createElement("div");
      bar.className = "distribution-bar";
      const span = document.createElement("span");
      const width = Math.max(8, (count / max) * 100);
      span.style.width = `${width}%`;
      span.textContent = count;
      bar.appendChild(span);
      row.appendChild(bar);
      dom.distribution.appendChild(row);
    });
  }

  function shareResult() {
    if (state.gameStatus === "playing") {
      return showToast("Dohrajte hru pro sdílení");
    }
    const isPractice = state.mode === "practice";
    const header = isPractice
      ? `Wordle CZ Practice ${state.gameStatus === "won" ? state.rowIndex + 1 : "X"}/${BOARD_ROWS}`
      : `Wordle CZ ${getDayIndex(new Date())} ${state.gameStatus === "won" ? state.rowIndex + 1 : "X"}/${BOARD_ROWS}`;
    const grid = state.evaluations
      .map((evalRow, idx) => {
        if (!evalRow) return "";
        return evalRow
          .map((s) => {
            if (s === Status.EXACT) return "🟩";
            if (s === Status.PRESENT) return "🟨";
            if (s === Status.BASE) return "🟪";
            return "⬛";
          })
          .join("");
      })
      .join("\n");
    const text = `${header}\n${grid}`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        dom.shareResult.textContent = "Zkopírováno!";
        setTimeout(() => (dom.shareResult.textContent = ""), 1500);
      })
      .catch(() => showToast("Nepodařilo se kopírovat"));
  }

  function handleAdminSubmit() {
    const pwd = dom.adminPassword.value;
    if (pwd !== PASSWORD) {
      return showToast("Nesprávné heslo");
    }
    const word = dom.adminWord.value.trim().toUpperCase();
    if (word.length !== BOARD_COLS) {
      return showToast("Slovo musí mít 5 písmen");
    }
    if (!isValidWord(word)) {
      return showToast("Slovo není povoleno");
    }
    const key = getTodayKey();
    const overrides = loadOverrides();
    overrides[key] = word;
    saveOverrides(overrides);
    if (state.mode === "daily") {
      resetState(word, key, "daily");
      renderBoard();
      renderKeyboard();
    }
    showToast("Denní slovo aktualizováno");
    dom.adminPassword.value = "";
    dom.adminWord.value = "";
  }

  function handleAdminReset() {
    const pwd = dom.adminPassword.value;
    if (pwd !== PASSWORD) {
      return showToast("Nesprávné heslo");
    }
    const key = getTodayKey();
    const overrides = loadOverrides();
    delete overrides[key];
    saveOverrides(overrides);
    const official = pickSolution();
    if (state.mode === "daily") {
      resetState(official.word, official.dateKey, "daily");
      renderBoard();
      renderKeyboard();
    }
    showToast("Oficiální slovo obnoveno");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW failed", err));
    }
  }

  window.addEventListener("load", () => init());
})();
