/* ===== SOUND MANAGER ===== */
window.SoundManager = {
  sounds: {},
  music: null,
  currentMusicTrend: null,
  enabled: true,
  musicVolume: 0.25,

  init() {
    // Preload essential SFX using placeholders (replace URLs with local assets for production)
    this.sounds.purchase = new Audio('https://actions.google.com/sounds/v1/commerce/shop_door_bell.ogg');
    this.sounds.hover = new Audio('https://actions.google.com/sounds/v1/foley/button_click.ogg');
    this.sounds.ui_open = new Audio('https://actions.google.com/sounds/v1/essentials/item_pick_up.ogg');
    this.sounds.ping = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    
    // Optimize hover sound volume
    this.sounds.hover.volume = 0.15;
    this.sounds.purchase.volume = 0.4;
    this.sounds.ping.volume = 0.3;

    // Global Hover Listener (Event Delegation)
    // Automatically attaches hover SFX to any interactive element
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('button, .upgrade-card, .queue-item, .skill-node, .save-slot');
      if (target && this.enabled) {
        this.play('hover');
      }
    });
    
    // Start initial background music
    this.updateMusic();
    
    console.log("🔊 SoundManager Initialized");
  },

  updateMusic() {
    const trend = GameState.currentTrendId || 'stable';
    if (this.currentMusicTrend === trend) return;
    
    const prevMusic = this.music;
    this.currentMusicTrend = trend;

    // Placeholder URLs for trend-specific music
    const musicUrls = {
      stable: 'https://cdn.pixabay.com/audio/2022/03/15/audio_7833327681.mp3', // Chill Lofi
      fps: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',    // Aggressive Phonk
      mmo: 'https://cdn.pixabay.com/audio/2021/11/23/audio_0ed2049e7a.mp3',    // Orchestral
      indie: 'https://cdn.pixabay.com/audio/2022/05/27/audio_18023a381a.mp3',  // Acoustic
      retro: 'https://cdn.pixabay.com/audio/2021/08/04/audio_057610f43a.mp3',  // Chiptune
      br: 'https://cdn.pixabay.com/audio/2022/02/22/audio_87841c6d86.mp3'     // High Tension
    };

    if (prevMusic) {
      // Smooth Fade Out
      let vol = prevMusic.volume;
      const fade = setInterval(() => {
        vol -= 0.02;
        if (vol <= 0) {
          prevMusic.pause();
          clearInterval(fade);
        } else {
          prevMusic.volume = Math.max(0, vol);
        }
      }, 50);
    }

    this.music = new Audio(musicUrls[trend] || musicUrls.stable);
    this.music.loop = true;
    this.music.volume = 0; // Start at 0 for Fade In
    
    if (this.enabled) {
      this.music.play().then(() => {
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol += 0.01;
          if (vol >= this.musicVolume) {
            this.music.volume = this.musicVolume;
            clearInterval(fadeIn);
          } else {
            this.music.volume = vol;
          }
        }, 100);
      }).catch(e => console.warn("Music blocked by browser policy until interaction."));
    }
  },

  play(id) {
    if (!this.enabled || !this.sounds[id]) return;
    
    // Clone or reset to allow rapid overlapping sounds (e.g. fast hovering)
    const sound = this.sounds[id];
    if (sound.paused) {
      sound.play().catch(() => {});
    } else {
      const clone = sound.cloneNode();
      clone.volume = sound.volume;
      clone.play().catch(() => {});
    }
  }
};