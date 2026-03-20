# Testing Guide: A Famosa - Streets of Golden Melaka

## Quick Start Testing

### Run the Development Server
```bash
cd /Users/home/Desktop/AI/Melaka
npm install     # If not done already
npm start       # Opens at http://localhost:8081
```

### Run as Desktop App (Electron)
```bash
npm run build           # Build for production
npm run electron        # Run as desktop app
npm run electron:dev    # Run with dev server (hot reload)
```

### Package for Distribution
```bash
npm run package:mac     # Create macOS .dmg and .zip
npm run package:win     # Create Windows installer
npm run package:linux   # Create Linux AppImage
```

---

## Debug Mode

Press **F3** in-game to toggle debug mode. When enabled:

- Shows debug overlay with game state
- **F4**: Advance active quest to next stage
- **F5**: Add 100 cruzados to inventory

---

## Manual Test Checklist

### 1. Startup & Title Screen
- [ ] Game loads without errors in console
- [ ] Title screen displays with animation
- [ ] Menu items respond to keyboard (up/down arrows)
- [ ] Menu items respond to mouse hover/click
- [ ] "New Game" starts the game correctly
- [ ] Background silhouettes animate

### 2. Player Movement
- [ ] Arrow keys move player in all 4 directions
- [ ] WASD keys also work for movement
- [ ] Diagonal movement works (e.g., up+right)
- [ ] Player animation plays when moving
- [ ] Player stops and shows idle when keys released
- [ ] Player collides with walls/buildings

### 3. NPC Interaction
- [ ] NPCs visible in their locations
- [ ] Interaction indicator appears when near NPC
- [ ] Space bar opens dialogue with nearby NPC
- [ ] Dialogue box displays NPC greeting
- [ ] Topic buttons appear and are clickable
- [ ] Clicking topic shows NPC response
- [ ] Dialogue can be closed with button or key

### 4. Time System
- [ ] Time display shows in upper right
- [ ] T key advances time by 1 hour
- [ ] Y key toggles fast time mode
- [ ] Day/night lighting changes work
- [ ] NPCs become unavailable outside their hours

### 5. Inventory System
- [ ] I key opens inventory
- [ ] Starting items appear (if any)
- [ ] Money amount displays correctly
- [ ] Items can be selected
- [ ] E key examines selected item
- [ ] ESC closes inventory

### 6. Journal System
- [ ] J key opens journal
- [ ] Journal is empty at start
- [ ] Quest entries appear after starting quest
- [ ] Entries have timestamps
- [ ] ESC closes journal

### 7. Location Switching
Test each location transition:
- [ ] F6 / 1: A Famosa Fortress
- [ ] F7 / 2: Rua Direita (market)
- [ ] F8 / 3: St. Paul's Church
- [ ] F9 / 4: The Waterfront
- [ ] F10 / 5: Kampung Quarter
- [ ] Fade transition works smoothly
- [ ] Loading screen shows location image
- [ ] Location name displays on entry

### 8. Quest: "The Merchant's Seal"

**Stage 1: Start**
- [ ] Go to Rua Direita (F7/2)
- [ ] Find Fernão Gomes
- [ ] Talk to him and select "seal" topic
- [ ] Quest starts notification appears
- [ ] Journal updates with quest info

**Stage 2: Investigate**
- [ ] Talk to Aminah about "seal"
- [ ] (Optional) Talk to Capitão Rodrigues about "seal"
- [ ] (Optional) Talk to Rashid about "seal"
- [ ] Quest advances after required NPCs questioned

**Stage 3: Confront**
- [ ] Go to Waterfront (F9/4)
- [ ] Find Chen Wei
- [ ] Talk to him about "seal"
- [ ] Learn about the 50 cruzado payment

**Stage 4: Payment**
- [ ] Use F5 in debug mode to get money
- [ ] Pay Chen Wei (if payment mechanic works)
- [ ] Or use F4 to advance quest for testing

**Stage 5: Return**
- [ ] Return to Rua Direita
- [ ] Give seal to Fernão Gomes
- [ ] Quest completes
- [ ] Reward received

### 9. Quest: "Pirates on the Horizon" (New)
- [ ] Go to Waterfront
- [ ] Talk to Rashid about "pirates" topic
- [ ] Quest starts
- [ ] Follow quest stages (or use F4 to advance)

### 10. Audio (If Enabled)
- [ ] Background music plays
- [ ] Music changes per location
- [ ] Ambient sounds play
- [ ] Day/night affects ambient audio
- [ ] No audio errors in console

---

## Known Issues

### Audio
- Placeholder audio files may not decode properly
- Game continues without audio if files fail to load

### Content
- Some quest interactions may not trigger properly
- Payment system may need manual testing with debug mode

---

## Unit Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode for development
```

Test files are in `/tests/` directory.

---

## Debug Console Commands

Open browser console (F12) and use:

```javascript
// Access game instance
game

// Access current scene
game.scene.scenes[3]  // GameScene is usually index 3

// Quick game state
game.scene.scenes[3].contentManager.getSummary()

// Force quest advance
game.scene.scenes[3].questSystem.advanceQuest('merchants-seal')

// Add item
game.scene.scenes[3].inventory.addItem('coin-pouch')

// Teleport player
game.scene.scenes[3].player.setPosition(200, 200)
```

---

## Performance Testing

- [ ] Smooth 60 FPS in all locations
- [ ] No memory leaks after location switches
- [ ] Particles don't cause slowdown
- [ ] UI overlays don't impact performance

---

## Cross-Platform Testing

### Browser
- [ ] Chrome (recommended)
- [ ] Firefox
- [ ] Safari (macOS)
- [ ] Edge

### Electron Desktop
- [ ] macOS (native)
- [ ] Windows (if building)
- [ ] Linux (if building)

---

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/platform
5. Console errors (F12 → Console)
6. Screenshot if visual issue

---

*Last Updated: December 3, 2025*


