import React from 'react';
import { useSyncExternalStore } from 'react';
import { getDialog, resolveDialog, subscribeDialog, type ConfirmTone } from '../lib/dialog';

/**
 * Camada visual do diálogo de confirmação.
 *
 * Substitui o `confirm()` nativo do navegador por um modal institucional,
 * com hierarquia clara, foco no botão principal e leitura por teclado.
 */

const TONE_STYLE: Record<
  ConfirmTone,
  { solid: string; hover: string; soft: string; ring: string; glow: string }
> = {
  primary: {
    solid: '#1C2E4A',
    hover: '#456086',
    soft: 'rgba(28,46,74,0.08)',
    ring: 'rgba(28,46,74,0.18)',
    glow: 'rgba(28,46,74,0.28)',
  },
  danger: {
    solid: '#B23B3B',
    hover: '#96302F',
    soft: 'rgba(178,59,59,0.10)',
    ring: 'rgba(178,59,59,0.22)',
    glow: 'rgba(178,59,59,0.28)',
  },
};

const DialogStyles: React.FC = () => (
  <style>{`
    @keyframes dialog-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-pop {
      from { opacity: 0; transform: translateY(14px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .dialog-backdrop { animation: dialog-fade 200ms ease-out both; }
    .dialog-card { animation: dialog-pop 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .dialog-confirm {
      background: var(--dlg-solid);
      box-shadow: 0 12px 28px -12px var(--dlg-glow);
    }
    .dialog-confirm:hover { background: var(--dlg-hover); }
    @media (prefers-reduced-motion: reduce) {
      .dialog-backdrop, .dialog-card { animation-duration: 1ms; }
    }
  `}</style>
);

const ConfirmHost: React.FC = () => {
  const dialog = useSyncExternalStore(subscribeDialog, getDialog, getDialog);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveDialog(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        resolveDialog(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog]);

  if (!dialog) return null;

  const tone = TONE_STYLE[dialog.tone];

  return (
    <>
      <DialogStyles />
      <div
        className="dialog-backdrop fixed inset-0 z-[2147483601] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) resolveDialog(false);
        }}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-message"
          className="dialog-card relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_35px_80px_-30px_rgba(15,23,42,0.55)]"
          style={{
            ['--dlg-solid' as string]: tone.solid,
            ['--dlg-hover' as string]: tone.hover,
            ['--dlg-glow' as string]: tone.glow,
          }}
        >
          <span className="block h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${tone.solid}, ${tone.hover})` }} />

          <div className="px-6 pb-6 pt-5">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: tone.soft, color: tone.solid, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
              >
                <span className="material-symbols-outlined text-[26px]">{dialog.icon}</span>
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="dialog-title" className="text-lg font-bold tracking-tight text-[#1C2E4A]">
                  {dialog.title}
                </h2>
                <p id="dialog-message" className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {dialog.message}
                </p>
                {dialog.detail && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{dialog.detail}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => resolveDialog(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {dialog.cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => resolveDialog(true)}
                className="dialog-confirm rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C2E4A]/40 focus-visible:ring-offset-2"
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmHost;
