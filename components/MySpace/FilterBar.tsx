import React, { useState, useRef, useEffect } from 'react';

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

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  return (
    <div className="relative group" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50/50 hover:bg-white border border-transparent hover:border-indigo-100 rounded-2xl h-11 px-4 flex items-center justify-between text-sm font-semibold text-slate-600 hover:text-indigo-600 focus:ring-2 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm hover:shadow-md ${isOpen ? 'ring-2 ring-indigo-50 border-indigo-200 bg-white' : ''}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className={`material-symbols-outlined text-slate-400 group-hover:text-indigo-400 text-xl transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-3 text-sm font-bold uppercase tracking-wide cursor-pointer transition-colors rounded-xl mx-1 my-0.5
                  ${value === opt.value 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
    { value: 'all', label: 'Todos os Meses' },
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
  const years = [
    { value: 'all', label: 'Todos os Anos' },
    ...Array.from({ length: 4 }, (_, i) => {
        const year = (currentYear - 1 + i).toString();
        return { value: year, label: year };
    })
  ];

  const typeOptions = [
    { value: 'all', label: 'Todos os Tipos' },
    ...eventTypes.map(t => ({ value: t, label: t }))
  ];

  const locationOptions = [
    { value: 'all', label: 'Todos os Locais' },
    ...locations.map(l => ({ value: l, label: l }))
  ];

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
      <div className={`${showFilters ? 'grid' : 'hidden'} lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-300 ease-in-out`}>
        {/* Month */}
        <CustomSelect 
            value={selectedMonth} 
            onChange={onMonthChange} 
            options={months} 
            placeholder="Todos os Meses" 
        />

        {/* Year */}
        <CustomSelect 
            value={selectedYear} 
            onChange={onYearChange} 
            options={years} 
            placeholder="Todos os Anos" 
        />

        {/* Type */}
        <CustomSelect 
            value={selectedType} 
            onChange={onTypeChange} 
            options={typeOptions} 
            placeholder="Todos os Tipos" 
        />

        {/* Location */}
        <CustomSelect 
            value={selectedLocation} 
            onChange={onLocationChange} 
            options={locationOptions} 
            placeholder="Todos os Locais" 
        />
      </div>
    </div>
  );
};
