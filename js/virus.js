/* ===== VIRUS MINIGAME ===== */
window.VirusGame = {
  currentPC: null,
  phase: 0,
  score: 0,
  targets: [],
  timer: null,

  trigger(pc) {
    this.currentPC = pc;
    this.phase = 0;
    this.score = 0;
    document.getElementById('virus-pc-id').textContent = pc.id + 1;
    document.getElementById('virus-modal').classList.remove('hidden');
    this.runPhase();
  },

  runPhase() {
    const area = document.getElementById('virus-game-area');
    const phases = [this.phaseAntivirus, this.phaseCommandLine, this.phaseReaction];
    if (this.phase < phases.length) {
      phases[this.phase].call(this, area);
    } else {
      this.finish();
    }
  },

  phaseAntivirus(area) {
    const viruses = ['TROJAN','WORM','SPYWARE','RANSOM','MINER','ADWARE','ROOTKIT','STEALER'];
    const correct = viruses[Math.floor(Math.random() * viruses.length)];
    const options = [...viruses].sort(() => Math.random() - 0.5).slice(0, 4);
    if (!options.includes(correct)) options[0] = correct;
    options.sort(() => Math.random() - 0.5);

    area.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-family:var(--font-mono);color:var(--danger);font-size:13px;margin-bottom:8px">PHASE 1 — IDENTIFY THE VIRUS</div>
        <div style="font-size:13px;color:var(--text);margin-bottom:14px">Scanner detected: <span style="color:var(--warn);font-weight:700">${correct}</span> — Which type is it?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:320px;margin:0 auto">
          ${options.map(o => `<button onclick="VirusGame.answerAntivirus('${o}','${correct}')" style="background:rgba(255,45,120,0.08);border:1px solid rgba(255,45,120,0.3);color:var(--text);font-family:var(--font-mono);font-size:12px;padding:12px;border-radius:4px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor='var(--neon)'" onmouseout="this.style.borderColor='rgba(255,45,120,0.3)'">${o}</button>`).join('')}
        </div>
      </div>`;
  },

  answerAntivirus(chosen, correct) {
    if (chosen === correct) { this.score++; showToast('✅ Correct!', 'success'); }
    else showToast('❌ Wrong! It was ' + correct, 'danger');
    this.phase++;
    this.runPhase();
  },

  phaseCommandLine(area) {
    const commands = [
      { q:'Delete infected file "virus.exe"?', a:'del virus.exe', opts:['del virus.exe','rm -rf /','copy virus.exe','run virus.exe'] },
      { q:'Scan all files for threats?', a:'scan --all', opts:['scan --all','format c:','exit /b','ping threat.com'] },
      { q:'Quarantine the threat?', a:'quarantine threat', opts:['quarantine threat','allow threat','ignore threat','share threat'] },
    ];
    const q = commands[Math.floor(Math.random() * commands.length)];
    q.opts.sort(() => Math.random() - 0.5);

    area.innerHTML = `
      <div style="text-align:center">
        <div style="font-family:var(--font-mono);color:var(--danger);font-size:13px;margin-bottom:8px">PHASE 2 — COMMAND LINE</div>
        <div style="background:#000;border:1px solid #333;border-radius:4px;padding:12px;font-family:var(--font-mono);font-size:12px;color:#0f0;text-align:left;margin-bottom:14px">
          C:\\> ${q.q}<br><span style="color:#888">Enter the correct command:</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-width:320px;margin:0 auto">
          ${q.opts.map(o => `<button onclick="VirusGame.answerCmd('${o}','${q.a}')" style="background:#000;border:1px solid #333;color:#0f0;font-family:var(--font-mono);font-size:12px;padding:10px;border-radius:4px;cursor:pointer;text-align:left;transition:all 0.15s" onmouseover="this.style.borderColor='var(--neon)'" onmouseout="this.style.borderColor='#333'">&gt; ${o}</button>`).join('')}
        </div>
      </div>`;
  },

  answerCmd(chosen, correct) {
    if (chosen === correct) { this.score++; showToast('✅ Correct!', 'success'); }
    else showToast('❌ Wrong command!', 'danger');
    this.phase++;
    this.runPhase();
  },

  phaseReaction(area) {
    let timeLeft = 5;
    let clicked = false;

    area.innerHTML = `
      <div style="text-align:center">
        <div style="font-family:var(--font-mono);color:var(--danger);font-size:13px;margin-bottom:8px">PHASE 3 — QUICK REACTION</div>
        <div style="font-size:12px;color:var(--text);margin-bottom:14px">Click DELETE when it turns red!</div>
        <div style="position:relative;height:100px;display:flex;align-items:center;justify-content:center">
          <button id="react-btn" style="background:rgba(0,200,255,0.1);border:2px solid var(--neon);color:var(--text);font-family:var(--font-head);font-size:14px;padding:16px 32px;border-radius:4px;cursor:pointer;transition:all 0.3s" onclick="VirusGame.clickReact()">STANDBY...</button>
        </div>
        <div id="react-timer" style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim)">Get ready...</div>
      </div>`;

    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      const btn = document.getElementById('react-btn');
      if (!btn) return;
      btn.textContent = 'DELETE!';
      btn.style.background = 'rgba(255,45,120,0.3)';
      btn.style.borderColor = 'var(--danger)';
      btn.style.color = 'var(--danger)';
      this._reactionActive = true;

      this.timer = setTimeout(() => {
        if (!this._reactionClicked) {
          showToast('⏱ Too slow!', 'danger');
          this.phase++;
          this.runPhase();
        }
      }, 1500);
    }, delay);
  },

  clickReact() {
    if (!this._reactionActive) { showToast('Too early!', 'warn'); return; }
    clearTimeout(this.timer);
    this._reactionClicked = true;
    this._reactionActive = false;
    this.score++;
    showToast('⚡ Fast reflexes!', 'success');
    this.phase++;
    this.runPhase();
  },

  finish() {
    const area = document.getElementById('virus-game-area');
    const success = this.score >= 2;
    const pc = this.currentPC;

    if (success) {
      pc.broken = false;
      SceneManager.updatePC(pc);
      GameState.addReputation(5);
      GameState.addXP(30);
      GameState.addCash(50, '+₱50 bonus');
      area.innerHTML = `<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:12px">🛡️</div><div style="font-family:var(--font-head);color:var(--success);font-size:16px;margin-bottom:8px">VIRUS REMOVED!</div><div style="font-size:13px;color:var(--text)">Score: ${this.score}/3 — PC restored!</div><button onclick="VirusGame.close()" style="margin-top:16px;background:var(--success);border:none;color:#000;font-family:var(--font-head);font-size:12px;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:700">AWESOME!</button></div>`;
    } else {
      pc.broken = true;
      SceneManager.updatePC(pc);
      GameState.addReputation(-5);
      area.innerHTML = `<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:12px">💀</div><div style="font-family:var(--font-head);color:var(--danger);font-size:16px;margin-bottom:8px">CLEANUP FAILED!</div><div style="font-size:13px;color:var(--text)">Score: ${this.score}/3 — PC remains infected!</div><button onclick="VirusGame.close()" style="margin-top:16px;background:var(--danger);border:none;color:#fff;font-family:var(--font-head);font-size:12px;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:700">CLOSE</button></div>`;
    }
  },

  close() {
    document.getElementById('virus-modal').classList.add('hidden');
    this._reactionActive = false;
    this._reactionClicked = false;
    clearTimeout(this.timer);
  }
};
