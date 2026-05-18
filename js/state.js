/* ===== GAME STATE ===== */
window.MARKET_TRENDS = [
  { id: 'stable', name: 'Stable Market', icon: '📈', desc: 'Standard earnings across all PCs.', qualityRange: [-1, -1], bonus: 0 },
  { id: 'fps', name: 'FPS Mania', icon: '🔫', desc: 'High-end PCs (Lv.3+) earn 50% more!', qualityRange: [3, 4], bonus: 0.5 },
  { id: 'mmo', name: 'MMO Grind', icon: '⚔️', desc: 'Mid-to-high PCs (Lv.2+) earn 30% more!', qualityRange: [2, 4], bonus: 0.3 },
  { id: 'indie', name: 'Indie Gems', icon: '🕹️', desc: 'Entry-level PCs (Lv.0-2) earn 40% more!', qualityRange: [0, 2], bonus: 0.4 },
  { id: 'retro', name: 'Retro Vibes', icon: '👾', desc: 'Retro PCs (Lv.0-1) earn 25% more!', qualityRange: [0, 1], bonus: 0.25 },
  { id: 'br', name: 'BR Frenzy', icon: '🚁', desc: 'Elite PCs (Lv.4) earn 70% more!', qualityRange: [4, 4], bonus: 0.7 }
];

window.SESSION_TYPES = {
  gaming:   { label: 'Gaming',   rate: 30, xp: 20 },
  browsing: { label: 'Browsing', rate: 15, xp: 10 },
  printing: { label: 'Printing', rate: 20, xp: 15 },
  vr:       { label: 'VR Session', rate: 100, xp: 60 },
  playstation: { label: 'Console',  rate: 60, xp: 35 },
  pisonet:  { label: 'Piso Net', rate: 10, xp: 5 },
  vip:      { label: 'VIP Gaming', rate: 200, xp: 100 }
};

window.GameState = {
  cafeName: "NetZone",
  cash: 500,
  xp: 0,
  level: 1,
  xpThresholds: [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000],
  reputation: 0,
  day: 1,
  hour: 8,
  minute: 0,
  weather: 'clear',
  paused: false,
  speed: 1,
  speeds: [1,3,10],
  speedIdx: 0,
  saveVersion: 2, // Upgraded versioning
  dayFinished: false,
  closingTime: false,
  dailyIncome: 0,
  dailyExpenses: 0,
  hourlyIncomeLog: [], // Array to store profit snapshots every hour
  tickMs: 2000, // 1 game hour = 2 real seconds at 1x

  pcs: [],        // placed PC objects
  customers: [],  // active customer objects
  staff: [],      // hired staff
  skills: {},     // unlocked skill IDs

  upgrades: {
    internet: 0,   // 0-4
    pcQuality: 0,  // 0-4
    lighting: false,
    aircon: false,
    snackbar: false,
    security: false,
    neon: false,
    serverRack: false,
    vending: false,
    vendingJammed: false,
    coffeeMachine: false,
    serverLevel: 1,
    networkLoad: 0, // Current network usage in Mbps
    networkCapacity: 100, // Max bandwidth in Mbps
    networkLevel: 1,
    serverHealth: 100,
    soundproofing: false,
    ergonomicChairs: false,
    wallColor: 0,
    floorPattern: 0,
    securityCameras: false,
    pancitCooker: false,
    staffLounge: false,
    socialMedia: false,
    verifiedBadge: false,
    unpaidBills: [], // { id, label, amount, dueDate }
    totalPowerUsage: 0 
  },

  stats: {
    totalEarned: 0,
    totalCustomers: 0,
    lanParties: 0,
    daysPlayed: 0,
  },

  achievements: {},
  loginStreak: 0,
  lastLogin: null,
  difficulty: 'normal',
  playtime: 0,    // seconds
  activeTimer: null,
  tickCallbacks: [],
    lanPartyCooldownHours: 0,
    currentTrendId: 'stable',
    pendingPayments: [],
    trash: [],

    get maxCustomers() {
      return Math.max(1, Math.floor(this.pcs.filter(p => !p.broken).length * 1.1));
    },
    get currentDate() {
      const year = Math.floor((this.day - 1) / 360) + 1;
      const month = Math.floor(((this.day - 1) % 360) / 30) + 1;
      const day = ((this.day - 1) % 30) + 1;
      return { day, month, year };
    },
    getXPThreshold(lv) {
      if (lv < this.xpThresholds.length) return this.xpThresholds[lv];
      return Math.floor(4000 + (lv - 9) * 1000 * Math.pow(1.15, lv - 10));
    },
    get hourlyIncome() {
      const mult = this.upgrades.pancitCooker ? 2 : 1;
      let income = this.upgrades.snackbar ? 50 * mult : 0;
      if (this.upgrades.vending && !this.upgrades.vendingJammed) income += 80;
      return income;
    },
    get rating() {
      const cleanliness = Math.max(0, 5 - (this.trash.length * 0.4));
      return Math.min(5, Math.max(0, cleanliness));
    },
    get ratingStars() {
      const r = Math.round(this.rating);
      return '⭐'.repeat(r) + '☆'.repeat(5 - r);
    },
    get currentNetworkCapacity() {
      return 100 + (this.upgrades.networkLevel * 100);
    },
    get staffWages() {
      return this.staff.reduce((s, e) => s + e.salary, 0);
    },

  nextDay() {
    this.dayFinished = false;
    this.checkWeeklyBills();
    this.closingTime = false;
    this.paused = false;
    this.hour = 8;
    this.minute = 0;
    this.dailyIncome = 0;
    this.dailyExpenses = 0;
    this.hourlyIncomeLog = [];
    this.day++;
    this.stats.daysPlayed++;
    onNewDay();
    updateHUD();
  },

  addCash(amt, label, x, y) {
    this.cash = Math.max(0, this.cash + amt);
    this.stats.totalEarned += Math.max(0, amt);
    if (amt > 0) this.dailyIncome += amt;
    else this.dailyExpenses += Math.abs(amt);
    updateHUD();
    if (label) spawnFloatPop(label, x || window.innerWidth/2, y || window.innerHeight/2, amt < 0);
  },

  checkWeeklyBills() {
    if (this.day % 7 === 0) {
      const tax = Math.floor(this.dailyIncome * 0.12); // 12% VAT logic
      this.upgrades.unpaidBills.push({ id: 'bir_'+this.day, label: 'BIR Monthly Tax', amount: tax || 250 });
    }
    if (this.day % 30 === 0) {
      this.upgrades.unpaidBills.push({ id: 'permit_'+this.day, label: 'Mayor\'s Business Permit', amount: 1500 });
    }
  },

  addXP(amt) {
    this.xp += amt;
    while (this.xp >= this.getXPThreshold(this.level)) {
      this.level++;
      onLevelUp(this.level);
    }
    updateHUD();
  },

  addReputation(amt) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + amt));
    updateHUD();
  },

  cycleSpeed() {
    this.speedIdx = (this.speedIdx + 1) % this.speeds.length;
    this.speed = this.speeds[this.speedIdx];
    document.getElementById('btn-speed').textContent = this.speed + 'x';
    restartTick();
  },

  updateMarketTrend() {
    // 20% chance to shift trend every hour
    if (Math.random() < 0.2) {
      const newTrend = window.MARKET_TRENDS[Math.floor(Math.random() * window.MARKET_TRENDS.length)];
      if (newTrend.id !== this.currentTrendId) {
        this.currentTrendId = newTrend.id;
        addEventLog(`📈 Market Shift: ${newTrend.name}`);
        showToast(`${newTrend.icon} Trend: ${newTrend.name}`, 'info');
        if (window.SoundManager) window.SoundManager.updateMusic();
      }
    }
  },

  onTick(fn) {
    this.tickCallbacks.push(fn);
  },

  serialize() {
    return {
      saveVersion: 1,
      cafeName: this.cafeName,
      cash: this.cash, xp: this.xp, level: this.level,
      reputation: this.reputation,
      day: this.day, hour: this.hour,
      pcs: this.pcs.map(p => ({ 
        x: p.group.position.x, 
        z: p.group.position.z, 
        rotation: p.group.rotation.y, 
        quality: p.quality, 
        broken: p.broken, 
        underMaintenance: p.underMaintenance,
        type: p.type 
      })),
      staff: this.staff.map(s => ({ ...s, mesh: undefined })),
      skills: this.skills,
      upgrades: { ...this.upgrades },
      stats: { ...this.stats },
      achievements: { ...this.achievements },
      loginStreak: this.loginStreak,
      lastLogin: this.lastLogin,
      difficulty: this.difficulty,
      playtime: this.playtime,
      lanPartyCooldownHours: this.lanPartyCooldownHours,
      currentTrendId: this.currentTrendId,
      vendingJammed: this.upgrades.vendingJammed,
      networkLoad: this.upgrades.networkLoad,
      networkCapacity: this.upgrades.networkCapacity,
      weather: this.weather,
      wallColor: this.upgrades.wallColor,
      soundproofing: this.upgrades.soundproofing,
      ergonomicChairs: this.upgrades.ergonomicChairs,
      floorPattern: this.upgrades.floorPattern,
      securityCameras: this.upgrades.securityCameras,
      pancitCooker: this.upgrades.pancitCooker,
      staffLounge: this.upgrades.staffLounge,
      socialMedia: this.upgrades.socialMedia,
      verifiedBadge: this.upgrades.verifiedBadge,
      serverHealth: this.upgrades.serverHealth,
      trash: this.trash,
      reviews: this.reviews
    };
  },

  restore(data) {
    if (!data || typeof data !== 'object') return;
    Object.assign(this, {
      cafeName: data.cafeName || "NetZone",
      cash: data.cash, xp: data.xp, level: data.level,
      reputation: data.reputation,
      day: data.day, hour: data.hour,
      pcs: data.pcs || [],
      staff: data.staff || [],
      skills: data.skills || {},
      upgrades: { ...this.upgrades, ...(data.upgrades || {}) },
      stats: { ...this.stats, ...(data.stats || {}) },
      achievements: data.achievements || {},
      loginStreak: data.loginStreak || 0,
      lastLogin: data.lastLogin || null,
      difficulty: data.difficulty || 'normal',
      playtime: data.playtime || 0,
      lanPartyCooldownHours: data.lanPartyCooldownHours || 0,
      currentTrendId: data.currentTrendId || 'stable',
      vendingJammed: data.vendingJammed || false,
      networkLoad: data.networkLoad || 0,
      networkCapacity: data.networkCapacity || 100,
      weather: data.weather || 'clear',
      wallColor: data.wallColor || 0,
      soundproofing: data.soundproofing || false,
      ergonomicChairs: data.ergonomicChairs || false,
      floorPattern: data.floorPattern || 0,
      securityCameras: data.securityCameras || false,
      pancitCooker: data.pancitCooker || false,
      staffLounge: data.staffLounge || false,
      serverHealth: data.serverHealth || 100,
      socialMedia: data.socialMedia || false,
      verifiedBadge: data.verifiedBadge || false,
      trash: data.trash || [],
      reviews: data.reviews || []
    });
  }
};

// ===== GAME LOOP =====
let tickInterval = null;

function startTick() {
  tickInterval = setInterval(gameTick, GameState.tickMs / GameState.speed);
}

function restartTick() {
  clearInterval(tickInterval);
  startTick();
}

function togglePause() {
  GameState.paused = !GameState.paused;
  document.querySelector('.hud-btn[onclick="togglePause()"]').textContent = GameState.paused ? '▶' : '⏸';
}

function gameTick() {
  if (GameState.paused || GameState.dayFinished) return;

  // Advance time
  GameState.minute += 10;
  if (GameState.minute >= 60) {
    GameState.minute = 0;
    GameState.hour++;
    onHourTick();
  }

  if (GameState.hour >= 24) {
    GameState.hour = 24;
    GameState.closingTime = true;
  }

  if (GameState.closingTime && GameState.customers.length === 0 && !GameState.dayFinished) {
    GameState.dayFinished = true;
    GameState.paused = true;
    openModal('dayEnd');
    return;
  }

  GameState.playtime += GameState.tickMs / 1000;
  updateHUD();
  GameState.tickCallbacks.forEach(fn => fn());
}

function onHourTick() {
  // Hourly income
  const income = GameState.hourlyIncome;
  if (income > 0) {
    GameState.addCash(income, '+₱' + income);
  }

  // Log hourly net profit (Income - Expenses) for the chart
  const currentNet = GameState.dailyIncome - GameState.dailyExpenses;
  GameState.hourlyIncomeLog.push(currentNet);
  
  // Process customers and collect session stats
  GameState.stats.totalCustomers += CustomerSystem.tickCustomers();

  // Server Health Decay
  if (GameState.upgrades.serverRack) {
    GameState.upgrades.serverHealth = Math.max(0, GameState.upgrades.serverHealth - (1 + Math.random() * 2));
    if (GameState.upgrades.serverHealth < 20) {
      showToast('⚠️ Server is overheating! Performance dropping!', 'danger');
      GameState.addReputation(-1);
    }
    if (GameState.upgrades.serverHealth < 5) { // Critical failure
      showToast('❌ SERVER CRITICAL! Customers leaving!', 'danger');
      GameState.addReputation(-1);
    }
  }

  // Network Congestion
  GameState.upgrades.networkLoad = GameState.customers.filter(c => c.state === 'active').length * 10; // 10 Mbps per active customer
  if (GameState.upgrades.networkLoad > GameState.currentNetworkCapacity) {
    const overload = GameState.upgrades.networkLoad - GameState.currentNetworkCapacity;
    const penalty = Math.min(5, Math.floor(overload / 20)); // Lose 1 rep for every 20Mbps overload
    GameState.addReputation(-penalty);
    showToast(`Slow internet! -${penalty} rep`, 'danger');
    addEventLog(`📡 Network congested! -${penalty} reputation.`);
  }

  // Weather System
  if (Math.random() < 0.15) {
    const newWeather = Math.random() < 0.25 ? 'rain' : 'clear';
    if (newWeather !== GameState.weather) {
      GameState.weather = newWeather;
      SceneManager.updateWeatherVisuals(newWeather);
      addEventLog(newWeather === 'rain' ? "🌧️ It started raining outside." : "☀️ The rain has stopped.");
    }
  }


  // Trash penalty
  if (GameState.trash.length > 0) GameState.addReputation(-0.5 * GameState.trash.length);

  // Rating Impact: High rating boosts reputation, low rating drains it
  const ratingImpact = (GameState.rating - 3) * 0.2;
  GameState.addReputation(ratingImpact);

  // Check for market shift
  GameState.updateMarketTrend();

  // Wage deduction every 8 hours
  if (GameState.hour % 8 === 0 && GameState.staffWages > 0) {
    const wages = Math.floor(GameState.staffWages / 3);
    GameState.addCash(-wages, '-₱' + wages + ' wages');
  }

  // Random events
  if (Math.random() < 0.04) triggerRandomEvent();

  // Rivals tick
  RivalSystem.tick();

  // LAN party cooldown tick
  if (GameState.lanPartyCooldownHours > 0) {
    GameState.lanPartyCooldownHours--;
    if (GameState.lanPartyCooldownHours === 0) {
      showToast('🎉 LAN Party available again!', 'info');
    }
  }

  // Check achievements
  checkAchievements();
}

function onNewDay() {
  addEventLog('📅 Day ' + GameState.day + ' begins!');
  StaffSystem.dailyMoodUpdate();
  RivalSystem.dailyGrowth();
  showToast('New Day! Day ' + GameState.day, 'info');
}

function onLevelUp(lv) {
  showToast('🎉 LEVEL UP! Now Level ' + lv, 'success');
  addEventLog('🎉 Reached Level ' + lv + '!');
  GameState.addReputation(5);
  if (lv === 15 || lv === 25) { // Trigger dynamic elements on specific levels
    SceneManager.addDynamicSceneElements();
    SceneManager.addConstructionSlots();
  }
}

// ===== RANDOM EVENTS =====
const RANDOM_EVENTS = [
  { id:'power_surge',  icon:'⚡', title:'Power Surge!',    desc:'A power surge damaged some PCs!',    fn: () => { const pc = GameState.pcs[Math.floor(Math.random()*GameState.pcs.length)]; if(pc){pc.broken=true; SceneManager.updatePC(pc);} GameState.addReputation(-3); } },
  { id:'brownout',     icon:'🌑', title:'Brownout!',       desc:'PH Style brownout! Everything is off.', fn: () => { GameState.paused = true; setTimeout(() => { GameState.paused = false; showToast('Power Restored!', 'success'); }, 5000); GameState.addReputation(-5); } },
  { id:'outage',       icon:'📡', title:'ISP Outage!',     desc:'PLDT/Globe is down again...',         fn: () => { GameState.addCash(-50,'Lost -₱50'); GameState.addReputation(-5); } },
  { id:'influencer',   icon:'📸', title:'Influencer Visit!',desc:'A streamer visited your cafe!',      fn: () => { GameState.addReputation(10); GameState.addCash(200,'+₱200 hype'); GameState.addXP(50); } },
  { id:'news_feature', icon:'📰', title:'News Feature!',   desc:'Local news covered your cafe!',       fn: () => { GameState.addReputation(8); GameState.addXP(40); } },
  { id:'malware',      icon:'🦠', title:'Malware Attack!', desc:'A PC got infected! Clean it.',       fn: () => { const pc = GameState.pcs.find(p=>!p.broken); if(pc) VirusGame.trigger(pc); } },
  { id:'esports_spon', icon:'🏆', title:'Esports Sponsor!',desc:'You got an esports sponsorship!',    fn: () => { GameState.addCash(500,'+₱500 sponsor'); GameState.addXP(80); } },
  { id:'night_rush',   icon:'🌙', title:'Night Rush!',     desc:'Gamers flooded in after midnight!',  fn: () => { GameState.addCash(150,'+₱150 rush'); CustomerSystem.spawnBurst(3); } },
  { id:'school_rush',  icon:'🎒', title:'School Rush!',    desc:'Classes are out! Students incoming.', fn: () => { CustomerSystem.spawnBurst(6); GameState.addReputation(2); } },
  { id:'typhoon',      icon:'🌀', title:'Typhoon!',        desc:'Heavy rain. Less customers, but loyal ones stay.', fn: () => { GameState.addReputation(5); } },
  { id:'corrupted_update', icon:'💾', title:'Update Error!', desc:'A game update got corrupted on the server!', fn: () => { if(GameState.upgrades.serverRack) GameState.upgrades.serverHealth -= 30; } },
  { id:'tax_season',   icon:'💸', title:'Tax Season!',     desc:'Paid 10% of total earnings in taxes.', fn: () => { const tax = Math.floor(GameState.stats.totalEarned * 0.1); GameState.addCash(-tax, `Paid ₱${tax} tax`); } },
  { id:'review_bomb',  icon:'💣', title:'Review Bomb!',    desc:'Rivals are flooding you with negative reviews!', fn: () => { for(let i=0;i<5;i++){ GameState.reviews.unshift({ id:Date.now()+Math.random(), stars:1, comment:"Mabagal net, pangit dito!", name:"Hater_"+Math.floor(Math.random()*99), day:GameState.day, responded:false }); } GameState.addReputation(-5); } },
];

function triggerRandomEvent() {
  const evt = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  evt.fn();
  addEventLog(evt.icon + ' ' + evt.title + ' — ' + evt.desc);
  showToast(evt.icon + ' ' + evt.title, evt.id === 'outage' || evt.id === 'power_surge' || evt.id === 'malware' ? 'danger' : 'success');
}

// ===== ACHIEVEMENTS =====
const ACHIEVEMENTS = [
  { id:'first_pc',     icon:'🖥️', name:'First Boot',      desc:'Place your first PC',        check: () => GameState.pcs.length >= 1,         reward: 50 },
  { id:'pc_five',      icon:'🖥️', name:'PC Farm',         desc:'Own 5 PCs',                  check: () => GameState.pcs.length >= 5,         reward: 100 },
  { id:'pc_ten',       icon:'💻', name:'LAN Central',     desc:'Own 10 PCs',                 check: () => GameState.pcs.length >= 10,        reward: 200, isGolden: true },
  { id:'pc_25',        icon:'🏢', name:'Tech Empire',     desc:'Own 25 stations',            check: () => GameState.pcs.length >= 25,        reward: 500, isGolden: true },
  { id:'pc_50',        icon:'🏙️', name:'Net King',         desc:'Own 50 stations',            check: () => GameState.pcs.length >= 50,        reward: 1500, isGolden: true },
  { id:'pc_100',       icon:'🏰', name:'Unstoppable',     desc:'Own 100 stations',           check: () => GameState.pcs.length >= 100,       reward: 5000, isGolden: true },
  { id:'cash_1k',      icon:'💰', name:'Making Bank',     desc:'Earn ₱1,000 total',          check: () => GameState.stats.totalEarned >= 1000, reward: 100 },
  { id:'cash_10k',     icon:'💵', name:'Big Money',       desc:'Earn ₱10,000 total',         check: () => GameState.stats.totalEarned >= 10000, reward: 500, isGolden: true },
  { id:'cash_50k',     icon:'💸', name:'Rich Manager',    desc:'Earn ₱50,000 total',         check: () => GameState.stats.totalEarned >= 50000, reward: 1200 },
  { id:'cash_100k',    icon:'💳', name:'Six Figures',      desc:'Earn ₱100,000 total',        check: () => GameState.stats.totalEarned >= 100000, reward: 2500, isGolden: true },
  { id:'cash_1m',      icon:'💎', name:'The Millionaire',  desc:'Earn ₱1,000,000 total',      check: () => GameState.stats.totalEarned >= 1000000, reward: 10000, isGolden: true },
  { id:'cust_100',     icon:'👣', name:'Getting Noticed', desc:'Serve 100 customers',        check: () => GameState.stats.totalCustomers >= 100, reward: 200 },
  { id:'cust_1k',      icon:'🚶', name:'Busy Bees',       desc:'Serve 1,000 customers',       check: () => GameState.stats.totalCustomers >= 1000, reward: 1000, isGolden: true },
  { id:'cust_10k',     icon:'🎪', name:'Tourist Spot',    desc:'Serve 10,000 customers',      check: () => GameState.stats.totalCustomers >= 10000, reward: 5000, isGolden: true },
  { id:'lan_party',    icon:'🎉', name:'Party Host',      desc:'Host a LAN Party',           check: () => GameState.stats.lanParties >= 1,   reward: 150 },
  { id:'lan_party5',   icon:'🎊', name:'LAN King',        desc:'Host 5 LAN Parties',         check: () => GameState.stats.lanParties >= 5,   reward: 500, isGolden: true },
  { id:'rep_50',       icon:'⭐', name:'Local Legend',    desc:'Reach 50 reputation',         check: () => GameState.reputation >= 50,        reward: 200 },
  { id:'rep_100',      icon:'🌟', name:'Legendary Cafe',  desc:'Max reputation!',            check: () => GameState.reputation >= 100,       reward: 1000, isGolden: true },
  { id:'level_5',      icon:'🎮', name:'Pro Manager',     desc:'Reach Level 5',              check: () => GameState.level >= 5,             reward: 250 },
  { id:'level_20',     icon:'🎓', name:'Veteran Owner',   desc:'Reach Level 20',             check: () => GameState.level >= 20,            reward: 2000, isGolden: true },
  { id:'level_50',     icon:'👑', name:'God-Tier Manager',desc:'Reach Level 50',             check: () => GameState.level >= 50,            reward: 10000, isGolden: true },
  { id:'survive_week', icon:'📅', name:'Week One',        desc:'Survive 7 days',             check: () => GameState.stats.daysPlayed >= 7,  reward: 300 },
  { id:'month_one',    icon:'🌕', name:'Monthly Cycle',   desc:'Survive 30 days',            check: () => GameState.stats.daysPlayed >= 30, reward: 1000 },
  { id:'year_one',     icon:'⏳', name:'Anniversary',     desc:'Survive 1 year (360 days)',  check: () => GameState.stats.daysPlayed >= 360, reward: 10000, isGolden: true },
  { id:'hire_staff',   icon:'👔', name:'Boss Mode',       desc:'Hire your first employee',   check: () => GameState.staff.length >= 1,      reward: 100 },
  { id:'staff_full',   icon:'🤝', name:'The Whole Crew',  desc:'Hire 10 employees',          check: () => GameState.staff.length >= 10,     reward: 800, isGolden: true },
  { id:'chef_pancit',  icon:'🍜', name:'Chef de Canton',  desc:'Buy the Canton Cooker',      check: () => GameState.upgrades.pancitCooker,  reward: 300 },
];

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (!GameState.achievements[a.id] && a.check()) {
      GameState.achievements[a.id] = { unlocked: true, viewed: false };
      GameState.addCash(a.reward, '+₱' + a.reward + ' bonus');
      GameState.addXP(50);
      showAchievementPop(a);
      SceneManager.updateHallOfFame();
    }
  });
}

// ===== LAN PARTY =====
function hostLanParty() {
  if (GameState.pcs.length < 4) { showToast('Need at least 4 PCs for a LAN Party!', 'warn'); return; }
  if (GameState.cash < 100) { showToast('Need ₱100 to host a LAN Party!', 'warn'); return; }
  if (GameState.lanPartyCooldownHours > 0) {
    showToast('⏳ Next LAN Party in ' + GameState.lanPartyCooldownHours + ' game-hours!', 'warn');
    return;
  }

  GameState.addCash(-100, '-₱100 setup');
  GameState.stats.lanParties++;

  // Prize is capped: base ₱150 + PC count + internet + reputation (max ₱600)
  const basePrize = 150;
  const pcBonus = Math.min(GameState.pcs.length, 12) * 20; // max ₱240 from PCs
  const netBonus = GameState.upgrades.internet * 40;        // max ₱160 from internet
  const repBonus = Math.floor(GameState.reputation * 0.5);  // max ₱50 from rep
  const prize = Math.min(600, basePrize + pcBonus + netBonus + repBonus);

  // Set cooldown: 8 game-hours between LAN parties
  GameState.lanPartyCooldownHours = 8;

  setTimeout(() => {
    GameState.addCash(prize, '+₱' + prize + ' LAN!');
    GameState.addReputation(5);
    GameState.addXP(60);
    showToast('🎉 LAN Party was a hit! +₱' + prize, 'success');
    CustomerSystem.spawnBurst(4);
  }, 3000);
  addEventLog('🎉 LAN Party started! (Next available in 8h)');
  showToast('LAN Party started! Results in 3 seconds...', 'info');
  checkAchievements();
}
