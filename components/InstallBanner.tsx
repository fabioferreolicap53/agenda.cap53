import React, { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const InstallBanner: React.FC = () => {
  const { shouldShow, canNativeInstall, install, dismiss } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);

  if (!shouldShow || !canNativeInstall) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await install();
      if (result) dismiss();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="w-full relative z-[200] overflow-hidden animate-in slide-in-from-top duration-700 shadow-2xl shadow-black/10">
      {/* Gradient background with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary to-primary-hover/90" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA3KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {/* Clickable banner */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleInstall}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstall(); } }}
          className="flex items-center justify-between gap-4 cursor-pointer select-none rounded-2xl -mx-2 px-2 py-2 transition-all duration-300 hover:bg-white/10 hover:shadow-lg hover:shadow-black/5 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent"
        >
          {/* Left: Icon + text */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-xl shadow-black/15">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-white drop-shadow-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                download_for_offline
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white leading-tight mb-0.5">
                Instale o Agenda
              </h3>
              <p className="text-[11px] sm:text-xs text-white/75 leading-relaxed">
                Acesse com um toque direto da sua tela inicial.
              </p>
            </div>
          </div>

          {/* Right: Action + dismiss */}
          <div className="flex items-center gap-3 shrink-0">
            {installing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-[11px] font-semibold text-white/90">Instalando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/25 text-white text-[11px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/25 hover:scale-[1.02] active:scale-95">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  touch_app
                </span>
                <span className="hidden sm:inline">Instalar agora</span>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none"
              title="Dispensar permanentemente"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallBanner;
