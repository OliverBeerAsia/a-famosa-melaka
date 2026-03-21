/**
 * Main Application Shell
 *
 * Manages the React UI overlay on top of the Phaser game canvas.
 * Coordinates state between Phaser game world and React UI components.
 */

import React, { useEffect, useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { DialogueBox } from './components/ui/DialogueBox';
import { InventoryPanel } from './components/ui/InventoryPanel';
import { JournalPanel } from './components/ui/JournalPanel';
import { PauseMenu } from './components/ui/PauseMenu';
import { HUD } from './components/ui/HUD';
import { MessageOverlay } from './components/ui/MessageOverlay';
import { TitleScreen } from './components/screens/TitleScreen';
import { LoadingScreen } from './components/screens/LoadingScreen';
import { CreditsScreen } from './components/screens/CreditsScreen';
import { useGameStore } from './stores/gameStore';
import { useInventoryStore } from './stores/inventoryStore';
import { useQuestStore } from './stores/questStore';
import { useDialogueStore } from './stores/dialogueStore';
import { useSaveStore } from './stores/saveStore';
import { loadGameData, startQuest } from './data/loader';
import { onGameEvent } from './phaser/eventBridge';

type GameState = 'title' | 'loading' | 'playing' | 'credits';
type InfoOverlay = { title: string; text: string } | null;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [loadingLocation, setLoadingLocation] = useState<string | null>(null);
  const [transitionLocation, setTransitionLocation] = useState<string | null>(null);
  const [infoOverlay, setInfoOverlay] = useState<InfoOverlay>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // UI visibility states
  const isDialogueOpen = useGameStore((state) => state.isDialogueOpen);
  const isInventoryOpen = useGameStore((state) => state.isInventoryOpen);
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const isMessageOpen = useGameStore((state) => state.isMessageOpen);
  const isPaused = useGameStore((state) => state.isPaused);

  // Load game data on mount
  useEffect(() => {
    const initData = async () => {
      await loadGameData();
      await useSaveStore.getState().initializeSlots();
      setIsDataLoaded(true);
      console.log('[App] Game data initialized');
    };
    initData();
  }, []);

  // Subscribe to game events
  useEffect(() => {
    // Quest start events
    const unsubQuest = onGameEvent('quest:start', (questId) => {
      console.log('[App] Quest started:', questId);
      const activeDialogueNpcId = useDialogueStore.getState().currentNPC?.id;
      startQuest(questId);
      if (activeDialogueNpcId) {
        useDialogueStore.getState().startDialogue(activeDialogueNpcId);
      }
    });

    // Item pickup events
    const unsubItem = onGameEvent('item:pickup', (itemId, itemName) => {
      console.log('[App] Item picked up:', itemId);
      useInventoryStore.getState().addItem(itemId);
      useQuestStore.getState().recordObtain(itemId);
    });

    const unsubTopic = onGameEvent('dialogue:topic:selected', (npcId, topicKey) => {
      useQuestStore.getState().recordTalk(npcId, topicKey);
    });

    const unsubPathRequest = onGameEvent('quest:path:request', (pathId) => {
      useQuestStore.getState().requestPathSelection(pathId);
    });

    const unsubItemGiven = onGameEvent('dialogue:item:given', (npcId, itemId) => {
      useQuestStore.getState().recordGive(npcId, itemId);
    });

    const unsubMoneyPaid = onGameEvent('dialogue:money:paid', (npcId, amount) => {
      useQuestStore.getState().recordPay(npcId, amount);
    });

    // Scene change events (use overlay only during active gameplay)
    const unsubScene = onGameEvent('scene:change', (sceneKey) => {
      console.log('[App] Scene change:', sceneKey);
      if (gameState !== 'playing') return;

      setTransitionLocation(sceneKey);
      window.setTimeout(() => {
        setTransitionLocation((current) => (current === sceneKey ? null : current));
      }, 1200);
    });

    const unsubLocation = onGameEvent('player:location', (locationId) => {
      useQuestStore.getState().recordLocation(locationId);
      if (gameState !== 'playing') return;
      void useSaveStore.getState().autoSave();
    });

    const unsubDayPassed = onGameEvent('time:day-passed', (daysPassed) => {
      if (daysPassed > 0) {
        useQuestStore.getState().recordWait(daysPassed);
      }
    });

    const unsubItemExamine = onGameEvent('item:examine', (itemId, description) => {
      const itemName = useInventoryStore.getState().items.find((item) => item.id === itemId)?.name
        || itemId;
      useQuestStore.getState().addJournalEntry(`${itemName}: ${description}`, 'discovery');
      useGameStore.getState().setMessageOpen(true);
      setInfoOverlay({ title: itemName, text: description });
    });

    const unsubMessage = onGameEvent('message:show', (title, text) => {
      useQuestStore.getState().addJournalEntry(`${title}: ${text}`, 'discovery');
      useGameStore.getState().setMessageOpen(true);
      setInfoOverlay({ title, text });
    });

    return () => {
      unsubQuest();
      unsubItem();
      unsubTopic();
      unsubPathRequest();
      unsubItemGiven();
      unsubMoneyPaid();
      unsubScene();
      unsubLocation();
      unsubDayPassed();
      unsubItemExamine();
      unsubMessage();
    };
  }, [gameState]);

  // Game event handlers
  const handleNewGame = useCallback(() => {
    // Reset game state for new game
    useInventoryStore.getState().clear();
    useQuestStore.getState().hydrateQuests([], [], []);
    useDialogueStore.getState().endDialogue();
    useDialogueStore.getState().loadUnlockedTopics({});
    useGameStore.getState().resetWorldState('rua-direita');
    useSaveStore.getState().startNewSession();
    setInfoOverlay(null);

    setLoadingLocation('rua-direita');
    setGameState('loading');
  }, []);

  const handleContinue = useCallback(async () => {
    useGameStore.getState().setMessageOpen(false);
    setInfoOverlay(null);
    const saveStore = useSaveStore.getState();
    const latestSlot = await saveStore.findMostRecentSlot();
    if (latestSlot === null) {
      useGameStore.getState().resetWorldState('rua-direita');
      saveStore.startNewSession();
      setLoadingLocation('rua-direita');
      setGameState('loading');
      return;
    }

    const loaded = await saveStore.loadGame(latestSlot);
    if (!loaded) {
      setLoadingLocation('rua-direita');
      setGameState('loading');
      return;
    }

    const location = useGameStore.getState().currentLocation || 'rua-direita';
    setLoadingLocation(location);
    setGameState('loading');
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setGameState('playing');
    setLoadingLocation(null);
  }, []);

  const handleReturnToTitle = useCallback(() => {
    useGameStore.getState().setMessageOpen(false);
    setInfoOverlay(null);
    setGameState('title');
  }, []);

  const handleShowCredits = useCallback(() => {
    setGameState('credits');
  }, []);

  const handleCloseCredits = useCallback(() => {
    setGameState('title');
  }, []);

  // Wait for data to load
  if (!isDataLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0806]">
        <div className="text-gold font-cinzel text-xl animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  // Render based on game state
  if (gameState === 'title') {
    return (
      <TitleScreen
        onNewGame={handleNewGame}
        onContinue={handleContinue}
        onCredits={handleShowCredits}
      />
    );
  }

  if (gameState === 'credits') {
    return <CreditsScreen onClose={handleCloseCredits} />;
  }

  if (gameState === 'loading' && loadingLocation) {
    return (
      <LoadingScreen
        locationId={loadingLocation}
        mode="arrival"
        onComplete={handleLoadingComplete}
      />
    );
  }

  // Main gameplay state
  return (
    <div className="game-container relative w-full h-full overflow-hidden">
      {/* Phaser Game Canvas */}
      <GameCanvas />

      {/* HUD Overlay */}
      <HUD />

      {/* UI Panels - rendered on top of game */}
      {isDialogueOpen && <DialogueBox />}
      {isInventoryOpen && <InventoryPanel />}
      {isJournalOpen && <JournalPanel />}
      {isPaused && <PauseMenu onReturnToTitle={handleReturnToTitle} />}
      {infoOverlay && (
        <MessageOverlay
          title={infoOverlay.title}
          text={infoOverlay.text}
          onClose={() => {
            useGameStore.getState().setMessageOpen(false);
            setInfoOverlay(null);
          }}
        />
      )}

      {/* Scene transition overlay */}
      {transitionLocation && (
        <LoadingScreen
          locationId={transitionLocation}
          mode="transition"
          onComplete={() => setTransitionLocation(null)}
        />
      )}
    </div>
  );
}
