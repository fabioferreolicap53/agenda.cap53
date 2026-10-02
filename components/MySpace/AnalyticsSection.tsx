import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { AnalyticsData } from '../../hooks/useMySpace';

interface AnalyticsSectionProps {
  analytics: AnalyticsData;
}

// Paleta institucional (navy → aço → névoa) + acento âmbar
const COLORS = ['#1C2E4A', '#456086', '#7C97BB', '#F2C14E', '#5B7DAA', '#9AB1D0', '#475569'];

const CARD = 'relative overflow-hidden rounded-3xl border border-[#1C2E4A]/10 bg-gradient-to-br from-white via-white to-[#7C97BB]/[0.07] shadow-[0_16px_40px_-24px_rgba(28,46,74,0.45)] flex flex-col';
const HEAD = 'flex items-start justify-between gap-3 mb-6';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: { name?: string; value?: number };
  color?: string;
  dataKey?: string;
}

// Tooltip customizado — visual navy consistente com a página
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const item: TooltipPayloadItem = payload[0];
  const name = label ?? item.name ?? item.payload?.name ?? '';
  const value = item.value ?? item.payload?.value ?? 0;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1C2E4A]/95 px-3 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#9AB1D0] mb-0.5 truncate max-w-[180px]">
        {name}
      </p>
      <p className="text-sm font-black text-white leading-none">
        {value}
        <span className="text-[10px] font-bold text-[#F2C14E] ml-1">
          {item.dataKey === 'count' ? (item.name === 'Solicitações' ? 'sol.' : 'evt.') : ''}
        </span>
      </p>
    </div>
  );
};

// Cabeçalho padronizado dos cartões
const CardHead: React.FC<{ icon: string; title: string; caption: string; badge?: string; accent?: string }> = ({
  icon, title, caption, badge, accent = 'from-[#1C2E4A] via-[#456086] to-[#7C97BB]'
}) => (
  <div className={HEAD}>
    <div className="flex items-start gap-3 min-w-0">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md shadow-[#1C2E4A]/30`}>
        <span className="material-symbols-outlined text-[19px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-black text-[#1C2E4A] uppercase tracking-wide leading-tight">{title}</h3>
        <p className="text-[11px] text-slate-400 font-medium mt-1 leading-snug">{caption}</p>
      </div>
    </div>
    {badge && (
      <span className="shrink-0 rounded-full border border-[#F2C14E]/40 bg-[#F2C14E]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#8a6d1a]">
        {badge}
      </span>
    )}
  </div>
);

// Estado vazio elegante
const EmptyState: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div className="flex flex-1 min-h-[260px] flex-col items-center justify-center gap-3 text-center px-6">
    <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/70">
      <span className="material-symbols-outlined text-3xl text-slate-300">{icon}</span>
    </span>
    <p className="text-xs font-semibold text-slate-400 max-w-[200px] leading-relaxed">{text}</p>
  </div>
);

// Legenda customizada para pizzas
const renderLegend = (props: any) => {
  const { payload } = props;
  if (!payload) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3">
      {payload.map((entry: any, i: number) => (
        <li key={`lg-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="size-2 rounded-full ring-1 ring-white shadow-sm" style={{ background: entry.color }} />
          <span className="truncate max-w-[110px]">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

// Donut com total central
const CenterLabel: React.FC<{ total: number; caption: string }> = ({ total, caption }) => (
  <text
    x="50%" y="47%" textAnchor="middle"
    className="fill-[#1C2E4A] font-black" style={{ fontSize: 22 }}
  >
    {total}
    <tspan x="50%" y="59%" className="fill-slate-400 font-bold" style={{ fontSize: 9, letterSpacing: '0.12em' }}>
      {caption.toUpperCase()}
    </tspan>
  </text>
);

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ analytics }) => {
  const totalType = analytics.byType.reduce((s, d) => s + d.value, 0);
  const totalNature = analytics.byNature.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Chart 1: Distribuição por Tipo (donut) */}
      <div className={CARD}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1C2E4A] via-[#456086] to-[#7C97BB]" />
        <span aria-hidden className="absolute -right-10 -top-10 size-32 rounded-full bg-[#7C97BB]/15 blur-2xl" />
        <div className="p-6 pb-2">
          <CardHead icon="donut_small" title="Distribuição por Tipo" caption="Como seus eventos estão categorizados" badge={`${totalType} evt.`} />
        </div>

        {analytics.byType.length === 0 ? (
          <EmptyState icon="donut_small" text="Sem dados de tipo para os eventos confirmados." />
        ) : (
          <div className="flex-1 min-h-[300px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.byType}
                  cx="50%"
                  cy="46%"
                  innerRadius={64}
                  outerRadius={94}
                  paddingAngle={4}
                  cornerRadius={6}
                  dataKey="value"
                  stroke="none"
                >
                  {analytics.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <CenterLabel total={totalType} caption="eventos" />
                <Tooltip content={<ChartTooltip />} />
                <Legend content={renderLegend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart 2: Atividade ao longo do tempo (barras) */}
      <div className={CARD}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#F2C14E] via-[#7C97BB] to-[#1C2E4A]" />
        <span aria-hidden className="absolute -left-10 -bottom-10 size-32 rounded-full bg-[#F2C14E]/15 blur-2xl" />
        <div className="p-6 pb-2">
          <CardHead
            icon="bar_chart"
            title="Atividade ao Longo do Tempo"
            caption="Volume de eventos por mês"
            accent="from-[#F2C14E] via-[#d9a93a] to-[#456086]"
          />
        </div>

        {analytics.byTime.length === 0 ? (
          <EmptyState icon="bar_chart" text="Ainda não há eventos para compor a linha do tempo." />
        ) : (
          <div className="flex-1 min-h-[300px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#456086" />
                    <stop offset="100%" stopColor="#1C2E4A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(28,46,74,0.06)' }} />
                <Bar dataKey="count" name="Eventos" fill="url(#barTime)" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart 3: Perfil de responsabilidade (donut) */}
      <div className={CARD}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#9AB1D0] via-[#456086] to-[#1C2E4A]" />
        <span aria-hidden className="absolute -right-10 -bottom-10 size-32 rounded-full bg-[#1C2E4A]/10 blur-2xl" />
        <div className="p-6 pb-2">
          <CardHead
            icon="account_tree"
            title="Perfil de Responsabilidade"
            caption="Natureza da atuação nos eventos"
            badge={`${totalNature} evt.`}
            accent="from-[#456086] via-[#7C97BB] to-[#9AB1D0]"
          />
        </div>

        {analytics.byNature.length === 0 ? (
          <EmptyState icon="account_tree" text="Nenhum evento confirmado com natureza definida." />
        ) : (
          <div className="flex-1 min-h-[300px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.byNature}
                  cx="50%"
                  cy="46%"
                  innerRadius={64}
                  outerRadius={94}
                  paddingAngle={4}
                  cornerRadius={6}
                  dataKey="value"
                  stroke="none"
                >
                  {analytics.byNature.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <CenterLabel total={totalNature} caption="eventos" />
                <Tooltip content={<ChartTooltip />} />
                <Legend content={renderLegend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart 4: Recursos logísticos (barras horizontais ranqueadas) */}
      <div className={CARD}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#7C97BB] via-[#F2C14E] to-[#456086]" />
        <span aria-hidden className="absolute -left-10 -top-10 size-32 rounded-full bg-[#9AB1D0]/20 blur-2xl" />
        <div className="p-6 pb-2">
          <CardHead
            icon="inventory_2"
            title="Recursos Logísticos"
            caption={`${analytics.byResources.length} demandas distintas · líder em destaque`}
            badge={`${analytics.byResources.reduce((s, d) => s + d.count, 0)} req.`}
            accent="from-[#5B7DAA] via-[#7C97BB] to-[#9AB1D0]"
          />
        </div>

        {analytics.byResources.length === 0 ? (
          <EmptyState icon="inventory_2" text="Nenhuma demanda logística registrada até agora." />
        ) : (
          (() => {
            const max = Math.max(...analytics.byResources.map(d => d.count), 1);
            return (
              <div className="flex-1 min-h-[300px] px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.byResources}
                    layout="vertical"
                    margin={{ top: 8, right: 44, left: 8, bottom: 0 }}
                    barCategoryGap={12}
                  >
                    <defs>
                      <linearGradient id="barRes" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1C2E4A" />
                        <stop offset="55%" stopColor="#456086" />
                        <stop offset="100%" stopColor="#7C97BB" />
                      </linearGradient>
                      <linearGradient id="barResTop" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#456086" />
                        <stop offset="55%" stopColor="#E0A93A" />
                        <stop offset="100%" stopColor="#F2C14E" />
                      </linearGradient>
                    </defs>
                    {/* Sem grid: limpo, o trilho das barras já dá a escala */}
                    <XAxis type="number" hide domain={[0, max * 1.12]} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={150}
                      tick={(props: any) => {
                        // recharts: payload é um array de ticks [{ value }]
                        const raw = props?.payload;
                        const item = Array.isArray(raw) ? raw[0] : raw;
                        const label = String(item?.value ?? '');
                        const x = Number.isFinite(props?.x) ? props.x : 150;
                        const y = Number.isFinite(props?.y) ? props.y : 0;
                        const idx = analytics.byResources.findIndex(d => d.name === label);
                        const isTop = idx >= 0 && idx === 0;
                        // Trunca nome longo para não poluir o eixo
                        const short = label.length > 20 ? `${label.slice(0, 19)}…` : label;
                        return (
                          <text x={x - 10} y={y} dy={4} textAnchor="end" style={{ fontSize: 10 }}>
                            {idx >= 0 && (
                              <tspan
                                fill={isTop ? '#F2C14E' : '#cbd5e1'}
                                fontWeight={900}
                                style={{ fontSize: 9 }}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </tspan>
                            )}
                            <tspan
                              dx={6}
                              fill={isTop ? '#1C2E4A' : '#64748b'}
                              fontWeight={isTop ? 900 : 700}
                            >
                              {short}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const pct = Math.round((d.count / max) * 100);
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#1C2E4A]/95 px-3 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[#9AB1D0] mb-0.5 truncate max-w-[180px]">
                              {d.name}
                            </p>
                            <p className="text-sm font-black text-white leading-none">
                              {d.count}
                              <span className="text-[10px] font-bold text-[#F2C14E] ml-1">req.</span>
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{pct}% do pico</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'rgba(28,46,74,0.06)' }}
                    />
                    <Bar
                      dataKey="count"
                      name="Solicitações"
                      radius={[0, 8, 8, 0]}
                      barSize={16}
                      animationDuration={900}
                      background={{ fill: 'rgba(28,46,74,0.05)', radius: [0, 8, 8, 0] }}
                    >
                      {analytics.byResources.map((entry, index) => (
                        <Cell
                          key={`res-${index}`}
                          fill={index === 0 ? 'url(#barResTop)' : 'url(#barRes)'}
                          fillOpacity={index === 0 ? 1 : 0.75 + 0.25 * (entry.count / max)}
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        content={(props: any) => {
                          const rawValue = Array.isArray(props?.value) ? props?.value[0] : props?.value;
                          const v = Number(rawValue);
                          if (!Number.isFinite(v)) return null;
                          const entry = props?.payload ?? {};
                          const idx = Number.isInteger(props?.index)
                            ? props.index
                            : analytics.byResources.findIndex(d => d.name === entry.name);
                          const isTop = idx >= 0 && idx === 0;
                          const x = Number.isFinite(props?.x) ? props.x : 0;
                          const y = Number.isFinite(props?.y) ? props.y : 0;
                          const h = Number.isFinite(props?.height) ? props.height : 16;
                          // Só o valor, uma linha — sem poluição
                          return (
                            <text
                              x={x + 8}
                              y={y + h / 2}
                              dy={4}
                              fill={isTop ? '#1C2E4A' : '#94a3b8'}
                              fontWeight={isTop ? 900 : 700}
                              style={{ fontSize: 11 }}
                            >
                              {v}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
