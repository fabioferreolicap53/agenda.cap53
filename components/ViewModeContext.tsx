import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  // Sync from PocketBase when user changes
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const user = pb.authStore.model;
        if (user && (user as any).calendar_filters) {
          const filters = (user as any).calendar_filters;
          if (filters.viewMode === 'personal' || filters.viewMode === 'all') {
            setViewModeState(filters.viewMode);
            localStorage.setItem(LS_KEY, filters.viewMode);
          }
        }
      } catch (e) {
        console.warn('Failed to load viewMode from server:', e);
      } finally {
        setLoaded(true);
      }
    };

    loadFromServer();
  }, [pb.authStore.token]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(LS_KEY, mode);

    // Persist to PocketBase
    const user = pb.authStore.model;
    if (user?.id) {
      const currentFilters = (user as any).calendar_filters || {};
      pb.collection('agenda_cap53_usuarios').update(user.id, {
        calendar_filters: { ...currentFilters, viewMode: mode }
      }).catch(() => {});
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
