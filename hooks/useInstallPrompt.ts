import { useState, useEffect } from 'react';

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

function canShowManualBanner(platform: Platform): boolean {
  // iOS e Android sempre mostram banner manual (iOS não suporta beforeinstallprompt)
  if (platform === 'ios' || platform === 'android') return true;
  return false;
}

// Captura evento antes do hook montar
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
    if (isStandalone()) return false;
    const plat = capturedPlatform || getPlatform();
    if (capturedPrompt) return true;
    if (canShowManualBanner(plat)) return true;
    return false;
  });
  const [platform, setPlatform] = useState<Platform>(capturedPlatform || getPlatform());
  const [canNativeInstall, setCanNativeInstall] = useState(() => !!capturedPrompt);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(capturedPrompt);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    const plat = getPlatform();
    setPlatform(plat);

    if (isStandalone()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      capturedPrompt = e;
      setDeferredPrompt(e);
      setCanNativeInstall(true);
      setShouldShow(true);
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
      setShouldShow(true);
    }

    // iOS/Android sem native install → banner manual
    if (!capturedPrompt && canShowManualBanner(plat)) {
      setShouldShow(true);
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
