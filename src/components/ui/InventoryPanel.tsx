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

function ItemIcon({ item }: { item: InventoryItem }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="ui-item-fallback">
        {item.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`/sprites/ui/items/${item.id}.png`}
      alt={item.name}
      className="ui-item-icon"
      onError={() => setHasError(true)}
    />
  );
}

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

    slots.push(
      <button
        key={i}
        onClick={() => handleSelectSlot(i)}
        className={`inv-slot ${isSelected ? 'inv-slot-selected' : ''} ${item ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
      >
        {item && (
          <div className="relative w-9 h-9">
            <ItemIcon item={item} />
            {item.quantity && item.quantity > 1 && (
              <span className="ui-quantity-badge">
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

      <div className="relative w-[min(860px,95vw)]">
        <div className="ui-inventory-shell">
          <div className="ui-parchment-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="ui-caption">Satchel inventory</p>
                <h2 className="ui-heading">
                  Merchant&apos;s Satchel
                </h2>
              </div>

              <div className="ui-money-pill">
                <img src="/sprites/ui/coin-icon.png" alt="" className="ui-money-coin" />
                <div className="text-right">
                  <div className="type-numeral" style={{ color: 'var(--brass)' }}>
                    {money}
                  </div>
                  <div className="type-tag" style={{ color: 'var(--brass-dark)' }}>
                    cruzados
                  </div>
                </div>
              </div>
            </div>

            <div className="ui-rule my-3" />

            <div className="flex flex-col gap-4 lg:flex-row">
              <div
                className="grid gap-2 shrink-0"
                style={{ gridTemplateColumns: `repeat(${COLS}, 48px)` }}
              >
                {slots}
              </div>

              <div className="flex-1 min-w-0 flex flex-col">
                <div className="ui-description-panel flex-1">
                  <p className="ui-body type-body min-h-[84px]">
                    {description}
                  </p>
                </div>

                <div className="mt-3 text-center">
                  <span className="ui-keys">
                    [I] close • [←→↑↓] select • [E] examine
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
