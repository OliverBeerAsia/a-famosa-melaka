import React, { useEffect } from 'react';

interface MessageOverlayProps {
  title: string;
  text: string;
  onClose: () => void;
}

export function MessageOverlay({ title, text, onClose }: MessageOverlayProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto animate-fade-in z-50">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />

      <div className="relative w-[620px] max-w-[92vw]">
        <div className="absolute inset-0 translate-x-1 translate-y-1 bg-black/50 rounded" />

        <div className="relative bg-leather-200 border-2 border-gold rounded shadow-parchment">
          <div className="bg-parchment-100 m-2 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="font-cinzel text-gold text-xs uppercase tracking-[0.18em]">Discovery</p>
                <h2 className="font-cinzel text-leather-200 text-xl font-bold">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="text-sepia-light hover:text-leather-200 text-sm"
              >
                Close
              </button>
            </div>

            <p className="text-leather-200 font-crimson text-[15px] leading-6 whitespace-pre-line">
              {text}
            </p>

            <div className="mt-4 pt-3 border-t border-sepia-light/20 text-center">
              <span className="text-sepia text-xs font-mono">[Enter] continue • [Esc] close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
