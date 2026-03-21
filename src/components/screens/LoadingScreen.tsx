/**
 * Loading Screen Component
 *
 * Sierra/LucasArts style location interstitial with historical atmosphere.
 */

import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  locationId: string;
  mode?: 'arrival' | 'transition';
  onComplete: () => void;
}

// Location metadata
const locationData: Record<string, {
  name: string;
  portugueseName: string;
  description: string;
  color: string;
}> = {
  'a-famosa-gate': {
    name: 'A Famosa Fortress',
    portugueseName: 'Fortaleza de A Famosa',
    description: 'The mighty fortress gateway, built by Afonso de Albuquerque in 1511. Its stone walls have witnessed the rise of Portuguese power in the East.',
    color: 'from-stone-800 to-stone-950',
  },
  'rua-direita': {
    name: 'Rua Direita',
    portugueseName: 'The Main Street',
    description: 'The commercial heart of Portuguese Melaka. Here merchants from three continents haggle over spices, silk, and secrets.',
    color: 'from-amber-900 to-amber-950',
  },
  'st-pauls-church': {
    name: "St. Paul's Church",
    portugueseName: 'Igreja de São Paulo',
    description: 'Atop the hill overlooking the strait, this stone church stands as a beacon of faith in a land far from home.',
    color: 'from-slate-700 to-slate-900',
  },
  'waterfront': {
    name: 'The Waterfront',
    portugueseName: 'O Cais',
    description: 'Ships from Arabia, India, and China crowd the harbor. The smell of salt, spice, and opportunity fills the air.',
    color: 'from-cyan-900 to-cyan-950',
  },
  'kampung': {
    name: 'Kampung Quarter',
    portugueseName: 'Bairro Malaio',
    description: 'The Malay village beyond the fortress walls. Wooden houses on stilts, fishing nets drying in the sun, life continuing as it has for generations.',
    color: 'from-emerald-900 to-emerald-950',
  },
};

export function LoadingScreen({ locationId, mode = 'arrival', onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const location = locationData[locationId] || {
    name: locationId,
    portugueseName: '',
    description: 'A place of mystery...',
    color: 'from-slate-800 to-slate-950',
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
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${location.color}`} />

      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/60" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl px-8">
        {/* Year badge */}
        <div className="mb-8">
          <span className="inline-block px-4 py-1 border border-gold/40 text-gold/80 text-sm font-mono">
            {mode === 'transition' ? 'CROSSING MELAKA' : 'ANNO DOMINI 1580'}
          </span>
        </div>

        {/* Location name */}
        <h1 className="font-cinzel text-parchment-200 text-4xl font-bold mb-2">
          {location.name}
        </h1>

        {/* Portuguese name */}
        {location.portugueseName && (
          <h2 className="font-crimson text-parchment-400 text-xl italic mb-8">
            {location.portugueseName}
          </h2>
        )}

        {/* Decorative separator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="w-16 h-px bg-gold/40" />
          <span className="text-gold/60">⚜</span>
          <div className="w-16 h-px bg-gold/40" />
        </div>

        {/* Description */}
        <p className="font-crimson text-parchment-300 text-lg leading-relaxed mb-12">
          {mode === 'transition'
            ? `${location.description} Keep your bearings. The next district tells its story before anyone speaks.`
            : location.description}
        </p>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1 bg-leather-300/30 rounded overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-parchment-500 text-xs mt-2 font-mono">
            {mode === 'transition'
              ? `Crossing into ${location.name}...`
              : `Entering ${location.name}...`}
          </p>
        </div>
      </div>

      {/* Compass rose (decorative) */}
      <div className="absolute bottom-8 right-8 w-16 h-16 opacity-30">
        <div className="w-full h-full border-2 border-gold/40 rounded-full flex items-center justify-center">
          <span className="text-gold text-lg">N</span>
        </div>
      </div>
    </div>
  );
}
