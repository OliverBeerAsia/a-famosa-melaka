/// <reference types="vite/client" />

// Electron API types (when running in Electron)
interface ElectronAPI {
  saveData: (key: string, data: string) => Promise<void>;
  loadData: (key: string) => Promise<string | null>;
  removeData: (key: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    game?: Phaser.Game;
  }
}

export {};
