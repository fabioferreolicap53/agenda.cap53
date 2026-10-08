import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DapsEvent } from '../../hooks/useDapsEvents';
import { RESPONSIBILITY_LEVELS } from '../../lib/constants';

const MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Dias que um evento ocupa dentro do mês, com flag de continuidade. */
interface DayEntry {
  event: DapsEvent;
  continued: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/** Distribui cada evento (inclusive os de vários dias) nos dias do calendário. */
const buildDayMap = (events: DapsEvent[]): Map<string, DayEntry[]> => {
  const map = new Map<string, DayEntry[]>();

  events.forEach((event) => {
    const start = parseDate(event.dateStart);
    if (!start) return;

    const end = parseDate(event.dateEnd);
    const lastDay = end && end.getTime() > start.getTime() ? end : start;
    const startKey = dayKey(start);

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const limit = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());

    // Guarda de segurança para datas finais inconsistentes.
    let guard = 0;
    while (cursor.getTime() <= limit.getTime() && guard < 366) {
      const key = dayKey(cursor);
      const list = map.get(key) || [];
      list.push({ event, continued: key !== startKey });
      map.set(key, list);
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
  });

  map.forEach((list) =>
    list.sort(
      (a, b) =>
        (parseDate(a.event.dateStart)?.getTime() || 0) -
        (parseDate(b.event.dateStart)?.getTime() || 0)
    )
  );

  return map;
};

const fromMonthKey = (key: string) => ({
  year: Number(key.slice(0, 4)),
  month: Number(key.slice(5, 7)) - 1,
});

/** Mês inicial: o corrente quando faz parte da série, senão o extremo mais próximo. */
const resolveInitialCursor = (dayMap: Map<string, DayEntry[]>) => {
  const now = new Date();
  const keys = Array.from(dayMap.keys()).map((key) => key.slice(0, 7)).sort();
  if (keys.length === 0) return { year: now.getFullYear(), month: now.getMonth() };

  const currentKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  if (currentKey < keys[0]) return fromMonthKey(keys[0]);
  if (currentKey > keys[keys.length - 1]) return fromMonthKey(keys[keys.length - 1]);
  return { year: now.getFullYear(), month: now.getMonth() };
};

const CalendarStyles: React.FC = () => (
  <style>{`
    @keyframes dapsCalIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .daps-cal-grid { animation: dapsCalIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .daps-cal-grid { animation-duration: 1ms; }
    }
  `}</style>
);

interface HoverState {
  event: DapsEvent;
  x: number;
  y: number;
  height: number;
}

const formatTime = (value?: string) => {
  const date = parseDate(value);
  return date
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
};

/** Tooltip rico de hover, no mesmo padrão visual do calendário geral. */
const DapsEventTooltip: React.FC<{ data: HoverState | null }> = ({ data }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isRendered, setIsRendered] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [event, setEvent] = useState<DapsEvent | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, height: 0 });

  // Mantém o conteúdo enquanto o tooltip desaparece (fade-out).
  useEffect(() => {
    if (data) {
      setEvent(data.event);
      setAnchor({ x: data.x, y: data.y, height: data.height });
      setIsRendered(true);
      const timer = setTimeout(() => setOpacity(1), 10);
      return () => clearTimeout(timer);
    }

    setOpacity(0);
    const timer = setTimeout(() => {
      setIsRendered(false);
      setEvent(null);
    }, 180);
    return () => clearTimeout(timer);
  }, [data]);

  useLayoutEffect(() => {
    if (!isRendered || !tooltipRef.current || !event) return;

    const rect = tooltipRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let left = anchor.x - rect.width / 2;
    let top = anchor.y - rect.height - 10;

    // Limites seguros para não invadir as sidebars em telas grandes.
    let minLeft = 10;
    let maxRight = windowWidth - 10;
    if (windowWidth >= 1024) {
      minLeft = 256 + 10;
      maxRight = windowWidth - 288 - 10;
    }

    if (left < minLeft) left = minLeft;
    else if (left + rect.width > maxRight) left = maxRight - rect.width;

    if (top < 10) {
      top = anchor.y + anchor.height + 10;
      if (top + rect.height > windowHeight - 10) {
        top = Math.max(10, windowHeight - rect.height - 10);
      }
    }

    setPosition({ top: top + scrollY, left: left + scrollX });
  }, [isRendered, event, anchor]);

  if (!isRendered || !event) return null;

  // Sem tooltip em telas pequenas (mesmo comportamento do calendário geral).
  if (typeof window !== 'undefined' && window.innerWidth < 1024) return null;

  const start = parseDate(event.dateStart);
  const end = parseDate(event.dateEnd);
  const hasRange = !!start && !!end && end.getTime() !== start.getTime();
  const responsibility = RESPONSIBILITY_LEVELS.find(
    (level) => level.value === event.responsibility
  );
  const creatorInitial = (event.creatorName || 'D')[0].toUpperCase();
  const roles = [
    { label: 'organizadores', count: event.organizerCount },
    { label: 'co-organizadores', count: event.coOrganizerCount },
    { label: 'participantes', count: event.participantCount },
  ].filter((role) => role.count > 0);

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        opacity,
        transform: `scale(${0.95 + opacity * 0.05}) translateY(${(1 - opacity) * 10}px)`,
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
      }}
      className="pointer-events-none absolute z-[10000] w-[280px] overflow-hidden rounded-2xl border border-gray-100/50 bg-white/95 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md"
    >
      <div className="space-y-3 p-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1">
              <div className="flex size-5 items-center justify-center rounded-full border border-primary/15 bg-primary/5 text-primary">
                <span className="material-symbols-outlined text-[12px] font-bold">campaign</span>
              </div>
              <h4 className="text-[13px] font-black uppercase leading-tight text-primary">
                {event.title}
              </h4>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary/60">
                Evento DAPS
              </span>
            </div>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/5 text-xs font-black text-primary shadow-sm">
            {creatorInitial}
          </div>
        </div>

        {/* Autor */}
        <div className="flex items-center gap-2 px-1 pb-1">
          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
            <span className="material-symbols-outlined text-[14px] text-primary/60">person</span>
            <span>Criado por:</span>
          </div>
          <span className="truncate text-[10px] font-bold text-text-main">
            {event.creatorName || 'Usuário Desconhecido'}
          </span>
        </div>

        {/* Data e horário */}
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/5 bg-primary/[0.03] px-3 py-2">
          <span className="material-symbols-outlined text-lg text-primary opacity-70">schedule</span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold text-text-main">
              {hasRange
                ? `De ${formatTime(event.dateStart)} às ${formatTime(event.dateEnd)}`
                : `A partir das ${formatTime(event.dateStart)}`}
            </span>
            <span className="text-[10px] font-medium capitalize text-text-secondary">
              {start
                ? start.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Data não definida'}
            </span>
          </div>
        </div>

        {/* Informações essenciais */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 px-1">
            <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
            <span className="truncate text-[11px] font-bold text-text-main">{event.location}</span>
          </div>

          {responsibility && (
            <div className="flex flex-col gap-0.5 px-1">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base text-slate-400">
                  {event.responsibility?.includes('EXTERNO') ? 'public' : 'domain'}
                </span>
                <span className="truncate text-[11px] font-bold text-text-main">
                  {responsibility.label}
                </span>
              </div>
              <span className="pl-7 text-[9px] leading-tight text-slate-400">
                {responsibility.description}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2.5 px-1">
            <span className="material-symbols-outlined text-base text-slate-400">groups</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-text-main">
                {event.confirmedCount} {event.confirmedCount === 1 ? 'Presença Confirmada' : 'Presenças Confirmadas'}
              </span>
              {!!event.estimatedParticipants && event.estimatedParticipants > 0 && (
                <div className="mt-1 flex w-fit items-center gap-1 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                  <span className="material-symbols-outlined text-[12px] opacity-70">groups</span>
                  <span>Est. {event.estimatedParticipants} pessoas</span>
                </div>
              )}
              {roles.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  {roles.map((role) => (
                    <span
                      key={role.label}
                      className="whitespace-nowrap text-[9px] font-medium text-text-secondary"
                    >
                      {role.count} {role.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indicadores */}
        {event.pendingCount > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <div className="flex items-center gap-1 rounded-full border-2 border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-yellow-700">
              <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
              {event.pendingCount} pendente{event.pendingCount === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

interface Props {
  events: DapsEvent[];
  onSelectEvent?: (event: DapsEvent) => void;
}

/**
 * Calendário mensal dos eventos DAPS, com paginação por mês.
 * Compartilha a linha com o gráfico "Levantamento por competência".
 */
export const DapsCalendar: React.FC<Props> = ({ events, onSelectEvent }) => {
  const dayMap = useMemo(() => buildDayMap(events), [events]);
  const [cursor, setCursor] = useState(() => resolveInitialCursor(dayMap));
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<number | null>(null);

  // Tooltip após 600ms de permanência, igual ao calendário geral.
  const showTooltip = (element: HTMLElement, event: DapsEvent) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    const rect = element.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => {
      setHover({
        event,
        x: rect.left + rect.width / 2,
        y: rect.top,
        height: rect.height,
      });
    }, 600);
  };

  const hideTooltip = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHover(null);
  };

  useEffect(
    () => () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    },
    []
  );

  const today = new Date();
  const todayKey = dayKey(today);

  const monthLabel = `${MONTHS_FULL[cursor.month]} ${cursor.year}`;

  const shiftMonth = (delta: number) => {
    hideTooltip();
    setCursor((prev) => {
      const shifted = new Date(prev.year, prev.month + delta, 1);
      return { year: shifted.getFullYear(), month: shifted.getMonth() };
    });
  };

  const goToToday = () => {
    hideTooltip();
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const isCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  // Grade do mês corrente
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const rows = totalCells / 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const date = new Date(cursor.year, cursor.month, dayNumber);
    const key = dayKey(date);
    return {
      index,
      dayNumber,
      inMonth,
      isToday: inMonth && key === todayKey,
      entries: inMonth ? dayMap.get(key) || [] : [],
    };
  });

  const monthSummary = useMemo(() => {
    const unique = new Map<string, DapsEvent>();
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
    dayMap.forEach((list, key) => {
      if (!key.startsWith(prefix)) return;
      list.forEach(({ event }) => unique.set(event.id, event));
    });
    const list = Array.from(unique.values());
    return {
      events: list.length,
      involved: list.reduce((sum, event) => sum + event.involved.length, 0),
    };
  }, [dayMap, cursor.year, cursor.month]);

  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl border border-[#1C2E4A]/10 bg-white p-5 md:p-6 shadow-sm">
      <CalendarStyles />
      <div className="absolute -top-24 -left-24 size-56 rounded-full bg-[#1C2E4A]/8 blur-3xl" />

      {/* Cabeçalho + paginação */}
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-2xl bg-[#1C2E4A]/10 text-[#1C2E4A]">
            <span className="material-symbols-outlined text-[22px]">calendar_month</span>
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-black uppercase tracking-widest text-slate-700">
              Calendário DAPS
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Eventos do mês, com paginação por competência
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#1C2E4A]/12 bg-gradient-to-r from-[#1C2E4A]/5 via-white to-[#7C97BB]/10 px-2 py-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex size-8 items-center justify-center rounded-xl text-[#456086] transition-colors hover:bg-[#1C2E4A]/10 hover:text-[#1C2E4A]"
            title="Mês anterior"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>

          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span className="truncate text-[13px] font-black tracking-tight text-[#1C2E4A]">
              {monthLabel}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {monthSummary.events} {monthSummary.events === 1 ? 'evento' : 'eventos'} •{' '}
              {monthSummary.involved} envolvidos
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-[#1C2E4A]/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#1C2E4A] transition-colors hover:bg-[#1C2E4A] hover:text-white"
                title="Voltar ao mês atual"
              >
                Hoje
              </button>
            )}
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex size-8 items-center justify-center rounded-xl text-[#456086] transition-colors hover:bg-[#1C2E4A]/10 hover:text-[#1C2E4A]"
              title="Próximo mês"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grade do calendário */}
      <div
        key={monthLabel}
        className="daps-cal-grid relative mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100"
      >
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
          {WEEKDAYS.map((label) => (
            <span
              key={label}
              className="py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              {label}
            </span>
          ))}
        </div>

        <div
          className="grid flex-1 min-h-[260px]"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.index}
              className={`relative flex min-h-[42px] flex-col gap-1 border-b border-r border-slate-100 p-1.5 last:border-r-0 ${
                cell.isToday
                  ? 'bg-[#1C2E4A]/6 ring-1 ring-inset ring-[#1C2E4A]/25'
                  : cell.entries.length > 0
                  ? 'bg-gradient-to-br from-[#34D399]/40 via-[#10B981]/32 to-[#047857]/28'
                  : cell.inMonth
                  ? 'bg-white'
                  : 'bg-slate-50/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-black ${
                    cell.isToday
                      ? 'text-[#1C2E4A]'
                      : cell.inMonth
                      ? 'text-slate-500'
                      : 'text-slate-300'
                  }`}
                >
                  {cell.dayNumber > 0 && cell.dayNumber <= daysInMonth ? cell.dayNumber : ''}
                </span>
                {cell.isToday && (
                  <span className="rounded-full bg-[#1C2E4A] px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider text-white">
                    hoje
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-[3px] overflow-hidden">
                {cell.entries.slice(0, 2).map(({ event, continued }) => (
                  <button
                    key={`${event.id}-${cell.index}`}
                    type="button"
                    onClick={() => {
                      hideTooltip();
                      onSelectEvent?.(event);
                    }}
                    onMouseEnter={(e) => showTooltip(e.currentTarget, event)}
                    onMouseLeave={hideTooltip}
                    onFocus={(e) => showTooltip(e.currentTarget, event)}
                    onBlur={hideTooltip}
                    className={`block w-full truncate rounded-[6px] px-1.5 py-[2px] text-left text-[9.5px] font-bold leading-tight transition-all hover:scale-[1.03] ${
                      continued
                        ? 'border border-dashed border-[#7C97BB]/70 bg-[#7C97BB]/10 text-[#456086]'
                        : 'bg-gradient-to-br from-[#5B7DAA] via-[#3A5B8C] to-[#1C2E4A] text-white ring-1 ring-inset ring-white/20 shadow-[0_2px_7px_-2px_rgba(28,46,74,0.55)] hover:from-[#7C97BB] hover:to-[#2B466F]'
                    }`}
                  >
                    {!continued && (
                      <span className="mr-1 inline-block size-1.5 rounded-full bg-[#F2C14E] align-middle" />
                    )}
                    {event.title}
                  </button>
                ))}
                {cell.entries.length > 2 && (
                  <span className="pl-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    +{cell.entries.length - 2}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[4px] bg-gradient-to-br from-[#5B7DAA] to-[#1C2E4A]" />
            Evento DAPS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[4px] border border-dashed border-[#7C97BB] bg-[#7C97BB]/20" />
            Continuação
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <span className="material-symbols-outlined text-[15px] text-[#5B7DAA]">ads_click</span>
          Clique no evento para abrir no calendário
        </span>
      </div>

      <DapsEventTooltip data={hover} />
    </section>
  );
};

export default DapsCalendar;
