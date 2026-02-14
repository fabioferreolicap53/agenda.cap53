import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { useReports } from '../hooks/useReports';

const Reports: React.FC = () => {
  const { loading, stats, filters, setFilters, occupancyHistory, eventsBySector, locationDetails, natures, refresh } = useReports();

  if (loading && !stats.totalEvents) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Gerando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-[1700px] mx-auto p-4 md:p-6 animate-in fade-in duration-700">
      
      {/* Header with Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm ml-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="material-symbols-outlined text-slate-400 text-sm">calendar_month</span>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0"
            />
            <span className="text-slate-300">|</span>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0"
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="material-symbols-outlined text-slate-400 text-sm">category</span>
            <select 
              value={filters.nature}
              onChange={(e) => setFilters({ ...filters, nature: e.target.value })}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0 pr-8"
            >
              {natures.map(n => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => refresh()}
            disabled={loading}
            className={`p-2.5 rounded-2xl transition-all border border-transparent shadow-sm ${
              loading 
                ? 'bg-slate-50 text-slate-300' 
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:shadow-md'
            }`}
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { 
            title: 'Total de Eventos', 
            value: stats.totalEvents, 
            change: stats.totalGrowth, 
            icon: 'event_available', 
            color: 'bg-blue-600',
            label: 'Crescimento mensal'
          },
          { 
            title: 'Taxa de Confirmação', 
            value: `${stats.averageOccupancy}%`, 
            change: 'Status Geral', 
            icon: 'analytics', 
            color: 'bg-indigo-600',
            label: 'Eventos Ativos/Confirmados'
          },
          { 
            title: 'Local Mais Popular', 
            value: stats.popularLocation, 
            change: 'Frequência', 
            icon: 'podium', 
            color: 'bg-emerald-600',
            label: 'Maior número de reservas'
          }
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-[2rem] p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className={`p-3 ${kpi.color} rounded-2xl text-white shadow-lg shadow-${kpi.color.split('-')[1]}-200`}>
                <span className="material-symbols-outlined text-2xl">{kpi.icon}</span>
              </div>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 ${
                kpi.change.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
              }`}>
                {kpi.change.includes('%') && <span className="material-symbols-outlined text-[12px]">trending_up</span>}
                {kpi.change}
              </span>
            </div>
            <div className="mt-6">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{kpi.title}</p>
              <h3 className="text-slate-900 text-3xl font-black truncate leading-tight">{kpi.value}</h3>
              <p className="text-slate-400 text-[10px] font-medium mt-1">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart: Occupancy History */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-8 border-b border-slate-50">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">timeline</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Histórico de Eventos</h3>
                <p className="text-xs text-slate-500 font-medium">Volume de eventos nos últimos 6 meses</p>
              </div>
            </div>
          </div>
          <div className="p-8 h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={occupancyHistory}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  dy={10} 
                />
                <Tooltip
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Chart */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-4 p-8 border-b border-slate-50">
            <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">pie_chart</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Distribuição por Setor</h3>
              <p className="text-xs text-slate-500 font-medium">Natureza predominante dos eventos</p>
            </div>
          </div>
          <div className="p-8 flex flex-col items-center justify-center flex-1">
            <div className="relative size-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventsBySector}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {eventsBySector.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total</span>
                <span className="text-slate-900 text-3xl font-black">{stats.totalEvents}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full mt-8">
              {eventsBySector.slice(0, 4).map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></div>
                  <span className="text-xs font-bold text-slate-600 truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Locations Detail Table */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-8 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Ocupação por Local</h3>
              <p className="text-xs text-slate-500 font-medium">Detalhamento de uso de cada espaço</p>
            </div>
          </div>
          <button className="px-6 py-2 bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-colors">
            Exportar Dados
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Espaço / Local</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total de Eventos</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Atual</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {locationDetails.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">meeting_room</span>
                      </div>
                      <span className="font-bold text-slate-700">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-black text-slate-900">{row.events}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      row.statusColor === 'red' 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <span className={`size-1.5 rounded-full ${row.statusColor === 'red' ? 'bg-red-600 animate-pulse' : 'bg-emerald-600'}`}></span>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-primary hover:shadow-sm transition-all">
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
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