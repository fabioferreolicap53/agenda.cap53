import React, { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import CustomSelect from './CustomSelect';

export type LocationMode = 'fixed' | 'free';

export interface LocationState {
  mode: LocationMode;
  fixedId: string | null;
  freeText: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  is_available: boolean | string;
  conflict_control: boolean | string;
}

interface LocationFieldProps {
  value: LocationState;
  onChange: (state: LocationState) => void;
  required?: boolean;
}

/**
 * Normalização unificada para garantir que valores do PocketBase sejam booleanos reais.
 */
export const normalizeBoolean = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() !== 'false' && String(val) !== '0' && !!val;
};

const LocationField: React.FC<LocationFieldProps> = ({ value, onChange, required = false }) => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await pb.collection('agenda_cap53_locais').getFullList<LocationRecord>({
        sort: 'name',
      });
      setLocations(res);
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeFunc: (() => void) | null = null;

    fetchData();

    const setupRealtime = async (retries = 3) => {
      if (!pb.authStore.isValid) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      if (!isMounted) return;

      try {
        const unsub = await pb.collection('agenda_cap53_locais').subscribe<LocationRecord>('*', (e) => {
          if (!isMounted) return;
          
          if (e.action === 'create') {
            setLocations(prev => [...prev, e.record]);
          } else if (e.action === 'update') {
            setLocations(prev => prev.map(loc => loc.id === e.record.id ? e.record : loc));
          } else if (e.action === 'delete') {
            setLocations(prev => prev.filter(loc => loc.id !== e.record.id));
          }
        });
        unsubscribeFunc = unsub;
      } catch (err: any) {
        if (isMounted && retries > 0 && err.status === 403) {
          setTimeout(() => setupRealtime(retries - 1), 300);
          return;
        }
        if (isMounted) {
          console.error('Erro na inscrição em tempo real:', err);
        }
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (unsubscribeFunc) {
        try {
          unsubscribeFunc();
        } catch (e) {
          // Ignora erros de unsubscribe (comum em race conditions de auth)
        }
      }
    };
  }, [fetchData]);

  const handleModeSwitch = (mode: LocationMode) => {
    if (mode === 'free') {
      onChange({ mode: 'free', fixedId: 'external', freeText: '' });
    } else {
      onChange({ mode: 'fixed', fixedId: '', freeText: '' });
    }
  };

  if (value.mode === 'free' || value.fixedId === 'external') {
    return (
      <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
        <input
          required={required}
          autoFocus
          value={value.freeText}
          onChange={(e) => onChange({ ...value, mode: 'free', freeText: e.target.value })}
          placeholder="Digite o local ou endereço externo..."
          className="w-full h-14 px-6 rounded-2xl bg-white border-2 border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm transition-all duration-300 pr-28"
        />
        <button
          type="button"
          onClick={() => handleModeSwitch('fixed')}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">undo</span>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <CustomSelect
      value={value.fixedId || ''}
      onChange={(val) => {
        if (val === 'external') {
          handleModeSwitch('free');
        } else {
          onChange({ mode: 'fixed', fixedId: val, freeText: '' });
        }
      }}
      placeholder="Onde ocorrerá?"
      required={required}
      className="h-14"
      disabled={loading}
      options={[
        { value: 'external', label: '📍 LUGAR EXTERNO NÃO FIXO' },
        ...locations
          .filter(loc => normalizeBoolean(loc.is_available) || loc.id === value.fixedId)
          .map(loc => ({
            value: loc.id,
            label: `${loc.name}${normalizeBoolean(loc.conflict_control) ? ' (C/ Conflito)' : ''}`
          }))
      ]}
    />
  );
};

export default LocationField;
