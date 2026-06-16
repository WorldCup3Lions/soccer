const CLUB_ABBR = {
  "Ajax":               "AJX",
  "Arsenal":            "ARS",
  "Atlético Madrid":    "ATL",
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
const SLOT_KEYS_5 = ['GK5', 'DEF5', 'MID5a', 'MID5b', 'FWD5'];
let gameMode = '11'; // '11' or '5'
const POS_TO_SLOTS_5 = {
  'GK':  ['GK5'],
  'LB':  ['DEF5'],
  'CB':  ['DEF5'],
  'RB':  ['DEF5'],
  'CDM': ['MID5a','MID5b'],
  'CM':  ['MID5a','MID5b'],
  'CAM': ['MID5a','MID5b'],
  'LW':  ['FWD5'],
  'ST':  ['FWD5'],
  'RW':  ['FWD5'],
};

const POS_LABEL_5 = {
  'GK':  'GK',
  'LB':  'DEF',
  'CB':  'DEF',
  'RB':  'DEF',
  'CDM': 'MID',
  'CM':  'MID',
  'CAM': 'MID',
  'LW':  'FWD',
  'ST':  'FWD',
  'RW':  'FWD',
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
let lockedEra = null;
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
  "ajaxnew","arsenalnew","atleticonew","barcanew","bayernnew",
  "bvbnew","chelseanew","internew","juvenew","liverpoolnew",
  "madridnew","mancitynew","manutdnew","milannew","psgnew","tottenhamnew"
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

const ERA_THRESHOLDS = {
  '60s': [89, 87, 86, 85, 84],
  '70s': [90, 88, 87, 86, 85],
  '80s': [91, 89, 88, 87, 85],
  '90s': [91, 90, 88, 87, 86],
  '00s': [92, 90, 89, 88, 86],
  '10s': [92, 91, 89, 88, 87],
  '20s': [91, 89, 88, 87, 85],
};

const DEFAULT_THRESHOLDS = [92, 90, 88, 87, 85];

function getThresholds(era) {
  return ERA_THRESHOLDS[era] || DEFAULT_THRESHOLDS;
}

function uclWins(ovr) {
  const t = DEFAULT_THRESHOLDS;
  if (ovr >= t[0]) return 5;
  if (ovr >= t[1]) return 4;
  if (ovr >= t[2]) return 3;
  if (ovr >= t[3]) return 2;
  if (ovr >= t[4]) return 1;
  return 0;
}

function uclWins5(ovr) {
  const t = [91, 89, 87, 85, 83];
  if (ovr >= t[0]) return 5;
  if (ovr >= t[1]) return 4;
  if (ovr >= t[2]) return 3;
  if (ovr >= t[3]) return 2;
  if (ovr >= t[4]) return 1;
  return 0;
}

function uclWinsEra(ovr, era) {
  const t = getThresholds(era);
  if (ovr >= t[0]) return 5;
  if (ovr >= t[1]) return 4;
  if (ovr >= t[2]) return 3;
  if (ovr >= t[3]) return 2;
  if (ovr >= t[4]) return 1;
  return 0;
}
let secondOpinionUsed = false;
let secondOpinionActive = false;

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

function startGameEra() {
  if (!validCombos.length) { showToast('Still loading players…'); return; }
  // ... rest unchanged
  gameMode = 'era';
  lockedEra = null;
  slots = {};
  SLOT_KEYS.forEach(k => { slots[k] = { filled: false, player: null }; });
  lockedEra = null;
  clubRerolledGame    = false;
  eraRerolledGame     = false;
  secondOpinionUsed   = false;
  secondOpinionActive = false;
  draftedPlayerNames  = new Set();
  pendingPlayer       = null;
  movingFromSlot      = null;
  dismissPlacement();
  closeFormationDrawer();
  resetPickState();
  showScreen('screen-draft');
  updateFormationTeaser();
  updatePickCounter();
  spinEraOnly();
}

function startGame5() {
  gameMode = '5';
  document.getElementById('eraLockedLabel').style.display = 'none';
  document.getElementById('spinBothBtn').textContent = '↺ SPIN';
  slots = {};
  SLOT_KEYS_5.forEach(k => { slots[k] = { filled: false, player: null }; });
  clubRerolledGame    = false;
  eraRerolledGame     = false;
  secondOpinionUsed   = false;
  secondOpinionActive = false;
  draftedPlayerNames  = new Set();
  pendingPlayer       = null;
  movingFromSlot      = null;
  dismissPlacement();
  closeFormationDrawer();
  resetPickState();
  showScreen('screen-draft');
  updateFormationTeaser();
  updatePickCounter();
}

function startGame() {
  slots = {};
  document.getElementById('eraLockedLabel').style.display = 'none';
  document.getElementById('spinBothBtn').textContent = '↺ SPIN';
  SLOT_KEYS.forEach(k => { slots[k] = { filled: false, player: null }; });
  gameMode = '11';
  lockedEra = null;
  clubRerolledGame   = false;
  eraRerolledGame    = false;
  secondOpinionUsed  = false;
  secondOpinionActive = false;
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

function spinEraOnly() {
  const eraOpts = [...new Set(validCombos.map(c => c.era))];
  if (!eraOpts.length) { showToast('Still loading players…'); return; }
  const eraCombo = eraOpts[Math.floor(Math.random() * eraOpts.length)];
  lockedEra = eraCombo;

  document.getElementById('spinBothBtn').disabled = true;
  document.getElementById('spinEra').textContent = '—';
  document.getElementById('spinClub').textContent = '—';
  document.getElementById('spinEraBox').classList.remove('locked');
  document.getElementById('spinClubBox').classList.remove('locked');

  animateSpin('spinEra', lockedEra, eraOpts, 900, () => {
    document.getElementById('spinEraBox').classList.add('locked');
    document.getElementById('eraLockedLabel').textContent = `ERA LOCKED: ${lockedEra}`;
    document.getElementById('eraLockedLabel').style.display = 'block';
    document.getElementById('spinBothBtn').disabled = false;
    document.getElementById('spinBothBtn').textContent = '↺ SPIN CLUB';
  });
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
  bothSpun      = false;
  currentClub   = null;
  currentEra    = null;
  pendingPlayer = null;
  movingFromSlot = null;
  secondOpinionActive = false;

  dismissPlacement();

  document.getElementById('spinClub').textContent = '—';
  document.getElementById('spinClubBox').classList.remove('locked');
  document.getElementById('spinBothBtn').disabled = false;

  if (gameMode === 'era' && lockedEra) {
    // keep era locked, just reset club
    document.getElementById('spinEra').textContent  = lockedEra;
    document.getElementById('spinEraBox').classList.add('locked');
    document.getElementById('spinBothBtn').textContent = '↺ SPIN CLUB';
  } else {
    document.getElementById('spinEra').textContent  = '—';
    document.getElementById('spinEraBox').classList.remove('locked');
    document.getElementById('spinBothBtn').textContent = '↺ SPIN';
  }

  hideSecondOpinionPanel();
  syncRerollButtons();
  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('playersLabel').textContent = 'SPIN TO SEE PLAYERS';
  updateCurrentComboLabel();
}


function secondOpinion() {
  if (secondOpinionUsed || !bothSpun) return;
  secondOpinionUsed = true;
  const btn = document.getElementById('secondOpinionBtn');
  if (btn) { btn.disabled = true; btn.classList.add('used'); }

  let opts;
  if (gameMode === 'era') {
    // Era draft: only reroll the club, keep the same era
    opts = validCombos.filter(c => c.era === lockedEra && c.club !== currentClub);
  } else {
    opts = validCombos.filter(c => !(c.club === currentClub && c.era === currentEra));
  }

  if (!opts.length) { showToast('No alternative combos available'); return; }
  const alt = opts[Math.floor(Math.random() * opts.length)];

  const abbr = CLUB_ABBR[alt.club] || alt.club.slice(0,3).toUpperCase();
  document.getElementById('sopClub').textContent = abbr;
  document.getElementById('sopEra').textContent  = alt.era;
  document.getElementById('sopFullName').textContent = `${alt.club} · ${alt.era}`;
  document.getElementById('secondOpinionPanel').classList.add('open');

  document.getElementById('sopSwitchBtn').onclick = () => {
    currentClub = alt.club;
    currentEra  = alt.era;
    document.getElementById('spinClub').textContent = abbr;
    document.getElementById('spinEra').textContent  = alt.era;
    updateCurrentComboLabel();
    hideSecondOpinionPanel();
    showPlayersForCurrentCombo();
    showToast('Switched to ' + alt.club + ' · ' + alt.era);
  };
}

function hideSecondOpinionPanel() {
  document.getElementById('secondOpinionPanel').classList.remove('open');
}

function dismissSecondOpinion() {
  hideSecondOpinionPanel();
  showToast('Keeping original combo');
}

function syncRerollButtons() {
  const cb = document.getElementById('rerollClubBtn');
  const eb = document.getElementById('rerollEraBtn');
  const sb = document.getElementById('secondOpinionBtn');
  if (cb) { cb.disabled = true; cb.classList.toggle('used', clubRerolledGame); }
  if (eb) {
    if (gameMode === 'era') {
      eb.disabled = true;
      eb.classList.add('used');
    } else {
      eb.disabled = true;
      eb.classList.toggle('used', eraRerolledGame);
    }
  }
  if (sb) {
    if (gameMode === '5') {
      sb.disabled = true;
      sb.style.display = 'none';
    } else {
      sb.style.display = '';
      sb.disabled = true;
      sb.classList.toggle('used', secondOpinionUsed);
    }
  }
}

function updatePickCounter() {
  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  const filled = keys.filter(k => slots[k] && slots[k].filled).length;
  const total  = keys.length;
  document.getElementById('pickCounter').textContent = `Pick ${filled + 1} of ${total}`;
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

  let combo;
  if (gameMode === 'era' && lockedEra) {
    const eraOpts = validCombos.filter(c => c.era === lockedEra);
    combo = eraOpts[Math.floor(Math.random() * eraOpts.length)];
  } else {
    combo = validCombos[Math.floor(Math.random() * validCombos.length)];
  }

  currentClub   = combo.club;
  currentEra    = combo.era;
  const abbrVal  = CLUB_ABBR[currentClub] || currentClub.slice(0,3).toUpperCase();
  const abbrList = Object.values(CLUB_ABBR);
  if (gameMode === 'era' && lockedEra) {
  const eraOpts = validCombos.filter(c => c.era === lockedEra);
  if (!eraOpts.length) { showToast('No clubs for this era'); document.getElementById('spinBothBtn').disabled = false; return; }
  combo = eraOpts[Math.floor(Math.random() * eraOpts.length)];
}
  let clubDone = false, eraDone = false;

  function onBothDone() {
    if (!clubDone || !eraDone) return;
    bothSpun = true;
    document.getElementById('spinClubBox').classList.add('locked');
    document.getElementById('spinEraBox').classList.add('locked');
    const cb = document.getElementById('rerollClubBtn');
    const eb = document.getElementById('rerollEraBtn');
    const sb = document.getElementById('secondOpinionBtn');
    if (cb && !clubRerolledGame) cb.disabled = false;
    if (gameMode !== 'era' && eb && !eraRerolledGame) eb.disabled = false;
    if (sb && !secondOpinionUsed) sb.disabled = false;
    updateCurrentComboLabel();
    showPlayersForCurrentCombo();
  }

  if (gameMode === 'era' && lockedEra) {
    // era already locked, only spin club
    eraDone = true;
    animateSpin('spinClub', abbrVal, abbrList, 900, () => { clubDone = true; onBothDone(); });
  } else {
    animateSpin('spinClub', abbrVal, abbrList, 900, () => { clubDone = true; onBothDone(); });
    animateSpin('spinEra', currentEra, ALL_ERAS, 900, () => { eraDone = true; onBothDone(); });
  }
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
    let posLabel;
    if (gameMode === '5') {
      const firstPos = Array.isArray(p.positions) ? p.positions[0] : (p.position || 'ST');
      posLabel = POS_LABEL_5[firstPos] || firstPos;
    } else {
      posLabel = (Array.isArray(p.positions) ? p.positions : [p.position || 'ST']).join(' · ');
    }

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
  const map = gameMode === '5' ? POS_TO_SLOTS_5 : POS_TO_SLOTS;
  const valid = new Set();
  positions.forEach(pos => {
    (map[pos] || []).forEach(sk => {
      if (slots[sk] && !slots[sk].filled) valid.add(sk);
    });
  });
  return valid;
}

// ── GET MOVE SLOTS (empty slots for a player's positions, excluding current slot) ──
function getMoveSlots(player, excludeSlot) {
  const map = gameMode === '5' ? POS_TO_SLOTS_5 : POS_TO_SLOTS;
  const positions = Array.isArray(player.positions) ? player.positions : [player.position || 'ST'];
  const valid = new Set();
  positions.forEach(pos => {
    (map[pos] || []).forEach(sk => {
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

  if (gameMode === '5') {
    pf.innerHTML = `
      <div class="formation-row">${slotHtml('FWD5','FWD')}</div>
      <div class="formation-row">${slotHtml('MID5a','MID')}${slotHtml('MID5b','MID')}</div>
      <div class="formation-row">${slotHtml('DEF5','DEF')}</div>
      <div class="formation-row">${slotHtml('GK5','GK')}</div>`;
  } else {
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
  const displayPos = gameMode === '5'
    ? (POS_LABEL_5[Array.isArray(pendingPlayer.positions) ? pendingPlayer.positions[0] : pendingPlayer.position] || slotKey.replace(/\d/, ''))
    : slotKey.replace(/\d/, '');

  slots[slotKey] = { filled: true, player: { ...pendingPlayer, chosenPosition: displayPos } };
  draftedPlayerNames.add(pendingPlayer.name);

  dismissPlacement();
  closeFormationDrawer();
  updateFormationTeaser();
  updatePickCounter();

  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  if (keys.every(k => slots[k] && slots[k].filled)) {
    setTimeout(showResults, 400);
    return;
  }
  resetPickState();
}

// ── FORMATION TEASER (always visible strip) ─────────────────────
function updateFormationTeaser() {
  const teaser = document.getElementById('formationTeaser');
  if (!teaser) return;
  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  const filled = keys.filter(k => slots[k] && slots[k].filled);
  const count  = filled.length;

  if (count === 0) {
    teaser.innerHTML = `
      <div class="teaser-inner" onclick="openFormationDrawer()">
        <span class="teaser-label">TAP TO VIEW LINEUP</span>
        <span class="teaser-chevron">▲</span>
      </div>`;
    return;
  }

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
      <span class="teaser-count">${count}/${keys.length} ▲</span>
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
  window.scrollTo({ top: 0, behavior: 'instant' });

  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  const filledPlayers = keys.filter(k => slots[k]?.filled).map(k => slots[k].player);
  const avg   = Math.round(filledPlayers.reduce((s, p) => s + p.overall, 0) / filledPlayers.length);
  const maxWins = 5;
  const total = gameMode === '5' ? uclWins5(avg) : gameMode === 'era' ? uclWinsEra(avg, lockedEra) : uclWins(avg);
  const wins  = Array.from({ length: maxWins }, (_, i) => i < total);

  document.getElementById('resultsTitle').textContent   = gameMode === '5' ? 'YOUR 5-A-SIDE SQUAD' : gameMode === 'era' ? `ERA DRAFT · ${lockedEra}` : 'YOUR UCL SQUAD';
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
    if (won) setTimeout(() => { icon.classList.add('won'); lbl.style.color = 'var(--gold)'; }, 600 + i * 500);
  });

  const msgs5 = [
    "Couldn't finish the job 😬",
    "1/5 — a one-season wonder",
    "2/5 — back-to-back winners",
    "3/5 — european domination",
    "4/5 — one of Europe's greatest sides",
    "5/5 — THE GREATEST TEAM IN HISTORY 🐐"
  ];
  const msgs11 = [
    "Couldn't finish the job 😬",
    "1/5 — a one-season wonder",
    "2/5 — back-to-back winners",
    "3/5 — european domination",
    "4/5 — one of Europe's greatest sides",
    "5/5 — THE GREATEST TEAM IN HISTORY 🐐"
  ];
  document.getElementById('uclSummary').textContent = gameMode === '5' ? msgs5[total] : msgs11[total];

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

  window._lastResult = { avg, total, filledPlayers, maxWins };
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
const PITCH_POSITIONS_5 = {
  GK5:   { x: 0.5,  y: 0.88 },
  DEF5:  { x: 0.5,  y: 0.65 },
  MID5a: { x: 0.3,  y: 0.40 },
  MID5b: { x: 0.7,  y: 0.40 },
  FWD5:  { x: 0.5,  y: 0.18 },
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

  const modeTag = gameMode === '5' ? '5-A-SIDE' : gameMode === 'era' ? `ERA DRAFT · ${lockedEra}` : '11-A-SIDE';
  ctx.fillStyle = '#f0b429';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('UCL DRAFT', 40, 60);

  ctx.fillStyle = 'rgba(240,180,41,0.55)';
  ctx.font = '700 22px "Bebas Neue", sans-serif';
  ctx.fillText(modeTag, 42, 86);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.fillText(`OVR ${avg}`, W - 40, 60);
  ctx.textAlign = 'left';

  const trophySpacing = 100;
  const trophyStartX = W / 2 - (trophySpacing * 4) / 2;
  for (let i = 0; i < 5; i++) {
    const won = i < total;
    const cx = trophyStartX + i * trophySpacing;
    ctx.font = '52px sans-serif';
    ctx.textAlign = 'center';

    if (won) {
      ctx.globalAlpha = 1;
      ctx.fillText('🏆', cx, 165);
    } else {
      const offscreen = document.createElement('canvas');
      offscreen.width = 80;
      offscreen.height = 80;
      const octx = offscreen.getContext('2d');
      octx.font = '52px sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText('🏆', 40, 40);
      ctx.globalAlpha = 0.15;
      ctx.drawImage(offscreen, cx - 40, 165 - 52, 80, 80);
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = won ? 1 : 0.15;
    ctx.fillStyle = '#f0b429';
    ctx.font = '600 20px "Bebas Neue", sans-serif';
    ctx.fillText(`#${i + 1}`, cx, 195);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  const pitchMap = gameMode === '5' ? PITCH_POSITIONS_5 : PITCH_POSITIONS;
  Object.entries(pitchMap).forEach(([slotKey, pos]) => {
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
