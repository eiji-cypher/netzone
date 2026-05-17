/* ===== TUTORIAL SYSTEM ===== */
window.Tutorial = {
  active: false,
  stepIdx: 0,
  flags: {},
  arrow: null,

  STEPS: [
    {
      text: "Hey! I'm <b>Byte</b> 🤖 — your AI assistant! Welcome to <b>NetZone</b>. Let's get your internet cafe up and running!",
      target: null,
      nextLabel: 'Let\'s go! →',
    },
    {
      text: "First, you need <b>PCs</b> to earn money. Click the <b>🖥️ PC button</b> on the left sidebar to select it. Then, click on a highlighted blue square on the floor to place it!",
      target: '#btn-add-pc',
      waitFlag: 'tool_pc_selected',
      nextLabel: null,
    },
    {
      text: "Great! Now <b>click on one of the pulsing green squares</b> on the floor to place your first PC. Each PC earns you money every hour!",
      target: null, 
      waitFlag: 'pc_placed',
      nextLabel: null,
    },
    {
      text: "You can also build <b>Piso Net</b> stations for quick, cheap sessions. Click the <b>🪙 Piso Net button</b> to try it!",
      target: '#btn-add-pisonet',
      waitFlag: 'tool_pisonet_selected',
      nextLabel: null,
    },
    {
      text: "Now, click on a pulsing <b>blue square</b> to place your Piso Net station. Remember, different stations go in different zones!",
      target: null,
      waitFlag: 'pc_placed',
      nextLabel: null,
    },
    {
      text: "🎮 Freedom! Use <b>WASD</b> to walk around and <b>Right Click + Drag</b> to look. Try switching to <b>1st Person</b> view later!",
      target: '#camera-modes',
      nextLabel: 'Awesome →',
    },
    {
      text: "🛠️ When in first-person, walk up to a PC and press <b>'E'</b> to interact. Use this to fix broken PCs with your <b>Repair tool</b>!",
      target: '#btn-repair',
      nextLabel: 'Got it! →',
    },
    {
      text: "Excellent! 🎉 Now check your <b>Balance</b> at the top — that's your money. PCs generate income every game-hour automatically!",
      target: '#stat-cash',
      nextLabel: 'Got it →',
    },
    {
      text: "💡 Use <b>Upgrades</b> to boost your cafe. Click the <b>⬆️ Upgrades button</b> to see available improvements like faster internet!",
      target: '#btn-upgrades',
      nextLabel: 'Show me →',
    },
    {
      text: "🧑‍💼 Hire <b>Staff</b> so you don't have to do everything yourself! Technicians fix broken PCs, cashiers keep customers happy.",
      target: '#btn-staff',
      nextLabel: 'Nice →',
    },
    {
      text: "🎉 Host <b>LAN Parties</b> for big cash prizes! You'll need at least 4 PCs. It costs ₱100 to set up but earns much more!",
      target: '#btn-lan',
      nextLabel: 'Understood →',
    },
    {
      text: "📊 Watch your <b>Reputation bar</b> at the bottom. Happy customers increase it, angry ones lower it. Keep it high for more traffic!",
      target: '#rep-bar-wrap',
      nextLabel: 'Got it →',
    },
    {
      text: "🏆 Check the <b>Rivals</b> tab to see competing cafes. Beat them by upgrading faster and keeping customers happy!",
      target: '#btn-rivals',
      nextLabel: 'Noted →',
    },
    {
      text: "💾 Don't forget to <b>Save</b> your progress with the 💾 button in the top-right! There's also autosave every 5 minutes.",
      target: '.hud-btn[onclick="SaveSystem.saveGame()"]',
      nextLabel: 'Perfect →',
    },
    {
      text: "You're all set! 🚀 Build your cafe empire, level up, unlock skills, and crush the competition. Good luck, Manager!",
      target: null,
      nextLabel: 'Let\'s play! 🎮',
      last: true,
    },
  ],

  start() {
    this.active = true;
    this.stepIdx = 0;
    this.flags = {};
    this.show();
  },

  show() {
    const step = this.STEPS[this.stepIdx];
    const bubble = document.getElementById('tut-bubble');
    const dim = document.getElementById('tut-dim');
    const spot = document.getElementById('tut-spotlight');
    const text = document.getElementById('tut-text');
    const stepEl = document.getElementById('tut-step');
    const nextBtn = document.getElementById('tut-next');

    text.innerHTML = step.text;
    stepEl.textContent = 'Step ' + (this.stepIdx + 1) + ' / ' + this.STEPS.length;
    nextBtn.textContent = step.nextLabel || 'Next →';
    nextBtn.style.display = step.nextLabel ? 'block' : 'none';

    bubble.classList.remove('hidden');
    dim.classList.add('active');

    // Remove previous highlights
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));

    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        el.classList.add('tut-highlight');
        this.positionSpotlight(el);
        this.positionBubbleNear(el);
        this.positionArrow(el);
        spot.classList.add('active');
      }
    } else {
      spot.classList.remove('active');
      this.positionBubbleCenter();
      this.removeArrow();
    }
  },

  positionSpotlight(el) {
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const spot = document.getElementById('tut-spotlight');
    spot.style.left   = (rect.left - pad) + 'px';
    spot.style.top    = (rect.top - pad) + 'px';
    spot.style.width  = (rect.width + pad*2) + 'px';
    spot.style.height = (rect.height + pad*2) + 'px';
  },

  positionBubbleNear(el) {
    const rect = el.getBoundingClientRect();
    const bubble = document.getElementById('tut-bubble');
    const bw = 300, bh = 180;
    let left = rect.right + 16;
    let top  = rect.top;
    if (left + bw > window.innerWidth) left = rect.left - bw - 16;
    if (top + bh > window.innerHeight) top = window.innerHeight - bh - 20;
    if (top < 10) top = 10;
    bubble.style.left = left + 'px';
    bubble.style.top  = top + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
    bubble.style.transform = 'none';
  },

  positionBubbleCenter() {
    const bubble = document.getElementById('tut-bubble');
    bubble.style.left = '50%';
    bubble.style.top  = '50%';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
    bubble.style.transform = 'translate(-50%,-50%)';
  },

  positionArrow(el) {
    this.removeArrow();
    const rect = el.getBoundingClientRect();
    const arrow = document.createElement('div');
    arrow.className = 'tut-arrow';
    arrow.id = 'tut-arrow';
    arrow.textContent = '👈';
    arrow.style.left = (rect.right + 8) + 'px';
    arrow.style.top  = (rect.top + rect.height / 2) + 'px';
    if (rect.right + 50 > window.innerWidth) {
      arrow.textContent = '👆';
      arrow.style.left = (rect.left + rect.width / 2) + 'px';
      arrow.style.top  = (rect.bottom + 8) + 'px';
    }
    document.body.appendChild(arrow);
  },

  removeArrow() {
    const old = document.getElementById('tut-arrow');
    if (old) old.remove();
  },

  next() {
    const step = this.STEPS[this.stepIdx];
    if (step.last) { this.end(); return; }
    this.stepIdx++;
    this.show();
  },

  onFlag(flag) {
    if (!this.active) return;
    const step = this.STEPS[this.stepIdx];
    if (step && step.waitFlag === flag) {
      this.stepIdx++;
      setTimeout(() => this.show(), 400);
    }
  },

  end() {
    this.active = false;
    document.getElementById('tut-bubble').classList.add('hidden');
    document.getElementById('tut-dim').classList.remove('active');
    document.getElementById('tut-spotlight').classList.remove('active');
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    this.removeArrow();
    showToast('🎓 Tutorial complete! Good luck!', 'success');
  }
};
