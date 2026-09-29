import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  TOAST_TONES,
  type ToastItem,
  type ToastTone,
} from '../lib/toast';

/**
 * Camada visual dos avisos da aplicação.
 *
 * Substitui o diálogo nativo do navegador ("localhost:3000 diz") por cartões
 * elegantes, não bloqueantes e alinhados à identidade institucional.
 */

const TONE_ACCENT: Record<ToastTone, { solid: string; soft: string; ring: string }> = {
  success: { solid: '#2E7D5B', soft: 'rgba(46,125,91,0.10)', ring: 'rgba(46,125,91,0.22)' },
  info: { solid: '#1C2E4A', soft: 'rgba(28,46,74,0.08)', ring: 'rgba(28,46,74,0.20)' },
  warning: { solid: '#B7791F', soft: 'rgba(183,121,31,0.10)', ring: 'rgba(183,121,31,0.24)' },
  error: { solid: '#B23B3B', soft: 'rgba(178,59,59,0.10)', ring: 'rgba(178,59,59,0.24)' },
};

const ToastStyles: React.FC = () => (
  <style>{`
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toast-out {
      to { opacity: 0; transform: translateX(24px) scale(0.97); }
    }
    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }
    @keyframes toast-shine {
      from { transform: translateX(-120%); }
      to { transform: translateX(220%); }
    }
    .toast-card { animation: toast-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .toast-card[data-state='leaving'] { animation: toast-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
    .toast-progress {
      transform-origin: left center;
      animation-name: toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    .toast-card:hover .toast-progress { animation-play-state: paused; }
    .toast-card .toast-shine {
      animation: toast-shine 1400ms ease-out 260ms both;
    }
    @media (prefers-reduced-motion: reduce) {
      .toast-card, .toast-card[data-state='leaving'] { animation-duration: 1ms; }
      .toast-card .toast-shine { display: none; }
    }
  `}</style>
);

const ToastCard: React.FC<{ item: ToastItem }> = ({ item }) => {
  const [leaving, setLeaving] = React.useState(false);
  const tone = TOAST_TONES[item.tone];
  const accent = TONE_ACCENT[item.tone];

  const close = React.useCallback(() => {
    setLeaving((current) => {
      if (current) return current;
      window.setTimeout(() => dismissToast(item.id), 210);
      return true;
    });
  }, [item.id]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={leaving ? 'leaving' : 'entered'}
      className="toast-card pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_20px_45px_-18px_rgba(28,46,74,0.45)] ring-1 backdrop-blur-xl"
      style={{
        ['--tw-ring-color' as string]: accent.ring,
        backgroundImage: `linear-gradient(135deg, ${accent.soft} 0%, rgba(255,255,255,0) 55%)`,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[5px]" style={{ background: accent.solid }} />

      <div className="relative flex items-start gap-3 py-4 pl-5 pr-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: accent.soft, color: accent.solid }}
        >
          <span className="material-symbols-outlined text-[20px]">{tone.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
            style={{ color: accent.solid }}
          >
            {tone.label}
          </p>
          <p className="mt-1 whitespace-pre-line text-[13.5px] font-medium leading-relaxed text-slate-700 break-words">
            {item.message}
          </p>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Fechar aviso"
          className="-mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="relative h-[3px] w-full bg-slate-100/80">
        <div
          className="toast-progress h-full w-full"
          style={{ background: accent.solid, animationDuration: `${item.duration}ms` }}
          onAnimationEnd={close}
        />
      </div>

      <span
        className="toast-shine pointer-events-none absolute inset-y-0 w-1/3 opacity-40"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent.soft}, transparent)`,
        }}
      />
    </div>
  );
};

const ToastHost: React.FC = () => {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);

  if (items.length === 0) return null;

  return (
    <>
      <ToastStyles />
      <div className="pointer-events-none fixed right-3 top-3 z-[2147483602] flex w-[min(92vw,380px)] flex-col gap-3 sm:right-5 sm:top-5">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
};

export default ToastHost;
