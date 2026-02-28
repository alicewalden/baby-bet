// script.js
const PASSPHRASE = "Välkommen Viggo!";

let frozenBirthTime = null; // Date when revealed
let intervalId = null;
let hasRevealed = false;

// Set your sister's due date here (local time).
const DUE_DATE = new Date("2026-03-29T00:00:00");

const countdownEl = document.getElementById("countdown");
const subtitleEl = document.getElementById("subtitle");
const titleEl = document.getElementById("title");
const betListTitleEl = document.getElementById("betListTitle");
const betsListEl = document.getElementById("betsList");
const passInputEl = document.getElementById("passInput");
const revealBtnEl = document.getElementById("revealBtn");
const revealMsgEl = document.getElementById("revealMsg");
const frozenLineEl = document.getElementById("frozenLine");
const winnerLineEl = document.getElementById("winnerLine");
const stoppedPanelEl = document.getElementById("stoppedPanel");
const stoppedTimeInputEl = document.getElementById("stoppedTimeInput");
const applyStoppedTimeBtnEl = document.getElementById("applyStoppedTimeBtn");


const bets = [
  { name: "Marianne", time: "2026-04-02T16:30:00" },
  { name: "Lillie", time: "2026-04-05T02:12:00" },
  { name: "Camilla", time: "2026-03-26T19:47:00" },
  { name: "Bella och Fabbe", time: "2026-04-02T04:30:00" },
  { name: "Pappa Joel", time: "2026-03-29T20:25:00" },
  { name: "Pelle", time: "2026-04-01T00:23:00" },
  { name: "Thea", time: "2026-03-25T13:46:00" },
  { name: "Alice", time: "2026-03-28T04:11:00" },
  { name: "Junior", time: "2026-03-26T12:12:00" },
  { name: "Ylva", time: "2026-04-04T01:01:00" },
  { name: "Adam", time: "2026-04-04T12:34:00" },
  { name: "Colin", time: "2026-03-27T19:13:00" },
  { name: "David", time: "2026-03-25T12:14:00" },
  { name: "Louie", time: "2026-03-28T16:33:00" },
  { name: "Liv", time: "2026-03-26T01:52:00" },
  { name: "Ulric", time: "2026-03-30T07:35:00" },
];

const betsParsed = bets
  .map(b => ({ ...b, date: new Date(b.time) })) // local time
  .sort((a, b) => a.date - b.date);

const fmt = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const fmtTime = new Intl.DateTimeFormat("sv-SE", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDateTimeLocalValue(date) {
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function fromDateTimeLocalValue(value) {
  // Browser interprets this as local time
  return new Date(value);
}


function computeWindows(bets) {
  const parsed = bets
    .map(b => ({ ...b, date: new Date(b.time) }))
    .sort((a, b) => a.date - b.date);

  const midpoint = (d1, d2) => new Date((d1.getTime() + d2.getTime()) / 2);

  return parsed.map((b, i) => {
    const prev = parsed[i - 1];
    const next = parsed[i + 1];

    const start = prev ? midpoint(prev.date, b.date) : new Date(-8640000000000000);
    const end = next ? midpoint(b.date, next.date) : new Date(8640000000000000);

    return { ...b, winStart: start, winEnd: end };
  });
}

const windows = computeWindows(bets);

function classifyBets(windows, now = new Date()) {
  const winner = windows.find(b => now >= b.winStart && now < b.winEnd) || null;

  return windows.map(b => ({
    ...b,
    isWinner: winner?.name === b.name && winner?.date?.getTime() === b.date.getTime(),
    isExpired: now >= b.winEnd,      // their entire win-window is in the past
    isUpcoming: now < b.winStart,    // their win-window is still in the future
  }));
}

function formatSlot(start, end) {
  const isNegInf = start.getTime() < -8e15; // our ~ -Infinity sentinel
  const isPosInf = end.getTime() > 8e15;    // our ~ +Infinity sentinel

  if (isNegInf && isPosInf) return "Any time (only bet)";
  if (isNegInf) return `T < ${fmtTime.format(end)}`;
  if (isPosInf) return `T > ${fmtTime.format(start)}`;

  return `${fmtTime.format(start)} – ${fmtTime.format(end)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// TIME FREEZE
function closestWinner(betsWithDates, targetDate) {
  const t = targetDate.getTime();
  let best = null;
  let bestDiff = Infinity;

  for (const b of betsWithDates) {
    const diff = Math.abs(b.date.getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = b;
    } else if (diff === bestDiff) {
      // tie-breaker: earlier bet wins (change if you prefer later)
      if (b.date.getTime() < best.date.getTime()) best = b;
    }
  }
  return best;
}

function stopAndReveal() {
  hasRevealed = false;
  const entered = passInputEl.value;
  if (entered !== PASSPHRASE) {
    revealMsgEl.textContent = "❌ Wrong passphrase.";
    return;
  }

  // Freeze time initially (can be edited)
  frozenBirthTime = new Date();

  // Stop live ticking
  if (intervalId) clearInterval(intervalId);

  // Show edit UI, but DO NOT reveal winner yet
  stoppedPanelEl.hidden = false;
  stoppedTimeInputEl.value = toDateTimeLocalValue(frozenBirthTime);

  revealMsgEl.textContent = "✅ Stopped. Edit the time, then press Apply to reveal.";
  passInputEl.disabled = true;
  revealBtnEl.disabled = true;

  // Clear reveal lines until Apply is pressed
  frozenLineEl.textContent = "";
  winnerLineEl.textContent = "";

  render(); // list updates to effectiveTime, countdown shows stopped, etc.
}

function applyStoppedTime() {
  hasRevealed = true;
  const value = stoppedTimeInputEl.value;
  if (!value) return;

  frozenBirthTime = fromDateTimeLocalValue(value);

  render();
}

revealBtnEl.addEventListener("click", stopAndReveal);
passInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") stopAndReveal();
});

if (applyStoppedTimeBtnEl) {
  applyStoppedTimeBtnEl.addEventListener("click", applyStoppedTime);
}


// RENDER
function render() {
  const now = new Date();
  const effectiveTime = frozenBirthTime ?? now;
  let winner = "";

  if (!hasRevealed) {
    frozenLineEl.textContent = "";
    winnerLineEl.textContent = "";
  }

  const diffMs = DUE_DATE - now;

  // bet list should reflect "if born at effectiveTime"
  const classified = classifyBets(windows, effectiveTime);
  betsListEl.innerHTML = "";

  classified.forEach(bet => {
    const li = document.createElement("li");
    li.classList.add("bet");

    if (bet.isWinner) {
      li.classList.add("bet--winner");
      winner = bet.name;
    }
    if (bet.isExpired) li.classList.add("bet--expired");

    // OPTIONAL: if frozen, add minutes difference under each bet for extra satisfaction
    const diffMinutes = frozenBirthTime
      ? Math.round(Math.abs(bet.date.getTime() - frozenBirthTime.getTime()) / 60000)
      : null;

    li.innerHTML = `
      <div class="bet__left">
        <div class="bet__name">${bet.name}</div>
        <div class="bet__slot">${formatSlot(bet.winStart, bet.winEnd)}${diffMinutes !== null ? ` • Δ ${diffMinutes} min` : ""}</div>
      </div>
      <div class="bet__right">
        <small class="bet__time">${fmt.format(bet.date)}</small>
      </div>
    `;
    betsListEl.appendChild(li);
  });

  // Countdown should keep running only if not frozen
  if (frozenBirthTime) {
    titleEl.textContent = "🎉Lillebror är här!🎉";
    countdownEl.textContent = `⏱️ ${frozenBirthTime.toLocaleString("sv-SE")}`;
    subtitleEl.textContent = "";
    betListTitleEl.textContent = `🏆 Vinnaren är ${winner}! 🏆`;
    return; // stop here in frozen mode
  }

  const isOverdue = diffMs < 0;
  const absSeconds = Math.floor(Math.abs(diffMs) / 1000);

  const days = Math.floor(absSeconds / (3600 * 24));
  const hours = Math.floor((absSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  countdownEl.textContent = isOverdue
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    : `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  subtitleEl.textContent = `BF: ${DUE_DATE.toLocaleString("sv-SE")}`;

  if (diffMs <= 0) {
    titleEl.textContent = "BF passerat med";
    return;
  }
}


render();
intervalId = setInterval(render, 1000);