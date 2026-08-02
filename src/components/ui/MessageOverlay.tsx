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
        <div className="ui-panel-shell">
          <div className="ui-parchment-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ui-caption ui-accent">Discovery</p>
                <h2 className="ui-heading">{title}</h2>
              </div>
              <button onClick={onClose} className="ui-body-soft hover:text-[var(--wood)] type-body">
                Close
              </button>
            </div>

            <div className="ui-rule my-3" />

            <p className="ui-body type-body whitespace-pre-line">
              {text}
            </p>

            <div className="ui-rule mt-4" />
            <div className="pt-2 text-center">
              <span className="ui-keys">[Enter] continue • [Esc] close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
