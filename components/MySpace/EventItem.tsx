import React from 'react';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MySpaceEvent } from '../../hooks/useMySpace';

interface EventItemProps {
  event: MySpaceEvent;
  onOpenCalendar: (event: MySpaceEvent) => void;
  onCancel: (event: MySpaceEvent) => void;
  onDelete: (event: MySpaceEvent) => void;
}

export const EventItem: React.FC<EventItemProps> = ({ event, onOpenCalendar, onCancel, onDelete }) => {
  const getSafeDate = (dateStr: string | undefined) => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const getStatusDot = (event: MySpaceEvent) => {
    let color = 'bg-slate-400';
    let label = 'Desconhecido';
    
    if (event.participationStatus === 'pending') {
      color = 'bg-amber-500';
      label = 'Convite Pendente';
    } else if (event.requestStatus === 'pending') {
      color = 'bg-blue-500';
      label = 'Solicitação Pendente';
    } else if (event.participationStatus === 'rejected' || event.requestStatus === 'rejected') {
      color = 'bg-red-500';
      label = 'Recusado';
    } else if (event.status === 'canceled') {
      color = 'bg-red-600';
      label = 'Cancelado';
    } else if (isPast(getSafeDate(event.date_end))) {
      color = 'bg-slate-300';
      label = 'Concluído';
    } else if (isToday(getSafeDate(event.date_start))) {
      color = 'bg-green-500 animate-pulse';
      label = 'Hoje';
    } else if (isFuture(getSafeDate(event.date_start))) {
      color = 'bg-indigo-500';
      label = 'Agendado';
    }

    return (
      <div className="flex items-center gap-1.5" title={label}>
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 hidden sm:inline-block">
          {label}
        </span>
      </div>
    );
  };

  const getRoleBadge = (event: MySpaceEvent) => {
    const role = (event.userRole || '').toUpperCase();
    let label = 'Participante';
    let icon = 'person';
    let classes = 'text-indigo-600 bg-indigo-50/50 border-indigo-100';

    if (role === 'ORGANIZADOR') {
      label = 'Organizador';
      icon = 'assignment_ind';
      classes = 'text-blue-600 bg-blue-50/50 border-blue-100';
    } else if (role === 'COORGANIZADOR') {
      label = 'Coorganizador';
      icon = 'group_work';
      classes = 'text-emerald-600 bg-emerald-50/50 border-emerald-100';
    } else if (event.requestStatus === 'pending') {
      label = 'Aguardando';
      icon = 'hourglass_top';
      classes = 'text-slate-500 bg-slate-50 border-slate-100';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${classes}`}>
        <span className="material-symbols-outlined text-[12px]">{icon}</span>
        {label}
      </span>
    );
  };

  const isCreator = event.type === 'created';
  const start = getSafeDate(event.date_start);
  const end = getSafeDate(event.date_end);

  return (
    <div className="group relative bg-white border border-slate-100 hover:border-slate-200 rounded-xl p-4 transition-all duration-200 hover:shadow-sm">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Date Block */}
        <div className="flex sm:flex-col items-center sm:items-center justify-center sm:justify-start min-w-[60px] sm:w-[70px] bg-slate-50 rounded-lg p-2 border border-slate-100/50 gap-3 sm:gap-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{format(start, 'MMM', { locale: ptBR })}</span>
          <span className="text-xl sm:text-2xl font-black text-slate-700">{format(start, 'dd')}</span>
          <span className="text-[10px] font-medium text-slate-400 uppercase sm:mt-1">{format(start, 'EEE', { locale: ptBR })}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusDot(event)}
                {getRoleBadge(event)}
              </div>
              <h3 className="text-base font-bold text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">
                {event.title}
              </h3>
            </div>
            
            {/* Actions (Desktop: visible on hover, Mobile: always visible but smaller) */}
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity self-start sm:self-center">
              <button 
                onClick={() => onOpenCalendar(event)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Ver no Calendário"
              >
                <span className="material-symbols-outlined text-xl">calendar_month</span>
              </button>
              
              {isCreator && (
                <>
                  <button 
                    onClick={() => onCancel(event)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Cancelar Evento"
                  >
                    <span className="material-symbols-outlined text-xl">block</span>
                  </button>
                  <button 
                    onClick={() => onDelete(event)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir Evento"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
              <span>
                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
              </span>
            </div>
            
            {(event.location || event.custom_location) && (
              <div className="flex items-center gap-1.5 max-w-[200px] truncate">
                <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                <span className="truncate">
                  {event.expand?.location?.name || event.location || event.custom_location}
                </span>
              </div>
            )}

            {event.category && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-400">category</span>
                <span>{event.category}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
