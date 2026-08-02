/**
 * Loading Screen Component
 *
 * Ultima VIII style location interstitial with historical atmosphere.
 */

import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  locationId: string;
  mode?: 'arrival' | 'transition';
  onComplete: () => void;
}

const LOADING_BACKGROUND = 'scenes/scene-loading-ribeira.png';

// Location metadata
// NOTE: these deliberately carry no per-location tint any more. The old
// `color` field pushed cyan-900 / emerald-900 / slate-700 scrims over the
// backdrop — five different suns on five different loading screens, and none
// of them in the canon. One world, one shadow: every interstitial now sits
// under the same violet shadow-anchor scrim.
const locationData: Record<string, {
  name: string;
  portugueseName: string;
  description: string;
}> = {
  'a-famosa-gate': {
    name: 'A Famosa Fortress',
    portugueseName: 'Fortaleza de A Famosa',
    description: 'The mighty fortress gateway, built by Afonso de Albuquerque in 1511. Its stone walls have witnessed the rise of Portuguese power in the East.',
  },
  'rua-direita': {
    name: 'Rua Direita',
    portugueseName: 'The Main Street',
    description: 'The commercial heart of Portuguese Melaka. Here merchants from three continents haggle over spices, silk, and secrets.',
  },
  // "St. Paul's" is the DUTCH name, given after 1641. In 1580 the Jesuits'
  // church on the hill is the Igreja Madre de Deus, so the subtitle carries the
  // English gloss — the same way Rua Direita does above.
  'st-pauls-church': {
    name: 'Igreja Madre de Deus',
    portugueseName: 'Church of the Mother of God',
    description: 'Atop the hill overlooking the strait, this stone church stands as a beacon of faith in a land far from home.',
  },
  'waterfront': {
    name: 'The Waterfront',
    portugueseName: 'O Cais',
    description: 'Ships from Arabia, India, and China crowd the harbor. The smell of salt, spice, and opportunity fills the air.',
  },
  'kampung': {
    name: 'Kampung Quarter',
    portugueseName: 'Bairro Malaio',
    description: 'The Malay village beyond the fortress walls. Wooden houses on stilts, fishing nets drying in the sun, life continuing as it has for generations.',
  },
};

export function LoadingScreen({ locationId, mode = 'arrival', onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const location = locationData[locationId] || {
    name: locationId,
    portugueseName: '',
    description: 'A place of mystery...',
  };

  // Simulate loading with atmospheric delay
  useEffect(() => {
    const duration = mode === 'transition' ? 1400 : 2600;
    const interval = 50;
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setProgress((step / steps) * 100);

      if (step >= steps) {
        clearInterval(timer);
        setFadeOut(true);
        setTimeout(onComplete, 500);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [mode, onComplete]);

  return (
    <div
      className={`
        w-full h-full flex flex-col items-center justify-center relative overflow-hidden
        transition-opacity duration-500
        ${fadeOut ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${LOADING_BACKGROUND}')`, imageRendering: 'pixelated' }}
        aria-hidden="true"
      />
      <div className="ui-screen-scrim" aria-hidden="true" />

      <div className="ui-screen-corner ui-screen-corner--nw" />
      <div className="ui-screen-corner ui-screen-corner--ne" />
      <div className="ui-screen-corner ui-screen-corner--sw" />
      <div className="ui-screen-corner ui-screen-corner--se" />

      {/* The interstitial is a travel document: a sealed page naming where you
          are about to stand, with the progress gauge as its foot. */}
      <div className="relative z-10 w-[min(720px,90vw)]">
        <div className="ui-panel-shell">
          <div className="ui-parchment-panel text-center">
            <div className="ui-scroll-rod mb-4" />

            <p className="ui-caption ui-accent">
              {mode === 'transition' ? 'Crossing Melaka' : 'Anno Domini 1580'}
            </p>

            <h1 className="ui-heading mt-2">
              {location.name}
            </h1>

            {location.portugueseName && (
              <h2 className="ui-body-soft type-body mt-1">
                {location.portugueseName}
              </h2>
            )}

            {/* Separator: the wax seal replaces the old 1px gold fleuron */}
            <div className="flex items-center justify-center gap-4 my-4">
              <div className="ui-rule flex-1" />
              <div className="wax-seal shrink-0" />
              <div className="ui-rule flex-1" />
            </div>

            <p className="ui-body type-body px-2">
              {mode === 'transition'
                ? `${location.description} Keep your bearings. The next district tells its story before anyone speaks.`
                : location.description}
            </p>

            {/* Progress gauge — recessed hardwood channel, brass bar */}
            <div className="mt-6 mx-auto w-[min(420px,100%)]">
              <div className="ui-gauge">
                <div className="ui-gauge-fill" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <p className="ui-keys mt-2">
                {mode === 'transition'
                  ? `Crossing into ${location.name}...`
                  : `Entering ${location.name}...`}
              </p>
            </div>

            <div className="ui-scroll-rod mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
