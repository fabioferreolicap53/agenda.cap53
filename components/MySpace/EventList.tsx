import React from 'react';
import { MySpaceEvent } from '../../hooks/useMySpace';
import { EventItem } from './EventItem';

interface EventListProps {
  events: MySpaceEvent[];
  loading: boolean;
  onOpenCalendar: (event: MySpaceEvent) => void;
  onCancel: (event: MySpaceEvent) => void;
  onDelete: (event: MySpaceEvent) => void;
  onDuplicate: (event: MySpaceEvent) => void;
  onEdit: (event: MySpaceEvent) => void;
}

export const EventList: React.FC<EventListProps> = ({ 
  events, 
  loading, 
  onOpenCalendar, 
  onCancel, 
  onDelete,
  onDuplicate,
  onEdit
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-8 w-8 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest animate-pulse">Carregando eventos...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="bg-slate-50 p-6 rounded-full mb-4">
          <span className="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
        </div>
        <h3 className="text-slate-900 font-bold mb-1">Nenhum evento encontrado</h3>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">
          Não encontramos eventos com os filtros selecionados. Tente ajustar sua busca.
        </p>
      </div>
    );
  }

  const hasWithdrawn = events.some(e => e.participationStatus === 'withdrawn');
  const hasRemoved = events.some(e => e.participationStatus === 'rejected');

  return (
    <div className="space-y-4">
      {(hasWithdrawn || hasRemoved) && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 animate-in fade-in slide-in-from-top-2">
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
