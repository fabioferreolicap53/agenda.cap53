import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DapsEvent,
  DapsInvolved,
  getLevelLabel,
  getLevelIcon,
  LEVEL_ORGANIZER,
  LEVEL_CO_ORGANIZER,
  LEVEL_PARTICIPANT,
} from '../../hooks/useDapsEvents';
import { getAvatarUrl } from '../../lib/pocketbase';
import { getPresenceLabel } from '../../lib/constants';

interface Props {
  event: DapsEvent;
  defaultOpen?: boolean;
}

const LEVEL_META: Record<string, { label: string; chip: string; border: string; icon: string }> = {
  [LEVEL_ORGANIZER]: {
    label: 'Organizador',
    chip: 'bg-amber-100 text-amber-700',
    border: 'border-amber-300',
    icon: 'shield_person',
  },
  [LEVEL_CO_ORGANIZER]: {
    label: 'Co-organizador',
    chip: 'bg-blue-100 text-blue-700',
    border: 'border-blue-300',
    icon: 'assignment_ind',
  },
  [LEVEL_PARTICIPANT]: {
    label: 'Participante',
    chip: 'bg-violet-100 text-violet-700',
    border: 'border-violet-200',
    icon: 'person',
  },
};

const formatFull = (value?: string): string => {
  if (!value) return 'Data não definida';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Data não definida';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const InvolvedRow: React.FC<{ person: DapsInvolved }> = ({ person }) => {
  const st = (person.status || 'accepted').toLowerCase();
  const presenceLabel = getPresenceLabel({
    isCreator: person.isCreator,
    creatorRole: person.level,
    status: st,
    hasOwnRequest: person.hasOwnRequest,
  });
  const statusClasses = person.isCreator
    ? 'bg-slate-800 text-white border-slate-700'
    : st === 'accepted'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : st === 'rejected'
    ? 'bg-red-50 text-red-600 border-red-100'
    : st === 'withdrawn' || st === 'declined'
    ? 'bg-slate-100 text-slate-500 border-slate-200'
    : 'bg-amber-50 text-amber-700 border-amber-100';
  const meta = LEVEL_META[person.level] || LEVEL_META[LEVEL_PARTICIPANT];

  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5">
      <img
        src={getAvatarUrl(person) || undefined}
        alt={person.name}
        className={`size-9 rounded-full object-cover border-2 shrink-0 ${meta.border}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-bold text-slate-800">{person.name}</p>
          {person.isCreator && (
            <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
              criador
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {person.sector || 'Setor não informado'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${meta.chip}`}
        >
          <span className="material-symbols-outlined text-[12px]">{getLevelIcon(person.level)}</span>
          {getLevelLabel(person.level)}
        </span>
        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${statusClasses}`}>
          {presenceLabel}
        </span>
      </div>
    </li>
  );
};

/** Seção agrupada por nível com cor e ícone próprios. */
const LevelSection: React.FC<{
  title: string;
  icon: string;
  accent: string;
  count: number;
  items: DapsInvolved[];
}> = ({ title, icon, accent, count, items }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${accent}`}>
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {title} ({count})
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((person) => (
          <InvolvedRow key={person.id} person={person} />
        ))}
      </ul>
    </div>
  );
};

export const DapsEventCard: React.FC<Props> = ({ event, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const navigate = useNavigate();

  const goToEvent = () => {
    const dateStr = event.dateStart
      ? new Date(event.dateStart).toISOString().split('T')[0]
      : '';
    navigate(
      `/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details&from=/eventos-daps`
    );
  };

  const total = event.involved.length || 1;

  // Três fatias
  const organizers = event.involved.filter((p) => p.level === LEVEL_ORGANIZER);
  const coOrganizers = event.involved.filter((p) => p.level === LEVEL_CO_ORGANIZER);
  const participants = event.involved.filter((p) => p.level === LEVEL_PARTICIPANT);

  // Percentuais da barra tripla
  const organizerPct = (event.organizerCount / total) * 100;
  const coOrganizerPct = (event.coOrganizerCount / total) * 100;
  const participantPct = 100 - organizerPct - coOrganizerPct;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Faixa tripla — âmbar (org) / azul (co-org) / violeta (part) */}
      <div className="flex h-1 w-full">
        <div className="bg-amber-400" style={{ width: `${organizerPct}%` }} />
        <div className="bg-blue-400" style={{ width: `${coOrganizerPct}%` }} />
        <div className="bg-violet-400" style={{ width: `${participantPct}%` }} />
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                <span className="material-symbols-outlined text-[13px]">campaign</span>
                Evento DAPS
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {formatFull(event.dateStart)}
              </span>
              {event.gapBefore !== null && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  <span className="material-symbols-outlined text-[12px]">timelapse</span>
                  {event.gapBefore}d após o anterior
                </span>
              )}
            </div>
            <h3
              className="mt-2 text-base font-black tracking-tight text-slate-900 hover:text-amber-700 transition-colors cursor-pointer"
              onClick={goToEvent}
              title="Clique para ver no calendário"
            >
              {event.title}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">place</span>
                {event.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person_check</span>
                Criado por {event.creatorName}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-black leading-none text-slate-900">{event.involved.length}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                envolvidos
              </p>
            </div>
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
              title={open ? 'Recolher detalhes' : 'Ver todos os envolvidos'}
            >
              <span
                className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${
                  open ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>
          </div>
        </div>

        {/* Contadores dos 3 níveis */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {event.organizerCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
              <span className="material-symbols-outlined text-[13px]">shield_person</span>
              {event.organizerCount} {event.organizerCount === 1 ? 'organizador' : 'organizadores'}
            </span>
          )}
          {event.coOrganizerCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
              <span className="material-symbols-outlined text-[13px]">assignment_ind</span>
              {event.coOrganizerCount} {event.coOrganizerCount === 1 ? 'co-organizador' : 'co-organizadores'}
            </span>
          )}
          {event.participantCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">
              <span className="material-symbols-outlined text-[13px]">person</span>
              {event.participantCount} {event.participantCount === 1 ? 'participante' : 'participantes'}
            </span>
          )}
          {event.pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
              <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
              {event.pendingCount} {event.pendingCount === 1 ? 'presença pendente' : 'presenças pendentes'}
            </span>
          )}
        </div>

        {/* Barra tripla */}
        <div className="mt-3">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${organizerPct}%` }} />
            <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${coOrganizerPct}%` }} />
            <div className="h-full bg-violet-400 transition-all duration-500" style={{ width: `${participantPct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" />
              {event.organizerCount} org.
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-400" />
              {event.coOrganizerCount} co-org.
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-violet-400" />
              {event.participantCount} part.
            </span>
          </div>
        </div>

        {/* Chips auxiliares */}
        {(event.unidades.length > 0 || event.categorias.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.unidades.map((unidade) => (
              <span
                key={`u-${unidade}`}
                className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
              >
                {unidade}
              </span>
            ))}
            {event.categorias.map((categoria) => (
              <span
                key={`c-${categoria}`}
                className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600"
              >
                {categoria}
              </span>
            ))}
          </div>
        )}

        {/* Detalhamento agrupado por nível */}
        {open && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {event.description && (
              <p className="rounded-xl bg-slate-50 p-3 text-[12px] font-medium leading-relaxed text-slate-600">
                {event.description}
              </p>
            )}

            <LevelSection
              title="Organizadores"
              icon="shield_person"
              accent="text-amber-600"
              count={organizers.length}
              items={organizers}
            />
            <LevelSection
              title="Co-organizadores"
              icon="assignment_ind"
              accent="text-blue-600"
              count={coOrganizers.length}
              items={coOrganizers}
            />
            <LevelSection
              title="Participantes"
              icon="person"
              accent="text-violet-600"
              count={participants.length}
              items={participants}
            />

            {event.involved.length === 0 && (
              <p className="text-center text-[12px] font-semibold text-slate-400">
                Nenhum envolvido registrado neste evento.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
