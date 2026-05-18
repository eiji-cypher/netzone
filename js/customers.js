/* ===== CUSTOMER SYSTEM ===== */
window.CustomerSystem = {
  meshes: [],
  EMOTIONS: {
    happy:    { icon: '😊', color: 0x39ff14, rep: +1 },
    excited:  { icon: '😍', color: 0xffd700, rep: +2 },
    angry:    { icon: '😡', color: 0xff2d78, rep: -2 },
    bored:    { icon: '😴', color: 0x888888, rep: -1 },
    sick:     { icon: '🤮', color: 0x88ff00, rep: -3 },
    crash:    { icon: '💀', color: 0xff0000, rep: -3 },
    hype:     { icon: '🔥', color: 0xff6600, rep: +3 },
    promo:    { icon: '🤑', color: 0xffd700, rep: +1 },
    vip:      { icon: '👑', color: 0xffd700, rep: +5 },
    extend:   { icon: '✋', color: 0x00c8ff, rep: +1 },
  },

  FILIPINO_QUIPS: [
    "Kuya pa extend!",
    "Kuya may nanonood ng b*ld!",
    "Kuya pabili ng pancit canton.",
    "Penge extra seasoning sa canton boss.",
    "Lakas mang-trashtalk netong sa kabila!",
    "Log bwisit! PLDT pa more.",
    "Ayaw gumana ng mouse, puro dumi!",
    "Sino nagda-download?! Bagal ng net!",
    "Piso lang muna, pang check lang ng FB."
  ],

  // Centralized State Machine Logic
  // Decouples logic from the main loop for better performance and scalability
  stateHandlers: {
    queued: {
      tick: (c) => {
        c.waitTime++;
        if (c.waitTime > 10 && c.emotion !== 'angry') {
          c.emotion = 'angry';
          updateQueueSidebar();
        }
        if (c.waitTime > 30) {
          c.state = 'leaving';
          c.target = new THREE.Vector3(0, 0.65, 15);
          c.walking = true;
          updateQueueSidebar();
        }
      },
      update: (c, delta) => {} // No special frame logic for queueing
    },
    active: {
      tick: (c) => {
        c.sessionTime++;
        
        // Random events logic
        if (Math.random() < 0.05 && !c.pc.broken && !c.pc.underMaintenance) {
          c.pc.broken = true;
          SceneManager.updatePC(c.pc);
          c.emotion = 'crash';
        }

        if (Math.random() < 0.05 && c.requests.length === 0) {
          window.CustomerSystem.handleSnackRequest(c);
        }

        if (GameState.upgrades.coffeeMachine && Math.random() < 0.05 && c.requests.length === 0 && !c.hasCaffeine) {
          window.CustomerSystem.handleCoffeeRequest(c);
        }

        if (c.canExtend && c.sessionTime >= c.maxSession - 1 && c.requests.length === 0 && Math.random() < 0.2) {
          window.CustomerSystem.handleExtendRequest(c);
        }

        // Rating/Reputation dynamics
        if (GameState.upgrades.internet >= 3) c.emotion = 'excited';
        else if (GameState.upgrades.internet === 0) c.emotion = 'angry';
        else if (c.pc.broken) c.emotion = 'crash';
        else if (!GameState.upgrades.aircon && GameState.hour > 18 && !c.hasCaffeine) c.emotion = 'bored';
        else c.emotion = 'happy';

        // Session check
        if (c.sessionTime >= c.maxSession) {
          if (c.pc) c.pc.occupied = false;
          c.state = 'walking_to_cashier';
          c.target = new THREE.Vector3(-5, 0.65, 13);
          c.walking = true;
          updateQueueSidebar();
        }
      },
      update: (c, delta) => {
        // Random Filipino Quips
        if (Math.random() < 0.0005) {
          const quip = window.CustomerSystem.FILIPINO_QUIPS[Math.floor(Math.random() * window.CustomerSystem.FILIPINO_QUIPS.length)];
          window.CustomerSystem.showTextBubble(c, quip);
          if (quip.includes('bwisit') || quip.includes('trashtalk') || quip.includes('b*ld')) {
            window.CustomerSystem.applyNoisePenalty(c);
          }
        }
      }
    },
    walking_to_pc: {
      tick: (c) => {},
      update: (c, delta) => {
        if (!c.walking) {
          c.state = 'active';
          updateQueueSidebar();
        }
      }
    },
    walking_to_cashier: {
      tick: (c) => {},
      update: (c, delta) => {
        if (!c.walking) {
          c.state = 'waiting_to_pay';
          updateQueueSidebar();
        }
      }
    },
    waiting_to_pay: {
      tick: (c) => {},
      update: (c, delta) => {}
    },
    leaving: {
      tick: (c) => {},
      update: (c, delta) => {
        if (!c.walking) {
          const idx = GameState.customers.indexOf(c);
          if (idx > -1) {
            SceneManager.scene.remove(c.mesh);
            GameState.customers.splice(idx, 1);
            updateQueueSidebar();
          }
        }
      }
    }
  },

  spawnCustomer() {
    // Max 10 customers waiting in the reception queue
    if (GameState.customers.filter(c => c.state === 'queued').length >= 10) return;

    // Automatically not accepting customers when no PC available
    const freePCs = GameState.pcs.filter(p => !p.occupied && !p.broken).length;
    if (freePCs === 0) {
      SceneManager.updateFullSign(true);
      return;
    }

    // Build simple customer mesh
    const group = new THREE.Group();
    const bodyGeo = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.15, 0.4, 4, 8) : new THREE.CylinderGeometry(0.15, 0.15, 0.55, 8);
    const hasVIPHardware = GameState.level >= 25 && GameState.pcs.some(p => p.isVIP);
    const isVIP = hasVIPHardware && Math.random() < 0.15;
    const colors = isVIP ? [0xffd700] : [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa8e6cf, 0xff8b94, 0xc9b1ff];
    const bodyMat = new THREE.MeshLambertMaterial({ color: isVIP ? 0xffd700 : colors[Math.floor(Math.random() * colors.length)] });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffdbac }));
    head.position.y = 0.45;
    group.add(head);

    // Initial position at entrance, target is the reception queue
    const queueIdx = GameState.customers.filter(c => c.state === 'queued').length;
    const target = new THREE.Vector3(5 + (queueIdx * 0.6), 0.65, 13);
    group.position.set(0, 0.65, 15);
    SceneManager.scene.add(group);

    // Pick a desired session type based on available/bought hardware
    const types = Object.keys(window.SESSION_TYPES).filter(typeId => {
      if (typeId === 'vr') return GameState.pcs.some(p => p.type === 'vr');
      if (typeId === 'playstation') return GameState.pcs.some(p => p.type === 'ps');
      if (typeId === 'pisonet') return GameState.pcs.some(p => p.type === 'pisonet') && GameState.upgrades.pisonetMode;
      if (typeId === 'vip') return GameState.level >= 25 && GameState.pcs.some(p => p.isVIP);
      // Standard PC sessions
      return GameState.pcs.some(p => p.type === 'pc');
    });
    if (types.length === 0) types.push('gaming'); // Fallback

    let desiredType;
    if (isVIP) {
      desiredType = 'vip';
    } else {
      const nonVipTypes = types.filter(t => t !== 'vip');
      desiredType = nonVipTypes.length > 0 ? nonVipTypes[Math.floor(Math.random() * nonVipTypes.length)] : 'gaming';
    }

    const customer = {
      mesh: group, pc: null, target,
      emotion: 'happy',
      sessionTime: 0,
      maxSession: (desiredType === 'pisonet' 
        ? 1 + Math.floor(Math.random() * 2) // 1-2 hours for Piso Net
        : 3 + Math.floor(Math.random() * 5)) // 3-7 hours for others
        + (GameState.weather === 'rain' ? 2 : 0),

      walking: true, state: 'queued',
      speed: 0.05 + Math.random() * 0.03,
      sessionType: null,
      desiredType: desiredType,
      requests: [],
      isVIP: isVIP,
      waitTime: 0,
      hasCaffeine: false,
      canExtend: Math.random() > 0.5,
    };

    GameState.customers.push(customer);
    if (isVIP) customer.emotion = 'vip';
    this.meshes.push(group);
    this.showEmotionBubble(customer);
    updateQueueSidebar();
    return customer;
  },

  assignPC(customer, pc, typeId) {
    const type = window.SESSION_TYPES[typeId];
    customer.pc = pc;
    pc.occupied = true;
    customer.sessionType = typeId;
    customer.state = 'walking_to_pc';
    customer.target = pc.group.position.clone().add(new THREE.Vector3(0, 0.65, 0.5).applyEuler(pc.group.rotation));
    customer.walking = true;
    customer.waitTime = 0;
    showToast(`Assigned to PC #${pc.id+1} for ${type.label}`, 'success');
  },

  handleSnackRequest(customer) {
    if (customer.state !== 'active') return;
    customer.requests.push('snack');
    customer.emotion = 'promo';
    this.showEmotionBubble(customer);
    showToast('🍕 Customer at PC #' + (customer.pc.id+1) + ' wants a snack!', 'info');
  },

  fulfillSnack(customer) {
    const idx = customer.requests.indexOf('snack');
    if (idx > -1) {
      customer.requests.splice(idx, 1);
      customer.emotion = 'happy';
      this.showEmotionBubble(customer);
      const price = GameState.upgrades.pancitCooker ? 30 : 15;
      GameState.addCash(price, '+₱' + price + ' snack');
      showToast('🍕 Delivered snack!', 'success');
    }
  },

  handleCoffeeRequest(customer) {
    if (customer.state !== 'active') return;
    customer.requests.push('coffee');
    customer.emotion = 'bored'; // Show they need a wake up call
    this.showEmotionBubble(customer);
    showToast('☕ Customer at PC #' + (customer.pc.id+1) + ' needs coffee!', 'info');
  },

  fulfillCoffee(customer) {
    const idx = customer.requests.indexOf('coffee');
    if (idx > -1) {
      customer.requests.splice(idx, 1);
      customer.emotion = 'happy';
      customer.hasCaffeine = true;
      this.showEmotionBubble(customer);
      GameState.addCash(25, '+₱25 coffee');
    }
  },

  handleExtendRequest(customer) {
    if (customer.state !== 'active') return;
    if (customer.requests.includes('extend')) return;
    customer.requests.push('extend');
    customer.emotion = 'extend';
    this.showEmotionBubble(customer);
    showToast('✋ PC #' + (customer.pc.id+1) + ': "Kuya, extend po!"', 'info');
  },

  fulfillExtend(customer) {
    const idx = customer.requests.indexOf('extend');
    if (idx > -1) {
      customer.requests.splice(idx, 1);
      customer.emotion = 'excited';
      customer.maxSession += 2; // Extend by 2 hours
      this.showEmotionBubble(customer);
      showToast('✅ Session extended!', 'success');
    }
  },

  checkout(customer) {
    const type = window.SESSION_TYPES[customer.sessionType];
    const rateMult = customer.isVIP ? 3 : 1;
    const base = type.rate * rateMult * customer.sessionTime;
    const tip = Math.floor(base * (GameState.reputation / 100) * 0.5);
    const total = base + tip;
    
    GameState.addCash(total, `+₱${total} payment`);
    GameState.addXP(type.xp);
    
    customer.state = 'leaving';
    customer.target = new THREE.Vector3(0, 0.65, 15);
    customer.walking = true;

    showToast(`Collected ₱${total} from ${customer.sessionType}`, 'success');
  },

  applyNoisePenalty(source) {
    const radius = 5;
    const hasMascot = GameState.staff.some(s => s.roleId === 'mascot' && (!s.isLate || GameState.hour >= 10));
    const penalty = hasMascot ? -0.25 : -0.5;

    GameState.customers.forEach(other => {
      if (other === source || other.state !== 'active') return;
      if (source.mesh.position.distanceTo(other.mesh.position) < radius) {
        GameState.addReputation(penalty);
      }
    });
    showToast(hasMascot ? '🐻 Mascot calmed the crowd! (50% penalty)' : '🤫 Maingay! Nearby customers lost reputation.', 'warn');
  },

  showTextBubble(customer, text) {
    const old = customer.mesh.getObjectByName('emotion');
    if (old) customer.mesh.remove(old);

    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 160; // Increased width for long Filipino comments
    const ctx = canvas.getContext('2d');
    
    // Draw Bubble Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.roundRect ? ctx.roundRect(10, 10, 1004, 140, 20) : ctx.fillRect(10, 10, 1004, 140);
    ctx.fill();
    ctx.strokeStyle = 'var(--neon)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 512, 90); // Centered on new 1024 width

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.name = 'emotion';
    sprite.scale.set(4.8, 0.75, 1); // Aspect ratio adjusted for 1024 width
    sprite.position.y = 1.4;
    customer.mesh.add(sprite);
    
    // Revert to normal icon after 3 seconds
    setTimeout(() => {
      if (customer.mesh && GameState.customers.includes(customer)) {
        this.showEmotionBubble(customer);
      }
    }, 3000);
  },

  showEmotionBubble(customer) {
    // Clear old
    const old = customer.mesh.getObjectByName('emotion');
    if (old) customer.mesh.remove(old);

    // Sprite-style floating text via canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.EMOTIONS[customer.emotion].icon, 32, 44);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.name = 'emotion';
    sprite.scale.set(0.5, 0.5, 0.5);
    sprite.position.y = 0.8;
    customer.mesh.add(sprite);
  },

  tickCustomers() {
    let served = 0;
    
    // Vending Machine Jam chance
    if (GameState.upgrades.vending && !GameState.upgrades.vendingJammed) {
      if (Math.random() < 0.1) {
        GameState.upgrades.vendingJammed = true;
        showToast('⚠️ Vending machine is jammed!', 'warn');
      }
    }

    // Execute logic based on the customer's current state
    GameState.customers.forEach(c => {
      const handler = this.stateHandlers[c.state];
      if (handler) {
        handler.tick(c);
      }

      // Common logic for all states (e.g. session complete increment)
      if (c.state === 'active' && c.sessionTime >= c.maxSession) {
        served++;
      }

      this.showEmotionBubble(c);
      const emo = this.EMOTIONS[c.emotion];
      GameState.addReputation(emo.rep * 0.1);
    });

    // Maybe spawn new
    const freePCs = GameState.pcs.filter(p => !p.occupied && !p.broken);
    const spawnChance = GameState.weather === 'rain' ? 0.15 : 0.4;
    
    // Rating affects customer flow
    const ratingMult = 0.4 + (GameState.rating / 5) * 0.6; // Scale traffic by rating
    if (Math.random() < spawnChance * ratingMult && freePCs.length > 0) {
      this.spawnCustomer();
      SceneManager.updateFullSign(false);
    }

    return served;
  },

  update(delta) {
    GameState.customers.forEach(c => {
      // Random Filipino Quips logic moved here for better visibility
      if (c.state === 'active' && Math.random() < 0.0005) {
        const quip = this.FILIPINO_QUIPS[Math.floor(Math.random() * this.FILIPINO_QUIPS.length)];
        this.showTextBubble(c, quip);
        
        if (quip.includes('bwisit') || quip.includes('trashtalk') || quip.includes('b*ld')) {
          this.applyNoisePenalty(c);
        }
      }

      if (c.walking) {
        const dir = c.target.clone().sub(c.mesh.position);
        if (dir.length() < 0.1) {
          c.walking = false;
          c.mesh.position.copy(c.target);

          if (c.state === 'leaving') {
            SceneManager.scene.remove(c.mesh);
            GameState.customers.splice(GameState.customers.indexOf(c), 1);
            updateQueueSidebar();
          } else if (c.state === 'walking_to_pc') {
            c.state = 'active';
            updateQueueSidebar();
          } else if (c.state === 'walking_to_cashier') {
            c.state = 'waiting_to_pay';
            updateQueueSidebar();
          }
        } else {
          // Apply Fast Checkout skill bonus
          let speedMult = 1.0;
          if (c.state === 'walking_to_cashier' && GameState.skills['fast_checkout']) speedMult = 2.0;
          dir.normalize().multiplyScalar(c.speed * speedMult * delta * 60);
          c.mesh.position.add(dir);

          // Visual Effect: Green trail for fast checkout
          if (c.state === 'walking_to_cashier' && GameState.skills['fast_checkout']) {
            const trailGeo = new THREE.SphereGeometry(0.05);
            const trailMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.6 });
            const trail = new THREE.Mesh(trailGeo, trailMat);
            trail.position.copy(c.mesh.position);
            SceneManager.scene.add(trail);
            setTimeout(() => {
              SceneManager.scene.remove(trail);
            }, 200);
          }
        }
      }
    });
  },

  spawnBurst(count) {
    for (let i = 0; i < count; i++) setTimeout(() => this.spawnCustomer(), i * 300);
  }
};
