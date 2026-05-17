/* ===== UI SYSTEM ===== */

// ===== GAME START / STOP =====
function startGame(isLoad, saveData, newName) {
  const loading = document.getElementById('loading-screen');
  const menu = document.getElementById('main-menu');
  const status = document.getElementById('loading-status');

  loading.classList.remove('hidden');
  loading.classList.remove('fade-out');
  menu.style.display = 'none';

  CameraSystem.init(); 
  SceneManager.init(); // Initialize renderer, scene, etc.

  // Initialize GameState (new or load)
  if (isLoad && saveData) {
    GameState.restore(saveData);
  } else {
    // Reset state for new game
    Object.assign(GameState, {
      cafeName: newName || "NetZone",
      cash: 500, xp: 0, level: 1, reputation: 0,
      day: 1, hour: 8, minute: 0,
      pcs: [], customers: [], staff: [], skills: {}, achievements: {}, trash: [], pendingPayments: [],
      stats: { totalEarned: 0, totalCustomers: 0, lanParties: 0, daysPlayed: 0 },
      upgrades: { 
        internet:0, pcQuality:0, lighting:false, aircon:false, snackbar:false, security:false, neon:false, serverRack:false, vending:false,
        vendingJammed: false, coffeeMachine: false, serverLevel: 1, networkLoad: 0, networkCapacity: 100, networkLevel: 1, serverHealth: 100, pancitCooker: false
      },
      playtime: 0,
      lanPartyCooldownHours: 0,
      currentTrendId: 'stable',
      trash: [], // Ensure trash is cleared on new game
      reviews: [] // Ensure reviews are cleared on new game
    });
    document.getElementById('btn-pancit')?.classList.add('hidden');
  }

  // Initialize and build scene after GameState is set
  SceneManager.rebuildFullScene(); // This will reset, build static, then add dynamic elements based on the now-restored GameState

  document.getElementById('loading-cafe-name').textContent = GameState.cafeName;
  status.textContent = "CLOSED";
  status.className = "loading-text status-closed";

  updateHUD();
  updateQueueSidebar();
  startTick();
  checkDailyReward();

  setTimeout(() => {
    status.textContent = "OPEN";
    status.className = "loading-text status-open";
    
    setTimeout(() => {
    loading.classList.add('fade-out');
    document.getElementById('game-canvas').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('queue-sidebar').classList.remove('hidden');
    document.getElementById('active-sidebar').classList.remove('hidden');
    
    if (!isLoad) {
      setTimeout(() => Tutorial.start(), 1000);
    }
    }, 800);
  }, 1500);
}

function showMainMenu() {
  SaveSystem.saveGame(true);
  clearInterval(tickInterval);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('queue-sidebar').classList.add('hidden');
  document.getElementById('active-sidebar').classList.add('hidden');
  document.getElementById('game-canvas').classList.add('hidden');
  document.getElementById('main-menu').style.display = '';
  GameState.customers = [];
  GameState.pcs = [];
  GameState.staff = [];
  GameState.trash = []; // Ensure trash is cleared on returning to main menu
  SceneManager.resetScene(); // Clear all scene objects
  if (SceneManager.frameId) cancelAnimationFrame(SceneManager.frameId);
}

// ===== HUD UPDATES =====
function updateHUD() {
  document.getElementById('val-cash').textContent   = '₱' + Math.floor(GameState.cash).toLocaleString();
  document.getElementById('val-rep').textContent    = Math.floor(GameState.reputation) + '%';
  document.getElementById('val-cust').textContent   = GameState.customers.length + '/' + GameState.maxCustomers;
  document.getElementById('val-level').textContent  = 'Lv.' + GameState.level;
  
  const date = GameState.currentDate;
  const weatherIcon = GameState.weather === 'rain' ? '🌧️' : '☀️';
  document.getElementById('val-time').textContent   = `${weatherIcon} Y${date.year} M${date.month} D${date.day}`;
  document.getElementById('val-hour').textContent   = String(GameState.hour).padStart(2,'0') + ':' + String(GameState.minute).padStart(2,'0');
  document.getElementById('val-speed-indicator').textContent = GameState.speed + 'x';

  // Market Trend Update
  const trend = window.MARKET_TRENDS.find(t => t.id === GameState.currentTrendId) || window.MARKET_TRENDS[0];
  document.getElementById('val-trend').textContent = trend.name.toUpperCase();
  document.getElementById('trend-icon').textContent = trend.icon;
  document.getElementById('stat-trend').title = trend.desc;

  // XP bar
  const cur = GameState.xp - GameState.getXPThreshold(GameState.level - 1);
  const next = GameState.getXPThreshold(GameState.level) - GameState.getXPThreshold(GameState.level - 1);
  document.getElementById('xp-bar').style.width = Math.min(100, (cur / next) * 100) + '%';

  // Rep bar
  document.getElementById('rep-bar').style.width = GameState.reputation + '%';
  document.getElementById('rep-label').textContent = Math.floor(GameState.reputation) + ' / 100';

  // LAN party button cooldown indicator
  const lanBtn = document.getElementById('btn-lan');
  if (lanBtn) {
    const fee = 100;
    if (GameState.lanPartyCooldownHours > 0) {
      lanBtn.innerHTML = `🎉<span>LAN Party<br><small style="color:var(--warn)">₱${fee} • ${GameState.lanPartyCooldownHours}h wait</small></span>`;
      lanBtn.style.opacity = '0.5';
    } else {
      lanBtn.innerHTML = `🎉<span>LAN Party<br><small style="color:var(--text-dim)">₱${fee} host</small></span>`;
      lanBtn.style.opacity = '';
    }
  }
}

window.updateQueueSidebar = function() {
  const qList = document.getElementById('queue-list');
  const aList = document.getElementById('active-list');
  if (!qList || !aList) return;

  const queued = GameState.customers.filter(c => c.state === 'queued');
  qList.innerHTML = queued.map(c => {
    const globalIdx = GameState.customers.indexOf(c);
    const icon = c.isVIP ? '👑' : c.emotion === 'angry' ? '😡' : '👤';
    return `
    <div class="queue-item" onclick="openModal('reception', ${globalIdx})">
      <span>${icon} CUST</span>
      <small>${window.SESSION_TYPES[c.desiredType].label}</small>
    </div>`;
  }).join('');

  const activeStates = ['walking_to_pc', 'active', 'walking_to_cashier', 'waiting_to_pay'];
  const active = GameState.customers.filter(c => activeStates.includes(c.state));
  aList.innerHTML = active.map(c => {
    let icon = c.isVIP ? '👑' : '👤';
    let color = '';
    const globalIdx = GameState.customers.indexOf(c);
    
    // Priority icons for interaction
    if (c.state === 'waiting_to_pay') {
      icon = '💰';
      color = 'var(--gold)';
    } else if (c.requests.includes('snack')) {
      icon = '🍕';
      color = 'var(--warn)';
    } else if (c.requests.includes('extend')) {
      icon = '✋';
      color = 'var(--neon3)';
    } else if (c.requests.includes('coffee')) {
      icon = '☕';
      color = 'var(--neon)';
    } else if (c.pc && c.pc.broken) {
      icon = '💀';
      color = 'var(--danger)';
    }

    const pcLabel = c.pc ? `PC #${c.pc.id + 1}` : '...';
    const stateLabel = c.state.split('_').pop(); // e.g., 'pay', 'pc', 'active'
    
    const timePct = c.sessionTime / c.maxSession;
    const timerColor = timePct > 0.8 ? 'var(--danger)' : timePct > 0.5 ? 'var(--warn)' : 'var(--gold)';
    const timeLeft = c.state === 'active' ? `<div class="timer-badge" style="color:${timerColor}">⏳ ${Math.max(0, c.maxSession - c.sessionTime)}h</div>` : '';

    return `
    <div class="queue-item active-item" onclick="SceneManager.interactWithCustomerByIndex(${globalIdx})">
      <span style="color:${color}">${icon} ${pcLabel}</span>
      <small>${stateLabel}</small>
      ${timeLeft}
    </div>
  `}).join('');
};

// ===== MODALS =====
const MODAL_RENDERERS = {
  upgrades:    renderUpgrades,
  staff:       renderStaff,
  rivals:      renderRivals,
  achievements:renderAchievements,
  skills:      renderSkills,
  settings:    renderSettings,
  credits:     renderCredits,
  reception:   renderReception,
  server:      renderServer,
  certificate: renderCertificate,
  dayEnd:      renderDayEnd,
  pancitMinigame: renderPancitMinigame,
  managerStats:   renderManagerStats,
  reviews:        renderSocialMedia,
  socialMedia:    renderSocialMedia,
  hacking:        renderHackingMinigame
};

let currentModalData = null;
function openModal(id, data) {
  // Handle index-based data for reception from sidebar clicks
  if (id === 'reception' && typeof data === 'number') {
    currentModalData = GameState.customers[data];
  } else {
    currentModalData = data;
  }
  
  document.getElementById('modal-overlay').classList.remove('hidden');
  const titles = {
    upgrades:      '⬆️ UPGRADES',
    staff:         '👔 STAFF',
    rivals:        '⚔️ RIVALS',
    achievements:  '🎖️ ACHIEVEMENTS',
    skills:        '🌳 SKILL TREE',
    settings:      '⚙️ SETTINGS',
    credits:       'ℹ️ CREDITS',
    reception:     '🛎️ RECEPTION',
    server:        '🖥️ SERVER ROOM',
    certificate:   '📜 CERTIFICATE',
    dayEnd:        '📅 DAY FINISHED',
    pancitMinigame:'🍜 PANCIT CANTON COOKER',
    managerStats:  '💻 REMOTE TERMINAL',
    hacking:       '🚨 SECURITY BREACH',
    socialMedia:   '📱 SOCIAL MEDIA',
    reviews:       '⭐ CUSTOMER REVIEWS'
  };
  document.getElementById('modal-title').textContent = titles[id] || id.toUpperCase();

  if (id === 'server') renderServer(); // Ensure server modal content is updated
  MODAL_RENDERERS[id]?.();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== UPGRADES =====
const UPGRADES_DEF = [
  { id:'internet', label:'Internet Speed', icon:'📡', maxLevel:4, costs:[200,400,800,1500], desc:'Faster internet = more customers & income' },
  { id:'pcQuality',label:'PC Quality',    icon:'💻', maxLevel:4, costs:[300,600,1200,2500], desc:'Better PCs earn more per hour' },
  { id:'lighting', label:'LED Lighting',  icon:'💡', maxLevel:1, costs:[150], desc:'Improves ambiance and +5 reputation' },
  { id:'aircon',   label:'Air Con',       icon:'❄️', maxLevel:1, costs:[400], desc:'Keeps customers comfortable longer' },
  { id:'pisonetMode', label:'Piso Net Mode', icon:'🪙', maxLevel:1, costs:[200], desc:'Unlock cheaper, shorter Piso Net sessions' },
  { id:'serverRack', label:'Server Rack', icon:'🗄️', maxLevel:1, costs:[1000], desc:'Enables diskless booting & easier updates' },
  { id:'networkLevel', label:'Network Infrastructure', icon:'🌐', maxLevel:5, costs:[500,1000,2000,4000,8000], desc:'Increases overall bandwidth and stability' },
  { id:'snackbar', label:'Snack Bar',     icon:'🍕', maxLevel:1, costs:[350], desc:'Extra passive income from snacks' },
  { id:'security', label:'Security Cams', icon:'📷', maxLevel:1, costs:[250], desc:'Reduces theft & vandalism events' },
  { id:'neon',     label:'Neon Signs',    icon:'🌟', maxLevel:1, costs:[200], desc:'Attracts more walk-in customers' },
  { id:'wallColor', label:'Wall Paint',   icon:'🎨', maxLevel:4, costs:[100,200,400,800], desc:'Change the interior wall theme' },
  { id:'floorPattern', label:'Flooring',  icon:'🏁', maxLevel:4, costs:[150,300,500,1000], desc:'Upgrade to premium floor patterns' },
  { id:'coffeeMachine', label:'Coffee Machine', icon:'☕', maxLevel:1, costs:[500], desc:'Prevents boredom and adds coffee orders' },
  { id:'pancitCooker', label:'Canton Cooker', icon:'🍜', maxLevel:1, costs:[600], desc:'Unlock Pancit Canton minigame & double snack income' },
];

function renderUpgrades() {
  const body = document.getElementById('modal-body');
  body.innerHTML = '<div class="upgrade-grid">' + UPGRADES_DEF.map(u => {
    const cur = typeof GameState.upgrades[u.id] === 'boolean'
      ? (GameState.upgrades[u.id] ? 1 : 0)
      : GameState.upgrades[u.id];
    const maxed = cur >= u.maxLevel;
    const cost = maxed ? 0 : u.costs[cur];
    const pips = Array.from({length: u.maxLevel}, (_,i) => `<div class="upgrade-pip ${i < cur ? 'filled' : ''}"></div>`).join('');

    return `<div class="upgrade-card ${maxed ? 'maxed' : ''}">
      <div class="upgrade-name">${u.icon} ${u.label}</div>
      <div class="upgrade-desc">${u.desc}</div>
      <div class="upgrade-level">${pips}</div>
      <button class="upgrade-btn" ${maxed || GameState.cash < cost ? 'disabled' : ''} onclick="buyUpgrade('${u.id}')">
        ${maxed ? '✅ MAXED' : '⬆️ UPGRADE — ₱' + cost}
      </button>
    </div>`;
  }).join('') + '</div>';
}

function buyUpgrade(id) {
  const def = UPGRADES_DEF.find(u => u.id === id);
  if (!def) return;
  const cur = typeof GameState.upgrades[id] === 'boolean' ? (GameState.upgrades[id] ? 1 : 0) : GameState.upgrades[id];
  if (cur >= def.maxLevel) return;
  const cost = def.costs[cur];
  if (GameState.cash < cost) { showToast('Not enough money!', 'warn'); return; }
  GameState.addCash(-cost, '-₱' + cost);
  if (typeof GameState.upgrades[id] === 'boolean') GameState.upgrades[id] = true;
  else GameState.upgrades[id]++;
  if (id === 'lighting') GameState.addReputation(5);
  if (id === 'neon') GameState.addReputation(3);
  if (id === 'wallColor' || id === 'floorPattern') SceneManager.updateVisualTheme();
  if (id === 'coffeeMachine') SceneManager.addCoffeeStation();
  if (id === 'pancitCooker') document.getElementById('btn-pancit')?.classList.remove('hidden');
  if (id === 'pisonetMode') { /* No visual change, just unlocks session type */ }
  if (id === 'serverRack') { SceneManager.addServerRack(); renderServer(); } // Update server modal after purchase
  GameState.addXP(20);
  showToast('✅ ' + def.label + ' upgraded!', 'success');
  addEventLog('⬆️ Upgraded: ' + def.label);
  renderUpgrades(); // refresh
}

// ===== STAFF =====
function renderStaff() {
  const body = document.getElementById('modal-body');
  let html = '';

  // Group current staff by roleId
  const groupedStaff = {};
  GameState.staff.forEach(s => {
    if (!groupedStaff[s.roleId]) groupedStaff[s.roleId] = [];
    groupedStaff[s.roleId].push(s);
  });

  // Current staff
  html += '<div class="staff-section"><div class="staff-section-title">YOUR TEAM (' + GameState.staff.length + ')</div>';
  if (GameState.staff.length > 0) {
    StaffSystem.ROLES.forEach(role => {
      const members = groupedStaff[role.id] || [];
      if (members.length === 0) return;

      html += `
        <details class="staff-dropdown" open>
          <summary>${role.icon} ${role.name.toUpperCase()} (${members.length}) <span style="margin-left:auto; font-size:10px; opacity:0.5;">▼</span></summary>
          <div class="staff-list" style="padding:10px;">
            ${members.map(e => `
              <div class="staff-card">
                <div class="staff-avatar">${e.icon}</div>
                <div class="staff-info">
                  <div class="staff-name">${e.name} <span style="font-size:10px;color:var(--text-dim)">${e.personality}</span></div>
                  <div class="staff-stats">
                    Skill: ${e.skill} | Mood: <div class="staff-mood-bar"><div class="staff-mood-fill" style="width:${e.mood}%;background:${e.mood>60?'var(--success)':e.mood>30?'var(--warn)':'var(--danger)'}"></div></div>
                    ₱${e.salary}/hr
                  </div>
                </div>
                <button class="hire-btn" style="color:var(--danger);border-color:var(--danger)" onclick="StaffSystem.fire(${e.id})">Fire</button>
              </div>`).join('')}
          </div>
        </details>`;
    });
  } else {
    html += '<p style="text-align:center; padding:20px; color:var(--text-dim); font-size:12px;">No staff hired yet.</p>';
  }
  html += '</div>';

  // Hire section
  html += '<div class="staff-section"><div class="staff-section-title">HIRE STAFF</div><div class="staff-list">';
  html += StaffSystem.ROLES.map(r => {
    const owned = GameState.staff.filter(e => e.roleId === r.id).length;
    const locked = GameState.level < r.minLevel;
    const cost = r.salary * 3;
    return `<div class="staff-card" style="${locked?'opacity:0.4':''}">
      <div class="staff-avatar">${r.icon}</div>
      <div class="staff-info">
        <div class="staff-name">${r.name} ${locked ? '<span style="color:var(--danger)">[Lv.'+r.minLevel+' req]</span>' : ''}</div>
        <div class="staff-role" style="font-size:11px;color:var(--text-dim)">${r.desc}</div>
        <div class="staff-stats">₱${r.salary}/hr | Hired: ${owned}</div>
      </div>
      <button class="hire-btn" onclick="StaffSystem.hire('${r.id}')" ${locked||GameState.cash<cost?'disabled':''}>Hire — ₱${cost}</button>
    </div>`;
  }).join('');
  html += '</div></div>';

  body.innerHTML = html;
}

// ===== RIVALS =====
function renderRivals() {
  const body = document.getElementById('modal-body');
  const board = RivalSystem.getLeaderboard();

  let html = '<div style="margin-bottom:16px;font-family:var(--font-mono);font-size:11px;color:var(--text-dim);letter-spacing:2px">LEADERBOARD</div>';
  html += board.map((r, i) => `
    <div class="rival-card" style="${r.isPlayer ? 'border-color:var(--neon);background:rgba(0,200,255,0.06)' : ''}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-family:var(--font-head);font-size:18px;color:var(--gold)">${i+1}.</span>
        <span style="font-size:20px">${r.icon}</span>
        <span class="rival-name" style="${r.isPlayer?'color:var(--neon)':''}">${r.name}</span>
        ${r.isPlayer ? '<span style="font-family:var(--font-mono);font-size:9px;color:var(--neon);margin-left:auto">YOU</span>' : ''}
      </div>
      <div class="rival-stats-grid">
        <div class="rival-stat"><span class="rival-stat-val">${r.rep}%</span><span class="rival-stat-lbl">REPUTATION</span></div>
        <div class="rival-stat"><span class="rival-stat-val">${r.pcs}</span><span class="rival-stat-lbl">PCs</span></div>
        <div class="rival-stat"><span class="rival-stat-val">${r.internet}x</span><span class="rival-stat-lbl">INTERNET</span></div>
      </div>
      ${!r.isPlayer ? `<button class="upgrade-btn" style="margin-top:10px; border-color:var(--danger); color:var(--danger); padding:4px 8px; font-size:9px;" onclick="sabotageRival(${r.id})">💣 Sabotage (₱500)</button>` : ''}
    </div>`).join('');

  body.innerHTML = html;
}

window.sabotageRival = function(rivalId) {
  if (GameState.cash < 500) { showToast('Kulang ang pera!', 'warn'); return; }
  const rival = RivalSystem.rivals.find(r => r.id === rivalId);
  if (!rival) return;
  
  GameState.addCash(-500, 'Sabotaged ' + rival.name);
  rival.rep = Math.max(0, rival.rep - 10);
  showToast(`💣 You review bombed ${rival.name}!`, 'success');
  addEventLog(`💀 Sabotage: You paid bot-farms to attack ${rival.name}.`);
  renderRivals();
};

// ===== ACHIEVEMENTS =====
function renderAchievements() {
  const body = document.getElementById('modal-body');
  const unlocked = ACHIEVEMENTS.filter(a => GameState.achievements[a.id]).length;

  body.innerHTML = `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);margin-bottom:14px;letter-spacing:2px">UNLOCKED: ${unlocked} / ${ACHIEVEMENTS.length}</div>
  <div class="ach-grid">` + ACHIEVEMENTS.map(a => {
    const isUnlocked = !!GameState.achievements[a.id];
    return `
    <div class="ach-card ${isUnlocked ? 'unlocked' : ''}" ${isUnlocked ? `onclick="openModal('certificate', '${a.id}')" style="cursor:pointer;"` : ''}>
      <div class="ach-card-icon">${a.icon}</div>
      <div class="ach-card-name">${a.name}</div>
      <div class="ach-card-desc">${a.desc}</div>
      ${isUnlocked ? `
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--gold);margin-top:4px">+₱${a.reward}</div>
        <div style="font-size:8px;color:var(--neon);margin-top:8px;letter-spacing:1px">CLICK TO VIEW CERTIFICATE</div>
      ` : ''}
    </div>`;
  }).join('') + '</div>';
}

function renderCertificate() {
  const achId = currentModalData;
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  const body = document.getElementById('modal-body');

  // Check for first-time view to trigger confetti
  const achData = GameState.achievements[achId];
  if (achData && achData.viewed === false) {
    achData.viewed = true;
    setTimeout(triggerConfetti, 300);
  }
  
  body.innerHTML = `
    <div class="certificate-wrap">
      <div class="cert-border ${ach.isGolden ? 'golden' : ''}">
        <div class="cert-content ${ach.isGolden ? 'golden' : ''}">
          <div class="cert-header">${ach.isGolden ? '✨ GOLDEN ACHIEVEMENT ✨' : 'CERTIFICATE OF ACHIEVEMENT'}</div>
          <div class="cert-icon">${ach.icon}</div>
          <div class="cert-main">
            This is to certify that 
            <span class="cert-name">${GameState.cafeName}</span>
            has successfully accomplished the feat of
            <span class="cert-ach-name">${ach.name}</span>
          </div>
          <div class="cert-desc">${ach.desc}</div>
          <div class="cert-footer">
            <div class="cert-seal">BY<span>TE</span></div>
            <div class="cert-date">Day ${GameState.day}, Year 20XX</div>
          </div>
        </div>
      </div>
      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="upgrade-btn" style="flex:1" onclick="openModal('achievements')">BACK TO AWARDS</button>
        <button class="upgrade-btn" style="flex:1; border-color:var(--gold); color:var(--gold)" onclick="shareCertificate()">📸 SHARE ACHIEVEMENT</button>
      </div>
    </div>
  `;
}

function renderHackingMinigame() {
  const body = document.getElementById('modal-body');
  const codes = ['XJ9-OVERRIDE', 'PURGE-RIVAL-NET', 'SECURE-GATEWAY', 'REBOOT-CORE-X'];
  const target = codes[Math.floor(Math.random()*codes.length)];
  
  body.innerHTML = `
    <div style="text-align:center; padding:20px; color:var(--danger)">
      <div style="font-size:64px; margin-bottom:20px">💀</div>
      <h3>RIVAL HACK DETECTED!</h3>
      <p>Your systems are being drained. Type the override code to stop them!</p>
      <div class="hacking-code">${target}</div>
      <input type="text" class="hacking-input" id="hacking-input" placeholder="TYPE CODE HERE..." autofocus>
    </div>
  `;

  const input = document.getElementById('hacking-input');
  input.addEventListener('input', () => {
    if (input.value.toUpperCase() === target) {
      GameState.addCash(200, '+₱200 Counter-Hack');
      GameState.addReputation(5);
      showToast('🛡️ Security Breach Repelled!', 'success');
      closeModal();
    }
  });
  
  // Penalty while modal is open
  const interval = setInterval(() => {
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
      GameState.addCash(-5, 'Hack draining...');
    } else clearInterval(interval);
  }, 2000);
}

function renderDayEnd() {
  const body = document.getElementById('modal-body');
  const income = GameState.dailyIncome || 0;
  const expenses = GameState.dailyExpenses || 0;
  const net = income - expenses;
  const netColor = net >= 0 ? 'var(--success)' : 'var(--danger)';
  
  body.innerHTML = `
    <div style="text-align:center; padding: 20px;">
      <div style="font-size:48px; margin-bottom:15px;">📊</div>
      <h2 style="color:var(--neon); margin-bottom:10px;">DAY ${GameState.day} SUMMARY</h2>
      
      <div style="background:rgba(0,0,0,0.3); padding:20px; border-radius:8px; margin-bottom:25px; font-family:var(--font-mono);">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span>Daily Income:</span>
          <span style="color:var(--success)">+₱${income.toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
          <span>Daily Expenses:</span>
          <span style="color:var(--danger)">-₱${expenses.toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:bold; margin-top:10px;">
          <span>NET PROFIT:</span>
          <span style="color:${netColor}">₱${net.toLocaleString()}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim); margin-bottom:5px; text-align:left;">NET PROFIT TREND (24H)</div>
        <canvas id="day-summary-chart" width="500" height="150" style="width:100%; height:100px; background:rgba(0,0,0,0.5); border:1px solid var(--border); border-radius:4px;"></canvas>
      </div>

      <button class="menu-btn primary" style="width:100%" onclick="GameState.nextDay(); closeModal();">
        START DAY ${GameState.day + 1}
      </button>
      <div style="margin-top:15px; font-size:10px; color:var(--text-dim);">The cafe will open at 08:00 AM</div>
    </div>
  `;

  // Draw the chart after the HTML is injected
  setTimeout(() => drawIncomeChart(GameState.hourlyIncomeLog), 100);
}

function drawIncomeChart(data) {
  const canvas = document.getElementById('day-summary-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 20;

  ctx.clearRect(0, 0, w, h);
  
  if (data.length < 2) return;

  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min;

  // Draw Baseline
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  const zeroY = h - padding - ((0 - min) / range) * (h - padding * 2);
  ctx.moveTo(padding, zeroY); ctx.lineTo(w - padding, zeroY);
  ctx.stroke();

  // Draw Line
  ctx.strokeStyle = 'var(--neon)';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'var(--neon)';
  ctx.beginPath();

  for (let i = 0; i < data.length; i++) {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((data[i] - min) / range) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Points
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 0;
  data.forEach((val, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((val - min) / range) * (h - padding * 2);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  });
}

window.triggerConfetti = function() {
  const container = document.querySelector('.certificate-wrap');
  if (!container) return;
  
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.left = '50%';
    p.style.top = '50%';
    p.style.backgroundColor = ['#00c8ff', '#ff2d78', '#39ff14', '#ffd700'][Math.floor(Math.random() * 4)];
    p.style.setProperty('--tx', (Math.random() - 0.5) * 400 + 'px');
    p.style.setProperty('--ty', (Math.random() - 0.5) * 400 + 'px');
    p.style.setProperty('--tr', Math.random() * 720 + 'deg');
    container.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
  showToast("🎊 Congratulations on your achievement!", "success");
};

window.shareCertificate = function() {
  const certElement = document.querySelector('.cert-border');
  if (!certElement) return;
  if (typeof html2canvas === 'undefined') {
    showToast("Capture system not ready. Try again in a second.", "warn");
    return;
  }

  showToast("📸 Capturing certificate...", "info");
  
  // Brief flash effect
  const flash = document.createElement('div');
  flash.style.cssText = "position:fixed;inset:0;background:white;z-index:3000;opacity:0.8;pointer-events:none;";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 100);

  html2canvas(certElement, {
    backgroundColor: '#080b14',
    scale: 2,
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `NetZone_Achievement_${GameState.cafeName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("💾 Certificate saved to your downloads!", "success");
  });
};

// ===== SKILLS =====
const SKILLS_DEF = [
  [
    { id:'fast_boot',   icon:'⚡', name:'Fast Boot',      desc:'PCs start 20% faster',     cost:100, requires:null },
    { id:'wifi_boost',  icon:'📶', name:'WiFi Boost',     desc:'+15% internet speed bonus', cost:150, requires:null },
  ],
  [
    { id:'loyalty_prog',icon:'💳', name:'Loyalty Program',desc:'Customers return more often',cost:200, requires:'fast_boot' },
    { id:'bulk_buy',    icon:'📦', name:'Bulk Buyer',      desc:'PCs cost 10% less',         cost:250, requires:'wifi_boost' },
  ],
  [
    { id:'streaming',   icon:'📺', name:'Streaming Setup', desc:'+30% income during events', cost:400, requires:'loyalty_prog' },
    { id:'esports_pro', icon:'🏆', name:'Esports Pro',     desc:'LAN Party earnings +50%',   cost:500, requires:'bulk_buy' },
  ],
  [
    { id:'fast_checkout', icon:'🏃', name:'Fast Checkout', desc:'Customers move 2x faster to cashier', cost:300, requires:null },
  ],
  [
    { id:'efficient_tech', icon:'⚡', name:'Efficient Tech', desc:'Technicians fix PCs 20% faster', cost:400, requires:'fast_checkout' },
    { id:'marketing_pro', icon:'📢', name:'Marketing Pro', desc:'Marketing staff generate 25% more traffic', cost:500, requires:'streaming' },
  ]
];

function renderSkills() {
  const body = document.getElementById('modal-body');
  body.innerHTML = '<div class="skill-tree">' + SKILLS_DEF.map((row, ri) => `
    <div class="skill-row">
      ${row.map(s => {
        const locked = s.requires && !GameState.skills[s.requires];
        const owned  = !!GameState.skills[s.id];
        return `<div class="skill-node ${owned?'unlocked':locked?'locked':''}" onclick="${owned||locked ? '' : 'buySkill(\''+s.id+'\')'}">
          <div class="skill-node-icon">${s.icon}</div>
          <div class="skill-node-name">${s.name}</div>
          <div class="skill-node-desc">${s.desc}</div>
          ${owned ? '<div class="skill-node-cost" style="color:var(--success)">✅ OWNED</div>' :
            locked ? '<div class="skill-node-cost" style="color:var(--danger)">🔒 LOCKED</div>' :
            '<div class="skill-node-cost">₱' + s.cost + '</div>'}
        </div>`;
      }).join('')}
    </div>`).join('') + '</div>';
}

function buySkill(id) {
  const skill = SKILLS_DEF.flat().find(s => s.id === id);
  if (!skill) return;
  if (GameState.skills[id]) return;
  if (skill.requires && !GameState.skills[skill.requires]) { showToast('Unlock prerequisite first!', 'warn'); return; }
  if (GameState.cash < skill.cost) { showToast('Not enough money!', 'warn'); return; }
  GameState.addCash(-skill.cost, '-₱' + skill.cost);
  GameState.skills[id] = true;
  showToast('🌳 Skill unlocked: ' + skill.name, 'success');
  addEventLog('🌳 Skill: ' + skill.name + ' unlocked!');
  renderSkills();
}

// ===== FLOATING POPS =====
function spawnFloatPop(text, x, y, isNeg) {
  const el = document.createElement('div');
  el.className = 'float-pop' + (isNeg ? ' neg' : '');
  el.textContent = text;
  el.style.left = (x - 20) + 'px';
  el.style.top  = (y - 30) + 'px';
  document.getElementById('float-container').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ===== EVENT LOG =====
function addEventLog(text) {
  const log = document.getElementById('event-log');
  const item = document.createElement('div');
  item.className = 'event-item';
  item.textContent = text;
  log.prepend(item);
  while (log.children.length > 5) log.removeChild(log.lastChild);
  setTimeout(() => item.remove(), 8000);
}

// ===== TOASTS =====
function showToast(text, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'warn' ? 'warn' : type === 'danger' ? 'danger' : type === 'success' ? 'success' : '');
  el.textContent = text;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== ACHIEVEMENT POP =====
function showAchievementPop(ach) {
  const pop = document.getElementById('achievement-pop');
  document.getElementById('ach-icon').textContent = ach.icon;
  document.getElementById('ach-name').textContent = ach.name;
  pop.classList.remove('hidden');
  setTimeout(() => pop.classList.add('hidden'), 4000);
}

// ===== DAILY REWARD =====
function checkDailyReward() {
  const today = new Date().toDateString();
  if (GameState.lastLogin === today) return;

  const streak = GameState.lastLogin === new Date(Date.now() - 86400000).toDateString()
    ? GameState.loginStreak + 1 : 1;
  GameState.loginStreak = Math.min(7, streak);
  GameState.lastLogin = today;

  const reward = 100 * GameState.loginStreak;
  GameState.addCash(reward, '+₱' + reward + ' daily!');
  showToast('🎁 Daily Reward! +₱' + reward + ' (Day ' + GameState.loginStreak + ' streak!)', 'success');
  addEventLog('🎁 Daily login reward: +₱' + reward);
}

// ===== CREDITS / SETTINGS stubs =====
window.showSettings = function() { openModal('settings'); };
window.showCredits = function() { openModal('credits'); };

function renderSettings() {
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="upgrade-grid">
      <div class="upgrade-card">
        <div class="upgrade-name">🔊 Master Volume</div>
        <input type="range" style="width:100%">
      </div>
      <div class="upgrade-card">
        <div class="upgrade-name">⏩ Game Speed Multiplier</div>
        <div style="font-size:12px; color:var(--text-dim)">Current Max: ${GameState.speeds[GameState.speeds.length-1]}x</div>
      </div>
    </div>
  `;
}

function renderServer() {
  const body = document.getElementById('modal-body');
  if (!GameState.upgrades.serverRack) {
    body.innerHTML = `<div style="text-align:center; padding:40px">
      <div style="font-size:48px; margin-bottom:20px">🔒</div>
      <h3>SERVER SYSTEM LOCKED</h3>
      <p style="color:var(--text-dim); margin-top:10px">Buy the <b>Server Rack</b> upgrade to unlock diskless management.</p>
    </div>`;
    return;
  }

  const healthColor = GameState.upgrades.serverHealth > 70 ? 'var(--success)' : GameState.upgrades.serverHealth > 30 ? 'var(--warn)' : 'var(--danger)';

  const currentLoad = GameState.upgrades.networkLoad;
  const maxBandwidth = GameState.currentNetworkCapacity;
  const loadColor = currentLoad < maxBandwidth * 0.7 ? 'var(--success)' : currentLoad < maxBandwidth * 0.9 ? 'var(--warn)' : 'var(--danger)';
  const congestionStatus = currentLoad > maxBandwidth ? 'CONGESTED' : 'NORMAL';

  body.innerHTML = `
    <div class="upgrade-grid">
      <div class="upgrade-card" style="grid-column: span 2">
        <div class="upgrade-name">SERVER STATUS: <span style="color:${healthColor}">${congestionStatus}</span></div>
        <div class="upgrade-name">SYSTEM HEALTH: <span style="color:${healthColor}">${Math.floor(GameState.upgrades.serverHealth)}%</span></div>
        <div class="staff-mood-bar" style="width:100%; height:10px"><div class="staff-mood-fill" style="width:${GameState.upgrades.serverHealth}%; background:${healthColor}"></div></div>
        <button class="upgrade-btn" style="margin-top:15px" onclick="startServerMaintenanceGame()">🔧 PERFORM MAINTENANCE (₱100)</button>
      </div>
      <div class="upgrade-card">
        <div class="upgrade-name">BANDWIDTH LOAD</div>
        <div style="font-family:var(--font-mono); font-size:12px; color:${loadColor}">${currentLoad} Mbps / ${maxBandwidth} Mbps</div>
      </div>
    </div>
  `;
}

let serverMaintenanceTimer = null;
let serverMaintenanceScore = 0;
let serverMaintenanceCommands = [];
let serverMaintenanceCurrentCommand = 0;

window.startServerMaintenanceGame = function() {
  if (GameState.cash < 100) { showToast('Not enough money!', 'warn'); return; }
  GameState.addCash(-100, '-₱100 maintenance');

  serverMaintenanceScore = 0;
  serverMaintenanceCurrentCommand = 0;
  serverMaintenanceCommands = [
    { cmd: 'clear_cache', hint: 'Clears temporary files' },
    { cmd: 'optimize_db', hint: 'Optimizes database performance' },
    { cmd: 'flush_dns', hint: 'Refreshes DNS records' },
    { cmd: 'restart_services', hint: 'Restarts critical services' },
    { cmd: 'check_logs', hint: 'Checks for system errors' },
  ].sort(() => Math.random() - 0.5).slice(0, 3); // 3 random commands

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <div style="font-family:var(--font-head); font-size:18px; color:var(--neon); margin-bottom:15px;">SERVER MAINTENANCE</div>
      <div id="server-command-display" style="background:#000; border:1px solid #333; padding:15px; margin-bottom:15px; font-family:var(--font-mono); font-size:14px; color:#0f0; text-align:left;"></div>
      <input type="text" id="server-command-input" style="width:100%; padding:10px; background:#000; border:1px solid var(--neon); color:#0f0; font-family:var(--font-mono); font-size:14px;" autofocus>
      <div id="server-timer" style="margin-top:10px; font-family:var(--font-mono); color:var(--warn);">Time: 10s</div>
    </div>
  `;

  const input = document.getElementById('server-command-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (input.value.trim() === serverMaintenanceCommands[serverMaintenanceCurrentCommand].cmd) {
        serverMaintenanceScore++;
        showToast('✅ Correct command!', 'success');
      } else {
        showToast('❌ Incorrect command!', 'danger');
      }
      serverMaintenanceCurrentCommand++;
      input.value = '';
      if (serverMaintenanceCurrentCommand < serverMaintenanceCommands.length) {
        displayNextServerCommand();
      } else {
        endServerMaintenanceGame();
      }
    }
  });

  displayNextServerCommand();
  let timeLeft = 10;
  document.getElementById('server-timer').textContent = `Time: ${timeLeft}s`;
  serverMaintenanceTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('server-timer').textContent = `Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(serverMaintenanceTimer);
      endServerMaintenanceGame();
    }
  }, 1000);
};

function displayNextServerCommand() {
  const cmdDisplay = document.getElementById('server-command-display');
  const cmd = serverMaintenanceCommands[serverMaintenanceCurrentCommand];
  cmdDisplay.innerHTML = `C:\\&gt; _<span style="color:var(--neon)">${cmd.cmd}</span>_<br><span style="color:var(--text-dim)">Hint: ${cmd.hint}</span>`;
  document.getElementById('server-command-input').focus();
}

function endServerMaintenanceGame() {
  clearInterval(serverMaintenanceTimer);
  const successRate = serverMaintenanceScore / serverMaintenanceCommands.length;
  let healthRestored = 0;
  if (successRate >= 0.8) {
    healthRestored = 100 - GameState.upgrades.serverHealth;
    GameState.upgrades.serverHealth = 100;
    GameState.addXP(50);
    showToast('🛠️ Server fully optimized!', 'success');
  } else if (successRate >= 0.4) {
    healthRestored = 50;
    GameState.upgrades.serverHealth = Math.min(100, GameState.upgrades.serverHealth + 50);
    GameState.addXP(20);
    showToast('🛠️ Server partially optimized.', 'warn');
  } else {
    healthRestored = 20;
    GameState.upgrades.serverHealth = Math.min(100, GameState.upgrades.serverHealth + 20);
    showToast('🛠️ Server optimization failed, minor improvements.', 'danger');
  }
  addEventLog(`Server maintenance: ${Math.floor(healthRestored)}% health restored.`);
  renderServer(); // Refresh the server modal
};
function renderReception() {
  const customer = currentModalData;
  const body = document.getElementById('modal-body');
  const freePCs = GameState.pcs.filter(p => !p.occupied && !p.broken);
  const desired = window.SESSION_TYPES[customer.desiredType];
  
  let html = `<div style="text-align:center; margin-bottom:15px">Customer wants to: <b style="color:var(--neon)">${desired.label}</b></div>`;
  
  if (freePCs.length === 0) {
    html += `<div style="color:var(--danger); text-align:center">No free PCs available!</div>`;
  } else {
    html += `<div class="upgrade-grid">`;
    
    // Only show session types that match machines we have free
    const availableTypes = Object.keys(window.SESSION_TYPES).filter(typeId => {
      if (typeId === 'vr') return GameState.pcs.some(p => p.type === 'vr' && !p.occupied && !p.broken);
      if (typeId === 'playstation') return GameState.pcs.some(p => p.type === 'ps' && !p.occupied && !p.broken);
      if (typeId === 'pisonet') return GameState.pcs.some(p => p.type === 'pisonet' && !p.occupied && !p.broken) && GameState.upgrades.pisonetMode;
      if (typeId === 'vip') return GameState.pcs.some(p => p.isVIP && !p.occupied && !p.broken);
      // Standard PC sessions
      return GameState.pcs.some(p => p.type === 'pc' && !p.isVIP && !p.occupied && !p.broken);
    });

    availableTypes.forEach(typeId => {
      const type = window.SESSION_TYPES[typeId];
      const isDesired = typeId === customer.desiredType;
      const machine = GameState.pcs.find(p => !p.occupied && !p.broken && (
        (typeId === 'vr' && p.type === 'vr') || 
        (typeId === 'playstation' && p.type === 'ps') ||
        (typeId === 'pisonet' && p.type === 'pisonet') ||
        (typeId === 'vip' && p.isVIP) ||
        (!['vr','playstation','pisonet','vip'].includes(typeId) && p.type === 'pc' && !p.isVIP)
      ));

      html += `<div class="upgrade-card" style="cursor:pointer; border-color: ${isDesired ? 'var(--neon3)' : 'var(--border)'}" onclick="assignAndClose('${typeId}')">
        <div class="upgrade-name">${type.label}</div>
        <div class="upgrade-desc">Rate: ₱${type.rate}/session hr</div>
        <div style="font-size:10px; color:var(--neon)">CLICK TO ASSIGN TO PC #${machine.id+1}</div>
      </div>`;
    });
    html += `</div>`;
  }
  body.innerHTML = html;
}

window.assignAndClose = function(typeId) {
  const customer = currentModalData;
  const machine = GameState.pcs.find(p => !p.occupied && !p.broken && (
    (typeId === 'vr' && p.type === 'vr') || 
    (typeId === 'playstation' && p.type === 'ps') ||
    (typeId === 'pisonet' && p.type === 'pisonet') ||
    (typeId === 'vip' && p.isVIP) ||
    (!['vr','playstation','pisonet','vip'].includes(typeId) && p.type === 'pc' && !p.isVIP)
  ));
  
  if (machine) {
    CustomerSystem.assignPC(customer, machine, typeId);
    closeModal();
  }
};

function renderCredits() {
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div style="text-align:center; line-height:2">
      <div style="font-family:var(--font-head); color:var(--neon); margin-bottom:10px">NETZONE TEAM</div>
      <p>Lead Developer — Eiji DEV</p>
      <p>Graphics Engine — Three.js, CSS</p>
      <p>UI/UX Design — Eiji DEV, Rohan, Chiongki</p>
      <div style="margin-top:20px; font-size:12px; color:var(--text-dim)">Special thanks to all the devs that's keeping us inspired!</div>
    </div>
  `;
}

let pancitStep = 0;
const PANCIT_STEPS = [
  { label: '🔥 BOIL WATER', icon: '💧' },
  { label: '🍜 ADD NOODLES', icon: '🍲' },
  { label: '🧹 DRAIN WATER', icon: '🥣' },
  { label: '✨ MIX SEASONING', icon: '🧂' }
];

function renderPancitMinigame() {
  pancitStep = 0;
  updatePancitUI();
}

function updatePancitUI() {
  const body = document.getElementById('modal-body');
  if (!body) return;

  if (pancitStep >= PANCIT_STEPS.length) {
    const profit = 150;
    GameState.addCash(profit, '+₱' + profit + ' bonus sales');
    GameState.addXP(40);
    body.innerHTML = `
      <div style="text-align:center; padding:20px">
        <div style="font-size:48px; margin-bottom:12px">😋</div>
        <h3 style="color:var(--success)">Luto na ang Pancit Canton!</h3>
        <p style="color:var(--text-dim); margin-top:10px">You earned ₱${profit} from extra sales!</p>
        <button class="upgrade-btn" style="margin-top:20px" onclick="closeModal()">Salamat Boss!</button>
      </div>`;
    return;
  }

  const step = PANCIT_STEPS[pancitStep];
  body.innerHTML = `
    <div style="text-align:center; padding:20px">
      <div style="font-size:64px; margin-bottom:20px">${step.icon}</div>
      <h3 style="color:var(--neon); margin-bottom:15px">STEP ${pancitStep + 1}: ${step.label}</h3>
      <div class="staff-mood-bar" style="width:100%; height:12px; margin-bottom:20px">
        <div class="staff-mood-fill" style="width:${(pancitStep / PANCIT_STEPS.length) * 100}%; background:var(--neon)"></div>
      </div>
      <button class="menu-btn primary" style="width:100%; padding:15px" onclick="nextPancitStep()">
        CLICK TO ${step.label}
      </button>
      <p style="color:var(--text-dim); font-size:11px; margin-top:15px">Hurry! The customers are hungry!</p>
    </div>`;
}

window.nextPancitStep = function() {
  pancitStep++;
  updatePancitUI();
};

window.toggleTurboCooling = function() {
  GameState.upgrades.turboCooling = !GameState.upgrades.turboCooling;
  showToast(GameState.upgrades.turboCooling ? '❄️ Turbo Cooling ON (₱30/hr)' : '❄️ Turbo Cooling OFF', 'info');
  renderManagerStats();
};

window.toggleFlashlight = function() {
  if (window.CameraSystem) CameraSystem.toggleFlashlight();
  document.getElementById('btn-flashlight').classList.toggle('active', CameraSystem.flashlight);
};

window.toggleChat = function() {
  document.getElementById('chat-sidebar').classList.toggle('chat-collapsed');
  document.getElementById('chat-toggle-btn').textContent = document.getElementById('chat-sidebar').classList.contains('chat-collapsed') ? '▶' : '◀';
};

window.payBill = function(billId) {
  const billIdx = GameState.upgrades.unpaidBills.findIndex(b => b.id === billId);
  const bill = GameState.upgrades.unpaidBills[billIdx];
  if (GameState.cash < bill.amount) { showToast('Kulang ang pera, boss!', 'danger'); return; }
  GameState.addCash(-bill.amount, 'Paid ' + bill.label);
  GameState.upgrades.unpaidBills.splice(billIdx, 1);
  renderManagerStats();
};

function renderManagerStats() {
  const body = document.getElementById('modal-body');
  
  let html = `
    <div class="staff-section-title">⚖️ PHILIPPINE GOVERNMENT & UTILITY BILLS</div>
    <div class="staff-list" style="margin-bottom:20px;">
      ${GameState.upgrades.unpaidBills.length === 0 ? '<div style="color:var(--success); font-size:11px; text-align:center; padding:10px;">Walang utang! All bills paid.</div>' : 
        GameState.upgrades.unpaidBills.map(b => `
          <div class="staff-card" style="border-color:var(--danger)">
            <div style="flex:1">
              <div class="staff-name" style="color:var(--danger)">${b.label}</div>
              <div style="font-size:10px; color:var(--text-dim)">Kailangang bayaran: ₱${b.amount.toLocaleString()}</div>
            </div>
            <button class="hire-btn" style="border-color:var(--success); color:var(--success)" onclick="payBill('${b.id}')">PAY NOW</button>
          </div>
        `).join('')}
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
      <div class="upgrade-card" style="grid-column: span 2; border-color:var(--gold)">
        <div class="upgrade-name">SYSTEMS OVERRIDE</div>
        <button class="upgrade-btn" style="border-color:${GameState.upgrades.turboCooling?'var(--neon)':'var(--border)'}" onclick="toggleTurboCooling()">
          ${GameState.upgrades.turboCooling ? '❄️ TURBO COOLING: ACTIVE' : '❄️ ACTIVATE TURBO COOLING'}
        </button>
      </div>

      ${GameState.upgrades.socialMedia ? `
        <button class="upgrade-btn" style="margin-top:15px; border-color:var(--neon3); color:var(--neon3)" onclick="openModal('socialMedia')">
          📱 MANAGE SOCIAL MEDIA
        </button>` : ''}

      <div class="upgrade-card" style="border-color:var(--neon)">
        <div class="upgrade-name">CAFE PERFORMANCE</div>
        <div style="font-family:var(--font-mono); font-size:11px; line-height:1.8">
          Total Customers: ${GameState.stats.totalCustomers}<br>
          Total Earned: ₱${GameState.stats.totalEarned.toLocaleString()}<br>
          Days Operated: ${GameState.stats.daysPlayed}
        </div>
      </div>
      <div class="upgrade-card" style="border-color:var(--neon2)">
        <div class="upgrade-name">LIVE NETWORK</div>
        <div style="font-family:var(--font-mono); font-size:11px; line-height:1.8">
          Network Load: ${GameState.upgrades.networkLoad} Mbps<br>
          Total Capacity: ${GameState.currentNetworkCapacity} Mbps<br>
          Server Health: ${Math.floor(GameState.upgrades.serverHealth)}%
        </div>
      </div>
    </div>
    
    <div class="staff-section-title">⭐ CAFE RATING & REVIEWS (${GameState.rating.toFixed(1)} / 5.0)</div>
    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; max-height:150px; overflow-y:auto; margin-bottom:20px;">
      ${GameState.reviews.length === 0 ? '<div style="text-align:center; color:var(--text-dim); font-size:11px">No reviews yet.</div>' : 
        GameState.reviews.map(r => `
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:6px 0; font-size:11px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--neon3)">${r.name}</span>
              <span style="color:var(--gold)">${'⭐'.repeat(r.stars)}</span>
            </div>
            <div style="color:var(--text); font-style:italic">"${r.comment}"</div>
            <div style="color:var(--text-dim); font-size:9px">Day ${r.day}</div>
          </div>
        `).join('')}
    </div>

    <div class="staff-section-title">REMOTE STAFF MONITORING</div>
    <div class="staff-list">
  `;

  if (GameState.staff.length === 0) {
    html += '<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:12px">No employees detected on network.</div>';
  } else {
    html += GameState.staff.map(e => `
      <div class="staff-card" style="padding:10px 14px; background:rgba(0,0,0,0.2)">
        <div style="font-size:22px">${e.icon}</div>
        <div class="staff-info">
          <div class="staff-name" style="font-size:11px">${e.name} (${e.role})</div>
          <div class="staff-stats" style="font-size:9px">
            Mood: ${e.mood}% | Skill: ${e.skill} | Loyalty: ${e.loyalty}%
          </div>
        </div>
        <div style="color:var(--neon); font-family:var(--font-mono); font-size:10px; text-transform:uppercase">
          ● ${e.state}
        </div>
      </div>`).join('');
  }

  html += '</div><button class="upgrade-btn" style="margin-top:20px; border-color:var(--danger); color:var(--danger)" onclick="closeModal()">EXIT TERMINAL</button>';
  body.innerHTML = html;
}

window.respondToReview = function(reviewId) {
  const cost = 20;
  if (GameState.cash < cost) { showToast('Not enough money to respond!', 'warn'); return; }
  
  const review = GameState.reviews.find(r => r.id === reviewId);
  if (!review) return;

  GameState.addCash(-cost, '-₱' + cost + ' social media');
  review.responded = true;

  // Reputation boost based on original stars, doubled if Verified
  const baseBoost = review.stars < 3 ? 2 : 5;
  const repBoost = GameState.upgrades.verifiedBadge ? baseBoost * 2 : baseBoost;
  GameState.addReputation(repBoost);
  showToast(`💬 Responded to review! +${repBoost} Rep`, 'success');
  renderSocialMedia();
};

function renderSocialMedia() {
  const body = document.getElementById('modal-body');
  
  let html = `
    <div class="staff-section-title">RECENT CUSTOMER REVIEWS</div>
    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; max-height:400px; overflow-y:auto; margin-bottom:20px;">
      ${GameState.reviews.length === 0 ? '<div style="text-align:center; color:var(--text-dim); font-size:11px">No reviews yet.</div>' : 
        GameState.reviews.map(r => `
          <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:10px 0; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--neon3); font-weight:bold;">${r.name}</span>
              <span style="color:var(--gold)">${'⭐'.repeat(r.stars)}</span>
            </div>
            <div style="color:var(--text); font-style:italic; margin-bottom:8px;">"${r.comment}"</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="color:var(--text-dim); font-size:10px">Day ${r.day}</div>
              ${r.responded ? '<span style="color:var(--success); font-size:10px;">✅ Responded</span>' :
                              `<button class="upgrade-btn" style="padding:4px 8px; font-size:10px;" onclick="respondToReview('${r.id}')">RESPOND (₱20)</button>`}
            </div>
          </div>
        `).join('')}
    </div>
    <button class="upgrade-btn" style="margin-top:10px; border-color:var(--danger); color:var(--danger)" onclick="closeModal()">CLOSE</button>
  `;
  body.innerHTML = html;
}
