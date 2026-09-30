import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DapsEvent } from '../../hooks/useDapsEvents';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Granularity = 'mes' | 'ano';

interface Bucket {
  key: string;
  label: string;
  eventos: number;
  envolvidos: number;
  organizadores: number;
  coOrganizadores: number;
  participantes: number;
}

interface Props {
  events: DapsEvent[];
}

/** Agrupa os eventos DAPS por competência (mês/ano ou ano). */
const buildBuckets = (events: DapsEvent[], granularity: Granularity): Bucket[] => {
  const map = new Map<string, Bucket>();

  events.forEach((event) => {
    if (!event.dateStart) return;
    const date = new Date(event.dateStart);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const key = granularity === 'mes' ? `${year}-${String(month + 1).padStart(2, '0')}` : String(year);
    const label = granularity === 'mes' ? `${MONTHS[month]}/${year}` : String(year);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        eventos: 0,
        envolvidos: 0,
        organizadores: 0,
        coOrganizadores: 0,
        participantes: 0,
      });
    }

    const bucket = map.get(key)!;
    bucket.eventos += 1;
    bucket.envolvidos += event.involved.length;
    bucket.organizadores += event.organizerCount;
    bucket.coOrganizadores += event.coOrganizerCount;
    bucket.participantes += event.participantCount;
  });

  // Preenche as competências sem evento no intervalo, mantendo a leitura
  // contínua da série (meses vazios aparecem como vale).
  if (map.size === 0) return [];

  const years = Array.from(new Set(Array.from(map.keys()).map((k) => Number(k.slice(0, 4))))).sort(
    (a, b) => a - b
  );
  const first = years[0];
  const last = years[years.length - 1];

  const filled: Bucket[] = [];
  if (granularity === 'mes') {
    for (let y = first; y <= last; y++) {
      for (let m = 0; m < 12; m++) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        filled.push(
          map.get(key) || {
            key,
            label: `${MONTHS[m]}/${y}`,
            eventos: 0,
            envolvidos: 0,
            organizadores: 0,
            coOrganizadores: 0,
            participantes: 0,
          }
        );
      }
    }
  } else {
    for (let y = first; y <= last; y++) {
      const key = String(y);
      filled.push(
        map.get(key) || {
          key,
          label: String(y),
          eventos: 0,
          envolvidos: 0,
          organizadores: 0,
          coOrganizadores: 0,
          participantes: 0,
        }
      );
    }
  }

  return filled;
};

const ChartTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const bucket: Bucket = payload[0].payload;
  const rows = [
    { label: 'Eventos', value: bucket.eventos, color: '#1C2E4A' },
    { label: 'Envolvidos', value: bucket.envolvidos, color: '#456086' },
    { label: 'Organizadores', value: bucket.organizadores, color: '#1C2E4A' },
    { label: 'Co-organizadores', value: bucket.coOrganizadores, color: '#456086' },
    { label: 'Participantes', value: bucket.participantes, color: '#7C97BB' },
  ];

  return (
    <div className="rounded-xl border border-[#1C2E4A]/15 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#1C2E4A]">
        {bucket.label}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <p key={row.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: row.color }} />
            {row.label}
            <span className="ml-auto pl-3 font-black text-[#1C2E4A]">{row.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

export const DapsCompetencia: React.FC<Props> = ({ events }) => {
  const [granularity, setGranularity] = useState<Granularity>('mes');
  const [year, setYear] = useState<number | null>(null);

  const monthly = useMemo(() => buildBuckets(events, 'mes'), [events]);
  const yearly = useMemo(() => buildBuckets(events, 'ano'), [events]);

  const years = useMemo(
    () => Array.from(new Set(monthly.map((b) => Number(b.key.slice(0, 4))))).sort((a, b) => a - b),
    [monthly]
  );

  useEffect(() => {
    if (years.length === 0) return;
    if (year !== null && (year < years[0] || year > years[years.length - 1])) setYear(null);
  }, [years, year]);

  // Ano efetivo da paginação: usa o selecionado quando válido, senão o padrão
  // (ano corrente, se houver eventos; caso contrário o último ano com dados).
  const currentYear = new Date().getFullYear();
  const activeYear =
    year !== null && years.includes(year)
      ? year
      : years.length === 0
      ? null
      : years.includes(currentYear)
      ? currentYear
      : years[years.length - 1];

  const data =
    granularity === 'mes'
      ? monthly.filter((b) => b.key.startsWith(`${activeYear}-`))
      : yearly;

  const summary = useMemo(() => {
    const active = data.filter((b) => b.eventos > 0);
    const totalEvents = data.reduce((sum, b) => sum + b.eventos, 0);
    const totalInvolved = data.reduce((sum, b) => sum + b.envolvidos, 0);
    const peak = active.reduce<Bucket | null>(
      (max, b) => (!max || b.eventos > max.eventos ? b : max),
      null
    );
    return {
      active: active.length,
      totalEvents,
      totalInvolved,
      avg: active.length ? Math.round((totalEvents / active.length) * 10) / 10 : 0,
      peak,
    };
  }, [data]);

  const isEmpty = events.length === 0;
  const yearIndex = activeYear === null ? -1 : years.indexOf(activeYear);

  const granularityOptions: { value: Granularity; label: string; icon: string }[] = [
    { value: 'mes', label: 'Mensal', icon: 'calendar_view_month' },
    { value: 'ano', label: 'Anual', icon: 'calendar_today' },
  ];

  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl border border-[#1C2E4A]/10 bg-white p-5 md:p-6 shadow-sm">
      <div className="absolute -top-24 -right-24 size-56 rounded-full bg-[#7C97BB]/10 blur-3xl" />

      {/* Cabeçalho + controles */}
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-2xl bg-[#1C2E4A]/10 text-[#1C2E4A]">
            <span className="material-symbols-outlined text-[22px]">insights</span>
          </span>
          <div>
            <h3 className="text-base font-black uppercase tracking-widest text-slate-700">
              Eventos DAPS por mês
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Distribuição dos eventos DAPS por mês/ano, com o volume de envolvidos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Alternância de paginação por competência */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1">
            {granularityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setGranularity(option.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${
                  granularity === option.value
                    ? 'bg-[#1C2E4A] text-white shadow-sm'
                    : 'text-slate-500 hover:text-[#1C2E4A]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>

          {/* Paginação por ano (competências de 12 meses) */}
          {granularity === 'mes' && years.length > 0 && (
            <div className="flex items-center gap-1 rounded-xl border border-[#1C2E4A]/12 bg-white px-1 py-1">
              <button
                onClick={() => setYear(years[Math.max(0, yearIndex - 1)])}
                disabled={yearIndex <= 0}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#1C2E4A]/8 hover:text-[#1C2E4A] disabled:opacity-30 disabled:hover:bg-transparent"
                title="Ano anterior"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="min-w-[52px] text-center text-[12px] font-black text-[#1C2E4A]">
                {activeYear ?? '—'}
              </span>
              <button
                onClick={() => setYear(years[Math.min(years.length - 1, yearIndex + 1)])}
                disabled={yearIndex < 0 || yearIndex >= years.length - 1}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#1C2E4A]/8 hover:text-[#1C2E4A] disabled:opacity-30 disabled:hover:bg-transparent"
                title="Próximo ano"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico — cresce para acompanhar a linha do calendário ao lado */}
      <div className="relative mt-5 flex-1 min-h-[280px]">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
            <span className="material-symbols-outlined text-[34px]">bar_chart</span>
            <p className="text-xs font-bold text-slate-400">Sem eventos DAPS para analisar</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dapsCompetenciaBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#456086" />
                  <stop offset="55%" stopColor="#1C2E4A" />
                  <stop offset="100%" stopColor="#16243A" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#7C97BB' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(28,46,74,0.05)' }} />
              <Bar
                yAxisId="left"
                dataKey="eventos"
                name="Eventos"
                fill="url(#dapsCompetenciaBar)"
                radius={[6, 6, 0, 0]}
                maxBarSize={46}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="envolvidos"
                name="Envolvidos"
                stroke="#7C97BB"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#fff', stroke: '#5B7DAA', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#1C2E4A', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legenda + resumo estatístico */}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-gradient-to-b from-[#456086] to-[#1C2E4A]" />
            Eventos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-[#7C97BB]" />
            Envolvidos
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            {summary.active} {granularity === 'mes' ? 'meses ativos' : 'anos ativos'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-[#5B7DAA]">calculate</span>
            média {summary.avg} / {granularity === 'mes' ? 'mês' : 'ano'}
          </span>
          {summary.peak && (
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-[#1C2E4A]">
                emoji_events
              </span>
              pico em <span className="text-[#1C2E4A]">{summary.peak.label}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
