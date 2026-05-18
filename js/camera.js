/* ===== CAMERA SYSTEM ===== */
window.CameraSystem = {
  camera: null,
  mode: 'tycoon',
  // Tycoon/orbit
  orbitTheta: 0.8,
  orbitPhi: 1.0,
  orbitRadius: 18,
  orbitTarget: null,
  isDragging: false,
  lastMouse: { x: 0, y: 0 },
  // First/third person
  fpPos: null,
  fpYaw: 0,
  fpPitch: 0,
  keys: {},
  flashlight: false,
  flashlightMesh: null,
  _tempVec: null, // Reusable vector for performance
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Increased near plane to 0.5 to prevent floor clipping when zoomed in
    // Increased far plane to 1000 to ensure world background never disappears
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 1000);
    this.orbitTarget = new THREE.Vector3(0, 0, 0);
    this.fpPos = new THREE.Vector3(0, 1.7, 10);
    this._tempVec = new THREE.Vector3();

    // Flashlight setup
    this.flashlightMesh = new THREE.SpotLight(0xffffff, 0, 15, Math.PI / 5, 0.3, 1);
    this.flashlightMesh.position.set(0, 0, 0); // Position relative to camera
    const targetNode = new THREE.Object3D(); // Create a target node
    targetNode.position.set(0, 0, -5); // Position it in front of the camera
    this.flashlightMesh.target = targetNode;
    this.camera.add(this.flashlightMesh); // Add flashlight to camera
    this.camera.add(targetNode);
    
    this.applyTycoon();

    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'tycoon' && !SceneManager.activeTool) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.orbitTheta -= dx * 0.005;
      this.orbitPhi = Math.max(0.2, Math.min(1.4, this.orbitPhi + dy * 0.005));
    });
    canvas.addEventListener('wheel', (e) => {
      if (this.mode === 'tycoon') {
        this.orbitRadius = Math.max(4, Math.min(35, this.orbitRadius + e.deltaY * 0.02));
      }
    });

    // WASD for first/third person
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Mouse look for FP/TP
    canvas.addEventListener('click', () => {
      const isInteractionTool = SceneManager.activeTool === 'repair';
      if (this.mode !== 'tycoon' && (!SceneManager.activeTool || isInteractionTool)) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {});
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.fpYaw   -= e.movementX * 0.002;
      this.fpPitch  = Math.max(-1.2, Math.min(1.2, this.fpPitch - e.movementY * 0.002));
    });
  },

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('cam-' + mode)?.classList.add('active');
    if (mode === 'tycoon') this.applyTycoon();

    // Toggle crosshair visibility
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.classList.toggle('hidden', mode === 'tycoon');

    if (mode === 'first')  this.fpPos.set(0, 1.7, 10);
    if (mode === 'third')  this.fpPos.set(0, 1.7, 10); // Reset position for FP/TP
    this.flashlightMesh.intensity = this.flashlight && (mode === 'first' || mode === 'third') ? 1 : 0;
  },

  applyTycoon() {
    this.camera.position.set(0, 12, 16);
    this.camera.lookAt(0, 0, 0);
  },

  setFixedCamera(camId) {
    const camData = SceneManager.securityCameraPositions.find(c => c.id === camId);
    if (!camData) return;

    this.mode = 'fixed'; // New mode for fixed cameras
    this.camera.position.copy(camData.pos);
    this.camera.lookAt(camData.lookAt);
    showToast(`Viewing through Camera ${camId.replace('cam', '')}`, 'info');
    document.getElementById('crosshair')?.classList.add('hidden'); // Hide crosshair for fixed view
  },
  
  toggleFlashlight() {
    this.flashlight = !this.flashlight;
    const canUse = (this.mode === 'first' || this.mode === 'third');
    this.flashlightMesh.intensity = this.flashlight && canUse ? 2.5 : 0;
    showToast(this.flashlight ? '🔦 Flashlight ON' : '🔦 Flashlight OFF', 'info');
  },

  update(delta) {
    if (!this.camera || !this.orbitTarget || !this.fpPos) return;

    if (this.mode === 'tycoon') {
      const x = this.orbitTarget.x + this.orbitRadius * Math.sin(this.orbitTheta) * Math.sin(this.orbitPhi);
      const y = this.orbitRadius * Math.cos(this.orbitPhi);
      const z = this.orbitTarget.z + this.orbitRadius * Math.cos(this.orbitTheta) * Math.sin(this.orbitPhi);
      
      this._tempVec.set(x, y, z);
      this.camera.position.lerp(this._tempVec, 0.1);
      this.camera.lookAt(this.orbitTarget);
    } else {
      // WASD movement
      const speed = 7.5 * delta; // Increased slightly for better feel
      const forward = new THREE.Vector3(-Math.sin(this.fpYaw), 0, -Math.cos(this.fpYaw));
      const right   = new THREE.Vector3(Math.cos(this.fpYaw), 0, -Math.sin(this.fpYaw));

      if (this.keys['KeyW']) this.fpPos.addScaledVector(forward, speed);
      if (this.keys['KeyS']) this.fpPos.addScaledVector(forward, -speed);
      if (this.keys['KeyA']) this.fpPos.addScaledVector(right, -speed);
      if (this.keys['KeyD']) this.fpPos.addScaledVector(right, speed);

      // Clamp to room
      this.fpPos.x = Math.max(-14, Math.min(14, this.fpPos.x));
      this.fpPos.z = Math.max(-14, Math.min(14, this.fpPos.z));

      if (this.mode === 'first') {
        this.camera.position.copy(this.fpPos);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.fpYaw;
        this.camera.rotation.x = this.fpPitch;
      } else if (this.mode === 'third' && this.fpPos) {
        // Third person: camera behind player
        this._tempVec.set(
          this.fpPos.x + Math.sin(this.fpYaw) * 4, 
          this.fpPos.y + 2, 
          this.fpPos.z + Math.cos(this.fpYaw) * 4
        );
        this.camera.position.lerp(this._tempVec, 0.15);
        this.camera.lookAt(this.fpPos);
      }

      // Update flashlight position/direction if active
      if (this.flashlight && (this.mode === 'first' || this.mode === 'third')) {
        this.flashlightMesh.intensity = 2.5; // Ensure intensity is set
      }
    }
  }
};
