import React, { useState } from 'react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  
  // New props for filters
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  selectedYear: string;
  onYearChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  
  eventTypes: string[];
  locations: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  searchTerm, 
  onSearchChange, 
  resultCount,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  selectedType,
  onTypeChange,
  selectedLocation,
  onLocationChange,
  eventTypes,
  locations
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const months = [
    { value: '0', label: 'Janeiro' },
    { value: '1', label: 'Fevereiro' },
    { value: '2', label: 'Março' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Maio' },
    { value: '5', label: 'Junho' },
    { value: '6', label: 'Julho' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Setembro' },
    { value: '9', label: 'Outubro' },
    { value: '10', label: 'Novembro' },
    { value: '11', label: 'Dezembro' },
  ];

  // Generate years (current year - 1 to current year + 2)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => (currentYear - 1 + i).toString());

  return (
    <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      {/* Top Row: Search and Count */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex flex-1 w-full gap-2">
            <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Buscar eventos, locais ou tipos..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl h-10 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 text-slate-600"
                />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center justify-center w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
              title={showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            >
              <span className="material-symbols-outlined">{showFilters ? 'filter_list_off' : 'filter_list'}</span>
            </button>
        </div>
        
         <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100/50 whitespace-nowrap self-start md:self-auto">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {resultCount} {resultCount === 1 ? 'Evento' : 'Eventos'}
            </span>
          </div>
      </div>

      {/* Bottom Row: Filters */}
      <div className={`${showFilters ? 'grid' : 'hidden'} lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-all duration-300 ease-in-out`}>
        {/* Month */}
        <select 
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl h-10 px-4 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
        >
            <option value="all">Todos os Meses</option>
            {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
            ))}
        </select>

        {/* Year */}
        <select 
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl h-10 px-4 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
        >
            <option value="all">Todos os Anos</option>
            {years.map(y => (
                <option key={y} value={y}>{y}</option>
            ))}
        </select>

        {/* Type */}
        <select 
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl h-10 px-4 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
        >
            <option value="all">Todos os Tipos</option>
            {eventTypes.map(t => (
                <option key={t} value={t}>{t}</option>
            ))}
        </select>

        {/* Location */}
        <select 
            value={selectedLocation}
            onChange={(e) => onLocationChange(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl h-10 px-4 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
        >
            <option value="all">Todos os Locais</option>
            {locations.map(l => (
                <option key={l} value={l}>{l}</option>
            ))}
        </select>
      </div>
    </div>
  );
};
