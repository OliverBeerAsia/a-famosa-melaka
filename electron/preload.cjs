/**
 * Electron Preload Script
 * 
 * Exposes safe APIs to the renderer process
 * This runs in a sandboxed context with access to Node.js
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  
  // App information
  getAppVersion: () => {
    return process.env.npm_package_version || '0.2.0';
  },

  // Generic key/value storage used by save store
  saveData: async (key, data) => {
    return ipcRenderer.invoke('storage:save', key, data);
  },

  loadData: async (key) => {
    return ipcRenderer.invoke('storage:load', key);
  },

  removeData: async (key) => {
    return ipcRenderer.invoke('storage:remove', key);
  },

  // Backward-compatible API
  saveGame: async (saveData) => {
    return ipcRenderer.invoke('save-game', saveData);
  },
  
  loadGame: async (slotId) => {
    return ipcRenderer.invoke('load-game', slotId);
  },
  
  // Future: Settings persistence
  saveSettings: async (settings) => {
    return ipcRenderer.invoke('save-settings', settings);
  },
  
  loadSettings: async () => {
    return ipcRenderer.invoke('load-settings');
  },
  
  // Window controls
  toggleFullscreen: () => {
    ipcRenderer.send('toggle-fullscreen');
  },
  
  // Check if running in Electron
  isElectron: true
});

// Log that preload is running
console.log('Electron preload script loaded');

