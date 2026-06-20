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
let gameMode = '11';
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
const SLOT_DISPLAY_LABEL_5 = {
  'GK5':   'GK',
  'DEF5':  'DEF',
  'MID5a': 'MID',
  'MID5b': 'MID',
  'FWD5':  'FWD',
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

const ALL_ERAS = ["60s","70s","80s","90s","00s","10s","20s"];
const DB_FILES = [
  "ajaxnew","arsenalnew","atleticonew","barcanew","bayernnew",
  "bvbnew","chelseanew","internew","juvenew","liverpoolnew",
  "madridnew","mancitynew","manutdnew","milannew","psgnew","tottenhamnew"
];

const WORKER_URL = 'https://road-to-5-share.caleb-p-gates.workers.dev';

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

let movingFromSlot = null;
let viewingSharedResult = false;

const ERA_THRESHOLDS = {
  '60s': [90, 88, 87, 86, 84],
  '70s': [91, 89, 88, 87, 85],
  '80s': [91, 90, 88, 87, 85],
  '90s': [92, 91, 89, 88, 86],
  '00s': [92, 91, 90, 88, 86],
  '10s': [93, 91, 90, 89, 87],
  '20s': [91, 90, 88, 87, 85],
};
const DEFAULT_THRESHOLDS = [93, 91, 89, 88, 86];

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
  const t = [93, 91, 89, 87, 85];
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

function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  const theme = saved === 'dark' || saved === 'light' ? saved : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme === 'dark');
}

function updateThemeIcon(isDark) {
  const icons = [document.getElementById('themeIcon'), document.getElementById('themeIconDraft')];
  icons.forEach(icon => {
    if (!icon) return;
    if (isDark) {
      icon.setAttribute('stroke', '#fff');
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    } else {
      icon.setAttribute('stroke', '#111');
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  });
}

applySavedTheme();

async function loadPlayers() {
  const results = await Promise.allSettled(
    DB_FILES.map(f => fetch(`${f}.json`).then(r => {
      if (!r.ok) throw new Error(`${f}.json returned ${r.status}`);
      return r.json();
    }))
  );
  let failures = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') allPlayers = allPlayers.concat(r.value);
    else { failures++; console.warn(`Failed: ${DB_FILES[i]}.json`, r.reason); }
  });
  const seen = new Set();
  allPlayers.forEach(p => {
    const key = `${p.club}||${p.era}`;
    if (!seen.has(key)) { seen.add(key); validCombos.push({ club: p.club, era: p.era }); }
  });
  validCombos = validCombos.filter(c => !(c.club === 'PSG' && c.era === '60s'));
  console.log(`${allPlayers.length} players, ${validCombos.length} combos`);
  if (!allPlayers.length) {
    showLoadError();
  } else {
    document.querySelectorAll('.mode-btn').forEach(b => b.disabled = false);
    if (failures > 0) showToast(`${failures} club file${failures > 1 ? 's' : ''} failed to load`);
  }
  document.getElementById('loadingIndicator') && document.getElementById('loadingIndicator').classList.add('hidden');
}

function showLoadError() {
  const homeContent = document.querySelector('.home-content');
  if (!homeContent) return;
  const errBox = document.createElement('div');
  errBox.className = 'load-error';
  errBox.innerHTML = '<p>Could not load player data. Check your connection and try again.</p><button onclick="location.reload()">RETRY</button>';
  homeContent.appendChild(errBox);
  document.getElementById('loadingIndicator') && document.getElementById('loadingIndicator').classList.add('hidden');
}

loadPlayers().then(() => checkForSharedResult());

function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  const newTheme = dark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(!dark);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGameEra() {
  if (!validCombos.length) { showToast('Still loading players...'); return; }
  gameMode = 'era';
  lockedEra = null;
  slots = {};
  SLOT_KEYS.forEach(k => { slots[k] = { filled: false, player: null }; });
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
  document.getElementById('spinBothBtn').textContent = 'SPIN';
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
  document.getElementById('spinBothBtn').textContent = 'SPIN';
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
  if (!eraOpts.length) { showToast('Still loading players...'); return; }
  const eraCombo = eraOpts[Math.floor(Math.random() * eraOpts.length)];
  lockedEra = eraCombo;
  document.getElementById('spinBothBtn').disabled = true;
  document.getElementById('spinEra').textContent = '-';
  document.getElementById('spinClub').textContent = '-';
  document.getElementById('spinEraBox').classList.remove('locked');
  document.getElementById('spinClubBox').classList.remove('locked');
  animateSpin('spinEra', lockedEra, eraOpts, 900, () => {
    document.getElementById('spinEraBox').classList.add('locked');
    document.getElementById('eraLockedLabel').textContent = `ERA LOCKED: ${lockedEra}`;
    document.getElementById('eraLockedLabel').style.display = 'block';
    document.getElementById('spinBothBtn').disabled = false;
    document.getElementById('spinBothBtn').textContent = 'SPIN CLUB';
  });
}

function goHome(skipConfirm) {
  const activeSlotKeys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  if (!skipConfirm && activeSlotKeys.some(k => slots[k] && slots[k].filled)) {
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
  document.getElementById('spinClub').textContent = '-';
  document.getElementById('spinClubBox').classList.remove('locked');
  document.getElementById('spinBothBtn').disabled = false;
  if (gameMode === 'era' && lockedEra) {
    document.getElementById('spinEra').textContent = lockedEra;
    document.getElementById('spinEraBox').classList.add('locked');
    document.getElementById('spinBothBtn').textContent = 'SPIN CLUB';
  } else {
    document.getElementById('spinEra').textContent = '-';
    document.getElementById('spinEraBox').classList.remove('locked');
    document.getElementById('spinBothBtn').textContent = 'SPIN';
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
    opts = validCombos.filter(c => c.era === lockedEra && c.club !== currentClub);
  } else {
    opts = validCombos.filter(c => !(c.club === currentClub && c.era === currentEra));
  }
  if (!opts.length) { showToast('No alternative combos available'); return; }
  const alt = opts[Math.floor(Math.random() * opts.length)];
  const abbr = CLUB_ABBR[alt.club] || alt.club.slice(0,3).toUpperCase();
  document.getElementById('sopClub').textContent = abbr;
  document.getElementById('sopEra').textContent  = alt.era;
  document.getElementById('sopFullName').textContent = `${alt.club} - ${alt.era}`;
  document.getElementById('secondOpinionPanel').classList.add('open');
  document.getElementById('sopSwitchBtn').onclick = () => {
    currentClub = alt.club;
    currentEra  = alt.era;
    document.getElementById('spinClub').textContent = abbr;
    document.getElementById('spinEra').textContent  = alt.era;
    updateCurrentComboLabel();
    hideSecondOpinionPanel();
    showPlayersForCurrentCombo();
    showToast('Switched to ' + alt.club + ' - ' + alt.era);
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
  if (el) el.textContent = (currentClub && currentEra) ? `${currentClub} - ${currentEra}` : '';
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
    if (!eraOpts.length) { showToast('No clubs for this era'); document.getElementById('spinBothBtn').disabled = false; return; }
    combo = eraOpts[Math.floor(Math.random() * eraOpts.length)];
  } else {
    combo = validCombos[Math.floor(Math.random() * validCombos.length)];
  }
  currentClub = combo.club;
  currentEra  = combo.era;
  const abbrVal  = CLUB_ABBR[currentClub] || currentClub.slice(0,3).toUpperCase();
  const abbrList = Object.values(CLUB_ABBR);
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
  document.getElementById('playersLabel').textContent = 'SPINNING...';
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
  document.getElementById('playersLabel').textContent = 'SPINNING...';
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

function getOverallTier(ovr) {
  if (ovr >= 94) return 'ovr-tier-4';
  if (ovr >= 90) return 'ovr-tier-3';
  if (ovr >= 86) return 'ovr-tier-2';
  return 'ovr-tier-1';
}

function getStatBarColor(val) {
  if (val >= 85) return '#3ecf8e';
  if (val >= 70) return '#f0b429';
  if (val >= 50) return '#e08a3e';
  return '#e55353';
}

function statBarHtml(label, value) {
  const pct = Math.max(0, Math.min(100, value));
  const color = getStatBarColor(value);
  return `
    <div class="stat-row">
      <span class="stat-key">${label}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="stat-val">${value}</span>
    </div>`;
}

function renderPlayerCards(players) {
  const container = document.getElementById('playerCards');
  container.innerHTML = '';
  if (!players.length) {
    container.innerHTML = '<div class="no-players">No players for this combo</div>';
    document.getElementById('playersLabel').textContent = 'NO PLAYERS FOUND';
    return;
  }
  document.getElementById('playersLabel').textContent = 'SELECT A PLAYER';
  players.forEach(p => {
    let posLabel;
    if (gameMode === '5') {
      const positions = Array.isArray(p.positions) ? p.positions : [p.position || 'ST'];
      const labels = [...new Set(positions.map(pos => POS_LABEL_5[pos] || pos))];
      posLabel = labels.join(' / ');
    } else {
      posLabel = (Array.isArray(p.positions) ? p.positions : [p.position || 'ST']).join(' / ');
    }
    const card = document.createElement('div');
    card.className = `player-card ${getOverallTier(p.overall)}`;
    card.innerHTML = `
      <div class="card-left">
        <div class="card-overall">${p.overall}</div>
        <div class="card-position">${posLabel}</div>
      </div>
      <div class="card-mid">
        <div class="card-name">${p.name}</div>
      </div>
      <div class="card-stats">
        ${statBarHtml('PAC', p.pace)}
        ${statBarHtml('SHO', p.shooting)}
        ${statBarHtml('PAS', p.passing)}
        ${statBarHtml('DRI', p.dribbling)}
        ${statBarHtml('DEF', p.defending)}
        ${statBarHtml('PHY', p.physical)}
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

function handleFilledSlotClick(slotKey) {
  const sd = slots[slotKey];
  if (!sd || !sd.filled) return;
  const player = sd.player;
  const moveTargets = getMoveSlots(player, slotKey);
  movingFromSlot = null;
  pendingPlayer  = null;
  clearHighlights();
  document.getElementById('placementPopup').classList.remove('open');
  movingFromSlot = slotKey;
  pendingPlayer  = player;
  buildDrawerFormation(moveTargets);
  const srcDelEl = document.getElementById(`ds-${slotKey}`);
  if (srcDelEl) srcDelEl.classList.add('moving');
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
  const displayPos = gameMode === '5'
    ? (SLOT_DISPLAY_LABEL_5[slotKey] || slotKey.replace(/\d/, ''))
    : slotKey.replace(/\d/, '');
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

function showPlacementPopup(player, positions, validSlotKeys) {
  const posLabel = positions.join(' / ');
  document.getElementById('placementPlayer').innerHTML = `
    <div class="placement-ovr">${player.overall}</div>
    <div class="placement-info">
      <div class="placement-name">${player.name}</div>
      <div class="placement-pos">${posLabel}</div>
      <div class="placement-club">${player.club} - ${player.era}</div>
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

function buildDrawerFormation(highlightSlots) {
  const pf = document.getElementById('drawerFormation');
  if (!pf) return;
  const hs = highlightSlots || new Set();

  function slotHtml(sk, label) {
    const sd = slots[sk];
    const filled    = sd && sd.filled;
    const highlight = hs.has(sk);
    const posDisp   = label || (gameMode === '5' ? (SLOT_DISPLAY_LABEL_5[sk] || sk) : sk.replace(/\d/, ''));
    return `<div class="slot${highlight ? ' highlight' : ''}${filled ? ' filled' : ''}" id="ds-${sk}" onclick="handleDrawerSlotClick('${sk}', event)">
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
      <div class="formation-row">${slotHtml('LW')}${slotHtml('ST')}${slotHtml('RW')}</div>
      <div class="formation-row">${slotHtml('CDM')}${slotHtml('CM')}${slotHtml('CAM')}</div>
      <div class="formation-row">${slotHtml('LB')}${slotHtml('CB1','CB')}${slotHtml('CB2','CB')}${slotHtml('RB')}</div>
      <div class="formation-row">${slotHtml('GK')}</div>`;
  }
}

function handleDrawerSlotClick(slotKey, event) {
  if (event) event.stopPropagation();
  if (movingFromSlot && pendingPlayer) {
    const el = document.getElementById(`ds-${slotKey}`);
    if (el && el.classList.contains('highlight')) {
      handleMoveSlotClick(slotKey);
      return;
    }
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
  SLOT_KEYS_5.forEach(k => {
    const del = document.getElementById(`ds-${k}`);
    if (del) { del.classList.remove('highlight'); del.classList.remove('moving'); }
  });
}

function placePlayerInSlot(slotKey) {
  if (!pendingPlayer || slots[slotKey].filled) return;
  const displayPos = gameMode === '5'
    ? (SLOT_DISPLAY_LABEL_5[slotKey] || slotKey.replace(/\d/, ''))
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

function updateFormationTeaser() {
  const teaser = document.getElementById('formationTeaser');
  if (!teaser) return;
  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  const filled = keys.filter(k => slots[k] && slots[k].filled);
  const count  = filled.length;
  if (count === 0) {
    teaser.innerHTML = `<div class="teaser-inner" onclick="openFormationDrawer()"><span class="teaser-label">TAP TO VIEW LINEUP</span><span class="teaser-chevron">&#9650;</span></div>`;
    return;
  }
  const pills = filled.map(k => {
    const p = slots[k].player;
    return `<div class="teaser-pill"><span class="teaser-pill-pos">${p.chosenPosition}</span><span class="teaser-pill-name">${p.name.split(' ').pop()}</span></div>`;
  }).join('');
  teaser.innerHTML = `<div class="teaser-inner" onclick="openFormationDrawer()"><div class="teaser-pills">${pills}</div><span class="teaser-count">${count}/${keys.length} &#9650;</span></div>`;
}

function updateFormationDrawer() {
  buildDrawerFormation(new Set());
}

function handleSlotClick(slotKey) {
  openFormationDrawer();
}

function showResults() {
  showScreen('screen-results');
  window.scrollTo({ top: 0, behavior: 'instant' });
  const keys = gameMode === '5' ? SLOT_KEYS_5 : SLOT_KEYS;
  const filledPlayers = keys.filter(k => slots[k] && slots[k].filled).map(k => slots[k].player);
  const baseAvg = filledPlayers.reduce((s, p) => s + p.overall, 0) / filledPlayers.length;

  const avg = Math.round(baseAvg * 10) / 10;
  const maxWins = 5;
  const total = gameMode === '5' ? uclWins5(avg) : gameMode === 'era' ? uclWinsEra(avg, lockedEra) : uclWins(avg);
  const wins  = Array.from({ length: maxWins }, (_, i) => i < total);

  document.getElementById('resultsTitle').textContent   = gameMode === '5' ? 'YOUR 5-A-SIDE SQUAD' : gameMode === 'era' ? `ERA DRAFT - ${lockedEra}` : 'YOUR SQUAD';
  document.getElementById('resultsOverall').textContent = `OVR ${avg.toFixed(1)}`;

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
    lbl.style.color = 'var(--text)';
    wrap.appendChild(icon);
    wrap.appendChild(lbl);
    trophiesEl.appendChild(wrap);
    if (won) setTimeout(() => { icon.classList.add('won'); lbl.style.color = 'var(--gold)'; }, 600 + i * 500);
  });

  const msgs = [
    "Couldn't finish the job",
    "1/5 - a one-season wonder",
    "2/5 - back-to-back winners",
    "3/5 - european domination",
    "4/5 - one of Europe's greatest sides",
    "5/5 - THE GREATEST TEAM IN HISTORY"
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

  window._lastResult = { avg, total, filledPlayers, maxWins };
}

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

function mapPlayersToSlotKeys(players, mode) {
  const map = {};
  if (mode === '5') {
    const byLabel = { GK: [], DEF: [], MID: [], FWD: [] };
    players.forEach(p => {
      if (byLabel[p.chosenPosition]) byLabel[p.chosenPosition].push(p);
    });
    if (byLabel.GK[0])  map['GK5']   = byLabel.GK[0];
    if (byLabel.DEF[0]) map['DEF5']  = byLabel.DEF[0];
    if (byLabel.MID[0]) map['MID5a'] = byLabel.MID[0];
    if (byLabel.MID[1]) map['MID5b'] = byLabel.MID[1];
    if (byLabel.FWD[0]) map['FWD5']  = byLabel.FWD[0];
  } else {
    const byPos = {};
    players.forEach(p => {
      if (!byPos[p.chosenPosition]) byPos[p.chosenPosition] = [];
      byPos[p.chosenPosition].push(p);
    });
    const single = ['GK','LB','RB','CDM','CM','CAM','LW','ST','RW'];
    single.forEach(pos => { if (byPos[pos] && byPos[pos][0]) map[pos] = byPos[pos][0]; });
    if (byPos.CB) {
      if (byPos.CB[0]) map['CB1'] = byPos.CB[0];
      if (byPos.CB[1]) map['CB2'] = byPos.CB[1];
    }
  }
  return map;
}

function drawShareCanvas(overrideData, canvasId) {
  const source = overrideData || window._lastResult;
  if (!source) return null;
  const { avg, total } = source;
  const W = 800, H = 1080;
  const canvas = document.getElementById(canvasId || 'shareCanvas');
  if (!canvas) return null;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const pitchTop = 230, pitchH = 820;
  const pitchBottom = pitchTop + pitchH;
  const pitchLeft = 40, pitchRight = W - 40;
  const pitchW = pitchRight - pitchLeft;

  ctx.fillStyle = '#205429';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(pitchLeft, pitchTop, pitchW, pitchH);

  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(pitchLeft, pitchTop + (pitchH / 10) * i, pitchW, pitchH / 10);
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

  const effMode = overrideData ? overrideData.mode : gameMode;
  const effEra  = overrideData ? overrideData.era  : lockedEra;
  const modeTag = effMode === '5' ? '5-A-SIDE' : effMode === 'era' ? `ERA DRAFT - ${effEra}` : '11-A-SIDE';

  ctx.fillStyle = '#f0b429';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ROAD TO 5', 40, 60);
  ctx.fillStyle = 'rgba(240,180,41,0.55)';
  ctx.font = '700 22px "Bebas Neue", sans-serif';
  ctx.fillText(modeTag, 42, 86);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.font = '700 48px "Bebas Neue", sans-serif';
  ctx.fillText(`OVR ${Number(avg).toFixed(1)}`, W - 40, 60);
  ctx.textAlign = 'left';

  const trophySize = 52;
  const trophySpacing = 100;
  const trophyStartX = W / 2 - (trophySpacing * 4) / 2;
  for (let i = 0; i < 5; i++) {
    const won = i < total;
    const cx = trophyStartX + i * trophySpacing;
    const offscreen = document.createElement('canvas');
    offscreen.width = 80;
    offscreen.height = 80;
    const octx = offscreen.getContext('2d');
    octx.font = `${trophySize}px sans-serif`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText('🏆', 40, 40);
    ctx.globalAlpha = won ? 1 : 0.2;
    ctx.drawImage(offscreen, cx - 40, 110, 80, 80);
    ctx.globalAlpha = 1;
    ctx.fillStyle = won ? '#f0b429' : 'rgba(240,180,41,0.2)';
    ctx.font = '600 20px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`#${i + 1}`, cx, 205);
    ctx.textAlign = 'left';
  }

  const pitchMap = effMode === '5' ? PITCH_POSITIONS_5 : PITCH_POSITIONS;
  let slotPlayerMap;
  if (overrideData) {
    slotPlayerMap = mapPlayersToSlotKeys(overrideData.filledPlayers, effMode);
  } else {
    slotPlayerMap = {};
    Object.keys(pitchMap).forEach(sk => {
      if (slots[sk] && slots[sk].filled) slotPlayerMap[sk] = slots[sk].player;
    });
  }

  Object.entries(pitchMap).forEach(([slotKey, pos]) => {
    const p = slotPlayerMap[slotKey];
    if (!p) return;
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
    const nls = 1.5;
    let nTotalW = 0;
    for (const ch of nameText) nTotalW += ctx.measureText(ch).width + nls;
    nTotalW -= nls;
    let nx = -nTotalW / 2;
    for (const ch of nameText) {
      ctx.textAlign = 'left';
      ctx.fillText(ch, nx, 0);
      nx += ctx.measureText(ch).width + nls;
    }
    ctx.restore();
    ctx.textAlign = 'left';
  });

  return canvas;
}

async function shareResult() {
  const btn = document.querySelector('.share-modal-btn.primary');
  const canvas = drawShareCanvas(null, 'shareCanvas');
  if (!canvas) return;
  if (btn) { btn.textContent = 'GENERATING...'; btn.disabled = true; }
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'road-to-5.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Road to 5', text: 'Check out my squad!' });
        if (btn) flashBtn(btn, 'SHARE IMAGE', 'SHARED!', true);
      } catch (err) {
        if (err.name !== 'AbortError') showToast('Share failed');
        if (btn) { btn.textContent = 'SHARE IMAGE'; btn.disabled = false; }
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'road-to-5.png';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Image saved');
      if (btn) flashBtn(btn, 'SHARE IMAGE', 'SAVED!', true);
    }
  }, 'image/png');
}

function openShareModal() {
  document.getElementById('shareModal').classList.add('open');
  drawShareCanvas(null, 'shareCanvas');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
}

function handleShareModalBackdropClick(event) {
  if (event.target.id === 'shareModal') closeShareModal();
}

async function copyResultLink() {
  const btn = [...document.querySelectorAll('.share-modal-btn')].find(b => b.textContent.trim() === 'COPY LINK');
  if (btn) { btn.textContent = 'GENERATING...'; btn.disabled = true; }
  try {
    const { avg, total, filledPlayers } = window._lastResult || {};
    if (!filledPlayers) throw new Error('No result');
    const payload = JSON.stringify({
      m: gameMode,
      e: gameMode === 'era' ? lockedEra : null,
      a: avg,
      t: total,
      p: filledPlayers.map(p => [p.name, p.club, p.era, p.chosenPosition, p.overall])
    });
    const res = await fetch(`${WORKER_URL}/save`, {
      method: 'POST',
      body: payload
    });
    const { key } = await res.json();
    if (!key) throw new Error('No key returned');
    const link = `${window.location.origin}${window.location.pathname}?s=${key}`;
    await navigator.clipboard.writeText(link);
    showToast('Link copied!');
    if (btn) flashBtn(btn, 'COPY LINK', 'COPIED!');
  } catch (err) {
    console.error(err);
    showToast('Copy failed');
    if (btn) { btn.textContent = 'COPY LINK'; btn.disabled = false; }
  }
}

function copyResultText() {
  const btn = [...document.querySelectorAll('.share-modal-btn')].find(b => b.textContent.trim() === 'COPY TEXT');
  const { avg, total, filledPlayers } = window._lastResult || {};
  if (!filledPlayers) return;
  const lines = filledPlayers.map(p => `${p.chosenPosition} ${p.name}`).join('\n');
  const text = `ROAD TO 5\n\nOVR: ${avg} | European Titles: ${total}/5\n\n${lines}\n\nPlay ROAD TO 5!`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!');
    if (btn) flashBtn(btn, 'COPY TEXT', 'COPIED!');
  }).catch(() => showToast('Copy failed'));
}

function checkForSharedResult() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('s');
  if (key) {
    fetch(`${WORKER_URL}/load?key=${key}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { showToast('Squad not found'); return; }
        renderSharedResult(JSON.parse(data));
      })
      .catch(err => {
        console.error(err);
        showToast('Failed to load shared squad');
      });
    return;
  }
  const encoded = params.get('result');
  if (!encoded) return;
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    renderSharedResult(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (err) {
    console.warn('Failed to decode legacy shared result', err);
  }
}

function renderSharedResult(data) {
  if (!data || !data.p || !data.p.length) {
    console.warn('Shared result missing player data', data);
    return;
  }
  viewingSharedResult = true;
  showScreen('screen-results');
  window.scrollTo({ top: 0, behavior: 'instant' });

  const modeLabel = data.m === '5' ? '5-A-SIDE' : data.m === 'era' ? `ERA DRAFT - ${data.e}` : '11-A-SIDE';
  document.getElementById('resultsTitle').textContent = `SHARED SQUAD - ${modeLabel}`;
  document.getElementById('resultsOverall').textContent = `OVR ${Number(data.a).toFixed(1)}`;

  const trophiesEl = document.getElementById('uclTrophies');
  trophiesEl.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const won = i < data.t;
    const wrap = document.createElement('div');
    wrap.className = 'ucl-trophy';
    const icon = document.createElement('div');
    icon.className = 'ucl-trophy-icon' + (won ? ' won' : '');
    icon.textContent = '🏆';
    const lbl = document.createElement('div');
    lbl.className = 'ucl-trophy-label';
    lbl.textContent = `#${i + 1}`;
    lbl.style.color = won ? 'var(--gold)' : 'var(--text)';
    wrap.appendChild(icon);
    wrap.appendChild(lbl);
    trophiesEl.appendChild(wrap);
  }

  const msgs = [
    "Couldn't finish the job",
    "1/5 - a one-season wonder",
    "2/5 - back-to-back winners",
    "3/5 - european domination",
    "4/5 - one of Europe's greatest sides",
    "5/5 - THE GREATEST TEAM IN HISTORY"
  ];
  document.getElementById('uclSummary').textContent = msgs[data.t];

  // Support both array format [name,club,era,pos,overall] and object format {n,c,r,pos,o}
  const filledPlayers = data.p.map(p => {
    if (Array.isArray(p)) {
      return { name: p[0], club: p[1], era: p[2], chosenPosition: p[3], overall: p[4] };
    }
    return { name: p.n, club: p.c, era: p.r, chosenPosition: p.pos, overall: p.o };
  });

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

  document.getElementById('sharedResultActions').style.display = 'flex';
  document.getElementById('normalResultActions').style.display = 'none';
  document.getElementById('resultsPitchWrap').style.display = 'flex';

  window._lastResult = { avg: data.a, total: data.t, filledPlayers };
  const overrideData = { avg: data.a, total: data.t, mode: data.m, era: data.e, filledPlayers };

  document.fonts.ready.then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawShareCanvas(overrideData, 'resultsPitchCanvas');
      });
    });
  });
}

function goHomeFromShared() {
  viewingSharedResult = false;
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  document.getElementById('resultsPitchWrap').style.display = 'none';
  document.getElementById('sharedResultActions').style.display = 'none';
  document.getElementById('normalResultActions').style.display = 'flex';
  showScreen('screen-home');
}

function flashBtn(btn, originalText, successText, isPrimary = false) {
  btn.textContent = successText;
  btn.disabled = true;
  btn.style.background = isPrimary ? '#3ecf8e' : '';
  btn.style.borderColor = isPrimary ? '#3ecf8e' : 'var(--green)';
  btn.style.color = isPrimary ? '#111' : 'var(--green)';
  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 2000);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showConfirmDialog(title, message, onConfirm) {
  showConfirm(title, message, onConfirm);
}