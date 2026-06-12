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

const ALL_ERAS  = ["60s","70s","80s","90s","00s","10s","20s"];
const DB_FILES  = [
  "ajax","arsenal","atletico","barca","bayern",
  "bvb","chelsea","inter","juve","liverpool",
  "madrid","mancity","manutd","milan","psg","tottenham"
];

// ── FORMATION DRAWER STATE ──────────────────────────────────────
let formationDrawerOpen = false;

function toggleFormationDrawer() {
  formationDrawerOpen = !formationDrawerOpen;
  const drawer = document.getElementById('formationDrawer');
  const teaser = document.getElementById('formationTeaser');
  if (formationDrawerOpen) {
    drawer.classList.add('open');
    teaser.classList.add('hidden');
    buildDrawerFormation(new Set());
  } else {
    drawer.classList.remove('open');
    teaser.classList.remove('hidden');
  }
}

function openFormationDrawer() {
  formationDrawerOpen = true;
  document.getElementById('formationDrawer').classList.add('open');
  document.getElementById('formationTeaser').classList.add('hidden');
  buildDrawerFormation(new Set());
  setTimeout(() => {
    document.addEventListener('click', closeOnOutsideClick);
  }, 0);
}

function closeOnOutsideClick(e) {
  const drawer = document.getElementById('formationDrawer');
  const teaser = document.getElementById('formationTeaser');
  if (!drawer.contains(e.target) && !teaser.contains(e.target)) {
    closeFormationDrawer();
    document.removeEventListener('click', closeOnOutsideClick);
  }
}

function closeFormationDrawer() {
  formationDrawerOpen = false;
  document.getElementById('formationDrawer').classList.remove('open');
  document.getElementById('formationTeaser').classList.remove('hidden');
  document.removeEventListener('click', closeOnOutsideClick);
  document.getElementById('placementPlayer').innerHTML = '';
  pendingPlayer = null;
  movingFromSlot = null;
  clearHighlights();
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
}

// ── MOVE PLAYER STATE ────────────────────────────────────────────
let movingFromSlot = null;

function uclWins(ovr) {
  if (ovr >= 94) return 5;
  if (ovr >= 92) return 4;
  if (ovr >= 90) return 3;
  if (ovr >= 88) return 2;
  if (ovr >= 86) return 1;
  return 0;
}

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

function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = dark ? '🌙' : '☀';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame() {
  slots = {};
  SLOT_KEYS.forEach(k => { slots[k] = { filled: false, player: null }; });
  clubRerolledGame   = false;
  eraRerolledGame    = false;
  draftedPlayerNames = new Set();
  pendingPlayer      = null;
  movingFromSlot     = null;
  dismissPlacement();
  closeFormationDrawer();
  resetPickState();
  showScreen('screen-draft');
  updateFormationTeaser();
  updatePickCounter();
}

function goHome(skipConfirm) {
  if (!skipConfirm && SLOT_KEYS.some(k => slots[k] && slots[k].filled)) {
    showConfirm('Abandon this draft?', 'All your picks will be lost.', () => {
      dismissPlacement();
      closeFormationDrawer();
      showScreen('screen-home');
    });
    return;
  }
  dismissPlacement();
  closeFormationDrawer();
  showScreen('screen-home');
}

function showConfirm(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.id = 'confirmOverlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-title">${title}</div>
      <div class="confirm-msg">${message}</div>
      <div class="confirm-btns">
        <button class="confirm-cancel" onclick="document.getElementById('confirmOverlay').remove()">CANCEL</button>
        <button class="confirm-ok" id="confirmOk">QUIT</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('confirmOk').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

function resetPickState() {
  bothSpun    = false;
  currentClub = null;
  currentEra  = null;
  pendingPlayer = null;
  movingFromSlot = null;

  dismissPlacement();

  document.getElementById('spinClub').textContent = '—';
  document.getElementById('spinEra').textContent  = '—';
  document.getElementById('spinClubBox').classList.remove('locked');
  document.getElementById('spinEraBox').classList.remove('locked');
  document.getElementById('spinBothBtn').disabled = false;

  syncRerollButtons();
  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPIN TO SEE PLAYERS';
  updateCurrentComboLabel();
}

function syncRerollButtons() {
  const cb = document.getElementById('rerollClubBtn');
  const eb = document.getElementById('rerollEraBtn');
  if (cb) { cb.disabled = true; cb.classList.toggle('used', clubRerolledGame); }
  if (eb) { eb.disabled = true; eb.classList.toggle('used', eraRerolledGame); }
}

function updatePickCounter() {
  const filled = SLOT_KEYS.filter(k => slots[k] && slots[k].filled).length;
  document.getElementById('pickCounter').textContent = `Pick ${filled + 1} of 11`;
}

function updateCurrentComboLabel() {
  const el = document.getElementById('currentComboLabel');
  if (el) el.textContent = (currentClub && currentEra) ? `${currentClub} · ${currentEra}` : '';
}

function animateSpin(elId, finalValue, list, duration, callback) {
  const el = document.getElementById(elId);
  if (!el) { if (callback) callback(); return; }
  el.classList.add('rolling');
  const frames = Math.floor(duration / 60);
  let count = 0;
  const timer = setInterval(() => {
    el.textContent = list[Math.floor(Math.random() * list.length)];
    if (++count >= frames) {
      clearInterval(timer);
      el.classList.remove('rolling');
      el.textContent = finalValue;
      if (callback) callback();
    }
  }, 60);
}

function spinBoth() {
  document.getElementById('spinBothBtn').disabled = true;

  const combo     = validCombos[Math.floor(Math.random() * validCombos.length)];
  currentClub     = combo.club;
  currentEra      = combo.era;
  const abbrVal   = CLUB_ABBR[currentClub] || currentClub.slice(0,3).toUpperCase();
  const abbrList  = Object.values(CLUB_ABBR);

  let clubDone = false, eraDone = false;
  function onBothDone() {
    if (!clubDone || !eraDone) return;
    bothSpun = true;
    document.getElementById('spinClubBox').classList.add('locked');
    document.getElementById('spinEraBox').classList.add('locked');
    const cb = document.getElementById('rerollClubBtn');
    const eb = document.getElementById('rerollEraBtn');
    if (cb && !clubRerolledGame) cb.disabled = false;
    if (eb && !eraRerolledGame)  eb.disabled = false;
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  }
  animateSpin('spinClub', abbrVal,    abbrList, 900, () => { clubDone = true; onBothDone(); });
  animateSpin('spinEra',  currentEra, ALL_ERAS, 900, () => { eraDone  = true; onBothDone(); });
}

function rerollClub() {
  if (clubRerolledGame || !bothSpun) return;
  clubRerolledGame = true;
  const btn = document.getElementById('rerollClubBtn');
  if (btn) { btn.disabled = true; btn.classList.add('used'); }

  const opts = validCombos.filter(c => c.era === currentEra && c.club !== currentClub).map(c => c.club);
  if (!opts.length) { showToast('No other clubs for this era'); return; }
  currentClub = opts[Math.floor(Math.random() * opts.length)];
  const abbrVal = CLUB_ABBR[currentClub] || currentClub.slice(0,3).toUpperCase();

  document.getElementById('spinClubBox').classList.remove('locked');
  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPINNING…';

  animateSpin('spinClub', abbrVal, Object.values(CLUB_ABBR), 700, () => {
    document.getElementById('spinClubBox').classList.add('locked');
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  });
}

function rerollEra() {
  if (eraRerolledGame || !bothSpun) return;
  eraRerolledGame = true;
  const btn = document.getElementById('rerollEraBtn');
  if (btn) { btn.disabled = true; btn.classList.add('used'); }

  const opts = validCombos.filter(c => c.club === currentClub && c.era !== currentEra).map(c => c.era);
  if (!opts.length) { showToast('No other eras for this club'); return; }
  currentEra = opts[Math.floor(Math.random() * opts.length)];

  document.getElementById('spinEraBox').classList.remove('locked');
  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPINNING…';

  animateSpin('spinEra', currentEra, ALL_ERAS, 700, () => {
    document.getElementById('spinEraBox').classList.add('locked');
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  });
}

function showPlayersForCurrentCombo() {
  if (!currentClub || !currentEra) return;
  const players = allPlayers
    .filter(p => p.club === currentClub && p.era === currentEra)
    .filter(p => !draftedPlayerNames.has(p.name));
  renderPlayerCards(players);
}

function renderPlayerCards(players) {
  const container = document.getElementById('playerCards');
  container.innerHTML = '';

  if (!players.length) {
    container.innerHTML = `<div class="no-players">No players for this combo</div>`;
    document.getElementById('playersLabel').textContent = 'NO PLAYERS FOUND';
    return;
  }
  document.getElementById('playersLabel').textContent = 'SELECT A PLAYER';

  players.forEach(p => {
    const posLabel = (Array.isArray(p.positions) ? p.positions : [p.position || 'ST']).join(' · ');
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

function selectCard(player, cardEl) {
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  pendingPlayer = player;
  movingFromSlot = null;

  const positions = Array.isArray(player.positions) ? player.positions : [player.position || 'ST'];
  const validSlotKeys = getValidSlots(positions);

  if (!validSlotKeys.size) {
    showToast("No open slots for this player's positions");
    pendingPlayer = null;
    cardEl.classList.remove('selected');
    return;
  }

  showPlacementPopup(player, positions, validSlotKeys);
}

function getValidSlots(positions) {
  const valid = new Set();
  positions.forEach(pos => {
    (POS_TO_SLOTS[pos] || []).forEach(sk => {
      if (slots[sk] && !slots[sk].filled) valid.add(sk);
    });
  });
  return valid;
}

// ── GET MOVE SLOTS (empty slots for a player's positions, excluding current slot) ──
function getMoveSlots(player, excludeSlot) {
  const positions = Array.isArray(player.positions) ? player.positions : [player.position || 'ST'];
  const valid = new Set();
  positions.forEach(pos => {
    (POS_TO_SLOTS[pos] || []).forEach(sk => {
      if (sk !== excludeSlot && slots[sk] && !slots[sk].filled) valid.add(sk);
    });
  });
  return valid;
}

// ── TAP A FILLED SLOT TO MOVE PLAYER ────────────────────────────
function handleFilledSlotClick(slotKey) {
  const sd = slots[slotKey];
  if (!sd || !sd.filled) return;

  const player = sd.player;
  const moveTargets = getMoveSlots(player, slotKey);

  // clear any prior state without touching drawer open/close
  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();
  document.getElementById('placementPopup').classList.remove('open');

  // enter move mode
  movingFromSlot = slotKey;
  pendingPlayer  = player;

  // rebuild formation grid with target slots highlighted
  buildDrawerFormation(moveTargets);

  // mark the source slot as "moving" (enlarged gold) AFTER the build
  const srcDelEl = document.getElementById(`ds-${slotKey}`);
  if (srcDelEl) srcDelEl.classList.add('moving');

  // ensure drawer is open (won't flicker if already open)
  if (!formationDrawerOpen) openFormationDrawer();

}

function cancelMove() {
  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();
  buildDrawerFormation(new Set());
  showToast('Cancelled');
}

function handleMoveSlotClick(slotKey) {
  if (!movingFromSlot || !pendingPlayer) return;
  if (slots[slotKey] && slots[slotKey].filled) return;

  const displayPos = slotKey.replace(/\d/, '');
  const player = { ...pendingPlayer, chosenPosition: displayPos };

  slots[movingFromSlot] = { filled: false, player: null };
  slots[slotKey] = { filled: true, player };

  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();
  document.getElementById('placementPlayer').innerHTML = '';

  buildDrawerFormation(new Set());
  updateFormationTeaser();
  showToast(`Moved to ${displayPos}`);
}

// ── PLACEMENT POPUP ──────────────────────────────────────────────
function showPlacementPopup(player, positions, validSlotKeys) {
  const posLabel = positions.join(' · ');

  document.getElementById('placementPlayer').innerHTML = `
    <div class="placement-ovr">${player.overall}</div>
    <div class="placement-info">
      <div class="placement-name">${player.name}</div>
      <div class="placement-pos">${posLabel}</div>
      <div class="placement-club">${player.club} · ${player.era}</div>
    </div>
  `;

  buildDrawerFormation(validSlotKeys);

  if (!formationDrawerOpen) {
    formationDrawerOpen = true;
    document.getElementById('formationDrawer').classList.add('open');
    document.getElementById('formationTeaser').classList.add('hidden');
    setTimeout(() => {
      document.addEventListener('click', closeOnOutsideClick);
    }, 0);
  }
}

function dismissPlacement() {
  document.getElementById('placementPlayer').innerHTML = '';
  pendingPlayer = null;
  movingFromSlot = null;
  clearHighlights();
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
  closeFormationDrawer();
}
// ── DRAWER FORMATION (inside the drawer) ────────────────────────
function buildDrawerFormation(highlightSlots) {
  const pf = document.getElementById('drawerFormation');
  if (!pf) return;

  const hs = highlightSlots || new Set();

  function slotHtml(sk, label) {
    const sd = slots[sk];
    const filled    = sd && sd.filled;
    const highlight = hs.has(sk);
    const posDisp   = label || sk.replace(/\d/, '');
    return `
      <div class="slot${highlight ? ' highlight' : ''}${filled ? ' filled' : ''}" 
           id="ds-${sk}" 
           onclick="handleDrawerSlotClick('${sk}', event)">
        <span class="slot-pos">${filled ? sd.player.chosenPosition : posDisp}</span>
        <span class="slot-name">${filled ? sd.player.name.split(' ').pop() : ''}</span>
      </div>`;
  }

  pf.innerHTML = `
    <div class="formation-row">
      ${slotHtml('LW')}${slotHtml('ST')}${slotHtml('RW')}
    </div>
    <div class="formation-row">
      ${slotHtml('CDM')}${slotHtml('CM')}${slotHtml('CAM')}
    </div>
    <div class="formation-row">
      ${slotHtml('LB')}${slotHtml('CB1','CB')}${slotHtml('CB2','CB')}${slotHtml('RB')}
    </div>
    <div class="formation-row">
      ${slotHtml('GK')}
    </div>`;
}

function handleDrawerSlotClick(slotKey, event) {
  if (event) event.stopPropagation();

  // move mode — clicking a highlighted target
  if (movingFromSlot && pendingPlayer) {
    const el = document.getElementById(`ds-${slotKey}`);
    if (el && el.classList.contains('highlight')) {
      handleMoveSlotClick(slotKey);
      return;
    }
    // clicking the already-selected source slot again -> deselect
    if (slotKey === movingFromSlot) {
      movingFromSlot = null;
      pendingPlayer  = null;
      clearHighlights();
      buildDrawerFormation(new Set());
      return;
    }
    return;
  }

  const el = document.getElementById(`ds-${slotKey}`);
  if (!el) return;

  if (el.classList.contains('highlight')) {
    placePlayerInSlot(slotKey);
    return;
  }

  if (slots[slotKey] && slots[slotKey].filled) {
    handleFilledSlotClick(slotKey);
  }
}

function clearHighlights() {
  SLOT_KEYS.forEach(k => {
    const el  = document.getElementById(`slot-${k}`);
    const del = document.getElementById(`ds-${k}`);
    if (el)  { el.classList.remove('highlight'); el.classList.remove('moving'); }
    if (del) { del.classList.remove('highlight'); del.classList.remove('moving'); }
  });
}

// ── PLACE PLAYER ────────────────────────────────────────────────
function placePlayerInSlot(slotKey) {
  if (!pendingPlayer || slots[slotKey].filled) return;
  const displayPos = slotKey.replace(/\d/, '');
  slots[slotKey] = { filled: true, player: { ...pendingPlayer, chosenPosition: displayPos } };
  draftedPlayerNames.add(pendingPlayer.name);

  dismissPlacement();
  closeFormationDrawer();

  // update teaser immediately, synchronously
  updateFormationTeaser();
  updatePickCounter();

  if (SLOT_KEYS.every(k => slots[k] && slots[k].filled)) {
    setTimeout(showResults, 400);
    return;
  }
  resetPickState();
}

// ── FORMATION TEASER (always visible strip) ─────────────────────
function updateFormationTeaser() {
  const teaser = document.getElementById('formationTeaser');
  if (!teaser) return;

  const filled = SLOT_KEYS.filter(k => slots[k] && slots[k].filled);
  const count  = filled.length;

  if (count === 0) {
    teaser.innerHTML = `
      <div class="teaser-inner" onclick="openFormationDrawer()">
        <span class="teaser-label">TAP TO VIEW LINEUP</span>
        <span class="teaser-chevron">▲</span>
      </div>`;
    return;
  }

  // show mini pills for filled positions
  const pills = filled.map(k => {
    const p = slots[k].player;
    return `<div class="teaser-pill">
      <span class="teaser-pill-pos">${p.chosenPosition}</span>
      <span class="teaser-pill-name">${p.name.split(' ').pop()}</span>
    </div>`;
  }).join('');

  teaser.innerHTML = `
    <div class="teaser-inner" onclick="openFormationDrawer()">
      <div class="teaser-pills">${pills}</div>
      <span class="teaser-count">${count}/11 ▲</span>
    </div>`;
}

// ── FORMATION DRAWER ────────────────────────────────────────────
function updateFormationDrawer() {
  buildDrawerFormation(new Set());
}

// slot click in the main teaser area (not drawer) – open drawer + highlight if needed  
function handleSlotClick(slotKey) {
  openFormationDrawer();
}

// ── RESULTS ─────────────────────────────────────────────────────
function showResults() {
  showScreen('screen-results');

  const filledPlayers = SLOT_KEYS.filter(k => slots[k]?.filled).map(k => slots[k].player);
  const avg   = Math.round(filledPlayers.reduce((s, p) => s + p.overall, 0) / filledPlayers.length);
  const total = uclWins(avg);
  const wins  = Array.from({ length: 5 }, (_, i) => i < total);

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
    wrap.appendChild(icon); wrap.appendChild(lbl);
    trophiesEl.appendChild(wrap);
    if (won) setTimeout(() => { icon.classList.add('won'); lbl.style.color = 'var(--gold)'; }, 300 + i * 250);
  });

  const msgs = [
    "Bottled it every time 😬",
    "1/5 — something to show for it",
    "2/5 — solid dynasty",
    "3/5 — legendary squad",
    "4/5 — all-time great",
    "5/5 — GREATEST OF ALL TIME 🐐"
  ];
  document.getElementById('uclSummary').textContent = msgs[total];

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

  window._lastResult = { avg, total, filledPlayers };
}
const SHARE_MSGS = [
  "Bottled it every time",
  "1/5 — something to show for it",
  "2/5 — solid dynasty",
  "3/5 — legendary squad",
  "4/5 — all-time great",
  "5/5 — GREATEST OF ALL TIME"
];

const PITCH_POSITIONS = {
  GK:  { x: 0.5,  y: 0.89 },
  LB:  { x: 0.12, y: 0.72 },
  CB1: { x: 0.34, y: 0.76 },
  CB2: { x: 0.66, y: 0.76 },
  RB:  { x: 0.88, y: 0.72 },
  CDM: { x: 0.32, y: 0.54 },
  CM:  { x: 0.68, y: 0.54 },
  CAM: { x: 0.5,  y: 0.38 },
  LW:  { x: 0.14, y: 0.22 },
  ST:  { x: 0.5,  y: 0.14 },
  RW:  { x: 0.86, y: 0.22 }
};

function drawShareCanvas() {
  const { avg, total } = window._lastResult || {};
  if (!window._lastResult) return null;

  const W = 800, H = 1080;
  const canvas = document.getElementById('shareCanvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const pitchTop = 230;
  const pitchH = 820;
  const pitchBottom = pitchTop + pitchH;
  const pitchLeft = 40;
  const pitchRight = W - 40;
  const pitchW = pitchRight - pitchLeft;

  ctx.fillStyle = '#205429';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#4caf50';
  ctx.fillRect(pitchLeft, pitchTop, pitchW, pitchH);

  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(pitchLeft, pitchTop + (pitchH / stripes) * i, pitchW, pitchH / stripes);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(pitchLeft, pitchTop + (pitchH / stripes) * i, pitchW, pitchH / stripes);
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 4;
  ctx.strokeRect(pitchLeft, pitchTop, pitchW, pitchH);

  ctx.beginPath();
  ctx.moveTo(pitchLeft, pitchTop + pitchH / 2);
  ctx.lineTo(pitchRight, pitchTop + pitchH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, pitchTop + pitchH / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  const boxW = pitchW * 0.5;
  ctx.strokeRect(W / 2 - boxW / 2, pitchTop, boxW, 110);
  ctx.strokeRect(W / 2 - boxW / 2, pitchBottom - 110, boxW, 110);

  ctx.fillStyle = '#f0b429';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('UCL DRAFT', 40, 70);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.fillText(`OVR ${avg}`, W - 40, 70);
  ctx.textAlign = 'left';

  const trophySpacing = 100;
  const trophyStartX = W / 2 - (trophySpacing * 4) / 2;
  for (let i = 0; i < 5; i++) {
    const won = i < total;
    const cx = trophyStartX + i * trophySpacing;
    ctx.font = '52px sans-serif';
    ctx.textAlign = 'center';

    if (won) {
      ctx.fillText('🏆', cx, 150);
    } else {
      ctx.globalAlpha = 0.25;
      ctx.fillText('🏆', cx, 150);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = won ? '#f0b429' : '#3a3a3a';
    ctx.font = '600 20px "Bebas Neue", sans-serif';
    ctx.fillText(`#${i + 1}`, cx, 180);
    ctx.textAlign = 'left';
  }

  Object.entries(PITCH_POSITIONS).forEach(([slotKey, pos]) => {
    const sd = slots[slotKey];
    if (!sd || !sd.filled) return;
    const p = sd.player;

    const cx = pitchLeft + pos.x * pitchW;
    const cy = pitchTop + pos.y * pitchH;
    const r = 42;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#13131c';
    ctx.fill();
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f0b429';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '700 38px "Bebas Neue", sans-serif';
    ctx.fillText(p.overall, cx, cy - 8);

    ctx.font = '700 16px "DM Sans", sans-serif';
    ctx.save();
    ctx.translate(cx, cy + 22);
    const posText = p.chosenPosition;
    const letterSpacing = 3;
    let totalW = 0;
    for (const ch of posText) totalW += ctx.measureText(ch).width + letterSpacing;
    totalW -= letterSpacing;
    let lx = -totalW / 2;
    for (const ch of posText) {
      ctx.textAlign = 'left';
      ctx.fillText(ch, lx, 0);
      lx += ctx.measureText(ch).width + letterSpacing;
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px "DM Sans", sans-serif';
    ctx.textBaseline = 'alphabetic';
    const nameY = cy + r + 24;
    const nameText = p.name.split(' ').pop().toUpperCase();
    ctx.save();
    ctx.translate(cx, nameY);
    const nLetterSpacing = 1.5;
    let nTotalW = 0;
    for (const ch of nameText) nTotalW += ctx.measureText(ch).width + nLetterSpacing;
    nTotalW -= nLetterSpacing;
    let nx = -nTotalW / 2;
    for (const ch of nameText) {
      ctx.textAlign = 'left';
      ctx.fillText(ch, nx, 0);
      nx += ctx.measureText(ch).width + nLetterSpacing;
    }
    ctx.restore();

    ctx.textAlign = 'left';
  });

  return canvas;
}

async function shareResult() {
  const canvas = drawShareCanvas();
  if (!canvas) return;

  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'ucl-draft.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'UCL Draft', text: 'Check out my squad!' });
      } catch (err) {
        if (err.name !== 'AbortError') showToast('Share failed');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ucl-draft.png';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Image saved');
    }
  }, 'image/png');
}

function openShareModal() {
  document.getElementById('shareModal').classList.add('open');
  drawShareCanvas();
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
}

function handleShareModalBackdropClick(event) {
  if (event.target.id === 'shareModal') closeShareModal();
}

function copyResultLink() {
  const link = 'worldcup3lions.github.io/soccer';
  navigator.clipboard.writeText(link).then(() => showToast('Link copied!')).catch(() => showToast('Copy failed'));
}

function copyResultText() {
  const { avg, total, filledPlayers } = window._lastResult || {};
  if (!filledPlayers) return;
  const lines = filledPlayers.map(p => `${p.chosenPosition} ${p.name}`).join('\n');
  const text = `UCL Draft\n\nOVR: ${avg} | UCL Trophies: ${total}/5\n\n${lines}\n\nPlay UCL Draft!`;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
}

function cancelMove() {
  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();
  buildDrawerFormation(new Set());
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
