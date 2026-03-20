/**
 * Credits Screen Component
 *
 * Displays game credits with historical acknowledgments.
 */

import React from 'react';

interface CreditsScreenProps {
  onClose: () => void;
}

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-[#0a0806] relative overflow-hidden"
      onClick={onClose}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f05] via-[#2a1a0a] to-[#0a0806]" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-lg px-8">
        <h1 className="font-cinzel text-gold text-3xl font-bold mb-8">
          A FAMOSA
        </h1>

        <div className="space-y-6 text-parchment-300 font-crimson">
          <section>
            <h2 className="font-cinzel text-gold-dark text-lg mb-2">Design & Development</h2>
            <p>Created with Claude Code</p>
          </section>

          <section>
            <h2 className="font-cinzel text-gold-dark text-lg mb-2">Inspired By</h2>
            <p>Ultima VII: The Black Gate (1992)</p>
            <p>Quest for Glory Series</p>
            <p>Chrono Trigger (1995)</p>
          </section>

          <section>
            <h2 className="font-cinzel text-gold-dark text-lg mb-2">Historical Acknowledgment</h2>
            <p className="text-sm leading-relaxed">
              This game is inspired by the multicultural history of Melaka (Malacca),
              a UNESCO World Heritage Site. We honor the diverse peoples—Malay,
              Chinese, Indian, Arab, and Portuguese—who built this remarkable trading port.
            </p>
          </section>

          <section>
            <h2 className="font-cinzel text-gold-dark text-lg mb-2">Technology</h2>
            <div className="flex justify-center gap-4 text-sm">
              <span>React</span>
              <span className="text-gold/50">•</span>
              <span>Phaser 3</span>
              <span className="text-gold/50">•</span>
              <span>TypeScript</span>
              <span className="text-gold/50">•</span>
              <span>Electron</span>
            </div>
          </section>
        </div>

        <div className="mt-12">
          <p className="text-parchment-500 text-sm font-mono">
            Click anywhere to return
          </p>
        </div>

        {/* Year */}
        <div className="mt-8">
          <span className="inline-block px-4 py-1 border border-gold/40 text-gold/80 text-sm font-mono">
            ANNO DOMINI 2026
          </span>
        </div>
      </div>
    </div>
  );
}
