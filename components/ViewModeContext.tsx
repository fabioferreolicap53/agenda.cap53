import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

  // Busca viewMode do servidor — usa refresh do auth para garantir dados atualizados
  const loadFromServer = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) {
        setLoaded(true);
        return;
      }

      // Refresh auth para garantir calendar_filters atualizado no model
      try {
        const authData = await pb.collection('agenda_cap53_usuarios').authRefresh();
        const freshFilters = (authData.record as any).calendar_filters;
        if (freshFilters?.viewMode === 'personal' || freshFilters?.viewMode === 'all') {
          setViewModeState(freshFilters.viewMode);
          localStorage.setItem(LS_KEY, freshFilters.viewMode);
          setLoaded(true);
          return;
        }
      } catch {
        // authRefresh falhou — tenta fetch direto
      }

      // Fallback: fetch direto do registro
      try {
        const record = await pb.collection('agenda_cap53_usuarios').getOne(userId);
        const filters = (record as any).calendar_filters;
        if (filters?.viewMode === 'personal' || filters?.viewMode === 'all') {
          setViewModeState(filters.viewMode);
          localStorage.setItem(LS_KEY, filters.viewMode);
          // Atualiza o auth store local com os dados frescos
          if (pb.authStore.model) {
            (pb.authStore.model as any).calendar_filters = filters;
          }
        }
      } catch {
        // Ignora erro
      }
    } catch (e) {
      console.warn('Failed to load viewMode from server:', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Sync from PocketBase when user changes
  useEffect(() => {
    loadFromServer();
  }, [pb.authStore.token, loadFromServer]);

  // Aplica tema visual global baseado no viewMode
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (viewMode === 'personal') {
      // Tema pessoal — tons de primary (azul marinho profundo)
      root.style.setProperty('--app-bg', 'rgb(246, 247, 249)');
      root.style.setProperty('--app-bg-surface', 'rgb(255, 255, 255)');
      root.style.setProperty('--app-border', 'rgba(28, 46, 74, 0.08)');
      root.style.setProperty('--app-border-strong', 'rgba(28, 46, 74, 0.15)');
      root.style.setProperty('--app-glow', 'rgba(28, 46, 74, 0.04)');
      root.style.setProperty('--app-text-accent', 'rgb(28, 46, 74)');
      body.classList.add('theme-personal');
      body.classList.remove('theme-all');
    } else {
      // Tema geral — tons neutros slate
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

    // Persist to PocketBase — merge com dados existentes para não sobrescrever filtros do Calendar
    const user = pb.authStore.model;
    if (user?.id) {
      // Busca dados frescos do servidor antes de merge
      pb.collection('agenda_cap53_usuarios').getOne(user.id).then((record) => {
        const currentFilters = (record as any).calendar_filters || {};
        const newFilters = { ...currentFilters, viewMode: mode };

        (user as any).calendar_filters = newFilters;

        return pb.collection('agenda_cap53_usuarios').update(user.id, {
          calendar_filters: newFilters
        });
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
