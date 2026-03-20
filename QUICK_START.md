# Quick Start Guide

## Setup

```bash
npm install
npm run dev
```

Your development server will be running at: **http://localhost:3000**

---

## Game Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move player (8-directional) |
| Space | Interact with NPCs/Objects |
| I | Open/Close Inventory |
| J | Open/Close Journal |
| ESC | Pause Menu (settings, save/load) |
| E | Examine item (in inventory) |
| F6-F10 | Quick travel to locations (debug) |
| T | Advance time (debug) |
| Y | Toggle time speed (debug) |

---

## Development Commands

```bash
# Start development server (Vite with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run Electron desktop app
npm run electron

# Package for distribution
npm run package:mac    # macOS DMG
npm run package:win    # Windows installer
npm run package:linux  # Linux AppImage
```

---

## Current Features

- **5 Locations**: A Famosa Gate, Rua Direita, St. Paul's Church, Waterfront, Kampung
- **6 NPCs**: Fernao Gomes, Capitao Rodrigues, Padre Tomas, Aminah, Chen Wei, Rashid
- **3 Quests**: The Merchant's Seal (main), The Padre's Dilemma, Rashid's Cargo
- **Day/Night Cycle**: 4 lighting states with atmospheric particles
- **Full Inventory**: Item pickup, examination, quest items
- **Journal System**: Quest tracking and objectives
- **Save/Load**: 4 slots with autosave
- **Pause Menu**: Volume controls, save/load

---

## Project Structure (React + Phaser Hybrid)

```
src/
├── App.tsx              # Main React app shell
├── main.tsx             # Entry point
├── components/
│   ├── GameCanvas.tsx   # Phaser game embed
│   ├── ui/              # React UI components
│   └── screens/         # Full-screen views
├── stores/              # Zustand state management
├── phaser/
│   ├── game.ts          # Phaser configuration
│   ├── eventBridge.ts   # React-Phaser communication
│   └── scenes/          # Phaser scenes (Boot, Game)
└── data/                # NPCs, Items, Quests (JSON)

assets/
├── sprites/             # Characters, Tiles, Objects, UI
├── audio/               # Music and SFX
├── maps/                # Tiled JSON maps
└── tilesets/            # Master tileset images
```

---

## Technology Stack

- **Game Engine**: Phaser 3
- **UI Framework**: React 18
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Language**: TypeScript
- **Desktop**: Electron

---

## Troubleshooting

**Game not loading?**
- Check browser console (F12) for errors
- Verify server: `curl http://localhost:3000`

**TypeScript errors?**
- Run `npx tsc --noEmit` to check for type errors
- Install types: `npm install --save-dev @types/react`

**Port in use?**
- Vite will auto-select next available port
- Or: `lsof -ti:3000 | xargs kill`

**Electron not starting?**
- Run production build first: `npm run build`
- Then: `npm run electron`

---

## Documentation

- **PROJECT_STATUS.md** - Current status and roadmap
- **CLAUDE.md** - Development guidelines
- **docs/art-bible/ART_BIBLE.md** - Visual specifications
- **docs/AUDIO_DIRECTION.md** - Audio specifications
- **TESTING.md** - Manual test checklist

---

**Happy coding!**
