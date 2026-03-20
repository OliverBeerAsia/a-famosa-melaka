/**
 * Electron Main Process
 * 
 * Creates the native window for A Famosa: Streets of Golden Melaka
 * Handles app lifecycle, window management, and native features
 */

const { app, BrowserWindow, Menu, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow = null;

// Check if we're in development mode
const isDev = process.argv.includes('--dev');

function getStoragePath(key) {
  const safeKey = String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseDir = path.join(app.getPath('userData'), 'storage');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `${safeKey}.json`);
}

function registerIPC() {
  ipcMain.handle('storage:save', async (_event, key, data) => {
    fs.writeFileSync(getStoragePath(key), String(data), 'utf8');
    return true;
  });

  ipcMain.handle('storage:load', async (_event, key) => {
    const filePath = getStoragePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf8');
  });

  ipcMain.handle('storage:remove', async (_event, key) => {
    const filePath = getStoragePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  });

  // Backward-compatible IPC channels
  ipcMain.handle('save-game', async (_event, saveData) => {
    fs.writeFileSync(getStoragePath('legacy_save_game'), JSON.stringify(saveData), 'utf8');
    return true;
  });

  ipcMain.handle('load-game', async () => {
    const filePath = getStoragePath('legacy_save_game');
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });

  ipcMain.handle('save-settings', async (_event, settings) => {
    fs.writeFileSync(getStoragePath('settings'), JSON.stringify(settings), 'utf8');
    return true;
  });

  ipcMain.handle('load-settings', async () => {
    const filePath = getStoragePath('settings');
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });

  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/sprites/ui/icon.png');

  // Create the browser window
  const windowOptions = {
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#0a0806',
    title: 'A Famosa: Streets of Golden Melaka',
    fullscreenable: true,
    resizable: true,
    show: false, // Don't show until ready
  };
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }
  mainWindow = new BrowserWindow(windowOptions);

  // Load the game
  if (isDev) {
    // In dev mode, load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [
        {
          label: 'Fullscreen',
          accelerator: 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow.webContents.setZoomLevel(0);
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Controls',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Game Controls',
              message: 'A Famosa: Streets of Golden Melaka',
              detail: `Movement: Arrow Keys or WASD
Interact: Space
Inventory: I
Journal: J
Close Menus: ESC
Location Switch: 1-5 or F6-F10
Advance Time: T
Fast Time: Y
Fullscreen: F11`
            });
          }
        },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'A Famosa: Streets of Golden Melaka',
              detail: `Version ${app.getVersion()}

A pixel-art adventure RPG set in Portuguese Melaka circa 1580.

Inspired by Ultima VII, featuring exploration, NPC interaction, and story-driven quests in a historically-inspired setting.`
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle events
app.whenReady().then(() => {
  registerIPC();
  createWindow();

  // Register global shortcuts
  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

