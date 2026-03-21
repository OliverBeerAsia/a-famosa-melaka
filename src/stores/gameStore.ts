/**
 * Game Store - Core Game State
 *
 * Centralized state management using Zustand.
 * Bridges Phaser game events with React UI state.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { VisualQualityMode, ResolvedVisualQuality } from '../phaser/visualProfile';
import { getLocationName } from '../data/locationNames';

// Types
export interface TimeState {
  hour: number;
  minute: number;
  day: number;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
}

export interface PlayerState {
  x: number;
  y: number;
  location: string;
  facing: 'up' | 'down' | 'left' | 'right';
}

export interface PendingSpawnPoint {
  mapKey: string;
  x: number;
  y: number;
}

export interface OnboardingState {
  hasStartedDialogue: boolean;
  hasOpenedInventory: boolean;
  hasOpenedJournal: boolean;
}

export const DEFAULT_TIME_STATE: TimeState = {
  hour: 10,
  minute: 0,
  day: 1,
  timeOfDay: 'day',
};

export const DEFAULT_PLAYER_STATE: PlayerState = {
  x: 480,
  y: 270,
  location: 'a-famosa-gate',
  facing: 'down',
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  hasStartedDialogue: false,
  hasOpenedInventory: false,
  hasOpenedJournal: false,
};

export interface GameState {
  // UI visibility
  isDialogueOpen: boolean;
  isInventoryOpen: boolean;
  isJournalOpen: boolean;
  isMessageOpen: boolean;
  isPaused: boolean;

  // Game time
  time: TimeState;

  // Player state
  player: PlayerState;

  // Current location
  currentLocation: string;
  locationName: string;
  pendingSpawnPoint: PendingSpawnPoint | null;
  onboarding: OnboardingState;

  // Audio volumes
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  visualQualityMode: VisualQualityMode;
  resolvedVisualQuality: ResolvedVisualQuality;
  dynamicVisualQuality: boolean;

  // Game loaded state
  isGameReady: boolean;

  // Actions
  setDialogueOpen: (open: boolean) => void;
  setInventoryOpen: (open: boolean) => void;
  setJournalOpen: (open: boolean) => void;
  setMessageOpen: (open: boolean) => void;
  setPaused: (paused: boolean) => void;
  toggleInventory: () => void;
  toggleJournal: () => void;
  togglePause: () => void;
  closeAllPanels: () => void;

  updateTime: (time: Partial<TimeState>) => void;
  updatePlayer: (player: Partial<PlayerState>) => void;
  setLocation: (locationId: string, locationName: string) => void;
  queuePendingSpawnPoint: (spawnPoint: PendingSpawnPoint) => void;
  clearPendingSpawnPoint: () => void;
  resetWorldState: (locationId?: string) => void;

  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  setVisualQualityMode: (mode: VisualQualityMode) => void;
  setResolvedVisualQuality: (mode: ResolvedVisualQuality) => void;
  setDynamicVisualQuality: (enabled: boolean) => void;

  setGameReady: (ready: boolean) => void;
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    // Initial UI state
    isDialogueOpen: false,
    isInventoryOpen: false,
    isJournalOpen: false,
    isMessageOpen: false,
    isPaused: false,

    // Initial time state
    time: { ...DEFAULT_TIME_STATE },

    // Initial player state
    player: { ...DEFAULT_PLAYER_STATE },

    // Initial location
    currentLocation: 'a-famosa-gate',
    locationName: 'A Famosa Gate',
    pendingSpawnPoint: null,
    onboarding: { ...DEFAULT_ONBOARDING_STATE },

    // Audio volumes (0-1)
    musicVolume: 0.4,
    sfxVolume: 0.7,
    ambientVolume: 0.5,
    visualQualityMode: 'auto',
    resolvedVisualQuality: 'balanced',
    dynamicVisualQuality: true,

    // Game state
    isGameReady: false,

    // UI Actions
    setDialogueOpen: (open) => {
      if (open) {
        // Close other panels when opening dialogue
        set((state) => ({
          isDialogueOpen: true,
          isInventoryOpen: false,
          isJournalOpen: false,
          isMessageOpen: false,
          onboarding: {
            ...state.onboarding,
            hasStartedDialogue: true,
          },
        }));
      } else {
        set({ isDialogueOpen: false });
      }
    },

    setInventoryOpen: (open) => {
      if (open) {
        set((state) => ({
          isInventoryOpen: true,
          isDialogueOpen: false,
          isJournalOpen: false,
          isMessageOpen: false,
          onboarding: {
            ...state.onboarding,
            hasOpenedInventory: true,
          },
        }));
      } else {
        set({ isInventoryOpen: false });
      }
    },

    setJournalOpen: (open) => {
      if (open) {
        set((state) => ({
          isJournalOpen: true,
          isDialogueOpen: false,
          isInventoryOpen: false,
          isMessageOpen: false,
          onboarding: {
            ...state.onboarding,
            hasOpenedJournal: true,
          },
        }));
      } else {
        set({ isJournalOpen: false });
      }
    },

    setMessageOpen: (open) => {
      if (open) {
        set({ isMessageOpen: true, isDialogueOpen: false, isInventoryOpen: false, isJournalOpen: false });
      } else {
        set({ isMessageOpen: false });
      }
    },

    setPaused: (paused) => set({ isPaused: paused }),

    toggleInventory: () => {
      const { isInventoryOpen, isDialogueOpen, isMessageOpen } = get();
      if (!isDialogueOpen && !isMessageOpen) {
        set({ isInventoryOpen: !isInventoryOpen, isJournalOpen: false });
      }
    },

    toggleJournal: () => {
      const { isJournalOpen, isDialogueOpen, isMessageOpen } = get();
      if (!isDialogueOpen && !isMessageOpen) {
        set({ isJournalOpen: !isJournalOpen, isInventoryOpen: false });
      }
    },

    togglePause: () => {
      const { isPaused, isDialogueOpen, isMessageOpen } = get();
      if (!isDialogueOpen && !isMessageOpen) {
        set({ isPaused: !isPaused, isInventoryOpen: false, isJournalOpen: false });
      }
    },

    closeAllPanels: () => set({
      isDialogueOpen: false,
      isInventoryOpen: false,
      isJournalOpen: false,
      isMessageOpen: false,
      isPaused: false,
    }),

    // Game state updates (called from Phaser)
    updateTime: (time) => set((state) => ({
      time: { ...state.time, ...time },
    })),

    updatePlayer: (player) => set((state) => ({
      player: { ...state.player, ...player },
    })),

    setLocation: (locationId, locationName) => set((state) => ({
      currentLocation: locationId,
      locationName,
      player: {
        ...state.player,
        location: locationId,
      },
    })),

    queuePendingSpawnPoint: (spawnPoint) => set({ pendingSpawnPoint: spawnPoint }),
    clearPendingSpawnPoint: () => set({ pendingSpawnPoint: null }),
    resetWorldState: (locationId = 'rua-direita') => set({
      isDialogueOpen: false,
      isInventoryOpen: false,
      isJournalOpen: false,
      isMessageOpen: false,
      isPaused: false,
      isGameReady: false,
      time: { ...DEFAULT_TIME_STATE },
      currentLocation: locationId,
      locationName: getLocationName(locationId),
      player: {
        ...DEFAULT_PLAYER_STATE,
        location: locationId,
      },
      pendingSpawnPoint: null,
      onboarding: { ...DEFAULT_ONBOARDING_STATE },
    }),

    // Audio controls
    setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
    setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(1, volume)) }),
    setAmbientVolume: (volume) => set({ ambientVolume: Math.max(0, Math.min(1, volume)) }),
    setVisualQualityMode: (mode) => set({ visualQualityMode: mode }),
    setResolvedVisualQuality: (mode) => set({ resolvedVisualQuality: mode }),
    setDynamicVisualQuality: (enabled) => set({ dynamicVisualQuality: enabled }),

    // Game ready state
    setGameReady: (ready) => set({ isGameReady: ready }),
  }))
);

// Selector hooks for common patterns
export const useTime = () => useGameStore((state) => state.time);
export const usePlayer = () => useGameStore((state) => state.player);
export const useLocation = () => useGameStore((state) => ({
  id: state.currentLocation,
  name: state.locationName,
}));
export const useVolumes = () => useGameStore((state) => ({
  music: state.musicVolume,
  sfx: state.sfxVolume,
  ambient: state.ambientVolume,
}));
