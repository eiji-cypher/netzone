/* ===== RIVAL SYSTEM ===== */
window.RivalSystem = {
  rivals: [
    { id:1, name:'ByteHouse',    icon:'🏠', level:1, cash:600,  rep:20, internet:1, pcs:3,  fame:10, active:true  },
    { id:2, name:'CyberNest',    icon:'🌐', level:2, cash:1200, rep:35, internet:2, pcs:6,  fame:25, active:false },
    { id:3, name:'ProGaming Hub',icon:'🎮', level:4, cash:3000, rep:60, internet:3, pcs:12, fame:50, active:false },
  ],

  RIVAL_EVENTS: [
    'dropped their prices!',
    'stole some of your customers!',
    'hosted a big tournament!',
    'got hacked — losing customers!',
    'launched a new promotion!',
    'opened a second location!',
    'got a bad review online!',
    'upgraded to fiber internet!',
  ],

  tick() {
    // Activate rivals based on player level
    this.rivals[1].active = GameState.level >= 3;
    this.rivals[2].active = GameState.level >= 6;
  },

  dailyGrowth() {
    this.rivals.filter(r => r.active).forEach(r => {
      // Rivals grow slowly
      r.cash += 80 + r.level * 20;
      r.rep = Math.min(100, r.rep + (Math.random() > 0.6 ? 1 : 0));
      r.fame = Math.min(100, r.fame + (Math.random() > 0.7 ? 1 : 0));

      // Random rival event
      if (Math.random() < 0.15) {
        const evt = this.RIVAL_EVENTS[Math.floor(Math.random() * this.RIVAL_EVENTS.length)];
        addEventLog(`⚔️ ${r.icon} ${r.name} ${evt}`);

        // Some events affect player
        if (evt.includes('stole')) {
          GameState.addReputation(-2);
          showToast(`😡 ${r.name} stole some customers!`, 'danger');
        } else if (evt.includes('hacked')) {
          showToast(`😂 ${r.name} got hacked!`, 'success');
          GameState.addReputation(3);
        }
      }

      // Upgrade rival stats over time
      if (r.cash > 500 && r.internet < 4) { r.internet++; r.cash -= 300; }
      if (r.cash > 400) { r.pcs++; r.cash -= 150; }
    });
  },

  getLeaderboard() {
    const player = {
      name: 'YOU', icon: '⭐', level: GameState.level,
      rep: Math.floor(GameState.reputation),
      internet: GameState.upgrades.internet + 1,
      pcs: GameState.pcs.length,
      fame: Math.floor(GameState.reputation * 0.8),
      active: true, isPlayer: true
    };
    return [player, ...this.rivals.filter(r => r.active)]
      .sort((a, b) => b.rep - a.rep);
  }
};
