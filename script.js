// Banque de questions pour "Questions pour un Champion"
const QUESTIONS_BANK = [
  {
    id: 1,
    manche: "9 Points Gagnants",
    theme: "Histoire",
    difficulte: "facile",
    question: "En quelle année a eu lieu la prise de la Bastille ?",
    options: ["1789", "1799", "1815", "1848"],
    correctIndex: 0
  },
  {
    id: 2,
    manche: "4 à la suite",
    theme: "Sciences",
    difficulte: "facile",
    question: "Quelle planète est surnommée la planète rouge ?",
    options: ["Vénus", "Mars", "Jupiter", "Saturne"],
    correctIndex: 1
  },
  {
    id: 3,
    manche: "9 Points Gagnants",
    theme: "Culture générale",
    difficulte: "standard",
    question: "Qui a écrit Les Misérables ?",
    options: ["Émile Zola", "Gustave Flaubert", "Victor Hugo", "Honoré de Balzac"],
    correctIndex: 2
  },
  {
    id: 4,
    manche: "Face-à-Face",
    theme: "Géographie",
    difficulte: "standard",
    question: "Quelle est la capitale du Japon ?",
    options: ["Kyoto", "Osaka", "Tokyo", "Sapporo"],
    correctIndex: 2
  },
  {
    id: 5,
    manche: "4 à la suite",
    theme: "Sciences",
    difficulte: "standard",
    question: "Quel est le symbole chimique de l'or ?",
    options: ["Ag", "Au", "Fe", "Pb"],
    correctIndex: 1
  },
  {
    id: 6,
    manche: "Face-à-Face",
    theme: "Histoire",
    difficulte: "expert",
    question: "Quel traité a mis fin à la Première Guerre mondiale en 1919 ?",
    options: ["Traité de Tordesillas", "Traité de Versailles", "Traité de Westphalie", "Traité de Rome"],
    correctIndex: 1
  },
  {
    id: 7,
    manche: "9 Points Gagnants",
    theme: "Géographie",
    difficulte: "facile",
    question: "Quel fleuve traverse Paris ?",
    options: ["La Loire", "Le Rhône", "La Seine", "La Garonne"],
    correctIndex: 2
  },
  {
    id: 8,
    manche: "4 à la suite",
    theme: "Culture générale",
    difficulte: "expert",
    question: "Combien de touches compte un piano standard ?",
    options: ["76", "82", "88", "92"],
    correctIndex: 2
  }
];

// ---------- Personnalisation (personnage + buzzer) ----------
const AVATARS = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🤖", "👽", "🧙", "🥷", "🦸", "👑"];
const BUZZER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];
const BUZZER_SHAPES = ["round", "square", "hexagon"];
const BUZZER_SOUNDS = {
  classique: { label: "Classique", notes: [[880, 0.15, "square"]] },
  laser:     { label: "Laser",     notes: [[1200, 0.08, "sawtooth"], [600, 0.08, "sawtooth"], [300, 0.12, "sawtooth"]] },
  cloche:    { label: "Cloche",    notes: [[1046, 0.3, "sine"], [1318, 0.35, "sine"]] },
  klaxon:    { label: "Klaxon",    notes: [[220, 0.25, "sawtooth"], [220, 0.25, "sawtooth"]] },
  muet:      { label: "Muet",      notes: [] }
};

const PROFILE_KEY = "qpc_profile";
const DEFAULT_PROFILE = {
  avatar: AVATARS[0],
  color: BUZZER_COLORS[0],
  shape: "round",
  sound: "classique"
};

// Valide un profil (local ou reçu d'un autre appareil) : uniquement des valeurs autorisées
function sanitizeProfile(p) {
  p = p || {};
  return {
    avatar: AVATARS.includes(p.avatar) ? p.avatar : DEFAULT_PROFILE.avatar,
    color: BUZZER_COLORS.includes(p.color) ? p.color : DEFAULT_PROFILE.color,
    shape: BUZZER_SHAPES.includes(p.shape) ? p.shape : DEFAULT_PROFILE.shape,
    sound: BUZZER_SOUNDS[p.sound] ? p.sound : DEFAULT_PROFILE.sound
  };
}

function loadProfile() {
  try {
    return sanitizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

let profile = loadProfile();

function applyBuzzerStyle(el, style) {
  el.style.setProperty("--bz-color", style.color);
  el.dataset.shape = style.shape;
}

let audioCtx = null;
function playBuzzSound(soundKey) {
  const sound = BUZZER_SOUNDS[soundKey];
  if (!sound || sound.notes.length === 0) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    let t = audioCtx.currentTime;
    sound.notes.forEach(([freq, dur, type]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  } catch {}
}

// Crée un <span> "avatar + nom" sans innerHTML (évite l'injection via le pseudo)
function buildPlayerLabel(player, suffix = "") {
  const span = document.createElement("span");
  const av = document.createElement("span");
  av.className = "avatar";
  av.textContent = player.avatar || "🙂";
  span.appendChild(av);
  span.appendChild(document.createTextNode(player.name + suffix));
  return span;
}

/**
 * Couche réseau du salon :
 * Synchronise plusieurs onglets d'un même navigateur via BroadcastChannel.
 * (Pour de vrais appareils séparés, remplacer par WebSocket / Firebase / Supabase Realtime.)
 */
const roomNetwork = {
  channel: null,
  roomCode: null,
  listener: null,

  connect(roomCode, onMessage) {
    this.disconnect();
    this.roomCode = roomCode;
    this.listener = onMessage;

    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(`qpc_buzzer_timer_room_${roomCode}`);
      this.channel.onmessage = (event) => {
        if (this.listener) {
          this.listener(event.data);
        }
      };
    }
  },

  send(message) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  },

  disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listener = null;
    this.roomCode = null;
  }
};

// Éléments du DOM
const roomStatusBar = document.getElementById("room-status-bar");
const headerRoomCodeEl = document.getElementById("header-room-code");

const connectScreen = document.getElementById("connect-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

const pseudoInput = document.getElementById("pseudo-input");
const createRoomBtn = document.getElementById("create-room-btn");
const joinCodeInput = document.getElementById("join-code-input");
const joinRoomBtn = document.getElementById("join-room-btn");
const connectError = document.getElementById("connect-error");

const avatarPicker = document.getElementById("avatar-picker");
const colorPicker = document.getElementById("buzzer-color-picker");
const shapeSelect = document.getElementById("buzzer-shape-select");
const soundSelect = document.getElementById("buzzer-sound-select");
const testSoundBtn = document.getElementById("test-sound-btn");
const buzzerPreview = document.getElementById("buzzer-preview");

const lobbyRoomCodeEl = document.getElementById("lobby-room-code");
const copyCodeBtn = document.getElementById("copy-code-btn");
const connectedCountEl = document.getElementById("connected-count");
const lobbyPlayersListEl = document.getElementById("lobby-players-list");
const hostOnlyNote = document.getElementById("host-only-note");
const settingsFields = document.getElementById("settings-fields");

const difficulteSelect = document.getElementById("difficulte");
const pointsInput = document.getElementById("points-bonne-reponse");
const penaltyInput = document.getElementById("penalite-mauvaise-reponse");
const timerDurationInput = document.getElementById("duree-minuteur");
const nbQuestionsInput = document.getElementById("nb-questions");
const manche9pgCheckbox = document.getElementById("manche-9pg");
const manche4sCheckbox = document.getElementById("manche-4s");
const mancheFafCheckbox = document.getElementById("manche-faf");
const themesGroup = document.getElementById("themes-group");
const lobbyError = document.getElementById("lobby-error");
const startBtn = document.getElementById("start-btn");
const leaveRoomBtn = document.getElementById("leave-room-btn");

const questionCounterEl = document.getElementById("question-counter");
const mancheBadgeEl = document.getElementById("manche-badge");
const themeBadgeEl = document.getElementById("theme-badge");
const buzzerStatusBadgeEl = document.getElementById("buzzer-status-badge");
const timerDisplayEl = document.getElementById("timer-display");
const timerFillEl = document.getElementById("timer-fill");
const questionTextEl = document.getElementById("question-text");

const buzzerZone = document.getElementById("buzzer-zone");
const buzzerBtn = document.getElementById("buzzer-btn");
const buzzerHintEl = document.getElementById("buzzer-hint");

const activeAnswerZone = document.getElementById("active-answer-zone");
const activeBuzzerBannerEl = document.getElementById("active-buzzer-banner");
const optionsContainer = document.getElementById("options-container");

const feedbackBox = document.getElementById("feedback-box");
const feedbackTextEl = document.getElementById("feedback-text");
const revealAnswerTextEl = document.getElementById("reveal-answer-text");

const leaderboardListEl = document.getElementById("leaderboard-list");
const nextBtn = document.getElementById("next-btn");
const leaveGameBtn = document.getElementById("leave-game-btn");

const winnerAnnouncementEl = document.getElementById("winner-announcement");
const finalLeaderboardListEl = document.getElementById("final-leaderboard-list");
const replayBtn = document.getElementById("replay-btn");
const backToLobbyBtn = document.getElementById("back-to-lobby-btn");

// Identité locale de cet appareil
const deviceId = `dev_${Math.random().toString(36).slice(2, 10)}`;

let localSession = {
  pseudo: "",
  roomCode: null,
  isHost: false
};

// Données envoyées aux autres joueurs
function myPlayerData(isHost) {
  return {
    id: deviceId,
    name: localSession.pseudo,
    score: 0,
    isHost,
    avatar: profile.avatar,
    buzzer: { color: profile.color, shape: profile.shape, sound: profile.sound }
  };
}

// État partagé du salon
let roomState = {
  phase: "lobby", // "lobby" | "playing" | "ended"
  players: [], // { id, name, score, isHost, avatar, buzzer }
  config: null,
  questions: [],
  currentQuestionIndex: 0,
  buzzedPlayerId: null,
  lockedPlayerIds: [],
  questionClosed: false,
  timerDurationSec: 15,
  timerEndsAt: null, // Timestamp ms côté hôte
  lastFeedback: null
};

let localTimerInterval = null;
let hostExpirationTimeout = null;
let lastBuzzedId = null;

function generateRoomCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `QPC-${num}`;
}

function getConfigFromForm() {
  const selectedManches = [];
  if (manche9pgCheckbox.checked) selectedManches.push("9 Points Gagnants");
  if (manche4sCheckbox.checked) selectedManches.push("4 à la suite");
  if (mancheFafCheckbox.checked) selectedManches.push("Face-à-Face");

  const selectedThemes = Array.from(
    themesGroup.querySelectorAll("input[type='checkbox']:checked")
  ).map((cb) => cb.value);

  return {
    difficulte: difficulteSelect.value,
    pointsPerCorrect: Math.max(1, Number(pointsInput.value) || 100),
    penaltyWrong: Math.max(0, Number(penaltyInput.value) || 0),
    timerDurationSec: Math.max(5, Math.min(120, Number(timerDurationInput.value) || 15)),
    nbQuestions: Math.max(1, Math.min(10, Number(nbQuestionsInput.value) || 4)),
    manches: selectedManches,
    themes: selectedThemes
  };
}

function applyConfigToForm(config) {
  if (!config) return;
  difficulteSelect.value = config.difficulte || "tous";
  pointsInput.value = config.pointsPerCorrect ?? 100;
  penaltyInput.value = config.penaltyWrong ?? 50;
  timerDurationInput.value = config.timerDurationSec ?? 15;
  nbQuestionsInput.value = config.nbQuestions || 4;
  manche9pgCheckbox.checked = config.manches.includes("9 Points Gagnants");
  manche4sCheckbox.checked = config.manches.includes("4 à la suite");
  mancheFafCheckbox.checked = config.manches.includes("Face-à-Face");

  themesGroup.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = config.themes.includes(cb.value);
  });
}

function setSettingsDisabled(disabled) {
  settingsFields.querySelectorAll("input, select").forEach((el) => {
    el.disabled = disabled;
  });
  startBtn.hidden = disabled;
  hostOnlyNote.hidden = !disabled;
}

function showScreen(screenName) {
  connectScreen.hidden = screenName !== "connect";
  lobbyScreen.hidden = screenName !== "lobby";
  gameScreen.hidden = screenName !== "game";
  endScreen.hidden = screenName !== "end";
}

function clearTimers() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval);
    localTimerInterval = null;
  }
  if (hostExpirationTimeout) {
    clearTimeout(hostExpirationTimeout);
    hostExpirationTimeout = null;
  }
}

function startQuestionTimerOnHost() {
  clearTimers();
  const durationSec = roomState.config?.timerDurationSec || 15;
  roomState.timerDurationSec = durationSec;
  roomState.timerEndsAt = Date.now() + durationSec * 1000;

  hostExpirationTimeout = setTimeout(() => {
    handleHostTimerExpired();
  }, durationSec * 1000);
}

function updateLocalTimerVisuals() {
  if (roomState.phase !== "playing" || !roomState.timerEndsAt) {
    timerDisplayEl.textContent = "0s";
    timerFillEl.style.width = "0%";
    timerDisplayEl.classList.remove("urgent");
    timerFillEl.classList.remove("urgent");
    return;
  }

  const remainingMs = Math.max(0, roomState.timerEndsAt - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  const totalMs = Math.max(1, (roomState.timerDurationSec || 15) * 1000);
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  timerDisplayEl.textContent = `${remainingSec}s`;
  timerFillEl.style.width = `${pct}%`;

  const isUrgent = remainingSec <= 5 && !roomState.questionClosed;
  timerDisplayEl.classList.toggle("urgent", isUrgent);
  timerFillEl.classList.toggle("urgent", isUrgent);
}

function startLocalTimerLoop() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval);
  }
  updateLocalTimerVisuals();
  localTimerInterval = setInterval(updateLocalTimerVisuals, 150);
}

function handleHostTimerExpired() {
  if (!localSession.isHost || roomState.phase !== "playing" || roomState.questionClosed) {
    return;
  }

  const question = roomState.questions[roomState.currentQuestionIndex];
  const correctLabel = question ? question.options[question.correctIndex] : "";

  roomState.buzzedPlayerId = null;
  roomState.questionClosed = true;
  roomState.timerEndsAt = Date.now();
  roomState.lastFeedback = {
    type: "error",
    message: "Temps écoulé ! Personne n'a validé de bonne réponse à temps.",
    correctAnswer: correctLabel ? `Bonne réponse : ${correctLabel}` : ""
  };

  syncRoomStateToAll();
}

function syncRoomStateToAll() {
  roomNetwork.send({
    type: "ROOM_STATE_SYNC",
    state: roomState
  });
  renderFromRoomState();
}

function buildQuestionDeck(config) {
  let pool = QUESTIONS_BANK.filter((q) => {
    const matchManche = config.manches.length === 0 || config.manches.includes(q.manche);
    const matchTheme = config.themes.length === 0 || config.themes.includes(q.theme);
    const matchDiff = config.difficulte === "tous" || q.difficulte === config.difficulte;
    return matchManche && matchTheme && matchDiff;
  });

  if (pool.length === 0) {
    pool = [...QUESTIONS_BANK];
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(config.nbQuestions, shuffled.length));
}

// Connexion au salon
function createRoom() {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    connectError.textContent = "Entre ton pseudo avant de créer un salon.";
    connectError.hidden = false;
    return;
  }

  connectError.hidden = true;
  const code = generateRoomCode();

  localSession = {
    pseudo,
    roomCode: code,
    isHost: true
  };

  roomState = {
    phase: "lobby",
    players: [myPlayerData(true)],
    config: getConfigFromForm(),
    questions: [],
    currentQuestionIndex: 0,
    buzzedPlayerId: null,
    lockedPlayerIds: [],
    questionClosed: false,
    timerDurationSec: Number(timerDurationInput.value) || 15,
    timerEndsAt: null,
    lastFeedback: null
  };

  lastBuzzedId = null;
  roomNetwork.connect(code, handleNetworkMessage);
  roomStatusBar.hidden = false;
  headerRoomCodeEl.textContent = code;
  lobbyRoomCodeEl.textContent = code;

  syncRoomStateToAll();
  showScreen("lobby");
}

function joinRoom() {
  const pseudo = pseudoInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();

  if (!pseudo) {
    connectError.textContent = "Entre ton pseudo avant de rejoindre un salon.";
    connectError.hidden = false;
    return;
  }

  if (!code) {
    connectError.textContent = "Entre le code du salon à rejoindre.";
    connectError.hidden = false;
    return;
  }

  connectError.hidden = true;

  localSession = {
    pseudo,
    roomCode: code,
    isHost: false
  };

  lastBuzzedId = null;
  roomNetwork.connect(code, handleNetworkMessage);
  roomStatusBar.hidden = false;
  headerRoomCodeEl.textContent = code;
  lobbyRoomCodeEl.textContent = code;

  roomNetwork.send({
    type: "PLAYER_JOIN_REQUEST",
    player: myPlayerData(false)
  });

  showScreen("lobby");
}

// Gestion des messages réseau
function handleNetworkMessage(msg) {
  if (!msg || !msg.type) return;

  if (localSession.isHost) {
    if (msg.type === "PLAYER_JOIN_REQUEST" && msg.player) {
      const exists = roomState.players.some((p) => p.id === msg.player.id);
      if (!exists) {
        const safe = sanitizeProfile({ ...msg.player.buzzer, avatar: msg.player.avatar });
        roomState.players.push({
          id: msg.player.id,
          name: String(msg.player.name || "Joueur").slice(0, 20),
          score: 0,
          isHost: false,
          avatar: safe.avatar,
          buzzer: { color: safe.color, shape: safe.shape, sound: safe.sound }
        });
      }
      syncRoomStateToAll();
    }

    if (msg.type === "PLAYER_LEAVE" && msg.playerId) {
      roomState.players = roomState.players.filter((p) => p.id !== msg.playerId);
      if (roomState.buzzedPlayerId === msg.playerId) {
        roomState.buzzedPlayerId = null;
      }
      syncRoomStateToAll();
    }

    if (msg.type === "BUZZ_REQUEST") {
      handleHostBuzz(msg.playerId);
    }

    if (msg.type === "BUZZ_ANSWER") {
      handleHostBuzzAnswer(msg.playerId, msg.optionIndex);
    }

    if (msg.type === "REQUEST_NEXT_QUESTION") {
      advanceHostQuestion();
    }

    if (msg.type === "REQUEST_RETURN_LOBBY") {
      returnHostToLobby();
    }
  }

  if (msg.type === "ROOM_STATE_SYNC" && msg.state) {
    roomState = msg.state;
    renderFromRoomState();
  }
}

function startHostGame() {
  const config = getConfigFromForm();

  if (config.manches.length === 0) {
    lobbyError.textContent = "Sélectionne au moins une manche avant de lancer la partie.";
    lobbyError.hidden = false;
    return;
  }

  if (config.themes.length === 0) {
    lobbyError.textContent = "Sélectionne au moins un thème avant de lancer la partie.";
    lobbyError.hidden = false;
    return;
  }

  lobbyError.hidden = true;

  roomState.config = config;
  roomState.players = roomState.players.map((p) => ({ ...p, score: 0 }));
  roomState.questions = buildQuestionDeck(config);
  roomState.currentQuestionIndex = 0;
  roomState.buzzedPlayerId = null;
  roomState.lockedPlayerIds = [];
  roomState.questionClosed = false;
  roomState.lastFeedback = null;
  roomState.phase = "playing";
  lastBuzzedId = null;

  startQuestionTimerOnHost();
  syncRoomStateToAll();
}

function handleHostBuzz(playerId) {
  if (roomState.phase !== "playing" || roomState.questionClosed) return;
  if (roomState.timerEndsAt && Date.now() >= roomState.timerEndsAt) {
    handleHostTimerExpired();
    return;
  }
  if (roomState.buzzedPlayerId !== null) return;
  if (roomState.lockedPlayerIds.includes(playerId)) return;

  const player = roomState.players.find((p) => p.id === playerId);
  if (!player) return;

  roomState.buzzedPlayerId = playerId;
  roomState.lastFeedback = {
    type: "info",
    message: `${player.name} a buzzé en premier et propose sa réponse !`
  };

  syncRoomStateToAll();
}

function handleHostBuzzAnswer(playerId, optionIndex) {
  if (roomState.phase !== "playing" || roomState.questionClosed) return;
  if (roomState.buzzedPlayerId !== playerId) return;

  const player = roomState.players.find((p) => p.id === playerId);
  const question = roomState.questions[roomState.currentQuestionIndex];
  if (!player || !question) return;

  const isCorrect = optionIndex === question.correctIndex;
  const correctLabel = question.options[question.correctIndex];

  if (isCorrect) {
    clearTimers();
    player.score += roomState.config.pointsPerCorrect;
    roomState.questionClosed = true;
    roomState.buzzedPlayerId = null;
    roomState.lastFeedback = {
      type: "success",
      message: `Bonne réponse de ${player.name} ! (+${roomState.config.pointsPerCorrect} pts)`,
      correctAnswer: `Réponse : ${correctLabel}`
    };
  } else {
    const penalty = roomState.config.penaltyWrong;
    if (penalty > 0) {
      player.score -= penalty;
    }
    roomState.lockedPlayerIds.push(playerId);
    roomState.buzzedPlayerId = null;

    const remainingPlayers = roomState.players.filter(
      (p) => !roomState.lockedPlayerIds.includes(p.id)
    );

    if (remainingPlayers.length === 0) {
      clearTimers();
      roomState.questionClosed = true;
      roomState.lastFeedback = {
        type: "error",
        message: `Mauvaise réponse de ${player.name}${penalty > 0 ? ` (-${penalty} pts)` : ""}. Tous les joueurs ont tenté !`,
        correctAnswer: `Bonne réponse : ${correctLabel}`
      };
    } else {
      roomState.lastFeedback = {
        type: "error",
        message: `Mauvaise réponse de ${player.name}${penalty > 0 ? ` (-${penalty} pts)` : ""}. Le buzzer est de nouveau libre !`
      };
    }
  }

  syncRoomStateToAll();
}

function advanceHostQuestion() {
  if (roomState.currentQuestionIndex + 1 < roomState.questions.length) {
    roomState.currentQuestionIndex += 1;
    roomState.buzzedPlayerId = null;
    roomState.lockedPlayerIds = [];
    roomState.questionClosed = false;
    roomState.lastFeedback = null;
    startQuestionTimerOnHost();
    syncRoomStateToAll();
  } else {
    clearTimers();
    roomState.phase = "ended";
    syncRoomStateToAll();
  }
}

function returnHostToLobby() {
  clearTimers();
  roomState.phase = "lobby";
  roomState.buzzedPlayerId = null;
  roomState.lockedPlayerIds = [];
  roomState.questionClosed = false;
  roomState.timerEndsAt = null;
  roomState.lastFeedback = null;
  roomState.players = roomState.players.map((p) => ({ ...p, score: 0 }));
  syncRoomStateToAll();
}

// Rendu de l'interface
function renderFromRoomState() {
  if (!localSession.roomCode) return;

  lobbyRoomCodeEl.textContent = localSession.roomCode;
  headerRoomCodeEl.textContent = localSession.roomCode;
  setSettingsDisabled(!localSession.isHost);

  if (roomState.config && !localSession.isHost) {
    applyConfigToForm(roomState.config);
  }

  if (roomState.phase === "lobby") {
    clearTimers();
    showScreen("lobby");
    renderLobbyPlayers();
  } else if (roomState.phase === "playing") {
    showScreen("game");
    startLocalTimerLoop();
    renderGameScreen();
  } else if (roomState.phase === "ended") {
    clearTimers();
    showScreen("end");
    renderEndScreen();
  }
}

function renderLobbyPlayers() {
  connectedCountEl.textContent = roomState.players.length;
  lobbyPlayersListEl.innerHTML = "";

  roomState.players.forEach((p) => {
    const li = document.createElement("li");
    li.className = "player-chip";
    li.appendChild(buildPlayerLabel(p, p.id === deviceId ? " (toi)" : ""));
    if (p.isHost) {
      const tag = document.createElement("span");
      tag.className = "host-tag";
      tag.textContent = "Hôte";
      li.appendChild(tag);
    }
    lobbyPlayersListEl.appendChild(li);
  });
}

function renderGameScreen() {
  const question = roomState.questions[roomState.currentQuestionIndex];
  if (!question) return;

  questionCounterEl.textContent = `Question ${roomState.currentQuestionIndex + 1} / ${roomState.questions.length}`;
  mancheBadgeEl.textContent = question.manche;
  themeBadgeEl.textContent = question.theme;
  questionTextEl.textContent = question.question;

  updateLocalTimerVisuals();

  const buzzedPlayer = roomState.players.find((p) => p.id === roomState.buzzedPlayerId);
  const isMeBuzzed = roomState.buzzedPlayerId === deviceId;
  const isMeLocked = roomState.lockedPlayerIds.includes(deviceId);

  // Style du buzzer local + son du joueur qui vient de buzzer
  const me = roomState.players.find((p) => p.id === deviceId);
  applyBuzzerStyle(buzzerBtn, me?.buzzer || profile);

  if (roomState.buzzedPlayerId && roomState.buzzedPlayerId !== lastBuzzedId) {
    playBuzzSound(buzzedPlayer?.buzzer?.sound);
  }
  lastBuzzedId = roomState.buzzedPlayerId;

  if (roomState.questionClosed) {
    buzzerStatusBadgeEl.textContent = "Question terminée";
  } else if (buzzedPlayer) {
    buzzerStatusBadgeEl.textContent = `Main à ${buzzedPlayer.name}`;
  } else {
    buzzerStatusBadgeEl.textContent = "Buzzer actif";
  }

  const canBuzz = !roomState.questionClosed && !buzzedPlayer && !isMeLocked;
  buzzerZone.hidden = Boolean(buzzedPlayer) || roomState.questionClosed;
  buzzerBtn.disabled = !canBuzz;

  if (isMeLocked) {
    buzzerHintEl.textContent = "Tu as déjà tenté ta chance sur cette question.";
  } else if (buzzedPlayer) {
    buzzerHintEl.textContent = `${buzzedPlayer.name} a buzzé !`;
  } else {
    buzzerHintEl.textContent = "Appuie vite sur le buzzer avant la fin du minuteur !";
  }

  activeAnswerZone.hidden = !buzzedPlayer || roomState.questionClosed;

  if (buzzedPlayer && !roomState.questionClosed) {
    activeBuzzerBannerEl.textContent = isMeBuzzed
      ? "C'est à toi ! Choisis ta réponse :"
      : `${buzzedPlayer.avatar || ""} ${buzzedPlayer.name} a buzzé et choisit sa réponse...`;

    optionsContainer.innerHTML = "";
    question.options.forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.textContent = optText;
      btn.disabled = !isMeBuzzed;
      btn.addEventListener("click", () => {
        if (!isMeBuzzed) return;
        if (localSession.isHost) {
          handleHostBuzzAnswer(deviceId, idx);
        } else {
          roomNetwork.send({
            type: "BUZZ_ANSWER",
            playerId: deviceId,
            optionIndex: idx
          });
        }
      });
      optionsContainer.appendChild(btn);
    });
  }

  if (roomState.lastFeedback) {
    feedbackBox.hidden = false;
    feedbackTextEl.textContent = roomState.lastFeedback.message;
    feedbackTextEl.className = `feedback-text ${roomState.lastFeedback.type || ""}`;

    if (roomState.lastFeedback.correctAnswer) {
      revealAnswerTextEl.hidden = false;
      revealAnswerTextEl.textContent = roomState.lastFeedback.correctAnswer;
    } else {
      revealAnswerTextEl.hidden = true;
    }
  } else {
    feedbackBox.hidden = true;
  }

  renderLeaderboard(leaderboardListEl);

  nextBtn.hidden = !(localSession.isHost && roomState.questionClosed);
  nextBtn.textContent =
    roomState.currentQuestionIndex + 1 < roomState.questions.length
      ? "Question suivante"
      : "Voir le classement final";
}

function renderLeaderboard(targetListEl) {
  const sorted = [...roomState.players].sort((a, b) => b.score - a.score);
  targetListEl.innerHTML = "";

  sorted.forEach((player, index) => {
    const li = document.createElement("li");
    li.className = `leaderboard-item${index === 0 ? " leader" : ""}`;
    const label = buildPlayerLabel(player);
    label.prepend(`#${index + 1} `);
    const score = document.createElement("span");
    score.className = "score-pill";
    score.textContent = `${player.score} pts`;
    li.append(label, score);
    targetListEl.appendChild(li);
  });
}

function renderEndScreen() {
  const sorted = [...roomState.players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted
    .filter((p) => p.score === topScore)
    .map((p) => `${p.avatar || ""} ${p.name}`.trim());

  winnerAnnouncementEl.textContent =
    winners.length > 1
      ? `Égalité en tête : ${winners.join(" et ")} (${topScore} pts) !`
      : `Champion(ne) : ${winners[0]} (${topScore} pts) !`;

  renderLeaderboard(finalLeaderboardListEl);

  replayBtn.hidden = !localSession.isHost;
  backToLobbyBtn.hidden = !localSession.isHost;
}

function leaveCurrentRoom() {
  clearTimers();
  if (localSession.roomCode && !localSession.isHost) {
    roomNetwork.send({
      type: "PLAYER_LEAVE",
      playerId: deviceId
    });
  }
  roomNetwork.disconnect();
  localSession = {
    pseudo: localSession.pseudo,
    roomCode: null,
    isHost: false
  };
  lastBuzzedId = null;
  roomStatusBar.hidden = true;
  showScreen("connect");
}

// Panneau de personnalisation
function renderCustomizer() {
  avatarPicker.innerHTML = "";
  AVATARS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-option" + (emoji === profile.avatar ? " selected" : "");
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      profile.avatar = emoji;
      saveProfile();
      renderCustomizer();
    });
    avatarPicker.appendChild(btn);
  });

  colorPicker.innerHTML = "";
  BUZZER_COLORS.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (color === profile.color ? " selected" : "");
    btn.style.backgroundColor = color;
    btn.setAttribute("aria-label", `Couleur ${color}`);
    btn.addEventListener("click", () => {
      profile.color = color;
      saveProfile();
      renderCustomizer();
    });
    colorPicker.appendChild(btn);
  });

  shapeSelect.value = profile.shape;
  if (!soundSelect.options.length) {
    Object.entries(BUZZER_SOUNDS).forEach(([key, s]) => {
      soundSelect.add(new Option(s.label, key));
    });
  }
  soundSelect.value = profile.sound;
  applyBuzzerStyle(buzzerPreview, profile);
}

shapeSelect.addEventListener("change", () => {
  profile.shape = shapeSelect.value;
  saveProfile();
  renderCustomizer();
});

soundSelect.addEventListener("change", () => {
  profile.sound = soundSelect.value;
  saveProfile();
  playBuzzSound(profile.sound);
});

testSoundBtn.addEventListener("click", () => playBuzzSound(profile.sound));
buzzerPreview.addEventListener("click", () => playBuzzSound(profile.sound));

// Événements UI
createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);

copyCodeBtn.addEventListener("click", () => {
  if (localSession.roomCode && navigator.clipboard) {
    navigator.clipboard.writeText(localSession.roomCode).catch(() => {});
  }
});

startBtn.addEventListener("click", () => {
  if (localSession.isHost) {
    startHostGame();
  }
});

buzzerBtn.addEventListener("click", () => {
  if (buzzerBtn.disabled) return;
  if (localSession.isHost) {
    handleHostBuzz(deviceId);
  } else {
    roomNetwork.send({
      type: "BUZZ_REQUEST",
      playerId: deviceId
    });
  }
});

nextBtn.addEventListener("click", () => {
  if (localSession.isHost) {
    advanceHostQuestion();
  }
});

replayBtn.addEventListener("click", () => {
  if (localSession.isHost) {
    startHostGame();
  }
});

backToLobbyBtn.addEventListener("click", () => {
  if (localSession.isHost) {
    returnHostToLobby();
  }
});

leaveRoomBtn.addEventListener("click", leaveCurrentRoom);
leaveGameBtn.addEventListener("click", leaveCurrentRoom);

renderCustomizer();
showScreen("connect");