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
      className="w-full h-full flex flex-col items-center justify-center bg-[#0C0C18] relative overflow-hidden"
      onClick={onClose}
    >
      {/* Same night as every other screen. */}
      <div className="ui-screen-scrim" aria-hidden="true" />

      <div className="ui-screen-corner ui-screen-corner--nw" />
      <div className="ui-screen-corner ui-screen-corner--ne" />
      <div className="ui-screen-corner ui-screen-corner--sw" />
      <div className="ui-screen-corner ui-screen-corner--se" />

      {/* The credits are a document, so they live on paper. */}
      <div className="relative z-10 w-[min(620px,88vw)] max-h-[88vh] overflow-y-auto">
        <div className="ui-panel-shell">
          <div className="ui-parchment-panel text-center">
            <div className="ui-scroll-rod mb-4" />

            <h1 className="ui-heading mb-1">A FAMOSA</h1>
            <p className="ui-caption">Streets of Golden Melaka</p>

            <div className="flex items-center justify-center gap-4 my-4">
              <div className="ui-rule flex-1" />
              <div className="wax-seal shrink-0" />
              <div className="ui-rule flex-1" />
            </div>

            <div className="space-y-5 ui-body type-body">
              <section>
                <h2 className="ui-caption ui-accent mb-1">Design &amp; Development</h2>
                <p>Created with Claude Code</p>
              </section>

              <section>
                <h2 className="ui-caption ui-accent mb-1">Inspired By</h2>
                <p>Ultima VII: The Black Gate (1992)</p>
                <p>Quest for Glory Series</p>
                <p>Chrono Trigger (1995)</p>
              </section>

              <section>
                <h2 className="ui-caption ui-accent mb-1">Historical Acknowledgment</h2>
                <p className="ui-body type-body">
                  This game is inspired by the multicultural history of Melaka (Malacca),
                  a UNESCO World Heritage Site. We honor the diverse peoples—Malay,
                  Chinese, Indian, Arab, and Portuguese—who built this remarkable trading port.
                </p>
              </section>

              <section>
                <h2 className="ui-caption ui-accent mb-1">Technology</h2>
                <div className="flex justify-center gap-3">
                  <span>React</span>
                  <span className="ui-accent">•</span>
                  <span>Phaser 3</span>
                  <span className="ui-accent">•</span>
                  <span>TypeScript</span>
                  <span className="ui-accent">•</span>
                  <span>Electron</span>
                </div>
              </section>
            </div>

            <div className="ui-rule mt-5" />
            <div className="flex items-center justify-between gap-4 pt-2">
              <span className="ui-keys">Click anywhere to return</span>
              <span className="ui-caption">Anno Domini 2026</span>
            </div>

            <div className="ui-scroll-rod mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
