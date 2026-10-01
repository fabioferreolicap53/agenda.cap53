import React from 'react';
import { DapsStats } from '../../hooks/useDapsEvents';

interface Props {
  stats: DapsStats;
}

// Cartões em rampa institucional (azul corporativo #1C2E4A e derivados), do
// mais escuro ao mais claro, com brilho e acentos mais vivos.
const ACCENT: Record<string, { card: string; chip: string; value: string; line: string; glow: string; pill: string }> = {
  navy: {
    card: 'bg-gradient-to-br from-[#1C2E4A]/14 via-white to-white border-[#1C2E4A]/20',
    chip: 'bg-[#1C2E4A]/12 text-[#1C2E4A] ring-1 ring-inset ring-[#1C2E4A]/20',
    value: 'text-[#1C2E4A]',
    line: 'from-[#F2C14E] via-[#456086] to-[#7C97BB]',
    glow: 'bg-[radial-gradient(circle_at_100%_0%,rgba(242,193,78,0.22),transparent_62%)]',
    pill: 'border-[#F2C14E]/40 bg-[#F2C14E]/15 text-[#8a6d1a]',
  },
  steel: {
    card: 'bg-gradient-to-br from-[#456086]/14 via-white to-white border-[#456086]/20',
    chip: 'bg-[#456086]/14 text-[#456086] ring-1 ring-inset ring-[#456086]/20',
    value: 'text-[#456086]',
    line: 'from-[#456086] via-[#7C97BB] to-[#F2C14E]',
    glow: 'bg-[radial-gradient(circle_at_100%_0%,rgba(69,96,134,0.22),transparent_62%)]',
    pill: 'border-[#456086]/30 bg-[#456086]/10 text-[#456086]',
  },
  mist: {
    card: 'bg-gradient-to-br from-[#9AB1D0]/28 via-white to-white border-[#9AB1D0]/40',
    chip: 'bg-[#9AB1D0]/30 text-[#456086] ring-1 ring-inset ring-[#9AB1D0]/35',
    value: 'text-[#5B7DAA]',
    line: 'from-[#9AB1D0] via-[#7C97BB] to-[#F2C14E]',
    glow: 'bg-[radial-gradient(circle_at_100%_0%,rgba(154,177,208,0.38),transparent_62%)]',
    pill: 'border-[#9AB1D0]/50 bg-[#9AB1D0]/25 text-[#456086]',
  },
  graphite: {
    card: 'bg-gradient-to-br from-[#475569]/14 via-white to-white border-[#475569]/20',
    chip: 'bg-[#475569]/12 text-[#475569] ring-1 ring-inset ring-[#475569]/18',
    value: 'text-[#475569]',
    line: 'from-[#475569] via-[#64748B] to-[#9AB1D0]',
    glow: 'bg-[radial-gradient(circle_at_100%_0%,rgba(71,85,105,0.20),transparent_62%)]',
    pill: 'border-[#475569]/30 bg-[#475569]/10 text-[#475569]',
  },
};

// Micro-métrica do rodapé dos cartões
const MiniStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0 rounded-xl border border-white/70 bg-white/70 px-2 py-1.5">
    <p className="truncate text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-0.5 text-sm font-black leading-none tabular-nums text-[#1C2E4A]">{value}</p>
  </div>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <span className={`size-1.5 rounded-full ${color}`} />
    {label}
  </span>
);

export const DapsKpis: React.FC<Props> = ({ stats }) => {
  const roleTotal = stats.organizerRoles + stats.coOrganizerRoles + stats.participantRoles;
  const rolePct = (value: number) => (roleTotal > 0 ? (value / roleTotal) * 100 : 0);

  const statusTotal = stats.pastEvents + stats.upcomingEvents;
  const pastPct = statusTotal > 0 ? Math.round((stats.pastEvents / statusTotal) * 100) : 0;

  const daysLabel = (value: number) => (value === 1 ? '1 dia' : `${value} dias`);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* 1 · Volume total de eventos DAPS */}
      <div
        title={`${stats.organizerRoles} papéis de organizador · ${stats.coOrganizerRoles} de co-organizador · ${stats.participantRoles} de participante`}
        className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1C2E4A]/10 min-w-0 ${ACCENT.navy.card}`}
      >
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${ACCENT.navy.line}`} />
        <span className={`pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl ${ACCENT.navy.glow}`} />

        <div className="relative flex items-start justify-between gap-2">
          <span className={`flex items-center justify-center size-9 rounded-xl ${ACCENT.navy.chip}`}>
            <span className="material-symbols-outlined text-[20px]">campaign</span>
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ACCENT.navy.pill}`}>
            {roleTotal} papéis
          </span>
        </div>

        <div className="relative mt-3 flex items-baseline flex-wrap gap-1.5">
          <span className={`text-4xl font-black leading-none tracking-tight tabular-nums ${ACCENT.navy.value}`}>
            {stats.totalEvents}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {stats.totalEvents === 1 ? 'evento' : 'eventos'}
          </span>
        </div>

        <p className="relative mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Eventos DAPS
        </p>

        <div className="relative mt-3 space-y-2 border-t border-slate-100/80 pt-2.5">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            {stats.organizerRoles > 0 && (
              <div className="bg-[#1C2E4A] transition-all" style={{ width: `${rolePct(stats.organizerRoles)}%` }} />
            )}
            {stats.coOrganizerRoles > 0 && (
              <div className="bg-[#456086] transition-all" style={{ width: `${rolePct(stats.coOrganizerRoles)}%` }} />
            )}
            {stats.participantRoles > 0 && (
              <div className="bg-[#7C97BB] transition-all" style={{ width: `${rolePct(stats.participantRoles)}%` }} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
            <LegendDot color="bg-[#1C2E4A]" label={`Org. ${stats.organizerRoles}`} />
            <LegendDot color="bg-[#456086]" label={`Co-org. ${stats.coOrganizerRoles}`} />
            <LegendDot color="bg-[#7C97BB]" label={`Part. ${stats.participantRoles}`} />
          </div>
        </div>
      </div>

      {/* 2 · Realizados x a realizar */}
      <div
        title={`${stats.pastEvents} já realizados · ${stats.upcomingEvents} a realizar`}
        className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#456086]/10 min-w-0 ${ACCENT.steel.card}`}
      >
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${ACCENT.steel.line}`} />
        <span className={`pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl ${ACCENT.steel.glow}`} />

        <div className="relative flex items-start justify-between gap-2">
          <span className={`flex items-center justify-center size-9 rounded-xl ${ACCENT.steel.chip}`}>
            <span className="material-symbols-outlined text-[20px]">event_note</span>
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ACCENT.steel.pill}`}>
            {pastPct}% concluídos
          </span>
        </div>

        <div className="relative mt-3 flex items-baseline flex-wrap gap-1.5">
          <span className="text-4xl font-black leading-none tracking-tight tabular-nums text-[#1C2E4A]">
            {stats.pastEvents}
          </span>
          <span className="text-lg font-black leading-none text-slate-300">/</span>
          <span className="text-4xl font-black leading-none tracking-tight tabular-nums text-[#7C97BB]">
            {stats.upcomingEvents}
          </span>
        </div>

        <p className="relative mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Status dos eventos
        </p>

        <div className="relative mt-3 space-y-2 border-t border-slate-100/80 pt-2.5">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="bg-[#1C2E4A] transition-all" style={{ width: `${pastPct}%` }} />
            <div className="bg-[#7C97BB] transition-all" style={{ width: `${100 - pastPct}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
            <LegendDot color="bg-[#1C2E4A]" label={`Realizados ${stats.pastEvents}`} />
            <LegendDot color="bg-[#7C97BB]" label={`A realizar ${stats.upcomingEvents}`} />
          </div>
        </div>
      </div>

      {/* 3 · Média de envolvidos por evento */}
      <div
        title="Média de envolvidos por evento DAPS"
        className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#9AB1D0]/20 min-w-0 ${ACCENT.mist.card}`}
      >
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${ACCENT.mist.line}`} />
        <span className={`pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl ${ACCENT.mist.glow}`} />

        <div className="relative flex items-start justify-between gap-2">
          <span className={`flex items-center justify-center size-9 rounded-xl ${ACCENT.mist.chip}`}>
            <span className="material-symbols-outlined text-[20px]">bar_chart</span>
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ACCENT.mist.pill}`}>
            por evento
          </span>
        </div>

        <div className="relative mt-3 flex items-baseline flex-wrap gap-1.5">
          <span className={`text-4xl font-black leading-none tracking-tight tabular-nums ${ACCENT.mist.value}`}>
            {stats.totalEvents > 0 ? stats.avgInvolved : '—'}
          </span>
          {stats.totalEvents > 0 && (
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">envolvidos</span>
          )}
        </div>

        <p className="relative mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Média por evento
        </p>

        <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-slate-100/80 pt-2.5">
          <MiniStat label="Pessoas distintas" value={stats.totalInvolved} />
          <MiniStat label="Papéis lançados" value={roleTotal} />
        </div>
      </div>

      {/* 4 · Ritmo entre eventos */}
      <div
        title="Distância média entre um evento DAPS e o seguinte"
        className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#475569]/10 min-w-0 ${ACCENT.graphite.card}`}
      >
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${ACCENT.graphite.line}`} />
        <span className={`pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl ${ACCENT.graphite.glow}`} />

        <div className="relative flex items-start justify-between gap-2">
          <span className={`flex items-center justify-center size-9 rounded-xl ${ACCENT.graphite.chip}`}>
            <span className="material-symbols-outlined text-[20px]">schedule</span>
          </span>
          {stats.avgGapDays !== null && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ACCENT.graphite.pill}`}>
              cadência
            </span>
          )}
        </div>

        <div className="relative mt-3 flex items-baseline flex-wrap gap-1.5">
          <span className={`text-4xl font-black leading-none tracking-tight tabular-nums ${ACCENT.graphite.value}`}>
            {stats.avgGapDays === null ? '—' : stats.avgGapDays}
          </span>
          {stats.avgGapDays !== null && (
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">dias</span>
          )}
        </div>

        <p className="relative mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Intervalo médio
        </p>

        <div className="relative mt-3 border-t border-slate-100/80 pt-2.5">
          {stats.shortestGap && stats.longestGap ? (
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Menor" value={daysLabel(stats.shortestGap.days)} />
              <MiniStat label="Maior" value={daysLabel(stats.longestGap.days)} />
            </div>
          ) : (
            <p className="text-[11px] font-medium leading-snug text-slate-500">
              Distância média entre um evento DAPS e o seguinte.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
