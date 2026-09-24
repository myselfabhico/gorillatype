import React from 'react';
import { Cookie } from 'lucide-react';

export const Footer: React.FC<{
  onOpenAuth: () => void;
  onOpenTheme: () => void;
}> = ({ onOpenAuth, onOpenTheme }) => {
  return (
    <footer className="w-full bg-darkcard border-t border-darkborder py-8 px-4 mt-12 text-xs text-mutedtext select-none">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="font-bold text-bodytext tracking-wide">GorillaType</span>
            <span>•</span>
            <span className="text-accent font-medium">10FastFingers Speed Replica</span>
          </div>
          <p className="text-[11px] text-mutedtext/80">
            Engineered with high-precision keystroke analytics, Web Audio synthesizer, and cookie persistence.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 hover:text-accent transition-colors"
          >
            <Cookie className="w-3.5 h-3.5 text-accent" />
            <span>Cookie Settings</span>
          </button>

          <button
            onClick={onOpenTheme}
            className="hover:text-accent transition-colors"
          >
            Themes
          </button>

          <span className="text-mutedtext/40">|</span>

          <span className="text-[11px] text-mutedtext">
            © 2026 GorillaType • FastFingers Engine
          </span>
        </div>
      </div>
    </footer>
  );
};
