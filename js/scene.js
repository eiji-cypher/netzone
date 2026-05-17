/* ===== SCENE MANAGER ===== */
window.SceneManager = {
  scene: null,
  renderer: null,
  clock: null,
  activeTool: null,
  ghostMesh: null,
  raycaster: null,
  mouse: null,
  floorMesh: null,
  gridHelper: null,
  frameId: null,
  loader: null,
  ambientLight: null,
  sunLight: null,
  toolRotation: 0,
  constructionSlots: [],
  hoveredSlot: null,
  trashMeshes: [],
  navGrid: [], // 0 = walkable, 1 = blocked
  rainParticles: null,
  renovationOverlay: null,
  staffDoorHinge: null,
  staffDoorOpen: false,
  securityCameraMeshes: [],
  _prevStaffDoorOpen: false,
  fullSign: null,
  achievementPosters: [],
  wallMeshes: [],
  zones: [
    { name: 'PC Zone', xMin: -14, xMax: 14, zMin: -12, zMax: 8, allowedTools: ['pc', 'desk'], color: 0x39ff14 }, // Green for PC
    { name: 'VR Zone', xMin: -14, xMax: -8, zMin: -14, zMax: -12, allowedTools: ['vr'], color: 0xaa00ff },
    { name: 'Piso Net Zone', xMin: -14, xMax: 14, zMin: 8, zMax: 12, allowedTools: ['pisonet'], color: 0x00c8ff }, // Blue for PisoNet
    { name: 'PlayStation Zone', xMin: 8, xMax: 14, zMin: -14, zMax: -12, allowedTools: ['ps'], color: 0x0066ff },
    { name: 'Lounge Zone', xMin: -14, xMax: 14, zMin: 8, zMax: 14, allowedTools: ['coffeeMachine', 'vending'], color: 0x39ff14 },
    { name: 'Office Zone', xMin: -5, xMax: 5, zMin: -14, zMax: -10, allowedTools: [], color: 0xffd700 },
    { name: 'VIP Zone', xMin: 6, xMax: 14, zMin: -14, zMax: -6, allowedTools: ['pc'], color: 0xffd700 },
  ],
  trophyCaseMesh: null,
  securityCameraPositions: [
    { id: 'cam1', pos: new THREE.Vector3(-14, 4, 13), lookAt: new THREE.Vector3(0, 1, 0) }, // Entrance
    { id: 'cam2', pos: new THREE.Vector3(14, 4, 13), lookAt: new THREE.Vector3(0, 1, 0) },  // Right side
    { id: 'cam3', pos: new THREE.Vector3(-14, 4, -13), lookAt: new THREE.Vector3(0, 1, 0) }, // Back left
    { id: 'cam4', pos: new THREE.Vector3(14, 4, -13), lookAt: new THREE.Vector3(0, 1, 0) },  // Back right
    { id: 'cam_office', pos: new THREE.Vector3(0, 4, -9), lookAt: new THREE.Vector3(0, 1, -13) }, // Office view
  ],
  serverRackMesh: null,

  init() {
    if (this.renderer) return; // Prevent duplicate initialization

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x080b14);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x080b14, 0.035);
    this.loader = new (THREE.GLTFLoader || window.GLTFLoader)();

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initNavGrid();
    window.addEventListener('resize', () => this.onResize());
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.activeTool) {
        this.toolRotation += Math.PI / 2;
        showToast('🔄 Rotated object', 'info');
      }
      if (e.code === 'Escape') { setTool(null); showToast('Cancelled', 'info'); }
      if (e.code === 'KeyF') toggleFlashlight();
      if (e.code === 'KeyE' && CameraSystem.mode !== 'tycoon') this.interactInPerson();
    });

    this.animate();
  },

  rebuildFullScene() {
    this.resetScene();
    this.buildRoom(); // Builds floor, walls, static doors, reception, queue table
    this.buildRoomStaticElements(); // Builds ceiling, lights, particles, rain, neon strips
    this.addConstructionSlots(); // Adds construction slots
    this.addDynamicSceneElements(); // Adds office, VIP, cameras, posters, server, coffee, trophy case
    this.rebuildStateObjects(); // Crucial: Places actual PCs and Staff meshes

    // Refresh visual state
    this.updateVisualTheme();
    this.updateWeatherVisuals(GameState.weather);
    if (GameState.upgrades.pancitCooker) document.getElementById('btn-pancit')?.classList.remove('hidden');
    GameState.trash.forEach(t => this.spawnTrashVisual(t));
  },

  rebuildStateObjects() {
    const savedPCs = [...GameState.pcs];
    const savedStaff = [...GameState.staff];
    GameState.pcs = [];
    GameState.staff = [];
    
    savedPCs.forEach(p => this.placePCAt(p.x, p.z, p.quality, p.broken, p.rotation, p.type, p.underMaintenance));
    savedStaff.forEach(s => StaffSystem.restoreStaff(s));
  },

  resetScene() {
    if (!this.scene) return;
    // Completely clear scene objects to prevent duplicates or ghost meshes
    const toRemove = this.scene.children.filter(obj => 
      obj.type !== 'PerspectiveCamera' && 
      !obj.isAmbientLight && 
      obj !== this.sunLight
    );
    
    toRemove.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.scene.remove(obj);
    });
    this.constructionSlots = [];
    this.trashMeshes = [];
    this.serverRackMesh = null;
    this.fullSign = null;
    this.achievementPosters = [];
    this.securityCameraMeshes = [];
    this.wallMeshes = [];
    this.initNavGrid();
    this.trophyCaseMesh = null; // Clear trophy case reference
    // Re-block static table in nav grid as it's not re-added during resetScene
    for(let x = 2; x <= 12; x++) {
      for(let z = 12; z <= 15; z++) this.updateNavGrid(x, z, false);
    }
  },

  buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30, 30, 30);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a2235 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.floorMesh.name = 'floor';
    this.scene.add(this.floorMesh);

    // Grid
    this.gridHelper = new THREE.GridHelper(30, 30, 0x00c8ff, 0x0a2040);
    this.gridHelper.position.y = 0.01;
    this.gridHelper.name = 'gridHelper';
    this.scene.add(this.gridHelper);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x151b2b });
    
    // Segmented Back Wall for Window
    const sideWallGeo = new THREE.BoxGeometry(10, 5, 0.2);
    const wallBackL = new THREE.Mesh(sideWallGeo, wallMat);
    wallBackL.position.set(-10, 2.5, -15);
    this.scene.add(wallBackL);
    this.wallMeshes.push(wallBackL);

    const wallBackR = new THREE.Mesh(sideWallGeo, wallMat);
    wallBackR.position.set(10, 2.5, -15);
    this.scene.add(wallBackR);
    this.wallMeshes.push(wallBackR);

    const wallBottom = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 0.2), wallMat);
    wallBottom.position.set(0, 0.75, -15);
    this.scene.add(wallBottom);
    this.wallMeshes.push(wallBottom);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.1, transmission: 0.8 }));
    glass.position.set(0, 3.25, -14.9);
    this.scene.add(glass);

    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 30), wallMat);
    wallLeft.position.set(-15, 2.5, 0);
    this.scene.add(wallLeft);
    this.wallMeshes.push(wallLeft);

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 30), wallMat);
    wallRight.position.set(15, 2.5, 0);
    this.scene.add(wallRight);
    this.wallMeshes.push(wallRight);

    // Door at entrance (0, 2.5, 15)
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.4), wallMat);
    doorFrame.position.set(0, 2, 14.8);
    this.scene.add(doorFrame);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.8, 0.1), new THREE.MeshLambertMaterial({ color: 0x442211 }));
    door.position.set(0, 1.9, 15.0); // Move slightly out of the wall
    this.scene.add(door);

    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
    handle.position.set(0.8, 1.9, 15);
    this.scene.add(handle);

    // "FULL" Sign above door
    const signGeo = new THREE.BoxGeometry(1.5, 0.6, 0.2);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
    this.fullSign = new THREE.Mesh(signGeo, signMat);
    this.fullSign.position.set(0, 4.2, 14.8);
    this.scene.add(this.fullSign);
    this.updateFullSign(false);

    // Entrance Queue Table (The new table where customers line up)
    const lineTableGeo = new THREE.BoxGeometry(10, 0.8, 1.2);
    const lineTable = new THREE.Mesh(lineTableGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    lineTable.position.set(7, 0.4, 13.5);
    this.scene.add(lineTable);

    // Reception / Cashier Desk
    const receptionDesk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 1.2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    receptionDesk.position.set(-8, 0.4, 13.5);
    this.scene.add(receptionDesk);
    this.updateNavGrid(-8, 13, false);

    // Staff Break Room Door
    const staffDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4, 0.2), wallMat);
    staffDoorFrame.position.set(-14.8, 2, 10);
    staffDoorFrame.rotation.y = Math.PI / 2;
    this.scene.add(staffDoorFrame);

    this.staffDoorHinge = new THREE.Group();
    this.staffDoorHinge.position.set(-14.8, 1.9, 11); // Move slightly away from wall surface
    this.staffDoorHinge.rotation.y = Math.PI / 2;
    const staffDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3.8, 0.1), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    staffDoorMesh.position.set(0, 0, -1); // Offset by half-width so it pivots on edge
    this.staffDoorHinge.add(staffDoorMesh);
    this.scene.add(this.staffDoorHinge);

    // Mark static table as blocked in nav grid
    for(let x = 2; x <= 12; x++) {
      for(let z = 12; z <= 15; z++) this.updateNavGrid(x, z, false);
    }

    // Dynamic elements based on GameState
    // These will be added during restore or new game setup
    this.updateVisualTheme();
  },

  initNavGrid() {
    this.navGrid = [];
    for (let x = 0; x <= 30; x++) {
      this.navGrid[x] = new Array(31).fill(0);
    }
  },

  updateNavGrid(worldX, worldZ, walkable) {
    const gx = Math.round(worldX + 15);
    const gz = Math.round(worldZ + 15);
    if (gx >= 0 && gx <= 30 && gz >= 0 && gz <= 30) {
      this.navGrid[gx][gz] = walkable ? 0 : 1;
    }
  },

  getPath(startPos, endPos) {
    const start = { x: Math.round(startPos.x + 15), z: Math.round(startPos.z + 15) };
    const end = { x: Math.round(endPos.x + 15), z: Math.round(endPos.z + 15) };
    
    const queue = [[start]];
    const visited = new Set();
    visited.add(`${start.x},${start.z}`);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current.x === end.x && current.z === end.z) {
        return path.map(p => new THREE.Vector3(p.x - 15, 0.65, p.z - 15));
      }

      const neighbors = [
        { x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z },
        { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x <= 30 && n.z >= 0 && n.z <= 30) {
          if (!visited.has(`${n.x},${n.z}`) && (this.navGrid[n.x][n.z] === 0 || (n.x === end.x && n.z === end.z))) {
            visited.add(`${n.x},${n.z}`);
            queue.push([...path, n]);
          }
        }
      }
      if (queue.length > 500) break; // Safety break for unreachable targets
    }
    return [new THREE.Vector3(endPos.x, 0.65, endPos.z)]; // Fallback to direct line if pathfinding fails
  },

  buildRoomStaticElements() {
    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x080b14 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);

    this.buildLighting();
    this.addParticles();
    this.addRain();

    // Neon strips on walls
    this.addNeonStrip(new THREE.Vector3(-14.8, 3, 0), new THREE.Euler(0, Math.PI/2, 0), 0x00c8ff);
    this.addNeonStrip(new THREE.Vector3(14.8, 3, 0), new THREE.Euler(0, -Math.PI/2, 0), 0xff2d78);
    this.addNeonStrip(new THREE.Vector3(0, 3, -14.8), new THREE.Euler(0, 0, 0), 0x39ff14);
  },

  addNeonStrip(pos, rot, color) {
    const geo = new THREE.BoxGeometry(28, 0.1, 0.05);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.copy(rot);
    this.scene.add(mesh);

    const light = new THREE.PointLight(color, 0.4, 12);
    light.position.copy(pos);
    this.scene.add(light);
  },

  // This is called during game setup and when loading a game
  // It adds dynamic elements based on GameState
  addDynamicSceneElements() {
    if (GameState.upgrades.serverRack) this.addServerRack();
    if (GameState.upgrades.coffeeMachine) this.addCoffeeStation();
    
    // Re-check levels for expansions
    if (GameState.level >= 15 && !this.scene.getObjectByName('manager_office')) this.addManagerOffice();
    if (GameState.level >= 25 && !this.scene.getObjectByName('vip_lounge')) this.addVIPLounge();

    if (GameState.level >= 15 && !this.scene.getObjectByName('trophy_case')) this.addTrophyCase();
    if (GameState.upgrades.securityCameras && this.securityCameraMeshes.length === 0) {
      this.securityCameraPositions.forEach(cam => {
        const camMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x888888 })
        );
        camMesh.position.copy(cam.pos);
        camMesh.position.y -= 0.5; // Place slightly below ceiling
        camMesh.userData.isSecurityCamera = true;
        camMesh.userData.camId = cam.id;
        this.scene.add(camMesh);
        this.securityCameraMeshes.push(camMesh);
      });
    }
    this.updateVisualTheme(); // Apply theme after all elements are built
    this.updateHallOfFame();
  },

  addManagerOffice() {
    const group = new THREE.Group();
    group.name = "manager_office";
    
    // Glass Walls
    const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.2, transmission: 0.5, thickness: 0.5 });
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 5), wallMat);
    wallL.position.set(-5, 1.5, -12.5);
    group.add(wallL);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 5), wallMat);
    wallR.position.set(5, 1.5, -12.5);
    group.add(wallR);

    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 0.1), wallMat);
    wallFront.position.set(0, 1.5, -10);
    group.add(wallFront);

    // Rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshLambertMaterial({ color: 0x441111 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.02, -12.5);
    group.add(rug);

    // Executive Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.2), new THREE.MeshLambertMaterial({ color: 0x221100 }));
    desk.position.set(0, 0.8, -13.5);
    group.add(desk);

    // Manager Chair
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    chair.position.set(0, 0.6, -14.2);
    group.add(chair);

    // Laptop on desk
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    laptopBase.position.set(0.6, 0.81, -13.5);
    laptopBase.userData.isLaptop = true;
    group.add(laptopBase);
    const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.02), new THREE.MeshBasicMaterial({ color: 0x00c8ff }));
    laptopScreen.position.set(0.6, 1.0, -13.65);
    laptopScreen.rotation.x = -0.3;
    laptopScreen.userData.isLaptop = true;
    group.add(laptopScreen);

    // Security Post outside office
    const secPost = new THREE.Group();
    secPost.position.set(-6, 0, -10.5);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.2), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pillar.position.y = 0.6;
    secPost.add(pillar);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    top.position.y = 1.2;
    secPost.add(top);
    this.scene.add(secPost);

    this.scene.add(group);
    
    // Block navigation
    for(let x = -5; x <= 5; x++) {
      for(let z = -15; z <= -10; z++) this.updateNavGrid(x, z, false);
    }
    showToast('🏢 Manager Office Unlocked!', 'success');
  },

  addServerRack() {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    rack.position.set(0, 1.5, -14);
    rack.name = 'server_rack';
    this.scene.add(rack);
    for(let x = -1; x <= 1; x++) {
      for(let z = -15; z <= -13; z++) this.updateNavGrid(x, z, false);
    }
    showToast('🗄️ Server Rack installed!', 'success');
  },

  addCoffeeStation() {
    const machine = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.8), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    machine.position.set(-10, 0.75, 13.5);
    machine.name = 'coffee_machine';
    this.scene.add(machine);
    for(let x = -11; x <= -9; x++) {
      for(let z = 13; z <= 14; z++) this.updateNavGrid(x, z, false);
    }
    showToast('☕ Coffee Machine installed!', 'success');
  },


  addVIPLounge() {
    const group = new THREE.Group();
    group.name = "vip_lounge";
    
    // Luxury Gold/Glass Walls
    const wallMat = new THREE.MeshPhysicalMaterial({ color: 0xffd700, transparent: true, opacity: 0.2, transmission: 0.5, thickness: 0.8 });
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.1), wallMat);
    wallBack.position.set(10, 1.5, -14);
    group.add(wallBack);

    const wallSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 8), wallMat);
    wallSide.position.set(6, 1.5, -10);
    group.add(wallSide);

    // Gold Trim
    const trimMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.2, 0.2), trimMat);
    trim.position.set(10, 3, -14);
    group.add(trim);

    // Purple Carpet
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshLambertMaterial({ color: 0x330044 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(10, 0.02, -10);
    group.add(carpet);

    this.scene.add(group);
    this.playRenovationAnimation(group, '✨ VIP Lounge Expansion Unlocked!');
  },

  addTrophyCase() {
    const group = new THREE.Group();
    group.name = "trophy_case";

    // Cabinet Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.8), new THREE.MeshLambertMaterial({ color: 0x221100 }));
    base.position.set(0, 0.5, -14.5);
    group.add(base);

    // Glass Cabinet
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.1, transmission: 0.9, roughness: 0.1 });
    const glassBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.05), glassMat);
    glassBack.position.set(0, 1.5, -14.85);
    group.add(glassBack);

    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.05), glassMat);
    glassFront.position.set(0, 1.5, -14.15);
    group.add(glassFront);

    const glassSides = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.7), glassMat);
    glassSides.position.set(1.2, 1.5, -14.5);
    group.add(glassSides);
    const glassSides2 = glassSides.clone();
    glassSides2.position.x = -1.2;
    group.add(glassSides2);

    // Shelves
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x332211 });
    const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.7), shelfMat);
    shelf1.position.set(0, 1.0, -14.5);
    group.add(shelf1);
    const shelf2 = shelf1.clone();
    shelf2.position.y = 2.0;
    group.add(shelf2);

    this.scene.add(group);
    this.trophyCaseMesh = group;
    this.updateTrophyCase();
    showToast('🏆 Trophy Case Unlocked!', 'success');
  },

  updateTrophyCase() {
    if (!this.trophyCaseMesh) return;

    // Clear existing trophies
    this.trophyCaseMesh.children.filter(c => c.name === 'trophy').forEach(t => this.trophyCaseMesh.remove(t));

    const goldenAchievements = ACHIEVEMENTS.filter(a => a.isGolden && GameState.achievements[a.id]?.unlocked);
    goldenAchievements.forEach((ach, index) => {
      const trophyGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
      const trophyMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
      const trophy = new THREE.Mesh(trophyGeo, trophyMat);
      trophy.name = 'trophy';

      // Position trophies on shelves
      const shelfY = (index % 2 === 0) ? 1.25 : 2.25; // Alternate shelves
      const xOffset = -0.8 + (index % 4) * 0.5; // Spread across the shelf

      trophy.position.set(xOffset, shelfY, -14.5);
      this.trophyCaseMesh.add(trophy);
    });
  },

  playRenovationAnimation(group, message) {
    // Make the group initially invisible
    group.traverse(obj => {
      if (obj.isMesh) obj.material.transparent = true;
      if (obj.isMesh) obj.material.opacity = 0;
    });
    
    showToast('🚧 Renovation in progress...', 'info');

    // Animate opacity over 3 seconds
    let opacity = 0;
    const interval = setInterval(() => {
      opacity += 0.01; // Adjust speed as needed
      group.traverse(obj => { if (obj.isMesh) obj.material.opacity = opacity; });
      if (opacity >= 1) {
        clearInterval(interval);
        showToast(message, 'success');
      }
    }, 30); // ~30ms per frame for 3 seconds = 100 frames
  },

  updateVisualTheme() {
    const wallColors = [0x1a2235, 0x222222, 0x331a2a, 0x1a331a, 0x332a1a]; // Brighter versions
    const floorColors = [0x20283a, 0x1f1f1f, 0x302030, 0x203020, 0x3a301a]; // Brighter versions
    
    const wallIdx = GameState.upgrades.wallColor || 0;
    const floorIdx = GameState.upgrades.floorPattern || 0;

    this.wallMeshes.forEach(w => w.material.color.setHex(wallColors[wallIdx]));
    
    if (this.floorMesh) {
      this.floorMesh.material.color.setHex(floorColors[floorIdx]);
      
      // If upgraded, add a procedural pattern
      if (floorIdx > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + floorColors[floorIdx].toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 128, 128); // Base color
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        if (floorIdx === 1) { // Grid
          ctx.strokeRect(0, 0, 128, 128);
        } else if (floorIdx === 2) { // Hex/Dots
          ctx.beginPath(); ctx.arc(64, 64, 30, 0, Math.PI*2); ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(15, 15);
        this.floorMesh.material.map = tex;
      } else {
        this.floorMesh.material.map = null;
      }
      this.floorMesh.material.needsUpdate = true;
    }
  },

  updateDayNightCycle() {
    if (!this.ambientLight || !this.sunLight) return;
    const hour = GameState.hour + (GameState.minute / 60);
    
    // Adjust ambient and sun light intensities and colors
    let ambientIntensity = 0.6;
    let sunIntensity = 0.1;
    let sunColor = 0xffffff;

    if (hour >= 6 && hour < 8) { // Sunrise
      const t = (hour - 6) / 2;
      ambientIntensity = 0.6 + (1.0 * t);
      sunIntensity = 0.1 + (0.7 * t);
      sunColor = new THREE.Color(0xffaa44).lerp(new THREE.Color(0xffffff), t);
    } else if (hour >= 8 && hour < 17) { // Day
      ambientIntensity = 1.6;
      sunIntensity = 0.8;
    } else if (hour >= 17 && hour < 20) { // Sunset
      const t = (hour - 17) / 3;
      ambientIntensity = 1.6 - (1.0 * t);
      sunIntensity = 0.8 * (1 - t);
      sunColor = new THREE.Color(0xffffff).lerp(new THREE.Color(0xff5500), t);
    } else { // Night
      ambientIntensity = 0.6;
      sunIntensity = 0.1;
    }

    this.ambientLight.intensity = ambientIntensity;
    this.sunLight.intensity = sunIntensity;
    this.sunLight.color.set(sunColor);
  },

  addRain() {
    const count = 1500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = -16 - Math.random() * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x88ccff, size: 0.06, transparent: true, opacity: 0.4 });
    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  },

  updateWeatherVisuals(weather) {
    if (this.rainParticles) {
      this.rainParticles.visible = (weather === 'rain');
      this.scene.fog.density = (weather === 'rain') ? 0.08 : 0.035; // Increased fog density for rain
    }
  },

  updateHallOfFame() {
    // Clear current posters and associated lights
    this.achievementPosters.forEach(p => {
      if (p.userData.light) this.scene.remove(p.userData.light);
      this.scene.remove(p);
    }); // Clear old lights
    this.achievementPosters = [];

    const unlockedIds = Object.keys(GameState.achievements).filter(id => GameState.achievements[id].unlocked);
    unlockedIds.forEach((id, index) => {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (!ach) return;

      // Grid placement on the back wall (z = -14.8)
      const x = -10.5 + (index % 8) * 3;
      const y = 3.5 - Math.floor(index / 8) * 1.5;
      const z = -14.75;

      const poster = this.createPosterMesh(ach);
      poster.position.set(x, y, z);
      poster.userData = { achId: id }; // Store ID for interaction

      // Add a dedicated light for the achievement
      const lightColor = ach.isGolden ? 0xffd700 : 0x00c8ff;
      const pLight = new THREE.PointLight(lightColor, 0.4, 3);
      pLight.position.set(x, y, z + 0.3);
      this.scene.add(pLight);
      poster.userData.light = pLight; // Track for deletion

      this.scene.add(poster);
      this.achievementPosters.push(poster);
    });
  },

  createPosterMesh(ach) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background and frame
    ctx.fillStyle = ach.isGolden ? '#201800' : '#0a1020';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = ach.isGolden ? '#ffd700' : '#00c8ff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 120);

    ctx.textAlign = 'center';
    ctx.fillStyle = ach.isGolden ? '#ffd700' : '#fff';
    ctx.font = '50px serif';
    ctx.fillText(ach.icon, 128, 60);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(ach.name.toUpperCase(), 128, 100);

    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshLambertMaterial({ map: tex }));
    return mesh;
  },

  updateFullSign(isFull) {
    if (!this.fullSign) return;
    this.fullSign.material.color.setHex(isFull ? 0xff0000 : 0x220000);
    // Optional: Add a small point light here if you want it to cast a red glow
  },

  buildLighting() {
    // Clear old lights to prevent duplicates
    this.scene.children.filter(obj => obj.isLight && obj !== this.flashlightMesh).forEach(l => this.scene.remove(l));

    // Ambient
    this.ambientLight = new THREE.AmbientLight(0x1a2a45, 1.2);
    this.scene.add(this.ambientLight);

    // Main overhead
    if (this.sunLight) this.scene.remove(this.sunLight); // Remove existing sunLight if any
    this.sunLight = new THREE.DirectionalLight(0x4488cc, 0.6);
    this.sunLight.position.set(5, 10, 5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.scene.add(this.sunLight);
    
    // Ceiling strip lights
    // Clear old strip lights
    this.scene.children.filter(obj => obj.name === 'strip_light' || obj.name === 'strip_light_target').forEach(l => this.scene.remove(l));
    for (let x = -10; x <= 10; x += 5) {
      const light = new THREE.SpotLight(0x2255aa, 0.7, 15, Math.PI/4);
      light.position.set(x, 4.8, 0);
      light.target.position.set(x, 0, 0);
      light.castShadow = false;
      light.name = 'strip_light';
      light.target.name = 'strip_light_target';
      this.scene.add(light);
      this.scene.add(light.target);
    }
    // Additional lights for the back wall
    for (let x = -10; x <= 10; x += 5) {
      const light = new THREE.SpotLight(0x2255aa, 0.5, 10, Math.PI/6);
      light.position.set(x, 4.0, -12); light.target.position.set(x, 0, -14);
      light.castShadow = false;
      light.name = 'strip_light';
      light.target.name = 'strip_light_target';
      this.scene.add(light);
      this.scene.add(light.target);
    }
  },

  addParticles() {
    const count = 200;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 28;
      positions[i*3+1] = Math.random() * 4.5;
      positions[i*3+2] = (Math.random() - 0.5) * 28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x00c8ff, size: 0.03, transparent: true, opacity: 0.4 });
    const particles = new THREE.Points(geo, mat);
    particles.name = 'particles';
    this.scene.add(particles);
  },

  addConstructionSlots() {
    // Create a grid of slots where PCs can be placed
    this.constructionSlots.forEach(s => this.scene.remove(s.mesh));
    this.constructionSlots = [];

    this.zones.forEach(zone => {
      for (let x = zone.xMin; x <= zone.xMax; x += 3) {
        for (let z = zone.zMin; z <= zone.zMax; z += 4) {
          // Skip if it's too close to the entrance or other fixed objects
          if (x > -2 && x < 2 && z > 10) continue; // Entrance area
          if (x > 5 && x < 9 && z > 10) continue; // Queue table area
          if (x > -2 && x < 2 && z < -10) continue; // Snack bar area
          if (x > 3 && x < 7 && z > 10) continue; // Reception desk area
          if (x < -3 && x > -7 && z > 10) continue; // Cashier desk area

          // Skip Office area
          if (x > -6 && x < 6 && z < -9) continue;

          // Skip VIP area if not reached level 25
          if (GameState.level < 25 && x > 5 && z < -5) continue;

        const geo = new THREE.BoxGeometry(1, 0.5, 1); // Significantly increased height
        const mat = new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.3 }); // Slightly higher base opacity
        const slot = new THREE.Mesh(geo, mat);
        slot.position.set(x, 0.25, z); // Lifted higher off the floor
        slot.name = 'construction_slot';
        slot.userData = { zone: zone.name, allowedTools: zone.allowedTools };
        this.scene.add(slot);
        this.constructionSlots.push({ mesh: slot, occupied: false });
      }
    }
    });
  },

  spawnTrash(pos) {
    const trashData = { id: Date.now() + Math.random(), x: pos.x, y: pos.y, z: pos.z };
    GameState.trash.push(trashData);
    this.spawnTrashVisual(trashData);
  },

  spawnTrashVisual(data) {
    const trashGeo = new THREE.DodecahedronGeometry(0.1, 0);
    const trashMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const mesh = new THREE.Mesh(trashGeo, trashMat);
    mesh.position.set(data.x, data.y, data.z);
    mesh.userData = { trashId: data.id };
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    this.scene.add(mesh);
    this.trashMeshes.push(mesh);
  },

  cleanTrash(id) {
    const dataIdx = GameState.trash.findIndex(t => t.id === id);
    if (dataIdx !== -1) GameState.trash.splice(dataIdx, 1);

    const meshIdx = this.trashMeshes.findIndex(m => m.userData.trashId === id);
    if (meshIdx !== -1) {
      this.scene.remove(this.trashMeshes[meshIdx]);
      this.trashMeshes.splice(meshIdx, 1);
      showToast('🧹 Cleaned up trash', 'success');
      GameState.addReputation(1);
    }
  },

  cleanRandomTrash() {
    if (GameState.trash.length > 0) {
      this.cleanTrash(GameState.trash[0].id);
    }
  },

  placePCAt(x, z, quality = 0, broken = false, rotation = null, type = 'pc', maintenance = false) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = (rotation !== null) ? rotation : this.toolRotation;

    // Check if station is in the VIP zone
    const isVIPZone = x >= 6 && x <= 14 && z >= -14 && z <= -6;

    // Load GLTF model based on type, or use procedural fallback
    let deskColor = 0x222222;
    let screenColor = broken ? 0x330000 : [0x00c8ff, 0xff2d78, 0x39ff14, 0xffd700, 0xaa00ff][quality % 5];

    if (isVIPZone) {
      screenColor = 0xffd700; // Force golden screen for VIP zone
    }

    if (type === 'vr') {
      deskColor = 0x1a0a2a; screenColor = 0xaa00ff;
    } else if (type === 'ps') {
      deskColor = 0x0a1a2a; screenColor = 0x0066ff;
    } else if (type === 'pisonet') {
      deskColor = 0x4a4a4a; screenColor = 0x888888; // Rugged, older look
    } else if (type === 'pc') {
      deskColor = 0x222222;
    }

    // Procedural Desk
    // Procedural Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), new THREE.MeshLambertMaterial({ color: deskColor }));
    desk.position.y = 0.7;
    group.add(desk);

    // Procedural Legs
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    legs.position.y = 0.35;
    group.add(legs);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x050505 }));
    tower.position.set(0.4, 0.95, 0);
    group.add(tower);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: screenColor }));
    screen.position.set(0, 1.2, -0.2);
    group.add(screen);

    if (type === 'pc' || type === 'pisonet') {
      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      keyboard.position.set(0, 0.72, 0.15);
      group.add(keyboard);
      // Add a simple mouse for PC/PisoNet
      const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      mouse.position.set(0.3, 0.72, 0.15);
      group.add(mouse);
    } else if (type === 'ps') {
      const controller = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.15), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      controller.position.set(0, 0.75, 0.15);
      group.add(controller);
    } else if (type === 'vr') {
      const headset = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      headset.position.set(0, 0.75, 0.15);
      group.add(headset);
    }

    // Chair
    if (type === 'ps') {
      // Console Sofa
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      sofa.position.set(0, 0.2, 0.8);
      group.add(sofa);
      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.2), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      sofaBack.position.set(0, 0.5, 1.1);
      group.add(sofaBack);
    } else {
      // Upgraded Gaming Chair
      const chairColor = type === 'pisonet' ? 0x333333 : 0x222222;
      const chairBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: chairColor }));
      chairBase.position.set(0, 0.35, 0.6);
      group.add(chairBase);

      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      chairBack.position.set(0, 0.7, 0.85);
      group.add(chairBack);
      
      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      armrest.position.set(0.3, 0.5, 0.6);
      group.add(armrest);
      const armrest2 = armrest.clone();
      armrest2.position.x = -0.3;
      group.add(armrest2);
    }

    this.scene.add(group);

    // Block the nav grid around the PC
    for(let dx = -1; dx <= 1; dx++) {
      for(let dz = -1; dz <= 1; dz++) this.updateNavGrid(x + dx, z + dz, false);
    }

    const pcLight = new THREE.PointLight(screenColor, broken ? 0 : 0.3, 2);
    pcLight.position.set(0, 0.4, -0.1);
    group.add(pcLight);

    const pcObj = { 
      group, 
      mesh: desk, 
      screen, 
      light: pcLight, 
      quality, 
      broken, 
      underMaintenance: maintenance,
      occupied: false,
      type: type,
      isVIP: isVIPZone, // Now correctly defined
      id: GameState.pcs.length 
    };
    
    GameState.pcs.push(pcObj);
    return pcObj;
  },

  updatePC(pc) {
    let color = pc.broken ? 0x330000 : [0x00c8ff, 0xff2d78, 0x39ff14, 0xffd700, 0xaa00ff][pc.quality % 5];
    if (pc.underMaintenance) color = 0xffff00; // Maintenance yellow
    pc.screen.material.color.setHex(color);
    pc.light.intensity = (pc.broken || pc.underMaintenance) ? 0.1 : 0.3;
    pc.light.color.setHex(color);
  },

  showGhost(x, z) {
    if (!this.ghostMesh) {
      const geo = new THREE.BoxGeometry(0.9, 0.5, 0.6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00c8ff, transparent: true, opacity: 0.35, wireframe: false });
      this.ghostMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.ghostMesh);
    }
    this.ghostMesh.position.set(x, 0.6, z);
    this.ghostMesh.rotation.y = this.toolRotation;
    this.ghostMesh.visible = true;
  },

  hideGhost() {
    if (this.ghostMesh) this.ghostMesh.visible = false;
  },

  tryBuyPC(slot) {
    // If tutorial is active, ensure the player has at least reached the first tool selection step
    if (Tutorial.active && Tutorial.stepIdx < 2) {
      showToast('🚫 Please wait for the tutorial intro to finish!', 'warn');
      return;
    }

    const costs = { pc: 150, ps: 250, vr: 400, pisonet: 80, desk: 50 };
    const tool = this.activeTool;

    if (!slot.mesh.userData.allowedTools.includes(tool)) {
      showToast(`🚫 Cannot place ${tool.toUpperCase()} in this zone!`, 'warn');
      return;
    }
    const cost = costs[tool] || 150;

    if (GameState.cash < cost) {
      showToast('Not enough money! Need ₱' + cost, 'warn');
      return;
    }
    GameState.addCash(-cost, '-₱' + cost);
    const pc = this.placePCAt(slot.mesh.position.x, slot.mesh.position.z, GameState.upgrades.pcQuality, false, null, tool);
    slot.occupied = true;
    slot.mesh.visible = false;
    GameState.addXP(10);
    showToast(`🖥️ ${tool.toUpperCase()} station built!`, 'success');

    // If tutorial is active and this was the expected action, advance tutorial.
    if (Tutorial.active && Tutorial.STEPS[Tutorial.stepIdx].waitFlag === 'pc_placed') {
      Tutorial.onFlag('pc_placed');
    }
  },

  interactInPerson() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), CameraSystem.camera);
    const interactRange = 4.5;
    
    // Check for Achievement Posters
    const posterHits = this.raycaster.intersectObjects(this.achievementPosters);
    if (posterHits.length > 0 && posterHits[0].distance <= interactRange) {
      const achId = posterHits[0].object.userData.achId;
      if (achId) openModal('certificate', achId);
      return;
    }

    // Check for Laptop
    const office = this.scene.getObjectByName('manager_office');
    if (office) {
      const laptopHits = this.raycaster.intersectObject(office, true);
      if (laptopHits.length > 0 && laptopHits[0].distance <= interactRange && laptopHits[0].object.userData.isLaptop) {
        openModal('managerStats');
        return;
      }
    }

    // Check for Security Cameras
    if (GameState.upgrades.securityCameras) {
      const camHits = this.raycaster.intersectObjects(this.securityCameraMeshes);
      if (camHits.length > 0 && camHits[0].distance <= interactRange) {
        CameraSystem.setFixedCamera(camHits[0].object.userData.camId);
        return;
      }
    }

    // Check Customers
    const custMeshes = GameState.customers.map(c => c.mesh);
    const custHits = this.raycaster.intersectObjects(custMeshes, true);
    if (custHits.length > 0 && custHits[0].distance <= interactRange) {
      let cObj = custHits[0].object;
      let customer = null;
      while (cObj && !customer) {
        customer = GameState.customers.find(c => c.mesh === cObj);
        cObj = cObj.parent;
      }
      if (customer) {
        this.interactWithCustomer(customer);
        return;
      }
    }

    // Check PCs
    const pcGroups = GameState.pcs.map(p => p.group);
    const hits = this.raycaster.intersectObjects(pcGroups, true);
    if (hits.length > 0 && hits[0].distance <= interactRange) {
      let obj = hits[0].object;
      let pc = null;
      while (obj && !pc) {
        pc = GameState.pcs.find(p => p.group === obj);
        obj = obj.parent;
      }
      if (pc) {
        if (pc.broken) VirusGame.trigger(pc);
        else showToast('🖥️ PC is running smoothly.', 'info');
      }
    }
  },

  interactWithCustomerByIndex(idx) {
    const customer = GameState.customers[idx];
    if (customer) this.interactWithCustomer(customer);
  },

  interactWithCustomer(c) {
    if (c.state === 'queued') {
      // Assign customer to a PC via Reception modal
      openModal('reception', c);
    } else if (c.state === 'active') {
      if (c.requests.includes('snack')) {
        // Fulfill snack request
        CustomerSystem.fulfillSnack(c);
      } else if (c.requests.includes('coffee')) {
        // Fulfill coffee request
        CustomerSystem.fulfillCoffee(c);
      } else if (c.pc.broken) {
        // Handle technical issues
        VirusGame.trigger(c.pc);
      }
    } else if (c.state === 'waiting_to_pay') {
      // Manually close out and collect payment
      CustomerSystem.checkout(c);
    }
  },

  onMouseMove(e) {
    if (!this.activeTool) return;
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, CameraSystem.camera);

    // Detect hover over construction slots
    const slotMeshes = this.constructionSlots.filter(s => !s.occupied).map(s => s.mesh);
    const slotHits = this.raycaster.intersectObjects(slotMeshes);
    this.hoveredSlot = slotHits.length > 0 ? slotHits[0].object : null;

    if (!this.activeTool) return;
    const hits = this.raycaster.intersectObject(this.floorMesh);
    if (hits.length) {
      const p = hits[0].point;
      const sx = Math.round(p.x), sz = Math.round(p.z);
      this.showGhost(sx, sz);
    } else {
      this.hideGhost();
    }
  },

  onCanvasClick(e) {
    if (e.target.id !== 'game-canvas') return;
    
    console.log('onCanvasClick: activeTool =', this.activeTool, 'Tutorial.active =', Tutorial.active, 'Tutorial.stepIdx =', Tutorial.stepIdx, 'waitFlag =', Tutorial.STEPS[Tutorial.stepIdx]?.waitFlag);
    if (CameraSystem.mode !== 'tycoon' && !this.activeTool) {
      this.interactInPerson();
    }

    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, CameraSystem.camera);

    // Priority 1: Handle non-placement interactions (Trash, Customers, Existing PCs)
    if (!this.activeTool) {
      const trashHits = this.raycaster.intersectObjects(this.trashMeshes);
      if (trashHits.length > 0) {
        const id = trashHits[0].object.userData.trashId;
        this.cleanTrash(id);
        return;
      }

      // Check for clicking Achievement Posters
      const posterHits = this.raycaster.intersectObjects(this.achievementPosters);
      if (posterHits.length > 0) {
        const achId = posterHits[0].object.userData.achId;
        if (achId) openModal('certificate', achId);
        return;
      }

      // Check for Laptop
      const office = this.scene.getObjectByName('manager_office');
      if (office) {
        const laptopHits = this.raycaster.intersectObject(office, true);
        if (laptopHits.length > 0 && laptopHits[0].object.userData.isLaptop) {
          openModal('managerStats');
          return;
        }
      }

      // Check for Security Cameras
      if (GameState.upgrades.securityCameras) {
        const camHits = this.raycaster.intersectObjects(this.securityCameraMeshes);
        if (camHits.length > 0) {
          CameraSystem.setFixedCamera(camHits[0].object.userData.camId);
          return;
        }
      }

      // Check for clicking customers to perform station tasks
      const custMeshes = GameState.customers.map(c => c.mesh);
      const custHits = this.raycaster.intersectObjects(custMeshes, true);
      if (custHits.length > 0) {
        let obj = custHits[0].object;
        let customer = null;
        while (obj && !customer) {
          customer = GameState.customers.find(c => c.mesh === obj);
          obj = obj.parent;
        }
        if (customer) {
          this.interactWithCustomer(customer);
          return;
        }
      }

      // Check for clicking PCs
      const pcMeshes = GameState.pcs.map(p => p.mesh);
      const hits = this.raycaster.intersectObjects(pcMeshes);
      
      if (hits.length > 0) {
        const pc = GameState.pcs.find(p => p.mesh === hits[0].object);
        if (pc && pc.broken) VirusGame.trigger(pc);
      }
      return;
    }

    // Priority 2: Handle Placement (Tutorial or Manual)
    const isPlacementTool = ['pc', 'pisonet', 'ps', 'vr', 'desk'].includes(this.activeTool);
    const isTutorialPlacement = Tutorial.active && Tutorial.STEPS[Tutorial.stepIdx]?.waitFlag === 'pc_placed';

    if (isPlacementTool || isTutorialPlacement) {
      const slotMeshes = this.constructionSlots.filter(s => !s.occupied).map(s => s.mesh);
      const slotHits = this.raycaster.intersectObjects(slotMeshes);
      if (slotHits.length > 0) {
        const slot = this.constructionSlots.find(s => s.mesh === slotHits[0].object);
        this.tryBuyPC(slot);
        this.hideGhost();
        setTool(null);
        checkAchievements();
        return;
      }
      // If in tutorial placement mode, don't allow other clicks to fall through
      if (isTutorialPlacement) return;
    }

    if (this.activeTool === 'repair') {
      const pcGroups = GameState.pcs.map(p => p.group);
      const pcHits = this.raycaster.intersectObjects(pcGroups, true);
      if (pcHits.length > 0) {
        let obj = pcHits[0].object;
        let pc = null;
        while (obj && !pc) {
          pc = GameState.pcs.find(p => p.group === obj);
          obj = obj.parent;
        }
        if (pc && pc.broken) VirusGame.trigger(pc);
        this.hideGhost();
        setTool(null);
        return; // Return after repair interaction
      }
    }
  },

  animate() {
    this.frameId = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    // Animate particles
    const particles = this.scene.getObjectByName('particles');
    if (particles) {
      const pos = particles.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += delta * 0.05;
        if (pos[i] > 4.5) pos[i] = 0;
      }
      particles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate rain
    if (this.rainParticles && this.rainParticles.visible) {
      const pos = this.rainParticles.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] -= delta * 18;
        if (pos[i] < 0) pos[i] = 20;
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate ghost mesh rotation
    if (this.ghostMesh && this.ghostMesh.visible) {
      this.ghostMesh.rotation.y += delta * 2; // Rotate at 2 radians per second
    }

    // Animate Staff Door
    if (this.staffDoorHinge) {
      if (this.staffDoorOpen !== this._prevStaffDoorOpen) {
        const soundUrl = this.staffDoorOpen 
          ? "https://assets.mixkit.co/active_storage/sfx/2042/2042-preview.mp3" // Creak open
          : "https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3"; // Slam shut
        const audio = new Audio(soundUrl);
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Catch browser autoplay blocks
        this._prevStaffDoorOpen = this.staffDoorOpen;
      }

      const targetRot = this.staffDoorOpen ? Math.PI / 2 + 1.4 : Math.PI / 2;
      this.staffDoorHinge.rotation.y = THREE.MathUtils.lerp(this.staffDoorHinge.rotation.y, targetRot, 0.1);
    }

    // Update construction slot visuals and zone highlighting
    this.constructionSlots.forEach(slot => {
      if (slot.occupied) {
        slot.mesh.visible = false;
        return;
      }
      
      let opacity = 0.02;
      const tool = this.activeTool;
      const isAllowed = tool && slot.mesh.userData.allowedTools.includes(tool);

      if (isAllowed) {
        // Make VR and PS zones more distinct with specialized pulse patterns
        const isSpecialZone = slot.mesh.userData.allowedTools.includes('vr') || slot.mesh.userData.allowedTools.includes('ps');
        const pulseSpeed = isSpecialZone ? 0.008 : 0.005;
        const pulseRange = isSpecialZone ? 0.3 : 0.15;
        const baseOpacity = isSpecialZone ? 0.4 : 0.2;

        if (this.hoveredSlot === slot.mesh) {
          opacity = 0.8; // Hover glow
        } else {
          opacity = baseOpacity + Math.sin(Date.now() * pulseSpeed) * pulseRange;
        }
      }
      
      slot.mesh.material.opacity = opacity;
      slot.mesh.visible = true;
    });

    this.updateDayNightCycle();
    if (CameraSystem.camera) {
      CustomerSystem.update(delta);
      StaffSystem.update(delta);
      CameraSystem.update(delta);
      this.renderer.render(this.scene, CameraSystem.camera);
    }
  },

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (CameraSystem.camera) {
      CameraSystem.camera.aspect = window.innerWidth / window.innerHeight;
      CameraSystem.camera.updateProjectionMatrix();
    }
  }
};

function setTool(tool) {
  SceneManager.activeTool = tool;
  SceneManager.toolRotation = 0;
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  if (tool === 'pc') document.getElementById('btn-add-pc').classList.add('active');
  if (tool === 'desk') document.getElementById('btn-add-desk').classList.add('active');
  if (tool === 'ps') document.getElementById('btn-add-ps').classList.add('active');
  if (tool === 'vr') document.getElementById('btn-add-vr').classList.add('active');
  if (tool === 'repair') document.getElementById('btn-repair').classList.add('active');
  
  const cancelBtn = document.getElementById('btn-cancel-tool');
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !tool);

  if (!tool) SceneManager.hideGhost(); // Hide ghost if tool is null
  if (tool && Tutorial.active) Tutorial.onFlag('tool_' + tool + '_selected'); // Only trigger flag if tutorial is active
}
