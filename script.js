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
  if (ovr >= 93) return 5;
  if (ovr >= 91) return 4;
  if (ovr >= 89) return 3;
  if (ovr >= 87) return 2;
  if (ovr >= 85) return 1;
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

function goHome() {
  if (SLOT_KEYS.some(k => slots[k] && slots[k].filled)) {
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

  // free old slot, fill new slot
  slots[movingFromSlot] = { filled: false, player: null };
  slots[slotKey] = { filled: true, player };

  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();

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

  // open drawer first, then rebuild with highlights so the grid is always visible
  openFormationDrawer();
  buildDrawerFormation(validSlotKeys);
  document.getElementById('placementPopup').classList.add('open');
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
           onclick="handleDrawerSlotClick('${sk}')">
        <span class="slot-pos">${filled ? sd.player.chosenPosition : (posDisp === 'CAM' ? 'AM' : posDisp)}</span>
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

function handleDrawerSlotClick(slotKey) {
  // move mode
  if (movingFromSlot && pendingPlayer) {
    const el = document.getElementById(`ds-${slotKey}`);
    if (!el || !el.classList.contains('highlight')) return;
    handleMoveSlotClick(slotKey);
    closeFormationDrawer();
    return;
  }

  // placement mode
  const el = document.getElementById(`ds-${slotKey}`);
  if (!el) return;

  if (el.classList.contains('highlight')) {
    placePlayerInSlot(slotKey);
    return;
  }

  // tap a filled slot to enter move mode
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

function shareResult() {
  const { avg, total, filledPlayers } = window._lastResult || {};
  if (!filledPlayers) return;
  const lines = filledPlayers.map(p => `${p.chosenPosition} ${p.name}`).join('\n');
  const text  = `🏆 UCL Draft\n\nOVR: ${avg} | UCL Trophies: ${total}/5\n\n${lines}\n\nPlay UCL Draft!`;
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
