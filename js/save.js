/* ===== SAVE SYSTEM ===== */
window.SaveSystem = window.SaveSystem || {
  SLOT_COUNT: 6,
  currentSlot: null,
  mode: 'new', // 'new' or 'load'

  isStorageAvailable() {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  },

  getSlot(n) {
    if (!this.isStorageAvailable()) return null;
    try { return JSON.parse(localStorage.getItem('netzone_save_' + n)); } catch (e) { return null; }
  },

  setSlot(n, data) {
    if (!this.isStorageAvailable()) {
      showToast('Storage unavailable! Please run via a local server.', 'danger');
      return;
    }
    localStorage.setItem('netzone_save_' + n, JSON.stringify(data));
  },

  deleteSlot(n) {
    localStorage.removeItem('netzone_save_' + n);
  },

  showSlotPicker(mode) {
    this.mode = mode;
    document.getElementById('save-slot-title').textContent = mode === 'new' ? 'New Game — Choose Slot' : 'Load Game';
    const container = document.getElementById('save-slots');
    container.innerHTML = '';

    for (let i = 1; i <= this.SLOT_COUNT; i++) {
      const data = this.getSlot(i);
      const div = document.createElement('div');
      div.className = 'save-slot' + (data ? '' : ' save-slot-empty');
      div.innerHTML = `
        <div class="save-slot-num">${i}</div>
        <div class="save-slot-info">
          <div class="save-slot-name">${data ? (data.cafeName + ' (Lv.' + data.level + ')') : 'Empty Slot'}</div>
          <div class="save-slot-meta">${data ? ('₱' + data.cash + ' • Rep: ' + data.reputation + '% • ' + Math.floor((data.playtime||0)/60) + 'min played') : 'Start a new game here'}</div>
        </div>
        ${data && mode === 'load' ? `<button class="hire-btn" style="color:var(--danger);border-color:var(--danger)" onclick="event.stopPropagation();SaveSystem.deleteSlot(${i});SaveSystem.showSlotPicker('${mode}')">🗑</button>` : ''}
      `;
      div.onclick = () => {
        if (mode === 'new') {
          if (data) {
            this.requestConfirm(`Slot ${i} is occupied. Delete existing data for "${data.cafeName}" to start a new game?`, () => {
              this.deleteSlot(i);
              this.requestNamePrompt((name) => this.startNew(i, name));
            });
          } else {
            this.requestNamePrompt((name) => this.startNew(i, name));
          }
        } else if (data) {
          this.load(i);
        }
      };
      container.appendChild(div);
    }

    document.getElementById('save-slot-modal').classList.remove('hidden');
  },

  closeSlotPicker() {
    document.getElementById('save-slot-modal').classList.add('hidden');
  },

  requestConfirm(msg, onConfirm) {
    const modal = document.getElementById('prompt-modal');
    const msgEl = document.getElementById('prompt-message');
    const inputWrap = document.getElementById('prompt-input-wrap');
    const confirmBtn = document.getElementById('prompt-confirm');
    const cancelBtn = document.getElementById('prompt-cancel');

    msgEl.textContent = msg;
    inputWrap.classList.add('hidden');
    modal.classList.remove('hidden');

    confirmBtn.onclick = () => { modal.classList.add('hidden'); onConfirm(); };
    cancelBtn.onclick = () => { modal.classList.add('hidden'); };
  },

  requestNamePrompt(onConfirm) {
    const modal = document.getElementById('prompt-modal');
    const msgEl = document.getElementById('prompt-message');
    const inputWrap = document.getElementById('prompt-input-wrap');
    const input = document.getElementById('prompt-input');
    const confirmBtn = document.getElementById('prompt-confirm');
    const cancelBtn = document.getElementById('prompt-cancel');

    msgEl.textContent = "ENTER YOUR CAFE NAME:";
    input.value = "My Cafe";
    inputWrap.classList.remove('hidden');
    modal.classList.remove('hidden');

    confirmBtn.onclick = () => {
      if (!input.value.trim()) return;
      modal.classList.add('hidden');
      onConfirm(input.value.trim());
    };
    cancelBtn.onclick = () => { modal.classList.add('hidden'); };
  },

  startNew(slot, name) {
    this.currentSlot = slot;
    this.closeSlotPicker();
    startGame(false, null, name);
  },

  load(slot) {
    const data = this.getSlot(slot);
    if (!data) return;
    this.currentSlot = slot;
    this.closeSlotPicker();
    startGame(true, data);
  },

  saveGame(silent) {
    if (!this.currentSlot) return;
    const data = GameState.serialize();
    data.savedAt = Date.now();
    this.setSlot(this.currentSlot, data);
    if (!silent) showToast('💾 Game saved!', 'success');
  },

  autoSave() {
    this.saveGame(true);
  }
};

// Autosave every 5 minutes
setInterval(() => { if (document.getElementById('hud') && !document.getElementById('hud').classList.contains('hidden')) SaveSystem.autoSave(); }, 300000);
