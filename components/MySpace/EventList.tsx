import React from 'react';
import { MySpaceEvent } from '../../hooks/useMySpace';
import { EventItem } from './EventItem';

export type EventScope = 'open' | 'all';
export type EventSortBy = 'start' | 'created';
export type SortDir = 'asc' | 'desc';

interface EventListProps {
  events: MySpaceEvent[];
  loading: boolean;
  scope: EventScope;
  onScopeChange: (scope: EventScope) => void;
  openCount: number;
  allCount: number;
  sortBy: EventSortBy;
  sortDir: SortDir;
  onSortChange: (by: EventSortBy, dir: SortDir) => void;
  onOpenCalendar: (event: MySpaceEvent) => void;
  onCancel: (event: MySpaceEvent) => void;
  onDelete: (event: MySpaceEvent) => void;
  onDuplicate: (event: MySpaceEvent) => void;
  onEdit: (event: MySpaceEvent) => void;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  loading,
  scope,
  onScopeChange,
  openCount,
  allCount,
  sortBy,
  sortDir,
  onSortChange,
  onOpenCalendar,
  onCancel,
  onDelete,
  onDuplicate,
  onEdit
}) => {
  // Chave de escopo × ordenação — sempre visível (inclusive vazio/carregando)
  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-[#1C2E4A] via-[#456086] to-[#7C97BB] text-white shadow-sm shadow-[#1C2E4A]/30">
          <span className="material-symbols-outlined text-[15px]">filter_alt</span>
        </span>
        <div className="leading-none">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1C2E4A]">Escopo da lista</p>
          <p className="text-[9px] text-slate-400 font-medium tracking-wide mt-1">
            Prazo ainda não finalizado × histórico completo
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Ordenação: início × criação (clique repetido inverte) */}
        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-200/80 shadow-[inset_0_1px_2px_rgba(28,46,74,0.08)]">
          <span className="material-symbols-outlined text-[13px] text-slate-400 px-1.5" title="Ordenar por">
            sort
          </span>
          {(
            [
              { id: 'start' as EventSortBy, label: 'Início', icon: 'event' },
              { id: 'created' as EventSortBy, label: 'Criação', icon: 'history' },
            ]
          ).map(opt => {
            const isActive = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSortChange(opt.id, isActive ? (sortDir === 'asc' ? 'desc' : 'asc') : (opt.id === 'start' ? 'asc' : 'desc'))}
                aria-pressed={isActive}
                title={isActive
                  ? `Ordenado por ${opt.label.toLowerCase()} (${sortDir === 'asc' ? 'crescente' : 'decrescente'}) — clique para inverter`
                  : `Ordenar por data e horário de ${opt.label.toLowerCase()}`}
                className={`group flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7DAA]/40 ${
                  isActive
                    ? 'bg-white text-[#1C2E4A] border border-[#1C2E4A]/20 shadow-sm'
                    : 'text-slate-500 hover:text-[#1C2E4A] hover:bg-white/70 border border-transparent'
                }`}
              >
                <span className={`material-symbols-outlined text-[14px] transition-transform duration-300 ${isActive ? 'text-[#5B7DAA]' : 'group-hover:scale-105'}`}>
                  {opt.icon}
                </span>
                <span>{opt.label}</span>
                <span
                  className={`flex items-center justify-center size-4 rounded-md transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-b from-[#1C2E4A] to-[#3A5B8C] text-white shadow-sm'
                      : 'bg-slate-200/70 text-slate-400 group-hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[11px] leading-none">
                    {isActive && sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-200/80 shadow-[inset_0_1px_2px_rgba(28,46,74,0.08)]">
          {/* Brilho de canto */}
          <span aria-hidden className="pointer-events-none absolute -top-px left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-[#F2C14E]/60 to-transparent" />
          {(
            [
              { id: 'open' as EventScope, label: 'Em aberto', icon: 'pending_actions', count: openCount },
              { id: 'all' as EventScope, label: 'Todos', icon: 'select_check', count: allCount },
            ]
          ).map(opt => {
            const isActive = scope === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onScopeChange(opt.id)}
                aria-pressed={isActive}
                className={`group relative flex items-center gap-2 pl-3.5 pr-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B7DAA]/40 ${
                  isActive
                    ? 'bg-gradient-to-b from-[#1C2E4A] via-[#2C4368] to-[#3A5B8C] text-white shadow-[0_6px_14px_-6px_rgba(28,46,74,0.55)] -translate-y-px'
                    : 'text-slate-500 hover:text-[#1C2E4A] hover:bg-white hover:shadow-sm hover:border hover:border-slate-200'
                }`}
              >
                {isActive && opt.id === 'open' && (
                  <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#F2C14E] shadow-[0_0_0_2px_rgba(255,255,255,0.85)] animate-pulse" />
                )}
                <span className={`material-symbols-outlined text-[14px] transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                  {opt.icon}
                </span>
                <span>{opt.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-lg text-[9px] font-black leading-none transition-all duration-300 ${
                    isActive
                      ? 'bg-white/20 text-white ring-1 ring-inset ring-white/30'
                      : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200 group-hover:ring-[#1C2E4A]/20 group-hover:text-[#1C2E4A]'
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {controls}
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-8 w-8 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest animate-pulse">Carregando eventos...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-2">
        {controls}
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="bg-slate-50 p-6 rounded-full mb-4">
            <span className="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
          </div>
          <h3 className="text-slate-900 font-bold mb-1">Nenhum evento encontrado</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            Não encontramos eventos com os filtros selecionados. Tente ajustar sua busca.
          </p>
        </div>
      </div>
    );
  }

  const hasWithdrawn = events.some(e => e.participationStatus === 'withdrawn');
  const hasRemoved = events.some(e => e.participationStatus === 'rejected');

  return (
    <div className="space-y-2">
      {controls}

      {(hasWithdrawn || hasRemoved) && (
        <div className="flex items-start gap-3 p-3 mb-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-slate-400 mt-0.5">info</span>
          <div>
            <p className="font-medium text-slate-700 mb-0.5">Aviso sobre o seu envolvimento</p>
            <p>
              Os eventos marcados como <strong className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded">Retirou-se</strong> ou <strong className="text-red-700 bg-red-50 px-1 py-0.5 rounded">Removido</strong> não aparecerão no seu calendário ativo. Eles são mantidos aqui apenas para fins de histórico e transparência da sua agenda.
            </p>
          </div>
        </div>
      )}

      {events.map((event) => (
        <EventItem 
          key={event.id} 
          event={event} 
          onOpenCalendar={onOpenCalendar}
          onCancel={onCancel}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
