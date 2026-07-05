import React, { useState } from 'react';
import { useInstallPrompt, Platform } from '../hooks/useInstallPrompt';

const PLATFORM_INSTRUCTIONS: Record<Platform, { icon: string; label: string; steps: string[] }> = {
  android: {
    icon: 'android',
    label: 'Android',
    steps: [
      'Toque nos três pontinhos (⋮) no canto superior',
      'Toque em "Adicionar à tela inicial"',
      'Confirme "Adicionar"',
    ],
  },
  ios: {
    icon: 'phone_iphone',
    label: 'iPhone / iPad',
    steps: [
      'Toque no ícone de compartilhar (📤)',
      'Toque em "Adicionar à Tela de Início"',
      'Confirme "Adicionar"',
    ],
  },
  windows: {
    icon: 'desktop_windows',
    label: 'Windows',
    steps: [
      'Clique no ícone ⬇️ na barra de endereços',
      'Ou menu ⋯ > "Aplicativos > Instalar"',
      'Confirme a instalação',
    ],
  },
  other: {
    icon: 'computer',
    label: 'Computador',
    steps: [
      'Abra o menu do navegador',
      'Clique em "Instalar aplicativo"',
      'Confirme a instalação',
    ],
  },
};

const InstallBanner: React.FC = () => {
  const { shouldShow, platform, canNativeInstall, install, dismiss } = useInstallPrompt();
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!shouldShow) return null;

  const instructions = PLATFORM_INSTRUCTIONS[platform];

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="w-full relative z-[200] overflow-hidden animate-in slide-in-from-top duration-700">
      {/* Gradient background with pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary-hover to-primary" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-60" />

      <div className="relative max-w-7xl mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + text */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="shrink-0 size-10 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg shadow-black/10">
              <span className="material-symbols-outlined text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                {instructions.icon}
              </span>
            </div>
            <p className="text-[11px] md:text-xs font-bold text-white leading-snug">
              {canNativeInstall ? (
                <>
                  <span className="text-white/70">Acesse rápido como app!</span>{' '}
                  <span className="text-white font-black">Toque para instalar agora</span>
                </>
              ) : (
                <>
                  Adicione à tela inicial e acesse{' '}
                  <span className="text-white font-black">com um toque</span>{' '}
                  — pelo menu do navegador!
                </>
              )}
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {canNativeInstall && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="h-9 px-5 flex items-center justify-center gap-2 rounded-xl bg-white text-primary hover:bg-white/90 transition-all duration-200 text-[11px] font-black uppercase tracking-wider shadow-lg shadow-black/20 active:scale-95 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {installing ? 'hourglass_top' : 'download_for_offline'}
                </span>
                <span>{installing ? 'Instalando...' : 'Instalar'}</span>
              </button>
            )}
            {!canNativeInstall && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="h-9 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-white/15 border border-white/30 hover:bg-white/25 transition-all duration-200 text-[10px] font-bold uppercase tracking-wider text-white"
              >
                <span className="material-symbols-outlined text-[14px]">{expanded ? 'expand_less' : 'expand_more'}</span>
                <span className="hidden sm:inline">Como instalar</span>
                <span className="sm:hidden">Como</span>
              </button>
            )}
            <button
              onClick={dismiss}
              className="size-9 flex items-center justify-center rounded-xl hover:bg-white/15 transition-all duration-200 text-white/70 hover:text-white"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Expanded instructions */}
        {!canNativeInstall && expanded && (
          <div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-300">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[14px] text-white/70" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {instructions.icon}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  {instructions.label}
                </span>
              </div>
              <ol className="space-y-2.5">
                {instructions.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 size-6 flex items-center justify-center rounded-full bg-white/15 border border-white/20 text-[10px] font-black text-white mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[11px] font-medium text-white/90 leading-relaxed pt-0.5">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default InstallBanner;
