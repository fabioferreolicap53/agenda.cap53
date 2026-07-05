import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { pb } from '../lib/pocketbase';

type ViewMode = 'personal' | 'all';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  loaded: boolean;
}

const LS_KEY = 'agenda_cap53_view_mode';

const ViewModeContext = createContext<ViewModeContextType>({
  viewMode: 'all',
  setViewMode: () => {},
  toggleViewMode: () => {},
  loaded: false,
});

export const useViewMode = () => useContext(ViewModeContext);

export const ViewModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(LS_KEY);
    return (saved === 'personal' || saved === 'all') ? saved : 'all';
  });
  const [loaded, setLoaded] = useState(false);

  // Ref pra saber se auth estava válido antes (detectar transição login/logout)
  const wasValidRef = useRef(pb.authStore.isValid);
  // Ref pra evitar chamadas duplicadas de loadFromServer
  const loadingRef = useRef(false);

  const loadFromServer = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      if (!pb.authStore.isValid || !pb.authStore.model?.id) {
        setLoaded(true);
        return;
      }

      const authData = await pb.collection('agenda_cap53_usuarios').authRefresh();
      const freshFilters = (authData.record as any)?.calendar_filters;

      if (freshFilters?.viewMode === 'personal' || freshFilters?.viewMode === 'all') {
        setViewModeState(freshFilters.viewMode);
        localStorage.setItem(LS_KEY, freshFilters.viewMode);
      }
    } catch (err) {
      console.warn('ViewMode: Failed to load from server, using localStorage', err);
    } finally {
      loadingRef.current = false;
      setLoaded(true);
    }
  }, []);

  // Carrega no mount
  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  // Escuta mudanças de auth — SÓ reage quando auth passa de inválido para válido (login real)
  // NÃO reage quando token é renovado (refresh) ou quando update interno dispara onChange
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((token, model) => {
      const nowValid = !!token;
      const wasValid = wasValidRef.current;

      // Login real: passou de inválido para válido → buscar viewMode do servidor
      if (nowValid && !wasValid) {
        loadFromServer();
      }

      // Reset flag quando deslogar
      if (!nowValid) {
        wasValidRef.current = false;
      } else {
        wasValidRef.current = true;
      }
    });

    return () => unsubscribe?.();
  }, [loadFromServer]);

  // Aplica tema visual global baseado no viewMode
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (viewMode === 'personal') {
      root.style.setProperty('--app-bg', 'rgb(246, 247, 249)');
      root.style.setProperty('--app-bg-surface', 'rgb(255, 255, 255)');
      root.style.setProperty('--app-border', 'rgba(28, 46, 74, 0.08)');
      root.style.setProperty('--app-border-strong', 'rgba(28, 46, 74, 0.15)');
      root.style.setProperty('--app-glow', 'rgba(28, 46, 74, 0.04)');
      root.style.setProperty('--app-text-accent', 'rgb(28, 46, 74)');
      body.classList.add('theme-personal');
      body.classList.remove('theme-all');
    } else {
      root.style.setProperty('--app-bg', 'rgb(249, 250, 251)');
      root.style.setProperty('--app-bg-surface', 'rgb(255, 255, 255)');
      root.style.setProperty('--app-border', 'rgba(226, 232, 240, 0.6)');
      root.style.setProperty('--app-border-strong', 'rgba(203, 213, 225, 0.5)');
      root.style.setProperty('--app-glow', 'rgba(148, 163, 184, 0.04)');
      root.style.setProperty('--app-text-accent', 'rgb(71, 85, 105)');
      body.classList.add('theme-all');
      body.classList.remove('theme-personal');
    }

    return () => {
      body.classList.remove('theme-personal', 'theme-all');
    };
  }, [viewMode]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(LS_KEY, mode);

    const user = pb.authStore.model;
    if (user?.id) {
      const currentFilters = (user as any).calendar_filters || {};
      const newFilters = { ...currentFilters, viewMode: mode };
      (user as any).calendar_filters = newFilters;

      pb.collection('agenda_cap53_usuarios').update(user.id, {
        calendar_filters: newFilters
      }).catch((err) => {
        console.warn('Failed to persist viewMode to server:', err);
      });
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'all' ? 'personal' : 'all');
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode, loaded }}>
      {children}
    </ViewModeContext.Provider>
  );
};
