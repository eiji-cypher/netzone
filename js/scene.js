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
  composer: null,
  frameId: null,
  loader: null,
  toolRotation: 0,
  constructionSlots: [],
  hoveredSlot: null,
  trashMeshes: [],
  navGrid: [], // 0 = walkable, 1 = blocked
  rainParticles: null,
  staffDoorHinge: null,
  staffDoorOpen: false,
  _prevStaffDoorOpen: false,
  securityCameraMeshes: [],
  fullSign: null,
  achievementPosters: [],
  wallMeshes: [],
  trophyCaseMesh: null,
  zones: [
    { name: 'PC Zone', xMin: -14, xMax: 14, zMin: -12, zMax: 8, allowedTools: ['pc', 'desk'], color: 0x39ff14 }, // Green for PC
    { name: 'VR Zone', xMin: -14, xMax: -7, zMin: -14, zMax: -11, allowedTools: ['vr'], color: 0xaa00ff },
    { name: 'Piso Net Zone', xMin: -14, xMax: 14, zMin: 8, zMax: 12, allowedTools: ['pisonet'], color: 0x00c8ff }, // Blue for PisoNet
    { name: 'PlayStation Zone', xMin: 7, xMax: 14, zMin: -14, zMax: -9, allowedTools: ['ps'], color: 0x0066ff }, 
    { name: 'Lounge Zone', xMin: -14, xMax: 14, zMin: 8, zMax: 14, allowedTools: ['coffeeMachine', 'vending'], color: 0x39ff14 },
    { name: 'Office Zone', xMin: -5, xMax: 5, zMin: -14, zMax: -10, allowedTools: [], color: 0xffd700 },
    { name: 'VIP Zone', xMin: 6, xMax: 14, zMin: -14, zMax: -5, allowedTools: ['pc'], color: 0xffd700 },
  ],
  securityCameraPositions: [
    { id: 'cam1', pos: new THREE.Vector3(-14, 4, 13), lookAt: new THREE.Vector3(0, 1, 0) },
    { id: 'cam2', pos: new THREE.Vector3(14, 4, 13), lookAt: new THREE.Vector3(0, 1, 0) },
    { id: 'cam3', pos: new THREE.Vector3(-14, 4, -13), lookAt: new THREE.Vector3(0, 1, 0) },
    { id: 'cam4', pos: new THREE.Vector3(14, 4, -13), lookAt: new THREE.Vector3(0, 1, 0) },
    { id: 'cam_office', pos: new THREE.Vector3(0, 4, -9), lookAt: new THREE.Vector3(0, 1, -13) },
  ],
  serverRackMesh: null,
  
  // Centralized Asset Cleanup
  disposeObject(obj) {
    if (!obj) return;
    obj.traverse(node => {
      if (node.isMesh) {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(m => this.disposeMaterial(m));
          } else {
            this.disposeMaterial(node.material);
          }
        }
      }
    });
  },
  disposeMaterial(mat) {
    if (mat.map) mat.map.dispose();
    if (mat.lightMap) mat.lightMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.specularMap) mat.specularMap.dispose();
    if (mat.envMap) mat.envMap.dispose();
    mat.dispose();
  },

  init() {
    if (this.renderer) return; // Prevent duplicate initialization

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x080b14, 0.012); // Reduced density for a clearer interior

    // Asset Preloader Setup
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
      const bar = document.getElementById('preload-bar');
      const text = document.getElementById('preload-text');
      if (bar) bar.style.width = progress + '%';
      if (text) text.textContent = `LOADING ASSETS... ${progress}%`;
    };
    this.loadingManager.onLoad = () => { if (document.getElementById('preload-text')) document.getElementById('preload-text').textContent = "SYSTEMS READY"; };

    this.loader = new (THREE.GLTFLoader || window.GLTFLoader)(this.loadingManager);

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Ensure tracking arrays are initialized
    this.resetTrackingArrays();
    this.initNavGrid();
    
    // Optimized Renderer Settings
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x080b14);
    this.renderer.outputEncoding = THREE.sRGBEncoding; // Modern color handling

    // Post-Processing: Bloom/Glow setup
    const Composer = window.EffectComposer || THREE.EffectComposer;
    const RenderPass = window.RenderPass || THREE.RenderPass;
    const UnrealBloomPass = window.UnrealBloomPass || THREE.UnrealBloomPass;

    if (Composer && RenderPass && UnrealBloomPass) {
      this.composer = new Composer(this.renderer);
      const renderPass = new RenderPass(this.scene, CameraSystem.camera);
      this.composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2, 0.4, 0.85 // Strength, Radius, Threshold
      );
      bloomPass.threshold = 0.2;
      this.composer.addPass(bloomPass);
    } else {
      console.warn("NetZone: Post-processing scripts not found. Neon glow disabled but game will continue.");
    }

    // Event Listeners (Centralized)
    window.addEventListener('resize', () => this.onResize());
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.activeTool) {
        this.toolRotation += Math.PI / 4;
        showToast('🔄 Rotated object', 'info');
      }
      // ESC to cancel current tool
      if (e.code === 'Escape') {
        setTool(null);
        showToast('Cancelled', 'info');
      }
      // First-person interaction with 'E'
      if (e.code === 'KeyE' && CameraSystem.mode !== 'tycoon') {
        this.interactInPerson();
      }
    });

    this.animate();
  },

  resetTrackingArrays() {
    this.wallMeshes = [];
    this.achievementPosters = [];
    this.securityCameraMeshes = [];
    this.trashMeshes = [];
    this.constructionSlots = [];
  },

  rebuildFullScene() {
    this.resetScene();
    this.preloadEssentialAssets();
    this.buildRoom();           // Rebuild floor/walls first
    this.buildRoomStaticElements(); // Rebuild ceiling/neon/lighting
    this.addConstructionSlots(); 
    this.addDynamicSceneElements(); // Expansion rooms
    this.rebuildStateObjects();     // Crucial: Places actual PC and Staff models

    // Apply final visual state
    this.updateVisualTheme();       // Apply floor/wall colors
    this.updateWeatherVisuals(GameState.weather);
    if (GameState.upgrades.pancitCooker) document.getElementById('btn-pancit')?.classList.remove('hidden');
    GameState.trash.forEach(t => this.spawnTrashVisual(t));
  },

  preloadEssentialAssets() {
    // Preload common textures/models here to prevent popping
    const texLoader = new THREE.TextureLoader(this.loadingManager);
    // Example: this.assets.noiseTex = texLoader.load('path/to/texture.jpg');
    
    // Add any GLB models here as well:
    // this.loader.load('models/pc_high.glb', (gltf) => { this.assets.pcHigh = gltf.scene; });
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
    const toRemove = this.scene.children.filter(obj => !obj.isLight);
    toRemove.forEach(obj => {
      obj.traverse(node => {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            if (Array.isArray(node.material)) node.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); });
            else { if(node.material.map) node.material.map.dispose(); node.material.dispose(); }
          }
        }
      });
      this.scene.remove(obj);
    });
    this.constructionSlots = [];
    this.trashMeshes = [];
    this.wallMeshes = [];
    this.securityCameraMeshes = [];
    this.trophyCaseMesh = null;
    this.serverRackMesh = null;
    this.fullSign = null;
    this.achievementPosters = [];
    this.initNavGrid();
    // Re-block static table in nav grid as it's not re-added during resetScene
    for(let x = 2; x <= 12; x++) {
      for(let z = 12; z <= 15; z++) this.updateNavGrid(x, z, false);
    }
  },

  buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30, 30, 30);
    // High-quality floor with fallback
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2235, roughness: 0.8, metalness: 0.2 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.floorMesh.name = 'floor';
    this.scene.add(this.floorMesh); // Floor added first to depth buffer

    // Grid
    this.gridHelper = new THREE.GridHelper(30, 30, 0x00c8ff, 0x0a2040);
    this.gridHelper.name = 'gridHelper';
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a1020 });
    const wallGeo = new THREE.BoxGeometry(30, 5, 0.2);
    const wallBack = new THREE.Mesh(wallGeo, wallMat);
    wallBack.position.set(0, 2.5, -15);
    wallBack.receiveShadow = true;
    this.scene.add(wallBack);

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
    door.position.set(0, 1.9, 14.9);
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

    // Mark static table as blocked in nav grid
    for(let x = 2; x <= 12; x++) {
      for(let z = 12; z <= 15; z++) this.updateNavGrid(x, z, false);
    }

    // Dynamic elements based on GameState
    // These will be added during restore or new game setup
  },

  initNavGrid() {
    // 30x30 world mapped to 60x60 grid for high-fidelity collision
    this.navGrid = Array.from({length: 61}, () => new Int8Array(61).fill(0));
  },

  updateNavGrid(worldX, worldZ, walkable, radius = 1) {
    // Convert world (-15 to 15) to grid (0 to 60)
    const gx = Math.round((worldX + 15) * 2);
    const gz = Math.round((worldZ + 15) * 2);
    
    for(let i = -radius; i <= radius; i++) {
      for(let j = -radius; j <= radius; j++) {
        const nx = gx + i, nz = gz + j;
        if (nx >= 0 && nx <= 60 && nz >= 0 && nz <= 60) {
          this.navGrid[nx][nz] = walkable ? 0 : 1;
        }
      }
    }
  },

  getPath(startPos, endPos) {
    const start = { x: Math.round((startPos.x + 15) * 2), z: Math.round((startPos.z + 15) * 2) };
    const end = { x: Math.round((endPos.x + 15) * 2), z: Math.round((endPos.z + 15) * 2) };

    // A* Lite Implementation
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
    if (GameState.level >= 15 && !this.scene.getObjectByName('manager_office')) this.addManagerOffice();
    if (GameState.level >= 25 && !this.scene.getObjectByName('vip_lounge')) this.addVIPLounge();
    if (GameState.level >= 15 && !this.scene.getObjectByName('trophy_case')) this.addTrophyCase();
    this.updateHallOfFame();
  },

  addServerRack() {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    rack.position.set(0, 1.5, -14.2);
    rack.name = 'server_rack';
    this.scene.add(rack);
  },

  addCoffeeStation() {
    const machine = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.8), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    machine.position.set(-10, 0.75, 13.5);
    machine.name = 'coffee_machine';
    this.scene.add(machine);
  },

  addManagerOffice() {
    const group = new THREE.Group();
    group.name = "manager_office";
    const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.2, transmission: 0.5 });
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 0.1), wallMat);
    wallFront.position.set(0, 1.5, -10);
    group.add(wallFront);
    this.scene.add(group);
  },

  addVIPLounge() {
    const group = new THREE.Group();
    group.name = "vip_lounge";
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshLambertMaterial({ color: 0x330044 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(10, 0.02, -10);
    group.add(carpet);
    this.scene.add(group);
  },

  addTrophyCase() {
    const group = new THREE.Group();
    group.name = "trophy_case";
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 0.8), new THREE.MeshLambertMaterial({ color: 0x221100 }));
    base.position.set(-12, 1, -13);
    group.add(base);
    this.scene.add(group);
    this.trophyCaseMesh = group;
  },

  updateVisualTheme() {
    const floorColors = [0x1a2235, 0x111111, 0x251025, 0x102510, 0x2a2005];
    const floorIdx = GameState.upgrades.floorPattern || 0;
    if (this.floorMesh && this.floorMesh.material) {
      this.floorMesh.material.color.setHex(floorColors[floorIdx] || 0x1a2235);
      this.floorMesh.material.needsUpdate = true;
    }
  },

  updateDayNightCycle() {
    if (!this.ambientLight || !this.sunLight) return;
    const hour = GameState.hour + (GameState.minute / 60);
    let skyColor = new THREE.Color(hour >= 6 && hour < 18 ? 0x88ccff : 0x050510);
    this.renderer.setClearColor(skyColor);
    this.scene.fog.color.copy(skyColor);
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
    if (this.rainParticles) this.rainParticles.visible = (weather === 'rain');
  },

  updateHallOfFame() {
    this.achievementPosters.forEach(p => {
      if (p.userData.light) this.scene.remove(p.userData.light);
      this.scene.remove(p);
    });
    this.achievementPosters = [];

    const unlockedIds = Object.keys(GameState.achievements).filter(id => GameState.achievements[id].unlocked);
    unlockedIds.forEach((id, index) => {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (!ach) return;

      // Grid placement on the back wall (z = -14.8)
      const x = -10.5 + (index % 8) * 3;
      const y = 3.5 - Math.floor(index / 8) * 1.5;
      const z = -14.88;

      const poster = this.createPosterMesh(ach);
      poster.position.set(x, y, z);
      poster.userData = { achId: id };
      
      const light = new THREE.PointLight(ach.isGolden ? 0xffd700 : 0x00c8ff, 0.4, 3);
      light.position.set(x, y, z + 0.3);
      this.scene.add(light);
      poster.userData.light = light;

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
    this.scene.children.filter(obj => obj.isLight && !obj.userData.isLaptop).forEach(l => this.scene.remove(l));
    
    // Ambient
    const ambient = new THREE.AmbientLight(0x1a2a45, 1.2);
    this.scene.add(ambient);

    // Main overhead
    const mainLight = new THREE.DirectionalLight(0x4488cc, 0.6);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    this.scene.add(mainLight);

    // Ceiling strip lights
    for (let x = -10; x <= 10; x += 5) {
      const light = new THREE.SpotLight(0x2255aa, 0.5, 15, Math.PI/4);
      light.position.set(x, 4.8, 0);
      light.target.position.set(x, 0, 0);
      light.castShadow = false;
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
      for (let x = zone.xMin; x <= zone.xMax; x += 2) {
        for (let z = zone.zMin; z <= zone.zMax; z += 3) {
          // Skip if it's too close to the entrance or other fixed objects
          if (x > -2 && x < 2 && z > 10) continue; // Entrance area
          if (x > 5 && x < 9 && z > 10) continue; // Queue table area
          if (x > -2 && x < 2 && z < -10) continue; // Snack bar area
          if (x > 3 && x < 7 && z > 10) continue; // Reception desk area
          if (x < -3 && x > -7 && z > 10) continue; // Cashier desk area
          if (x > -6 && x < 6 && z < -9) continue; // Office area
          // Root Cause Fix: Lock by zone name, not coordinates, to avoid blocking PlayStation Zone
          if (GameState.level < 25 && zone.name === 'VIP Zone') continue; 

        const geo = new THREE.BoxGeometry(1, 0.5, 1); // Significantly increased height
        const mat = new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.3, depthWrite: false }); // Prevent z-fighting
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

    const isVIPZone = x >= 6 && x <= 14 && z >= -14 && z <= -5;

    let screenColor = broken ? 0x110000 : (isVIPZone ? 0xffd700 : [0x00c8ff, 0xff2d78, 0x39ff14, 0xffd700, 0xaa00ff][quality % 5]);
    let mainMesh = null;

    if (type === 'vr') {
      // VR Design: Circular platform + Hanger
      screenColor = 0xaa00ff;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16), new THREE.MeshLambertMaterial({ color: 0x1a0a2a }));
      pad.position.y = 0.02;
      group.add(pad);
      
      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 8, 24), new THREE.MeshBasicMaterial({ color: screenColor }));
      glowRing.rotation.x = Math.PI/2;
      glowRing.position.y = 0.03;
      group.add(glowRing);

      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      pillar.position.set(0, 0.6, -0.4);
      group.add(pillar);

      const headset = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      headset.position.set(0, 1.1, -0.2);
      group.add(headset);
      mainMesh = pad;
    } else if (type === 'ps') {
      // Console Design: Low TV Stand + Sofa
      screenColor = 0x0066ff;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0x0a1a2a }));
      stand.position.y = 0.2;
      stand.position.z = -0.3;
      group.add(stand);

      const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x050505 }));
      consoleBox.position.set(0.3, 0.45, -0.3);
      group.add(consoleBox);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: screenColor }));
      screen.position.set(0, 0.9, -0.5);
      group.add(screen);

      const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0x221111 }));
      sofa.position.set(0, 0.2, 0.6);
      group.add(sofa);

      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.15), new THREE.MeshLambertMaterial({ color: 0x221111 }));
      sofaBack.position.set(0, 0.5, 0.85);
      group.add(sofaBack);
      mainMesh = stand;
    } else if (type === 'pisonet') {
      // PisoNet Design: Rugged Wooden Cabinet
      screenColor = 0x888888;
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.8), new THREE.MeshLambertMaterial({ color: 0x4a3222 }));
      cabinet.position.y = 0.9;
      group.add(cabinet);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), new THREE.MeshBasicMaterial({ color: screenColor }));
      screen.position.set(0, 1.3, 0.38);
      group.add(screen);

      const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.05), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
      coinSlot.position.set(0.3, 0.8, 0.4);
      group.add(coinSlot);

      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      stool.position.set(0, 0.2, 0.8);
      group.add(stool);
      mainMesh = cabinet;
    } else {
      // Standard PC design
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      desk.position.y = 0.7;
      group.add(desk);

      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      legs.position.y = 0.35;
      group.add(legs);

      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x050505 }));
      tower.position.set(0.4, 0.95, 0);
      group.add(tower);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: screenColor }));
      screen.position.set(0, 1.2, -0.2);
      group.add(screen);

      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      keyboard.position.set(0, 0.72, 0.15);
      group.add(keyboard);

      const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      mouse.position.set(0.3, 0.72, 0.15);
      group.add(mouse);

      const chairBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      chairBase.position.set(0, 0.35, 0.6);
      group.add(chairBase);

      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      chairBack.position.set(0, 0.6, 0.85);
      group.add(chairBack);
      mainMesh = desk;
    }

    this.scene.add(group);

    // CRITICAL: Block the nav grid and construction slot so devices cannot overlap
    const slot = this.constructionSlots.find(s => 
      Math.abs(s.mesh.position.x - x) < 0.2 && 
      Math.abs(s.mesh.position.z - z) < 0.2
    );
    if (slot) {
      slot.occupied = true;
      slot.mesh.visible = false;
    }

    // Block the nav grid around the PC
    for(let dx = -1; dx <= 1; dx++) {
      for(let dz = -1; dz <= 1; dz++) this.updateNavGrid(x + dx, z + dz, false);
    }

    const pcLight = new THREE.PointLight(screenColor, broken ? 0 : 0.3, 2);
    pcLight.position.set(0, 0.4, -0.1);
    group.add(pcLight);

    const pcObj = { 
      group, 
      mesh: mainMesh, 
      screen: group.children.find(c => c.material && c.material.type === 'MeshBasicMaterial'), 
      light: pcLight, 
      quality, 
      broken, 
      underMaintenance: maintenance,
      occupied: false,
      isVIP: isVIPZone,
      type: type,
      id: GameState.pcs.length 
    };
    
    GameState.pcs.push(pcObj);
    // Only attempt update if components were found
    if (pcObj.screen) this.updatePC(pcObj);
    return pcObj;
  },

  updatePC(pc) {
    let color = pc.broken ? 0x330000 : (pc.isVIP ? 0xffd700 : [0x00c8ff, 0xff2d78, 0x39ff14, 0xffd700, 0xaa00ff][pc.quality % 5]);
    if (pc.underMaintenance) color = 0xffff00;
    pc.screen.material.color.setHex(color);
    pc.light.intensity = (pc.broken || pc.underMaintenance) ? 0.1 : 0.3;
    pc.light.color.setHex(color);
  },

  showGhost(x, z, colorHex = 0x00c8ff) {
    if (!this.ghostMesh) {
      const geo = new THREE.BoxGeometry(0.9, 0.5, 0.6);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.45 });
      this.ghostMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.ghostMesh);
    }
    this.ghostMesh.position.set(x, 0.6, z);
    this.ghostMesh.material.color.setHex(colorHex);
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

    // Strict Overlap Check
    const existing = GameState.pcs.find(p => 
      Math.abs(p.group.position.x - slot.mesh.position.x) < 0.2 && 
      Math.abs(p.group.position.z - slot.mesh.position.z) < 0.2
    );

    if (existing || slot.occupied) {
      showToast('🚫 Spot already occupied!', 'warn');
      return;
    }

    if (slot.occupied) {
      showToast('🚫 Slot occupied! Sell the device first.', 'warn');
      return;
    }

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
    if (window.SoundManager) window.SoundManager.play('purchase');
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
    
    if (this.activeTool === 'sell') {
      const pcGroups = GameState.pcs.map(p => p.group);
      const hits = this.raycaster.intersectObjects(pcGroups, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        let pc = null;
        while (obj && !pc) {
          pc = GameState.pcs.find(p => p.group === obj);
          obj = obj.parent;
        }
        if (pc) {
          this.showGhost(pc.group.position.x, pc.group.position.z, 0xff2d78);
          return;
        }
      }
      this.hideGhost();
      return;
    }

    // Get floor position for snapping
    const hits = this.raycaster.intersectObject(this.floorMesh);
    if (hits.length) {
      const p = hits[0].point;
      const sx = Math.round(p.x), sz = Math.round(p.z);
      
      // Find nearest slot to snapped point
      const slot = this.constructionSlots.find(s => 
        Math.abs(s.mesh.position.x - sx) < 0.5 && 
        Math.abs(s.mesh.position.z - sz) < 0.5
      );

      let isValid = false;
      if (slot) {
        this.hoveredSlot = slot.mesh;
        const toolAllowed = slot.mesh.userData.allowedTools.includes(this.activeTool);
        isValid = !slot.occupied && toolAllowed;
      } else {
        this.hoveredSlot = null;
      }

      this.showGhost(sx, sz, isValid ? 0x00c8ff : 0xff2d78); // Blue if valid, Pink/Red if invalid
    } else {
      this.hideGhost();
    }
  },

  sellDevice(pc) {
    if (pc.occupied) {
      showToast("⚠️ Cannot sell while occupied!", "warn");
      return;
    }

    const costs = { pc: 150, ps: 250, vr: 400, pisonet: 80, desk: 50 };
    const refund = Math.floor((costs[pc.type] || 150) * 0.5);

    // 1. Remove from scene
    this.scene.remove(pc.group);
    this.disposeObject(pc.group);

    // 2. Free construction slot
    const slot = this.constructionSlots.find(s =>
      Math.abs(s.mesh.position.x - pc.group.position.x) < 0.1 && 
      Math.abs(s.mesh.position.z - pc.group.position.z) < 0.1
    );
    if (slot) {
      slot.occupied = false;
      slot.mesh.visible = true; // Construction slot becomes available again
    }

    // 3. Update nav grid and GameState
    this.updateNavGrid(pc.group.position.x, pc.group.position.z, true, (pc.type === 'vr' ? 2 : 1));
    GameState.pcs = GameState.pcs.filter(p => p !== pc);
    GameState.addCash(refund, `+₱${refund} sold`);
    showToast(`💰 Sold ${pc.type.toUpperCase()} for ₱${refund}`, "success");
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
      // Use snapping logic to find the slot even if the user clicks slightly off-center
      const hits = this.raycaster.intersectObject(this.floorMesh);
      if (hits.length) {
        const p = hits[0].point;
        const sx = Math.round(p.x), sz = Math.round(p.z);
        const slot = this.constructionSlots.find(s => 
          Math.abs(s.mesh.position.x - sx) < 0.5 && 
          Math.abs(s.mesh.position.z - sz) < 0.5
        );

        if (!slot) {
          showToast('🚫 Cannot build here!', 'warn');
          return;
        }

        this.tryBuyPC(slot);
        this.hideGhost();
        setTool(null);
        checkAchievements();
        return;
      }
      // If in tutorial placement mode, don't allow other clicks to fall through
      if (isTutorialPlacement) return;
    }

    if (this.activeTool === 'sell') {
      const pcGroups = GameState.pcs.map(p => p.group);
      const pcHits = this.raycaster.intersectObjects(pcGroups, true);
      if (pcHits.length > 0) {
        let obj = pcHits[0].object;
        let pc = null;
        while (obj && !pc) {
          pc = GameState.pcs.find(p => p.group === obj);
          obj = obj.parent;
        }
        if (pc) {
          this.sellDevice(pc);
          this.hideGhost();
          setTool(null);
          return;
        }
      }
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
    const delta = Math.min(this.clock.getDelta(), 0.033);

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

    if (CameraSystem.camera) {
      CustomerSystem.update(delta);
      StaffSystem.update(delta);
      CameraSystem.update(delta);

      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, CameraSystem.camera);
      }
    }
  },

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
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
  if (tool === 'sell') document.getElementById('btn-sell').classList.add('active');
  
  const cancelBtn = document.getElementById('btn-cancel-tool');
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !tool);

  if (!tool) SceneManager.hideGhost(); // Hide ghost if tool is null
  if (tool && Tutorial.active) Tutorial.onFlag('tool_' + tool + '_selected'); // Only trigger flag if tutorial is active
}
