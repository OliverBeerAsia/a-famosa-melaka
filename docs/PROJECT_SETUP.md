# Project Setup Documentation

## Initial Setup Complete

This document records the initial project setup for A Famosa: Streets of Golden Melaka.

### What Has Been Created

#### 1. Project Structure
All directories created as per the design brief:
- `assets/` - Sprite, audio, and map assets
- `src/` - Source code (scenes, entities, systems, ui, data)
- `tools/` - Development utilities
- `docs/` - Documentation

#### 2. Core Files

**Configuration & Build:**
- `package.json` - Node.js dependencies and scripts
- `webpack.config.js` - Webpack bundler configuration
- `.gitignore` - Git ignore rules

**Source Code:**
- `src/main.js` - Application entry point
- `src/config.js` - Phaser game configuration
- `src/index.html` - HTML template

**Scenes:**
- `src/scenes/BootScene.js` - Asset loading scene with progress bar
- `src/scenes/GameScene.js` - Main gameplay scene

**Entities:**
- `src/entities/Player.js` - Player character with 8-directional movement

**Assets:**
- Placeholder sprites (player, NPC, ground, grass, water, stone tiles)
- Sample Tiled map (`assets/maps/melaka-demo.json`)

**Tools:**
- `tools/create-placeholders.js` - Generates placeholder sprites

**Documentation:**
- `CLAUDE.md` - Claude Code development guidance
- `README.md` - Project overview and instructions
- This file

### Technical Implementation

#### Resolution & Scaling
- Base resolution: 320×180
- Integer scaling enabled via Phaser's Scale.FIT mode
- Pixel-perfect rendering (pixelArt: true, roundPixels: true)

#### Movement System
- Full 8-directional movement (N, NE, E, SE, S, SW, W, NW)
- Normalized diagonal movement (prevents faster diagonal speed)
- Supports both Arrow Keys and WASD
- Smooth physics-based movement at 60 pixels/second

#### Tilemap System
- Loads Tiled JSON format
- Supports multiple layers (Ground, Collision)
- Collision detection via tile properties
- Sample map: 20×15 tiles (320×240 pixels)

#### Camera System
- Follows player with smooth interpolation
- Bounded to tilemap dimensions
- Ready for future zoom controls

### How to Use

#### Development
```bash
npm start          # Start dev server (http://localhost:8080)
npm run dev        # Start dev server and open browser
npm run build      # Create production build
```

#### Creating New Maps
1. Open [Tiled Map Editor](https://www.mapeditor.org/)
2. New map: 16×16 tile size, orthogonal
3. Add tilesets from `assets/sprites/tiles/`
4. Create layers: Ground (visual), Collision (physics)
5. For collision: add custom property `collides: true` to tiles
6. Export as JSON to `assets/maps/`
7. Load in `BootScene.js`

#### Adding New Sprites
1. Place PNG in appropriate `assets/sprites/` subdirectory
2. Load in `BootScene.preload()`:
   ```javascript
   this.load.image('sprite-key', 'assets/sprites/path/sprite.png');
   ```
3. Use in scenes:
   ```javascript
   this.add.image(x, y, 'sprite-key');
   ```

### Next Steps

#### Immediate Priorities (Phase 2)
1. Add more map areas (A Famosa Gate, Market, Waterfront, etc.)
2. Implement NPC entities
3. Create basic dialogue system
4. Add animated player sprites (walking in 4 directions)

#### Core Systems to Build
1. **Dialogue System** (`src/systems/DialogueSystem.js`)
   - Keyword-based or branching conversations
   - Text box UI
   - Character portraits

2. **Inventory System** (`src/systems/InventorySystem.js`)
   - Item management
   - Item combination
   - UI overlay

3. **Time System** (`src/systems/TimeSystem.js`)
   - Day/night cycle
   - NPC schedules
   - Visual lighting changes

4. **Journal System** (`src/systems/JournalSystem.js`)
   - Quest tracking
   - Rumor logging
   - UI interface

#### Art Pipeline
1. Design color palette (32-48 colors)
2. Create character sprite templates (16×32)
3. Create tile templates (16×16)
4. Animate player (idle + walk × 4 directions = 8 animations)
5. Create NPC variations
6. Build architecture tilesets (Portuguese colonial style)

#### Audio Pipeline
1. Compose main theme (Renaissance-Gamelan fusion)
2. Create location-specific tracks (Market, Waterfront, Church, etc.)
3. Record/generate sound effects
4. Implement audio manager with crossfading

### Technical Notes

#### Phaser 3 Tips
- Use `this.add.existing()` and `this.physics.add.existing()` for custom entities
- Collision detection: `this.physics.add.collider(sprite, layer)`
- Arcade physics is sufficient for top-down RPG
- For multiple animations, use sprite sheets with `this.load.spritesheet()`

#### Performance Considerations
- Bundle size warning is expected (Phaser is 1.15 MB minified)
- Consider code splitting if adding many scenes
- Optimize sprite sheets (pack multiple sprites in one image)
- Use texture atlases for efficiency

#### Common Issues
- **Black screen**: Check browser console for asset loading errors
- **Sprite not showing**: Verify path in both load and usage
- **Collision not working**: Ensure collision layer has `collides: true` property
- **Movement feels wrong**: Adjust `PLAYER_SPEED` in `config.js`

### Testing Checklist

✅ Project builds without errors
✅ Development server starts
✅ Game renders in browser
✅ Player sprite appears
✅ Arrow keys move player
✅ WASD moves player
✅ Player collides with map boundaries
✅ Player collides with stone border
✅ Camera follows player smoothly
✅ Map renders correctly
✅ No console errors

### Version Information

- **Phaser**: 3.70.0
- **Webpack**: 5.89.0
- **Node**: Requires 16+
- **Initial Setup Date**: 2025-12-03

---

*For development guidelines and architecture patterns, see CLAUDE.md*
*For project overview and quick start, see README.md*
