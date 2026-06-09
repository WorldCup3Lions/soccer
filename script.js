// ── CLUB ABBREVIATIONS ─────────────────────────────────────────
const CLUB_ABBR = {
  "Ajax":               "AJX",
  "Arsenal":            "ARS",
  "Atletico Madrid":    "ATL",
  "Barcelona":          "BAR",
  "Bayern Munich":      "BAY",
  "Borussia Dortmund":  "BVB",
  "Chelsea":            "CHE",
  "Inter Milan":        "INT",
  "Juventus":           "JUV",
  "Liverpool":          "LIV",
  "Real Madrid":        "RMA",
  "Manchester City":    "MCI",
  "Manchester United":  "MUN",
  "AC Milan":           "MIL",
  "PSG":                "PSG",
  "Tottenham":          "TOT",
};

// ── STATE ──────────────────────────────────────────────────────
let allPlayers  = [];
let validCombos = [];

let clubRerolledGame = false;
let eraRerolledGame  = false;

let bothSpun      = false;
let currentClub   = null;
let currentEra    = null;
let pendingPlayer = null;

let draftedPlayerNames = new Set();

const SLOT_KEYS = ['GK','LB','CB1','CB2','RB','CDM','CM','CAM','LW','ST','RW'];
let slots = {};

const POS_TO_SLOTS = {
  'GK':  ['GK'],
  'LB':  ['LB'],
  'CB':  ['CB1','CB2'],
  'RB':  ['RB'],
  'CDM': ['CDM'],
  'CM':  ['CM'],
  'CAM': ['CAM'],
  'AM':  ['CAM'],
  'LW':  ['LW'],
  'ST':  ['ST'],
  'RW':  ['RW'],
  'RM':  ['RW'],
  'LM':  ['LW'],
};

const ALL_CLUBS = [
  "Ajax","Arsenal","Atletico Madrid","Barcelona","Bayern Munich",
  "Borussia Dortmund","Chelsea","Inter Milan","Juventus","Liverpool",
  "Real Madrid","Manchester City","Manchester United","AC Milan","PSG","Tottenham"
];
const ALL_ERAS = ["60s","70s","80s","90s","00s","10s","20s"];

const DB_FILES = [
  "ajax","arsenal","atletico","barcelona","bayern",
  "bvb","chelsea","inter","juventus","liverpool",
  "madrid","mancity","manutd","milan","psg","tottenham"
];

function uclWinChance(ovr) {
  if (ovr >= 97) return 0.92;
  if (ovr >= 95) return 0.88;
  if (ovr >= 93) return 0.82;
  if (ovr >= 91) return 0.75;
  if (ovr >= 89) return 0.62;
  if (ovr >= 87) return 0.50;
  if (ovr >= 85) return 0.38;
  if (ovr >= 83) return 0.26;
  if (ovr >= 80) return 0.16;
  return 0.07;
}

// ── LOAD ───────────────────────────────────────────────────────
async function loadPlayers() {
  const results = await Promise.allSettled(
    DB_FILES.map(f => fetch(`${f}.json`).then(r => r.json()))
  );
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') allPlayers = allPlayers.concat(r.value);
    else console.warn(`Failed: ${DB_FILES[i]}.json`, r.reason);
  });

  const seen = new Set();
  allPlayers.forEach(p => {
    const key = `${p.club}||${p.era}`;
    if (!seen.has(key)) { seen.add(key); validCombos.push({ club: p.club, era: p.era }); }
  });
  validCombos = validCombos.filter(c => !(c.club === 'PSG' && c.era === '60s'));
  console.log(`${allPlayers.length} players, ${validCombos.length} combos`);
}
loadPlayers();

// ── THEME ──────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = dark ? '🌙' : '☀';
}

// ── SCREENS ────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── START GAME ─────────────────────────────────────────────────
function startGame() {
  slots = {};
  SLOT_KEYS.forEach(k => { slots[k] = { filled: false, player: null }; });

  clubRerolledGame   = false;
  eraRerolledGame    = false;
  draftedPlayerNames = new Set();

  pendingPlayer = null;
  resetPickState();
  showScreen('screen-draft');
  updateFormationBar();
  updatePickCounter();
}

function goHome() { showScreen('screen-home'); }

// ── PER-PICK RESET ─────────────────────────────────────────────
function resetPickState() {
  bothSpun      = false;
  currentClub   = null;
  currentEra    = null;
  pendingPlayer = null;

  const spinClubEl = document.getElementById('spinClub');
  const spinEraEl  = document.getElementById('spinEra');
  if (spinClubEl) spinClubEl.textContent = '—';
  if (spinEraEl)  spinEraEl.textContent  = '—';

  const spinBothBtn = document.getElementById('spinBothBtn');
  if (spinBothBtn) spinBothBtn.disabled = false;

  syncRerollButtons();
  clearHighlights();
  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPIN TO SEE PLAYERS';
  updateCurrentComboLabel();
}

function syncRerollButtons() {
  const rerollClubBtn = document.getElementById('rerollClubBtn');
  const rerollEraBtn  = document.getElementById('rerollEraBtn');

  if (rerollClubBtn) {
    rerollClubBtn.disabled = true;
    if (clubRerolledGame) rerollClubBtn.classList.add('used');
    else rerollClubBtn.classList.remove('used');
  }
  if (rerollEraBtn) {
    rerollEraBtn.disabled = true;
    if (eraRerolledGame) rerollEraBtn.classList.add('used');
    else rerollEraBtn.classList.remove('used');
  }
}

function updatePickCounter() {
  const filled = SLOT_KEYS.filter(k => slots[k] && slots[k].filled).length;
  document.getElementById('pickCounter').textContent = `Pick ${filled + 1} of 11`;
}

function updateCurrentComboLabel() {
  const el = document.getElementById('currentComboLabel');
  if (!el) return;
  el.textContent = (currentClub && currentEra) ? `${currentClub} · ${currentEra}` : '';
}

// ── SPIN ANIMATION ─────────────────────────────────────────────
function animateSpin(elId, finalValue, list, duration, callback) {
  const el = document.getElementById(elId);
  if (!el) { if (callback) callback(); return; }
  el.classList.add('rolling');
  const interval = 60;
  const frames   = Math.floor(duration / interval);
  let count = 0;
  const timer = setInterval(() => {
    el.textContent = list[Math.floor(Math.random() * list.length)];
    count++;
    if (count >= frames) {
      clearInterval(timer);
      el.classList.remove('rolling');
      el.textContent = finalValue;
      if (callback) callback();
    }
  }, interval);
}

// ── SPIN BOTH ──────────────────────────────────────────────────
function spinBoth() {
  const spinBothBtn = document.getElementById('spinBothBtn');
  if (spinBothBtn) spinBothBtn.disabled = true;

  const combo    = validCombos[Math.floor(Math.random() * validCombos.length)];
  currentClub    = combo.club;
  currentEra     = combo.era;
  const abbr     = CLUB_ABBR[currentClub] || currentClub.slice(0, 3).toUpperCase();
  const abbrList = Object.values(CLUB_ABBR);

  let clubDone = false, eraDone = false;
  function onBothDone() {
    if (!clubDone || !eraDone) return;
    bothSpun = true;

    const rerollClubBtn = document.getElementById('rerollClubBtn');
    const rerollEraBtn  = document.getElementById('rerollEraBtn');
    if (rerollClubBtn && !clubRerolledGame) rerollClubBtn.disabled = false;
    if (rerollEraBtn  && !eraRerolledGame)  rerollEraBtn.disabled  = false;

    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  }

  animateSpin('spinClub', abbr,       abbrList, 900, () => { clubDone = true; onBothDone(); });
  animateSpin('spinEra',  currentEra, ALL_ERAS, 900, () => { eraDone  = true; onBothDone(); });
}

// ── REROLL CLUB — never repeats current ───────────────────────
function rerollClub() {
  if (clubRerolledGame || !bothSpun) return;
  clubRerolledGame = true;

  const btn = document.getElementById('rerollClubBtn');
  if (btn) { btn.disabled = true; btn.classList.add('used'); }

  const validClubs = validCombos
    .filter(c => c.era === currentEra && c.club !== currentClub)
    .map(c => c.club);

  if (validClubs.length === 0) { showToast('No other clubs for this era'); return; }

  currentClub = validClubs[Math.floor(Math.random() * validClubs.length)];
  const abbr  = CLUB_ABBR[currentClub] || currentClub.slice(0, 3).toUpperCase();

  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPINNING…';
  updateCurrentComboLabel();

  animateSpin('spinClub', abbr, Object.values(CLUB_ABBR), 700, () => {
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  });
}

// ── REROLL ERA — never repeats current ────────────────────────
function rerollEra() {
  if (eraRerolledGame || !bothSpun) return;
  eraRerolledGame = true;

  const btn = document.getElementById('rerollEraBtn');
  if (btn) { btn.disabled = true; btn.classList.add('used'); }

  const validEras = validCombos
    .filter(c => c.club === currentClub && c.era !== currentEra)
    .map(c => c.era);

  if (validEras.length === 0) { showToast('No other eras for this club'); return; }

  currentEra = validEras[Math.floor(Math.random() * validEras.length)];

  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPINNING…';
  updateCurrentComboLabel();

  animateSpin('spinEra', currentEra, ALL_ERAS, 700, () => {
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  });
}

// ── SHOW PLAYERS — filter already drafted ─────────────────────
function showPlayersForCurrentCombo() {
  if (!currentClub || !currentEra) return;
  const players = allPlayers
    .filter(p => p.club === currentClub && p.era === currentEra)
    .filter(p => !draftedPlayerNames.has(p.name));
  renderPlayerCards(players);
}

// ── RENDER CARDS ───────────────────────────────────────────────
function renderPlayerCards(players) {
  const container = document.getElementById('playerCards');
  container.innerHTML = '';

  if (players.length === 0) {
    container.innerHTML = `<div class="no-players">No players for this combo</div>`;
    document.getElementById('playersLabel').textContent = 'NO PLAYERS FOUND';
    return;
  }

  document.getElementById('playersLabel').textContent = 'SELECT A PLAYER';

  players.forEach(p => {
    const rawPositions = Array.isArray(p.positions) ? p.positions : [p.position || 'ST'];
    const posLabel = rawPositions.join(' · ');

    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="card-overall">${p.overall}</div>
      <div class="card-position">${posLabel}</div>
      <div class="card-name">${p.name}</div>
      <div class="card-stats">
        <div class="stat-row"><span class="stat-key">PAC</span><span class="stat-val">${p.pace}</span></div>
        <div class="stat-row"><span class="stat-key">SHO</span><span class="stat-val">${p.shooting}</span></div>
        <div class="stat-row"><span class="stat-key">PAS</span><span class="stat-val">${p.passing}</span></div>
        <div class="stat-row"><span class="stat-key">DRI</span><span class="stat-val">${p.dribbling}</span></div>
        <div class="stat-row"><span class="stat-key">DEF</span><span class="stat-val">${p.defending}</span></div>
        <div class="stat-row"><span class="stat-key">PHY</span><span class="stat-val">${p.physical}</span></div>
      </div>
    `;
    card.addEventListener('click', () => selectCard(p, card));
    container.appendChild(card);
  });
}

// ── SELECT CARD ────────────────────────────────────────────────
function selectCard(player, cardEl) {
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  pendingPlayer = player;
  const positions = Array.isArray(player.positions) ? player.positions : [player.position || 'ST'];
  highlightValidSlots(positions);
}

function highlightValidSlots(positions) {
  clearHighlights();
  const validSlotKeys = new Set();
  positions.forEach(pos => {
    (POS_TO_SLOTS[pos] || []).forEach(sk => {
      if (slots[sk] && !slots[sk].filled) validSlotKeys.add(sk);
    });
  });

  if (validSlotKeys.size === 0) {
    showToast("No open slots for this player's positions");
    pendingPlayer = null;
    document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
    return;
  }

  validSlotKeys.forEach(sk => {
    const el = document.getElementById(`slot-${sk}`);
    if (el) el.classList.add('highlight');
  });
}

function clearHighlights() {
  SLOT_KEYS.forEach(k => {
    const el = document.getElementById(`slot-${k}`);
    if (el) el.classList.remove('highlight');
  });
}

// ── PLACE PLAYER ───────────────────────────────────────────────
function placePlayerInSlot(slotKey) {
  if (!pendingPlayer) return;
  if (slots[slotKey].filled) return;

  const displayPos = slotKey.replace(/\d/, '');
  slots[slotKey] = { filled: true, player: { ...pendingPlayer, chosenPosition: displayPos } };

  draftedPlayerNames.add(pendingPlayer.name);

  clearHighlights();
  pendingPlayer = null;
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));

  updateFormationBar();
  updatePickCounter();

  if (SLOT_KEYS.every(k => slots[k] && slots[k].filled)) {
    setTimeout(showResults, 400);
    return;
  }
  resetPickState();
}

function handleSlotClick(slotKey) {
  const el = document.getElementById(`slot-${slotKey}`);
  if (!el || !el.classList.contains('highlight')) return;
  placePlayerInSlot(slotKey);
}

// ── FORMATION BAR ──────────────────────────────────────────────
function updateFormationBar() {
  SLOT_KEYS.forEach(k => {
    const el = document.getElementById(`slot-${k}`);
    if (!el) return;
    const slotData = slots[k];
    if (slotData && slotData.filled && slotData.player) {
      const p        = slotData.player;
      const lastName = p.name.split(' ').pop();
      el.classList.add('filled');
      el.innerHTML = `<span class="slot-pos">${p.chosenPosition}</span><span class="slot-name">${lastName}</span>`;
      el.onclick = null;
    } else {
      el.classList.remove('filled');
      const displayPos = k.replace(/\d/, '');
      el.innerHTML = `<span class="slot-pos">${displayPos}</span><span class="slot-name"></span>`;
      el.onclick = () => handleSlotClick(k);
    }
  });
}

// ── RESULTS ────────────────────────────────────────────────────
function showResults() {
  showScreen('screen-results');

  const filledPlayers = SLOT_KEYS
    .filter(k => slots[k] && slots[k].filled)
    .map(k => slots[k].player);

  const avg    = Math.round(filledPlayers.reduce((s, p) => s + p.overall, 0) / filledPlayers.length);
  const chance = uclWinChance(avg);

  // Roll total wins, then fill trophies from the right
  let totalWins = 0;
  for (let i = 0; i < 5; i++) if (Math.random() < chance) totalWins++;
  const wins = Array.from({ length: 5 }, (_, i) => i >= (5 - totalWins));

  document.getElementById('resultsTitle').textContent   = 'YOUR UCL SQUAD';
  document.getElementById('resultsOverall').textContent = `OVR ${avg}`;

  const trophiesEl = document.getElementById('uclTrophies');
  trophiesEl.innerHTML = '';
  wins.forEach((won, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'ucl-trophy';
    const icon = document.createElement('div');
    icon.className = 'ucl-trophy-icon';
    icon.textContent = '🏆';
    const lbl = document.createElement('div');
    lbl.className = 'ucl-trophy-label';
    lbl.textContent = `#${i + 1}`;
    wrap.appendChild(icon);
    wrap.appendChild(lbl);
    trophiesEl.appendChild(wrap);
    if (won) {
      setTimeout(() => { icon.classList.add('won'); lbl.style.color = 'var(--gold)'; }, 300 + i * 300);
    }
  });

  const summaryMsgs = [
    "Bottled it every time 😬",
    "1/5 — something to show for it",
    "2/5 — solid dynasty",
    "3/5 — legendary squad",
    "4/5 — all-time great",
    "5/5 — GREATEST OF ALL TIME 🐐"
  ];
  document.getElementById('uclSummary').textContent = summaryMsgs[totalWins];

  const lineup = document.getElementById('resultsLineup');
  lineup.innerHTML = '';
  filledPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'result-player-row';
    row.style.animationDelay = `${i * 0.06}s`;
    row.innerHTML = `
      <div class="rp-ovr">${p.overall}</div>
      <div class="rp-pos">${p.chosenPosition}</div>
      <div class="rp-name">${p.name}</div>
      <div class="rp-club">${p.club}<br><span style="font-size:9px;color:var(--text-muted)">${p.era}</span></div>
    `;
    lineup.appendChild(row);
  });

  window._lastResult = { avg, wins, totalWins, filledPlayers };
}

// ── SHARE ──────────────────────────────────────────────────────
function shareResult() {
  const { avg, totalWins, filledPlayers } = window._lastResult || {};
  if (!filledPlayers) return;
  const lines = filledPlayers.map(p => `${p.chosenPosition} ${p.name}`).join('\n');
  const text  = `🏆 UCL Draft\n\nOVR: ${avg} | UCL Trophies: ${totalWins}/5\n\n${lines}\n\nPlay UCL Draft!`;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
}

// ── TOAST ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}