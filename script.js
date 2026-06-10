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

const ALL_ERAS  = ["60s","70s","80s","90s","00s","10s","20s"];
const DB_FILES  = [
  "ajax","arsenal","atletico","barcelona","bayern",
  "bvb","chelsea","inter","juventus","liverpool",
  "madrid","mancity","manutd","milan","psg","tottenham"
];

// ── STATIC UCL WINS ────────────────────────────────────────────
function uclWins(ovr) {
  if (ovr >= 93) return 5;
  if (ovr >= 91) return 4;
  if (ovr >= 89) return 3;
  if (ovr >= 87) return 2;
  if (ovr >= 85) return 1;
  return 0;
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
  pendingPlayer      = null;
  dismissPlacement();
  resetPickState();
  showScreen('screen-draft');
  updateFormationBar();
  updatePickCounter();
}

function goHome() {
  dismissPlacement();
  showScreen('screen-home');
}

// ── PER-PICK RESET ─────────────────────────────────────────────
function resetPickState() {
  bothSpun    = false;
  currentClub = null;
  currentEra  = null;
  pendingPlayer = null;

  dismissPlacement();

  document.getElementById('spinClub').textContent = '—';
  document.getElementById('spinEra').textContent  = '—';
  document.getElementById('spinClubBox').classList.remove('locked');
  document.getElementById('spinEraBox').classList.remove('locked');
  document.getElementById('spinBothBtn').disabled = false;

  syncRerollButtons();
  clearHighlights();
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

// ── SPIN ANIMATION ─────────────────────────────────────────────
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

// ── SPIN BOTH ──────────────────────────────────────────────────
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

// ── REROLL CLUB ────────────────────────────────────────────────
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

// ── REROLL ERA ─────────────────────────────────────────────────
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

// ── SHOW PLAYERS ───────────────────────────────────────────────
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

// ── SELECT CARD ────────────────────────────────────────────────
function selectCard(player, cardEl) {
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  pendingPlayer = player;

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

// ── PLACEMENT POPUP ────────────────────────────────────────────
function showPlacementPopup(player, positions, validSlotKeys) {
  clearHighlights();
  validSlotKeys.forEach(sk => {
    // highlight in main bar
    const el = document.getElementById(`slot-${sk}`);
    if (el) el.classList.add('highlight');
  });

  const posLabel = positions.join(' · ');

  // Fill player strip
  document.getElementById('placementPlayer').innerHTML = `
    <div class="placement-ovr">${player.overall}</div>
    <div class="placement-info">
      <div class="placement-name">${player.name}</div>
      <div class="placement-pos">${posLabel}</div>
      <div class="placement-club">${player.club} · ${player.era}</div>
    </div>
  `;

  // Build mini formation
  const pf = document.getElementById('placementFormation');
  pf.innerHTML = `
    <div class="formation-row">
      <div class="slot${validSlotKeys.has('LW') ? ' highlight' : ''}${slots['LW']&&slots['LW'].filled?' filled':''}" id="ps-LW" onclick="handlePlacementSlotClick('LW')"><span class="slot-pos">${slots['LW']&&slots['LW'].filled ? slots['LW'].player.chosenPosition : 'LW'}</span><span class="slot-name">${slots['LW']&&slots['LW'].filled ? slots['LW'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('ST') ? ' highlight' : ''}${slots['ST']&&slots['ST'].filled?' filled':''}" id="ps-ST" onclick="handlePlacementSlotClick('ST')"><span class="slot-pos">${slots['ST']&&slots['ST'].filled ? slots['ST'].player.chosenPosition : 'ST'}</span><span class="slot-name">${slots['ST']&&slots['ST'].filled ? slots['ST'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('RW') ? ' highlight' : ''}${slots['RW']&&slots['RW'].filled?' filled':''}" id="ps-RW" onclick="handlePlacementSlotClick('RW')"><span class="slot-pos">${slots['RW']&&slots['RW'].filled ? slots['RW'].player.chosenPosition : 'RW'}</span><span class="slot-name">${slots['RW']&&slots['RW'].filled ? slots['RW'].player.name.split(' ').pop() : ''}</span></div>
    </div>
    <div class="formation-row">
      <div class="slot${validSlotKeys.has('CDM') ? ' highlight' : ''}${slots['CDM']&&slots['CDM'].filled?' filled':''}" id="ps-CDM" onclick="handlePlacementSlotClick('CDM')"><span class="slot-pos">${slots['CDM']&&slots['CDM'].filled ? slots['CDM'].player.chosenPosition : 'CDM'}</span><span class="slot-name">${slots['CDM']&&slots['CDM'].filled ? slots['CDM'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('CM')  ? ' highlight' : ''}${slots['CM'] &&slots['CM'].filled ?' filled':''}" id="ps-CM"  onclick="handlePlacementSlotClick('CM')"><span class="slot-pos">${slots['CM']&&slots['CM'].filled ? slots['CM'].player.chosenPosition : 'CM'}</span><span class="slot-name">${slots['CM']&&slots['CM'].filled ? slots['CM'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('CAM') ? ' highlight' : ''}${slots['CAM']&&slots['CAM'].filled?' filled':''}" id="ps-CAM" onclick="handlePlacementSlotClick('CAM')"><span class="slot-pos">${slots['CAM']&&slots['CAM'].filled ? slots['CAM'].player.chosenPosition : 'AM'}</span><span class="slot-name">${slots['CAM']&&slots['CAM'].filled ? slots['CAM'].player.name.split(' ').pop() : ''}</span></div>
    </div>
    <div class="formation-row">
      <div class="slot${validSlotKeys.has('LB')  ? ' highlight' : ''}${slots['LB'] &&slots['LB'].filled ?' filled':''}" id="ps-LB"  onclick="handlePlacementSlotClick('LB')"><span class="slot-pos">${slots['LB']&&slots['LB'].filled ? slots['LB'].player.chosenPosition : 'LB'}</span><span class="slot-name">${slots['LB']&&slots['LB'].filled ? slots['LB'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('CB1') ? ' highlight' : ''}${slots['CB1']&&slots['CB1'].filled?' filled':''}" id="ps-CB1" onclick="handlePlacementSlotClick('CB1')"><span class="slot-pos">${slots['CB1']&&slots['CB1'].filled ? slots['CB1'].player.chosenPosition : 'CB'}</span><span class="slot-name">${slots['CB1']&&slots['CB1'].filled ? slots['CB1'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('CB2') ? ' highlight' : ''}${slots['CB2']&&slots['CB2'].filled?' filled':''}" id="ps-CB2" onclick="handlePlacementSlotClick('CB2')"><span class="slot-pos">${slots['CB2']&&slots['CB2'].filled ? slots['CB2'].player.chosenPosition : 'CB'}</span><span class="slot-name">${slots['CB2']&&slots['CB2'].filled ? slots['CB2'].player.name.split(' ').pop() : ''}</span></div>
      <div class="slot${validSlotKeys.has('RB')  ? ' highlight' : ''}${slots['RB'] &&slots['RB'].filled ?' filled':''}" id="ps-RB"  onclick="handlePlacementSlotClick('RB')"><span class="slot-pos">${slots['RB']&&slots['RB'].filled ? slots['RB'].player.chosenPosition : 'RB'}</span><span class="slot-name">${slots['RB']&&slots['RB'].filled ? slots['RB'].player.name.split(' ').pop() : ''}</span></div>
    </div>
    <div class="formation-row">
      <div class="slot${validSlotKeys.has('GK')  ? ' highlight' : ''}${slots['GK'] &&slots['GK'].filled ?' filled':''}" id="ps-GK"  onclick="handlePlacementSlotClick('GK')"><span class="slot-pos">${slots['GK']&&slots['GK'].filled ? slots['GK'].player.chosenPosition : 'GK'}</span><span class="slot-name">${slots['GK']&&slots['GK'].filled ? slots['GK'].player.name.split(' ').pop() : ''}</span></div>
    </div>
  `;

  document.getElementById('placementPopup').classList.add('open');
}

function dismissPlacement() {
  document.getElementById('placementPopup').classList.remove('open');
  pendingPlayer = null;
  clearHighlights();
  document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
}

function handlePlacementSlotClick(slotKey) {
  const el = document.getElementById(`ps-${slotKey}`);
  if (!el || !el.classList.contains('highlight')) return;
  placePlayerInSlot(slotKey);
}

// also keep main bar slot clicks working
function handleSlotClick(slotKey) {
  const el = document.getElementById(`slot-${slotKey}`);
  if (!el || !el.classList.contains('highlight')) return;
  placePlayerInSlot(slotKey);
}

function clearHighlights() {
  SLOT_KEYS.forEach(k => {
    const el = document.getElementById(`slot-${k}`);
    if (el) el.classList.remove('highlight');
  });
}

// ── PLACE PLAYER ───────────────────────────────────────────────
function placePlayerInSlot(slotKey) {
  if (!pendingPlayer || slots[slotKey].filled) return;
  const displayPos = slotKey.replace(/\d/, '');
  slots[slotKey] = { filled: true, player: { ...pendingPlayer, chosenPosition: displayPos } };
  draftedPlayerNames.add(pendingPlayer.name);

  dismissPlacement();
  updateFormationBar();
  updatePickCounter();

  if (SLOT_KEYS.every(k => slots[k] && slots[k].filled)) {
    setTimeout(showResults, 400);
    return;
  }
  resetPickState();
}

// ── FORMATION BAR (main, always visible) ──────────────────────
function updateFormationBar() {
  SLOT_KEYS.forEach(k => {
    const el = document.getElementById(`slot-${k}`);
    if (!el) return;
    const sd = slots[k];
    if (sd && sd.filled && sd.player) {
      el.classList.add('filled');
      el.innerHTML = `<span class="slot-pos">${sd.player.chosenPosition}</span><span class="slot-name">${sd.player.name.split(' ').pop()}</span>`;
      el.onclick = null;
    } else {
      el.classList.remove('filled');
      const dp = k.replace(/\d/, '');
      el.innerHTML = `<span class="slot-pos">${dp === 'CAM' ? 'AM' : dp}</span><span class="slot-name"></span>`;
      el.onclick = () => handleSlotClick(k);
    }
  });
}

// ── RESULTS ────────────────────────────────────────────────────
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

// ── SHARE ──────────────────────────────────────────────────────
function shareResult() {
  const { avg, total, filledPlayers } = window._lastResult || {};
  if (!filledPlayers) return;
  const lines = filledPlayers.map(p => `${p.chosenPosition} ${p.name}`).join('\n');
  const text  = `🏆 UCL Draft\n\nOVR: ${avg} | UCL Trophies: ${total}/5\n\n${lines}\n\nPlay UCL Draft!`;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
}

// ── TOAST ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}