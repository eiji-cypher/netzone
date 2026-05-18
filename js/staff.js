/* ===== STAFF SYSTEM ===== */
window.StaffSystem = {
  ROLES: [
    { id:'cashier',   icon:'💁', name:'Cashier',      desc:'Improves customer happiness +10%', salary:30, stat:'happiness', minLevel:1 },
    { id:'tech',      icon:'🔧', name:'Technician',   desc:'Auto-repairs broken PCs',          salary:50, stat:'repair',    minLevel:2 },
    { id:'cleaner',   icon:'🧹', name:'Cleaner',      desc:'Keeps cafe clean, +reputation',    salary:25, stat:'cleanliness',minLevel:1 },
    { id:'security',  icon:'💂', name:'Security Guard',desc:'Reduces theft/vandalism',          salary:40, stat:'security',  minLevel:3 },
    { id:'night_tech', icon:'🌙', name:'Night Tech',  desc:'100% faster repairs (10PM-6AM)',   salary:55, stat:'repair',    minLevel:3 },
    { id:'auto_assign', icon:'🤖', name:'Auto-Host',   desc:'Auto-assigns customers to PCs',    salary:45, stat:'automation', minLevel:4 },
    { id:'marketing', icon:'📣', name:'Marketing',    desc:'+15% customer traffic',             salary:60, stat:'marketing', minLevel:4 },
    { id:'esports',   icon:'🏆', name:'Esports Mgr',  desc:'Boosts LAN Party earnings 50%',    salary:80, stat:'esports',   minLevel:6 },
    { id:'mascot',    icon:'🐻', name:'Mascot',       desc:'Reduces noise penalty by 50%',      salary:35, stat:'morale',    minLevel:2 },
    { id:'bouncer',   icon:'👮', name:'Bouncer',       desc:'Auto-kicks restricted viewers',     salary:40, stat:'security',  minLevel:3 },
    { id:'social_mgr',icon:'📱', name:'SocMed Manager',desc:'Auto-responds to reviews',         salary:45, stat:'marketing', minLevel:5 },
  ],

  PERSONALITIES: ['Hardworking','Lazy','Friendly','Grumpy','Enthusiastic','Burnt Out'],
  NAMES: ['Alex','Jordan','Sam','Casey','Riley','Morgan','Taylor','Quinn','Blake','Avery'],

  stateHandlers: {
    idle: {
      tick: (emp) => {
        // Recover mood in break room
        const breakRoomPos = new THREE.Vector3(-14, 0.65, 10);
        if (emp.mesh.position.distanceTo(breakRoomPos) < 1.5) {
          const recoveryRate = GameState.upgrades.staffLounge ? 0.5 : 0.2;
          emp.mood = Math.min(100, emp.mood + recoveryRate);
        }
      },
      update: (emp, delta) => {
        const breakRoomPos = new THREE.Vector3(-14, 0.65, 10);
        if (emp.mesh.position.distanceTo(breakRoomPos) > 1.5) {
          emp.state = 'walking';
          emp.targetPos = breakRoomPos.clone();
          emp.path = SceneManager.getPath(emp.mesh.position, emp.targetPos);
        }
        emp.mesh.position.y = 0.65 + Math.sin(Date.now() * 0.002) * 0.01;
      }
    },
    walking: {
      tick: (emp) => {},
      update: (emp, delta) => {
        if (emp.path && emp.path.length > 0) {
          const nextPoint = emp.path[0];
          const dir = nextPoint.clone().sub(emp.mesh.position);
          if (dir.length() < 0.2) {
            emp.path.shift();
            if (emp.path.length === 0) {
              emp.state = emp.cleaningTrashId !== null ? 'cleaning' : emp.fixingPcId !== null ? 'fixing' : 'idle';
              emp.animationTimer = 2.0;
            }
            return;
          }
          dir.normalize().multiplyScalar(0.05 * delta * 60);
          emp.mesh.position.add(dir);
          emp.mesh.lookAt(nextPoint.x, emp.mesh.position.y, nextPoint.z);
        }
      }
    },
    cleaning: {
      tick: (emp) => {},
      update: (emp, delta) => {
        emp.animationTimer -= delta;
        emp.mesh.rotation.y += Math.sin(Date.now() * 0.01) * 0.1;
        if (emp.animationTimer <= 0) {
          SceneManager.cleanTrash(emp.cleaningTrashId);
          emp.cleaningTrashId = null;
          emp.state = 'idle';
        }
      }
    },
    fixing: {
      tick: (emp) => {},
      update: (emp, delta) => {
        emp.animationTimer -= delta;
        emp.mesh.rotation.y += Math.sin(Date.now() * 0.01) * 0.1;
        if (emp.animationTimer <= 0) {
          const pc = GameState.pcs.find(p => p.id === emp.fixingPcId);
          if (pc) { pc.broken = false; SceneManager.updatePC(pc); }
          emp.fixingPcId = null;
          emp.state = 'idle';
        }
      }
    }
  },

  generateStaff(roleId) {
    const role = this.ROLES.find(r => r.id === roleId);
    return {
      id: Date.now(),
      roleId,
      name: this.NAMES[Math.floor(Math.random() * this.NAMES.length)],
      personality: this.PERSONALITIES[Math.floor(Math.random() * this.PERSONALITIES.length)],
      salary: role.salary,
      skill: 1 + Math.floor(Math.random() * 3),
      mood: 70 + Math.floor(Math.random() * 30),
      loyalty: 50 + Math.floor(Math.random() * 50),
      isLate: false,
      daysWorked: 0,
      icon: role.icon,
      role: role.name,
      state: 'idle',
      targetPos: null,
      cleaningTrashId: null,
      path: [],
      fixingPcId: null,
      animationTimer: 0
    };
  },

  hire(roleId) {
    const role = this.ROLES.find(r => r.id === roleId);
    if (!role) return;
    if (GameState.level < role.minLevel) { showToast('Need Level ' + role.minLevel + ' to hire!', 'warn'); return; }
    const cost = role.salary * 3; // upfront cost
    if (GameState.cash < cost) { showToast('Need ₱' + cost + ' to hire!', 'warn'); return; }
    GameState.addCash(-cost, '-₱' + cost + ' hiring');
    const emp = this.generateStaff(roleId);
    GameState.staff.push(emp);
    this.createStaffMesh(emp);
    showToast(role.icon + ' Hired ' + emp.name + ' as ' + emp.role + '!', 'success');
    addEventLog(role.icon + ' ' + emp.name + ' joined the team!');
    checkAchievements();
    openModal('staff'); // refresh modal
  },

  fire(empId) {
    const idx = GameState.staff.findIndex(e => e.id === empId);
    if (idx === -1) return;
    const emp = GameState.staff[idx];
    if (emp.mesh) SceneManager.scene.remove(emp.mesh);
    GameState.staff.splice(idx, 1);
    showToast('👋 Fired ' + emp.name, 'warn');
    openModal('staff');
  },

  restoreStaff(data) {
    const emp = { ...data, state: 'idle', targetPos: null, path: [], cleaningTrashId: null, fixingPcId: null, animationTimer: 0 };
    GameState.staff.push(emp);
    this.createStaffMesh(emp);
  },

  createStaffMesh(emp) {
    if (!window.THREE || !SceneManager.scene) return;
    const group = new THREE.Group();
    
    // Body (Blue uniform for staff)
    const bodyGeo = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.15, 0.4, 4, 8) : new THREE.CylinderGeometry(0.15, 0.15, 0.55, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Head
    const isMascot = emp.roleId === 'mascot';
    const headGeo = new THREE.SphereGeometry(isMascot ? 0.22 : 0.14, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: isMascot ? 0xffcc00 : 0xffdbac });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.45;
    group.add(head);

    // Role-specific tools: Broom for cleaners
    if (emp.roleId === 'cleaner') {
      const broomStick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), new THREE.MeshLambertMaterial({ color: 0x884422 }));
      broomStick.position.set(0.2, 0, 0.1);
      broomStick.rotation.z = -0.2;
      group.add(broomStick);

      const broomHead = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xaaaa22 }));
      broomHead.position.set(0.3, -0.35, 0.1);
      group.add(broomHead);
    }

    // Role-specific tools: Wrench for technicians
    if (emp.roleId === 'tech' || emp.roleId === 'night_tech') {
      const wrenchHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), new THREE.MeshLambertMaterial({ color: 0x777777 }));
      wrenchHandle.position.set(0.2, 0, 0.1);
      group.add(wrenchHandle);

      const wrenchHead = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 6, Math.PI * 1.5), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
      wrenchHead.position.set(0.2, 0.15, 0.1);
      wrenchHead.rotation.x = Math.PI / 2;
      group.add(wrenchHead);
    }

    // Fatigue Bar (Morale Indicator)
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    barBg.position.y = 0.8;
    barBg.name = "fatigue_bg";
    group.add(barBg);

    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2d78 }));
    barFill.position.y = 0.8;
    barFill.position.z = 0.01;
    barFill.name = "fatigue_fill";
    group.add(barFill);
    group.userData.fatigueBar = barFill;
    group.userData.fatigueBg = barBg;

    // Spawn near the entrance/service area
    group.position.set(-12 + (Math.random() - 0.5), 0.65, 12 + (Math.random() - 0.5)); 
    SceneManager.scene.add(group);
    emp.mesh = group;
  },

  dailyMoodUpdate() {
    GameState.staff.forEach(emp => {
      // Mood drift
      if (emp.personality === 'Burnt Out') emp.mood = Math.max(10, emp.mood - 5);
      else if (emp.personality === 'Enthusiastic') emp.mood = Math.min(100, emp.mood + 3);
      else emp.mood = Math.max(20, Math.min(100, emp.mood + (Math.random() > 0.5 ? 2 : -2)));

      emp.daysWorked++;
      emp.loyalty = Math.min(100, emp.loyalty + 1);

      // Employee Drama
      emp.isLate = false;
      if (emp.personality === 'Lazy' && Math.random() < 0.25) {
        emp.isLate = true;
        addEventLog(`⏰ ${emp.name} is running late today!`);
        showToast(`${emp.name} is late!`, 'warn');
      }

      if ((emp.personality === 'Grumpy' || emp.personality === 'Burnt Out') && emp.mood < 40) {
        const hasSecurity = GameState.staff.some(s => s.roleId === 'security' && (!s.isLate || GameState.hour >= 10));
        const theftChance = hasSecurity ? 0.02 : 0.1; // 80% reduction if security is on duty
        if (Math.random() < theftChance) {
          const stolen = 50 + Math.floor(Math.random() * 100);
          GameState.addCash(-stolen, `💸 ${emp.name} stole money!`);
          addEventLog(`💸 CRITICAL: ${emp.name} caught stealing ₱${stolen}!`);
          emp.loyalty = Math.max(0, emp.loyalty - 20);
        }
      }

      // Random resignation
      if (emp.mood < 20 && Math.random() < 0.1) {
        this.fire(emp.id);
        addEventLog('😤 ' + emp.name + ' quit due to low morale!');
        showToast('😤 ' + emp.name + ' resigned!', 'danger');
      }
    });
  },

  // Passive effects applied each hour
  applyEffects() {
    const isNight = GameState.hour >= 22 || GameState.hour < 6;
    const techs = GameState.staff.filter(e => e.roleId === 'tech' || e.roleId === 'night_tech');
    const hasMarketing = GameState.staff.some(e => e.roleId === 'marketing');
    const hasEsports = GameState.staff.some(e => e.roleId === 'esports');
    const hasCashier = GameState.staff.some(e => e.roleId === 'cashier');
    const hasCleaner = GameState.staff.some(e => e.roleId === 'cleaner');
    const hasAutoHost = GameState.staff.some(e => e.roleId === 'auto_assign');

    techs.forEach(t => {
      if ((t.isLate && GameState.hour < 10) || t.state !== 'idle') return;

      // Fix vending jam
      if (GameState.upgrades.vending && GameState.upgrades.vendingJammed && Math.random() < t.skill * 0.1) {
        GameState.upgrades.vendingJammed = false;
        showToast('🔧 Tech fixed the vending machine!', 'success');
      }

      // Find a broken PC that isn't being fixed
      const brokenPC = GameState.pcs.find(p => p.broken && !GameState.staff.some(s => s.fixingPcId === p.id));
      if (brokenPC) {
        t.state = 'walking';
        t.targetPos = brokenPC.group.position.clone().add(new THREE.Vector3(0, 0.65, 0.8));
        if (GameState.skills.efficient_tech) t.animationTimer = 1.6; // 20% faster fix
        t.path = SceneManager.getPath(t.mesh.position, t.targetPos);
        t.fixingPcId = brokenPC.id;
      }
    });

    if (hasCashier) {
      const waitingCustomer = GameState.customers.find(c => c.state === 'waiting_to_pay');
      if (waitingCustomer) {
        const cashier = GameState.staff.find(e => e.roleId === 'cashier');
        if (!cashier.isLate || GameState.hour >= 10) {
          CustomerSystem.checkout(waitingCustomer);
          addEventLog(`💁 Cashier processed payment from PC #${waitingCustomer.pc.id + 1}`);
        }
      }
    }

    if (hasCleaner && GameState.trash.length > 0) {
      // Find an idle cleaner to handle the trash
      const cleaner = GameState.staff.find(e => e.roleId === 'cleaner' && e.state === 'idle');
      if (cleaner && (!cleaner.isLate || GameState.hour >= 10)) {
        const trash = GameState.trash.find(t => !GameState.staff.some(s => s.cleaningTrashId === t.id));
        if (trash) {
          cleaner.state = 'walking';
          cleaner.targetPos = new THREE.Vector3(trash.x, 0.65, trash.z);
          cleaner.path = SceneManager.getPath(cleaner.mesh.position, cleaner.targetPos);
          cleaner.cleaningTrashId = trash.id;
        }
      }
    }

    const hasSocMed = GameState.staff.some(e => e.roleId === 'social_mgr' && (!e.isLate || GameState.hour >= 10));
    if (hasSocMed && window.respondToReview) {
      const review = GameState.reviews.find(r => !r.responded);
      if (review && GameState.cash >= 20) {
        window.respondToReview(review.id);
      }
    }

    if (hasAutoHost) {
      const queued = GameState.customers.find(c => c.state === 'queued');
      const freePC = GameState.pcs.find(p => !p.occupied && !p.broken);
      if (queued && freePC) {
        CustomerSystem.assignPC(queued, freePC, queued.desiredType);
        addEventLog('🤖 Auto-Host assigned a customer');
      }
    }

    const marketingChance = GameState.skills.marketing_pro ? 0.25 : 0.2; // 25% more traffic
    if (hasMarketing && Math.random() < marketingChance) CustomerSystem.spawnCustomer();
    return { hasEsports };
  },

  update(delta) {
    const doorPos = new THREE.Vector3(-14.9, 0.65, 10);
    let anyoneNearDoor = false;

    GameState.staff.forEach(emp => {
      if (!emp.mesh) return;
      if (emp.isLate && GameState.hour < 10) return;
      
      const breakRoomPos = new THREE.Vector3(-14, 0.65, 10);
      if (emp.mesh.position.distanceTo(doorPos) < 2.5) anyoneNearDoor = true;
      
      // Update Fatigue Bar
      const fill = emp.mesh.userData.fatigueBar;
      const bg = emp.mesh.userData.fatigueBg;
      if (fill && bg) {
        const lowMorale = emp.mood < 40;
        fill.visible = bg.visible = lowMorale;
        if (lowMorale) {
          fill.scale.x = emp.mood / 100;
          fill.position.x = -0.2 * (1 - emp.mood / 100);
          fill.material.color.setHex(emp.mood < 20 ? 0xff0000 : 0xffaa00);
        }
      }

      if (emp.state === 'walking') {
        if (emp.path && emp.path.length > 0) {
          const nextPoint = emp.path[0];
          const dir = nextPoint.clone().sub(emp.mesh.position);
          if (dir.length() < 0.2) {
            emp.path.shift();
            if (emp.path.length === 0) {
              emp.state = emp.cleaningTrashId !== null ? 'cleaning' : emp.fixingPcId !== null ? 'fixing' : 'idle';
              emp.animationTimer = 2.0;
            }
            return;
          }
          dir.normalize().multiplyScalar(0.05 * delta * 60);
          emp.mesh.position.add(dir);
          emp.mesh.lookAt(nextPoint.x, emp.mesh.position.y, nextPoint.z);
        }
      } else if (emp.state === 'idle') {
        // Return to break room if idle and far away
        if (emp.mesh.position.distanceTo(breakRoomPos) > 1.5) {
          emp.state = 'walking';
          emp.targetPos = breakRoomPos.clone();
          emp.path = SceneManager.getPath(emp.mesh.position, emp.targetPos);
        } else {
          // Rest morale when in break room
          const recoveryRate = GameState.upgrades.staffLounge ? 0.5 : 0.2;
          emp.mood = Math.min(100, emp.mood + recoveryRate);
        }
        // Simple idle breathing
        emp.mesh.position.y = 0.65 + Math.sin(Date.now() * 0.002) * 0.01;
      } else if (emp.state === 'cleaning' || emp.state === 'fixing') {
        emp.animationTimer -= delta;
        // Action animation: rotate and bob
        emp.mesh.rotation.y += Math.sin(Date.now() * 0.01) * 0.1;
        emp.mesh.position.y = 0.65 + Math.sin(Date.now() * 0.02) * 0.02;
        
        if (emp.animationTimer <= 0) {
          if (emp.cleaningTrashId !== null) {
            SceneManager.cleanTrash(emp.cleaningTrashId);
            emp.cleaningTrashId = null;
          } else if (emp.fixingPcId !== null) {
            const pc = GameState.pcs.find(p => p.id === emp.fixingPcId);
            if (pc) {
              pc.broken = false;
              SceneManager.updatePC(pc);
              showToast(`🔧 Technician fixed PC #${pc.id + 1}`, 'success');
            }
            emp.fixingPcId = null;
          }
          emp.state = 'idle';
          emp.mesh.position.y = 0.65;
        }
      }
    });

    SceneManager.staffDoorOpen = anyoneNearDoor;
  }
};

GameState.onTick(() => StaffSystem.applyEffects());
