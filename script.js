// script.js

// Set your sister's due date here (local time).
const DUE_DATE = new Date("2026-02-28T22:15:00");

const countdownEl = document.getElementById("countdown");
const subtitleEl = document.getElementById("subtitle");

const bets = [
  { name: "Maja", time: "2026-02-24T21:55:00" },
  { name: "Erik", time: "2026-02-25T04:01:00" },
  { name: "Sara", time: "2026-02-24T22:45:00" },
  { name: "Alle", time: "2026-02-25T00:01:00" },
  { name: "Bob", time: "2026-02-24T23:40:00" },
  { name: "Bruno", time: "2026-02-23T23:15:00" },
];

function computeWindows(bets) {
  const parsed = bets
    .map(b => ({ ...b, date: new Date(b.time) }))
    .sort((a, b) => a.date - b.date);

  // Midpoint between two Date objects
  const midpoint = (d1, d2) => new Date((d1.getTime() + d2.getTime()) / 2);

  return parsed.map((b, i) => {
    const prev = parsed[i - 1];
    const next = parsed[i + 1];

    const start = prev ? midpoint(prev.date, b.date) : new Date(-8640000000000000); // ~ -Infinity
    const end   = next ? midpoint(b.date, next.date) : new Date( 8640000000000000); // ~ +Infinity

    return { ...b, winStart: start, winEnd: end };
  });
}

function classifyBets(windows, now = new Date()) {
  const winner = windows.find(b => now >= b.winStart && now < b.winEnd) || null;

  return windows.map(b => ({
    ...b,
    isWinner: winner?.name === b.name && winner?.date?.getTime() === b.date.getTime(),
    isExpired: now >= b.winEnd,      // their entire win-window is in the past
    isUpcoming: now < b.winStart,    // their win-window is still in the future
  }));
}

const betsListEl = document.getElementById("betsList");

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

function formatSlot(start, end) {
  const isNegInf = start.getTime() < -8e15; // our ~ -Infinity sentinel
  const isPosInf = end.getTime() > 8e15;    // our ~ +Infinity sentinel

  if (isNegInf && isPosInf) return "Any time (only bet)";
  if (isNegInf) return `T < ${fmtTime.format(end)}`;
  if (isPosInf) return `T > ${fmtTime.format(start)}`;

  return `${fmtTime.format(start)} – ${fmtTime.format(end)}`;
}

const windows = computeWindows(bets);

function pad(n) {
  return String(n).padStart(2, "0");
}



function render() {
  const now = new Date();
  const diffMs = DUE_DATE - now;

  // bet list
  const classified = classifyBets(windows, now);
  betsListEl.innerHTML = "";

  classified.forEach(bet => {
    const li = document.createElement("li");
    li.classList.add("bet");

    if (bet.isWinner) li.classList.add("bet--winner");
    if (bet.isExpired) li.classList.add("bet--expired");

    li.innerHTML = `
        <div class="bet__left">
            <div class="bet__name">${bet.name}</div>
            <div class="bet__slot">${formatSlot(bet.winStart, bet.winEnd)}</div>
        </div>
        <div class="bet__right">
            <small class="bet__time">${fmt.format(bet.date)}</small>
        </div>
    `;

    betsListEl.appendChild(li);
  });


  if (diffMs <= 0) {
    countdownEl.textContent = "Nu är det dags!";
    subtitleEl.textContent = "❤️";
    return;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownEl.textContent = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  subtitleEl.textContent = `Due: ${DUE_DATE.toLocaleString("sv-SE")}`;
}

render();
setInterval(render, 1000);