import React from 'react';
import { MySpaceEvent } from '../../hooks/useMySpace';
import { EventItem } from './EventItem';

interface EventListProps {
  events: MySpaceEvent[];
  loading: boolean;
  onOpenCalendar: (event: MySpaceEvent) => void;
  onCancel: (event: MySpaceEvent) => void;
  onDelete: (event: MySpaceEvent) => void;
}

export const EventList: React.FC<EventListProps> = ({ 
  events, 
  loading, 
  onOpenCalendar, 
  onCancel, 
  onDelete 
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

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventItem 
          key={event.id} 
          event={event} 
          onOpenCalendar={onOpenCalendar}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
