import React from 'react';
import { DapsStats } from '../../hooks/useDapsEvents';

interface Props {
  stats: DapsStats;
}

// Cartões em rampa institucional (azul corporativo #1C2E4A e derivados), do
// mais escuro ao mais claro, com o âmbar reservado para urgência.
const ACCENT: Record<string, { card: string; chip: string; value: string }> = {
  navy: {
    card: 'bg-gradient-to-br from-[#1C2E4A]/10 via-white to-white border-[#1C2E4A]/15',
    chip: 'bg-[#1C2E4A]/10 text-[#1C2E4A]',
    value: 'text-[#1C2E4A]',
  },
  steel: {
    card: 'bg-gradient-to-br from-[#456086]/10 via-white to-white border-[#456086]/15',
    chip: 'bg-[#456086]/12 text-[#456086]',
    value: 'text-[#456086]',
  },
  sky: {
    card: 'bg-gradient-to-br from-[#7C97BB]/20 via-white to-white border-[#7C97BB]/25',
    chip: 'bg-[#7C97BB]/20 text-[#456086]',
    value: 'text-[#456086]',
  },
  mist: {
    card: 'bg-gradient-to-br from-[#9AB1D0]/20 via-white to-white border-[#9AB1D0]/30',
    chip: 'bg-[#9AB1D0]/25 text-[#456086]',
    value: 'text-[#5B7DAA]',
  },
  graphite: {
    card: 'bg-gradient-to-br from-[#475569]/10 via-white to-white border-[#475569]/15',
    chip: 'bg-[#475569]/10 text-[#475569]',
    value: 'text-[#475569]',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50 to-white border-amber-100',
    chip: 'bg-amber-100 text-amber-600',
    value: 'text-amber-700',
  },
};

interface KpiCard {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  accent: string;
  hint: string;
  split?: { past: number; upcoming: number };
}

export const DapsKpis: React.FC<Props> = ({ stats }) => {
  const cards: KpiCard[] = [
    {
      label: 'Eventos DAPS',
      value: String(stats.totalEvents),
      icon: 'campaign',
      accent: 'navy',
      hint: `${stats.organizerRoles} papéis de organizador · ${stats.coOrganizerRoles} de co-organizador · ${stats.participantRoles} de participante`,
    },
    {
      label: 'Status dos eventos',
      value: String(stats.pastEvents),
      icon: 'event_note',
      accent: 'steel',
      hint: `${stats.pastEvents} já realizados · ${stats.upcomingEvents} a realizar`,
      split: { past: stats.pastEvents, upcoming: stats.upcomingEvents },
    },
    {
      label: 'Envolvidos únicos',
      value: String(stats.totalInvolved),
      icon: 'groups',
      accent: 'sky',
      hint: 'Pessoas distintas que já participaram de algum evento DAPS',
    },
    {
      label: 'Média por evento',
      value: String(stats.avgInvolved),
      icon: 'bar_chart',
      accent: 'mist',
      hint: 'Média de envolvidos por evento DAPS',
    },
    {
      label: 'Intervalo médio',
      value: stats.avgGapDays === null ? '—' : String(stats.avgGapDays),
      suffix: stats.avgGapDays === null ? '' : 'dias',
      icon: 'schedule',
      accent: 'graphite',
      hint: 'Distância média entre um evento DAPS e o seguinte',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
      {cards.map((card) => {
        const accent = ACCENT[card.accent];
        const split = card.split;
        const total = split ? split.past + split.upcoming : 0;
        const pastPct = total > 0 ? Math.round((split!.past / total) * 100) : 0;
        return (
          <div
            key={card.label}
            title={card.hint}
            className={`rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md min-w-0 ${accent.card}`}
          >
            <div className={`flex items-center justify-center size-9 rounded-xl ${accent.chip}`}>
              <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
            </div>

            <div className="mt-3 flex items-baseline flex-wrap gap-1.5">
              {split ? (
                <>
                  <span className="text-3xl font-black tracking-tight leading-none text-[#1C2E4A]">
                    {split.past}
                  </span>
                  <span className="text-lg font-black leading-none text-slate-300">/</span>
                  <span className="text-3xl font-black tracking-tight leading-none text-[#7C97BB]">
                    {split.upcoming}
                  </span>
                </>
              ) : (
                <>
                  <span className={`text-3xl font-black tracking-tight leading-none ${accent.value}`}>
                    {card.value}
                  </span>
                  {card.suffix && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {card.suffix}
                    </span>
                  )}
                </>
              )}
            </div>

            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {card.label}
            </p>

            {split ? (
              total > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-[#1C2E4A] transition-all" style={{ width: `${pastPct}%` }} />
                    <div
                      className="bg-[#7C97BB] transition-all"
                      style={{ width: `${100 - pastPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="size-1.5 rounded-full bg-[#1C2E4A]" />
                      Realizados
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="size-1.5 rounded-full bg-[#7C97BB]" />
                      A realizar
                    </span>
                  </div>
                </div>
              )
            ) : (
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-500 line-clamp-2">
                {card.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
