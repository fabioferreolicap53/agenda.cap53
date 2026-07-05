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

export function useInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    const plat = getPlatform();
    setPlatform(plat);

    if (!isStandalone()) {
      setShouldShow(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanNativeInstall(true);
    };

    const handleInstalled = () => {
      setShouldShow(false);
      setDeferredPrompt(null);
      setCanNativeInstall(false);
    };

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
    return outcome === 'accepted';
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShouldShow(false);
  };

  return { shouldShow, platform, canNativeInstall, install, dismiss };
}
