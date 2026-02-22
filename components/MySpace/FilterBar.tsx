import React from 'react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({ searchTerm, onSearchChange, resultCount }) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
      <div className="relative flex-1 w-full">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        <input
          type="text"
          placeholder="Buscar eventos, locais ou tipos..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-50 border-none rounded-xl h-10 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 text-slate-600"
        />
      </div>
      
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100/50">
        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {resultCount} {resultCount === 1 ? 'Evento' : 'Eventos'}
        </span>
      </div>
    </div>
  );
};
