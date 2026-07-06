import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'pwa_install_banner_dismissed';

export type Platform = 'android' | 'ios' | 'windows' | 'other';

function getPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  return 'other';
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((window.navigator as any).standalone === true) return true;
  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
  return false;
}

// Captura evento antes do hook montar — previne perda quando dispara durante login/loading
let capturedPrompt: any = null;
let capturedPlatform: Platform = 'other';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e;
    capturedPlatform = getPlatform();
  });
}

export function useInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(() => {
    if (capturedPrompt && !isStandalone()) return true;
    return false;
  });
  const [platform, setPlatform] = useState<Platform>(capturedPlatform);
  const [canNativeInstall, setCanNativeInstall] = useState(() => !!capturedPrompt);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(capturedPrompt);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    setPlatform(getPlatform());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      capturedPrompt = e;
      setDeferredPrompt(e);
      setCanNativeInstall(true);
      if (!isStandalone()) {
        setShouldShow(true);
      }
    };

    const handleInstalled = () => {
      capturedPrompt = null;
      setShouldShow(false);
      setDeferredPrompt(null);
      setCanNativeInstall(false);
    };

    // Se evento já foi capturado globalmente, usar
    if (capturedPrompt && !deferredPrompt) {
      setDeferredPrompt(capturedPrompt);
      setCanNativeInstall(true);
      if (!isStandalone()) {
        setShouldShow(true);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    const mql = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setShouldShow(false);
    };
    mql.addEventListener('change', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      mql.removeEventListener('change', handler);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanNativeInstall(false);
    capturedPrompt = null;
    return outcome === 'accepted';
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShouldShow(false);
  };

  return { shouldShow, platform, canNativeInstall, install, dismiss };
}
