import React from 'react';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MySpaceEvent } from '../../hooks/useMySpace';
import { RESPONSIBILITY_LEVELS, getPresenceLabel } from '../../lib/constants';
import { getEstimatedParticipants } from '../../lib/eventUtils';

interface EventItemProps {
  event: MySpaceEvent;
  onOpenCalendar: (event: MySpaceEvent) => void;
  onCancel: (event: MySpaceEvent) => void;
  onDelete: (event: MySpaceEvent) => void;
  onDuplicate: (event: MySpaceEvent) => void;
  onEdit: (event: MySpaceEvent) => void;
}

export const EventItem: React.FC<EventItemProps> = ({ event, onOpenCalendar, onCancel, onDelete, onDuplicate, onEdit }) => {
  const getSafeDate = (dateStr: string | undefined) => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const getStatusDot = (event: MySpaceEvent) => {
    let color = 'bg-slate-400';
    let label = 'Desconhecido';
    // Fundo do chip de status — harmônico e discreto.
    let colorClass = 'bg-slate-100 text-slate-600';

    // Presença do usuário — vocabulário unificado em todo o sistema.
    // "participation" = convite do criador; "request" = entrou por conta própria.
    if (event.type === 'participation' || event.type === 'request') {
      const isOwnRequest = event.type === 'request';
      const st = ((isOwnRequest ? event.requestStatus : event.participationStatus) || 'pending').toLowerCase();
      label = getPresenceLabel({ status: st, hasOwnRequest: isOwnRequest });
      if (st === 'accepted') {
        color = 'bg-green-500';
        colorClass = 'bg-emerald-50 text-emerald-700';
      } else if (st === 'rejected') {
        color = 'bg-red-500';
        colorClass = 'bg-red-50 text-red-700';
      } else if (st === 'withdrawn' || st === 'declined') {
        color = 'bg-amber-600';
        colorClass = 'bg-amber-50 text-amber-700';
      } else {
        color = isOwnRequest ? 'bg-blue-500' : 'bg-amber-500';
        colorClass = isOwnRequest ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';
      }
    } else if (event.status === 'canceled') {
      color = 'bg-red-600';
      colorClass = 'bg-red-50 text-red-700';
      label = 'Cancelado';
    } else if (isPast(getSafeDate(event.date_end))) {
      color = 'bg-slate-300';
      colorClass = 'bg-slate-200/70 text-slate-500';
      label = 'Concluído';
    } else if (isToday(getSafeDate(event.date_start))) {
      color = 'bg-green-500 animate-pulse';
      colorClass = 'bg-emerald-50 text-emerald-700';
      label = 'Hoje';
    } else if (isFuture(getSafeDate(event.date_start))) {
      color = 'bg-indigo-500';
      colorClass = 'bg-indigo-50 text-indigo-700';
      label = 'Agendado';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1 py-[1px] rounded-full text-[8px] font-black uppercase tracking-wider leading-tight ${colorClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        {label}
      </span>
    );
  };

  const getRoleBadge = (event: MySpaceEvent) => {
    const role = (event.userRole || '').toUpperCase();
    let label = 'Participante';
    let icon = 'person';
    let classes = 'text-primary bg-primary/5 border-primary/20';
    let title = 'Você foi definido como participante neste evento.';

    if (event.type === 'created') {
      // Quem cria não é sempre organizador: em "Participação externa" quem cria
      // apenas participa do evento.
      const onlyParticipates = role === 'PARTICIPANTE';
      label = 'Criador';
      icon = 'workspace_premium';
      classes = 'text-indigo-700 bg-indigo-50 border-indigo-200';
      title = onlyParticipates
        ? 'Você criou este evento e participa dele (participação externa).'
        : 'Você criou este evento e é o organizador dele.';
    } else if (role === 'ORGANIZADOR') {
      label = 'Co-organizador';
      icon = 'assignment_ind';
      classes = 'text-primary bg-primary/10 border-primary/20';
      title = 'Te definiram como organizador deste evento de outra pessoa.';
    } else if (event.type === 'request') {
      label = 'Participante';
      icon = 'person_add';
      classes = 'text-blue-700 bg-blue-50 border-blue-200';
      title = 'Você entrou neste evento por conta própria.';
    }

    return (
      <span title={title} className={`inline-flex items-center gap-0.5 px-1 py-[1px] rounded-full border text-[8px] font-black uppercase tracking-wider leading-tight ${classes}`}>
        <span className="material-symbols-outlined text-[10px]">{icon}</span>
        {label}
      </span>
    );
  };

  const isCreator = event.type === 'created';
  const start = getSafeDate(event.date_start);
  const end = getSafeDate(event.date_end);
  // Evento concluído vs. agendado — define o tratamento visual do cartão.
  const isCompleted =
    event.status !== 'canceled' &&
    event.participationStatus !== 'pending' &&
    event.participationStatus !== 'rejected' &&
    event.participationStatus !== 'withdrawn' &&
    event.requestStatus !== 'pending' &&
    event.requestStatus !== 'rejected' &&
    isPast(end);

  return (
    <div
      data-anchor={`event-${event.id}`}
      className={`
        group relative overflow-hidden rounded-xl border p-3 transition-all duration-200
        ${isCompleted
          ? 'bg-slate-50/70 border-slate-200/70 hover:shadow-[0_8px_20px_-14px_rgba(71,85,105,0.4)]'
          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-[0_10px_26px_-14px_rgba(28,46,74,0.35)]'}
      `}
    >
      {/* Trilho lateral: sinaliza agendado (vivo) x concluído (arquivado) */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-[3px] ${
          isCompleted
            ? 'bg-gradient-to-b from-slate-300 to-slate-400/60'
            : 'bg-gradient-to-b from-[#1C2E4A] via-[#5B7DAA] to-[#9AB1D0]'
        }`}
      />
      <div className="flex flex-col sm:flex-row gap-2.5 pl-1">
        {/* Date Block */}
        <div
          className={`flex sm:flex-col items-center sm:items-center justify-center sm:justify-start min-w-[56px] sm:w-[64px] rounded-lg p-1.5 border gap-2 sm:gap-0 ${
            isCompleted
              ? 'bg-slate-100/80 border-slate-200/60'
              : 'bg-slate-50 border-slate-100/50'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted ? 'text-slate-400' : 'text-slate-400'}`}>{format(start, 'MMM', { locale: ptBR })}</span>
          <span className={`text-lg sm:text-xl font-black leading-none ${isCompleted ? 'text-slate-500' : 'text-slate-700'}`}>{format(start, 'dd')}</span>
          <span className="text-[9px] font-medium text-slate-400 uppercase sm:mt-0.5">{format(start, 'EEE', { locale: ptBR })}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1.5">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {getStatusDot(event)}
                {getRoleBadge(event)}
              </div>
              <h3 className={`text-sm font-bold sm:truncate leading-tight uppercase flex items-center gap-1.5 pt-0.5 ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>
                {(event as any).is_private ? (
                  <span className="material-symbols-outlined text-[16px] text-amber-500 font-bold" title="Evento Particular (Invisível no calendário para os demais usuários)">visibility_off</span>
                ) : (
                  <span className={`material-symbols-outlined text-[16px] font-bold ${isCompleted ? 'text-slate-400' : 'text-emerald-500'}`} title="Evento Público (Visível por todos os usuários)">visibility</span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenCalendar(event)}
                  className="text-left hover:text-primary transition-colors cursor-pointer"
                  title="Abrir no Calendário"
                >
                  {event.title?.toUpperCase()}
                </button>
              </h3>
            </div>
            
            {/* Actions (Desktop: visible on hover, Mobile: always visible) */}
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity self-start sm:self-center bg-slate-50 sm:bg-transparent p-1 sm:p-0 rounded-lg border border-slate-100 sm:border-0 -mt-1 sm:mt-0">
              <button 
                onClick={() => onOpenCalendar(event)}
                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center"
                title="Abrir no Calendário"
              >
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </button>
              
              {isCreator && (
                <>
                  <button 
                    onClick={() => onEdit(event)}
                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button 
                    onClick={() => onDuplicate(event)}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center"
                    title="Duplicar"
                  >
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </button>
                  <button 
                    onClick={() => onCancel(event)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center justify-center"
                    title="Cancelar Evento"
                  >
                    <span className="material-symbols-outlined text-[20px]">block</span>
                  </button>
                  <button 
                    onClick={() => onDelete(event)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] font-medium ${isCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
              <span>
                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
              </span>
            </div>

            {event.event_responsibility && (
              <div className="flex items-center gap-1.5" title={`${RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.label}\n${RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.description}`}>
                <span className="material-symbols-outlined text-[14px] text-slate-400">
                  {event.event_responsibility.includes('EXTERNO') ? 'public' : 'domain'}
                </span>
                <span className="truncate max-w-[100px] sm:max-w-[150px]">
                  {RESPONSIBILITY_LEVELS.find(l => l.value === event.event_responsibility)?.label}
                </span>
              </div>
            )}

            {(() => {
              const est = getEstimatedParticipants({ estimated_participants: event.estimated_participants });
              return event.event_responsibility !== 'EXTERNO_COMPROMISSO' && est > 0 ? (
               <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100/50 text-[10px]" title="Quantidade Estimada de Presentes">
                 <span className="material-symbols-outlined text-[12px]">groups</span>
                 <span className="font-bold">Est. {est}</span>
               </div>
              ) : null;
            })()}

            {(event.location || event.custom_location) && (
              <div className="flex items-center gap-1.5 max-w-[200px] truncate">
                <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                <span className="truncate">
                  {event.expand?.location?.name || event.location || event.custom_location}
                </span>
              </div>
            )}

            {event.category && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-slate-400">category</span>
                <span>{event.category}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1" title="Data de Criação">
              <span className="material-symbols-outlined text-[12px]">add_circle</span>
              Criado: {event.created ? new Date(event.created.replace(' ', 'T') + (event.created.includes('Z') ? '' : 'Z')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---'}
            </div>
            {event.updated && event.updated !== event.created && (
              <div className="flex items-center gap-1" title="Última Edição">
                <span className="material-symbols-outlined text-[12px]">edit</span>
                Editado: {new Date(event.updated.replace(' ', 'T') + (event.updated.includes('Z') ? '' : 'Z')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
