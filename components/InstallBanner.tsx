import React, { useState } from 'react';
import { useInstallPrompt, Platform } from '../hooks/useInstallPrompt';

const PLATFORM_INSTRUCTIONS: Record<Platform, { icon: string; label: string; description: string; steps: string[] }> = {
  android: {
    icon: 'android',
    label: 'Para Android',
    description: 'Instale o agenda para acesso rápido e notificações.',
    steps: [
      'Toque nos três pontinhos (⋮) no canto superior direito do navegador.',
      'Selecione "Adicionar à tela inicial" ou "Instalar aplicativo".',
      'Confirme a instalação no popup.',
    ],
  },
  ios: {
    icon: 'phone_iphone',
    label: 'Para iPhone / iPad',
    description: 'Adicione à sua tela inicial como um aplicativo.',
    steps: [
      'Toque no ícone de compartilhar (📤) na barra inferior.',
      'Role para baixo e toque em "Adicionar à Tela de Início".',
      'Toque em "Adicionar" no canto superior direito.',
    ],
  },
  windows: {
    icon: 'desktop_windows',
    label: 'Para Windows',
    description: 'Transforme em um aplicativo de área de trabalho.',
    steps: [
      'Clique no ícone de instalação na barra de endereços.',
      'Confirme a instalação.',
    ],
  },
  other: {
    icon: 'computer',
    label: 'Para Computador',
    description: 'Instale em qualquer navegador moderno.',
    steps: [
      'Acesse o menu do navegador.',
      'Procure "Instalar aplicativo".',
      'Confirme.',
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
    if (!canNativeInstall) {
      setExpanded(!expanded);
      return;
    }
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
      <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary to-primary-hover/90" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA3KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {/* Banner principal */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleInstall}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstall(); } }}
          className="flex items-center justify-between gap-4 cursor-pointer select-none rounded-2xl -mx-2 px-2 py-2 transition-all duration-300 hover:bg-white/10 hover:shadow-lg hover:shadow-black/5 focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-xl shadow-black/15">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-white drop-shadow-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                {canNativeInstall ? 'download_for_offline' : instructions.icon}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white leading-tight mb-0.5">
                {canNativeInstall ? 'Instale o Agenda' : instructions.label}
              </h3>
              <p className="text-[11px] sm:text-xs text-white/75 leading-relaxed">
                {canNativeInstall
                  ? 'Acesse com um toque direto da sua tela inicial.'
                  : instructions.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canNativeInstall ? (
              installing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-[11px] font-semibold text-white/90">Instalando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/25 text-white text-[11px] font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/25 hover:scale-[1.02] active:scale-95">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>touch_app</span>
                  <span className="hidden sm:inline">Instalar agora</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 text-white/70">
                <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">
                  {expanded ? 'Recolher' : 'Como instalar'}
                </span>
                <span className="material-symbols-outlined text-lg transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
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

        {/* Instruções manuais — iOS/Android */}
        {!canNativeInstall && expanded && (
          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-400">
            <div className="bg-white/[0.07] backdrop-blur-xl rounded-3xl border border-white/[0.12] p-5 sm:p-6 shadow-2xl shadow-black/10">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10">
                  <span className="material-symbols-outlined text-base text-white/80" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {instructions.icon}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{instructions.label}</h4>
                  <p className="text-[10px] text-white/50 mt-0.5">{instructions.description}</p>
                </div>
              </div>

              <ol className="space-y-3">
                {instructions.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 group">
                    <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 border border-white/15 text-[11px] font-bold text-white/80 mt-0.5 group-hover:bg-white/20 group-hover:text-white transition-colors duration-200">
                      {i + 1}
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-white/85 leading-relaxed pt-0.5">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-white/40">info</span>
                <span className="text-[10px] text-white/40 font-medium">
                  Após instalar, acesse o app diretamente pela sua tela inicial.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallBanner;
