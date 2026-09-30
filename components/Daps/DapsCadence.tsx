import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DapsEvent, DapsStats, LEVEL_ORGANIZER, LEVEL_CO_ORGANIZER, LEVEL_PARTICIPANT } from '../../hooks/useDapsEvents';
import { getAvatarUrl } from '../../lib/pocketbase';
import { RESPONSIBILITY_LEVELS } from '../../lib/constants';

// Rótulo da responsabilidade, igual ao exibido na página "Novo Evento".
const responsibilityLabel = (value?: string): string =>
  value ? RESPONSIBILITY_LEVELS.find(l => l.value === value)?.label || value : '';

// Aparência de cada nível de envolvimento (usada na lista de envolvidos).
const LEVEL_META: Record<string, { label: string; text: string; dot: string; rank: number }> = {
  [LEVEL_ORGANIZER]: { label: 'Organizador', text: 'text-[#1C2E4A]', dot: 'bg-[#1C2E4A]', rank: 0 },
  [LEVEL_CO_ORGANIZER]: { label: 'Co-organizador', text: 'text-[#456086]', dot: 'bg-[#456086]', rank: 1 },
  [LEVEL_PARTICIPANT]: { label: 'Participante', text: 'text-[#5B7DAA]', dot: 'bg-[#7C97BB]', rank: 2 },
};

const levelMeta = (level: string) =>
  LEVEL_META[level] || { label: level, text: 'text-slate-500', dot: 'bg-slate-300', rank: 3 };

interface Props {
  events: DapsEvent[];
  stats: DapsStats;
}

const formatDate = (value?: string): string => {
  if (!value) return 'Data não definida';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Data não definida';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const TONE: Record<string, { chip: string; icon: string }> = {
  emerald: { chip: 'border-emerald-100 bg-emerald-50 text-emerald-700', icon: 'text-emerald-500' },
  steel: { chip: 'border-[#456086]/20 bg-[#456086]/8 text-[#456086]', icon: 'text-[#5B7DAA]' },
  sky: { chip: 'border-[#7C97BB]/30 bg-[#7C97BB]/15 text-[#456086]', icon: 'text-[#7C97BB]' },
  amber: { chip: 'border-amber-100 bg-amber-50 text-amber-700', icon: 'text-amber-500' },
  slate: { chip: 'border-slate-200 bg-slate-50 text-slate-600', icon: 'text-slate-400' },
};

const GapRow: React.FC<{ days: number | null }> = ({ days }) => (
  <div className="relative flex items-center py-2 pl-10">
    <span className="absolute left-[7px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-slate-200 bg-white z-10" />
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
      <span className="material-symbols-outlined text-[14px] text-[#7C97BB]">timelapse</span>
      {days === null
        ? 'intervalo desconhecido'
        : days === 0
        ? 'mesmo dia'
        : `${days} ${days === 1 ? 'dia' : 'dias'} de intervalo`}
    </span>
  </div>
);

const RoleLegend: React.FC<{
  color: string;
  value: number;
  label: string;
  muted?: boolean;
}> = ({ color, value, label, muted = false }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className={`size-2 shrink-0 rounded-full ${color}`} />
    <span className={`text-sm font-black ${muted ? 'text-slate-400' : 'text-slate-700'}`}>
      {value}
    </span>
    <span
      className={`text-[11px] font-bold uppercase tracking-wide ${
        muted ? 'text-slate-300' : 'text-slate-500'
      }`}
    >
      {label}
    </span>
  </span>
);

const EventRow: React.FC<{ event: DapsEvent; isNext: boolean; isPast?: boolean }> = ({
  event,
  isNext,
  isPast = false,
}) => {
  const navigate = useNavigate();
  const [involvedOpen, setInvolvedOpen] = useState(false);
  const date = event.dateStart ? new Date(event.dateStart) : null;
  const endDate = event.dateEnd ? new Date(event.dateEnd) : null;

  const now = new Date();
  const nowMs = now.getTime();
  const startMs = date ? date.getTime() : NaN;
  const validDate = !isNaN(startMs);

  // Contagem considera data E horário de início: um evento cujo horário já
  // passou hoje conta como iniciado; os dias restantes usam dias corridos,
  // então um evento mais tarde hoje mostra "É hoje" (0 dia).
  const isFuture = validDate && startMs >= nowMs;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysUntil = isFuture
    ? Math.round((startOfDay(date as Date) - startOfDay(now)) / 86400000)
    : null;
  const daysSince =
    validDate && !isFuture
      ? Math.round((startOfDay(now) - startOfDay(date as Date)) / 86400000)
      : null;

  const durationDays =
    date && endDate && !isNaN(endDate.getTime())
      ? Math.max(1, Math.round((endDate.getTime() - date.getTime()) / 86400000) + 1)
      : null;

  const roleTotal = event.organizerCount + event.coOrganizerCount + event.participantCount;
  const pct = (n: number) => (roleTotal > 0 ? (n / roleTotal) * 100 : 0);

  const dayNum = date ? String(date.getDate()).padStart(2, '0') : '--';
  const monthLbl = date ? date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '—';
  const weekLbl = date ? date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : '';
  const fullDate = date ? formatDate(event.dateStart) : 'Data não definida';

  const goToEvent = () => {
    const dateStr = event.dateStart
      ? new Date(event.dateStart).toISOString().split('T')[0]
      : '';
    navigate(
      `/calendar?date=${dateStr}&view=agenda&eventId=${event.id}&tab=details&from=/eventos-daps`
    );
  };

  const nodeColor = isNext
    ? 'border-amber-500'
    : isPast
    ? 'border-slate-300'
    : isFuture
    ? 'border-[#7C97BB]'
    : 'border-slate-300';

  const dateBox = isPast
    ? 'bg-slate-100 text-slate-400'
    : isNext
    ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30'
    : isFuture
    ? 'bg-[#7C97BB]/15 text-[#456086]'
    : 'bg-slate-100 text-slate-500';

  // Painel de contagem regressiva (futuro) / decorrido (passado)
  const countdown = (() => {
    if (isPast) {
      return {
        value: daysSince ?? 0,
        label: daysSince === 0 ? 'hoje' : 'dias atrás',
        box: 'border border-slate-100 bg-slate-50 text-slate-400',
        num: 'text-slate-400',
        pulse: '',
      };
    }
    if (daysUntil === null) return null;
    if (daysUntil === 0)
      return {
        value: 0,
        label: 'É hoje',
        box: 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 ring-2 ring-amber-300/50',
        num: 'text-white',
        pulse: 'animate-pulse',
      };
    if (daysUntil === 1)
      return {
        value: 1,
        label: 'Amanhã',
        box: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/50 ring-2 ring-amber-300/40',
        num: 'text-white',
        pulse: 'animate-[pulse_1.5s_ease-in-out_infinite]',
      };
    if (daysUntil <= 3)
      return {
        value: daysUntil,
        label: 'dias',
        box: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-400/40 ring-1 ring-amber-300/60',
        num: 'text-white',
        pulse: 'animate-[pulse_2s_ease-in-out_infinite]',
      };
    if (daysUntil <= 7)
      return {
        value: daysUntil,
        label: 'dias',
        box: 'bg-gradient-to-br from-[#5B7DAA] to-[#1C2E4A] text-white shadow-md shadow-[#456086]/30 ring-1 ring-[#7C97BB]/40',
        num: 'text-white',
        pulse: '',
      };
    return {
      value: daysUntil,
      label: 'dias',
      box: 'border border-[#7C97BB]/40 bg-white text-[#1C2E4A] shadow-sm',
      num: 'text-[#1C2E4A]',
      pulse: '',
    };
  })();

  // Sombreamento e iluminação do cartão conforme o estado temporal
  const cardSkin = isPast
    ? {
        base: 'border-slate-100/70 bg-slate-50/50 shadow-sm hover:shadow-md hover:shadow-slate-300/40',
        glow: 'bg-[radial-gradient(circle_at_0%_0%,rgba(148,163,184,0.16),transparent_60%)]',
        accent: 'from-slate-200 to-transparent',
        edge: 'via-slate-200/60',
        lift: 'hover:-translate-y-0.5',
      }
    : isNext
    ? {
        base: 'border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-white shadow-lg shadow-amber-500/15 ring-1 ring-amber-100 hover:shadow-xl hover:shadow-amber-500/30',
        glow: 'bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.30),transparent_55%)]',
        accent: 'from-amber-400 via-orange-400 to-transparent',
        edge: 'via-amber-200/80',
        lift: 'hover:-translate-y-0.5',
      }
    : isFuture
    ? {
        base: 'border-[#7C97BB]/30 bg-gradient-to-br from-[#7C97BB]/12 via-white to-white shadow-md shadow-[#456086]/10 ring-1 ring-[#7C97BB]/20 hover:shadow-xl hover:shadow-[#456086]/25',
        glow: 'bg-[radial-gradient(circle_at_0%_0%,rgba(124,151,187,0.24),transparent_55%)]',
        accent: 'from-[#5B7DAA] via-[#7C97BB] to-transparent',
        edge: 'via-[#7C97BB]/50',
        lift: 'hover:-translate-y-0.5',
      }
    : {
        base: 'border-slate-100 bg-white shadow-sm hover:shadow-md',
        glow: 'bg-[radial-gradient(circle_at_0%_0%,rgba(148,163,184,0.14),transparent_60%)]',
        accent: 'from-slate-200 to-transparent',
        edge: 'via-slate-200/60',
        lift: 'hover:-translate-y-0.5',
      };

  return (
    <div
      className={`relative pl-8 sm:pl-10 ${
        isPast ? 'opacity-70 hover:opacity-100 transition-opacity duration-300' : ''
      }`}
    >
      {/* Nó da trilha */}
      <span
        className={`absolute left-[5px] top-5 size-5 rounded-full border-2 bg-white z-10 ${nodeColor}`}
      >
        {isNext && <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping" />}
      </span>

      <div
        className={`relative rounded-2xl border p-4 transition-all duration-300 ${cardSkin.lift} ${cardSkin.base}`}
      >
        {/* Iluminação radial no canto superior esquerdo */}
        <span
          className={`pointer-events-none absolute inset-0 rounded-2xl ${cardSkin.glow}`}
        />
        {/* Fio de luz na borda superior */}
        <span
          className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${cardSkin.edge}`}
        />
        {/* Faixa de acento lateral */}
        <span
          className={`pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-full bg-gradient-to-b ${cardSkin.accent}`}
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          {/* Data + conteúdo dividem a linha; a contagem desce no mobile */}
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          {/* Bloco de data */}
          <div
            className={`flex min-w-[56px] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-2.5 sm:min-w-[62px] sm:px-3 ${dateBox}`}
            title={`${fullDate}${weekLbl ? ` · ${weekLbl}` : ''}`}
          >
            <span className="text-2xl font-black leading-none tracking-tight">{dayNum}</span>
            <span className="mt-0.5 text-[11px] font-black uppercase tracking-wider">{monthLbl}</span>
            {weekLbl && <span className="text-[9px] font-bold uppercase opacity-70">{weekLbl}</span>}
          </div>

          {/* Conteúdo principal */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isNext && (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  próximo
                </span>
              )}
              {isPast && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <span className="material-symbols-outlined text-[11px]">check_circle</span>
                  realizado
                </span>
              )}
              {(event.responsibility || event.creatorName) && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                    isPast ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px] text-slate-400">
                    {event.responsibility ? 'badge' : 'person'}
                  </span>
                  {responsibilityLabel(event.responsibility) || event.creatorName}
                </span>
              )}
            </div>

            <h4
              className={`group/title mt-2 inline-flex min-w-0 max-w-full items-start gap-1.5 break-words text-base font-black leading-snug tracking-tight transition-colors cursor-pointer decoration-[#7C97BB] decoration-2 underline-offset-4 hover:underline sm:text-lg ${
                isPast ? 'text-slate-500 hover:text-[#1C2E4A]' : 'text-slate-800 hover:text-[#1C2E4A]'
              }`}
              onClick={goToEvent}
              title="Clique para ver no calendário"
            >
              {event.title}
              <span className="material-symbols-outlined mt-1 text-[16px] opacity-0 transition-opacity duration-200 group-hover/title:opacity-100">
                arrow_outward
              </span>
            </h4>

            <div
              className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold ${
                isPast ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-slate-400">place</span>
                {event.location}
              </span>
              {durationDays !== null && durationDays > 1 && (
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">hourglass_bottom</span>
                  {durationDays} dias de duração
                </span>
              )}
            </div>

            {/* Composição de papéis */}
            {roleTotal > 0 && (
              <div className="mt-3">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {event.organizerCount > 0 && (
                    <div className="bg-[#1C2E4A]" style={{ width: `${pct(event.organizerCount)}%` }} />
                  )}
                  {event.coOrganizerCount > 0 && (
                    <div className="bg-[#456086]" style={{ width: `${pct(event.coOrganizerCount)}%` }} />
                  )}
                  {event.participantCount > 0 && (
                    <div
                      className="bg-[#7C97BB]"
                      style={{ width: `${pct(event.participantCount)}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {event.organizerCount > 0 && (
                    <RoleLegend color="bg-[#1C2E4A]" value={event.organizerCount} label="organizadores" muted={isPast} />
                  )}
                  {event.coOrganizerCount > 0 && (
                    <RoleLegend color="bg-[#456086]" value={event.coOrganizerCount} label="co-org." muted={isPast} />
                  )}
                  {event.participantCount > 0 && (
                    <RoleLegend color="bg-[#7C97BB]" value={event.participantCount} label="participantes" muted={isPast} />
                  )}
                  {event.estimatedParticipants !== undefined && event.estimatedParticipants > 0 && (
                    <span
                      className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                        isPast
                          ? 'border-slate-200/70 bg-white/60 text-slate-400'
                          : 'border-[#7C97BB]/40 bg-[#7C97BB]/12 text-[#456086]'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[13px] ${
                          isPast ? 'text-slate-400' : 'text-[#5B7DAA]'
                        }`}
                      >
                        groups
                      </span>
                      <span className={`text-xs font-black ${isPast ? 'text-slate-400' : 'text-[#1C2E4A]'}`}>
                        {event.estimatedParticipants}
                      </span>
                      previstos
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Unidades e categorias */}
            {(event.unidades.length > 0 || event.categorias.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {event.unidades.slice(0, 3).map((unit) => (
                  <span
                    key={unit}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isPast
                        ? 'border-slate-100 bg-slate-50/60 text-slate-400'
                        : 'border-slate-100 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-slate-400">apartment</span>
                    {unit}
                  </span>
                ))}
                {event.unidades.length > 3 && (
                  <span className="text-[10px] font-bold text-slate-400">
                    +{event.unidades.length - 3}
                  </span>
                )}
                {event.categorias.slice(0, 2).map((cat) => (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isPast
                        ? 'border-[#7C97BB]/20 bg-[#7C97BB]/8 text-[#5B7DAA]/70'
                        : 'border-[#7C97BB]/30 bg-[#7C97BB]/12 text-[#456086]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-[#5B7DAA]">local_offer</span>
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Envolvidos e status */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {event.involved.length > 0 && (
                <div className="flex -space-x-2">
                  {event.involved.slice(0, 8).map((person) => {
                    const borderColor =
                      person.level === LEVEL_ORGANIZER
                        ? 'border-[#1C2E4A]/60'
                        : person.level === LEVEL_CO_ORGANIZER
                        ? 'border-[#456086]/60'
                        : 'border-white';
                    return (
                      <img
                        key={person.id}
                        src={getAvatarUrl(person) || undefined}
                        alt={person.name}
                        title={`${person.name} · ${
                          person.level === LEVEL_ORGANIZER
                            ? 'Organizador'
                            : person.level === LEVEL_CO_ORGANIZER
                            ? 'Co-organizador'
                            : 'Participante'
                        }${person.isCreator ? ' (criador)' : ''}`}
                        className={`size-8 rounded-full border-2 object-cover ${borderColor}`}
                      />
                    );
                  })}
                  {event.involved.length > 8 && (
                    <span
                      className={`flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-black ${
                        isPast ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      +{event.involved.length - 8}
                    </span>
                  )}
                </div>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setInvolvedOpen((prev) => !prev)}
                    title="Ver a relação dos envolvidos"
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-all ${
                      isPast
                        ? 'bg-emerald-50/60 text-emerald-600/70 hover:bg-emerald-100/70'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    } ${involvedOpen ? 'ring-2 ring-emerald-300/60' : ''}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">groups</span>
                    {event.confirmedCount} envolvidos
                    <span
                      className={`material-symbols-outlined text-[14px] transition-transform duration-300 ${
                        involvedOpen ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </button>

                  {involvedOpen && (
                    <>
                      {/* Camada para fechar ao clicar fora */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setInvolvedOpen(false)}
                      />
                      <div className="absolute bottom-full right-0 z-40 mb-2 w-72 origin-bottom-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Envolvidos
                            </p>
                            <p className="truncate text-[11px] font-semibold text-slate-400" title={event.title}>
                              {event.title}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            {event.involved.length}
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto p-1.5">
                          {event.involved.length === 0 ? (
                            <p className="px-2 py-4 text-center text-[11px] font-medium text-slate-400">
                              Sem envolvidos registrados
                            </p>
                          ) : (
                            [...event.involved]
                              .sort((a, b) => levelMeta(a.level).rank - levelMeta(b.level).rank)
                              .map((person) => {
                                const meta = levelMeta(person.level);
                                return (
                                  <div
                                    key={person.id}
                                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50"
                                  >
                                    <img
                                      src={getAvatarUrl(person) || undefined}
                                      alt={person.name}
                                      className="size-7 shrink-0 rounded-full border-2 border-white object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-slate-700">
                                        {person.name}
                                      </p>
                                      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                        <span className={meta.text}>{meta.label}</span>
                                        {person.isCreator && ' · criador'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {event.pendingCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${
                      isPast ? 'bg-amber-50/60 text-amber-600/70' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">pending</span>
                    {event.pendingCount} pendentes
                  </span>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Contagem regressiva em destaque */}
          {countdown && (
            <div
              className={`flex w-full flex-row items-center justify-center gap-2 rounded-2xl px-3 py-2 sm:w-auto sm:min-w-[96px] sm:flex-col sm:gap-0 sm:py-3 ${countdown.box} ${countdown.pulse}`}
              title={isPast ? `Realizado há ${countdown.value} dias` : `${countdown.value} dias restantes`}
            >
              <span className={`text-3xl font-black leading-none tracking-tight sm:text-4xl ${countdown.num}`}>
                {countdown.value}
              </span>
              <span className="mt-0 text-[9px] font-black uppercase tracking-[0.15em] opacity-90 sm:mt-1">
                {countdown.label}
              </span>
              {!isPast && (
                <span className="mt-0 text-center text-[8px] font-bold uppercase leading-tight tracking-wide opacity-70 sm:mt-0.5">
                  para o evento
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const DapsCadence: React.FC<Props> = ({ events, stats }) => {
  const nextId = stats.nextEvent?.id;
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const nowMs = Date.now();

    const up = events.filter((e) => {
      const t = e.dateStart ? new Date(e.dateStart).getTime() : NaN;
      return !isNaN(t) && t >= nowMs;
    });

    const pa = events.filter((e) => {
      const t = e.dateStart ? new Date(e.dateStart).getTime() : NaN;
      return isNaN(t) || t < nowMs;
    }).sort((a, b) => new Date(b.dateStart || 0).getTime() - new Date(a.dateStart || 0).getTime());

    return { upcoming: up, past: pa };
  }, [events]);

  // Leitura qualitativa da cadência: ritmo médio + regularidade dos intervalos.
  const insights = useMemo(() => {
    const gaps = events
      .map((e) => e.gapBefore)
      .filter((g): g is number => g !== null && !isNaN(g));

    const mean = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
    const sd =
      gaps.length > 1 && mean !== null
        ? Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length)
        : null;
    const cv = mean && sd !== null ? sd / mean : null;

    const avg = stats.avgGapDays;
    const pace =
      avg === null
        ? null
        : avg <= 7
        ? { label: 'Ritmo semanal', icon: 'bolt', tone: 'emerald' }
        : avg <= 15
        ? { label: 'Ritmo quinzenal', icon: 'speed', tone: 'steel' }
        : avg <= 45
        ? { label: 'Ritmo mensal', icon: 'calendar_month', tone: 'sky' }
        : { label: 'Ritmo espaçado', icon: 'hourglass_top', tone: 'slate' };

    const regularity =
      cv === null
        ? null
        : cv <= 0.3
        ? { label: 'Cadência regular', icon: 'equalizer', tone: 'emerald' }
        : cv <= 0.7
        ? { label: 'Cadência moderada', icon: 'ssid_chart', tone: 'steel' }
        : { label: 'Cadência irregular', icon: 'waves', tone: 'amber' };

    return { pace, regularity };
  }, [events, stats.avgGapDays]);

  const tone = (t: string) => TONE[t] || TONE.slate;

  return (
    <section className="p-5 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center size-10 rounded-xl bg-[#1C2E4A]/10 text-[#1C2E4A]">
            <span className="material-symbols-outlined text-[22px]">timeline</span>
          </span>
          <div>
            <h3 className="text-base font-black uppercase tracking-widest text-slate-700">
              Eventos DAPS
            </h3>
            <p className="text-xs font-medium text-slate-400">
              Quanto tempo separa um evento DAPS do outro
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stats.avgGapDays !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[15px] text-[#7C97BB]">schedule</span>
              média {stats.avgGapDays}d
            </span>
          )}
          {stats.shortestGap && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[15px] text-emerald-500">compress</span>
              menor {stats.shortestGap.days}d
            </span>
          )}
          {stats.longestGap && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[15px] text-[#456086]">expand</span>
              maior {stats.longestGap.days}d
            </span>
          )}
          {insights.pace && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${tone(insights.pace.tone).chip}`}
            >
              <span className={`material-symbols-outlined text-[15px] ${tone(insights.pace.tone).icon}`}>
                {insights.pace.icon}
              </span>
              {insights.pace.label}
            </span>
          )}
          {insights.regularity && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${tone(insights.regularity.tone).chip}`}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${tone(insights.regularity.tone).icon}`}
              >
                {insights.regularity.icon}
              </span>
              {insights.regularity.label}
            </span>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <span className="material-symbols-outlined text-[32px] text-slate-300">timeline</span>
          <p className="text-sm font-semibold text-slate-400">Nenhum evento DAPS registrado</p>
          <p className="text-[11px] text-slate-400">
            Crie um evento com tipo ou natureza "EVENTO DAPS" para começar a acompanhar a cadência.
          </p>
        </div>
      ) : (
        <>
          {/* Trilha ativa — eventos futuros */}
          <div className="relative mt-5">
            <span className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#7C97BB]/50 via-[#456086]/50 to-[#1C2E4A]/40" />
            <div className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="relative pl-10">
                  <span className="absolute left-[5px] top-4 size-5 rounded-full border-2 border-slate-200 bg-white z-10" />
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Nenhum evento DAPS programado
                    </p>
                  </div>
                </div>
              ) : (
                upcoming.map((event, index) => (
                  <React.Fragment key={event.id}>
                    {index > 0 && <GapRow days={event.gapBefore} />}
                    <EventRow event={event} isNext={event.id === nextId} />
                  </React.Fragment>
                ))
              )}
            </div>
          </div>

          {/* Arquivo — eventos passados */}
          {past.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setArchiveOpen((prev) => !prev)}
                className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 transition-all hover:border-slate-300 hover:bg-slate-100/50"
              >
                <span className="flex items-center justify-center size-8 rounded-lg bg-slate-200 text-slate-400 group-hover:bg-slate-300 group-hover:text-slate-500 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">history</span>
                </span>
                <div className="flex-1 text-left">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                    Histórico de cadência
                  </p>
                  <p className="text-[11px] font-medium text-slate-300 group-hover:text-slate-400 transition-colors">
                    {past.length} {past.length === 1 ? 'evento já realizado' : 'eventos já realizados'}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-500 transition-colors">
                  {archiveOpen ? 'Ocultar' : 'Ver'}
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${
                      archiveOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </span>
              </button>

              {archiveOpen && (
                <div className="relative mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <span className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-slate-200 to-slate-100" />
                  <div className="space-y-2">
                    {past.map((event, index) => (
                      <React.Fragment key={event.id}>
                        {index > 0 && <GapRow days={event.gapBefore} />}
                        <EventRow event={event} isNext={false} isPast />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
