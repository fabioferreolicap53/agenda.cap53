import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const data = [
  { name: 'Sem 1', value: 30 },
  { name: 'Sem 2', value: 45 },
  { name: 'Sem 3', value: 75 },
  { name: 'Sem 4', value: 90 },
];

const pieData = [
  { name: 'RH', value: 35, color: '#1C2E4A' },
  { name: 'Marketing', value: 25, color: '#456086' },
  { name: 'TI', value: 20, color: '#5B7DAA' },
  { name: 'Ops', value: 20, color: '#7C97BB' },
];

const Reports: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 max-w-[1700px] mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Total de Eventos', value: '142', change: '+12%', icon: 'event_available', color: 'bg-primary' },
          { title: 'Ocupação Média', value: '78%', change: '+5.2%', icon: 'analytics', color: 'bg-primary/80' },
          { title: 'Local Mais Popular', value: 'Auditório Principal', change: 'Últimos 30 dias', icon: 'podium', color: 'bg-primary/60' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-border-light rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className={`p-2 ${kpi.color}/10 rounded-lg text-primary`}>
                <span className="material-symbols-outlined">{kpi.icon}</span>
              </div>
              <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">trending_up</span> {kpi.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-text-secondary text-sm font-medium mb-1">{kpi.title}</p>
              <h3 className="text-text-main text-3xl font-bold truncate">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white border border-border-light rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100/50">
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl font-bold">bar_chart</span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-primary">Histórico de Ocupação</h3>
            </div>
            <button className="text-text-secondary hover:text-primary">
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          </div>
          <div className="p-4 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1C2E4A" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#1C2E4A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#1C2E4A', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="value" stroke="#1C2E4A" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white border border-border-light rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100/50">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl font-bold">pie_chart</span>
            </div>
             <h3 className="text-lg font-bold tracking-tight text-primary">Eventos por Setor</h3>
          </div>
          <div className="p-4 flex flex-col items-center justify-center flex-1">
            <div className="relative size-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-text-secondary text-xs uppercase font-bold">Top Setor</span>
              <span className="text-text-main text-2xl font-bold">RH</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-6">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-sm text-text-secondary">{d.name}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white border border-border-light rounded-xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-4 border-b border-slate-100/50">
          <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl font-bold">location_on</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-primary">Detalhamento dos Locais</h3>
          </div>
          <button className="text-primary text-sm font-bold hover:underline">Ver Todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-border-light">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold text-text-secondary uppercase">Local</th>
                <th className="px-4 py-2 text-[10px] font-bold text-text-secondary uppercase">Eventos</th>
                <th className="px-4 py-2 text-[10px] font-bold text-text-secondary uppercase">Status</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-text-secondary uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {[
                { name: 'Auditório Principal', events: 45, status: 'Ocupado', statusColor: 'red' },
                { name: 'Sala de Reunião A', events: 32, status: 'Disponível', statusColor: 'emerald' },
                { name: 'Polo da Dengue', events: 28, status: 'Disponível', statusColor: 'emerald' },
                { name: 'Sala Criativa B', events: 14, status: 'Disponível', statusColor: 'emerald' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-primary/[0.02] transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-main text-sm flex items-center gap-2">
                    <div className="size-6 rounded bg-primary/5"></div>
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{row.events}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-${row.statusColor}-100 text-${row.statusColor}-800`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="text-text-secondary hover:text-primary">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;