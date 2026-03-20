/**
 * Inventory Panel Component
 *
 * Displays the player's inventory in a merchant's satchel style.
 * Grid-based layout with item examination and money display.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useInventoryStore, InventoryItem } from '../../stores/inventoryStore';
import { useGameStore } from '../../stores/gameStore';

const COLS = 5;
const ROWS = 4;
const TOTAL_SLOTS = COLS * ROWS;

// Item color mapping
const itemColors: Record<string, string> = {
  'trading-seal': 'bg-crimson',
  'coin-pouch': 'bg-gold',
  'spice-sample': 'bg-orange-500',
  'letter': 'bg-amber-100',
  'key-warehouse': 'bg-slate-500',
  'portuguese-wine': 'bg-rose-900',
  'medicinal-herbs': 'bg-green-600',
  'rosary': 'bg-gold-dark',
};

export function InventoryPanel() {
  const { items, money, selectedSlot, setSelectedSlot, examineItem } = useInventoryStore();
  const setInventoryOpen = useGameStore((state) => state.setInventoryOpen);

  const [description, setDescription] = useState('Select an item...');

  // Handle slot selection
  const handleSelectSlot = useCallback((index: number) => {
    setSelectedSlot(index);
    const item = items[index];
    if (item) {
      const desc = examineItem(item.instanceId);
      setDescription(desc || item.description);
    } else {
      setDescription('Empty slot');
    }
  }, [items, setSelectedSlot, examineItem]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
        case 'i':
        case 'I':
          setInventoryOpen(false);
          break;
        case 'ArrowLeft':
          if (selectedSlot % COLS > 0) {
            handleSelectSlot(selectedSlot - 1);
          }
          break;
        case 'ArrowRight':
          if (selectedSlot % COLS < COLS - 1 && selectedSlot < TOTAL_SLOTS - 1) {
            handleSelectSlot(selectedSlot + 1);
          }
          break;
        case 'ArrowUp':
          if (selectedSlot >= COLS) {
            handleSelectSlot(selectedSlot - COLS);
          }
          break;
        case 'ArrowDown':
          if (selectedSlot < TOTAL_SLOTS - COLS) {
            handleSelectSlot(selectedSlot + COLS);
          }
          break;
        case 'e':
        case 'E':
          const item = items[selectedSlot];
          if (item) {
            const desc = examineItem(item.instanceId);
            setDescription(desc || 'Nothing special.');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSlot, items, handleSelectSlot, examineItem, setInventoryOpen]);

  // Update description when selection changes
  useEffect(() => {
    const item = items[selectedSlot];
    if (item) {
      setDescription(`${item.name}: ${item.description}`);
    } else {
      setDescription('Empty slot');
    }
  }, [selectedSlot, items]);

  // Create slot elements
  const slots = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const item = items[i] as InventoryItem | undefined;
    const isSelected = i === selectedSlot;
    const color = item ? itemColors[item.id] || 'bg-sepia' : '';

    slots.push(
      <button
        key={i}
        onClick={() => handleSelectSlot(i)}
        className={`
          inv-slot transition-all
          ${isSelected ? 'inv-slot-selected' : ''}
          ${item ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
        `}
      >
        {item && (
          <div className={`w-9 h-9 rounded ${color}`}>
            {item.quantity && item.quantity > 1 && (
              <span className="absolute bottom-0 right-0 text-xs text-white bg-black/60 px-1 rounded">
                {item.quantity}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setInventoryOpen(false)}
      />

      {/* Panel */}
      <div className="relative">
        {/* Shadow */}
        <div className="absolute inset-0 translate-x-1 translate-y-1 bg-black/50 rounded" />

        {/* Main container */}
        <div className="relative bg-leather-200 border-2 border-gold rounded shadow-parchment p-3">
          <div className="bg-parchment-200 p-4">
            {/* Title */}
            <h2 className="font-cinzel text-crimson text-lg font-bold text-center mb-4">
              MERCHANT'S SATCHEL
            </h2>

            <div className="flex gap-4">
              {/* Item grid */}
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                }}
              >
                {slots}
              </div>

              {/* Money pouch */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-12 bg-leather-50 rounded-full flex items-center justify-center border-2 border-leather-200">
                  <span className="font-cinzel text-gold font-bold">
                    {money}
                  </span>
                </div>
                <span className="text-gold-dark text-xs mt-1">cruzados</span>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4 p-2 bg-parchment-400/50 border border-sepia-light/30 rounded">
              <p className="text-leather-200 font-crimson text-sm min-h-[40px]">
                {description}
              </p>
            </div>

            {/* Instructions */}
            <div className="text-center mt-3">
              <span className="text-sepia text-xs font-mono">
                [I] close • [←→↑↓] select • [E] examine
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
