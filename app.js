/* =========================================================
   ANNA CLARA 4.0 — Núcleo Funcional, Persistência & PWA
   ========================================================= */

const STORAGE_PREFIX = "ac_v4_";

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("Erro ao ler storage:", key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Erro ao salvar storage:", key, e);
      showToast("Erro ao salvar dados no aparelho.");
      return false;
    }
  }
};

// Migração automática de dados da v3 (se existirem)
function migrateFromV3() {
  if (store.get("migrated_v3", false)) return;
  try {
    const oldTasks = JSON.parse(localStorage.getItem("ac_tasks") || "null");
    if (Array.isArray(oldTasks) && oldTasks.length && !store.get("tasks", []).length) {
      store.set("tasks", oldTasks.map(t => ({ ...t, tag: t.tag || "Pessoal" })));
    }
    const oldHabits = JSON.parse(localStorage.getItem("ac_habits") || "null");
    if (Array.isArray(oldHabits) && oldHabits.length && !store.get("habits", []).length) {
      store.set("habits", oldHabits);
    }
    const oldJournal = JSON.parse(localStorage.getItem("ac_journal") || "null");
    if (Array.isArray(oldJournal) && oldJournal.length && !store.get("journal", []).length) {
      store.set("journal", oldJournal.map((j, i) => ({
        id: Date.now() + i,
        title: "Anotação anterior",
        text: j.text,
        date: j.date
      })));
    }
    const oldPrayer = JSON.parse(localStorage.getItem("ac_prayer") || "null");
    if (typeof oldPrayer === "string" && oldPrayer.trim() && !store.get("prayers", []).length) {
      store.set("prayers", [{
        id: Date.now(),
        title: "Minha oração",
        text: oldPrayer.trim(),
        date: new Date().toLocaleDateString("pt-BR")
      }]);
    }
    store.set("migrated_v3", true);
  } catch (_) {}
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* =========================================================
   1. NAVEGAÇÃO ENTRE TELAS
   ========================================================= */
function go(screenId) {
  const target = document.getElementById(screenId);
  if (!target) return;
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === screenId));
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.screen === screenId));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (screenId === "home") updateHomeDashboard();
}

$$("[data-screen]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.screen)));
$$("[data-go]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.go)));

/* =========================================================
   2. VERSÍCULOS DO DIA
   ========================================================= */
const verses = [
  ["Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", "Salmos 37:5"],
  ["O Senhor é a minha força e o meu escudo; nele confiou o meu coração.", "Salmos 28:7"],
  ["Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus.", "Isaías 41:10"],
  ["Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", "1 Pedro 5:7"],
  ["Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.", "Eclesiastes 3:1"],
  ["O Senhor é o meu pastor; nada me faltará.", "Salmos 23:1"],
  ["Aquietai-vos e sabei que eu sou Deus.", "Salmos 46:10"],
  ["Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", "Mateus 11:28"],
  ["O coração alegre aformoseia o rosto.", "Provérbios 15:13"],
  ["Posso todas as coisas naquele que me fortalece.", "Filipenses 4:13"]
];

let verseIndex = store.get("verseIndex", 0);

function renderVerse() {
  const v = verses[verseIndex % verses.length];
  $("#verseText").textContent = `“${v[0]}”`;
  $("#verseRef").textContent = v[1];
  $("#faithVerseText").textContent = `“${v[0]}”`;
  $("#faithVerseRef").textContent = v[1];
}

function nextVerse() {
  verseIndex = (verseIndex + 1) % verses.length;
  store.set("verseIndex", verseIndex);
  renderVerse();
}

$("#newVerse").addEventListener("click", nextVerse);
$("#faithNewVerse").addEventListener("click", nextVerse);

/* =========================================================
   3. ROTINA ESCOLAR & PERSONALIZAÇÃO
   Regras obrigatórias:
   - Seg (1), Ter (2), Qui (4): saída 06:50, retorno 18:40 (Priorizar descanso)
   - Qua (3), Sex (5): saída 06:50, retorno 12:40
   ========================================================= */
const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const BASE_SCHEDULES = {
  integral: [
    { time: "06:00–06:50", title: "Despertar e preparar-se", desc: "Higiene, café da manhã nutritivo e conferir mochila.", type: "normal" },
    { time: "06:50–18:40", title: "Escola e deslocamento (Integral)", desc: "Aulas, almoço na escola e pausas entre turnos.", type: "school" },
    { time: "18:40–19:30", title: "Chegada e descanso obrigatório", desc: "Banho relaxante, jantar leve e desconexão sem cobranças.", type: "rest" },
    { time: "19:30–20:10", title: "Revisão rápida (apenas se houver energia)", desc: "Organizar o essencial para amanhã. Se estiver exausta, descanse.", type: "rest" },
    { time: "20:10–20:40", title: "Tempo livre e autocuidado", desc: "Música, leitura leve ou conversa tranquila.", type: "normal" },
    { time: "20:40–21:20", title: "Desacelerar e oração", desc: "Agradecer pelo dia e preparar o ambiente para dormir.", type: "rest" }
  ],
  parcial: [
    { time: "06:00–06:50", title: "Despertar e preparar-se", desc: "Higiene, café da manhã e saída para a escola.", type: "normal" },
    { time: "06:50–12:40", title: "Escola e retorno para casa", desc: "Aulas da manhã e trajeto de volta.", type: "school" },
    { time: "12:40–13:45", title: "Almoço e descanso pós-aula", desc: "Comer com calma e tirar um tempo para recarregar.", type: "rest" },
    { time: "13:45–15:15", title: "Bloco de estudos e tarefas", desc: "Fazer deveres e revisar matérias enquanto a mente está descansada.", type: "normal" },
    { time: "15:15–16:00", title: "Lanche e pausa", desc: "Hidratar-se e descansar os olhos das telas.", type: "rest" },
    { time: "16:00–19:30", title: "Tempo pessoal e hobbies", desc: "Lazer, exercícios leves, família ou projetos pessoais.", type: "normal" },
    { time: "20:40–21:20", title: "Desacelerar e oração", desc: "Preparar-se para uma boa noite de sono.", type: "rest" }
  ],
  weekend: [
    { time: "08:30–09:30", title: "Acordar sem pressa", desc: "Café da manhã tranquilo e devocional.", type: "rest" },
    { time: "10:00–12:00", title: "Organização leve da semana", desc: "Arrumar o quarto, mochila e revisar metas.", type: "normal" },
    { time: "14:00–18:00", title: "Lazer, descanso e família", desc: "Aproveitar o tempo livre para renovar as energias.", type: "rest" },
    { time: "21:00–22:00", title: "Preparar o sono", desc: "Separar roupas e materiais de segunda-feira.", type: "normal" }
  ]
};

let customBlocks = store.get("customRoutineBlocks", { integral: [], parcial: [], weekend: [] });
let selectedRoutineDay = new Date().getDay();

function getDayCategory(dayIndex) {
  if ([1, 2, 4].includes(dayIndex)) return "integral";
  if ([3, 5].includes(dayIndex)) return "parcial";
  return "weekend";
}

function getFullScheduleForDay(dayIndex) {
  const cat = getDayCategory(dayIndex);
  const base = BASE_SCHEDULES[cat].map((item, idx) => ({ ...item, custom: false, idx }));
  const extras = (customBlocks[cat] || []).map((item, idx) => ({ ...item, custom: true, idx }));
  return [...base, ...extras].sort((a, b) => a.time.localeCompare(b.time));
}

function renderRoutineScreen() {
  const todayIdx = new Date().getDay();
  $$("#weekSelector .day-pill").forEach((btn) => {
    const d = Number(btn.dataset.day);
    btn.classList.toggle("active", d === selectedRoutineDay);
    btn.classList.toggle("today-mark", d === todayIdx);
  });

  const cat = getDayCategory(selectedRoutineDay);
  $("#routineDayHeading").textContent = DAY_NAMES[selectedRoutineDay];

  if (cat === "integral") {
    $("#routineDayTypeBadge").textContent = "DIA INTEGRAL · PRIORIDADE DESCANSO";
    $("#routineSchoolHours").textContent = "Saída 06:50 · Volta 18:40";
    $("#routineDayNote").textContent = "Dia longo fora de casa. A noite foi desenhada para você descansar e se recuperar sem sobrecarga.";
  } else if (cat === "parcial") {
    $("#routineDayTypeBadge").textContent = "DIA PARCIAL · TARDE LIVRE";
    $("#routineSchoolHours").textContent = "Saída 06:50 · Volta 12:40";
    $("#routineDayNote").textContent = "Retorno ao meio-dia. Aproveite a tarde equilibrando descanso e estudos leves.";
  } else {
    $("#routineDayTypeBadge").textContent = "FIM DE SEMANA";
    $("#routineSchoolHours").textContent = "Sem aula";
    $("#routineDayNote").textContent = "Tempo para descansar, estar com quem você ama e organizar a semana com leveza.";
  }

  const list = $("#scheduleList");
  list.innerHTML = "";
  const items = getFullScheduleForDay(selectedRoutineDay);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "schedule-row" + (item.type === "school" ? " school-time" : item.type === "rest" ? " rest-priority" : "");
    row.innerHTML = `
      <time>${item.time}</time>
      <div style="flex:1">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.desc || "Atividade personalizada")}</small>
      </div>
    `;
    if (item.custom) {
      const del = document.createElement("button");
      del.className = "mini-btn del";
      del.type = "button";
      del.title = "Remover bloco";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        customBlocks[cat].splice(item.idx, 1);
        store.set("customRoutineBlocks", customBlocks);
        renderRoutineScreen();
        showToast("Bloco removido da rotina.");
      });
      row.appendChild(del);
    }
    list.appendChild(row);
  });
}

$$("#weekSelector .day-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRoutineDay = Number(btn.dataset.day);
    renderRoutineScreen();
  });
});

$("#customRoutineForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const time = $("#routineBlockTime").value;
  const title = $("#routineBlockTitle").value.trim();
  if (!time || !title) return;
  const cat = getDayCategory(selectedRoutineDay);
  customBlocks[cat] = customBlocks[cat] || [];
  customBlocks[cat].push({ time, title, desc: "Adicionado por você", type: "normal" });
  store.set("customRoutineBlocks", customBlocks);
  $("#routineBlockTitle").value = "";
  renderRoutineScreen();
  showToast("Atividade adicionada à rotina!");
});

/* =========================================================
   4. TAREFAS (CRIAR, CONCLUIR, EDITAR, EXCLUIR)
   ========================================================= */
let tasks = store.get("tasks", [
  { id: 1, text: "Separar materiais da escola para amanhã", tag: "Escola", done: false },
  { id: 2, text: "Beber água e fazer uma pausa de 10 min", tag: "Pessoal", done: false }
]);
let taskFilter = "all";

function saveTasks() {
  store.set("tasks", tasks);
  renderTasks();
  updateHomeDashboard();
}

function renderTasks() {
  const list = $("#taskList");
  list.innerHTML = "";
  const filtered = tasks.filter((t) =>
    taskFilter === "all" ? true : taskFilter === "open" ? !t.done : t.done
  );

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Nenhuma tarefa nesta aba. Aproveite seu momento!</div>';
  } else {
    filtered.forEach((t) => {
      const row = document.createElement("div");
      row.className = "task-item" + (t.done ? " done" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = t.done;
      cb.setAttribute("aria-label", "Concluir tarefa");
      cb.addEventListener("change", () => {
        t.done = cb.checked;
        saveTasks();
      });

      const content = document.createElement("div");
      content.className = "task-content";
      content.innerHTML = `<span class="task-text">${escapeHtml(t.text)}</span><span class="task-tag">${escapeHtml(t.tag || "Geral")}</span>`;

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "mini-btn";
      editBtn.title = "Editar tarefa";
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", () => {
        const updated = prompt("Editar tarefa:", t.text);
        if (updated !== null && updated.trim()) {
          t.text = updated.trim();
          saveTasks();
          showToast("Tarefa atualizada.");
        }
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "mini-btn del";
      delBtn.title = "Excluir tarefa";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        tasks = tasks.filter((x) => x.id !== t.id);
        saveTasks();
        showToast("Tarefa removida.");
      });

      actions.append(editBtn, delBtn);
      row.append(cb, content, actions);
      list.appendChild(row);
    });
  }

  const pending = tasks.filter((t) => !t.done).length;
  $("#taskSummary").textContent = pending
    ? `${pending} ${pending === 1 ? "pendente" : "pendentes"}`
    : "Tudo concluído!";
}

$("#taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#taskInput").value.trim();
  const tag = $("#taskTag").value;
  if (!text) return;
  tasks.unshift({ id: Date.now(), text, tag, done: false });
  $("#taskInput").value = "";
  saveTasks();
  showToast("Tarefa criada!");
});

$$(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    taskFilter = btn.dataset.filter;
    $$(".filter").forEach((b) => b.classList.toggle("active", b === btn));
    renderTasks();
  });
});

/* =========================================================
   5. HÁBITOS (CRIAR, MARCAR HOJE, EDITAR, EXCLUIR)
   ========================================================= */
let habits = store.get("habits", [
  "Beber 2 litros de água",
  "Fazer uma pausa sem celular",
  "Organizar a mochila antes de dormir",
  "Momento de oração e gratidão"
]);

let habitLog = store.get("habitLog", { date: todayKey(), completed: [] });
if (habitLog.date !== todayKey()) {
  habitLog = { date: todayKey(), completed: [] };
  store.set("habitLog", habitLog);
}

function saveHabits() {
  store.set("habits", habits);
  store.set("habitLog", habitLog);
  renderHabits();
  updateHomeDashboard();
}

function renderHabits() {
  const list = $("#habitList");
  list.innerHTML = "";

  if (!habits.length) {
    list.innerHTML = '<div class="empty-state">Adicione hábitos simples para cultivar no dia a dia.</div>';
  }

  habits.forEach((habit, idx) => {
    const isChecked = habitLog.completed.includes(idx);
    const row = document.createElement("div");
    row.className = "habit-row" + (isChecked ? " checked" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isChecked;
    cb.addEventListener("change", () => {
      if (cb.checked) {
        if (!habitLog.completed.includes(idx)) habitLog.completed.push(idx);
      } else {
        habitLog.completed = habitLog.completed.filter((i) => i !== idx);
      }
      saveHabits();
    });

    const label = document.createElement("span");
    label.textContent = habit;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "mini-btn";
    editBtn.title = "Editar hábito";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => {
      const novo = prompt("Editar hábito:", habit);
      if (novo !== null && novo.trim()) {
        habits[idx] = novo.trim();
        saveHabits();
        showToast("Hábito atualizado.");
      }
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "mini-btn del";
    delBtn.title = "Excluir hábito";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      habits.splice(idx, 1);
      habitLog.completed = habitLog.completed
        .filter((i) => i !== idx)
        .map((i) => (i > idx ? i - 1 : i));
      saveHabits();
      showToast("Hábito excluído.");
    });

    actions.append(editBtn, delBtn);
    row.append(cb, label, actions);
    list.appendChild(row);
  });

  $("#habitProgressLabel").textContent = `${habitLog.completed.length}/${habits.length} hoje`;
}

$("#habitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = $("#habitInput").value.trim();
  if (!val) return;
  habits.push(val);
  $("#habitInput").value = "";
  saveHabits();
  showToast("Hábito adicionado!");
});

/* =========================================================
   6. RESPIRAÇÃO GUIADA COM TEMPORIZADOR
   ========================================================= */
let breathRunning = false;
let breathSecondTimer = null;
let breathSecondsLeft = 60;

function formatSeconds(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function stopBreathing(completed = false) {
  breathRunning = false;
  clearInterval(breathSecondTimer);
  const orb = $("#breathOrb");
  orb.className = "breath-orb";
  $("#breathWord").textContent = completed ? "Concluído" : "Pronta";
  $("#breathTimerDisplay").textContent = formatSeconds(Number($("#breathDuration").value));
  $("#breathHint").textContent = completed
    ? "Ótimo trabalho. Sinta a calma no seu corpo."
    : "Inspire por 4s, segure por 4s e expire suavemente por 4s.";
  $("#breathButton").textContent = "Iniciar pausa";
}

$("#breathDuration").addEventListener("change", () => {
  if (!breathRunning) {
    $("#breathTimerDisplay").textContent = formatSeconds(Number($("#breathDuration").value));
  }
});

$("#breathButton").addEventListener("click", () => {
  if (breathRunning) {
    stopBreathing(false);
    return;
  }

  breathRunning = true;
  breathSecondsLeft = Number($("#breathDuration").value);
  $("#breathButton").textContent = "Parar exercício";
  const orb = $("#breathOrb");

  const updatePhase = (elapsed) => {
    const cyclePos = elapsed % 12; // 4s inspire, 4s segure, 4s expire
    orb.classList.remove("inhale", "hold", "exhale");
    if (cyclePos < 4) {
      $("#breathWord").textContent = "Inspire...";
      $("#breathHint").textContent = "Puxe o ar devagar pelo nariz (4s)";
      orb.classList.add("inhale");
    } else if (cyclePos < 8) {
      $("#breathWord").textContent = "Segure...";
      $("#breathHint").textContent = "Mantenha o ar suavemente (4s)";
      orb.classList.add("hold");
    } else {
      $("#breathWord").textContent = "Expire...";
      $("#breathHint").textContent = "Solte o ar pela boca bem devagar (4s)";
      orb.classList.add("exhale");
    }
  };

  let elapsed = 0;
  updatePhase(0);
  $("#breathTimerDisplay").textContent = formatSeconds(breathSecondsLeft);

  breathSecondTimer = setInterval(() => {
    breathSecondsLeft--;
    elapsed++;
    if (breathSecondsLeft <= 0) {
      stopBreathing(true);
      showToast("Pausa de respiração concluída!");
      return;
    }
    $("#breathTimerDisplay").textContent = formatSeconds(breathSecondsLeft);
    updatePhase(elapsed);
  }, 1000);
});

/* =========================================================
   7. HUMOR & HISTÓRICO
   ========================================================= */
let selectedMood = null;
let moodHistory = store.get("moodHistory", []);

$$("#moodGrid button").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("#moodGrid button").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMood = { label: btn.dataset.mood, emoji: btn.dataset.emoji };
    $("#moodStatus").textContent = `Selecionado: ${selectedMood.emoji} ${selectedMood.label}. Toque em Registrar para salvar.`;
  });
});

function renderMoodHistory() {
  const list = $("#moodHistoryList");
  list.innerHTML = "";
  if (!moodHistory.length) {
    list.innerHTML = '<div class="empty-state">Nenhum registro de humor ainda.</div>';
    return;
  }

  moodHistory.slice().reverse().forEach((item, revIdx) => {
    const realIdx = moodHistory.length - 1 - revIdx;
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `
      <div>
        <strong>${item.emoji} ${escapeHtml(item.mood)}</strong>
        ${item.note ? `<span style="color:var(--muted)"> — ${escapeHtml(item.note)}</span>` : ""}
        <small style="display:block;font-size:11px;color:var(--muted)">${item.date}</small>
      </div>
    `;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-btn del";
    del.textContent = "✕";
    del.title = "Apagar registro";
    del.addEventListener("click", () => {
      moodHistory.splice(realIdx, 1);
      store.set("moodHistory", moodHistory);
      renderMoodHistory();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

$("#saveMoodBtn").addEventListener("click", () => {
  if (!selectedMood) {
    showToast("Escolha um sentimento primeiro.");
    return;
  }
  const note = $("#moodNoteInput").value.trim();
  const nowStr = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  moodHistory.push({
    mood: selectedMood.label,
    emoji: selectedMood.emoji,
    note,
    date: nowStr
  });
  store.set("moodHistory", moodHistory);
  $("#moodNoteInput").value = "";
  $("#moodStatus").textContent = `Registrado: ${selectedMood.emoji} ${selectedMood.label} (${nowStr}).`;
  renderMoodHistory();
  showToast("Humor salvo no histórico!");
});

$("#clearMoodHistory").addEventListener("click", () => {
  if (!moodHistory.length) return;
  if (confirm("Deseja limpar todo o histórico de humor?")) {
    moodHistory = [];
    store.set("moodHistory", moodHistory);
    renderMoodHistory();
    showToast("Histórico de humor limpo.");
  }
});

/* =========================================================
   8. FÉ E ANOTAÇÕES DE ORAÇÃO (CRUD COMPLETO)
   ========================================================= */
let prayers = store.get("prayers", []);
let editingPrayerId = null;

function renderPrayers() {
  const list = $("#prayerList");
  list.innerHTML = "";
  if (!prayers.length) {
    list.innerHTML = '<div class="empty-state">Suas orações e agradecimentos aparecerão aqui.</div>';
    return;
  }

  prayers.slice().reverse().forEach((item) => {
    const card = document.createElement("article");
    card.className = "journal-entry";
    card.innerHTML = `
      <div class="journal-entry-header">
        <div>
          <time>${escapeHtml(item.date)}</time>
          <h4>${escapeHtml(item.title || "Oração pessoal")}</h4>
        </div>
        <div class="item-actions">
          <button type="button" class="mini-btn edit-p" title="Editar">✎</button>
          <button type="button" class="mini-btn del del-p" title="Excluir">✕</button>
        </div>
      </div>
      <p>${escapeHtml(item.text)}</p>
    `;

    card.querySelector(".edit-p").addEventListener("click", () => {
      editingPrayerId = item.id;
      $("#prayerFormTitle").textContent = "Editando oração";
      $("#prayerTitleInput").value = item.title || "";
      $("#prayerInput").value = item.text;
      $("#savePrayer").textContent = "Atualizar oração";
      $("#cancelEditPrayer").hidden = false;
      $("#prayerInput").focus();
    });

    card.querySelector(".del-p").addEventListener("click", () => {
      prayers = prayers.filter((p) => p.id !== item.id);
      store.set("prayers", prayers);
      renderPrayers();
      showToast("Oração removida.");
    });

    list.appendChild(card);
  });
}

function resetPrayerForm() {
  editingPrayerId = null;
  $("#prayerFormTitle").textContent = "Nova anotação de oração";
  $("#prayerTitleInput").value = "";
  $("#prayerInput").value = "";
  $("#savePrayer").textContent = "Salvar oração";
  $("#cancelEditPrayer").hidden = true;
}

$("#cancelEditPrayer").addEventListener("click", resetPrayerForm);

$("#savePrayer").addEventListener("click", () => {
  const title = $("#prayerTitleInput").value.trim() || "Oração do dia";
  const text = $("#prayerInput").value.trim();
  if (!text) {
    showToast("Escreva sua oração antes de salvar.");
    return;
  }

  if (editingPrayerId !== null) {
    const target = prayers.find((p) => p.id === editingPrayerId);
    if (target) {
      target.title = title;
      target.text = text;
    }
    showToast("Oração atualizada!");
  } else {
    prayers.push({
      id: Date.now(),
      title,
      text,
      date: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    });
    showToast("Oração salva!");
  }

  store.set("prayers", prayers);
  resetPrayerForm();
  renderPrayers();
});

/* =========================================================
   9. DIÁRIO PESSOAL (CRUD COMPLETO)
   ========================================================= */
let journalEntries = store.get("journal", []);
let editingJournalId = null;

function renderJournal() {
  const box = $("#journalEntries");
  box.innerHTML = "";
  if (!journalEntries.length) {
    box.innerHTML = '<div class="empty-state">Nenhuma página escrita ainda. Comece quando quiser.</div>';
    return;
  }

  journalEntries.slice().reverse().forEach((entry) => {
    const card = document.createElement("article");
    card.className = "journal-entry";
    card.innerHTML = `
      <div class="journal-entry-header">
        <div>
          <time>${escapeHtml(entry.date)}</time>
          <h4>${escapeHtml(entry.title || "Página do diário")}</h4>
        </div>
        <div class="item-actions">
          <button type="button" class="mini-btn edit-j" title="Editar">✎</button>
          <button type="button" class="mini-btn del del-j" title="Excluir">✕</button>
        </div>
      </div>
      <p>${escapeHtml(entry.text)}</p>
    `;

    card.querySelector(".edit-j").addEventListener("click", () => {
      editingJournalId = entry.id;
      $("#journalFormTitle").textContent = "Editando página do diário";
      $("#journalTitleInput").value = entry.title || "";
      $("#journalInput").value = entry.text;
      $("#saveJournal").textContent = "Atualizar página";
      $("#cancelEditJournal").hidden = false;
      $("#journalInput").focus();
    });

    card.querySelector(".del-j").addEventListener("click", () => {
      journalEntries = journalEntries.filter((j) => j.id !== entry.id);
      store.set("journal", journalEntries);
      renderJournal();
      showToast("Página excluída do diário.");
    });

    box.appendChild(card);
  });
}

function resetJournalForm() {
  editingJournalId = null;
  $("#journalFormTitle").textContent = "Nova página no diário";
  $("#journalTitleInput").value = "";
  $("#journalInput").value = "";
  $("#saveJournal").textContent = "Guardar página";
  $("#cancelEditJournal").hidden = true;
}

$("#cancelEditJournal").addEventListener("click", resetJournalForm);

$("#saveJournal").addEventListener("click", () => {
  const title = $("#journalTitleInput").value.trim() || "Meu dia";
  const text = $("#journalInput").value.trim();
  if (!text) {
    showToast("Escreva algo antes de guardar.");
    return;
  }

  if (editingJournalId !== null) {
    const target = journalEntries.find((j) => j.id === editingJournalId);
    if (target) {
      target.title = title;
      target.text = text;
    }
    showToast("Página atualizada!");
  } else {
    journalEntries.push({
      id: Date.now(),
      title,
      text,
      date: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    });
    showToast("Página guardada no diário!");
  }

  store.set("journal", journalEntries);
  resetJournalForm();
  renderJournal();
});

/* =========================================================
   10. DASHBOARD INICIAL (SAUDAÇÃO, RESUMO ROTINA, PROGRESSO)
   ========================================================= */
function updateHomeDashboard() {
  const now = new Date();
  const hour = now.getHours();
  const dayIdx = now.getDay();

  // Saudação contextual
  let greet = "Olá, Anna Clara";
  if (hour >= 5 && hour < 12) greet = "Bom dia, Anna Clara";
  else if (hour >= 12 && hour < 18) greet = "Boa tarde, Anna Clara";
  else greet = "Boa noite, Anna Clara";

  $("#greetingHeading").innerHTML = `${greet}<span class="period">.</span>`;
  $("#todayLabel").textContent = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).toUpperCase();

  // Resumo da rotina escolar de hoje
  const cat = getDayCategory(dayIdx);
  if (cat === "integral") {
    $("#homeScheduleBadge").textContent = "HOJE · DIA INTEGRAL";
    $("#homeScheduleTitle").textContent = "Escola das 06:50 às 18:40";
    $("#homeScheduleDesc").textContent = "Hoje o dia é puxado. Ao chegar às 18:40, sua prioridade é descansar e se cuidar.";
    $("#homeNextActivity").innerHTML = "<strong>Foco da noite:</strong> Banho, jantar leve e desacelerar sem culpa.";
  } else if (cat === "parcial") {
    $("#homeScheduleBadge").textContent = "HOJE · RETORNO ÀS 12:40";
    $("#homeScheduleTitle").textContent = "Escola até 12:40 · Tarde livre";
    $("#homeScheduleDesc").textContent = "Você volta para casa no almoço. Dá tempo de descansar e estudar com calma.";
    $("#homeNextActivity").innerHTML = "<strong>Sugestão da tarde:</strong> Almoço, pausa até 13:45 e estudos leves.";
  } else {
    $("#homeScheduleBadge").textContent = "FIM DE SEMANA";
    $("#homeScheduleTitle").textContent = "Dia livre para descansar";
    $("#homeScheduleDesc").textContent = "Aproveite para renovar as energias e organizar sua semana com tranquilidade.";
    $("#homeNextActivity").innerHTML = "<strong>Lembrete:</strong> Descanse a mente e faça algo que você gosta.";
  }

  // Cálculo unificado de progresso (Tarefas + Hábitos)
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const totalHabits = habits.length;
  const doneHabits = habitLog.completed.length;

  const totalItems = totalTasks + totalHabits;
  const doneItems = doneTasks + doneHabits;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  $("#homeProgressPercent").textContent = `${pct}%`;
  $("#homeProgressBar").style.width = `${pct}%`;
  $("#homeProgressBarWrap").setAttribute("aria-valuenow", String(pct));
  $("#homeTaskCount").textContent = `${doneTasks} de ${totalTasks} tarefas`;
  $("#homeHabitCount").textContent = `${doneHabits} de ${totalHabits} hábitos`;
}

/* =========================================================
   11. LEMBRETES, NOTIFICAÇÕES E BACKUP/RESTAURAÇÃO
   ========================================================= */
let reminderConfig = store.get("reminders", {
  sleepTime: "20:40",
  schoolReminder: true,
  lastFiredMinute: ""
});

$("#sleepTime").value = reminderConfig.sleepTime || "20:40";
$("#schoolReminderToggle").checked = Boolean(reminderConfig.schoolReminder);

function updateNotifStatusLabel() {
  const el = $("#notifPermissionStatus");
  if (!("Notification" in window)) {
    el.textContent = "Status: Este navegador não suporta notificações do sistema.";
    return;
  }
  const map = {
    granted: "Status: Ativadas ✓",
    denied: "Status: Bloqueadas nas configurações do navegador",
    default: "Status: Aguardando permissão"
  };
  el.textContent = map[Notification.permission] || "Status: Desconhecido";
}

function sendAppNotification(title, body) {
  showToast(`${title}: ${body}`);
  if ("Notification" in window && Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: "icon.svg",
          badge: "icon.svg",
          vibrate: [150, 80, 150]
        });
      });
    } else {
      new Notification(title, { body, icon: "icon.svg" });
    }
  }
}

$("#requestNotifBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("Notificações não suportadas neste navegador.");
    return;
  }
  const res = await Notification.requestPermission();
  updateNotifStatusLabel();
  if (res === "granted") {
    sendAppNotification("Anna Clara", "Notificações ativadas com sucesso!");
  }
});

$("#saveReminderSettings").addEventListener("click", () => {
  reminderConfig.sleepTime = $("#sleepTime").value || "20:40";
  reminderConfig.schoolReminder = $("#schoolReminderToggle").checked;
  store.set("reminders", reminderConfig);
  showToast("Configurações de lembrete salvas!");
});

$("#testNotifBtn").addEventListener("click", () => {
  sendAppNotification("Lembrete gentil ✿", "Respire fundo. Você está indo muito bem hoje!");
});

// Verificador periódico a cada 30 segundos enquanto o app está ativo
setInterval(() => {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const minuteStamp = `${todayKey()}_${hhmm}`;
  if (reminderConfig.lastFiredMinute === minuteStamp) return;

  if (hhmm === reminderConfig.sleepTime) {
    reminderConfig.lastFiredMinute = minuteStamp;
    store.set("reminders", reminderConfig);
    sendAppNotification("Hora de desacelerar 🌙", "Que tal fazer sua oração e se preparar para dormir?");
  }

  if (reminderConfig.schoolReminder) {
    const d = now.getDay();
    if ([1, 2, 4].includes(d) && hhmm === "18:40") {
      reminderConfig.lastFiredMinute = minuteStamp;
      store.set("reminders", reminderConfig);
      sendAppNotification("Bem-vinda de volta! 🌷", "Dia integral concluído. Agora priorize seu descanso.");
    } else if ([3, 5].includes(d) && hhmm === "12:40") {
      reminderConfig.lastFiredMinute = minuteStamp;
      store.set("reminders", reminderConfig);
      sendAppNotification("Hora do almoço e descanso ☀️", "Bom retorno da escola! Aproveite sua pausa.");
    }
  }
}, 30000);

// Exportar Backup JSON
$("#exportBackupBtn").addEventListener("click", () => {
  const backupData = {
    app: "Anna Clara",
    version: "4.0",
    exportedAt: new Date().toISOString(),
    data: {
      tasks,
      habits,
      habitLog,
      moodHistory,
      prayers,
      journal: journalEntries,
      customRoutineBlocks: customBlocks,
      reminders: reminderConfig,
      verseIndex,
      dark: document.body.classList.contains("dark")
    }
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-anna-clara-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  $("#backupStatus").textContent = `Backup exportado em ${new Date().toLocaleTimeString("pt-BR")}.`;
  showToast("Arquivo de backup baixado!");
});

// Importar / Restaurar Backup JSON
$("#importBackupInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const d = parsed.data || parsed;
      if (!d || typeof d !== "object") throw new Error("Formato inválido");

      if (Array.isArray(d.tasks)) { tasks = d.tasks; store.set("tasks", tasks); }
      if (Array.isArray(d.habits)) { habits = d.habits; store.set("habits", habits); }
      if (d.habitLog) { habitLog = d.habitLog; store.set("habitLog", habitLog); }
      if (Array.isArray(d.moodHistory)) { moodHistory = d.moodHistory; store.set("moodHistory", moodHistory); }
      if (Array.isArray(d.prayers)) { prayers = d.prayers; store.set("prayers", prayers); }
      if (Array.isArray(d.journal)) { journalEntries = d.journal; store.set("journal", journalEntries); }
      if (d.customRoutineBlocks) { customBlocks = d.customRoutineBlocks; store.set("customRoutineBlocks", customBlocks); }
      if (d.reminders) {
        reminderConfig = d.reminders;
        store.set("reminders", reminderConfig);
        $("#sleepTime").value = reminderConfig.sleepTime || "20:40";
        $("#schoolReminderToggle").checked = Boolean(reminderConfig.schoolReminder);
      }

      renderTasks();
      renderHabits();
      renderMoodHistory();
      renderPrayers();
      renderJournal();
      renderRoutineScreen();
      updateHomeDashboard();

      $("#backupStatus").textContent = "Dados restaurados com sucesso!";
      showToast("Backup restaurado com sucesso!");
    } catch (err) {
      $("#backupStatus").textContent = "Erro: arquivo de backup inválido ou corrompido.";
      showToast("Não foi possível ler este backup.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

/* =========================================================
   12. TEMA ESCURO, INSTALAÇÃO PWA & STATUS OFFLINE
   ========================================================= */
$("#themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  store.set("dark", document.body.classList.contains("dark"));
});

if (store.get("dark", false)) {
  document.body.classList.add("dark");
}

function updateNetworkStatus() {
  $("#offlineBadge").textContent = navigator.onLine ? "PRONTO OFFLINE ✓" : "USANDO SEM INTERNET";
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $("#installBtn").hidden = false;
});

$("#installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === "accepted") {
    $("#installBtn").hidden = true;
    showToast("Aplicativo instalado!");
  }
  deferredInstallPrompt = null;
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =========================================================
   INICIALIZAÇÃO GERAL
   ========================================================= */
migrateFromV3();
renderVerse();
renderRoutineScreen();
renderTasks();
renderHabits();
renderMoodHistory();
renderPrayers();
renderJournal();
updateHomeDashboard();
updateNotifStatusLabel();
updateNetworkStatus();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
