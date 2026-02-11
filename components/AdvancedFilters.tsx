import React, { useState } from 'react';

interface FilterOption {
  id: string;
  label: string;
}

interface AdvancedFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    unidades: string[];
    users: string[];
    types: string[];
    involvementLevels: string[];
    locations: string[];
    timeRange: [number, number];
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    unidades: string[];
    users: string[];
    types: string[];
    involvementLevels: string[];
    locations: string[];
    timeRange: [number, number];
  }>>;
  options: {
    unidades: string[];
    users: { id: string; name: string }[];
    types: { id: string; name: string }[];
    involvementLevels: { value: string; label: string }[];
    locations: { id: string; name: string }[];
  };
}

const RangeSlider = ({ min, max, step, value, onChange }: { 
  min: number; 
  max: number; 
  step: number; 
  value: [number, number]; 
  onChange: (val: [number, number]) => void 
}) => {
  const minPos = ((value[0] - min) / (max - min)) * 100;
  const maxPos = ((value[1] - min) / (max - min)) * 100;

  return (
    <div className="relative w-full h-6 flex items-center group">
      {/* Track */}
      <div className="absolute w-full h-1 bg-gray-100 rounded-full" />
      
      {/* Active Track */}
      <div 
        className="absolute h-1 bg-primary rounded-full transition-all duration-200"
        style={{ left: `${minPos}%`, width: `${maxPos - minPos}%` }}
      />

      {/* Inputs (Hidden but functional) */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => {
          const val = Math.min(Number(e.target.value), value[1] - step);
          onChange([val, value[1]]);
        }}
        className="absolute w-full h-1 appearance-none bg-transparent pointer-events-none z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[1]}
        onChange={(e) => {
          const val = Math.max(Number(e.target.value), value[0] + step);
          onChange([value[0], val]);
        }}
        className="absolute w-full h-1 appearance-none bg-transparent pointer-events-none z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
      />
    </div>
  );
};

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  options
}) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['unidades']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleToggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const clearFilters = () => {
    setFilters({
      unidades: [],
      users: [],
      types: [],
      involvementLevels: [],
      locations: [],
      timeRange: [0, 1440],
    });
  };

  const removeFilter = (category: keyof typeof filters, value: any) => {
    if (category === 'timeRange') {
      setFilters(prev => ({ ...prev, timeRange: [0, 1440] }));
      return;
    }
    setFilters(prev => ({
      ...prev,
      [category]: (prev[category] as string[]).filter(v => v !== value)
    }));
  };

  const activeFilterCount = Object.entries(filters).reduce((acc, [key, value]) => {
    if (key === 'timeRange') {
      return (value as [number, number])[0] !== 0 || (value as [number, number])[1] !== 1440 ? acc + 1 : acc;
    }
    return acc + (value as any[]).length;
  }, 0);

  const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => {
    const isExpanded = expandedSections.includes(id);
    return (
      <div className="border-b border-gray-100 last:border-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full py-4 flex items-center justify-between text-left group"
        >
          <span className="text-sm font-semibold text-gray-700 group-hover:text-primary transition-colors">
            {title}
          </span>
          <span className={`material-symbols-outlined text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[400px] pb-4 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-2 pr-2 overflow-y-auto max-h-[300px] custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const CustomCheckbox = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer group py-1">
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <div className={`size-5 rounded border-2 transition-all duration-200 ${checked ? 'bg-primary border-primary' : 'bg-white border-gray-200 group-hover:border-primary/50'}`}>
          {checked && (
            <span className="material-symbols-outlined text-white text-[16px] font-bold">
              check
            </span>
          )}
        </div>
      </div>
      <span className={`text-sm transition-colors ${checked ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
        {label}
      </span>
    </label>
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer / Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-[320px] bg-white z-50 border-l border-gray-100 shadow-2xl transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
            <p className="text-xs text-gray-500 mt-0.5">{activeFilterCount} filtros ativos</p>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-xs font-bold text-primary hover:underline"
              >
                Limpar
              </button>
            )}
            <button 
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <span className="material-symbols-outlined text-gray-500">close</span>
            </button>
          </div>
        </div>

        {/* Selected Chips */}
        {activeFilterCount > 0 && (
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([category, values]) => {
                if (category === 'timeRange') {
                  const [min, max] = values as [number, number];
                  if (min === 0 && max === 1440) return null;
                  const formatTime = (mins: number) => {
                    const h = Math.floor(mins / 60).toString().padStart(2, '0');
                    const m = (mins % 60).toString().padStart(2, '0');
                    return `${h}:${m}`;
                  };
                  return (
                    <div 
                      key="timeRange-chip"
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-primary/20 rounded-full text-[11px] font-bold text-primary shadow-sm"
                    >
                      <span>{formatTime(min)} - {formatTime(max)}</span>
                      <button 
                        onClick={() => removeFilter('timeRange', null)}
                        className="hover:text-primary-active transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  );
                }
                
                return (values as string[]).map((value) => {
                  let label = value;
                  if (category === 'users') label = options.users.find(u => u.id === value)?.name || value;
                  if (category === 'types') label = options.types.find(t => t.id === value)?.name || value;
                  if (category === 'locations') label = options.locations.find(l => l.id === value)?.name || value;
                  if (category === 'involvementLevels') label = options.involvementLevels.find(l => l.value === value)?.label || value;
                  
                  return (
                    <div 
                      key={`${category}-${value}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-primary/20 rounded-full text-[11px] font-bold text-primary shadow-sm"
                    >
                      <span className="max-w-[120px] truncate">{label}</span>
                      <button 
                        onClick={() => removeFilter(category as keyof typeof filters, value)}
                        className="hover:text-primary-active transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto px-6 custom-scrollbar">
          <Section title="Setor / Unidade" id="unidades">
            {options.unidades.map(unidade => (
              <CustomCheckbox
                key={unidade}
                label={unidade}
                checked={filters.unidades.includes(unidade)}
                onChange={() => handleToggleFilter('unidades', unidade)}
              />
            ))}
          </Section>

          <Section title="Participantes" id="users">
            {options.users.map(user => (
              <CustomCheckbox
                key={user.id}
                label={user.name}
                checked={filters.users.includes(user.id)}
                onChange={() => handleToggleFilter('users', user.id)}
              />
            ))}
          </Section>

          <Section title="Tipo & Natureza" id="types">
            {options.types.map(type => (
              <CustomCheckbox
                key={type.id}
                label={type.name}
                checked={filters.types.includes(type.id)}
                onChange={() => handleToggleFilter('types', type.id)}
              />
            ))}
          </Section>

          <Section title="Nível de Envolvimento" id="involvement">
            {options.involvementLevels.map(level => (
              <CustomCheckbox
                key={level.value}
                label={level.label}
                checked={filters.involvementLevels.includes(level.value)}
                onChange={() => handleToggleFilter('involvementLevels', level.value)}
              />
            ))}
          </Section>

          <Section title="Localização" id="locations">
            {options.locations.map(loc => (
              <CustomCheckbox
                key={loc.id}
                label={loc.name}
                checked={filters.locations.includes(loc.id)}
                onChange={() => handleToggleFilter('locations', loc.id)}
              />
            ))}
          </Section>

          <Section title="Horário" id="time">
            <div className="px-2 pt-2 pb-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded">
                  {Math.floor(filters.timeRange[0] / 60).toString().padStart(2, '0')}:{(filters.timeRange[0] % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">até</span>
                <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded">
                  {Math.floor(filters.timeRange[1] / 60).toString().padStart(2, '0')}:{(filters.timeRange[1] % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={1440}
                step={30}
                value={filters.timeRange}
                onChange={(val) => setFilters(prev => ({ ...prev, timeRange: val }))}
              />
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[10px] text-gray-400">00:00</span>
                <span className="text-[10px] text-gray-400">12:00</span>
                <span className="text-[10px] text-gray-400">24:00</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer for mobile apply */}
        <div className="p-6 border-t border-gray-100 lg:hidden">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </>
  );
};

export default AdvancedFilters;
