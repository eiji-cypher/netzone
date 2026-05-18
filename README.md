# 🌐 NetZone - Internet Cafe Tycoon

A high-fidelity 3D Management Simulator built with Three.js. Start your journey in a neighborhood Filipino computer shop and grow it into a global esports empire.

## 🚀 Features
- **3D Environment:** Fully interactive cafe with multiple camera modes (Tycoon, 1st Person, 3rd Person).
- **Management Mechanics:** Deep RPG-like progression with XP, Skill Trees, and Staff hiring.
- **Dynamic Events:** Experience "Brownouts", "ISP Outages", and "Influencer Visits".
- **Filipino Culture:** Localized elements like "PisoNet" stations and "Pancit Canton" minigames.
- **Save System:** Persistent progress using a multi-slot LocalStorage system.

## 🎮 How to Play
1. **Build:** Use your starting capital to place PCs and Desks.
2. **Assign:** Click on customers in the queue to assign them to available stations.
3. **Expand:** Upgrade your internet speed and PC quality to attract higher-paying customers.
4. **Automate:** Hire Cashiers and Technicians to keep the cafe running smoothly.

## 🛠️ Technical Documentation
### Audio Engine
Utilizes the **Web Audio API** for spatial effects. SFX are pre-loaded into `AudioBuffers` for zero-latency feedback. During "Brownout" events, a `ConvolverNode` is activated to simulate shop acoustics via a procedural reverb impulse.

### Gamification
The game utilizes a **Core Loop** of Build -> Serve -> Earn -> Upgrade.
- **Retention:** Daily login rewards and an achievement-based "Hall of Fame".
- **Strategy:** Market trends (e.g., FPS Mania) require players to prioritize specific hardware upgrades.

## ☁️ Deployment
This project is designed for static deployment on **Vercel** or **GitHub Pages**.
1. Ensure your `netzone_audio_pack` folder is in the root.
2. Ensure your `index.html` script tags point to `save.js` (lowercase).

## 📁 Folder Structure
```
netzone/
├── netzone_audio_pack/   # SFX and Music assets
├── js/                   # Core Logic (Three.js, UI, Save, etc.)
├── css/                  # Interface Styling
├── assets/               # 3D Models (.glb)
└── README.md             # Project Documentation
```

---
*Built with Three.js & Passion.*
